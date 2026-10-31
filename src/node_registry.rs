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

// node_registry.rs — Operator registry + proof-of-storage audit, per network.
//
// Rebuilt from chain on every call: nothing here is stored on the relay, so an
// ephemeral Flux node loses only the audit cache (refilled by the next sweep).
//
// v2 (pledge rail): operator sends
//   (a) 10 KAS bond -> its own derived pledge address (reclaimable in My Pledges)
//   (b) 1 KAS signed KVP1 announce -> registryAddress('node', net):
//       {k:"registry", o, t, d:{storeAddress, category:"node", svc, api, payout, net}, sig}
// Active = schnorr sig valid AND >= 10 KAS unspent at storeAddress funded
// entirely FROM the announcer's own P2PK address (a claimed rich address proves nothing).
//
// Routes: GET /api/nodes/registry?network=   GET /api/nodes/audit?network=&fresh=1

use actix_web::{web, HttpResponse, Responder};
use serde_json::json;
use once_cell::sync::Lazy;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::RwLock;

// Per-network cached audit result + unix seconds it was produced.
static AUDIT_CACHE: Lazy<RwLock<HashMap<String, (u64, serde_json::Value)>>> =
    Lazy::new(|| RwLock::new(HashMap::new()));

const AUDIT_INTERVAL_SECS: u64 = 600;
const MAX_REGISTRY_TXS: usize = 200;
const NODE_BOND_SOMPI: u64 = 1_000_000_000; // 10 KAS
const NETS: [&str; 2] = ["mainnet", "testnet-10"];

fn norm_net(n: Option<&str>) -> &'static str {
    match n.unwrap_or("") {
        "mainnet" | "main" | "kaspa" => "mainnet",
        "testnet-10" | "tn10" | "testnet" => "testnet-10",
        _ => "mainnet", // KV_NET is mainnet; testnet callers pass network=
    }
}

fn api_base(net: &str) -> &'static str {
    if net == "mainnet" { "https://api.kaspa.org" } else { "https://api-tn10.kaspa.org" }
}

/// sha256("KV-REGISTRY-V1-<cat>") as x-only -> address. Mirrors kaspa_payload.ts registryAddress.
pub fn registry_address(category: &str, net: &str) -> String {
    let x = Sha256::digest(format!("KV-REGISTRY-V1-{}", category.to_lowercase()).as_bytes());
    crate::townhall_verification_complete::kaspa_address_from_xonly(&hex::encode(x), net).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct NodeRecord {
    pub txid: String,
    pub svc: String,
    pub api: String,
    pub payout: String,
    pub net: String,
    pub owner: String,
    pub bond_address: String,
    pub bond_amount: u64,
    pub bond_unspent: bool,
    pub daa_registered: u64,
}

fn http() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}

/// Same canonical form as kaspa_payload.ts canonJson: sorted keys, no whitespace.
fn canon(v: &serde_json::Value) -> String {
    match v {
        serde_json::Value::Object(m) => {
            let mut keys: Vec<&String> = m.keys().collect();
            keys.sort();
            let parts: Vec<String> = keys.iter()
                .map(|k| format!("{}:{}", serde_json::to_string(k).unwrap_or_default(), canon(&m[*k])))
                .collect();
            format!("{{{}}}", parts.join(","))
        }
        serde_json::Value::Array(a) => format!("[{}]", a.iter().map(canon).collect::<Vec<_>>().join(",")),
        other => serde_json::to_string(other).unwrap_or_default(),
    }
}

/// Verify a signed KvRecord; returns the owner's x-only hex on success.
pub fn verify_record(rec: &serde_json::Value) -> Option<String> {
    let sig_hex = rec.get("sig")?.as_str()?;
    let o = rec.get("o")?.as_str()?;
    let xb = hex::decode(if o.len() == 66 { &o[2..] } else { o }).ok()?;
    let xonly = secp256k1::XOnlyPublicKey::from_slice(&xb).ok()?;
    let mut body = rec.clone();
    body.as_object_mut()?.remove("sig");
    let digest: [u8; 32] = Sha256::digest(canon(&body).as_bytes()).into();
    let sig = secp256k1::schnorr::Signature::from_slice(&hex::decode(sig_hex).ok()?).ok()?;
    secp256k1::SECP256K1.verify_schnorr(&sig, &secp256k1::Message::from_digest(digest), &xonly).ok()?;
    Some(hex::encode(xb))
}

fn parse_kvp1(payload_hex: &str) -> Option<serde_json::Value> {
    let bytes = hex::decode(payload_hex).ok()?;
    if bytes.len() < 4 || &bytes[0..4] != b"KVP1" { return None; }
    serde_json::from_slice(&bytes[4..]).ok()
}

/// Unspent sompi at `addr` whose funding tx was paid entirely from `own`.
async fn owner_funded_sompi(client: &reqwest::Client, api: &str, own: &str, addr: &str) -> u64 {
    let url = format!("{}/addresses/{}/utxos", api, addr);
    let Ok(resp) = client.get(&url).send().await else { return 0 };
    let Ok(utxos) = resp.json::<serde_json::Value>().await else { return 0 };
    let mut funded: HashMap<String, bool> = HashMap::new();
    let mut sum = 0u64;
    for u in utxos.as_array().cloned().unwrap_or_default().iter().take(20) {
        let txid = u.pointer("/outpoint/transactionId").and_then(|t| t.as_str()).unwrap_or("").to_string();
        let amt = u.pointer("/utxoEntry/amount").and_then(|a| a.as_str().and_then(|s| s.parse().ok()).or(a.as_u64())).unwrap_or(0);
        if txid.len() != 64 || amt == 0 { continue; }
        if !funded.contains_key(&txid) {
            let turl = format!("{}/transactions/{}?inputs=true&outputs=false&resolve_previous_outpoints=light", api, txid);
            let mine = match client.get(&turl).send().await {
                Ok(r) => r.json::<serde_json::Value>().await.ok()
                    .and_then(|t| t.get("inputs").and_then(|i| i.as_array()).cloned())
                    .map(|ins| !ins.is_empty() && ins.iter().all(|i| i.get("previous_outpoint_address").and_then(|a| a.as_str()) == Some(own)))
                    .unwrap_or(false),
                Err(_) => false,
            };
            funded.insert(txid.clone(), mine);
        }
        if funded[&txid] { sum += amt; }
        if sum >= NODE_BOND_SOMPI { break; }
    }
    sum
}

async fn fetch_registry_records(net: &str) -> Result<Vec<NodeRecord>, String> {
    let client = http();
    let api = api_base(net);
    let reg = registry_address("node", net);
    let url = format!("{}/addresses/{}/full-transactions?limit={}&resolve_previous_outpoints=no", api, reg, MAX_REGISTRY_TXS);
    let txs: serde_json::Value = client.get(&url).send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;
    let arr = txs.as_array().ok_or("unexpected registry response")?;

    let mut records = Vec::new();
    for tx in arr {
        let Some(rec) = parse_kvp1(tx.get("payload").and_then(|p| p.as_str()).unwrap_or("")) else { continue };
        if rec.get("k").and_then(|k| k.as_str()) != Some("registry") { continue; }
        let d = rec.get("d").cloned().unwrap_or(json!({}));
        if d.get("category").and_then(|c| c.as_str()) != Some("node") { continue; }
        let Some(owner) = verify_record(&rec) else { continue };
        let g = |k: &str| d.get(k).and_then(|s| s.as_str()).unwrap_or("").to_string();
        let txid = tx.get("transaction_id").and_then(|t| t.as_str()).unwrap_or("").to_string();
        if txid.is_empty() || g("storeAddress").is_empty() { continue; }
        if !matches!(g("svc").as_str(), "index" | "archive") || !g("api").starts_with("https://") { continue; }
        records.push(NodeRecord {
            txid, svc: g("svc"), api: g("api"), payout: g("payout"), net: net.to_string(),
            owner, bond_address: g("storeAddress"), bond_amount: 0, bond_unspent: false,
            daa_registered: tx.get("accepting_block_blue_score").and_then(|d| d.as_u64()).unwrap_or(0),
        });
    }

    // Latest announce per owner key wins (re-registration supersedes).
    records.sort_by(|a, b| b.daa_registered.cmp(&a.daa_registered));
    let mut seen = std::collections::HashSet::new();
    records.retain(|r| seen.insert(r.owner.clone()));

    for r in records.iter_mut() {
        let own = crate::townhall_verification_complete::kaspa_address_from_xonly(&r.owner, net).unwrap_or_default();
        if own.is_empty() { continue; }
        r.bond_amount = owner_funded_sompi(&client, api, &own, &r.bond_address).await;
        r.bond_unspent = r.bond_amount >= NODE_BOND_SOMPI;
    }
    Ok(records)
}

#[derive(serde::Deserialize)]
pub struct NetQuery { network: Option<String> }

pub async fn get_registry(q: web::Query<NetQuery>) -> impl Responder {
    let net = norm_net(q.network.as_deref());
    match fetch_registry_records(net).await {
        Ok(records) => HttpResponse::Ok().json(json!({
            "registry": registry_address("node", net),
            "network": net,
            "count": records.len(),
            "nodes": records,
        })),
        Err(e) => HttpResponse::BadGateway().json(json!({ "error": e, "network": net })),
    }
}

// ---------------------------------------------------------------------------
// Proof-of-storage audit
// ---------------------------------------------------------------------------
/// Runs one full audit sweep and returns the JSON body. Used by both the
/// HTTP handler and the background task.
pub async fn audit_once(net: &str) -> serde_json::Value {
    let api = api_base(net);
    let records = match fetch_registry_records(net).await {
        Ok(r) => r,
        Err(e) => return json!({ "error": e }),
    };
    let client = http();

    // Challenge set: surviving registry coins (store/academic, dapp, game, node)
    // older than the ~30h window. The answer is self-verifying: the operator's
    // transaction must hash to the challenged txid — no outside "truth" needed.
    let Some(now_daa) = virtual_daa(api).await else { return json!({ "network": net, "nodes": [], "note": "could not read virtual DAA" }) };
    let mut challenges: Vec<Challenge> = Vec::new();
    for kind in ["store", "dapp", "game", "node"] {
        challenges.extend(fetch_aged_challenges(net, kind, now_daa).await);
    }
    if challenges.is_empty() {
        return json!({ "network": net, "nodes": [], "note": "no records older than ~30h yet - nothing only an archive could answer" });
    }
    let seed = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0) as usize;

    let mut results = Vec::new();
    for (i, r) in records.iter().enumerate() {
        if !r.bond_unspent {
            results.push(json!({ "payout": r.payout, "audited": false, "pass": false, "reason": "bond below 10 KAS" }));
            continue;
        }
        let c = &challenges[(seed.wrapping_mul(2654435761) + i) % challenges.len()];
        let (pass, reason) = operator_answers(&client, &r.api, c).await;
        results.push(json!({
            "payout": r.payout, "svc": r.svc, "api": r.api,
            "challenge_txid": c.txid, "challenge_index": c.index, "challenge_amount": c.amount,
            "audited": true, "pass": pass, "reason": reason,
            "bond_unspent": r.bond_unspent, "bond_amount": r.bond_amount,
        }));
    }

    json!({ "audited_at": seed, "network": net, "nodes": results })
}

/// One surviving coin at a registry address. Its txid is the challenge; the coin
/// itself (index, amount, script) must reappear in the operator's transaction.
#[derive(Clone)]
pub struct Challenge { pub txid: String, pub index: u32, pub amount: u64, pub spk: String }

// ~30h of DAA at 10 BPS, same window the app uses (1.1M).
const PRUNE_DAA: u64 = 1_100_000;

fn num(v: Option<&serde_json::Value>) -> Option<u64> {
    v.and_then(|x| x.as_u64().or_else(|| x.as_str().and_then(|s| s.parse().ok())))
}

async fn virtual_daa(api: &str) -> Option<u64> {
    let v: serde_json::Value = http().get(format!("{}/info/blockdag", api)).send().await.ok()?.json().await.ok()?;
    num(v.get("virtualDaaScore"))
}

/// Pruning drops tx history and payloads from the public API, but the UTXO set
/// survives, and registry dust is unspendable — so registry UTXOs older than
/// the window name exactly the records only an archive still holds.
async fn fetch_aged_challenges(net: &str, kind: &str, now_daa: u64) -> Vec<Challenge> {
    let url = format!("{}/addresses/{}/utxos", api_base(net), registry_address(kind, net));
    let Ok(r) = http().get(&url).send().await else { return vec![] };
    let Ok(v) = r.json::<serde_json::Value>().await else { return vec![] };
    v.as_array().cloned().unwrap_or_default().iter().filter_map(|u| {
        let daa = num(u.pointer("/utxoEntry/blockDaaScore"))?;
        if now_daa < daa + PRUNE_DAA { return None; }
        Some(Challenge {
            txid: u.pointer("/outpoint/transactionId")?.as_str()?.to_string(),
            index: num(u.pointer("/outpoint/index")).unwrap_or(0) as u32,
            amount: num(u.pointer("/utxoEntry/amount"))?,
            spk: u.pointer("/utxoEntry/scriptPublicKey/scriptPublicKey").and_then(|x| x.as_str()).unwrap_or("").to_string(),
        })
    }).collect()
}

/// Rebuild the consensus transaction from a kaspa-rest-server tx JSON and return
/// its txid. v0, lock_time 0, gas 0, sequence 0 (what KasVillage txs use).
pub fn rest_tx_id(j: &serde_json::Value) -> Option<String> {
    use kaspa_consensus_core::tx::{Transaction, TransactionInput, TransactionOutpoint, TransactionOutput, ScriptPublicKey};
    let h32 = |s: &str| -> Option<kaspa_rpc_core::RpcHash> {
        let b: [u8; 32] = hex::decode(s).ok()?.try_into().ok()?; Some(kaspa_rpc_core::RpcHash::from_bytes(b))
    };
    let mut ins = j.get("inputs")?.as_array()?.clone();
    ins.sort_by_key(|i| num(i.get("index")).unwrap_or(0));
    let mut inputs = Vec::new();
    for i in &ins {
        let prev = h32(i.get("previous_outpoint_hash")?.as_str()?)?;
        let idx = num(i.get("previous_outpoint_index"))? as u32;
        inputs.push(TransactionInput::new(TransactionOutpoint::new(prev, idx), vec![], 0, 1));
    }
    let mut outs = j.get("outputs")?.as_array()?.clone();
    outs.sort_by_key(|o| num(o.get("index")).unwrap_or(0));
    let mut outputs = Vec::new();
    for o in &outs {
        let script = hex::decode(o.get("script_public_key")?.as_str()?).ok()?;
        outputs.push(TransactionOutput::new(num(o.get("amount"))?, ScriptPublicKey::from_vec(0, script)));
    }
    let subnet: [u8; 20] = hex::decode(j.get("subnetwork_id").and_then(|s| s.as_str()).unwrap_or("0000000000000000000000000000000000000000")).ok()?.try_into().ok()?;
    let payload = hex::decode(j.get("payload").and_then(|p| p.as_str()).unwrap_or("")).ok()?;
    let tx = Transaction::new(0, inputs, outputs, 0, kaspa_consensus_core::subnets::SubnetworkId::from_bytes(subnet), 0, payload);
    Some(tx.id().to_string())
}

/// Ask an operator for the challenge tx; pass only if its txid recomputes, the
/// surviving coin is in it, and it carries a non-empty payload.
async fn operator_answers(client: &reqwest::Client, api: &str, c: &Challenge) -> (bool, &'static str) {
    let url = format!("{}/transactions/{}?inputs=true&outputs=true&resolve_previous_outpoints=no", api.trim_end_matches('/'), c.txid);
    let j: serde_json::Value = match client.get(&url).send().await {
        Ok(r) => match r.json().await { Ok(j) => j, Err(_) => return (false, "bad json") },
        Err(_) => return (false, "unreachable"),
    };
    if j.get("payload").and_then(|p| p.as_str()).map(|p| p.is_empty()).unwrap_or(true) { return (false, "no payload"); }
    if rest_tx_id(&j).as_deref() != Some(c.txid.as_str()) { return (false, "txid mismatch"); }
    let coin_ok = j.get("outputs").and_then(|o| o.as_array()).map(|outs| outs.iter().any(|o|
        num(o.get("index")) == Some(c.index as u64) && num(o.get("amount")) == Some(c.amount)
        && (c.spk.is_empty() || o.get("script_public_key").and_then(|x| x.as_str()) == Some(c.spk.as_str())))).unwrap_or(false);
    if !coin_ok { return (false, "coin mismatch"); }
    (true, "ok")
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Background sweep, both networks: the panel shows recent results without
/// every viewer triggering a live sweep.
pub fn spawn_audit_loop() {
    tokio::spawn(async {
        loop {
            for net in NETS {
                let body = audit_once(net).await;
                if let Ok(mut w) = AUDIT_CACHE.write() { w.insert(net.to_string(), (now_secs(), body)); }
            }
            tokio::time::sleep(std::time::Duration::from_secs(AUDIT_INTERVAL_SECS)).await;
        }
    });
}

#[derive(serde::Deserialize)]
pub struct AuditQuery {
    fresh: Option<String>,
    network: Option<String>,
}

pub async fn run_audit(q: web::Query<AuditQuery>) -> impl Responder {
    let net = norm_net(q.network.as_deref());
    let want_fresh = q.fresh.as_deref().map(|v| v == "1" || v == "true").unwrap_or(false);
    if !want_fresh {
        if let Ok(r) = AUDIT_CACHE.read() {
            if let Some((at, body)) = r.get(net) {
                let mut out = body.clone();
                if let Some(o) = out.as_object_mut() {
                    o.insert("cached".into(), json!(true));
                    o.insert("age_secs".into(), json!(now_secs().saturating_sub(*at)));
                }
                return HttpResponse::Ok().json(out);
            }
        }
    }
    let mut body = audit_once(net).await;
    if let Some(o) = body.as_object_mut() { o.insert("cached".into(), json!(false)); }
    if let Ok(mut w) = AUDIT_CACHE.write() { w.insert(net.to_string(), (now_secs(), body.clone())); }
    HttpResponse::Ok().json(body)
}

// ---------------------------------------------------------------------------
// Public game index (Apple 4.7: index of mini-apps + metadata incl. age rating)
// Rebuilt from the game registry address on every call; nothing stored.
// ---------------------------------------------------------------------------
pub async fn get_game_index(q: web::Query<NetQuery>) -> impl Responder {
    let net = norm_net(q.network.as_deref());
    let (games, reg) = match index_kind(net, "game").await { Ok(v) => v, Err(e) => return HttpResponse::BadGateway().json(json!({ "error": e })) };
    let (dapps, dreg) = index_kind(net, "dapp").await.unwrap_or((Vec::new(), String::new()));
    HttpResponse::Ok().json(json!({
        "index": "KasVillage community mini-apps (HTML5 games + DApps, sandboxed, verified by hash)",
        "network": net,
        "registries": { "game": reg, "dapp": dreg },
        "count": games.len() + dapps.len(),
        "games": games,
        "dapps": dapps,
        "age_ratings": "4+ / 9+ / 13+ / 17+; unrated listings are treated as 17+ and gated in the app",
        "report": "Flag in app: Mailbox > listing > Flag",
    }))
}

async fn index_kind(net: &str, kind: &str) -> Result<(Vec<serde_json::Value>, String), String> {
    let reg = registry_address(kind, net);
    let url = format!("{}/addresses/{}/full-transactions?limit={}&resolve_previous_outpoints=no", api_base(net), reg, MAX_REGISTRY_TXS);
    let txs: serde_json::Value = match http().get(&url).send().await {
        Ok(r) => r.json().await.unwrap_or(json!([])),
        Err(e) => return Err(e.to_string()),
    };
    let mut delisted: std::collections::HashSet<(String, String)> = Default::default();
    let mut games: Vec<serde_json::Value> = Vec::new();
    let mut seen = std::collections::HashSet::new();
    let mut arr = txs.as_array().cloned().unwrap_or_default();
    arr.sort_by(|a, b| {
        let f = |t: &serde_json::Value| t.get("accepting_block_blue_score").and_then(|d| d.as_u64()).unwrap_or(0);
        f(b).cmp(&f(a))
    });
    for tx in &arr {
        let Some(rec) = parse_kvp1(tx.get("payload").and_then(|p| p.as_str()).unwrap_or("")) else { continue };
        let Some(owner) = verify_record(&rec) else { continue };
        let d = rec.get("d").cloned().unwrap_or(json!({}));
        match rec.get("k").and_then(|k| k.as_str()) {
            Some("delist") => { if let Some(h) = d.get("head").and_then(|h| h.as_str()) { delisted.insert((owner, h.to_string())); } }
            Some("registry") => {
                let quad: serde_json::Value = d.get("primaryLink").and_then(|p| p.as_str())
                    .and_then(|p| serde_json::from_str(p).ok()).unwrap_or(json!({}));
                // games key on the bundle head; dapps on their store address
                let head = quad.get("head").and_then(|h| h.as_str())
                    .or_else(|| if kind == "dapp" { d.get("storeAddress").and_then(|h| h.as_str()) } else { None })
                    .unwrap_or("").to_string();
                if head.is_empty() || !seen.insert(head.clone()) { continue; }
                let age = quad.get("age").or_else(|| d.get("age")).and_then(|a| a.as_str()).filter(|a| matches!(*a, "4+" | "9+" | "13+" | "17+")).unwrap_or("unrated (17+)");
                games.push(json!({
                    "name": d.get("name").cloned().unwrap_or(json!("")),
                    "head": head,
                    "age_rating": age,
                    "tags": quad.get("tags").cloned().unwrap_or(json!([])),
                    "price_kas_per_board": quad.get("price").cloned().unwrap_or(json!(null)),
                    "publisher": owner,
                    "announce_txid": tx.get("transaction_id").cloned().unwrap_or(json!("")),
                }));
            }
            _ => {}
        }
    }
    games.retain(|g| !delisted.contains(&(g["publisher"].as_str().unwrap_or("").to_string(), g["head"].as_str().unwrap_or("").to_string())));
    Ok((games, reg))
}

pub fn configure_node_registry_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/api/nodes/registry", web::get().to(get_registry))
        .route("/api/nodes/audit", web::get().to(run_audit))
        .route("/api/games/index", web::get().to(get_game_index));
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn node_registry_address_matches_app() {
        assert_eq!(registry_address("node", "testnet-10"),
            "kaspatest:qp35q2e5maacw03gyuh5pdr389y92nxp4dttxlr728pf0xcxytxd7nspt3z2k");
        assert_eq!(registry_address("store", "testnet-10"),
            "kaspatest:qzuwzvff0hn629auv0hk067wfxnwx5t2zw6dayz84ktknklm7s3sjm67xzh87");
        assert!(registry_address("node", "mainnet").starts_with("kaspa:"));
    }
    #[test]
    fn canon_sorts_keys() {
        let v = json!({"b":1,"a":{"d":"x","c":[1,2]}});
        assert_eq!(canon(&v), r#"{"a":{"c":[1,2],"d":"x"},"b":1}"#);
    }
    #[test]
    fn verifies_app_signed_announce() {
        // signRecord() output from @noble/curves (kaspa_payload.ts canonJson).
        let mut rec: serde_json::Value = serde_json::from_str(r#"{"k":"registry","v":1,"o":"034f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa","t":1761900000000,"d":{"storeAddress":"kaspa:qtest","name":"operator","category":"node","svc":"archive","api":"https://n.example","payout":"kaspa:qpay","net":"mainnet"},"sig":"7f54c4fa2bfd90b834ba2aa0609a1c92ec566ecfc004414d37afe7c55179a342176590175bff01138cd75269e08f78d3e113a186b77a3a2359b147168537791c"}"#).unwrap();
        assert_eq!(verify_record(&rec).as_deref(), Some("4f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa"));
        rec["d"]["payout"] = json!("kaspa:qthief");
        assert!(verify_record(&rec).is_none());
    }
    #[test]
    fn rest_tx_id_matches_consensus() {
        use kaspa_consensus_core::tx::*;
        let j = json!({
            "subnetwork_id": "0000000000000000000000000000000000000000",
            "payload": "4b565031",
            "inputs": [{ "index": 0, "previous_outpoint_hash": "11".repeat(32), "previous_outpoint_index": "1", "signature_script": "41ab" }],
            "outputs": [
                { "index": 1, "amount": "5000", "script_public_key": "20" .to_string() + &"22".repeat(32) + "ac" },
                { "index": 0, "amount": 100000000u64, "script_public_key": "20".to_string() + &"33".repeat(32) + "ac" }
            ]
        });
        let h = |b: u8| kaspa_rpc_core::RpcHash::from_bytes([b; 32]);
        let spk = |b: u8| { let mut v = vec![0x20]; v.extend([b; 32]); v.push(0xac); ScriptPublicKey::from_vec(0, v) };
        let tx = Transaction::new(0,
            vec![TransactionInput::new(TransactionOutpoint::new(h(0x11), 1), vec![0x41, 0xab], 0, 1)],
            vec![TransactionOutput::new(100000000, spk(0x33)), TransactionOutput::new(5000, spk(0x22))],
            0, kaspa_consensus_core::subnets::SUBNETWORK_ID_NATIVE, 0, b"KVP1".to_vec());
        let want = tx.id().to_string();
        assert_eq!(rest_tx_id(&j).as_deref(), Some(want.as_str()));
        println!("TXID_VECTOR {}", want);
    }
}
