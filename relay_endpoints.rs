// ============================================================================
// BALANCE SHEET RELAY WITH QUANTUM-SAFE MERKLE TREE
// Add to townhall_merged.rs
//
// Flow:
// 1. Receive Schnorr sig + Lamport commitment (Poseidon hash)
// 2. Insert Lamport commitment into SparseMerkleTree
// 3. Store encrypted sheet + Lamport data on Arweave
// 4. Return Merkle index + current root
// 5. Periodically anchor Merkle root to Kaspa L1
// ============================================================================

use actix_web::{web, HttpRequest, HttpResponse, Result, http::header};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};

// Import from existing townhall code
// use crate::{SparseMerkleTree, SparseMerkleProof, poseidon_hash_cpu, Fq, TREE_DEPTH};

// ============================================================================
// RATE LIMITER
// ============================================================================

pub struct RateLimiter {
    requests: RwLock<HashMap<String, Vec<Instant>>>,
    max_requests: usize,
    window: Duration,
}

impl RateLimiter {
    pub fn new(max_requests: usize, window_secs: u64) -> Self {
        Self {
            requests: RwLock::new(HashMap::new()),
            max_requests,
            window: Duration::from_secs(window_secs),
        }
    }
    
    pub fn check(&self, ip: &str) -> bool {
        let now = Instant::now();
        let mut requests = self.requests.write().unwrap();
        let entry = requests.entry(ip.to_string()).or_default();
        entry.retain(|t| now.duration_since(*t) < self.window);
        if entry.len() >= self.max_requests { return false; }
        entry.push(now);
        true
    }
}

// ============================================================================
// TYPES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedPayload {
    pub ciphertext: String,
    pub ephemeral_pub: String,
    pub nonce: String,
    pub recipient_pub: String,
    pub version: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelayPostRequest {
    pub id: String,
    pub encrypted: EncryptedPayload,
    pub party_a: String,
    pub party_b: String,
    pub sender_pubkey: String,
    pub schnorr_signature: String,
    pub lamport_commitment: String,      // Poseidon hash of Lamport sig
    pub encrypted_lamport: EncryptedPayload,
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelayPostResponse {
    pub id: String,
    pub arweave_id: String,
    pub merkle_index: u64,
    pub merkle_root: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignatureSubmission {
    pub pubkey: String,
    pub schnorr_signature: String,
    pub lamport_commitment: String,
    pub encrypted_lamport: EncryptedPayload,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MerkleProofResponse {
    pub leaf_index: u64,
    pub path: Vec<MerklePathElementJson>,
    pub root: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MerklePathElementJson {
    pub sibling: String,
    pub is_left: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LamportRevealRequest {
    pub merkle_index: u64,
    pub lamport_signature: LamportSignatureJson,
    pub lamport_public_key: LamportPublicKeyJson,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LamportSignatureJson {
    pub revealed: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LamportPublicKeyJson {
    pub pairs: Vec<LamportPairJson>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LamportPairJson {
    pub zero: String,
    pub one: String,
}

// ============================================================================
// RELAY STATE (wraps existing SparseMerkleTree)
// ============================================================================

pub struct RelayState {
    pub merkle_tree: Arc<RwLock<SparseMerkleTree>>,
    pub next_index: Arc<RwLock<u64>>,
    pub sheet_indices: Arc<RwLock<HashMap<String, Vec<u64>>>>, // sheet_id -> merkle indices
}

impl RelayState {
    pub fn new(tree: Arc<RwLock<SparseMerkleTree>>) -> Self {
        Self {
            merkle_tree: tree,
            next_index: Arc::new(RwLock::new(0)),
            sheet_indices: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    /// Insert Lamport commitment into Merkle tree
    pub fn insert_commitment(&self, commitment_hex: &str) -> Result<(u64, String), String> {
        // Parse commitment as field element
        let commitment = Fq::from_str_vartime(commitment_hex)
            .ok_or_else(|| "Invalid commitment hex")?;
        
        // Get next index
        let index = {
            let mut idx = self.next_index.write().unwrap();
            let current = *idx;
            *idx += 1;
            current
        };
        
        // Insert into tree
        {
            let mut tree = self.merkle_tree.write().unwrap();
            tree.update(index, commitment);
        }
        
        // Get new root
        let root = {
            let tree = self.merkle_tree.read().unwrap();
            format!("{:?}", tree.root())
        };
        
        Ok((index, root))
    }
    
    /// Track which indices belong to a sheet
    pub fn track_sheet_index(&self, sheet_id: &str, index: u64) {
        let mut indices = self.sheet_indices.write().unwrap();
        indices.entry(sheet_id.to_string()).or_default().push(index);
    }
    
    /// Generate Merkle proof
    pub fn get_proof(&self, index: u64) -> MerkleProofResponse {
        let tree = self.merkle_tree.read().unwrap();
        let proof = tree.generate_proof(index);
        
        MerkleProofResponse {
            leaf_index: proof.leaf_index,
            path: proof.path.iter().map(|el| MerklePathElementJson {
                sibling: format!("{:?}", el.sibling),
                is_left: el.is_left,
            }).collect(),
            root: format!("{:?}", tree.root()),
        }
    }
    
    /// Get current root
    pub fn get_root(&self) -> (String, u64) {
        let tree = self.merkle_tree.read().unwrap();
        let idx = *self.next_index.read().unwrap();
        (format!("{:?}", tree.root()), idx)
    }
}

// ============================================================================
// SCHNORR VERIFICATION
// ============================================================================

fn verify_schnorr(message_hash: &[u8; 32], sig_hex: &str, pubkey_hex: &str) -> bool {
    if sig_hex.len() != 128 || pubkey_hex.len() != 64 { return false; }
    
    let sig_bytes = match hex::decode(sig_hex) { Ok(b) => b, Err(_) => return false };
    let pub_bytes = match hex::decode(pubkey_hex) { Ok(b) => b, Err(_) => return false };
    
    use k256::schnorr::{Signature, VerifyingKey, signature::Verifier};
    
    let sig = match Signature::try_from(sig_bytes.as_slice()) { Ok(s) => s, Err(_) => return false };
    let vk = match VerifyingKey::from_bytes(&pub_bytes.try_into().unwrap_or([0u8; 32])) {
        Ok(v) => v, Err(_) => return false
    };
    
    vk.verify(message_hash, &sig).is_ok()
}

fn hash_sheet_metadata(id: &str, party_a: &str, party_b: &str, created_at: u64) -> [u8; 32] {
    use sha2::{Sha256, Digest};
    let mut h = Sha256::new();
    h.update(id.as_bytes());
    h.update(party_a.as_bytes());
    h.update(party_b.as_bytes());
    h.update(&created_at.to_le_bytes());
    h.finalize().into()
}

// ============================================================================
// ARWEAVE UPLOAD
// ============================================================================

async fn upload_to_arweave(data: &[u8], tags: Vec<(&str, &str)>) -> Result<String, String> {
    let turbo_url = std::env::var("TURBO_URL").unwrap_or_else(|_| "https://turbo.ardrive.io".to_string());
    let api_key = std::env::var("TURBO_API_KEY").map_err(|_| "TURBO_API_KEY not set")?;
    
    let mut tag_list: Vec<serde_json::Value> = tags.iter()
        .map(|(k, v)| serde_json::json!({"name": k, "value": v}))
        .collect();
    tag_list.push(serde_json::json!({"name": "App-Name", "value": "KasVillage"}));
    tag_list.push(serde_json::json!({"name": "Content-Type", "value": "application/json"}));
    
    let client = reqwest::Client::builder().timeout(Duration::from_secs(30)).build().map_err(|e| e.to_string())?;
    
    let response = client.post(&format!("{}/tx", turbo_url))
        .header("Content-Type", "application/octet-stream")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("X-Tags", serde_json::to_string(&tag_list).unwrap())
        .body(data.to_vec())
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    if !response.status().is_success() {
        return Err(format!("Turbo error: {}", response.status()));
    }
    
    let result: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    result["id"].as_str().map(|s| s.to_string()).ok_or_else(|| "No ID".to_string())
}

async fn fetch_from_arweave(id: &str) -> Result<Vec<u8>, String> {
    let gateway = std::env::var("ARWEAVE_GATEWAY").unwrap_or_else(|_| "https://arweave.net".to_string());
    let client = reqwest::Client::builder().timeout(Duration::from_secs(30)).build().map_err(|e| e.to_string())?;
    let response = client.get(&format!("{}/{}", gateway, id)).send().await.map_err(|e| e.to_string())?;
    if !response.status().is_success() { return Err(format!("Error: {}", response.status())); }
    response.bytes().await.map(|b| b.to_vec()).map_err(|e| e.to_string())
}

// ============================================================================
// LAMPORT VERIFICATION
// ============================================================================

fn verify_lamport_commitment(
    sig: &LamportSignatureJson,
    pubkey: &LamportPublicKeyJson,
    expected_commitment: &str,
) -> bool {
    use sha2::{Sha256, Digest};
    
    // Hash signature
    let sig_concat = sig.revealed.join("");
    let sig_hash = Sha256::digest(sig_concat.as_bytes());
    
    // Hash pubkey
    let pubkey_concat: String = pubkey.pairs.iter()
        .map(|p| format!("{}{}", p.zero, p.one))
        .collect();
    let pubkey_hash = Sha256::digest(pubkey_concat.as_bytes());
    
    // Convert to field elements (simplified - matches TypeScript)
    let sig_field = bytes_to_field(&sig_hash);
    let pubkey_field = bytes_to_field(&pubkey_hash);
    
    // Poseidon hash
    let commitment = poseidon_hash_cpu([sig_field, pubkey_field], Fq::from(MERKLE_DOMAIN));
    let commitment_hex = format!("{:064x}", commitment);
    
    commitment_hex == expected_commitment
}

fn bytes_to_field(bytes: &[u8]) -> Fq {
    let mut value = Fq::zero();
    for &byte in bytes {
        value = value * Fq::from(256u64) + Fq::from(byte as u64);
    }
    value
}

// ============================================================================
// ENDPOINTS
// ============================================================================

fn get_client_ip(req: &HttpRequest) -> String {
    if let Some(xff) = req.headers().get("X-Forwarded-For") {
        if let Ok(s) = xff.to_str() {
            if let Some(ip) = s.split(',').next() { return ip.trim().to_string(); }
        }
    }
    req.peer_addr().map(|a| a.ip().to_string()).unwrap_or_else(|| "unknown".to_string())
}

/// POST /api/relay/sheet - Store balance sheet with quantum commitment
pub async fn post_balance_sheet(
    req: HttpRequest,
    body: web::Json<RelayPostRequest>,
    state: web::Data<RelayState>,
    limiter: web::Data<RateLimiter>,
) -> Result<HttpResponse> {
    let ip = get_client_ip(&req);
    if !limiter.check(&ip) {
        return Ok(HttpResponse::TooManyRequests().json(serde_json::json!({"error": "Rate limit"})));
    }
    
    let r = body.into_inner();
    
    // Validate
    if r.id.is_empty() || r.id.len() > 64 {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid ID"})));
    }
    if r.lamport_commitment.len() != 64 {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid Lamport commitment"})));
    }
    
    // Verify Schnorr signature
    let hash = hash_sheet_metadata(&r.id, &r.party_a, &r.party_b, r.created_at);
    if !verify_schnorr(&hash, &r.schnorr_signature, &r.sender_pubkey) {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid signature"})));
    }
    
    // Insert Lamport commitment into Merkle tree
    let (merkle_index, merkle_root) = match state.insert_commitment(&r.lamport_commitment) {
        Ok(r) => r,
        Err(e) => return Ok(HttpResponse::InternalServerError().json(serde_json::json!({"error": e}))),
    };
    
    state.track_sheet_index(&r.id, merkle_index);
    
    // Prepare Arweave data
    let arweave_data = serde_json::json!({
        "id": r.id,
        "encrypted": r.encrypted,
        "party_a": r.party_a,
        "party_b": r.party_b,
        "sender_pubkey": r.sender_pubkey,
        "schnorr_signature": r.schnorr_signature,
        "lamport_commitment": r.lamport_commitment,
        "merkle_index": merkle_index,
        "encrypted_lamport": r.encrypted_lamport,
        "created_at": r.created_at,
    });
    
    let data = serde_json::to_vec(&arweave_data).unwrap();
    let tags = vec![
        ("Type", "BalanceSheet"),
        ("Sheet-ID", r.id.as_str()),
        ("Merkle-Index", &merkle_index.to_string()),
    ];
    
    match upload_to_arweave(&data, tags).await {
        Ok(arweave_id) => {
            log::info!("Sheet {} stored, Merkle index {}, root {}", r.id, merkle_index, merkle_root);
            Ok(HttpResponse::Ok().json(RelayPostResponse {
                id: r.id,
                arweave_id,
                merkle_index,
                merkle_root,
            }))
        }
        Err(e) => {
            log::error!("Arweave upload failed: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({"error": "Storage failed"})))
        }
    }
}

/// POST /api/relay/sheet/{id}/sign - Add counter-signature with quantum commitment
pub async fn submit_signature(
    req: HttpRequest,
    path: web::Path<String>,
    body: web::Json<SignatureSubmission>,
    state: web::Data<RelayState>,
    limiter: web::Data<RateLimiter>,
) -> Result<HttpResponse> {
    let ip = get_client_ip(&req);
    if !limiter.check(&ip) {
        return Ok(HttpResponse::TooManyRequests().json(serde_json::json!({"error": "Rate limit"})));
    }
    
    let sheet_id = path.into_inner();
    let sig = body.into_inner();
    
    // Validate formats
    if sig.pubkey.len() != 64 || sig.schnorr_signature.len() != 128 || sig.lamport_commitment.len() != 64 {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid format"})));
    }
    
    // Insert Lamport commitment
    let (merkle_index, merkle_root) = match state.insert_commitment(&sig.lamport_commitment) {
        Ok(r) => r,
        Err(e) => return Ok(HttpResponse::InternalServerError().json(serde_json::json!({"error": e}))),
    };
    
    state.track_sheet_index(&sheet_id, merkle_index);
    
    // Store signature on Arweave
    let sig_data = serde_json::json!({
        "sheet_id": sheet_id,
        "pubkey": sig.pubkey,
        "schnorr_signature": sig.schnorr_signature,
        "lamport_commitment": sig.lamport_commitment,
        "merkle_index": merkle_index,
        "encrypted_lamport": sig.encrypted_lamport,
        "timestamp": sig.timestamp,
    });
    
    let data = serde_json::to_vec(&sig_data).unwrap();
    let tags = vec![
        ("Type", "BalanceSheetSignature"),
        ("Sheet-ID", sheet_id.as_str()),
        ("Merkle-Index", &merkle_index.to_string()),
    ];
    
    match upload_to_arweave(&data, tags).await {
        Ok(_) => {
            Ok(HttpResponse::Ok().json(serde_json::json!({
                "success": true,
                "merkle_index": merkle_index,
                "merkle_root": merkle_root,
            })))
        }
        Err(e) => {
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({"error": e})))
        }
    }
}

/// GET /api/relay/merkle/proof/{index}
pub async fn get_merkle_proof(
    path: web::Path<u64>,
    state: web::Data<RelayState>,
) -> Result<HttpResponse> {
    let index = path.into_inner();
    let proof = state.get_proof(index);
    Ok(HttpResponse::Ok().json(proof))
}

/// GET /api/relay/merkle/root
pub async fn get_merkle_root(
    state: web::Data<RelayState>,
) -> Result<HttpResponse> {
    let (root, count) = state.get_root();
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "root": root,
        "leaf_count": count,
    })))
}

/// POST /api/relay/sheet/{id}/reveal - Reveal Lamport signature (quantum proof)
pub async fn reveal_lamport(
    req: HttpRequest,
    path: web::Path<String>,
    body: web::Json<LamportRevealRequest>,
    state: web::Data<RelayState>,
    limiter: web::Data<RateLimiter>,
) -> Result<HttpResponse> {
    let ip = get_client_ip(&req);
    if !limiter.check(&ip) {
        return Ok(HttpResponse::TooManyRequests().json(serde_json::json!({"error": "Rate limit"})));
    }
    
    let sheet_id = path.into_inner();
    let reveal = body.into_inner();
    
    // Get stored commitment from Merkle tree
    let tree = state.merkle_tree.read().unwrap();
    let stored_leaf = tree.leaves.get(&reveal.merkle_index);
    
    if stored_leaf.is_none() {
        return Ok(HttpResponse::NotFound().json(serde_json::json!({"error": "Index not found"})));
    }
    
    let stored_commitment = format!("{:064x}", stored_leaf.unwrap());
    
    // Verify revealed Lamport matches stored commitment
    if !verify_lamport_commitment(&reveal.lamport_signature, &reveal.lamport_public_key, &stored_commitment) {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({"error": "Commitment mismatch"})));
    }
    
    // Store revealed Lamport on Arweave
    let reveal_data = serde_json::json!({
        "sheet_id": sheet_id,
        "merkle_index": reveal.merkle_index,
        "lamport_signature": reveal.lamport_signature,
        "lamport_public_key": reveal.lamport_public_key,
        "revealed_at": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    });
    
    let data = serde_json::to_vec(&reveal_data).unwrap();
    let tags = vec![
        ("Type", "LamportReveal"),
        ("Sheet-ID", sheet_id.as_str()),
        ("Merkle-Index", &reveal.merkle_index.to_string()),
    ];
    
    match upload_to_arweave(&data, tags).await {
        Ok(arweave_id) => {
            Ok(HttpResponse::Ok().json(serde_json::json!({
                "verified": true,
                "arweave_id": arweave_id,
            })))
        }
        Err(e) => {
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({"error": e})))
        }
    }
}

// ============================================================================
// ROUTE CONFIGURATION
// ============================================================================

pub fn configure_relay_routes(
    cfg: &mut web::ServiceConfig,
    merkle_tree: Arc<RwLock<SparseMerkleTree>>,
) {
    let limiter = web::Data::new(RateLimiter::new(100, 60));
    let state = web::Data::new(RelayState::new(merkle_tree));
    
    cfg
        .app_data(limiter.clone())
        .app_data(state.clone())
        .service(
            web::scope("/api/relay")
                .route("/sheet", web::post().to(post_balance_sheet))
                .route("/sheet/{id}/sign", web::post().to(submit_signature))
                .route("/sheet/{id}/reveal", web::post().to(reveal_lamport))
                .route("/merkle/proof/{index}", web::get().to(get_merkle_proof))
                .route("/merkle/root", web::get().to(get_merkle_root))
        );
}

// ============================================================================
// USAGE IN MAIN
// ============================================================================
// 
// In your main.rs:
//
// let merkle_tree = Arc::new(RwLock::new(SparseMerkleTree::new(TREE_DEPTH)));
// 
// App::new()
//     .configure(|cfg| configure_relay_routes(cfg, merkle_tree.clone()))
//     // ... other routes
//
// ENV VARS:
// TURBO_URL=https://turbo.ardrive.io
// TURBO_API_KEY=your_key
// ARWEAVE_GATEWAY=https://arweave.net
