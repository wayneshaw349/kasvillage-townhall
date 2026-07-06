// ============================================================================
// KASVILLAGE — NULLIFIER + PROOF INSCRIPTION (Bundlr/Turbo → Arweave)
// ============================================================================
// Replaces the inscribe_nullifier() stub in stealth_endgame_verify.rs.
// Inscribes nullifier with KV-Proof tag linking to the Merkle proof blob.
// Deps: reqwest, serde_json, base64. Uses Turbo (Bundlr) upload endpoint.
// ============================================================================

use serde_json::json;

const TURBO_UPLOAD: &str = "https://upload.ardrive.io/v1/tx";

// Inscribe the Merkle proof blob first, return its Arweave tx id.
pub async fn inscribe_proof_blob(
    proof_hex: &str,
    network: &str,
) -> Result<String, String> {
    let data = hex::decode(proof_hex).map_err(|e| format!("proof hex: {}", e))?;
    upload_to_turbo(
        data,
        vec![
            ("KV-Type", "stealth-merkle-proof"),
            ("KV-Network", network),
            ("Content-Type", "application/octet-stream"),
        ],
    ).await
}

// Inscribe the nullifier record, tagging the proof tx id via KV-Proof.
pub async fn inscribe_nullifier(
    nullifier: &str,
    trade_tx: &str,
    amount: &str,
    timestamp: u64,
    network: &str,
    proof_tx: &str,
) -> Result<String, String> {
    let body = json!({
        "nullifier": nullifier,
        "trade_tx": trade_tx,
        "amount": amount,
        "timestamp": timestamp,
        "proof_tx": proof_tx,
    }).to_string().into_bytes();

    let ts = timestamp.to_string();
    upload_to_turbo(
        body,
        vec![
            ("KV-Type", "stealth-nullifier"),
            ("KV-Nullifier", nullifier),
            ("KV-Network", network),
            ("KV-Trade", trade_tx),
            ("KV-Amount", amount),
            ("KV-Timestamp", &ts),
            ("KV-Proof", proof_tx),
            ("Content-Type", "application/json"),
        ],
    ).await
}

// ----------------------------------------------------------------------------
// Turbo upload. Signing key loaded from env (TownHall's Arweave JWK).
// For unsigned/free-tier small data, Turbo accepts ANS-104 dataitems.
// This posts a pre-signed dataitem built by sign_dataitem().
// ----------------------------------------------------------------------------

async fn upload_to_turbo(
    data: Vec<u8>,
    tags: Vec<(&str, &str)>,
) -> Result<String, String> {
    let dataitem = sign_dataitem(data, tags)?;
    let client = reqwest::Client::new();
    let resp = client
        .post(TURBO_UPLOAD)
        .header("Content-Type", "application/octet-stream")
        .body(dataitem)
        .send().await
        .map_err(|e| format!("turbo upload: {}", e))?;
    let j: serde_json::Value = resp.json().await
        .map_err(|e| format!("turbo resp: {}", e))?;
    j["id"].as_str().map(|s| s.to_string())
        .ok_or_else(|| format!("no id in turbo resp: {}", j))
}

// ANS-104 dataitem signing using the arweave JWK in env ARWEAVE_JWK.
// Uses the `arloader` or `arweave-rs` dataitem builder.
fn sign_dataitem(data: Vec<u8>, tags: Vec<(&str, &str)>) -> Result<Vec<u8>, String> {
    // TODO: build + RSA-PSS sign ANS-104 dataitem with ARWEAVE_JWK.
    // Wire arweave-rs DataItem::new(...).sign(&signer). Placeholder returns raw.
    let _ = (&data, &tags);
    Err("sign_dataitem: wire ARWEAVE_JWK signer".into())
}
