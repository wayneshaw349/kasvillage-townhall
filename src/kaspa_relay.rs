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
use once_cell::sync::Lazy;
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
    /// Optional client hint: the address this KVP1 record is published to.
    /// Used only to file the record in the relay's local records store.
    #[serde(default)]
    payload_address: Option<String>,
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
// KVP1 k:"node" registry records get structural validation on top of the word gate.
fn gate_node_record(v: &serde_json::Value) -> Result<(), String> {
    let svc = v.get("svc").and_then(|s| s.as_str()).unwrap_or("");
    if !matches!(svc, "index" | "relay" | "archive") {
        return Err("node record: svc must be index|relay|archive".into());
    }
    let api = v.get("api").and_then(|s| s.as_str()).unwrap_or("");
    if svc != "relay" && !api.starts_with("https://") {
        return Err("node record: api must be https".into());
    }
    let payout = v.get("payout").and_then(|s| s.as_str()).unwrap_or("");
    if !payout.starts_with("kaspatest:") && !payout.starts_with("kaspa:") {
        return Err("node record: payout must be a kaspa address".into());
    }
    let net = v.get("net").and_then(|s| s.as_str()).unwrap_or("");
    if net != "tn10" {
        return Err("node record: net must be tn10".into());
    }
    Ok(())
}

fn gate_payload(payload: &[u8]) -> Result<(), String> {
    if payload.len() > MAX_PAYLOAD_BYTES {
        return Err(format!("payload exceeds {} bytes", MAX_PAYLOAD_BYTES));
    }
    if payload.len() >= 4 && &payload[0..4] == b"KVP1" {
        if let Ok(text) = std::str::from_utf8(&payload[4..]) {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(text) {
                if v.get("k").and_then(|k| k.as_str()) == Some("node") {
                    gate_node_record(&v)?;
                }
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
            if let Some(addr) = body.payload_address.as_deref() {
                if let Some(pl) = body.transaction.payload.as_deref() {
                    if !pl.is_empty() && (addr.starts_with("kaspatest:") || addr.starts_with("kaspa:")) && addr.len() <= 80 {
                        store_relay_record(addr, &txid.to_string(), pl);
                    }
                }
            }
            HttpResponse::Ok().json(json!({ "transactionId": txid.to_string() }))
        }
        Err(e) => {
            println!("[KaspaRelay] node rejected: {}", e);
            HttpResponse::UnprocessableEntity().json(json!({ "error": format!("node rejected: {}", e) }))
        }
    }
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// blockwalk passthrough — stateless node proxies for client-side indexing.
// ---------------------------------------------------------------------------
pub async fn sink_info() -> impl Responder {
    let client = match connect_client().await {
        Ok(c) => c,
        Err(e) => return HttpResponse::ServiceUnavailable().json(json!({ "error": e })),
    };
    let out = match client.get_block_dag_info().await {
        Ok(i) => HttpResponse::Ok().json(json!({
            "sink": i.sink.to_string(),
            "virtual_daa_score": i.virtual_daa_score,
            "pruning_point": i.pruning_point_hash.to_string(),
        })),
        Err(e) => HttpResponse::BadGateway().json(json!({ "error": format!("{}", e) })),
    };
    let _ = client.disconnect().await;
    out
}

#[derive(Deserialize)]
pub struct BlocksQ { low_hash: String, daa_max: Option<u64>, txs: Option<u8> }

pub async fn blocks_page(q: web::Query<BlocksQ>) -> impl Responder {
    let low = match RpcHash::from_str(&q.low_hash) {
        Ok(h) => h,
        Err(_) => return HttpResponse::BadRequest().json(json!({ "error": "bad low_hash" })),
    };
    // txs=0 -> FAST-FORWARD page: headers only, ~100x lighter. The walker skims
    // pruning_point -> daa_from with txs=0, then re-requests with txs=1 inside
    // the advertised span. daa_max stops the walk past the span.
    let want_txs = q.txs.unwrap_or(1) != 0;
    let client = match connect_client().await {
        Ok(c) => c,
        Err(e) => return HttpResponse::ServiceUnavailable().json(json!({ "error": e })),
    };
    let out = match client.get_blocks(Some(low), true, want_txs).await {
        Ok(r) => {
            let daa_max = q.daa_max.unwrap_or(u64::MAX);
            let mut past_max = false;
            let mut min_daa: u64 = u64::MAX;
            let mut max_daa: u64 = 0;
            let mut blocks = Vec::new();
            for b in r.blocks.iter() {
                let daa = b.header.daa_score;
                if daa > daa_max { past_max = true; }
                if daa < min_daa { min_daa = daa; }
                if daa > max_daa { max_daa = daa; }
                if want_txs {
                    let txs: Vec<serde_json::Value> = b.transactions.iter().filter_map(|t| {
                        if t.payload.is_empty() { return None; }
                        let id = t.verbose_data.as_ref().map(|v| v.transaction_id.to_string()).unwrap_or_default();
                        Some(json!({ "id": id, "payload_hex": hex::encode(&t.payload) }))
                    }).collect();
                    if !txs.is_empty() {
                        blocks.push(json!({ "hash": b.header.hash.to_string(), "daa_score": daa, "txs": txs }));
                    }
                }
            }
            let next = r.block_hashes.last().map(|h| h.to_string());
            let done = past_max || r.block_hashes.len() <= 1;
            HttpResponse::Ok().json(json!({
                "blocks": blocks, "next_low_hash": next, "done": done,
                "page_daa_min": if min_daa == u64::MAX { 0 } else { min_daa },
                "page_daa_max": max_daa,
            }))
        }
        Err(e) => HttpResponse::BadGateway().json(json!({ "error": format!("{}", e) })),
    };
    let _ = client.disconnect().await;
    out
}

// Route registration (matches the .route() style used in configure_routes_v3)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// relay_records — KVP1 payloads this relay broadcast, filed by address.
// JSONL-persisted; a cache for wallets when public indexers lag (records are
// self-verifying downstream via KVP1 signatures and content hashes).
// ---------------------------------------------------------------------------
#[derive(Clone, serde::Serialize, serde::Deserialize)]
struct StoredRecord { txid: String, payload: String, ts: u64 }

static RELAY_RECORDS: Lazy<std::sync::Mutex<std::collections::HashMap<String, Vec<StoredRecord>>>> =
    Lazy::new(|| {
        let mut map: std::collections::HashMap<String, Vec<StoredRecord>> = std::collections::HashMap::new();
        let path = records_path();
        if let Ok(text) = std::fs::read_to_string(&path) {
            for line in text.lines() {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(line) {
                    let (Some(a), Some(t), Some(p)) = (
                        v.get("addr").and_then(|x| x.as_str()),
                        v.get("txid").and_then(|x| x.as_str()),
                        v.get("payload").and_then(|x| x.as_str()),
                    ) else { continue };
                    let ts = v.get("ts").and_then(|x| x.as_u64()).unwrap_or(0);
                    map.entry(a.to_string()).or_default().push(StoredRecord { txid: t.to_string(), payload: p.to_string(), ts });
                }
            }
        }
        println!("[RelayRecords] loaded {} addresses from {}", map.len(), path);
        std::sync::Mutex::new(map)
    });

fn records_path() -> String {
    std::env::var("KV_RECORDS_PATH").unwrap_or_else(|_| "./relay_records.jsonl".to_string())
}

fn store_relay_record(addr: &str, txid: &str, payload_hex: &str) {
    let ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0);
    let line = serde_json::json!({ "addr": addr, "txid": txid, "payload": payload_hex, "ts": ts }).to_string();
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(records_path()) {
        use std::io::Write;
        let _ = writeln!(f, "{}", line);
    }
    if let Ok(mut m) = RELAY_RECORDS.lock() {
        let v = m.entry(addr.to_string()).or_default();
        if v.iter().any(|r| r.txid == txid) { return; }
        v.push(StoredRecord { txid: txid.to_string(), payload: payload_hex.to_string(), ts });
        if v.len() > 4000 { let excess = v.len() - 4000; v.drain(0..excess); }
    }
}

pub async fn get_relay_records(path: web::Path<String>, q: web::Query<std::collections::HashMap<String, String>>) -> impl Responder {
    let addr = path.into_inner();
    if !(addr.starts_with("kaspatest:") || addr.starts_with("kaspa:")) || addr.len() > 80 {
        return HttpResponse::BadRequest().json(json!({ "error": "bad address" }));
    }
    let limit: usize = q.get("limit").and_then(|s| s.parse().ok()).unwrap_or(500).min(2000);
    let out: Vec<serde_json::Value> = RELAY_RECORDS.lock().ok()
        .and_then(|m| m.get(&addr).cloned())
        .map(|mut v| {
            v.sort_by(|a, b| b.ts.cmp(&a.ts));
            v.into_iter().take(limit)
                .map(|r| json!({ "transaction_id": r.txid, "payload": r.payload, "block_time": r.ts }))
                .collect()
        })
        .unwrap_or_default();
    HttpResponse::Ok().json(out)
}

pub fn configure_kaspa_relay_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/api/kaspa/relay-health", web::get().to(relay_health))
        .route("/api/kaspa/sink", web::get().to(sink_info))
        .route("/api/kaspa/blocks", web::get().to(blocks_page))
        .route("/api/kaspa/submit-tx", web::post().to(submit_tx))
        .route("/api/kaspa/records/{address}", web::get().to(get_relay_records));
}
