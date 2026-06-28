const fs = require('fs');
const f = 'src\\townhall_verification_complete.rs';
let content = fs.readFileSync(f, 'utf8');

// 1. Add IPACommitmentScheme + VerifierIPA to imports
content = content.replace(
  'ipa::{commitment::ParamsIPA, multiopen::ProverIPA, strategy::SingleStrategy},',
  'ipa::{commitment::{ParamsIPA, IPACommitmentScheme}, multiopen::{ProverIPA, VerifierIPA}, strategy::SingleStrategy},'
);
console.log('1. Added IPACommitmentScheme + VerifierIPA imports');

// 2. Add K constant
content = content.replace(
  'const FIXED_POINT_SCALE: u64 = 1_000000;    // 6 decimals',
  'const FIXED_POINT_SCALE: u64 = 1_000000;    // 6 decimals\nconst HALO2_K: u32 = 5;  // Circuit rows: 2^5 = 32'
);
console.log('2. Added HALO2_K');

// 3. Replace STATS_PK with real keygen (params + vk + pk)
content = content.replace(
  '/// Global proving key (initialized once)\nstatic STATS_PK: Lazy<Option<ProvingKey<EqAffine>>> = Lazy::new(|| {\n    // In production: load from file or generate once at startup\n    None\n});',
  `/// Halo2 IPA params (generated once at startup)
static STATS_PARAMS: Lazy<ParamsIPA<EqAffine>> = Lazy::new(|| {
    log::info!("Generating Halo2 IPA params (K={})...", HALO2_K);
    ParamsIPA::<EqAffine>::new(HALO2_K)
});

/// Verifying key (generated once)
static STATS_VK: Lazy<VerifyingKey<EqAffine>> = Lazy::new(|| {
    let circuit = StatsVerificationCircuit { witness: StatsWitness::default() };
    log::info!("Generating stats verifying key...");
    keygen_vk(&*STATS_PARAMS, &circuit).expect("Stats VK keygen failed")
});

/// Proving key (generated once)
static STATS_PK: Lazy<ProvingKey<EqAffine>> = Lazy::new(|| {
    let circuit = StatsVerificationCircuit { witness: StatsWitness::default() };
    log::info!("Generating stats proving key...");
    keygen_pk(&*STATS_PARAMS, STATS_VK.clone(), &circuit).expect("Stats PK keygen failed")
});`
);
console.log('3. Replaced STATS_PK with real keygen');

// 4. Replace the proof generation: remove if/else, use real create_proof + keep mock as fallback hash
content = content.replace(
  `    if let Some(_pk) = STATS_PK.as_ref() {
        // Real Halo2 proof generation
        unimplemented!("Real Halo2 proof generation")
    } else {
        // Mock proof for development - hash all witness data`,
  `    // Generate real Halo2 IPA SNARK proof
    let real_proof_bytes = {
        let circuit = StatsVerificationCircuit { witness: witness.clone() };
        let mut transcript = Blake2bWrite::<Vec<u8>, EqAffine, Challenge255<EqAffine>>::init(vec![]);
        match create_proof::<
            IPACommitmentScheme<EqAffine>,
            ProverIPA<EqAffine>,
            Challenge255<EqAffine>,
            _,
            Blake2bWrite<Vec<u8>, EqAffine, Challenge255<EqAffine>>,
            StatsVerificationCircuit,
        >(&*STATS_PARAMS, &*STATS_PK, &[circuit], &[&[]], OsRng, &mut transcript) {
            Ok(()) => {
                log::info!("Real SNARK proof generated successfully");
                Some(transcript.finalize())
            }
            Err(e) => {
                log::warn!("SNARK proof failed, using hash fallback: {:?}", e);
                None
            }
        }
    };
    {`
);
console.log('4. Added real create_proof with fallback');

// 5. Use real proof bytes if available, else hash fallback
content = content.replace(
  '            proof_bytes: proof_hash.to_vec(),',
  '            proof_bytes: real_proof_bytes.unwrap_or_else(|| proof_hash.to_vec()),'
);
console.log('5. Prefer real proof, fallback to hash');

// 6. Update proof_type to indicate real vs mock
content = content.replace(
  '            proof_type: "Halo2-IPA-Stats-Mock-V2".to_string(),',
  '            proof_type: if real_proof_bytes.is_some() { "Halo2-IPA-Stats-V2".to_string() } else { "Halo2-IPA-Stats-Hash-V2".to_string() },'
);
console.log('6. Dynamic proof_type (real vs hash)');

fs.writeFileSync(f, content);
console.log('\nDone. Run: cargo check');
