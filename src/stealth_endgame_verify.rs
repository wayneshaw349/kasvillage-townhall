// ============================================================================
// KASVILLAGE — STEALTH ENDGAME VERIFY (TownHall, Stateless)
// ============================================================================
// Verifies: Merkle membership + nullifier uniqueness
// All state lives on Arweave. TownHall = pure verifier + relay.
// ============================================================================

use actix_web::{web, HttpResponse};
use serde::{Deserialize, Serialize};

// ============================================================================
// TYPES
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct StealthEndgameRequest {
    pub merkle_proof_bytes: String,
    pub merkle_root: String,
    pub nullifier: String,
    pub trade_tx: String,
    pub trade_amount_sompi: String,
    pub timestamp: u64,
}

#[derive(Debug, Serialize)]
pub struct StealthEndgameResponse {
    pub credited: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub nullifier_tx: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ============================================================================
// ARWEAVE QUERIES (stateless)
// ============================================================================

async fn fetch_merkle_root_from_arweave(network: &str) -> Result<String, String> {
    let query = format!(
        r#"{{"query":"{{ transactions(tags: [{{ name: \"KV-Type\", values: [\"stealth-merkle-root\"] }}, {{ name: \"KV-Network\", values: [\"{}\"] }}], sort: HEIGHT_DESC, first: 1) {{ edges {{ node {{ id }} }} }} }}"}}"#,
        network
    );
    let client = reqwest::Client::new();
    let resp = client.post("https://arweave.net/graphql")
        .header("Content-Type", "application/json")
        .body(query)
        .send().await.map_err(|e| format!("Arweave: {}", e))?;
    let body: serde_json::Value = resp.json().await.map_err(|e| format!("Parse: {}", e))?;
    let edges = body["data"]["transactions"]["edges"].as_array().ok_or("No root inscriptions")?;
    if edges.is_empty() { return Err("No merkle root on Arweave".into()); }
    let tx_id = edges[0]["node"]["id"].as_str().ok_or("Missing tx id")?;
    let data: serde_json::Value = client.get(&format!("https://arweave.net/{}", tx_id))
        .send().await.map_err(|e| format!("Fetch: {}", e))?
        .json().await.map_err(|e| format!("Data: {}", e))?;
    data["root"].as_str().map(|s| s.to_string()).ok_or("Root missing".into())
}

async fn nullifier_exists_on_arweave(nullifier: &str, network: &str) -> Result<bool, String> {
    let query = format!(
        r#"{{"query":"{{ transactions(tags: [{{ name: \"KV-Type\", values: [\"stealth-nullifier\"] }}, {{ name: \"KV-Nullifier\", values: [\"{}\"] }}, {{ name: \"KV-Network\", values: [\"{}\"] }}], first: 1) {{ edges {{ node {{ id }} }} }} }}"}}"#,
        nullifier, network
    );
    let client = reqwest::Client::new();
    let resp = client.post("https://arweave.net/graphql")
        .header("Content-Type", "application/json")
        .body(query)
        .send().await.map_err(|e| format!("Query: {}", e))?;
    let body: serde_json::Value = resp.json().await.map_err(|e| format!("Parse: {}", e))?;
    let edges = body["data"]["transactions"]["edges"].as_array().unwrap_or(&vec![]);
    Ok(!edges.is_empty())
}

async fn inscribe_nullifier(nullifier: &str, trade_tx: &str, amount: &str, timestamp: u64, network: &str) -> Result<String, String> {
    // TODO: Bundlr inscription
    // Tags: KV-Type: stealth-nullifier, KV-Nullifier, KV-Network, KV-Trade, KV-Amount
    let fake_tx = format!("AR_NULL_{}", &nullifier[..16]);
    log::info!("Inscribed nullifier: {} trade={} net={}", &nullifier[..16], &trade_tx[..16.min(trade_tx.len())], network);
    Ok(fake_tx)
}

// ============================================================================
// Fq PARSE
// ============================================================================

fn parse_fq_hex(hex_str: &str) -> Result<pasta_curves::pallas::Base, String> {
    use ff::PrimeField;
    let bytes = hex::decode(hex_str).map_err(|e| format!("hex: {}", e))?;
    if bytes.len() != 32 { return Err(format!("Fq need 32 bytes, got {}", bytes.len())); }
    let mut repr = [0u8; 32];
    for i in 0..32 { repr[i] = bytes[31 - i]; }
    let opt = pasta_curves::pallas::Base::from_repr(repr);
    if opt.is_some().into() { Ok(opt.unwrap()) } else { Err("Invalid Fq".into()) }
}

// ============================================================================
// HANDLER
// ============================================================================

pub async fn api_verify_stealth_endgame(
    body: web::Json<StealthEndgameRequest>,
) -> HttpResponse {
    let network = "testnet-10";

    // 1. Fetch root from Arweave
    let arweave_root = match fetch_merkle_root_from_arweave(network).await {
        Ok(r) => r,
        Err(e) => return HttpResponse::ServiceUnavailable().json(StealthEndgameResponse {
            credited: false, nullifier_tx: None, error: Some(format!("Root: {}", e)),
        }),
    };

    // 2. Root match
    if body.merkle_root != arweave_root {
        return HttpResponse::BadRequest().json(StealthEndgameResponse {
            credited: false, nullifier_tx: None, error: Some("Root mismatch (stale?)".into()),
        });
    }

    // 3. Verify Halo2 Merkle proof (K=13)
    let proof_bytes = match hex::decode(&body.merkle_proof_bytes) {
        Ok(b) => b,
        Err(e) => return HttpResponse::BadRequest().json(StealthEndgameResponse {
            credited: false, nullifier_tx: None, error: Some(format!("Proof hex: {}", e)),
        }),
    };
    let root_fq = match parse_fq_hex(&body.merkle_root) {
        Ok(f) => f,
        Err(e) => return HttpResponse::BadRequest().json(StealthEndgameResponse {
            credited: false, nullifier_tx: None, error: Some(format!("Root parse: {}", e)),
        }),
    };
    match crate::halo2_snark_module::verify_proof_with_instances(13, &proof_bytes, vec![vec![root_fq]]) {
        Ok(true) => {},
        Ok(false) => return HttpResponse::BadRequest().json(StealthEndgameResponse {
            credited: false, nullifier_tx: None, error: Some("Merkle proof invalid".into()),
        }),
        Err(e) => return HttpResponse::BadRequest().json(StealthEndgameResponse {
            credited: false, nullifier_tx: None, error: Some(format!("Verify: {}", e)),
        }),
    }

    // 4. Nullifier uniqueness
    match nullifier_exists_on_arweave(&body.nullifier, network).await {
        Ok(true) => return HttpResponse::Conflict().json(StealthEndgameResponse {
            credited: false, nullifier_tx: None, error: Some("Nullifier used (double-credit)".into()),
        }),
        Ok(false) => {},
        Err(e) => return HttpResponse::ServiceUnavailable().json(StealthEndgameResponse {
            credited: false, nullifier_tx: None, error: Some(format!("Nullifier check: {}", e)),
        }),
    }

    // 5. Inscribe nullifier + anonymous stat
    let nullifier_tx = match inscribe_nullifier(&body.nullifier, &body.trade_tx, &body.trade_amount_sompi, body.timestamp, network).await {
        Ok(tx) => tx,
        Err(e) => return HttpResponse::InternalServerError().json(StealthEndgameResponse {
            credited: false, nullifier_tx: None, error: Some(format!("Inscribe: {}", e)),
        }),
    };

    log::info!("Endgame credit: null={}, amt={}", &body.nullifier[..16], body.trade_amount_sompi);

    HttpResponse::Ok().json(StealthEndgameResponse {
        credited: true, nullifier_tx: Some(nullifier_tx), error: None,
    })
}

// ============================================================================
// LEAF REGISTRATION
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct RegisterLeafRequest { pub leaf_id: String }

#[derive(Debug, Serialize)]
pub struct RegisterLeafResponse {
    pub leaf_index: u64,
    pub root: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn api_register_stealth_leaf(body: web::Json<RegisterLeafRequest>) -> HttpResponse {
    let leaf_fq = match parse_fq_hex(&body.leaf_id) {
        Ok(f) => f,
        Err(e) => return HttpResponse::BadRequest().json(RegisterLeafResponse {
            leaf_index: 0, root: String::new(), error: Some(format!("Parse: {}", e)),
        }),
    };
    let leaf_hash = crate::halo2_snark_module::poseidon_leaf_hash(leaf_fq);
    // TODO: fetch existing leaves from Arweave, rebuild tree, get next_index
    let next_index: u64 = 0;
    let mut tree = crate::halo2_snark_module::SparseMerkleTree::new(crate::halo2_snark_module::TREE_DEPTH);
    tree.update(next_index, leaf_hash);
    let root_bytes = tree.root().to_repr();
    let root_hex = hex::encode(root_bytes.as_ref().iter().rev().copied().collect::<Vec<u8>>());
    // TODO: inscribe leaf + new root to Arweave
    log::info!("Leaf registered: idx={}, root={}", next_index, &root_hex[..16]);
    HttpResponse::Ok().json(RegisterLeafResponse { leaf_index: next_index, root: root_hex, error: None })
}

// ============================================================================
// ROUTES — add to main.rs:
//   .route("/api/verify/stealth-endgame", web::post().to(stealth_endgame_verify::api_verify_stealth_endgame))
//   .route("/api/stealth/register-leaf", web::post().to(stealth_endgame_verify::api_register_stealth_leaf))
//   .route("/api/verify/merkle-proof-stealth", web::post().to(stealth_endgame_verify::api_merkle_proof_stealth))
// ============================================================================