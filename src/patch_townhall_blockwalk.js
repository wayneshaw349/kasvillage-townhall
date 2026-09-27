// patch_townhall_blockwalk.js — STATELESS block-walk passthrough on the relay.
//
// Two new endpoints in src/kaspa_relay.rs (pure node proxies, zero storage):
//
//   GET /api/kaspa/sink
//     -> { sink: <hash>, virtual_daa_score: <n>, pruning_point: <hash> }
//     The publisher calls this right before publishing and stamps the sink
//     hash + daa into the game manifest as the walk ANCHOR.
//
//   GET /api/kaspa/blocks?low_hash=<hash>&daa_max=<n>
//     -> { blocks: [ { hash, daa_score,
//            txs: [ { id, payload_hex } ]   // ONLY payload-bearing txs
//          } ... ], next_low_hash: <hash|null>, done: <bool> }
//     One getBlocks page (transactions included), slimmed to payload txs so a
//     phone page is small. Client repeats with next_low_hash until done
//     (past daa_max or caught up to the sink).
//
// With these + the manifest anchor, ANY client is its own indexer inside the
// pruning window: UTXOs give txids + DAA scores, the anchor gives the entry
// hash, the walk yields payloads, hashes verify everything. The relay stays
// stateless — it stores nothing, serves only what its upstream node holds.
//
// Run from the layer1 root:  node src\patch_townhall_blockwalk.js
// (apply AFTER patch_townhall_records.js; idempotent; CRLF-safe)
const fs = require("fs");
const P = "src/kaspa_relay.rs";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("blockwalk passthrough")) { console.log("already patched"); process.exit(0); }
let n = 0;
function rep(name, a, b, exp) {
  const f = s.split(a).length - 1;
  if (f !== exp) { console.error("ABORT [" + name + "]: expected " + exp + ", found " + f); process.exit(1); }
  s = s.split(a).join(b); n++; console.log("ok  [" + name + "]");
}

rep("endpoints",
"// Route registration (matches the .route() style used in configure_routes_v3)",
`// ---------------------------------------------------------------------------
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

// Route registration (matches the .route() style used in configure_routes_v3)`, 1);

rep("routes",
`    cfg.route("/api/kaspa/relay-health", web::get().to(relay_health))`,
`    cfg.route("/api/kaspa/relay-health", web::get().to(relay_health))
        .route("/api/kaspa/sink", web::get().to(sink_info))
        .route("/api/kaspa/blocks", web::get().to(blocks_page))`, 1);

// imports: Hash::from_str + hex encode
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("\npatched " + P + " (" + n + "). cargo check next.");
