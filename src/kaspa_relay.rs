// kaspa_relay.rs — TownHall Kaspa payload-tx relay
// REST api-tn10 SubmitTxModel strips the payload field, so payload-carrying txs
// are forwarded to a public tn10 node over wRPC-borsh via official rusty-kaspa crates.
//
// Routes:
//   GET  /api/kaspa/relay-health  — connects upstream, returns network + daa score
//   POST /api/kaspa/submit-tx     — body: { transaction: <REST-shaped tx>, allowOrphan?: bool }
//
// Trust model: forwards user-signed bytes verbatim. Tamper is impossible without
// breaking the Schnorr sig; the txid commits the payload, so the client's
// PREDICT CHECK independently verifies what was broadcast.
//
// Wiring in main.rs (route-style, matches configure_routes_v3):
//   mod kaspa_relay;
//   ...inside configure_routes_v3, append:
//        .route("/api/kaspa/relay-health", web::get().to(kaspa_relay::relay_health))
//        .route("/api/kaspa/submit-tx", web::post().to(kaspa_relay::submit_tx))
//   or register the module's own configure:
//        App::new().configure(kaspa_relay::configure_kaspa_relay_routes)

use actix_web::{web, HttpResponse, Responder};
use serde::Deserialize;
use serde_json::json;
use std::str::FromStr;
use std::time::Duration;

use kaspa_consensus_core::subnets::SubnetworkId;
use kaspa_consensus_core::tx::ScriptPublicKey;
use kaspa_rpc_core::{
    RpcHash, RpcTransaction, RpcTransactionInput, RpcTransactionOutpoint, RpcTransactionOutput,
};
use kaspa_wrpc_client::client::{ConnectOptions, ConnectStrategy};
use kaspa_wrpc_client::prelude::{NetworkId, NetworkType, RpcApi};
use kaspa_wrpc_client::{KaspaRpcClient, WrpcEncoding};

// ---------------------------------------------------------------------------
// Upstream nodes (borsh over TLS). First that connects wins.
// Override / extend via env KASPA_WRPC_URLS (comma-separated).
// ---------------------------------------------------------------------------
const DEFAULT_UPSTREAMS: &[&str] = &[
    "wss://neutrino-10.kaspa.stream/kaspa/testnet-10/wrpc/borsh",
];

const MAX_PAYLOAD_BYTES: usize = 2048;

const PROHIBITED_WORDS: &[&str] = &[
    "casino", "gambling", "slot", "poker", "blackjack", "roulette", "lottery",
    "jackpot", "sportsbook", "wagering", "porn", "xxx",
];

// ---------------------------------------------------------------------------
// Incoming JSON shapes (mirror the app's REST-shaped tx; numbers may arrive
// as strings, so parse via serde_json::Value)
// ---------------------------------------------------------------------------
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct JsOutpoint {
    transaction_id: String,
    index: u32,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct JsInput {
    previous_outpoint: JsOutpoint,
    signature_script: String,
    sequence: serde_json::Value,
    #[serde(default)]
    sig_op_count: Option<u8>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct JsSpk {
    #[serde(default)]
    version: u16,
    script_public_key: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct JsOutput {
    amount: serde_json::Value,
    script_public_key: JsSpk,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct JsTx {
    #[serde(default)]
    version: u16,
    inputs: Vec<JsInput>,
    outputs: Vec<JsOutput>,
    #[serde(default)]
    lock_time: serde_json::Value,
    #[serde(default)]
    subnetwork_id: Option<String>,
    #[serde(default)]
    gas: serde_json::Value,
    #[serde(default)]
    payload: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SubmitReq {
    transaction: JsTx,
    #[serde(default)]
    allow_orphan: Option<bool>,
}

fn val_to_u64(v: &serde_json::Value) -> Result<u64, String> {
    match v {
        serde_json::Value::Null => Ok(0),
        serde_json::Value::Number(n) => n.as_u64().ok_or_else(|| "non-u64 number".into()),
        serde_json::Value::String(s) => {
            if s.is_empty() { Ok(0) } else { s.parse::<u64>().map_err(|e| e.to_string()) }
        }
        _ => Err("unexpected numeric type".into()),
    }
}

fn hex_decode(s: &str) -> Result<Vec<u8>, String> {
    if s.len() % 2 != 0 { return Err("odd-length hex".into()); }
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).map_err(|e| e.to_string()))
        .collect()
}

// ---------------------------------------------------------------------------
// KVP1 content gate — mechanical format enforcement, not editorial review.
// Payload must be small; if it is a KVP1 record, its string fields must clear
// the prohibited-word list. Non-KVP1 payloads are size-capped only.
// ---------------------------------------------------------------------------
fn gate_payload(payload: &[u8]) -> Result<(), String> {
    if payload.len() > MAX_PAYLOAD_BYTES {
        return Err(format!("payload exceeds {} bytes", MAX_PAYLOAD_BYTES));
    }
    if payload.len() >= 4 && &payload[0..4] == b"KVP1" {
        if let Ok(text) = std::str::from_utf8(&payload[4..]) {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(text) {
                let mut stack = vec![&v];
                while let Some(node) = stack.pop() {
                    match node {
                        serde_json::Value::String(s) => {
                            let lower = s.to_lowercase();
                            for w in PROHIBITED_WORDS {
                                if lower.contains(w) {
                                    return Err("payload contains prohibited term".into());
                                }
                            }
                        }
                        serde_json::Value::Array(a) => stack.extend(a.iter()),
                        serde_json::Value::Object(o) => stack.extend(o.values()),
                        _ => {}
                    }
                }
            } else {
                return Err("KVP1 payload is not valid JSON".into());
            }
        } else {
            return Err("KVP1 payload is not valid UTF-8".into());
        }
    }
    Ok(())
}

fn upstream_urls() -> Vec<String> {
    if let Ok(env) = std::env::var("KASPA_WRPC_URLS") {
        let list: Vec<String> = env
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        if !list.is_empty() {
            return list;
        }
    }
    DEFAULT_UPSTREAMS.iter().map(|s| s.to_string()).collect()
}

async fn connect_client() -> Result<KaspaRpcClient, String> {
    let network_id = NetworkId::with_suffix(NetworkType::Testnet, 10);
    let mut last_err = String::from("no upstream configured");
    for url in upstream_urls() {
        match KaspaRpcClient::new(
            WrpcEncoding::Borsh,
            Some(url.as_str()),
            None,
            Some(network_id),
            None,
        ) {
            Ok(client) => {
                let opts = ConnectOptions {
                    block_async_connect: true,
                    strategy: ConnectStrategy::Fallback,
                    url: None,
                    connect_timeout: Some(Duration::from_secs(10)),
                    retry_interval: None,
                };
                match client.connect(Some(opts)).await {
                    Ok(_) => {
                        println!("[KaspaRelay] connected: {}", url);
                        return Ok(client);
                    }
                    Err(e) => last_err = format!("{}: {}", url, e),
                }
            }
            Err(e) => last_err = format!("{}: {}", url, e),
        }
    }
    Err(last_err)
}

fn build_rpc_tx(js: &JsTx) -> Result<RpcTransaction, String> {
    let payload = match &js.payload {
        Some(hex) if !hex.is_empty() => hex_decode(hex)?,
        _ => Vec::new(),
    };
    gate_payload(&payload)?;

    let subnet_hex = js
        .subnetwork_id
        .clone()
        .unwrap_or_else(|| "0000000000000000000000000000000000000000".to_string());
    let subnet_bytes = hex_decode(&subnet_hex)?;
    if subnet_bytes.len() != 20 {
        return Err("subnetworkId must be 20 bytes".into());
    }
    let mut subnet_arr = [0u8; 20];
    subnet_arr.copy_from_slice(&subnet_bytes);

    let mut inputs: Vec<RpcTransactionInput> = Vec::with_capacity(js.inputs.len());
    for i in &js.inputs {
        inputs.push(RpcTransactionInput {
            previous_outpoint: RpcTransactionOutpoint {
                transaction_id: RpcHash::from_str(&i.previous_outpoint.transaction_id)
                    .map_err(|e| format!("bad prev txid: {}", e))?,
                index: i.previous_outpoint.index,
            },
            signature_script: hex_decode(&i.signature_script)?,
            sequence: val_to_u64(&i.sequence)?,
            sig_op_count: i.sig_op_count.unwrap_or(1),
            verbose_data: None,
        });
    }

    let mut outputs: Vec<RpcTransactionOutput> = Vec::with_capacity(js.outputs.len());
    for o in &js.outputs {
        let script = hex_decode(&o.script_public_key.script_public_key)?;
        outputs.push(RpcTransactionOutput {
            value: val_to_u64(&o.amount)?,
            script_public_key: ScriptPublicKey::new(
                o.script_public_key.version,
                script.into(),
            ),
            verbose_data: None,
        });
    }

    Ok(RpcTransaction {
        version: js.version,
        inputs,
        outputs,
        lock_time: val_to_u64(&js.lock_time)?,
        subnetwork_id: SubnetworkId::from_bytes(subnet_arr),
        gas: val_to_u64(&js.gas)?,
        payload,
        mass: 0,
        verbose_data: None,
    })
}

pub async fn relay_health() -> impl Responder {
    match connect_client().await {
        Ok(client) => {
            let dag = client.get_block_dag_info().await;
            let _ = client.disconnect().await;
            match dag {
                Ok(info) => HttpResponse::Ok().json(json!({
                    "ok": true,
                    "network": info.network.to_string(),
                    "virtualDaaScore": info.virtual_daa_score,
                })),
                Err(e) => HttpResponse::BadGateway()
                    .json(json!({ "ok": false, "error": format!("dag info: {}", e) })),
            }
        }
        Err(e) => HttpResponse::BadGateway().json(json!({ "ok": false, "error": e })),
    }
}

pub async fn submit_tx(body: web::Json<SubmitReq>) -> impl Responder {
    let rpc_tx = match build_rpc_tx(&body.transaction) {
        Ok(t) => t,
        Err(e) => {
            return HttpResponse::BadRequest().json(json!({ "error": format!("invalid tx: {}", e) }))
        }
    };
    let allow_orphan = body.allow_orphan.unwrap_or(false);

    let client = match connect_client().await {
        Ok(c) => c,
        Err(e) => {
            return HttpResponse::BadGateway()
                .json(json!({ "error": format!("upstream connect failed: {}", e) }))
        }
    };

    let res = client.submit_transaction(rpc_tx, allow_orphan).await;
    let _ = client.disconnect().await;

    match res {
        Ok(txid) => {
            println!("[KaspaRelay] broadcast ok: {}", txid);
            HttpResponse::Ok().json(json!({ "transactionId": txid.to_string() }))
        }
        Err(e) => {
            println!("[KaspaRelay] node rejected: {}", e);
            HttpResponse::UnprocessableEntity().json(json!({ "error": format!("node rejected: {}", e) }))
        }
    }
}

// ---------------------------------------------------------------------------
// Route registration (matches the .route() style used in configure_routes_v3)
// ---------------------------------------------------------------------------
pub fn configure_kaspa_relay_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/api/kaspa/relay-health", web::get().to(relay_health))
        .route("/api/kaspa/submit-tx", web::post().to(submit_tx));
}
