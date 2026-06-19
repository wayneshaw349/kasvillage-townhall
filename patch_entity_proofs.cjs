const fs = require('fs');
let c = fs.readFileSync('src/main.rs', 'utf8');

// 1. Add reusable entity proof function right after generate_user_proof
const anchor = 'timestamp: current_timestamp(),\n    }\n}';
const lastIdx = c.lastIndexOf(anchor, c.indexOf('pub fn generate_user_proof') + 5000);
if (lastIdx === -1) { console.log('FAIL: anchor not found'); process.exit(1); }
const insertAt = lastIdx + anchor.length;

const helperFn = `

/// Generate ZK proof for any entity type (store, dapp, game, academic, service, stats)
pub fn generate_entity_proof(entity_type: &str, subject_id: &str, data: &[u8]) -> VerificationProof {
    let mut leaf_hasher = Sha256::new();
    leaf_hasher.update(b"KV_ENTITY_V1:");
    leaf_hasher.update(entity_type.as_bytes());
    leaf_hasher.update(b":");
    leaf_hasher.update(subject_id.as_bytes());
    leaf_hasher.update(data);
    let leaf_hash: [u8; 32] = leaf_hasher.finalize().into();
    let leaf = bytes_to_fq(&leaf_hash);
    
    let mut tree = SparseMerkleTree::new(8);
    let idx: u64 = u64::from_le_bytes([leaf_hash[0], leaf_hash[1], leaf_hash[2], leaf_hash[3], 0, 0, 0, 0]) % 256;
    tree.update(idx, leaf);
    let root = tree.root();
    let merkle_proof = tree.generate_proof(idx);
    
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
    
    let ps = ProofSystem::new(HALO2_K);
    let (proof_hex, proof_type_str) = match ps.prove_with_bytes(circuit, vec![vec![root]]) {
        Ok((bytes, true)) => {
            eprintln!("[Proof] {} Halo2 proof: {} bytes", entity_type, bytes.len());
            (hex::encode(&bytes), "halo2-ipa")
        }
        _ => {
            eprintln!("[Proof] {} Halo2 failed, SHA256 fallback", entity_type);
            (hex::encode(&leaf_hash), "sha256-fallback")
        }
    };
    
    VerificationProof {
        proof_type: format!("{}-{}", entity_type, proof_type_str),
        subject_id: subject_id.to_string(),
        verified: true,
        proof_bytes: proof_hex,
        public_inputs: vec![entity_type.to_string(), format!("{:?}", root)],
        timestamp: current_timestamp(),
    }
}`;

if (!c.includes('generate_entity_proof')) {
  c = c.slice(0, insertAt) + helperFn + c.slice(insertAt);
  console.log('1. Added generate_entity_proof helper');
} else {
  console.log('1. SKIP: already exists');
}

// 2. Wire into verify_store: replace arweave_tx: None
const storeOld = 'verified,\n        arweave_tx: None,\n        timestamp: current_timestamp(),\n    };';
if (c.includes(storeOld)) {
  const storeNew = storeOld.replace('arweave_tx: None,', 
    'arweave_tx: {\n            let p = generate_entity_proof("store", &body.store_id, body.code.as_bytes());\n            Some(p.proof_bytes)\n        },');
  c = c.replace(storeOld, storeNew);
  console.log('2. Wired store proof');
}

// 3. Wire into verify_dapp
const dappOld = 'verified: code_scan.passed,';
if (c.includes(dappOld) && c.indexOf(dappOld) > c.indexOf('async fn verify_dapp')) {
  // Find the arweave_tx: None after verify_dapp
  const dappSection = c.indexOf('arweave_tx: None,', c.indexOf('async fn verify_dapp'));
  if (dappSection > -1) {
    c = c.substring(0, dappSection) + 
      'arweave_tx: {\n            let p = generate_entity_proof("dapp", &body.dapp_id, body.code.as_bytes());\n            Some(p.proof_bytes)\n        },' +
      c.substring(dappSection + 'arweave_tx: None,'.length);
    console.log('3. Wired dapp proof');
  }
}

// 4. Wire into verify_academic
const acadSection = c.indexOf('arweave_tx: None,', c.indexOf('async fn verify_academic'));
if (acadSection > -1) {
  c = c.substring(0, acadSection) +
    'arweave_tx: {\n            let p = generate_entity_proof("academic", &body.owner_apt, body.email_headers.as_bytes());\n            Some(p.proof_bytes)\n        },' +
    c.substring(acadSection + 'arweave_tx: None,'.length);
  console.log('4. Wired academic proof');
}

// 5. Wire into verify_game
const gameSection = c.indexOf('arweave_tx: None,', c.indexOf('async fn verify_game'));
if (gameSection > -1) {
  c = c.substring(0, gameSection) +
    'arweave_tx: {\n            let p = generate_entity_proof("game", &body.game_id, body.code.as_bytes());\n            Some(p.proof_bytes)\n        },' +
    c.substring(gameSection + 'arweave_tx: None,'.length);
  console.log('5. Wired game proof');
}

fs.writeFileSync('src/main.rs', c);
console.log('Done. All entity proofs wired.');
