const fs = require('fs');
const f = 'src\\townhall_verification_complete.rs';
let content = fs.readFileSync(f, 'utf8');

// 1. Add IPACommitmentScheme + VerifierIPA imports
content = content.replace(
  'ipa::{commitment::ParamsIPA, multiopen::ProverIPA, strategy::SingleStrategy},',
  'ipa::{commitment::{ParamsIPA, IPACommitmentScheme}, multiopen::{ProverIPA, VerifierIPA}, strategy::SingleStrategy},'
);
console.log('1. Imports');

// 2. Add K constant
content = content.replace(
  'const FIXED_POINT_SCALE: u64 = 1_000000;    // 6 decimals',
  'const FIXED_POINT_SCALE: u64 = 1_000000;    // 6 decimals\nconst HALO2_K: u32 = 5;  // 2^5 = 32 rows'
);
console.log('2. HALO2_K');

// 3. Replace STATS_PK
content = content.replace(
  `/// Global proving key (initialized once)
static STATS_PK: Lazy<Option<ProvingKey<EqAffine>>> = Lazy::new(|| {
    // In production: load from file or generate once at startup
    None
});`,
  `/// Halo2 IPA params + keys (generated once on first use)
static STATS_PARAMS: Lazy<ParamsIPA<EqAffine>> = Lazy::new(|| ParamsIPA::<EqAffine>::new(HALO2_K));
static STATS_VK: Lazy<VerifyingKey<EqAffine>> = Lazy::new(|| {
    let c = StatsVerificationCircuit { witness: StatsWitness::default() };
    keygen_vk(&*STATS_PARAMS, &c).expect("VK keygen")
});
static STATS_PK: Lazy<ProvingKey<EqAffine>> = Lazy::new(|| {
    let c = StatsVerificationCircuit { witness: StatsWitness::default() };
    keygen_pk(&*STATS_PARAMS, STATS_VK.clone(), &c).expect("PK keygen")
});`
);
console.log('3. Real keygen');

// 4. Replace the ENTIRE if/else block with real proof + hash fallback in same scope
// Find: "if let Some(_pk) = STATS_PK.as_ref() {"
// Replace through the closing of the else block (ends with the Ok(StatsProof...))
content = content.replace(
  `    if let Some(_pk) = STATS_PK.as_ref() {
        // Real Halo2 proof generation
        unimplemented!("Real Halo2 proof generation")
    } else {
        // Mock proof for development - hash all witness data
        let mut proof_data = Vec::new();`,
  `    // Attempt real Halo2 IPA proof
    let real_proof_bytes: Option<Vec<u8>> = {
        let circuit = StatsVerificationCircuit { witness: witness.clone() };
        let mut transcript = Blake2bWrite::<Vec<u8>, EqAffine, Challenge255<EqAffine>>::init(vec![]);
        match create_proof::<
            IPACommitmentScheme<EqAffine>, ProverIPA<EqAffine>,
            Challenge255<EqAffine>, _, Blake2bWrite<Vec<u8>, EqAffine, Challenge255<EqAffine>>,
            StatsVerificationCircuit,
        >(&*STATS_PARAMS, &*STATS_PK, &[circuit], &[&[]], OsRng, &mut transcript) {
            Ok(()) => Some(transcript.finalize()),
            Err(_e) => None,
        }
    };

    // Hash fallback (always computed for deterministic verification)
    {
        let mut proof_data = Vec::new();`
);
console.log('4. Real proof block');

// 5. Replace proof_bytes and proof_type in StatsProof
content = content.replace(
  '            proof_bytes: proof_hash.to_vec(),',
  '            proof_bytes: real_proof_bytes.clone().unwrap_or_else(|| proof_hash.to_vec()),'
);
content = content.replace(
  '            proof_type: "Halo2-IPA-Stats-Mock-V2".to_string(),',
  '            proof_type: if real_proof_bytes.is_some() { "Halo2-IPA-Stats-V2" } else { "Halo2-IPA-Stats-Hash-V2" }.to_string(),'
);
console.log('5. proof_bytes + proof_type');

fs.writeFileSync(f, content);
console.log('Done');
