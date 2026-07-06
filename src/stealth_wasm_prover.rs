// ============================================================================
// KASVILLAGE — K=11 STEALTH MERKLE WASM PROVER (phone-side, trustless)
// ============================================================================
// wasm-bindgen wrapper around SparseMerkleCircuit. Phone generates its own
// membership proof locally; no TownHall involvement in proof creation.
// Build: wasm-pack build --target web --release
// Cargo.toml needs: wasm-bindgen, getrandom = { features = ["js"] }
// crate-type = ["cdylib", "rlib"]
// ============================================================================

use wasm_bindgen::prelude::*;
use crate::halo2_snark_module::{
    SparseMerkleCircuit, SparseMerkleTree, ProofSystem, TREE_DEPTH,
    poseidon_leaf_hash,
};
use pasta_curves::pallas::Base as Fq;
use ff::PrimeField;

const K: u32 = 11;

fn fq_from_hex(h: &str) -> Result<Fq, String> {
    let b = hex::decode(h).map_err(|e| e.to_string())?;
    if b.len() != 32 { return Err("need 32 bytes".into()); }
    let mut r = [0u8; 32];
    for i in 0..32 { r[i] = b[31 - i]; }
    let o = Fq::from_repr(r);
    if o.is_some().into() { Ok(o.unwrap()) } else { Err("bad Fq".into()) }
}

fn fq_to_hex(f: Fq) -> String {
    let r = f.to_repr();
    hex::encode(r.as_ref().iter().rev().copied().collect::<Vec<u8>>())
}

// ============================================================================
// Generate membership proof for our leaf against a known set of leaves.
// leaves_hex: all leaf IDs (SHA256(spend_pub) mod Fq) in tree order.
// my_leaf_hex: our own leaf ID. Returns { proof_hex, root_hex }.
// ============================================================================

#[wasm_bindgen]
pub fn generate_merkle_proof(leaves_json: &str, my_index: u32) -> Result<JsValue, JsValue> {
    let leaves: Vec<String> = serde_json::from_str(leaves_json)
        .map_err(|e| JsValue::from_str(&format!("leaves parse: {}", e)))?;

    let mut tree = SparseMerkleTree::new(TREE_DEPTH);
    for (i, lh) in leaves.iter().enumerate() {
        let id = fq_from_hex(lh).map_err(|e| JsValue::from_str(&e))?;
        tree.update(i as u64, poseidon_leaf_hash(id));
    }
    let root = tree.root();
    let smp = tree.generate_proof(my_index as u64);

    let my_id = fq_from_hex(&leaves[my_index as usize]).map_err(|e| JsValue::from_str(&e))?;
    let leaf_hash = poseidon_leaf_hash(my_id);

    let mut index_bits = [false; TREE_DEPTH];
    let mut path = [halo2_proofs::circuit::Value::unknown(); TREE_DEPTH];
    for (lvl, el) in smp.path.iter().enumerate() {
        index_bits[lvl] = !el.is_left; // is_left means current is left child
        path[lvl] = halo2_proofs::circuit::Value::known(el.sibling);
    }

    let circuit = SparseMerkleCircuit {
        leaf: halo2_proofs::circuit::Value::known(leaf_hash),
        index: index_bits,
        proof: path,
        root: halo2_proofs::circuit::Value::known(root),
    };

    let ps = ProofSystem::new(K);
    let (pk, _vk) = ps.generate_keys(&circuit)
        .map_err(|e| JsValue::from_str(&format!("keygen: {}", e)))?;
    let proof = ps.prove(&pk, circuit, vec![vec![root]])
        .map_err(|e| JsValue::from_str(&format!("prove: {}", e)))?;

    let out = serde_json::json!({
        "proof_hex": hex::encode(&proof),
        "root_hex": fq_to_hex(root),
    });
    Ok(JsValue::from_str(&out.to_string()))
}

// ============================================================================
// Verify a proof against a root (used by trustless client verifier callback)
// ============================================================================

#[wasm_bindgen]
pub fn verify_merkle_proof(proof_hex: &str, root_hex: &str) -> bool {
    let proof = match hex::decode(proof_hex) { Ok(b) => b, Err(_) => return false };
    let root = match fq_from_hex(root_hex) { Ok(f) => f, Err(_) => return false };
    crate::halo2_snark_module::verify_proof_with_instances(K, &proof, vec![vec![root]])
        .unwrap_or(false)
}
