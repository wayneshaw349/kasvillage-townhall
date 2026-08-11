// node_registry.rs — Archival/Indexer Registry + Proof-of-Storage Audit
//
// Registry records are themselves KVP1 payload txs sent to NODE_REGISTRY_ADDRESS
// (self-indexing: discoverable by the same KVRead scan as every other record).
//
// Record shape: KVP1{"k":"node","svc":"index"|"relay"|"archive",
//                    "api":"https://rest-base","payout":"kaspatest:...","net":"tn10"}
//   output 0 = operator bond (to their own address; unspent = active)
//   output 1 = 1 KAS announce to NODE_REGISTRY_ADDRESS (discovery)
//
// Routes:
//   GET /api/nodes/registry — scan registry, bond status per record
//   GET /api/nodes/audit    — run proof-of-storage audit, return pass/fail
//
// Audit v1: challenge each indexer with KasVillage txids drawn from the
// registry itself (guaranteed history) + optional extra ids via env
// KV_AUDIT_TXIDS (comma-separated). An indexer that doesn't store history
// cannot return the correct payload hex.
//
// Wiring in main.rs:
//   mod node_registry;
//   .configure(node_registry::configure_node_registry_routes)

use actix_web::{web, HttpResponse, Responder};
use serde_json::json;
use once_cell::sync::Lazy;
use std::sync::RwLock;

// Cached audit result + unix seconds it was produced. Written by the background
// sweep, read by GET /api/nodes/audit. ?fresh=1 bypasses the cache.
static AUDIT_CACHE: Lazy<RwLock<Option<(u64, serde_json::Value)>>> =
    Lazy::new(|| RwLock::new(None));

// How often the background sweep re-audits every registered operator.
const AUDIT_INTERVAL_SECS: u64 = 600;

// Derived: sha256("KV-REGISTRY-V1-node") as x-only pubkey -> kaspa bech32m.
// Mirrors payload_publish.ts registryAddress("node"). Unspendable by design.
const NODE_REGISTRY_ADDRESS: &str = "kaspatest:qp35q2e5maacw03gyuh5pdr389y92nxp4dttxlr728pf0xcxytxd7nspt3z2k";
const TN10_API: &str = "https://api-tn10.kaspa.org";
const MAX_REGISTRY_TXS: usize = 200;

#[derive(Debug, Clone, serde::Serialize)]
pub struct NodeRecord {
    pub txid: String,
    pub svc: String,
    pub api: String,
    pub payout: String,
    pub net: String,
    pub bond_outpoint: String,
    pub bond_amount: u64,
    pub bond_address: String,
    pub bond_unspent: bool,
    pub daa_registered: u64,
}

fn http() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}

fn parse_kvp1_node(payload_hex: &str) -> Option<serde_json::Value> {
    let bytes = hex::decode(payload_hex).ok()?;
    if bytes.len() < 4 || &bytes[0..4] != b"KVP1" { return None; }
    let text = std::str::from_utf8(&bytes[4..]).ok()?;
    let v: serde_json::Value = serde_json::from_str(text).ok()?;
    if v.get("k")?.as_str()? == "node" { Some(v) } else { None }
}

async fn fetch_registry_records() -> Result<Vec<NodeRecord>, String> {
    let client = http();
    let url = format!(
        "{}/addresses/{}/full-transactions?limit={}&resolve_previous_outpoints=no",
        TN10_API, NODE_REGISTRY_ADDRESS, MAX_REGISTRY_TXS
    );
    let txs: serde_json::Value = client
        .get(&url).send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;
    let arr = txs.as_array().ok_or("unexpected registry response")?;

    let mut records = Vec::new();
    for tx in arr {
        let payload = tx.get("payload").and_then(|p| p.as_str()).unwrap_or("");
        let Some(rec) = parse_kvp1_node(payload) else { continue };
        let txid = tx.get("transaction_id").and_then(|t| t.as_str()).unwrap_or("").to_string();
        if txid.is_empty() { continue; }
        let outputs = tx.get("outputs").and_then(|o| o.as_array()).cloned().unwrap_or_default();
        let Some(bond_out) = outputs.iter().find(|o| o.get("index").and_then(|i| i.as_u64()) == Some(0)) else { continue };
        let bond_address = bond_out.get("script_public_key_address").and_then(|a| a.as_str()).unwrap_or("").to_string();
        let bond_amount = bond_out.get("amount").and_then(|a| a.as_u64()).unwrap_or(0);

        records.push(NodeRecord {
            txid: txid.clone(),
            svc: rec.get("svc").and_then(|s| s.as_str()).unwrap_or("").to_string(),
            api: rec.get("api").and_then(|s| s.as_str()).unwrap_or("").to_string(),
            payout: rec.get("payout").and_then(|s| s.as_str()).unwrap_or("").to_string(),
            net: rec.get("net").and_then(|s| s.as_str()).unwrap_or("").to_string(),
            bond_outpoint: format!("{}:0", txid),
            bond_amount,
            bond_address,
            bond_unspent: false, // filled below
            daa_registered: tx.get("accepting_block_blue_score").and_then(|d| d.as_u64()).unwrap_or(0),
        });
    }

    // Bond status: outpoint present in the bond address's current utxo set.
    let client2 = http();
    for r in records.iter_mut() {
        if r.bond_address.is_empty() { continue; }
        let url = format!("{}/addresses/{}/utxos", TN10_API, r.bond_address);
        if let Ok(resp) = client2.get(&url).send().await {
            if let Ok(utxos) = resp.json::<serde_json::Value>().await {
                if let Some(list) = utxos.as_array() {
                    r.bond_unspent = list.iter().any(|u| {
                        u.get("outpoint")
                            .map(|o| {
                                o.get("transactionId").and_then(|t| t.as_str()) == Some(r.txid.as_str())
                                    && o.get("index").and_then(|i| i.as_u64()) == Some(0)
                            })
                            .unwrap_or(false)
                    });
                }
            }
        }
    }

    // Latest record per payout address wins (re-registration supersedes).
    records.sort_by(|a, b| b.daa_registered.cmp(&a.daa_registered));
    let mut seen = std::collections::HashSet::new();
    records.retain(|r| seen.insert(r.payout.clone()));
    Ok(records)
}

pub async fn get_registry() -> impl Responder {
    match fetch_registry_records().await {
        Ok(records) => HttpResponse::Ok().json(json!({
            "registry": NODE_REGISTRY_ADDRESS,
            "count": records.len(),
            "nodes": records,
        })),
        Err(e) => HttpResponse::BadGateway().json(json!({ "error": e })),
    }
}

// ---------------------------------------------------------------------------
// Proof-of-storage audit
// ---------------------------------------------------------------------------
async fn truth_payload(client: &reqwest::Client, txid: &str) -> Option<String> {
    let url = format!("{}/transactions/{}?inputs=false&outputs=false", TN10_API, txid);
    let v: serde_json::Value = client.get(&url).send().await.ok()?.json().await.ok()?;
    v.get("payload").and_then(|p| p.as_str()).map(|s| s.to_string())
}

/// Runs one full audit sweep and returns the JSON body. Used by both the
/// HTTP handler and the background task.
pub async fn audit_once() -> serde_json::Value {
    let records = match fetch_registry_records().await {
        Ok(r) => r,
        Err(e) => return json!({ "error": e }),
    };
    let client = http();

    // Challenge set: node announces + STORE registry txids (real marketplace
    // history) + env extras. Storing only your own announce is not enough.
    let mut challenges: Vec<String> = records.iter().map(|r| r.txid.clone()).collect();
    challenges.extend(fetch_store_txids().await.unwrap_or_default());
    if let Ok(extra) = std::env::var("KV_AUDIT_TXIDS") {
        challenges.extend(extra.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()));
    }
    if challenges.is_empty() {
        return json!({ "nodes": [], "note": "no challenges available" });
    }

    // Pseudo-random pick (time-seeded) — good enough: operators can't predict
    // which id is chosen and must store all of them to always pass.
    let seed = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs()).unwrap_or(0) as usize;

    let mut results = Vec::new();
    for (i, r) in records.iter().enumerate() {
        if r.svc != "index" && r.svc != "archive" {
            results.push(json!({ "payout": r.payout, "svc": r.svc, "audited": false, "reason": "svc not auditable" }));
            continue;
        }
        if !r.bond_unspent {
            results.push(json!({ "payout": r.payout, "audited": false, "pass": false, "reason": "bond spent" }));
            continue;
        }
        let challenge = &challenges[(seed + i) % challenges.len()];
        let truth = truth_payload(&client, challenge).await;
        let their_url = format!("{}/transactions/{}?inputs=false&outputs=false", r.api.trim_end_matches('/'), challenge);
        let theirs: Option<String> = match client.get(&their_url).send().await {
            Ok(resp) => resp.json::<serde_json::Value>().await.ok()
                .and_then(|v| v.get("payload").and_then(|p| p.as_str()).map(|s| s.to_string())),
            Err(_) => None,
        };
        let pass = match (&truth, &theirs) {
            (Some(t), Some(o)) => t == o,
            _ => false,
        };
        results.push(json!({
            "payout": r.payout,
            "svc": r.svc,
            "api": r.api,
            "challenge_txid": challenge,
            "audited": true,
            "pass": pass,
            "bond_unspent": r.bond_unspent,
            "bond_amount": r.bond_amount,
        }));
    }

    json!({ "audited_at": seed, "nodes": results })
}

// Store registry address: sha256("KV-REGISTRY-V1-store") -> bech32m.
// Derived alongside the node address; same encoder, category "store".
const STORE_REGISTRY_ADDRESS: &str = "kaspatest:qzuwzvff0hn629auv0hk067wfxnwx5t2zw6dayz84ktknklm7s3sjm67xzh87";

/// Txids of store announces � real KasVillage content operators must archive.
async fn fetch_store_txids() -> Result<Vec<String>, String> {
    let client = http();
    let url = format!("{}/addresses/{}/full-transactions?limit={}", TN10_API, STORE_REGISTRY_ADDRESS, MAX_REGISTRY_TXS);
    let v: serde_json::Value = client.get(&url).send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;
    Ok(v.as_array().map(|arr| arr.iter()
        .filter_map(|t| t.get("transaction_id").and_then(|s| s.as_str()).map(|s| s.to_string()))
        .collect()).unwrap_or_default())
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Background sweep: re-audits every AUDIT_INTERVAL_SECS so the panel shows
/// recent results without every viewer triggering a live sweep.
pub fn spawn_audit_loop() {
    tokio::spawn(async {
        loop {
            let body = audit_once().await;
            if let Ok(mut w) = AUDIT_CACHE.write() {
                *w = Some((now_secs(), body));
            }
            tokio::time::sleep(std::time::Duration::from_secs(AUDIT_INTERVAL_SECS)).await;
        }
    });
}

#[derive(serde::Deserialize)]
pub struct AuditQuery {
    fresh: Option<String>,
}

pub async fn run_audit(q: web::Query<AuditQuery>) -> impl Responder {
    let want_fresh = q.fresh.as_deref().map(|v| v == "1" || v == "true").unwrap_or(false);
    if !want_fresh {
        if let Ok(r) = AUDIT_CACHE.read() {
            if let Some((at, body)) = r.as_ref() {
                let mut out = body.clone();
                if let Some(o) = out.as_object_mut() {
                    o.insert("cached".into(), json!(true));
                    o.insert("age_secs".into(), json!(now_secs().saturating_sub(*at)));
                }
                return HttpResponse::Ok().json(out);
            }
        }
    }
    let mut body = audit_once().await;
    if let Some(o) = body.as_object_mut() {
        o.insert("cached".into(), json!(false));
    }
    if let Ok(mut w) = AUDIT_CACHE.write() {
        *w = Some((now_secs(), body.clone()));
    }
    HttpResponse::Ok().json(body)
}

pub fn configure_node_registry_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/api/nodes/registry", web::get().to(get_registry))
        .route("/api/nodes/audit", web::get().to(run_audit));
}
