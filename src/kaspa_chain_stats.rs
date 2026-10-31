// kaspa_chain_stats.rs — counterparty stats straight from the Kaspa chain, no Arweave.
//
// Rust port of the app's counterparty_scan.ts v2 (same rules, same thresholds), so the
// relay and the phone derive the SAME numbers from the SAME consensus data:
//   - candidate escrows = outputs of txs the target address spent from
//   - an escrow is funded by EXACTLY 2 parties (one of them the target)
//   - busy addresses (> MAX_ESCROW_TXS txs) are wallets, not escrows
//   - a spend paying only itself is a kill; the latest outward spend settles it
//   - settled / deadlocked (killed, no settle) / open
//
// The scan is the witness source for the stats SNARK: outcomes, not reasons.

use serde::Serialize;
use sha2::{Digest, Sha256};

const MAX_ESCROW_TXS: usize = 12;

#[derive(Debug, Clone, Default, Serialize)]
pub struct ChainScan {
    pub address: String,
    pub total: u64,
    pub settled: u64,
    pub deadlocked: u64,
    pub open: u64,
    pub stuck_sompi: u64,
    pub settled_volume_sompi: u64,
    pub largest_escrow_sompi: u64,
    pub payouts_received: u64,
    pub distinct_counterparties: u64,
    pub repeat_deadlock_same_counterparty: u64,
    pub candidates_examined: u64,
    pub truncated: bool,
    pub event_hashes: Vec<String>,
    /// settle block_time (ms) of the most recent settled escrow, 0 if none
    pub last_settle_ms: u64,
}

pub fn kaspa_api(network: &str) -> &'static str {
    if network.starts_with("testnet") { "https://api-tn10.kaspa.org" } else { "https://api.kaspa.org" }
}

// ---------------------------------------------------------------------------
// kaspa address from x-only pubkey (cashaddr-style bech32, version 0) — the
// same derivation the app's KeyCheck uses, ported byte for byte.
// ---------------------------------------------------------------------------
const CHARSET: &[u8] = b"qpzry9x8gf2tvdw0s3jn54khce6mua7l";

fn polymod(values: &[u8]) -> u64 {
    let mut c: u64 = 1;
    for &d in values {
        let c0 = c >> 35;
        c = ((c & 0x07ffffffff) << 5) ^ (d as u64);
        if c0 & 0x01 != 0 { c ^= 0x98f2bc8e61; }
        if c0 & 0x02 != 0 { c ^= 0x79b76d99e2; }
        if c0 & 0x04 != 0 { c ^= 0xf33e5fb3c4; }
        if c0 & 0x08 != 0 { c ^= 0xae2eabe2a8; }
        if c0 & 0x10 != 0 { c ^= 0x1e4f43e470; }
    }
    c ^ 1
}

fn to5bit(payload: &[u8]) -> Vec<u8> {
    let (mut out, mut b, mut q) = (Vec::new(), 0u32, 0u32);
    for &c in payload {
        b = (b << 8) | c as u32;
        q += 8;
        while q >= 5 { q -= 5; out.push(((b >> q) & 31) as u8); b &= (1 << q) - 1; }
    }
    if q > 0 { out.push(((b << (5 - q)) & 31) as u8); }
    out
}

pub fn address_from_xonly(xonly_hex: &str, network: &str) -> Result<String, String> {
    let xo = hex::decode(xonly_hex).map_err(|e| format!("bad pubkey hex: {}", e))?;
    if xo.len() != 32 { return Err(format!("x-only pubkey must be 32 bytes, got {}", xo.len())); }
    let hrp = if network.starts_with("testnet") { "kaspatest" } else { "kaspa" };
    let mut payload = vec![0u8]; // version 0 = schnorr p2pk
    payload.extend_from_slice(&xo);
    let fv = to5bit(&payload);
    let mut values: Vec<u8> = hrp.bytes().map(|c| c & 0x1f).collect();
    values.push(0);
    values.extend_from_slice(&fv);
    values.extend_from_slice(&[0u8; 8]);
    let cs = polymod(&values);
    let mut cb = Vec::with_capacity(5);
    for i in (0..5).rev() { cb.push(((cs >> (i * 8)) & 0xff) as u8); }
    let mut addr = String::from(hrp);
    addr.push(':');
    for d in fv.iter().chain(to5bit(&cb).iter()) { addr.push(CHARSET[*d as usize] as char); }
    Ok(addr)
}

/// Accepts a compressed (66 hex) or x-only (64 hex) pubkey, or a kaspa address.
pub fn resolve_address(pubkey_or_addr: &str, network: &str) -> Result<String, String> {
    let p = pubkey_or_addr.trim().to_lowercase();
    if p.starts_with("kaspa:") || p.starts_with("kaspatest:") { return Ok(p); }
    let xonly = if p.len() == 66 { &p[2..] } else { p.as_str() };
    address_from_xonly(xonly, network)
}

// ---------------------------------------------------------------------------
// REST helpers
// ---------------------------------------------------------------------------
async fn fetch_txs(base: &str, addr: &str, limit: usize) -> Vec<serde_json::Value> {
    let url = format!("{}/addresses/{}/full-transactions?limit={}&resolve_previous_outpoints=light",
        base, urlencoding::encode(addr), limit);
    let client = reqwest::Client::new();
    match client.get(&url).timeout(std::time::Duration::from_secs(12)).send().await {
        Ok(r) if r.status().is_success() => r.json::<serde_json::Value>().await.ok()
            .and_then(|v| v.as_array().cloned()).unwrap_or_default(),
        _ => Vec::new(),
    }
}

fn spends_from(tx: &serde_json::Value, a: &str) -> bool {
    tx.get("inputs").and_then(|i| i.as_array()).map(|ins| ins.iter().any(|i|
        i.get("previous_outpoint_address").and_then(|v| v.as_str()) == Some(a))).unwrap_or(false)
}

fn pays_to(tx: &serde_json::Value, a: &str) -> u64 {
    tx.get("outputs").and_then(|o| o.as_array()).map(|outs| outs.iter()
        .filter(|o| o.get("script_public_key_address").and_then(|v| v.as_str()) == Some(a))
        .map(|o| o.get("amount").and_then(|v| v.as_u64()).unwrap_or(0)).sum()).unwrap_or(0)
}

fn out_addrs(tx: &serde_json::Value) -> Vec<String> {
    tx.get("outputs").and_then(|o| o.as_array()).map(|outs| outs.iter()
        .filter_map(|o| o.get("script_public_key_address").and_then(|v| v.as_str()).map(String::from))
        .collect()).unwrap_or_default()
}

// ---------------------------------------------------------------------------
// THE SCAN
// ---------------------------------------------------------------------------
pub async fn scan_escrows(pubkey_or_addr: &str, network: &str, max_candidates: usize) -> Result<ChainScan, String> {
    let base = kaspa_api(network);
    let address = resolve_address(pubkey_or_addr, network)?;
    let mut scan = ChainScan { address: address.clone(), ..Default::default() };

    let history = fetch_txs(base, &address, 100).await;
    if history.is_empty() { return Ok(scan); }

    let mut candidates: Vec<String> = Vec::new();
    for tx in &history {
        if !spends_from(tx, &address) { continue; }
        for o in out_addrs(tx) {
            if o != address && !candidates.contains(&o) { candidates.push(o); }
        }
    }
    scan.truncated = candidates.len() > max_candidates;
    candidates.truncate(max_candidates);
    scan.candidates_examined = candidates.len() as u64;

    let mut counterparties: Vec<String> = Vec::new();
    let mut deadlock_cps: Vec<String> = Vec::new();

    for cand in &candidates {
        let txs = fetch_txs(base, cand, 50).await;
        if txs.is_empty() || txs.len() > MAX_ESCROW_TXS { continue; }

        let mut funders: Vec<String> = Vec::new();
        let mut funded_total: u64 = 0;
        for tx in &txs {
            let amt = pays_to(tx, cand);
            if amt == 0 { continue; }
            funded_total += amt;
            if let Some(ins) = tx.get("inputs").and_then(|i| i.as_array()) {
                for i in ins {
                    if let Some(f) = i.get("previous_outpoint_address").and_then(|v| v.as_str()) {
                        if f != cand && !funders.contains(&f.to_string()) { funders.push(f.to_string()); }
                    }
                }
            }
        }
        if funders.len() != 2 || !funders.contains(&address) { continue; }

        let mut kill_count = 0u64;
        let mut settle: Option<&serde_json::Value> = None;
        for sp in txs.iter().filter(|t| spends_from(t, cand)) {
            let outs = out_addrs(sp);
            if !outs.iter().any(|o| o != cand) { kill_count += 1; continue; }
            let bt = sp.get("block_time").and_then(|v| v.as_u64()).unwrap_or(0);
            if settle.map(|s| s.get("block_time").and_then(|v| v.as_u64()).unwrap_or(0) < bt).unwrap_or(true) {
                settle = Some(sp);
            }
        }

        let cp = funders.iter().find(|f| **f != address).cloned().unwrap_or_default();
        if !cp.is_empty() && !counterparties.contains(&cp) { counterparties.push(cp.clone()); }

        scan.total += 1;
        if funded_total > scan.largest_escrow_sompi { scan.largest_escrow_sompi = funded_total; }
        // deterministic event hash: escrow addr + outcome + funded total
        let outcome = if settle.is_some() { "settled" } else if kill_count > 0 { "deadlocked" } else { "open" };
        let mut h = Sha256::new();
        h.update(cand.as_bytes()); h.update(outcome.as_bytes()); h.update(funded_total.to_le_bytes());
        scan.event_hashes.push(hex::encode(h.finalize()));

        match outcome {
            "settled" => {
                scan.settled += 1;
                scan.settled_volume_sompi += funded_total;
                if let Some(sp) = settle {
                    let paid = out_addrs(sp);
                    if paid.iter().any(|o| *o == address) { scan.payouts_received += 1; }
                    let bt = sp.get("block_time").and_then(|v| v.as_u64()).unwrap_or(0);
                    if bt > scan.last_settle_ms { scan.last_settle_ms = bt; }
                }
            }
            "deadlocked" => {
                scan.deadlocked += 1;
                scan.stuck_sompi += funded_total;
                if !cp.is_empty() {
                    if deadlock_cps.contains(&cp) { scan.repeat_deadlock_same_counterparty += 1; }
                    else { deadlock_cps.push(cp); }
                }
            }
            _ => scan.open += 1,
        }
    }
    scan.distinct_counterparties = counterparties.len() as u64;
    Ok(scan)
}
