const fs = require('fs');
let c = fs.readFileSync('src/main.rs', 'utf8');

// 1. Add proof queue (global static) near the top constants
const queueCode = `
// ============================================================================
// ASYNC PROOF QUEUE
// ============================================================================
use std::sync::OnceLock;

#[derive(Clone, Debug, Serialize)]
pub struct ProofJob {
    pub proof_id: String,
    pub status: String, // "generating", "ready", "failed"
    pub proof: Option<VerificationProof>,
    pub response: Option<StatelessVerifyResponse>,
    pub created_at: u64,
}

fn proof_queue() -> &'static Arc<RwLock<std::collections::HashMap<String, ProofJob>>> {
    static QUEUE: OnceLock<Arc<RwLock<std::collections::HashMap<String, ProofJob>>>> = OnceLock::new();
    QUEUE.get_or_init(|| Arc::new(RwLock::new(std::collections::HashMap::new())))
}
`;

// Insert after the BUNDLR_NODE constant
const bundlrAnchor = 'const BUNDLR_NODE: &str = "https://node2.irys.xyz";';
if (!c.includes('proof_queue()') && c.includes(bundlrAnchor)) {
  c = c.replace(bundlrAnchor, bundlrAnchor + '\n' + queueCode);
  console.log('1. Added proof queue');
}

// 2. Modify stateless_verify_identity to be async with background proof
const oldFn = /async fn stateless_verify_identity\(\s*req: web::Json<StatelessVerifyRequest>,\s*state: web::Data<AppStateV3>,\s*\) -> impl Responder \{[\s\S]*?let pubkey = &req\.pubkey;[\s\S]*?let avatar = &req\.avatar;[\s\S]*?let traits = avatar\.count_traits\(\);[\s\S]*?let tier = avatar\.citadel_tier\(\);/;

const newFnStart = `async fn stateless_verify_identity(
    req: web::Json<StatelessVerifyRequest>,
    state: web::Data<AppStateV3>,
) -> impl Responder {
    let pubkey = req.pubkey.clone();
    let avatar = req.avatar.clone();
    let traits = avatar.count_traits();
    let tier = avatar.citadel_tier();
    
    // Generate proof_id
    let mut id_hasher = Sha256::new();
    id_hasher.update(pubkey.as_bytes());
    id_hasher.update(&current_timestamp().to_le_bytes());
    let proof_id = hex::encode(&id_hasher.finalize()[..16]);`;

if (oldFn.test(c)) {
  c = c.replace(oldFn, newFnStart);
  console.log('2. Updated fn signature');
}

// 3. Replace the stats fetch + proof generation with async spawn
// Find the success response block we added in Stage 1
const oldProofBlock = /\/\/ Generate verification proof[\s\S]*?let citadel_traits = avatar\.to_citadel_traits\(\);[\s\S]*?let proof = generate_user_proof[\s\S]*?HttpResponse::Ok\(\)\.json\(StatelessVerifyResponse \{[\s\S]*?proof_public_inputs: Some\(proof\.public_inputs\),[\s\S]*?error: None,[\s\S]*?\}\)/;

const newAsyncBlock = `// Spawn async proof generation
    let state_clone = state.clone();
    let pubkey_clone = pubkey.clone();
    let avatar_clone = avatar.clone();
    let proof_id_clone = proof_id.clone();
    
    // Insert pending job
    {
        let mut queue = proof_queue().write().unwrap();
        queue.insert(proof_id.clone(), ProofJob {
            proof_id: proof_id.clone(),
            status: "generating".into(),
            proof: None,
            response: None,
            created_at: current_timestamp(),
        });
        // Cleanup old jobs (>10 min)
        let now = current_timestamp();
        queue.retain(|_, j| now - j.created_at < 600);
    }
    
    // Background proof generation
    tokio::spawn(async move {
        let stats = match state_clone.arweave_reader.get_user_stats(&pubkey_clone).await {
            Ok(s) => s,
            Err(e) => {
                let mut queue = proof_queue().write().unwrap();
                if let Some(job) = queue.get_mut(&proof_id_clone) {
                    job.status = "failed".into();
                }
                eprintln!("[Proof] Stats fetch failed: {}", e);
                return;
            }
        };
        
        let citadel_traits = avatar_clone.to_citadel_traits();
        let user_stats_l1 = UserStatsL1 {
            pubkey_hash: pubkey_clone.clone(),
            xp: stats.xp,
            successes: stats.successes,
            deadlocks: stats.deadlocks,
            completion_pct: (stats.p_complete() * 100.0) as u8,
            dispute_pct: 0,
            snail_mode: stats.should_snail_mode(),
            attestation_hash: String::new(),
            timestamp: current_timestamp(),
        };
        let proof = generate_user_proof(&user_stats_l1, &citadel_traits);
        
        let response = StatelessVerifyResponse {
            success: true,
            tier: avatar_clone.citadel_tier().as_str().to_string(),
            traits: avatar_clone.count_traits(),
            can_buy: avatar_clone.can_buy(),
            can_sell: avatar_clone.can_sell(),
            xp: stats.xp,
            p_complete: stats.p_complete(),
            snail_mode: stats.should_snail_mode(),
            arweave_tx_id: None,
            proof_hash: Some(proof.proof_bytes.clone()),
            proof_public_inputs: Some(proof.public_inputs.clone()),
            error: None,
        };
        
        let mut queue = proof_queue().write().unwrap();
        if let Some(job) = queue.get_mut(&proof_id_clone) {
            job.status = "ready".into();
            job.proof = Some(proof);
            job.response = Some(response);
            eprintln!("[Proof] Job {} complete", proof_id_clone);
        }
    });
    
    // Return immediately with proof_id
    HttpResponse::Ok().json(json!({
        "success": true,
        "tier": tier.as_str(),
        "traits": traits,
        "can_buy": avatar.can_buy(),
        "can_sell": avatar.can_sell(),
        "proof_id": proof_id,
        "proof_status": "generating",
        "poll_url": format!("/proof-status/{}", proof_id),
    }))`;

if (oldProofBlock.test(c)) {
  c = c.replace(oldProofBlock, newAsyncBlock);
  console.log('3. Replaced with async proof generation');
} else {
  console.log('3. SKIP: proof block pattern not found');
  // Try removing the stats fetch error block too
}

// 4. Also need to handle the error arm - remove the old stats fetch
const oldStatsErr = /let stats = match state\.arweave_reader\.get_user_stats\(pubkey\)\.await \{[\s\S]*?Ok\(s\) => s,[\s\S]*?Err\(e\) => return HttpResponse::InternalServerError[\s\S]*?\}\),[\s\S]*?\};/;
if (oldStatsErr.test(c)) {
  c = c.replace(oldStatsErr, '// Stats fetched in background task');
  console.log('4. Removed sync stats fetch');
}

// 5. Add proof-status endpoint
const proofStatusEndpoint = `
async fn get_proof_status(path: web::Path<String>) -> impl Responder {
    let proof_id = path.into_inner();
    let queue = proof_queue().read().unwrap();
    match queue.get(&proof_id) {
        Some(job) if job.status == "ready" => {
            HttpResponse::Ok().json(json!({
                "proof_id": job.proof_id,
                "status": "ready",
                "response": job.response,
            }))
        }
        Some(job) => {
            HttpResponse::Ok().json(json!({
                "proof_id": job.proof_id,
                "status": job.status,
            }))
        }
        None => HttpResponse::NotFound().json(json!({"error": "Proof not found"})),
    }
}
`;

// Insert before stateless_verify_identity
if (!c.includes('get_proof_status')) {
  const insertBefore = c.indexOf('async fn stateless_verify_identity');
  if (insertBefore > -1) {
    c = c.slice(0, insertBefore) + proofStatusEndpoint + '\n' + c.slice(insertBefore);
    console.log('5. Added proof-status endpoint');
  }
}

// 6. Register the route
const routeAnchor = '.route("/verify-identity", web::post().to(stateless_verify_identity))';
if (c.includes(routeAnchor) && !c.includes('proof-status')) {
  c = c.replace(routeAnchor, routeAnchor + '\n        .route("/proof-status/{id}", web::get().to(get_proof_status))');
  console.log('6. Registered proof-status route');
}

fs.writeFileSync('src/main.rs', c);
const checks = {
  queue: c.includes('proof_queue()'),
  async_spawn: c.includes('tokio::spawn'),
  proof_status: c.includes('get_proof_status'),
  route: c.includes('proof-status/{id}'),
  poll_url: c.includes('poll_url'),
};
console.log('Result:', Object.values(checks).every(v=>v) ? 'ALL OK' : 'CHECK', checks);
