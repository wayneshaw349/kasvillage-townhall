const fs = require('fs');
let c = fs.readFileSync('src/main.rs', 'utf8');

// 1. Add proof fields to StatelessVerifyResponse - find by unique marker
const structMarker = 'pub arweave_tx_id: Option<String>,';
const errorField = '    pub error: Option<String>,';
if (c.includes(structMarker) && !c.includes('pub proof_hash')) {
  c = c.replace(
    structMarker,
    structMarker + '\n    pub proof_hash: Option<String>,\n    pub proof_public_inputs: Option<Vec<String>>,'
  );
  console.log('1. Added proof fields to response struct');
} else {
  console.log('1. SKIP (already has proof_hash or marker not found)');
}

// 2. Add proof_hash: None to error response
const errMarker = 'arweave_tx_id: None,';
// Only patch the one inside the Err arm (has "Stats fetch failed")
const errBlock = /arweave_tx_id: None,\s*error: Some\(format!\("Stats fetch failed/;
if (errBlock.test(c) && !c.includes('proof_hash: None,\n            proof_public_inputs: None,\n            error: Some(format!("Stats fetch failed')) {
  c = c.replace(
    /arweave_tx_id: None,(\s*)error: Some\(format!\("Stats fetch failed/,
    'arweave_tx_id: None,$1proof_hash: None,$1proof_public_inputs: None,$1error: Some(format!("Stats fetch failed'
  );
  console.log('2. Added None fields to error response');
}

// 3. Replace success response with proof generation
const successMarker = 'snail_mode: stats.should_snail_mode(),';
// Find the success HttpResponse block (not the error one)
const successBlock = /HttpResponse::Ok\(\)\.json\(StatelessVerifyResponse \{\s*success: true,\s*tier: tier\.as_str[\s\S]*?arweave_tx_id: None,\s*error: None,\s*\}\)/;
const match = c.match(successBlock);
if (match && !c.includes('generate_user_proof(&user_stats_l1')) {
  const replacement = `// Generate verification proof
    let citadel_traits = avatar.to_citadel_traits();
    let user_stats_l1 = UserStatsL1 {
        pubkey_hash: pubkey.clone(),
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
    
    HttpResponse::Ok().json(StatelessVerifyResponse {
        success: true,
        tier: tier.as_str().to_string(),
        traits,
        can_buy: avatar.can_buy(),
        can_sell: avatar.can_sell(),
        xp: stats.xp,
        p_complete: stats.p_complete(),
        snail_mode: stats.should_snail_mode(),
        arweave_tx_id: None,
        proof_hash: Some(proof.proof_bytes),
        proof_public_inputs: Some(proof.public_inputs),
        error: None,
    })`;
  c = c.replace(successBlock, replacement);
  console.log('3. Wired proof generation into success response');
} else {
  console.log('3. SKIP:', match ? 'already wired' : 'pattern not found');
}

fs.writeFileSync('src/main.rs', c);
const ok1 = c.includes('pub proof_hash: Option<String>');
const ok2 = c.includes('generate_user_proof(&user_stats_l1');
const ok3 = c.includes('proof_hash: Some(proof.proof_bytes)');
console.log('Result:', ok1 && ok2 && ok3 ? 'ALL OK' : 'CHECK', {ok1, ok2, ok3});
