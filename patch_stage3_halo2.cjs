const fs = require('fs');
let c = fs.readFileSync('src/main.rs', 'utf8');

// Replace generate_user_proof body with real Halo2 proof
const oldFn = /pub fn generate_user_proof\(stats: &UserStatsL1, traits: &CitadelTraits\) -> VerificationProof \{[\s\S]*?let verified = stats\.meets_criteria\(\);[\s\S]*?VerificationProof \{[\s\S]*?proof_type: "user"\.into\(\),[\s\S]*?timestamp: current_timestamp\(\),[\s\S]*?\}\s*\}/;

const newFn = `pub fn generate_user_proof(stats: &UserStatsL1, traits: &CitadelTraits) -> VerificationProof {
    let verified = stats.meets_criteria();
    
    // Compute identity leaf from user data
    let mut leaf_hasher = Sha256::new();
    leaf_hasher.update(b"KV_IDENTITY_V2:");
    leaf_hasher.update(stats.pubkey_hash.as_bytes());
    leaf_hasher.update(&[traits.count()]);
    leaf_hasher.update(&stats.xp.to_le_bytes());
    let leaf_hash: [u8; 32] = leaf_hasher.finalize().into();
    let leaf = bytes_to_fq(&leaf_hash);
    
    // Build Sparse Merkle Tree with identity leaf
    let mut tree = SparseMerkleTree::new(8);
    let idx: u64 = (stats.xp % 256) as u64;
    tree.update(idx, leaf);
    let root = tree.root();
    let merkle_proof = tree.generate_proof(idx);
    
    // Build SparseMerkleCircuit (same as tested in test_circuit_valid_proof)
    let mut index_bits = [false; 8];
    let mut proof_values = [Value::unknown(); 8];
    for i in 0..8 {
        index_bits[i] = (idx >> i) & 1 == 1;
        proof_values[i] = Value::known(merkle_proof.path[i].sibling);
    }
    let circuit = SparseMerkleCircuit::<8> {
        leaf: Value::known(leaf),
        index: index_bits,
        proof: proof_values,
        root: Value::known(root),
    };
    
    // Generate real Halo2 IPA proof
    let ps = ProofSystem::new(HALO2_K);
    let (proof_hex, proof_type_str) = match ps.prove_with_bytes(circuit, vec![vec![root]]) {
        Ok((bytes, true)) => {
            eprintln!("[Proof] Halo2 ZK proof generated: {} bytes", bytes.len());
            (hex::encode(&bytes), "halo2-ipa")
        }
        Ok((_, false)) => {
            eprintln!("[Proof] Halo2 proof verification failed, SHA256 fallback");
            let mut h = Sha256::new();
            h.update(b"KV_USER_V1_FALLBACK:");
            h.update(&leaf_hash);
            (hex::encode(h.finalize()), "sha256-fallback")
        }
        Err(e) => {
            eprintln!("[Proof] Halo2 failed: {}, SHA256 fallback", e);
            let mut h = Sha256::new();
            h.update(b"KV_USER_V1_FALLBACK:");
            h.update(&leaf_hash);
            (hex::encode(h.finalize()), "sha256-fallback")
        }
    };
    
    VerificationProof {
        proof_type: proof_type_str.into(),
        subject_id: stats.pubkey_hash.clone(),
        verified,
        proof_bytes: proof_hex,
        public_inputs: vec![
            stats.xp.to_string(),
            format!("{:.2}", stats.p_complete()),
            traits.count().to_string(),
            format!("{:?}", root),
        ],
        timestamp: current_timestamp(),
    }
}`;

if (oldFn.test(c)) {
  c = c.replace(oldFn, newFn);
  fs.writeFileSync('src/main.rs', c);
  console.log('Stage 3: OK - Real Halo2 SparseMerkle proof wired');
} else {
  console.log('Stage 3: pattern not found, trying simpler match');
  const simpler = c.indexOf('proof_type: "user".into()');
  console.log('  "user" proof_type at:', simpler);
  const fnStart = c.indexOf('pub fn generate_user_proof');
  console.log('  fn starts at:', fnStart);
}
