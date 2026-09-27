// patch_townhall_records.js — relays remember every KVP1 payload they
// broadcast and serve them back: GET /api/kaspa/records/{address}.
//
// Why: api-tn10's address-history index stopped ingesting on Sep 23, so
// nothing published since (game chunks, store configs) can be fetched from
// it. The relay SEES every chunk at submit time — it is the natural index.
// Records are self-verifying downstream (KVP1 signatures + chunk hashes +
// the game HEAD), so this store is a cache, not a trust root.
//
// Adds to src/kaspa_relay.rs:
//   - SubmitReq gains optional payload_address (client hint: the dust
//     recipient the record belongs to)
//   - on successful broadcast of a KVP1 payload with a hint: append
//     {addr, txid, payload_hex, ts} to an in-memory map + JSONL file
//     (KV_RECORDS_PATH, default ./relay_records.jsonl; loaded on boot;
//     capped at 4000 records per address)
//   - GET /api/kaspa/records/{address}?limit=N -> newest-first
//     [{transaction_id, payload, block_time}] — the same field names the
//     wallet's decodePayloadHex path already reads.
//
// Run from the layer1 root:  node patch_townhall_records.js
// Then: cargo check -> push -> Actions -> redeploy TownHall AND relay nodes.
const fs = require("fs");
const P = "src/kaspa_relay.rs";
let rs = fs.readFileSync(P, "utf8");
if (rs.includes("relay_records")) { console.log("already patched"); process.exit(0); }
let n = 0;
function rep(name, anchor, to, expected) {
  const found = rs.split(anchor).length - 1;
  if (found !== expected) { console.error(`ABORT [${name}]: expected ${expected}, found ${found}`); process.exit(1); }
  rs = rs.split(anchor).join(to); n++; console.log("ok  [" + name + "]");
}

// 1. SubmitReq: optional address hint
rep("submitreq-hint",
`struct SubmitReq {`,
`struct SubmitReq {
    /// Optional client hint: the address this KVP1 record is published to.
    /// Used only to file the record in the relay's local records store.
    #[serde(default)]
    payload_address: Option<String>,`, 1);

// 1b. Lazy import (kaspa_relay.rs doesn't import once_cell yet)
rep("lazy-import",
`use serde_json::json;`,
`use serde_json::json;
use once_cell::sync::Lazy;`, 1);

// 2. records store + endpoint, inserted before route registration
rep("records-store",
`pub fn configure_kaspa_relay_routes(`,
`// ---------------------------------------------------------------------------
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

pub fn configure_kaspa_relay_routes(`, 1);

rep("store-on-broadcast",
`        Ok(txid) => {
            println!("[KaspaRelay] broadcast ok: {}", txid);
            HttpResponse::Ok().json(json!({ "transactionId": txid.to_string() }))
        }`,
`        Ok(txid) => {
            println!("[KaspaRelay] broadcast ok: {}", txid);
            if let Some(addr) = body.payload_address.as_deref() {
                if let Some(pl) = body.transaction.payload.as_deref() {
                    if !pl.is_empty() && (addr.starts_with("kaspatest:") || addr.starts_with("kaspa:")) && addr.len() <= 80 {
                        store_relay_record(addr, &txid.to_string(), pl);
                    }
                }
            }
            HttpResponse::Ok().json(json!({ "transactionId": txid.to_string() }))
        }`, 1);

// 4. route
rep("route",
`        .route("/api/kaspa/submit-tx", web::post().to(submit_tx));`,
`        .route("/api/kaspa/submit-tx", web::post().to(submit_tx))
        .route("/api/kaspa/records/{address}", web::get().to(get_relay_records));`, 1);

fs.writeFileSync(P, rs);
console.log("\npatched " + P + " (" + n + " patches). cargo check, push, redeploy TownHall + relay nodes.");
