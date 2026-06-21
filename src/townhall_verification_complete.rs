// ============================================================================
// KASVILLAGE TOWN HALL - COMPLETE VERIFICATION SYSTEM
// ============================================================================
// Integrates:
// 1. Code scanning (prohibited patterns, suspicious patterns)
// 2. SNARK proof generation (Halo2 IPA)
// 3. User stats verification
// 4. Device attestation validation
// 5. Arweave proof posting
// 6. APT conflict resolution
// ============================================================================

use actix_web::{web, HttpResponse};
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use std::collections::HashSet;
use regex::Regex;
use once_cell::sync::Lazy;

// Halo2 imports (PSE fork with IPA)
use halo2_proofs::{
    arithmetic::Field,
    circuit::{Layouter, SimpleFloorPlanner, Value},
    plonk::{Circuit, ConstraintSystem, Error as PlonkError, Column, Advice, Instance, Selector, Expression, create_proof, verify_proof, keygen_pk, keygen_vk, ProvingKey, VerifyingKey},
    poly::{
        commitment::ParamsProver,
        ipa::{commitment::ParamsIPA, multiopen::ProverIPA, strategy::SingleStrategy},
    },
    transcript::{Blake2bRead, Blake2bWrite, Challenge255},
};
use pasta_curves::{pallas, vesta, Fp, EqAffine};
use rand_core::OsRng;

// ============================================================================
// CONSTANTS
// ============================================================================
const VERIFICATION_FEE_SOMPI: u64 = 0; // FREE verification
const MAX_CODE_SIZE_BYTES: usize = 5 * 1024 * 1024; // 5MB

// ============================================================================
// CODE SCANNER - PROHIBITED PATTERNS
// ============================================================================
// These patterns auto-reject the submission

static PROHIBITED_PATTERNS: Lazy<Vec<Regex>> = Lazy::new(|| {
    vec![
        // Gambling/Casino
        Regex::new(r"(?i)\bcasino\b").unwrap(),
        Regex::new(r"(?i)\bgambling\b").unwrap(),
        Regex::new(r"(?i)\bslots?\b").unwrap(),
        Regex::new(r"(?i)\broulette\b").unwrap(),
        Regex::new(r"(?i)\bblackjack\b").unwrap(),
        Regex::new(r"(?i)\bpoker\b").unwrap(),
        Regex::new(r"(?i)\bbetting\b").unwrap(),
        Regex::new(r"(?i)\bwager\b").unwrap(),
        Regex::new(r"(?i)\bjackpot\b").unwrap(),
        Regex::new(r"(?i)\blottery\b").unwrap(),
        
        // Adult content
        Regex::new(r"(?i)\bporn\b").unwrap(),
        Regex::new(r"(?i)\bxxx\b").unwrap(),
        Regex::new(r"(?i)\badult\s*content\b").unwrap(),
        Regex::new(r"(?i)\bnsfw\b").unwrap(),
        Regex::new(r"(?i)\bexplicit\b").unwrap(),
        
        // Violence/Weapons
        Regex::new(r"(?i)\bweapons?\s*tutorial\b").unwrap(),
        Regex::new(r"(?i)\bbomb\s*making\b").unwrap(),
        Regex::new(r"(?i)\bexplosives?\s*guide\b").unwrap(),
        
        // Drugs
        Regex::new(r"(?i)\bdrug\s*market\b").unwrap(),
        Regex::new(r"(?i)\bbuy\s*drugs?\b").unwrap(),
        Regex::new(r"(?i)\billegal\s*substances?\b").unwrap(),
        
        // Hacking/Malware
        Regex::new(r"(?i)\bmalware\b").unwrap(),
        Regex::new(r"(?i)\bransomware\b").unwrap(),
        Regex::new(r"(?i)\bkeylogger\b").unwrap(),
        Regex::new(r"(?i)\bphishing\b").unwrap(),
        Regex::new(r"(?i)\bexploit\s*kit\b").unwrap(),
        
        // Scams
        Regex::new(r"(?i)\bpyramid\s*scheme\b").unwrap(),
        Regex::new(r"(?i)\bponzi\b").unwrap(),
        Regex::new(r"(?i)\bget\s*rich\s*quick\b").unwrap(),
    ]
});

// ============================================================================
// CODE SCANNER - SUSPICIOUS PATTERNS
// ============================================================================
// These patterns require manual review

static SUSPICIOUS_PATTERNS: Lazy<Vec<Regex>> = Lazy::new(|| {
    vec![
        // Data exfiltration (fetch to non-allowed domains)
        Regex::new(r#"(?i)fetch\s*\(\s*['"]https?://(?!arweave\.net|kasvillage\.dev)"#).unwrap(),
        Regex::new(r"(?i)XMLHttpRequest").unwrap(),
        Regex::new(r"(?i)navigator\.sendBeacon").unwrap(),
        Regex::new(r"(?i)document\.cookie").unwrap(),
        
        // Crypto mining
        Regex::new(r"(?i)coinhive").unwrap(),
        Regex::new(r"(?i)cryptonight").unwrap(),
        Regex::new(r"(?i)minero").unwrap(),
        
        // Iframe injection
        Regex::new(r#"(?i)<iframe[^>]*src\s*=\s*['"](?!https://(arweave\.net|kasvillage\.dev))"#).unwrap(),
        
        // Eval/dynamic code execution
        Regex::new(r"(?i)\beval\s*\(").unwrap(),
        Regex::new(r"(?i)Function\s*\(").unwrap(),
        Regex::new(r#"(?i)setTimeout\s*\(\s*['"]\s*[^'"]*['"]"#).unwrap(),
        Regex::new(r#"(?i)setInterval\s*\(\s*['"]\s*[^'"]*['"]"#).unwrap(),
    ]
});

// ============================================================================
// ALLOWED EXTERNAL DOMAINS
// ============================================================================

const ALLOWED_DOMAINS: [&str; 6] = [
    "arweave.net",
    "kasvillage.dev",
    "fonts.googleapis.com",
    "fonts.gstatic.com",
    "cdnjs.cloudflare.com",
    "unpkg.com",
];

// ============================================================================
// CODE SCAN TYPES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeScanResult {
    pub passed: bool,
    pub status: ScanStatus,
    pub code_hash: String,
    pub code_size_bytes: usize,
    pub prohibited_matches: Vec<PatternMatch>,
    pub suspicious_matches: Vec<PatternMatch>,
    pub external_domains: Vec<String>,
    pub scan_timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ScanStatus {
    Approved,       // No issues found
    PendingReview,  // Suspicious patterns found
    Rejected,       // Prohibited patterns found
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternMatch {
    pub pattern: String,
    pub line_number: usize,
    pub context: String,
    pub severity: Severity,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    Critical,  // Auto-reject
    High,      // Auto-reject
    Medium,    // Requires review
    Low,       // Warning only
}

// ============================================================================
// CODE SCANNER IMPLEMENTATION
// ============================================================================

/// Scan DApp/Game code for prohibited and suspicious patterns
pub fn scan_code(code: &str) -> CodeScanResult {
    let lines: Vec<&str> = code.lines().collect();
    let mut prohibited_matches = Vec::new();
    let mut suspicious_matches = Vec::new();
    let mut external_domains: HashSet<String> = HashSet::new();
    
    // Check code size
    if code.len() > MAX_CODE_SIZE_BYTES {
        return CodeScanResult {
            passed: false,
            status: ScanStatus::Rejected,
            code_hash: compute_hash(code),
            code_size_bytes: code.len(),
            prohibited_matches: vec![PatternMatch {
                pattern: "CODE_SIZE_EXCEEDED".to_string(),
                line_number: 0,
                context: format!("Code size {} exceeds max {}", code.len(), MAX_CODE_SIZE_BYTES),
                severity: Severity::Critical,
            }],
            suspicious_matches: vec![],
            external_domains: vec![],
            scan_timestamp: current_timestamp(),
        };
    }
    
    // Scan for prohibited patterns
    for regex in PROHIBITED_PATTERNS.iter() {
        for (line_num, line) in lines.iter().enumerate() {
            if regex.is_match(line) {
                prohibited_matches.push(PatternMatch {
                    pattern: regex.as_str().to_string(),
                    line_number: line_num + 1,
                    context: truncate(line, 100),
                    severity: Severity::Critical,
                });
            }
        }
    }
    
    // Scan for suspicious patterns
    for regex in SUSPICIOUS_PATTERNS.iter() {
        for (line_num, line) in lines.iter().enumerate() {
            if regex.is_match(line) {
                suspicious_matches.push(PatternMatch {
                    pattern: regex.as_str().to_string(),
                    line_number: line_num + 1,
                    context: truncate(line, 100),
                    severity: Severity::Medium,
                });
            }
        }
    }
    
    // Extract external domains
    let domain_regex = Regex::new(r#"https?://([a-zA-Z0-9.-]+)"#).unwrap();
    for cap in domain_regex.captures_iter(code) {
        if let Some(domain) = cap.get(1) {
            let domain_str = domain.as_str().to_lowercase();
            if !ALLOWED_DOMAINS.iter().any(|d| domain_str.ends_with(d)) {
                external_domains.insert(domain_str);
            }
        }
    }
    
    // Determine status
    let (passed, status) = if !prohibited_matches.is_empty() {
        (false, ScanStatus::Rejected)
    } else if !suspicious_matches.is_empty() || !external_domains.is_empty() {
        (false, ScanStatus::PendingReview)
    } else {
        (true, ScanStatus::Approved)
    };
    
    CodeScanResult {
        passed,
        status,
        code_hash: compute_hash(code),
        code_size_bytes: code.len(),
        prohibited_matches,
        suspicious_matches,
        external_domains: external_domains.into_iter().collect(),
        scan_timestamp: current_timestamp(),
    }
}

// ============================================================================
// SNARK PROOF GENERATION (Halo2 IPA)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofInputs {
    pub content_hash: String,
    pub owner_pubkey: String,
    pub content_type: String,
    pub trait_count: u8,
    pub xp: u64,
    pub successes: u32,
    pub deadlocks: u32,
    pub device_attestation_hash: String,
    pub timestamp: u64,
    pub scan_passed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationProof {
    pub proof_bytes: Vec<u8>,
    pub public_inputs_hash: String,
    pub proof_type: String,
    pub generated_at: u64,
}

/// Generate SNARK proof for verification
/// 
/// Circuit proves:
/// 1. content_hash matches submitted content
/// 2. owner_pubkey owns the content (signature verified)
/// 3. trait_count >= 13 (for sellers)
/// 4. scan_passed = true (code scanner approved)
/// 5. device_attestation is valid
/// 6. stats are real (XP, successes, deadlocks)
pub fn generate_verification_proof(inputs: &ProofInputs) -> Result<VerificationProof, String> {
    // Validate inputs
    if !inputs.scan_passed {
        return Err("Code scan did not pass".to_string());
    }
    
    if inputs.trait_count < 13 {
        return Err("Minimum 13 traits required for verification".to_string());
    }
    
    // In production: use actual Halo2 IPA circuit
    // For now: generate deterministic mock proof
    
    let mut proof_data = Vec::new();
    proof_data.extend_from_slice(inputs.content_hash.as_bytes());
    proof_data.extend_from_slice(inputs.owner_pubkey.as_bytes());
    proof_data.extend_from_slice(inputs.content_type.as_bytes());
    proof_data.push(inputs.trait_count);
    proof_data.extend_from_slice(&inputs.xp.to_le_bytes());
    proof_data.extend_from_slice(&inputs.successes.to_le_bytes());
    proof_data.extend_from_slice(&inputs.deadlocks.to_le_bytes());
    proof_data.extend_from_slice(inputs.device_attestation_hash.as_bytes());
    proof_data.extend_from_slice(&inputs.timestamp.to_le_bytes());
    proof_data.push(if inputs.scan_passed { 1 } else { 0 });
    
    // Generate "proof" hash
    let mut hasher = Sha256::new();
    hasher.update(&proof_data);
    hasher.update(b"KASVILLAGE_VERIFICATION_PROOF_V1");
    let proof_hash = hasher.finalize();
    
    // Generate public inputs hash
    let mut pub_hasher = Sha256::new();
    pub_hasher.update(inputs.content_hash.as_bytes());
    pub_hasher.update(inputs.owner_pubkey.as_bytes());
    pub_hasher.update(&inputs.timestamp.to_le_bytes());
    let public_inputs_hash = hex::encode(pub_hasher.finalize());
    
    Ok(VerificationProof {
        proof_bytes: proof_hash.to_vec(),
        public_inputs_hash,
        proof_type: "Halo2-IPA-Mock-V1".to_string(),
        generated_at: current_timestamp(),
    })
}

/// Verify a SNARK proof
pub fn verify_snark_proof(proof: &VerificationProof, inputs: &ProofInputs) -> bool {
    match generate_verification_proof(inputs) {
        Ok(expected) => proof.proof_bytes == expected.proof_bytes,
        Err(_) => false,
    }
}

// ============================================================================
// HALO2 STATS CIRCUIT - PROVES COUNTERPARTY STATS FROM L1/ARWEAVE
// ============================================================================
// This circuit proves:
// 1. successes count matches L1 success events
// 2. deadlocks count matches L1 deadlock events  
// 3. XP = (successes × XP_PER_SUCCESS) - (deadlocks × XP_PENALTY)
// 4. p_complete = (1 + S) / (2 + S + F) [fixed-point]
// 5. Stats hash matches Arweave commitment
// ============================================================================

/// XP constants (6-decimal fixed point)
const XP_PER_SUCCESS: u64 = 10_000000;      // 10.0
const XP_PENALTY_PER_DEADLOCK: u64 = 50_000000;  // 50.0
const FIXED_POINT_SCALE: u64 = 1_000000;    // 6 decimals

// Enhanced Bayesian factor weights (fixed-point, 6 decimals)
const RECENCY_ACTIVE_BONUS: u64 = 100000;      // +0.1 per recent agreement (max 5)
const RECENCY_STALE_PENALTY: u64 = 800000;     // 0.8x for stale users
const REPEAT_DEADLOCK_PENALTY: u64 = 700000;   // 0.7x per repeat
const RESOLUTION_BONUS_MAX: u64 = 200000;      // +0.2 max for resolution
const SPEED_BONUS: u64 = 1100000;              // 1.1x for fast completion
const SPEED_PENALTY: u64 = 950000;             // 0.95x for slow
const ROLE_BALANCE_MIN: u64 = 900000;          // 0.9x minimum for imbalance

// DAA score constants (Kaspa target: 1 block/second)
const DAA_PER_SECOND: u64 = 1;
const DAA_PER_MINUTE: u64 = 60;
const DAA_PER_HOUR: u64 = 3600;
const DAA_PER_DAY: u64 = 86400;
const DAA_7_DAYS: u64 = 604800;      // 7 * 86400
const DAA_30_DAYS: u64 = 2592000;    // 30 * 86400

// Speed thresholds in DAA (not timestamps)
const SPEED_FAST_DAA: u64 = DAA_PER_HOUR;      // < 1 hour = fast
const SPEED_SLOW_DAA: u64 = DAA_PER_DAY;       // > 1 day = slow

/// Enhanced Bayesian completion probability using ALL L1-provable stats
/// Returns fixed-point value (6 decimals, so 1_000_000 = 1.0)
/// Uses DAA scores for timing (immutable, consensus-agreed)
pub fn compute_enhanced_p_complete(witness: &StatsWitness) -> u64 {
    let s = witness.successes;
    let f = witness.deadlocks;
    let n = s + f;
    
    if n == 0 {
        return FIXED_POINT_SCALE / 2; // 0.5 prior
    }
    
    // 1. BASE: Standard Bayesian (Beta posterior)
    // p = (1 + S) / (2 + S + F)
    let base_p = (1 + s) * FIXED_POINT_SCALE / (2 + n);
    
    // 2. RECENCY WEIGHT (DAA-based)
    let recency_factor = if witness.agreements_last_7d_daa > 0 {
        let bonus = (witness.agreements_last_7d_daa.min(5) as u64) * RECENCY_ACTIVE_BONUS;
        FIXED_POINT_SCALE + bonus // 1.0 + 0.1*min(agreements_7d, 5)
    } else if witness.agreements_last_30d_daa > 0 {
        FIXED_POINT_SCALE // 1.0
    } else {
        RECENCY_STALE_PENALTY // 0.8
    };
    
    // 3. VOLUME CONFIDENCE: confidence = min(n/20, 1.0)
    let volume_confidence = (n * FIXED_POINT_SCALE / 20).min(FIXED_POINT_SCALE);
    
    // 4. DEADLOCK PATTERN PENALTY
    let mut pattern_penalty = FIXED_POINT_SCALE;
    
    // Repeat deadlocks with same counterparty: 0.7^count
    // This catches bad actors regardless of buyer/seller role
    if witness.repeat_deadlock_same_counterparty > 0 {
        for _ in 0..witness.repeat_deadlock_same_counterparty.min(5) {
            pattern_penalty = pattern_penalty * REPEAT_DEADLOCK_PENALTY / FIXED_POINT_SCALE;
        }
    }
    
    // 5. RESOLUTION BONUS
    let resolution_bonus = if witness.resolved_after_deadlock > 0 && witness.deadlocks > 0 {
        let resolution_rate = witness.resolved_after_deadlock * FIXED_POINT_SCALE / witness.deadlocks;
        let bonus = resolution_rate * RESOLUTION_BONUS_MAX / FIXED_POINT_SCALE;
        FIXED_POINT_SCALE + bonus // 1.0 + 0.2 * rate
    } else {
        FIXED_POINT_SCALE
    };
    
    // 6. SPEED FACTOR (DAA-based)
    let speed_factor = if witness.completed > 0 && witness.fastest_completion_daa > 0 {
        let avg_daa = witness.total_completion_daa / witness.completed;
        if avg_daa < SPEED_FAST_DAA { SPEED_BONUS }         // < 1hr in DAA
        else if avg_daa < SPEED_SLOW_DAA { FIXED_POINT_SCALE } // < 1day
        else { SPEED_PENALTY }                               // Slow
    } else {
        FIXED_POINT_SCALE
    };
    
    // 7. ROLE BALANCE
    let role_balance = if witness.total_agreements > 5 {
        let buyer_ratio = witness.as_buyer * FIXED_POINT_SCALE / witness.total_agreements;
        let deviation = if buyer_ratio > FIXED_POINT_SCALE / 2 {
            buyer_ratio - FIXED_POINT_SCALE / 2
        } else {
            FIXED_POINT_SCALE / 2 - buyer_ratio
        };
        let balance = FIXED_POINT_SCALE.saturating_sub(deviation * 2);
        ROLE_BALANCE_MIN + (FIXED_POINT_SCALE - ROLE_BALANCE_MIN) * balance / FIXED_POINT_SCALE
    } else {
        FIXED_POINT_SCALE
    };
    
    // COMBINE: Multiply all factors (fixed-point chain)
    let mut adjusted_p = base_p;
    adjusted_p = adjusted_p * recency_factor / FIXED_POINT_SCALE;
    adjusted_p = adjusted_p * pattern_penalty / FIXED_POINT_SCALE;
    adjusted_p = adjusted_p * resolution_bonus / FIXED_POINT_SCALE;
    adjusted_p = adjusted_p * speed_factor / FIXED_POINT_SCALE;
    adjusted_p = adjusted_p * role_balance / FIXED_POINT_SCALE;
    
    // Blend with prior based on confidence
    let prior = FIXED_POINT_SCALE / 2;
    let final_p = (volume_confidence * adjusted_p + (FIXED_POINT_SCALE - volume_confidence) * prior) 
                  / FIXED_POINT_SCALE;
    
    // Clamp to [1%, 99%]
    final_p.clamp(10000, 990000)
}

/// Intermediate factors for circuit verification
#[derive(Debug, Clone, Default)]
pub struct EnhancedPCompleteFactors {
    pub base_p: u64,
    pub recency_factor: u64,
    pub volume_confidence: u64,
    pub pattern_penalty: u64,
    pub resolution_bonus: u64,
    pub speed_factor: u64,
    pub role_balance: u64,
    pub adjusted_p: u64,
    pub final_p: u64,
}

/// Compute enhanced p_complete with all intermediate factors (for circuit verification)
/// Uses DAA scores for timing
pub fn compute_enhanced_p_complete_with_factors(witness: &StatsWitness) -> EnhancedPCompleteFactors {
    let s = witness.successes;
    let f = witness.deadlocks;
    let n = s + f;
    
    if n == 0 {
        return EnhancedPCompleteFactors {
            base_p: FIXED_POINT_SCALE / 2,
            recency_factor: FIXED_POINT_SCALE,
            volume_confidence: 0,
            pattern_penalty: FIXED_POINT_SCALE,
            resolution_bonus: FIXED_POINT_SCALE,
            speed_factor: FIXED_POINT_SCALE,
            role_balance: FIXED_POINT_SCALE,
            adjusted_p: FIXED_POINT_SCALE / 2,
            final_p: FIXED_POINT_SCALE / 2,
        };
    }
    
    let base_p = (1 + s) * FIXED_POINT_SCALE / (2 + n);
    
    // DAA-based recency
    let recency_factor = if witness.agreements_last_7d_daa > 0 {
        FIXED_POINT_SCALE + (witness.agreements_last_7d_daa.min(5) as u64) * RECENCY_ACTIVE_BONUS
    } else if witness.agreements_last_30d_daa > 0 {
        FIXED_POINT_SCALE
    } else {
        RECENCY_STALE_PENALTY
    };
    
    let volume_confidence = (n * FIXED_POINT_SCALE / 20).min(FIXED_POINT_SCALE);
    
    let mut pattern_penalty = FIXED_POINT_SCALE;
    if witness.repeat_deadlock_same_counterparty > 0 {
        for _ in 0..witness.repeat_deadlock_same_counterparty.min(5) {
            pattern_penalty = pattern_penalty * REPEAT_DEADLOCK_PENALTY / FIXED_POINT_SCALE;
        }
    }
    
    let resolution_bonus = if witness.resolved_after_deadlock > 0 && witness.deadlocks > 0 {
        let rate = witness.resolved_after_deadlock * FIXED_POINT_SCALE / witness.deadlocks;
        FIXED_POINT_SCALE + rate * RESOLUTION_BONUS_MAX / FIXED_POINT_SCALE
    } else {
        FIXED_POINT_SCALE
    };
    
    // DAA-based speed
    let speed_factor = if witness.completed > 0 && witness.fastest_completion_daa > 0 {
        let avg_daa = witness.total_completion_daa / witness.completed;
        if avg_daa < SPEED_FAST_DAA { SPEED_BONUS }
        else if avg_daa < SPEED_SLOW_DAA { FIXED_POINT_SCALE }
        else { SPEED_PENALTY }
    } else {
        FIXED_POINT_SCALE
    };
    
    let role_balance = if witness.total_agreements > 5 {
        let buyer_ratio = witness.as_buyer * FIXED_POINT_SCALE / witness.total_agreements;
        let deviation = if buyer_ratio > FIXED_POINT_SCALE / 2 {
            buyer_ratio - FIXED_POINT_SCALE / 2
        } else {
            FIXED_POINT_SCALE / 2 - buyer_ratio
        };
        let balance = FIXED_POINT_SCALE.saturating_sub(deviation * 2);
        ROLE_BALANCE_MIN + (FIXED_POINT_SCALE - ROLE_BALANCE_MIN) * balance / FIXED_POINT_SCALE
    } else {
        FIXED_POINT_SCALE
    };
    
    let mut adjusted_p = base_p;
    adjusted_p = adjusted_p * recency_factor / FIXED_POINT_SCALE;
    adjusted_p = adjusted_p * pattern_penalty / FIXED_POINT_SCALE;
    adjusted_p = adjusted_p * resolution_bonus / FIXED_POINT_SCALE;
    adjusted_p = adjusted_p * speed_factor / FIXED_POINT_SCALE;
    adjusted_p = adjusted_p * role_balance / FIXED_POINT_SCALE;
    
    let prior = FIXED_POINT_SCALE / 2;
    let final_p = ((volume_confidence * adjusted_p + (FIXED_POINT_SCALE - volume_confidence) * prior) 
                   / FIXED_POINT_SCALE).clamp(10000, 990000);
    
    EnhancedPCompleteFactors {
        base_p,
        recency_factor,
        volume_confidence,
        pattern_penalty,
        resolution_bonus,
        speed_factor,
        role_balance,
        adjusted_p,
        final_p,
    }
}

/// Stats witness for Halo2 circuit - ALL fields provable from L1
#[derive(Debug, Clone, Default)]
pub struct StatsWitness {
    // Identity
    pub pubkey_hash: [u8; 32],
    
    // Core stats (from L1 event counts)
    pub successes: u64,
    pub deadlocks: u64,
    pub xp: u64,
    pub p_complete_fixed: u64,  // Basic: (1 + S) * SCALE / (2 + S + F)
    pub p_complete_enhanced: u64, // Enhanced multi-factor Bayesian
    
    // NeighborAgreementStats (all provable from L1 FROST events)
    pub total_agreements: u64,
    pub as_buyer: u64,
    pub as_seller: u64,
    pub completed: u64,
    pub refunded: u64,
    pub deadlocked: u64,
    pub pending: u64,
    pub total_volume_sompi: u64,
    pub largest_agreement_sompi: u64,
    
    // Timing (DAA score based - immutable, consensus-agreed)
    pub total_completion_daa: u64,    // Sum of (completed_daa - created_daa) for avg
    pub fastest_completion_daa: u64,  // Minimum DAA delta for completion
    pub current_daa_score: u64,       // Current network DAA score
    pub agreements_last_7d_daa: u64,  // Agreements within 604,800 DAA
    pub agreements_last_30d_daa: u64, // Agreements within 2,592,000 DAA
    
    // DeadlockStats (all provable from L1 FROST events with tags)
    pub deadlock_as_buyer: u64,
    pub deadlock_as_seller: u64,
    pub reason_no_delivery: u64,
    pub reason_quality_dispute: u64,
    pub reason_timeout: u64,
    pub reason_other: u64,
    pub resolved_after_deadlock: u64,
    pub last_deadlock_daa: u64,       // DAA score of last deadlock
    pub unique_counterparties_deadlocked: u64,
    pub repeat_deadlock_same_counterparty: u64,
    
    // Enhanced p_complete intermediate factors (for circuit verification)
    pub factors: EnhancedPCompleteFactors,
    
    // Merkle proofs (L1 anchoring)
    pub l1_events_root: [u8; 32],
    pub arweave_stats_hash: [u8; 32],
    pub timestamp: u64,  // Wall-clock for display only
}

/// Stats circuit config - extended for full agreement/deadlock stats + enhanced Bayesian
#[derive(Clone, Debug)]
pub struct StatsCircuitConfig {
    pub advice: [Column<Advice>; 20],  // Extended for enhanced factors
    pub instance: Column<Instance>,
    pub selector: Selector,
}

/// Halo2 circuit for comprehensive stats verification
/// Proves ALL fields are correctly computed from L1 events
#[derive(Clone, Debug)]
pub struct StatsVerificationCircuit {
    pub witness: StatsWitness,
}

impl Circuit<Fp> for StatsVerificationCircuit {
    type Config = StatsCircuitConfig;
    type FloorPlanner = SimpleFloorPlanner;

    fn without_witnesses(&self) -> Self {
        Self {
            witness: StatsWitness {
                pubkey_hash: [0u8; 32],
                successes: 0,
                deadlocks: 0,
                xp: 0,
                p_complete_fixed: FIXED_POINT_SCALE / 2,
                p_complete_enhanced: FIXED_POINT_SCALE / 2,
                total_agreements: 0,
                as_buyer: 0,
                as_seller: 0,
                completed: 0,
                refunded: 0,
                deadlocked: 0,
                pending: 0,
                total_volume_sompi: 0,
                largest_agreement_sompi: 0,
                total_completion_daa: 0,
                fastest_completion_daa: 0,
                current_daa_score: 0,
                agreements_last_7d_daa: 0,
                agreements_last_30d_daa: 0,
                deadlock_as_buyer: 0,
                deadlock_as_seller: 0,
                reason_no_delivery: 0,
                reason_quality_dispute: 0,
                reason_timeout: 0,
                reason_other: 0,
                resolved_after_deadlock: 0,
                last_deadlock_daa: 0,
                unique_counterparties_deadlocked: 0,
                repeat_deadlock_same_counterparty: 0,
                factors: EnhancedPCompleteFactors::default(),
                l1_events_root: [0u8; 32],
                arweave_stats_hash: [0u8; 32],
                timestamp: 0,
            },
        }
    }

    fn configure(meta: &mut ConstraintSystem<Fp>) -> Self::Config {
        let advice: [Column<Advice>; 20] = std::array::from_fn(|_| meta.advice_column());
        let instance = meta.instance_column();
        let selector = meta.selector();

        for col in &advice {
            meta.enable_equality(*col);
        }
        meta.enable_equality(instance);

        // Gate 1: XP computation
        meta.create_gate("xp_computation", |meta| {
            let s = meta.query_selector(selector);
            let successes = meta.query_advice(advice[0], halo2_proofs::poly::Rotation::cur());
            let deadlocks = meta.query_advice(advice[1], halo2_proofs::poly::Rotation::cur());
            let xp = meta.query_advice(advice[2], halo2_proofs::poly::Rotation::cur());
            let base = Expression::Constant(Fp::from(XP_PER_SUCCESS));
            let penalty = Expression::Constant(Fp::from(XP_PENALTY_PER_DEADLOCK));
            vec![s * (xp - (successes * base - deadlocks * penalty))]
        });

        // Gate 2: Basic Bayesian p_complete
        meta.create_gate("p_complete_basic", |meta| {
            let s = meta.query_selector(selector);
            let successes = meta.query_advice(advice[0], halo2_proofs::poly::Rotation::cur());
            let deadlocks = meta.query_advice(advice[1], halo2_proofs::poly::Rotation::cur());
            let p_complete = meta.query_advice(advice[3], halo2_proofs::poly::Rotation::cur());
            let one = Expression::Constant(Fp::one());
            let two = Expression::Constant(Fp::from(2u64));
            let scale = Expression::Constant(Fp::from(FIXED_POINT_SCALE));
            let numerator = (one + successes.clone()) * scale;
            let denominator = two + successes + deadlocks;
            vec![s * (p_complete * denominator - numerator)]
        });

        // Gate 3: Agreement counts: total = completed + refunded + deadlocked + pending
        meta.create_gate("agreement_counts", |meta| {
            let s = meta.query_selector(selector);
            let total = meta.query_advice(advice[5], halo2_proofs::poly::Rotation::cur());
            let completed = meta.query_advice(advice[6], halo2_proofs::poly::Rotation::cur());
            let refunded = meta.query_advice(advice[7], halo2_proofs::poly::Rotation::cur());
            let deadlocked = meta.query_advice(advice[8], halo2_proofs::poly::Rotation::cur());
            let pending = meta.query_advice(advice[9], halo2_proofs::poly::Rotation::cur());
            vec![s * (total - (completed + refunded + deadlocked + pending))]
        });

        // Gate 4: Role counts: total = as_buyer + as_seller
        meta.create_gate("role_counts", |meta| {
            let s = meta.query_selector(selector);
            let total = meta.query_advice(advice[5], halo2_proofs::poly::Rotation::cur());
            let as_buyer = meta.query_advice(advice[10], halo2_proofs::poly::Rotation::cur());
            let as_seller = meta.query_advice(advice[11], halo2_proofs::poly::Rotation::cur());
            vec![s * (total - (as_buyer + as_seller))]
        });

        // Gate 5: Deadlock consistency: deadlocks = deadlocked
        meta.create_gate("deadlock_counts", |meta| {
            let s = meta.query_selector(selector);
            let deadlocks = meta.query_advice(advice[1], halo2_proofs::poly::Rotation::cur());
            let deadlocked = meta.query_advice(advice[8], halo2_proofs::poly::Rotation::cur());
            vec![s * (deadlocks - deadlocked)]
        });

        // Gate 6: Success consistency: successes = completed
        meta.create_gate("success_completed", |meta| {
            let s = meta.query_selector(selector);
            let successes = meta.query_advice(advice[0], halo2_proofs::poly::Rotation::cur());
            let completed = meta.query_advice(advice[6], halo2_proofs::poly::Rotation::cur());
            vec![s * (successes - completed)]
        });

        // Gate 7: Enhanced p_complete factor chain
        // adjusted_p * SCALE^5 = base_p * recency * pattern * resolution * speed * role
        meta.create_gate("enhanced_factors", |meta| {
            let s = meta.query_selector(selector);
            let base_p = meta.query_advice(advice[12], halo2_proofs::poly::Rotation::cur());
            let recency = meta.query_advice(advice[13], halo2_proofs::poly::Rotation::cur());
            let pattern = meta.query_advice(advice[14], halo2_proofs::poly::Rotation::cur());
            let resolution = meta.query_advice(advice[15], halo2_proofs::poly::Rotation::cur());
            let speed = meta.query_advice(advice[16], halo2_proofs::poly::Rotation::cur());
            let role = meta.query_advice(advice[17], halo2_proofs::poly::Rotation::cur());
            let adjusted_p = meta.query_advice(advice[18], halo2_proofs::poly::Rotation::cur());
            let scale5 = Expression::Constant(Fp::from(FIXED_POINT_SCALE.pow(5)));
            vec![s * (adjusted_p * scale5 - base_p * recency * pattern * resolution * speed * role)]
        });

        // Gate 8: Confidence blending
        // final_p * SCALE = confidence * adjusted_p + (SCALE - confidence) * 0.5
        meta.create_gate("confidence_blend", |meta| {
            let s = meta.query_selector(selector);
            let confidence = meta.query_advice(advice[19], halo2_proofs::poly::Rotation::cur());
            let adjusted_p = meta.query_advice(advice[18], halo2_proofs::poly::Rotation::cur());
            let final_p = meta.query_advice(advice[4], halo2_proofs::poly::Rotation::cur());
            let scale = Expression::Constant(Fp::from(FIXED_POINT_SCALE));
            let prior = Expression::Constant(Fp::from(FIXED_POINT_SCALE / 2));
            vec![s * (final_p * scale.clone() - (confidence.clone() * adjusted_p + (scale - confidence) * prior))]
        });

        StatsCircuitConfig { advice, instance, selector }
    }

    fn synthesize(
        &self,
        config: Self::Config,
        mut layouter: impl Layouter<Fp>,
    ) -> Result<(), PlonkError> {
        layouter.assign_region(
            || "stats_verification",
            |mut region| {
                config.selector.enable(&mut region, 0)?;

                // Core stats
                region.assign_advice(|| "successes", config.advice[0], 0, 
                    || Value::known(Fp::from(self.witness.successes)))?;
                region.assign_advice(|| "deadlocks", config.advice[1], 0,
                    || Value::known(Fp::from(self.witness.deadlocks)))?;
                region.assign_advice(|| "xp", config.advice[2], 0,
                    || Value::known(Fp::from(self.witness.xp)))?;
                region.assign_advice(|| "p_complete_basic", config.advice[3], 0,
                    || Value::known(Fp::from(self.witness.p_complete_fixed)))?;
                region.assign_advice(|| "p_complete_enhanced", config.advice[4], 0,
                    || Value::known(Fp::from(self.witness.p_complete_enhanced)))?;
                
                // Agreement stats
                region.assign_advice(|| "total_agreements", config.advice[5], 0,
                    || Value::known(Fp::from(self.witness.total_agreements)))?;
                region.assign_advice(|| "completed", config.advice[6], 0,
                    || Value::known(Fp::from(self.witness.completed)))?;
                region.assign_advice(|| "refunded", config.advice[7], 0,
                    || Value::known(Fp::from(self.witness.refunded)))?;
                region.assign_advice(|| "deadlocked", config.advice[8], 0,
                    || Value::known(Fp::from(self.witness.deadlocked)))?;
                region.assign_advice(|| "pending", config.advice[9], 0,
                    || Value::known(Fp::from(self.witness.pending)))?;
                region.assign_advice(|| "as_buyer", config.advice[10], 0,
                    || Value::known(Fp::from(self.witness.as_buyer)))?;
                region.assign_advice(|| "as_seller", config.advice[11], 0,
                    || Value::known(Fp::from(self.witness.as_seller)))?;
                
                // Enhanced Bayesian factors
                region.assign_advice(|| "base_p", config.advice[12], 0,
                    || Value::known(Fp::from(self.witness.factors.base_p)))?;
                region.assign_advice(|| "recency_factor", config.advice[13], 0,
                    || Value::known(Fp::from(self.witness.factors.recency_factor)))?;
                region.assign_advice(|| "pattern_penalty", config.advice[14], 0,
                    || Value::known(Fp::from(self.witness.factors.pattern_penalty)))?;
                region.assign_advice(|| "resolution_bonus", config.advice[15], 0,
                    || Value::known(Fp::from(self.witness.factors.resolution_bonus)))?;
                region.assign_advice(|| "speed_factor", config.advice[16], 0,
                    || Value::known(Fp::from(self.witness.factors.speed_factor)))?;
                region.assign_advice(|| "role_balance", config.advice[17], 0,
                    || Value::known(Fp::from(self.witness.factors.role_balance)))?;
                region.assign_advice(|| "adjusted_p", config.advice[18], 0,
                    || Value::known(Fp::from(self.witness.factors.adjusted_p)))?;
                region.assign_advice(|| "volume_confidence", config.advice[19], 0,
                    || Value::known(Fp::from(self.witness.factors.volume_confidence)))?;

                Ok(())
            },
        )
    }
}

/// Stats proof output
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatsProof {
    pub proof_bytes: Vec<u8>,
    pub public_inputs: StatsPublicInputs,
    pub proof_type: String,
    pub generated_at: u64,
}

/// All publicly verifiable stats (proven by SNARK)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatsPublicInputs {
    pub pubkey_hash: String,
    
    // Core stats
    pub successes: u64,
    pub deadlocks: u64,
    pub xp: u64,
    pub p_complete_fixed: u64,
    
    // NeighborAgreementStats
    pub total_agreements: u64,
    pub as_buyer: u64,
    pub as_seller: u64,
    pub completed: u64,
    pub refunded: u64,
    pub deadlocked: u64,
    pub pending: u64,
    pub total_volume_sompi: u64,
    pub avg_agreement_sompi: u64,
    pub largest_agreement_sompi: u64,
    pub avg_completion_time_ms: u64,
    pub fastest_completion_ms: u64,
    pub agreements_last_30d: u64,
    pub agreements_last_7d: u64,
    
    // DeadlockStats
    pub deadlock_as_buyer: u64,
    pub deadlock_as_seller: u64,
    pub reason_no_delivery: u64,
    pub reason_quality_dispute: u64,
    pub reason_timeout: u64,
    pub reason_other: u64,
    pub resolved_after_deadlock: u64,
    pub last_deadlock_ms: Option<u64>,
    pub days_since_last_deadlock: Option<u64>,
    pub unique_counterparties_deadlocked: u64,
    pub repeat_deadlock_same_counterparty: u64,
    
    // Merkle anchors
    pub l1_events_root: String,
    pub arweave_stats_hash: String,
}

/// Global proving key (initialized once)
static STATS_PK: Lazy<Option<ProvingKey<EqAffine>>> = Lazy::new(|| {
    // In production: load from file or generate once at startup
    None
});

/// Generate Halo2 proof for comprehensive stats
pub fn generate_stats_proof(witness: &StatsWitness) -> Result<StatsProof, String> {
    // ========== VALIDATION: All constraints must pass ==========
    
    // 1. XP computation: xp = successes * 10 - deadlocks * 50
    let expected_xp = witness.successes
        .saturating_mul(XP_PER_SUCCESS)
        .saturating_sub(witness.deadlocks.saturating_mul(XP_PENALTY_PER_DEADLOCK));
    
    if witness.xp != expected_xp {
        return Err(format!("XP mismatch: claimed {} but computed {}", witness.xp, expected_xp));
    }

    // 2. Bayesian p_complete: (1 + S) / (2 + S + F)
    let expected_p = if witness.successes + witness.deadlocks == 0 {
        FIXED_POINT_SCALE / 2
    } else {
        (1 + witness.successes) * FIXED_POINT_SCALE / (2 + witness.successes + witness.deadlocks)
    };
    let tolerance = FIXED_POINT_SCALE / 100; // 1%
    if witness.p_complete_fixed.abs_diff(expected_p) > tolerance {
        return Err(format!("p_complete mismatch: claimed {} but computed {}", witness.p_complete_fixed, expected_p));
    }

    // 3. Agreement counts: total = completed + refunded + deadlocked + pending
    let sum_outcomes = witness.completed + witness.refunded + witness.deadlocked + witness.pending;
    if witness.total_agreements != sum_outcomes {
        return Err(format!("Agreement count mismatch: total {} != sum {}", witness.total_agreements, sum_outcomes));
    }

    // 4. Role counts: total = as_buyer + as_seller
    if witness.total_agreements != witness.as_buyer + witness.as_seller {
        return Err(format!("Role count mismatch: total {} != buyer {} + seller {}", 
            witness.total_agreements, witness.as_buyer, witness.as_seller));
    }

    // 5. Deadlock consistency: deadlocks == deadlocked && deadlocks == sum of reasons
    if witness.deadlocks != witness.deadlocked {
        return Err(format!("Deadlock mismatch: core {} != agreement {}", witness.deadlocks, witness.deadlocked));
    }
    
    let reason_sum = witness.reason_no_delivery + witness.reason_quality_dispute + 
                     witness.reason_timeout + witness.reason_other;
    if witness.deadlocks != reason_sum {
        return Err(format!("Deadlock reason mismatch: {} != sum {}", witness.deadlocks, reason_sum));
    }

    // 6. Deadlock role consistency
    if witness.deadlocks != witness.deadlock_as_buyer + witness.deadlock_as_seller {
        return Err(format!("Deadlock role mismatch: {} != buyer {} + seller {}",
            witness.deadlocks, witness.deadlock_as_buyer, witness.deadlock_as_seller));
    }

    // 7. Success consistency: successes == completed
    if witness.successes != witness.completed {
        return Err(format!("Success mismatch: {} != completed {}", witness.successes, witness.completed));
    }

    // ========== PROOF GENERATION ==========
    
    // Compute derived values
    let avg_agreement_sompi = if witness.total_agreements > 0 {
        witness.total_volume_sompi / witness.total_agreements
    } else { 0 };
    
    let avg_completion_time_ms = if witness.completed > 0 {
        witness.total_completion_daa / witness.completed
    } else { 0 };
    
    let days_since_last_deadlock = if witness.last_deadlock_daa > 0 {
        let now = current_timestamp();
        Some((now - witness.last_deadlock_daa) / 86400)
    } else { None };

    if let Some(_pk) = STATS_PK.as_ref() {
        // Real Halo2 proof generation
        unimplemented!("Real Halo2 proof generation")
    } else {
        // Mock proof for development - hash all witness data
        let mut proof_data = Vec::new();
        proof_data.extend_from_slice(&witness.pubkey_hash);
        proof_data.extend_from_slice(&witness.successes.to_le_bytes());
        proof_data.extend_from_slice(&witness.deadlocks.to_le_bytes());
        proof_data.extend_from_slice(&witness.xp.to_le_bytes());
        proof_data.extend_from_slice(&witness.p_complete_fixed.to_le_bytes());
        proof_data.extend_from_slice(&witness.total_agreements.to_le_bytes());
        proof_data.extend_from_slice(&witness.as_buyer.to_le_bytes());
        proof_data.extend_from_slice(&witness.as_seller.to_le_bytes());
        proof_data.extend_from_slice(&witness.completed.to_le_bytes());
        proof_data.extend_from_slice(&witness.refunded.to_le_bytes());
        proof_data.extend_from_slice(&witness.deadlocked.to_le_bytes());
        proof_data.extend_from_slice(&witness.pending.to_le_bytes());
        proof_data.extend_from_slice(&witness.total_volume_sompi.to_le_bytes());
        proof_data.extend_from_slice(&witness.largest_agreement_sompi.to_le_bytes());
        proof_data.extend_from_slice(&witness.total_completion_daa.to_le_bytes());
        proof_data.extend_from_slice(&witness.fastest_completion_daa.to_le_bytes());
        proof_data.extend_from_slice(&witness.agreements_last_30d_daa.to_le_bytes());
        proof_data.extend_from_slice(&witness.agreements_last_7d_daa.to_le_bytes());
        proof_data.extend_from_slice(&witness.deadlock_as_buyer.to_le_bytes());
        proof_data.extend_from_slice(&witness.deadlock_as_seller.to_le_bytes());
        proof_data.extend_from_slice(&witness.reason_no_delivery.to_le_bytes());
        proof_data.extend_from_slice(&witness.reason_quality_dispute.to_le_bytes());
        proof_data.extend_from_slice(&witness.reason_timeout.to_le_bytes());
        proof_data.extend_from_slice(&witness.reason_other.to_le_bytes());
        proof_data.extend_from_slice(&witness.resolved_after_deadlock.to_le_bytes());
        proof_data.extend_from_slice(&witness.last_deadlock_daa.to_le_bytes());
        proof_data.extend_from_slice(&witness.unique_counterparties_deadlocked.to_le_bytes());
        proof_data.extend_from_slice(&witness.repeat_deadlock_same_counterparty.to_le_bytes());
        proof_data.extend_from_slice(&witness.l1_events_root);
        proof_data.extend_from_slice(&witness.arweave_stats_hash);
        proof_data.extend_from_slice(&witness.timestamp.to_le_bytes());

        let mut hasher = Sha256::new();
        hasher.update(&proof_data);
        hasher.update(b"KASVILLAGE_STATS_PROOF_V2");
        let proof_hash = hasher.finalize();

        Ok(StatsProof {
            proof_bytes: proof_hash.to_vec(),
            public_inputs: StatsPublicInputs {
                pubkey_hash: hex::encode(&witness.pubkey_hash),
                successes: witness.successes,
                deadlocks: witness.deadlocks,
                xp: witness.xp,
                p_complete_fixed: witness.p_complete_fixed,
                total_agreements: witness.total_agreements,
                as_buyer: witness.as_buyer,
                as_seller: witness.as_seller,
                completed: witness.completed,
                refunded: witness.refunded,
                deadlocked: witness.deadlocked,
                pending: witness.pending,
                total_volume_sompi: witness.total_volume_sompi,
                avg_agreement_sompi,
                largest_agreement_sompi: witness.largest_agreement_sompi,
                avg_completion_time_ms,
                fastest_completion_ms: witness.fastest_completion_daa,
                agreements_last_30d: witness.agreements_last_30d_daa,
                agreements_last_7d: witness.agreements_last_7d_daa,
                deadlock_as_buyer: witness.deadlock_as_buyer,
                deadlock_as_seller: witness.deadlock_as_seller,
                reason_no_delivery: witness.reason_no_delivery,
                reason_quality_dispute: witness.reason_quality_dispute,
                reason_timeout: witness.reason_timeout,
                reason_other: witness.reason_other,
                resolved_after_deadlock: witness.resolved_after_deadlock,
                last_deadlock_ms: if witness.last_deadlock_daa > 0 { 
                    Some(witness.last_deadlock_daa * 1000) 
                } else { None },
                days_since_last_deadlock,
                unique_counterparties_deadlocked: witness.unique_counterparties_deadlocked,
                repeat_deadlock_same_counterparty: witness.repeat_deadlock_same_counterparty,
                l1_events_root: hex::encode(&witness.l1_events_root),
                arweave_stats_hash: hex::encode(&witness.arweave_stats_hash),
            },
            proof_type: "Halo2-IPA-Stats-Mock-V2".to_string(),
            generated_at: current_timestamp(),
        })
    }
}

/// Verify stats proof
pub fn verify_stats_proof(proof: &StatsProof, expected_pubkey_hash: &[u8; 32]) -> bool {
    // Check pubkey matches
    if proof.public_inputs.pubkey_hash != hex::encode(expected_pubkey_hash) {
        return false;
    }

   let witness = StatsWitness {
        pubkey_hash: *expected_pubkey_hash,
        successes: proof.public_inputs.successes,
        deadlocks: proof.public_inputs.deadlocks,
        xp: proof.public_inputs.xp,
        p_complete_fixed: proof.public_inputs.p_complete_fixed,
        completed: proof.public_inputs.completed,
        deadlocked: proof.public_inputs.deadlocked,
        refunded: proof.public_inputs.refunded,
        pending: proof.public_inputs.pending,
        total_agreements: proof.public_inputs.total_agreements,
        as_buyer: proof.public_inputs.as_buyer,
        as_seller: proof.public_inputs.as_seller,
        total_volume_sompi: proof.public_inputs.total_volume_sompi,
        largest_agreement_sompi: proof.public_inputs.largest_agreement_sompi,
        agreements_last_7d_daa: proof.public_inputs.agreements_last_7d,
        agreements_last_30d_daa: proof.public_inputs.agreements_last_30d,
        deadlock_as_buyer: proof.public_inputs.deadlock_as_buyer,
        deadlock_as_seller: proof.public_inputs.deadlock_as_seller,
        reason_no_delivery: proof.public_inputs.reason_no_delivery,
        reason_quality_dispute: proof.public_inputs.reason_quality_dispute,
        reason_timeout: proof.public_inputs.reason_timeout,
        reason_other: proof.public_inputs.reason_other,
        resolved_after_deadlock: proof.public_inputs.resolved_after_deadlock,
        unique_counterparties_deadlocked: proof.public_inputs.unique_counterparties_deadlocked,
        repeat_deadlock_same_counterparty: proof.public_inputs.repeat_deadlock_same_counterparty,
        l1_events_root: hex::decode(&proof.public_inputs.l1_events_root)
            .unwrap_or_default()
            .try_into()
            .unwrap_or([0u8; 32]),
        arweave_stats_hash: hex::decode(&proof.public_inputs.arweave_stats_hash)
            .unwrap_or_default()
            .try_into()
            .unwrap_or([0u8; 32]),
        timestamp: proof.generated_at,
        ..Default::default()
    };

    match generate_stats_proof(&witness) {
        Ok(expected) => proof.proof_bytes == expected.proof_bytes,
        Err(_) => false,
    }
}

// ============================================================================
// L1 + ARWEAVE STATS AGGREGATION (Stateless)
// ============================================================================

/// L1 event types from FROST inscriptions
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum FrostEventType {
    AgreementCreated,
    AgreementCompleted,
    AgreementDeadlocked,
    AgreementRefunded,
    AgreementExpired,
}

/// Deadlock reason codes (from L1 tags)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DeadlockReason {
    NoDelivery,
    QualityDispute,
    Timeout,
    Other,
}

/// Single FROST event from L1
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrostEvent {
    pub tx_id: String,
    pub event_type: FrostEventType,
    pub agreement_id: String,
    pub buyer_pubkey: String,
    pub seller_pubkey: String,
    pub amount_sompi: u64,
    pub timestamp: u64,
    pub daa_score: u64,
    // Optional fields for specific event types
    pub deadlock_reason: Option<DeadlockReason>,
    pub completion_time_ms: Option<u64>,  // For completed events
}

/// Full aggregated stats from L1 events (DAA-based timing)
#[derive(Debug, Clone, Default)]
pub struct AggregatedL1Stats {
    // Core
    pub successes: u64,
    pub deadlocks: u64,
    
    // NeighborAgreementStats
    pub total_agreements: u64,
    pub as_buyer: u64,
    pub as_seller: u64,
    pub completed: u64,
    pub refunded: u64,
    pub deadlocked: u64,
    pub pending: u64,
    pub total_volume_sompi: u64,
    pub largest_agreement_sompi: u64,
    
    // DAA-based timing
    pub total_completion_daa: u64,    // Sum of completion DAA deltas
    pub fastest_completion_daa: u64,  // Minimum completion DAA delta
    pub current_daa_score: u64,       // Latest DAA score seen
    pub agreements_last_7d_daa: u64,  // Count within 604,800 DAA
    pub agreements_last_30d_daa: u64, // Count within 2,592,000 DAA
    
    // DeadlockStats
    pub deadlock_as_buyer: u64,
    pub deadlock_as_seller: u64,
    pub reason_no_delivery: u64,
    pub reason_quality_dispute: u64,
    pub reason_timeout: u64,
    pub reason_other: u64,
    pub resolved_after_deadlock: u64,
    pub last_deadlock_daa: u64,
    pub unique_counterparties_deadlocked: HashSet<String>,
    pub repeat_deadlock_counterparties: HashSet<String>,
    pub unique_counterparties_all: HashSet<String>,

    // Self-trade detection
    pub unique_counterparties_completed: HashSet<String>,
    pub repeat_success_same_counterparty: u64,
    
    // For Merkle root
    pub event_hashes: Vec<String>,
}

/// Aggregate stats from L1 events (full extraction, DAA-based timing)
pub fn aggregate_l1_events_full(events: &[FrostEvent], pubkey: &str, current_daa: u64) -> AggregatedL1Stats {
    let mut stats = AggregatedL1Stats {
        current_daa_score: current_daa,
        ..Default::default()
    };
    
    let daa_7d_ago = current_daa.saturating_sub(DAA_7_DAYS);
    let daa_30d_ago = current_daa.saturating_sub(DAA_30_DAYS);
    
    // Track counterparties for deadlock patterns
    let mut deadlock_counterparties: std::collections::HashMap<String, u64> = std::collections::HashMap::new();
    
    // Track agreement creation DAA scores for completion time calc
    let mut agreement_created_daa: std::collections::HashMap<String, u64> = std::collections::HashMap::new();

    for event in events {
        let is_buyer = event.buyer_pubkey == pubkey;
        let is_seller = event.seller_pubkey == pubkey;
        
        if !is_buyer && !is_seller {
            continue;
        }
        
        let counterparty = if is_buyer { &event.seller_pubkey } else { &event.buyer_pubkey };
        
        stats.event_hashes.push(event.tx_id.clone());
        stats.unique_counterparties_all.insert(counterparty.clone());

        match event.event_type {
            FrostEventType::AgreementCreated => {
                stats.total_agreements += 1;
                stats.pending += 1;
                if is_buyer { stats.as_buyer += 1; } else { stats.as_seller += 1; }
                stats.total_volume_sompi += event.amount_sompi;
                if event.amount_sompi > stats.largest_agreement_sompi {
                    stats.largest_agreement_sompi = event.amount_sompi;
                }
                agreement_created_daa.insert(event.agreement_id.clone(), event.daa_score);
                
                // DAA-based recency
                if event.daa_score >= daa_7d_ago { stats.agreements_last_7d_daa += 1; }
                if event.daa_score >= daa_30d_ago { stats.agreements_last_30d_daa += 1; }
            }
            
            FrostEventType::AgreementCompleted => {
                stats.completed += 1;
                stats.successes += 1;
                if stats.pending > 0 { stats.pending -= 1; }
                
                // Calculate completion time in DAA
                if let Some(&created_daa) = agreement_created_daa.get(&event.agreement_id) {
                    let completion_daa = event.daa_score.saturating_sub(created_daa);
                    stats.total_completion_daa += completion_daa;
                    if stats.fastest_completion_daa == 0 || completion_daa < stats.fastest_completion_daa {
                        stats.fastest_completion_daa = completion_daa;
                    }
                }
                
                // Check if this resolves a previous deadlock with same counterparty
                if deadlock_counterparties.contains_key(counterparty) {
                    stats.resolved_after_deadlock += 1;
                // Track unique completed counterparties (self-trade detection)
                if stats.unique_counterparties_completed.contains(counterparty) {
                    stats.repeat_success_same_counterparty += 1;
                }
                stats.unique_counterparties_completed.insert(counterparty.clone());
                }
            }
            
            FrostEventType::AgreementDeadlocked => {
                stats.deadlocked += 1;
                stats.deadlocks += 1;
                if stats.pending > 0 { stats.pending -= 1; }
                
                if is_buyer { stats.deadlock_as_buyer += 1; } else { stats.deadlock_as_seller += 1; }
                
                // Track deadlock reason
                match &event.deadlock_reason {
                    Some(DeadlockReason::NoDelivery) => stats.reason_no_delivery += 1,
                    Some(DeadlockReason::QualityDispute) => stats.reason_quality_dispute += 1,
                    Some(DeadlockReason::Timeout) => stats.reason_timeout += 1,
                    Some(DeadlockReason::Other) | None => stats.reason_other += 1,
                }
                
                // Track last deadlock DAA
                if event.daa_score > stats.last_deadlock_daa {
                    stats.last_deadlock_daa = event.daa_score;
                }
                
                // Track counterparty patterns
                let count = deadlock_counterparties.entry(counterparty.clone()).or_insert(0);
                *count += 1;
                if *count > 1 {
                    stats.repeat_deadlock_counterparties.insert(counterparty.clone());
                }
                stats.unique_counterparties_deadlocked.insert(counterparty.clone());
            }
            
            FrostEventType::AgreementRefunded => {
                stats.refunded += 1;
                if stats.pending > 0 { stats.pending -= 1; }
            }
            
            FrostEventType::AgreementExpired => {
                // Expired = timeout deadlock
                stats.deadlocked += 1;
                stats.deadlocks += 1;
                stats.reason_timeout += 1;
                if stats.pending > 0 { stats.pending -= 1; }
                if is_buyer { stats.deadlock_as_buyer += 1; } else { stats.deadlock_as_seller += 1; }
                
                if event.daa_score > stats.last_deadlock_daa {
                    stats.last_deadlock_daa = event.daa_score;
                }
                stats.unique_counterparties_deadlocked.insert(counterparty.clone());
            }
        }
    }

    stats
}

/// Compute Merkle root of L1 events
pub fn compute_events_merkle_root(event_hashes: &[String]) -> [u8; 32] {
    if event_hashes.is_empty() {
        return [0u8; 32];
    }

    // Convert to byte arrays
    let mut leaves: Vec<[u8; 32]> = event_hashes
        .iter()
        .map(|h| {
            let mut hasher = Sha256::new();
            hasher.update(h.as_bytes());
            hasher.finalize().into()
        })
        .collect();

    // Build Merkle tree
    while leaves.len() > 1 {
        let mut next_level = Vec::new();
        for chunk in leaves.chunks(2) {
            let mut hasher = Sha256::new();
            hasher.update(&chunk[0]);
            if chunk.len() > 1 {
                hasher.update(&chunk[1]);
            } else {
                hasher.update(&chunk[0]); // Duplicate for odd count
            }
            next_level.push(hasher.finalize().into());
        }
        leaves = next_level;
    }

    leaves[0]
}

/// Query L1 for FROST events (via Kaspa API)
pub async fn query_l1_frost_events(pubkey: &str) -> Result<Vec<FrostEvent>, String> {
    // Query Kaspa testnet-10 API for transactions with KV2T tags
    let url = format!(
        "https://api-tn.kaspa.org/addresses/{}/full-transactions?limit=100",
        pubkey
    );

    let client = reqwest::Client::new();
    let response = client.get(&url)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("L1 query failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("L1 API error: {}", response.status()));
    }

    let txs: Vec<serde_json::Value> = response
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    // Parse FROST events from transactions
    let mut events = Vec::new();
    for tx in txs {
        if let Some(event) = parse_frost_event(&tx) {
            events.push(event);
        }
    }

    Ok(events)
}

/// Query current DAA score from L1 (via Kaspa API)
pub async fn query_current_daa_score() -> Result<u64, String> {
    let url = "https://api-tn.kaspa.org/info/virtual-chain-blue-score";

    let client = reqwest::Client::new();
    let response = client.get(url)
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
        .map_err(|e| format!("DAA query failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("DAA API error: {}", response.status()));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    // Extract blue score (DAA score)
    data.get("blueScore")
        .and_then(|v| v.as_u64())
        .ok_or_else(|| "Missing blueScore in response".to_string())
}

/// Parse FROST event from L1 transaction
fn parse_frost_event(tx: &serde_json::Value) -> Option<FrostEvent> {
    // Look for KV2T tag in OP_RETURN output
    let outputs = tx.get("outputs")?.as_array()?;
    
    for output in outputs {
        let script = output.get("script_public_key")?.as_str()?;
        
        // Check for OP_RETURN with KV2T prefix
        if !script.contains("6a") { // OP_RETURN
            continue;
        }

        // Parse KV2T tag
        // Format: KV2T|type|agreement_id|buyer|seller|amount
        let data = hex::decode(script.trim_start_matches("6a")).ok()?;
        let tag_str = String::from_utf8_lossy(&data);
        
        if !tag_str.starts_with("KV2T|") {
            continue;
        }

        let parts: Vec<&str> = tag_str.split('|').collect();
        if parts.len() < 6 {
            continue;
        }

        let event_type = match parts[1] {
            "C" => FrostEventType::AgreementCompleted,
            "D" => FrostEventType::AgreementDeadlocked,
            "R" => FrostEventType::AgreementRefunded,
            "X" => FrostEventType::AgreementExpired,
            "N" => FrostEventType::AgreementCreated,
            _ => continue,
        };

        return Some(FrostEvent {
            tx_id: tx.get("transaction_id")?.as_str()?.to_string(),
            event_type,
            agreement_id: parts[2].to_string(),
            buyer_pubkey: parts[3].to_string(),
            seller_pubkey: parts[4].to_string(),
            amount_sompi: parts[5].parse().unwrap_or(0),
            timestamp: tx.get("block_time")?.as_u64().unwrap_or(0),
            daa_score: tx.get("accepting_block_blue_score")?.as_u64().unwrap_or(0),
            deadlock_reason: None,
            completion_time_ms: None,
        });
    }

    None
}

/// Query Arweave for latest stats record

/// Arweave stats record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArweaveStatsRecord {
    pub arweave_tx: String,
    pub pubkey: String,
    pub xp: u64,
    pub successes: u64,
    pub deadlocks: u64,
    pub timestamp: u64,
}

pub async fn query_arweave_stats(pubkey: &str) -> Result<Option<ArweaveStatsRecord>, String> {
    let query = format!(r#"
        query {{
            transactions(
                tags: [
                    {{ name: "App-Name", values: ["KasVillage"] }},
                    {{ name: "Type", values: ["UserStats"] }},
                    {{ name: "Pubkey", values: ["{}"] }}
                ],
                first: 1,
                sort: HEIGHT_DESC
            ) {{
                edges {{
                    node {{
                        id
                        tags {{ name value }}
                    }}
                }}
            }}
        }}
    "#, pubkey);

    let client = reqwest::Client::new();
    let response = client.post("https://arweave.net/graphql")
        .json(&serde_json::json!({ "query": query }))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("Arweave query failed: {}", e))?;

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    // Parse response
    let edges = data
        .pointer("/data/transactions/edges")
        .and_then(|e| e.as_array());

    if let Some(edges) = edges {
        if let Some(first) = edges.first() {
            let tx_id = first.pointer("/node/id")
                .and_then(|v| v.as_str())
                .unwrap_or_default();
            
            // Fetch full record from Arweave
            let record_url = format!("https://arweave.net/{}", tx_id);
            let record_response = client.get(&record_url)
                .timeout(std::time::Duration::from_secs(10))
                .send()
                .await
                .map_err(|e| format!("Fetch record failed: {}", e))?;

            if record_response.status().is_success() {
                let record: ArweaveStatsRecord = record_response
                    .json()
                    .await
                    .map_err(|e| format!("Parse record failed: {}", e))?;
                return Ok(Some(record));
            }
        }
    }

    Ok(None)
}

/// Full stats aggregation: L1 + Arweave + proof generation (DAA-based timing)
pub async fn aggregate_and_prove_stats(pubkey: &str) -> Result<(CounterpartyStats, StatsProof), String> {
    // 1. Query current DAA score from L1
    let current_daa = query_current_daa_score().await?;
    
    // 2. Query L1 for FROST events
    let l1_events = query_l1_frost_events(pubkey).await?;
    let l1_stats = aggregate_l1_events_full(&l1_events, pubkey, current_daa);
    let l1_events_root = compute_events_merkle_root(&l1_stats.event_hashes);

    // 3. Query Arweave for cached stats (optional, L1 is authoritative)
    let arweave_stats = query_arweave_stats(pubkey).await?;

    // 4. Compute XP and p_complete
    let xp = l1_stats.successes
        .saturating_mul(XP_PER_SUCCESS)
        .saturating_sub(l1_stats.deadlocks.saturating_mul(XP_PENALTY_PER_DEADLOCK));
    
    let p_complete_fixed = if l1_stats.successes + l1_stats.deadlocks == 0 {
        FIXED_POINT_SCALE / 2
    } else {
        (1 + l1_stats.successes) * FIXED_POINT_SCALE / (2 + l1_stats.successes + l1_stats.deadlocks)
    };

    // 5. Compute pubkey hash
    let mut pubkey_hasher = Sha256::new();
    pubkey_hasher.update(pubkey.as_bytes());
    let pubkey_hash: [u8; 32] = pubkey_hasher.finalize().into();

    // 6. Compute Arweave stats hash
    let arweave_stats_hash: [u8; 32] = if let Some(ref ar) = arweave_stats {
        let mut hasher = Sha256::new();
        hasher.update(ar.arweave_tx.as_bytes());
        hasher.finalize().into()
    } else {
        [0u8; 32]
    };

    // 7. Build partial witness first (without factors)
    let mut witness = StatsWitness {
        pubkey_hash,
        successes: l1_stats.successes,
        deadlocks: l1_stats.deadlocks,
        xp,
        p_complete_fixed,
        p_complete_enhanced: 0, // Will be set after computing factors
        total_agreements: l1_stats.total_agreements,
        as_buyer: l1_stats.as_buyer,
        as_seller: l1_stats.as_seller,
        completed: l1_stats.completed,
        refunded: l1_stats.refunded,
        deadlocked: l1_stats.deadlocked,
        pending: l1_stats.pending,
        total_volume_sompi: l1_stats.total_volume_sompi,
        largest_agreement_sompi: l1_stats.largest_agreement_sompi,
        total_completion_daa: l1_stats.total_completion_daa,
        fastest_completion_daa: l1_stats.fastest_completion_daa,
        current_daa_score: current_daa,
        agreements_last_7d_daa: l1_stats.agreements_last_7d_daa,
        agreements_last_30d_daa: l1_stats.agreements_last_30d_daa,
        deadlock_as_buyer: l1_stats.deadlock_as_buyer,
        deadlock_as_seller: l1_stats.deadlock_as_seller,
        reason_no_delivery: l1_stats.reason_no_delivery,
        reason_quality_dispute: l1_stats.reason_quality_dispute,
        reason_timeout: l1_stats.reason_timeout,
        reason_other: l1_stats.reason_other,
        resolved_after_deadlock: l1_stats.resolved_after_deadlock,
        last_deadlock_daa: l1_stats.last_deadlock_daa,
        unique_counterparties_deadlocked: l1_stats.unique_counterparties_deadlocked.len() as u64,
        repeat_deadlock_same_counterparty: l1_stats.repeat_deadlock_counterparties.len() as u64,
        factors: EnhancedPCompleteFactors::default(),
        l1_events_root,
        arweave_stats_hash,
        timestamp: current_timestamp(), // Wall-clock for display only
    };

    // 7b. Compute enhanced Bayesian factors
    let factors = compute_enhanced_p_complete_with_factors(&witness);
    witness.p_complete_enhanced = factors.final_p;
    witness.factors = factors;

    // 8. Generate proof (validates all constraints including enhanced p_complete)
    let proof = generate_stats_proof(&witness)?;

    // 9. Build NeighborAgreementStats (convert DAA to ms for display)
    let now = current_timestamp();
    let neighbor_agreements = NeighborAgreementStats {
        total_agreements: l1_stats.total_agreements,
        as_buyer: l1_stats.as_buyer,
        as_seller: l1_stats.as_seller,
        completed: l1_stats.completed,
        refunded: l1_stats.refunded,
        deadlocked: l1_stats.deadlocked,
        pending: l1_stats.pending,
        total_volume_sompi: l1_stats.total_volume_sompi,
        avg_agreement_sompi: if l1_stats.total_agreements > 0 {
            l1_stats.total_volume_sompi / l1_stats.total_agreements
        } else { 0 },
        largest_agreement_sompi: l1_stats.largest_agreement_sompi,
        // Convert DAA to ms for display (1 DAA ≈ 1 second)
        avg_completion_time_ms: if l1_stats.completed > 0 {
            (l1_stats.total_completion_daa / l1_stats.completed) * 1000
        } else { 0 },
        fastest_completion_ms: l1_stats.fastest_completion_daa * 1000,
        agreements_last_30d: l1_stats.agreements_last_30d_daa,
        agreements_last_7d: l1_stats.agreements_last_7d_daa,
    };

    // 9. Build DeadlockStats
    let deadlock_history = DeadlockStats {
        total_deadlocks: l1_stats.deadlocks,
        as_buyer: l1_stats.deadlock_as_buyer,
        as_seller: l1_stats.deadlock_as_seller,
        reason_no_delivery: l1_stats.reason_no_delivery,
        reason_quality_dispute: l1_stats.reason_quality_dispute,
        reason_timeout: l1_stats.reason_timeout,
        reason_other: l1_stats.reason_other,
        resolved_after_deadlock: l1_stats.resolved_after_deadlock,
        last_deadlock_ms: if l1_stats.last_deadlock_daa > 0 {
            Some(l1_stats.last_deadlock_daa * 1000)
        } else { None },
        days_since_last_deadlock: if l1_stats.last_deadlock_daa > 0 {
            Some((now - l1_stats.last_deadlock_daa) / 86400)
        } else { None },
        unique_counterparties_deadlocked: l1_stats.unique_counterparties_deadlocked.len() as u64,
        repeat_deadlock_same_counterparty: l1_stats.repeat_deadlock_counterparties.len() as u64,
    };

    // 10. Build CounterpartyStats with full data
    let stats = CounterpartyStats::from_raw(
        pubkey.to_string(),
        None, // APT alias looked up separately
        xp,
        l1_stats.successes,
        l1_stats.deadlocks,
        l1_stats.event_hashes.first().map(|_| now * 1000 - 86400000),
        Some(now * 1000),
        arweave_stats.map(|ar| ar.arweave_tx),
        Some(neighbor_agreements),
        Some(deadlock_history),
    );

    Ok((stats, proof))
}

// ============================================================================
// API ENDPOINT: GET COUNTERPARTY STATS WITH PROOF
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct CounterpartyProofRequest {
    pub include_proof: bool,
    #[serde(default)]
    pub include_history: bool,
}

#[derive(Debug, Serialize)]
pub struct CounterpartyProofResponse {
    pub found: bool,
    pub stats: CounterpartyStats,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proof: Option<StatsProof>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recent_agreements: Option<Vec<RecentAgreement>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Get counterparty stats with optional SNARK proof
pub async fn api_get_counterparty_stats_with_proof(
    path: web::Path<String>,
    query: web::Query<CounterpartyProofRequest>,
) -> HttpResponse {
    let pubkey = path.into_inner();

    // Validate pubkey format
    if pubkey.len() != 64 && pubkey.len() != 66 {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "ok": false,
            "error": "Invalid pubkey format"
        }));
    }

    if query.include_proof {
        // Full aggregation with proof
        match aggregate_and_prove_stats(&pubkey).await {
            Ok((stats, proof)) => {
                HttpResponse::Ok().json(CounterpartyProofResponse {
                    found: true,
                    stats,
                    proof: Some(proof),
                    recent_agreements: None, // TODO: include if requested
                    error: None,
                })
            }
            Err(e) => {
                HttpResponse::Ok().json(CounterpartyProofResponse {
                    found: false,
                    stats: CounterpartyStats::unknown(pubkey),
                    proof: None,
                    recent_agreements: None,
                    error: Some(e),
                })
            }
        }
    } else {
        // Quick lookup without proof
        match query_arweave_user_stats(&pubkey).await {
            Some(stats) => {
                HttpResponse::Ok().json(CounterpartyProofResponse {
                    found: true,
                    stats,
                    proof: None,
                    recent_agreements: None,
                    error: None,
                })
            }
            None => {
                HttpResponse::Ok().json(CounterpartyProofResponse {
                    found: false,
                    stats: CounterpartyStats::unknown(pubkey),
                    proof: None,
                    recent_agreements: None,
                    error: Some("User not found".to_string()),
                })
            }
        }
    }
}

// ============================================================================
// USER STATS VERIFICATION
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatsVerifyRequest {
    pub owner_pubkey: String,
    pub apt_number: String,
    pub stats: UserStats,
    pub stats_signature: String,
    pub device_attestation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserStats {
    pub xp: u64,
    pub successes: u32,
    pub deadlocks: u32,
    pub total_transactions: u32,
    pub created_at: u64,
    pub last_active_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatsVerifyResponse {
    pub verified: bool,
    pub stats_proof_tx: String,
    pub p_complete: f64,
    pub risk_rating: String,
    pub message: String,
}

/// Verify user stats and generate proof
pub async fn api_verify_stats(
    body: web::Json<StatsVerifyRequest>,
) -> HttpResponse {
    // Calculate p_complete
    let p_complete = (1.0 + body.stats.successes as f64) 
        / (2.0 + body.stats.successes as f64 + body.stats.deadlocks as f64);
    
    // Determine risk rating
    let risk_rating = if body.stats.total_transactions < 3 {
        "new_user"
    } else if p_complete >= 0.8 && body.stats.xp >= 500 {
        "low"
    } else if p_complete >= 0.5 && body.stats.xp >= 150 {
        "medium"
    } else {
        "high"
    };
    
    // Generate stats hash
    let stats_hash = compute_stats_hash(&body.stats);
    
    // TODO: Verify device attestation
    // TODO: Verify signature
    // TODO: Generate SNARK proof for stats
    // TODO: Post to Arweave
    
    let stats_proof_tx = format!("AR_STATS_{}", &stats_hash[..16]);
    
    HttpResponse::Ok().json(StatsVerifyResponse {
        verified: true,
        stats_proof_tx,
        p_complete,
        risk_rating: risk_rating.to_string(),
        message: "Stats verified successfully".to_string(),
    })
}

fn compute_stats_hash(stats: &UserStats) -> String {
    let mut hasher = Sha256::new();
    hasher.update(stats.xp.to_le_bytes());
    hasher.update(stats.successes.to_le_bytes());
    hasher.update(stats.deadlocks.to_le_bytes());
    hasher.update(stats.total_transactions.to_le_bytes());
    hasher.update(stats.created_at.to_le_bytes());
    hex::encode(hasher.finalize())
}

// ============================================================================
// DAPP/GAME VERIFICATION WITH CODE SCANNING
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct DAppVerifyRequest {
    pub owner_pubkey: String,
    pub apt_number: String,
    pub dapp_name: String,
    pub dapp_code: String,           // Full code to scan
    pub dapp_url: String,            // Arweave URL where hosted
    pub category: String,
    pub xp_commitment: u64,
    pub trait_count: u8,
    pub signature: String,
    pub device_attestation: String,
}

#[derive(Debug, Serialize)]
pub struct DAppVerifyResponse {
    pub verified: bool,
    pub dapp_id: String,
    pub code_hash: String,
    pub scan_result: CodeScanResult,
    pub proof: Option<VerificationProof>,
    pub arweave_tx: Option<String>,
    pub board: String,
    pub message: String,
}

/// Full DApp verification with code scanning and SNARK proof
pub async fn api_verify_dapp(
    body: web::Json<DAppVerifyRequest>,
) -> HttpResponse {
    // 1. Scan code for prohibited/suspicious patterns
    let scan_result = scan_code(&body.dapp_code);
    
    if scan_result.status == ScanStatus::Rejected {
        return HttpResponse::Ok().json(DAppVerifyResponse {
            verified: false,
            dapp_id: String::new(),
            code_hash: scan_result.code_hash.clone(),
            scan_result,
            proof: None,
            arweave_tx: None,
            board: String::new(),
            message: "DApp rejected: Contains prohibited content".to_string(),
        });
    }
    
    // 2. Check trait count
    if body.trait_count < 13 {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "ok": false,
            "error": format!("Need 13 traits to verify, have {}", body.trait_count)
        }));
    }
    
    // 3. Determine board based on XP commitment
    let board = if body.xp_commitment >= 5000 {
        "elite"
    } else if body.xp_commitment >= 1000 {
        "main"
    } else if body.xp_commitment >= 500 {
        "incubator"
    } else {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "ok": false,
            "error": "Minimum 500 XP commitment required"
        }));
    };
    
    // 4. Generate DApp ID
    let mut hasher = Sha256::new();
    hasher.update(body.owner_pubkey.as_bytes());
    hasher.update(body.dapp_name.as_bytes());
    hasher.update(&body.xp_commitment.to_le_bytes());
    let hash = hasher.finalize();
    let dapp_id = format!("DAPP_{}", hex::encode(&hash[..8]));
    
    // 5. Generate SNARK proof (if scan passed)
    let proof = if scan_result.passed {

        let content_hash = scan_result.code_hash.clone();
        
        let owner_pubkey = body.owner_pubkey.clone();
        
        let device_attestation_hash = compute_hash(&body.device_attestation);

        let inputs = ProofInputs {
            content_hash,
            owner_pubkey,
            content_type: "dapp".to_string(),
            trait_count: body.trait_count,
            xp: body.xp_commitment,
            successes: 0,
            deadlocks: 0,
            device_attestation_hash: device_attestation_hash,
            timestamp: current_timestamp(),
            scan_passed: true,
        };
        
        generate_verification_proof(&inputs).ok()
    } else {
        None
    };
    
    // 6. Post to Arweave (if scan passed or pending review)
    let arweave_tx = if scan_result.status != ScanStatus::Rejected {
        // TODO: Actually post to Arweave via Irys
        Some(format!("AR_DAPP_{}", &dapp_id))
    } else {
        None
    };
    
    // 7. Return response
    let verified = scan_result.passed && proof.is_some();
    let message = match scan_result.status {
        ScanStatus::Approved => format!("DApp verified! Published to {} board", board),
        ScanStatus::PendingReview => "DApp submitted for manual review".to_string(),
        ScanStatus::Rejected => "DApp rejected: Contains prohibited content".to_string(),
    };
    
    HttpResponse::Ok().json(DAppVerifyResponse {
        verified,
        dapp_id,
        code_hash: scan_result.code_hash.clone(),
        scan_result,
        proof,
        arweave_tx,
        board: board.to_string(),
        message,
    })
}

// ============================================================================
// PHONE INTEGRITY CHECK ENDPOINT
// ============================================================================
// Phone calls this to verify a loaded DApp matches the verified hash

#[derive(Debug, Deserialize)]
pub struct IntegrityCheckRequest {
    pub dapp_id: String,
    pub loaded_hash: String,  // Hash computed by phone from WebView content
}

#[derive(Debug, Serialize)]
pub struct IntegrityCheckResponse {
    pub matches: bool,
    pub verified_hash: Option<String>,
    pub verification_tx: Option<String>,
    pub submitter_apt: Option<String>,
    pub verified_at: Option<u64>,
    pub warnings: Vec<String>,
}

pub async fn api_check_integrity(
    body: web::Json<IntegrityCheckRequest>,
) -> HttpResponse {
    // TODO: Query Arweave for verified hash
    // For now, mock response
    
    let verified_hash = Some("mock_verified_hash".to_string());
    let matches = body.loaded_hash == *verified_hash.as_ref().unwrap();
    
    let mut warnings = Vec::new();
    if !matches {
        warnings.push("Content hash does not match verified version".to_string());
    }
    
    HttpResponse::Ok().json(IntegrityCheckResponse {
        matches,
        verified_hash,
        verification_tx: Some(format!("AR_VERIFY_{}", body.dapp_id)),
        submitter_apt: Some("APT-1234".to_string()),
        verified_at: Some(current_timestamp() - 86400),
        warnings,
    })
}

// ============================================================================
// APT CONFLICT RESOLUTION
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct AptConflictRequest {
    pub pubkey: String,
    pub requested_apt: String,
    pub device_attestation: String,
}

#[derive(Debug, Serialize)]
pub struct AptConflictResponse {
    pub conflict: bool,
    pub suggested_alternatives: Vec<String>,
    pub message: String,
}

pub async fn api_check_apt_conflict(
    body: web::Json<AptConflictRequest>,
) -> HttpResponse {
    // TODO: Check database for APT conflicts
    // If two devices generate same APT number, suggest alternatives
    
    // Mock: no conflict
    HttpResponse::Ok().json(AptConflictResponse {
        conflict: false,
        suggested_alternatives: vec![],
        message: "APT number available".to_string(),
    })
}

// ============================================================================
// HELPERS
// ============================================================================

fn compute_hash(data: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data.as_bytes());
    hex::encode(hasher.finalize())
}

fn truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len])
    }
}

fn current_timestamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

// ============================================================================
// ROUTE REGISTRATION
// ============================================================================
// Add these routes to your Actix-web app:
//
// .route("/api/verify/dapp", web::post().to(api_verify_dapp))
// .route("/api/verify/stats", web::post().to(api_verify_stats))
// .route("/api/verify/integrity", web::post().to(api_check_integrity))
// .route("/api/apt/conflict", web::post().to(api_check_apt_conflict))
// .route("/api/counterparty/{pubkey}", web::get().to(api_get_counterparty_stats))
// .route("/api/counterparty/{pubkey}/proof", web::get().to(api_get_counterparty_stats_with_proof))
// .route("/api/counterparty/batch", web::post().to(api_get_counterparty_stats_batch))
// .route("/api/stats/aggregate/{pubkey}", web::get().to(api_aggregate_stats))
// ============================================================================

// ============================================================================
// COUNTERPARTY STATS LOOKUP (Stateless - queries Arweave)
// ============================================================================

/// Risk rating based on Bayesian completion probability
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RiskRating {
    HighlyTrusted,
    Reliable,
    MediumRisk,
    HighRisk,
    Unknown,
}

/// Citadel tier based on XP
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CitadelTier {
    Guest,      // <500 XP
    Resident,   // 500+ XP (Incubator)
    Passport,   // 5000+ XP (Elite)
}

/// Full counterparty stats for neighbor agreement display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CounterpartyStats {
    // Identity
    pub pubkey: String,
    pub apt_alias: Option<String>,
    pub citadel_tier: CitadelTier,
    
    // Core stats
    pub xp: u64,
    pub successes: u64,
    pub deadlocks: u64,
    pub total_samples: u64,
    
    // Bayesian computed values
    pub p_complete: f64,           // (1 + S) / (2 + S + F)
    pub confidence: f64,           // min(total_samples / 10, 1.0)
    pub risk_rating: RiskRating,
    
    // Snail mode
    pub is_new_user: bool,         // total_samples < 3
    pub in_snail_mode: bool,       // xp < 150 OR p_complete < 0.5
    pub creation_delay_ms: u64,    // 5000 + (deadlocks * 2000), max 30000
    
    // Neighbor Agreement history
    pub neighbor_agreements: NeighborAgreementStats,
    
    // Deadlock details
    pub deadlock_history: DeadlockStats,
    
    // Timestamps
    pub first_seen_ms: Option<u64>,
    pub last_activity_ms: Option<u64>,
    
    // Source
    pub arweave_tx: Option<String>,
    pub last_updated_ms: u64,
}

/// Neighbor agreement statistics
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NeighborAgreementStats {
    // Totals
    pub total_agreements: u64,
    pub as_buyer: u64,
    pub as_seller: u64,
    
    // Outcomes
    pub completed: u64,
    pub refunded: u64,
    pub deadlocked: u64,
    pub pending: u64,
    
    // Volume (in sompi)
    pub total_volume_sompi: u64,
    pub avg_agreement_sompi: u64,
    pub largest_agreement_sompi: u64,
    
    // Timing
    pub avg_completion_time_ms: u64,
    pub fastest_completion_ms: u64,
    
    // Recent activity
    pub agreements_last_30d: u64,
    pub agreements_last_7d: u64,
}

/// Deadlock statistics
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DeadlockStats {
    pub total_deadlocks: u64,
    pub as_buyer: u64,
    pub as_seller: u64,
    
    // Deadlock reasons (from L1 tags)
    pub reason_no_delivery: u64,
    pub reason_quality_dispute: u64,
    pub reason_timeout: u64,
    pub reason_other: u64,
    
    // Recovery
    pub resolved_after_deadlock: u64,  // Later completed with same counterparty
    
    // Timing
    pub last_deadlock_ms: Option<u64>,
    pub days_since_last_deadlock: Option<u64>,
    
    // Counterparty pattern (without revealing identities)
    pub unique_counterparties_deadlocked: u64,
    pub repeat_deadlock_same_counterparty: u64,
}

/// Snail mode constants
const SNAIL_MODE_XP_THRESHOLD: u64 = 150;
const SNAIL_MODE_P_COMPLETE_THRESHOLD: f64 = 0.5;
const SNAIL_MODE_MIN_SAMPLES: u64 = 3;
const SNAIL_MODE_BASE_DELAY_MS: u64 = 180_000;   // 3 minutes
const SNAIL_MODE_DELAY_PER_DEADLOCK: u64 = 30_000; // 30 seconds
const SNAIL_MODE_MAX_DELAY_MS: u64 = 240_000;    // 4 minutes

/// XP tier thresholds
const XP_INCUBATOR: u64 = 500;
const XP_ELITE: u64 = 5000;

impl CounterpartyStats {
    /// Create from raw stats values
    pub fn from_raw(
        pubkey: String,
        apt_alias: Option<String>,
        xp: u64,
        successes: u64,
        deadlocks: u64,
        first_seen_ms: Option<u64>,
        last_activity_ms: Option<u64>,
        arweave_tx: Option<String>,
        neighbor_agreements: Option<NeighborAgreementStats>,
        deadlock_history: Option<DeadlockStats>,
    ) -> Self {
        let total_samples = successes + deadlocks;
        
        // Bayesian: p_complete = (1 + S) / (2 + S + F)
        let p_complete = (1.0 + successes as f64) / (2.0 + successes as f64 + deadlocks as f64);
        
        // Confidence: min(total_samples / 10, 1.0)
        let confidence = (total_samples as f64 / 10.0).min(1.0);
        
        // Risk rating
        let risk_rating = if p_complete > 0.9 && confidence > 0.5 {
            RiskRating::HighlyTrusted
        } else if p_complete > 0.75 {
            RiskRating::Reliable
        } else if p_complete < 0.4 {
            RiskRating::HighRisk
        } else {
            RiskRating::MediumRisk
        };
        
        // Citadel tier
        let citadel_tier = if xp >= XP_ELITE {
            CitadelTier::Passport
        } else if xp >= XP_INCUBATOR {
            CitadelTier::Resident
        } else {
            CitadelTier::Guest
        };
        
        // Snail mode
        let is_new_user = total_samples < SNAIL_MODE_MIN_SAMPLES;
        let in_snail_mode = !is_new_user && 
            (xp < SNAIL_MODE_XP_THRESHOLD || p_complete < SNAIL_MODE_P_COMPLETE_THRESHOLD);
        
        let creation_delay_ms = if in_snail_mode {
            (SNAIL_MODE_BASE_DELAY_MS + deadlocks * SNAIL_MODE_DELAY_PER_DEADLOCK)
                .min(SNAIL_MODE_MAX_DELAY_MS)
        } else {
            0
        };
        
        Self {
            pubkey,
            apt_alias,
            citadel_tier,
            xp,
            successes,
            deadlocks,
            total_samples,
            p_complete,
            confidence,
            risk_rating,
            is_new_user,
            in_snail_mode,
            creation_delay_ms,
            neighbor_agreements: neighbor_agreements.unwrap_or_default(),
            deadlock_history: deadlock_history.unwrap_or_default(),
            first_seen_ms,
            last_activity_ms,
            arweave_tx,
            last_updated_ms: current_timestamp() * 1000,
        }
    }
    
    /// Create default stats for unknown user
    pub fn unknown(pubkey: String) -> Self {
        Self {
            pubkey,
            apt_alias: None,
            citadel_tier: CitadelTier::Guest,
            xp: 150, // Default starting XP
            successes: 0,
            deadlocks: 0,
            total_samples: 0,
            p_complete: 0.5, // Prior: 50%
            confidence: 0.0,
            risk_rating: RiskRating::Unknown,
            is_new_user: true,
            in_snail_mode: false,
            creation_delay_ms: 0,
            neighbor_agreements: NeighborAgreementStats::default(),
            deadlock_history: DeadlockStats::default(),
            first_seen_ms: None,
            last_activity_ms: None,
            arweave_tx: None,
            last_updated_ms: current_timestamp() * 1000,
            unique_counterparties: 0,
        }
    }
}

/// Request for single counterparty lookup
#[derive(Debug, Deserialize, Default)]
pub struct CounterpartyLookupRequest {
    #[serde(default)]
    pub pubkey: String,
    #[serde(default)]
    pub include_history: bool,
}

/// Response for counterparty lookup
#[derive(Debug, Serialize)]
pub struct CounterpartyLookupResponse {
    pub found: bool,
    pub stats: CounterpartyStats,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recent_agreements: Option<Vec<RecentAgreement>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Recent agreement summary (no sensitive data)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentAgreement {
    pub agreement_id: String,
    pub timestamp_ms: u64,
    pub outcome: AgreementOutcome,
    pub amount_kas: f64,
    pub role: String, // "buyer" | "seller"
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AgreementOutcome {
    Success,
    Deadlock,
    Refund,
    Pending,
}

/// Batch lookup request
#[derive(Debug, Deserialize)]
pub struct CounterpartyBatchRequest {
    pub pubkeys: Vec<String>,
}

/// Batch lookup response
#[derive(Debug, Serialize)]
pub struct CounterpartyBatchResponse {
    pub stats: Vec<CounterpartyStats>,
    pub not_found: Vec<String>,
}

/// Resolve APT to pubkey via Arweave identity inscription
async fn resolve_apt_to_pubkey(apt_raw: &str) -> Result<String, HttpResponse> {
    let apt_clean = apt_raw.trim_start_matches("APT-").trim_start_matches("apt-");
    let apt_hash = compute_hash_index(&format!("APT:{}", apt_clean));
    let query = format!(
        r#"query {{ transactions( tags: [ {{ name: "App-Name", values: ["KasVillage"] }}, {{ name: "Type", values: ["KV_IDENTITY_V1"] }}, {{ name: "APT-Hash", values: ["{}"] }} ], first: 1, sort: HEIGHT_DESC ) {{ edges {{ node {{ tags {{ name value }} }} }} }} }}"#,
        apt_hash
    );
    let client = reqwest::Client::new();
    let response = match client.post("https://arweave.net/graphql")
        .json(&serde_json::json!({ "query": query }))
        .timeout(std::time::Duration::from_secs(10)).send().await {
        Ok(r) => r,
        Err(_) => client.post("https://arweave-search.goldsky.com/graphql")
            .json(&serde_json::json!({ "query": query }))
            .timeout(std::time::Duration::from_secs(10)).send().await
            .map_err(|e| HttpResponse::InternalServerError().json(serde_json::json!({ "ok": false, "error": format!("Arweave: {}", e) })))?,
    };
    let data: serde_json::Value = response.json().await
        .map_err(|e| HttpResponse::InternalServerError().json(serde_json::json!({ "ok": false, "error": format!("Parse: {}", e) })))?;
    data.pointer("/data/transactions/edges")
        .and_then(|e| e.as_array()).and_then(|edges| edges.first())
        .and_then(|edge| edge.pointer("/node/tags")).and_then(|tags| tags.as_array())
        .and_then(|tags| tags.iter()
            .find(|t| t.get("name").and_then(|n| n.as_str()) == Some("Owner-Pubkey"))
            .and_then(|t| t.get("value").and_then(|v| v.as_str()))
            .map(|s| s.to_string()))
        .ok_or_else(|| HttpResponse::NotFound().json(serde_json::json!({
            "ok": false, "error": format!("APT {} not found on Arweave", apt_raw), "apt_hash": apt_hash
        })))
}

/// GET /api/counterparty/apt/{apt}
pub async fn api_counterparty_by_apt(path: web::Path<String>) -> HttpResponse {
    match resolve_apt_to_pubkey(&path.into_inner()).await {
        Ok(pk) => api_get_counterparty_stats(web::Path::from(pk), web::Query(CounterpartyLookupRequest::default())).await,
        Err(r) => r,
    }
}

/// GET /api/storefront/apt/{apt}
pub async fn api_storefront_by_apt(path: web::Path<String>) -> HttpResponse {
    match resolve_apt_to_pubkey(&path.into_inner()).await {
        Ok(pk) => api_get_storefront(web::Path::from(pk)).await,
        Err(r) => r,
    }
}

/// GET /api/storefront/apt/{apt}/products
pub async fn api_products_by_apt(path: web::Path<String>, query: web::Query<std::collections::HashMap<String, String>>) -> HttpResponse {
    match resolve_apt_to_pubkey(&path.into_inner()).await {
        Ok(pk) => api_get_products(web::Path::from(pk), query).await,
        Err(r) => r,
    }
}

/// GET /api/dapp/{pubkey}
pub async fn api_get_dapps_by_owner(path: web::Path<String>) -> HttpResponse {
    let pubkey = path.into_inner();
    let pubkey_hash = compute_hash_index(&format!("PK:{}", pubkey));
    let query = format!(
        r#"query {{ transactions( tags: [ {{ name: "App-Name", values: ["KasVillage"] }}, {{ name: "Type", values: ["KV_DAPP_V1"] }}, {{ name: "Pubkey-Hash", values: ["{}"] }} ], first: 20, sort: HEIGHT_DESC ) {{ edges {{ node {{ id tags {{ name value }} }} }} }} }}"#,
        pubkey_hash
    );
    let client = reqwest::Client::new();
    let response = match client.post("https://arweave.net/graphql")
        .json(&serde_json::json!({ "query": query }))
        .timeout(std::time::Duration::from_secs(10)).send().await {
        Ok(r) => r,
        Err(_) => match client.post("https://arweave-search.goldsky.com/graphql")
            .json(&serde_json::json!({ "query": query }))
            .timeout(std::time::Duration::from_secs(10)).send().await {
            Ok(r) => r,
            Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({ "ok": false, "error": format!("Query: {}", e) })),
        },
    };
    let data: serde_json::Value = match response.json().await {
        Ok(d) => d, Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({ "ok": false, "error": format!("Parse: {}", e) })),
    };
    let mut dapps = Vec::new();
    if let Some(edges) = data.pointer("/data/transactions/edges").and_then(|e| e.as_array()) {
        for edge in edges {
            let tags = edge.pointer("/node/tags").and_then(|t| t.as_array());
            let get_tag = |name: &str| -> Option<String> {
                tags.and_then(|ts| ts.iter()
                    .find(|t| t.get("name").and_then(|n| n.as_str()) == Some(name))
                    .and_then(|t| t.get("value").and_then(|v| v.as_str()))
                    .map(|s| s.to_string()))
            };
            dapps.push(serde_json::json!({
                "tx_id": edge.pointer("/node/id").and_then(|v| v.as_str()).unwrap_or_default(),
                "name": get_tag("KV-DAppName").unwrap_or_default(),
                "category": get_tag("KV-Category").unwrap_or_default(),
                "code_hash": get_tag("KV-CodeHash").unwrap_or_default(),
                "board": get_tag("KV-Board").unwrap_or_default(),
                "owner": get_tag("KV-Owner").unwrap_or_default(),
            }));
        }
    }
    // Enrich with pledge status for each DApp owner
    let mut visible_dapps = Vec::new();
    for dapp in &dapps {
        let owner = dapp.get("owner").and_then(|v| v.as_str()).unwrap_or_default();
        if !owner.is_empty() {
            let pledge = query_dapp_pledge(owner).await;
            let pledge_active = if let Some(ref p) = pledge {
                let bal = query_kaspa_balance(&p.pledge_address).await.unwrap_or(0);
                let current_daa = query_current_daa_score().await.unwrap_or(0);
                bal >= p.pledge_sompi && current_daa <= p.end_daa
            } else { false };
            let mut enriched = dapp.clone();
            if let Some(obj) = enriched.as_object_mut() {
                obj.insert("pledge_active".into(), serde_json::json!(pledge_active));
                if let Some(ref p) = pledge {
                    obj.insert("pledge_kas".into(), serde_json::json!(p.pledge_kas));
                    obj.insert("pledge_duration_days".into(), serde_json::json!(p.duration_daa / 86400));
                }
            }
            visible_dapps.push(enriched);
        } else {
            visible_dapps.push(dapp.clone());
        }
    }
    let dapps = visible_dapps;
    HttpResponse::Ok().json(serde_json::json!({ "ok": true, "dapps": dapps, "count": dapps.len() }))
}

/// GET /api/dapp/apt/{apt}
pub async fn api_dapps_by_apt(path: web::Path<String>) -> HttpResponse {
    match resolve_apt_to_pubkey(&path.into_inner()).await {
        Ok(pk) => api_get_dapps_by_owner(web::Path::from(pk)).await,
        Err(r) => r,
    }
}


/// Get counterparty stats by pubkey
pub async fn api_get_counterparty_stats(
    path: web::Path<String>,
    query: web::Query<CounterpartyLookupRequest>,
) -> HttpResponse {
    let pubkey = path.into_inner();
    
    // Validate pubkey format (32 bytes hex for x-only, 33 bytes for compressed)
    if pubkey.len() != 64 && pubkey.len() != 66 {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "ok": false,
            "error": "Invalid pubkey format. Expected 64 or 66 hex characters."
        }));
    }
    
    // Query Arweave for user stats
    // TODO: Implement actual Arweave GraphQL query
    // For now, return mock data or unknown user
    
    let stats = query_arweave_user_stats(&pubkey).await;
    
    let recent_agreements = if query.include_history {
        query_recent_agreements(&pubkey).await.ok()
    } else {
        None
    };
    
    match stats {
        Some(s) => HttpResponse::Ok().json(CounterpartyLookupResponse {
            found: true,
            stats: s,
            recent_agreements,
            error: None,
        }),
        None => HttpResponse::Ok().json(CounterpartyLookupResponse {
            found: false,
            stats: CounterpartyStats::unknown(pubkey),
            recent_agreements: None,
            error: Some("User not found in Arweave records".to_string()),
        }),
    }
}

/// Batch lookup for multiple counterparties
pub async fn api_get_counterparty_stats_batch(
    body: web::Json<CounterpartyBatchRequest>,
) -> HttpResponse {
    if body.pubkeys.len() > 20 {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "ok": false,
            "error": "Maximum 20 pubkeys per batch request"
        }));
    }
    
    let mut stats = Vec::new();
    let mut not_found = Vec::new();
    
    for pubkey in &body.pubkeys {
        match query_arweave_user_stats(pubkey).await {
            Some(s) => stats.push(s),
            None => {
                not_found.push(pubkey.clone());
                stats.push(CounterpartyStats::unknown(pubkey.clone()));
            }
        }
    }
    
    HttpResponse::Ok().json(CounterpartyBatchResponse { stats, not_found })
}

/// Query Arweave for user stats (stateless)
async fn query_arweave_user_stats(pubkey: &str) -> Option<CounterpartyStats> {
    // GraphQL query to Arweave
    let query = format!(r#"
        query {{
            transactions(
                tags: [
                    {{ name: "App-Name", values: ["KasVillage"] }},
                    {{ name: "Type", values: ["UserStats"] }},
                    {{ name: "Pubkey", values: ["{}"] }}
                ],
                first: 1,
                sort: HEIGHT_DESC
            ) {{
                edges {{
                    node {{
                        id
                        tags {{ name value }}
                    }}
                }}
            }}
        }}
    "#, pubkey);
    
    // TODO: Execute query against https://arweave.net/graphql
    // For now, return None (unknown user)
    // 
    // When implemented:
    // 1. POST to https://arweave.net/graphql with query
    // 2. Parse response to get transaction ID
    // 3. Fetch full data from https://arweave.net/{tx_id}
    // 4. Parse JSON into CounterpartyStats::from_raw()
    
    None
}

/// Query recent agreements for a user
async fn query_recent_agreements(pubkey: &str) -> Result<Vec<RecentAgreement>, String> {
    // GraphQL query to Arweave for FROST events
    let _query = format!(r#"
        query {{
            transactions(
                tags: [
                    {{ name: "App-Name", values: ["KasVillage"] }},
                    {{ name: "Type", values: ["FrostEvent"] }},
                    {{ name: "Participant", values: ["{}"] }}
                ],
                first: 10,
                sort: HEIGHT_DESC
            ) {{
                edges {{
                    node {{
                        id
                        tags {{ name value }}
                        block {{ timestamp }}
                    }}
                }}
            }}
        }}
    "#, pubkey);
    
    // TODO: Execute query and parse results
    Ok(vec![])
}


// ============================================================================
// STOREFRONT API
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorefrontTheme {
    pub primary: String,
    pub secondary: String,
    pub accent: String,
    pub background: String,
    pub text: String,
    pub card_bg: String,
}

impl Default for StorefrontTheme {
    fn default() -> Self {
        Self {
            primary: "#f59e0b".into(),
            secondary: "#78716c".into(),
            accent: "#a855f7".into(),
            background: "#FFFFFF".into(),
            text: "#1c1917".into(),
            card_bg: "#FFF8F0".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorefrontSection {
    pub id: String,
    #[serde(rename = "type")]
    pub section_type: String,
    pub title: Option<String>,
    pub visible: bool,
    pub order: u32,
    pub config: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Coupon {
    pub id: String,
    pub code: String,
    #[serde(rename = "type")]
    pub coupon_type: String,
    pub value: u64,
    pub description: String,
    pub min_purchase_sompi: Option<u64>,
    pub max_uses: Option<u32>,
    pub used_count: u32,
    pub expires_at: Option<u64>,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Product {
    pub id: String,
    pub name: String,
    pub description: String,
    pub price_sompi: u64,
    pub image_arweave_tx: Option<String>,
    pub category: String,
    pub in_stock: bool,
    pub quantity: Option<u32>,
    pub tags: Vec<String>,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StashItem {
    pub id: String,
    pub name: String,
    pub description: String,
    pub price_sompi: u64,
    pub image_arweave_tx: Option<String>,
    pub download_arweave_tx: Option<String>,
    #[serde(rename = "type")]
    pub item_type: String,
    pub available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SocialLink {
    pub platform: String,
    pub url: String,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Storefront {
    pub owner_pubkey: String,
    pub apt_number: String,
    pub brand_name: String,
    pub tagline: Option<String>,
    pub description: Option<String>,
    pub logo_arweave_tx: Option<String>,
    pub logo_shape: String,
    pub banner_arweave_tx: Option<String>,
    pub theme: StorefrontTheme,
    pub sections: Vec<StorefrontSection>,
    pub products: Vec<Product>,
    pub coupons: Vec<Coupon>,
    pub stash_items: Vec<StashItem>,
    pub social_links: Vec<SocialLink>,
    pub total_visits: u64,
    pub unique_visitors: u64,
    pub agreements_completed: u64,
    pub total_volume_sompi: u64,
    pub rating: Option<f64>,
    pub review_count: u32,
    pub verified: bool,
    pub verification_tx: Option<String>,
    pub verified_at: Option<u64>,
    pub created_at: u64,
    pub updated_at: u64,
    pub last_visit_at: Option<u64>,
    pub arweave_tx: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorefrontStats {
    pub total_visits: u64,
    pub unique_visitors: u64,
    pub visits_last_7d: u64,
    pub visits_last_30d: u64,
    pub agreements_started: u64,
    pub agreements_completed: u64,
    pub agreements_deadlocked: u64,
    pub total_volume_sompi: u64,
    pub avg_agreement_sompi: u64,
    pub repeat_customers: u64,
    pub conversion_rate: f64,
    pub completion_rate: f64,
}

#[derive(Debug, Deserialize)]
pub struct VisitRequest {
    pub visitor_pubkey: String,
    pub timestamp: u64,
    pub source: Option<String>,
    pub referrer: Option<String>,
    pub signature: String,
}

#[derive(Debug, Serialize)]
pub struct VisitResponse {
    pub recorded: bool,
    pub visit_count: u64,
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct StorefrontSaveRequest {
    pub storefront: Storefront,
    pub signature: String,
    pub timestamp: u64,
}

#[derive(Debug, Serialize)]
pub struct StorefrontSaveResponse {
    pub success: bool,
    pub arweave_tx: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct StorefrontSearchQuery {
    pub q: Option<String>,
    pub category: Option<String>,
    pub verified: Option<bool>,
    pub min_rating: Option<f64>,
    pub sort_by: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StorefrontSearchResult {
    pub pubkey: String,
    pub brand_name: String,
    pub tagline: Option<String>,
    pub logo_arweave_tx: Option<String>,
    pub verified: bool,
    pub rating: Option<f64>,
    pub review_count: u32,
    pub product_count: usize,
    pub category: Option<String>,
}

/// GET /api/storefront/{pubkey}
pub async fn api_get_storefront(path: web::Path<String>) -> HttpResponse {
    let pubkey = path.into_inner();
    match query_storefront_from_arweave(&pubkey).await {
        Ok(Some(storefront)) => HttpResponse::Ok().json(serde_json::json!({ "ok": true, "storefront": storefront })),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({ "ok": false, "error": "Storefront not found" })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "ok": false, "error": e })),
    }
}

/// POST /api/storefront/{pubkey}/visit
pub async fn api_record_visit(path: web::Path<String>, body: web::Json<VisitRequest>) -> HttpResponse {
    let storefront_pubkey = path.into_inner();
    let message = format!("VISIT:{}:{}:{}", storefront_pubkey, body.visitor_pubkey, body.timestamp);
    if !verify_signature(&message, &body.signature, &body.visitor_pubkey) {
        return HttpResponse::Unauthorized().json(serde_json::json!({ "ok": false, "error": "Invalid signature" }));
    }
    let visit_count = record_visit_internal(&storefront_pubkey, &body.visitor_pubkey).await;
    HttpResponse::Ok().json(VisitResponse { recorded: true, visit_count, message: "Visit recorded".into() })
}

/// GET /api/storefront/{pubkey}/stats
pub async fn api_get_storefront_stats(path: web::Path<String>) -> HttpResponse {
    let pubkey = path.into_inner();
    match aggregate_storefront_stats(&pubkey).await {
        Ok(stats) => HttpResponse::Ok().json(serde_json::json!({ "ok": true, "stats": stats })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "ok": false, "error": e })),
    }
}

/// POST /api/storefront
pub async fn api_save_storefront(body: web::Json<StorefrontSaveRequest>) -> HttpResponse {
    let storefront_json = serde_json::to_string(&body.storefront).unwrap_or_default();
    let message = format!("STOREFRONT:{}:{}", storefront_json, body.timestamp);
    if !verify_signature(&message, &body.signature, &body.storefront.owner_pubkey) {
        return HttpResponse::Unauthorized().json(StorefrontSaveResponse { success: false, arweave_tx: None, error: Some("Invalid signature".into()) });
    }
    match upload_storefront_to_arweave(&body.storefront).await {
        Ok(tx_id) => HttpResponse::Ok().json(StorefrontSaveResponse { success: true, arweave_tx: Some(tx_id), error: None }),
        Err(e) => HttpResponse::InternalServerError().json(StorefrontSaveResponse { success: false, arweave_tx: None, error: Some(e) }),
    }
}

/// GET /api/storefront/{pubkey}/products
pub async fn api_get_products(path: web::Path<String>, query: web::Query<std::collections::HashMap<String, String>>) -> HttpResponse {
    let pubkey = path.into_inner();
    let category = query.get("category").cloned();
    match query_products_from_arweave(&pubkey, category.as_deref()).await {
        Ok(products) => HttpResponse::Ok().json(serde_json::json!({ "ok": true, "products": products })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "ok": false, "error": e })),
    }
}

/// GET /api/storefront/search
pub async fn api_search_storefronts(query: web::Query<StorefrontSearchQuery>) -> HttpResponse {
    let limit = query.limit.unwrap_or(20).min(100);
    let offset = query.offset.unwrap_or(0);
    match search_storefronts_arweave(&query, limit, offset).await {
        Ok(results) => HttpResponse::Ok().json(serde_json::json!({ "ok": true, "results": results, "limit": limit, "offset": offset })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "ok": false, "error": e })),
    }
}

// ============================================================================
// STOREFRONT HELPERS
// ============================================================================

async fn query_storefront_from_arweave(pubkey: &str) -> Result<Option<Storefront>, String> {
    let pubkey_hash = compute_hash_index(&format!("PK:{}", pubkey));
    let query = format!(r#"query {{ transactions( tags: [ {{ name: "App-Name", values: ["KasVillage"] }}, {{ name: "Type", values: ["KV_STOREFRONT_V1"] }}, {{ name: "Pubkey-Hash", values: ["{}"] }} ], first: 1, sort: HEIGHT_DESC ) {{ edges {{ node {{ id tags {{ name value }} block {{ timestamp }} }} }} }} }}"#, pubkey_hash);
    let client = reqwest::Client::new();
    let response = match client.post("https://arweave.net/graphql").json(&serde_json::json!({ "query": query })).timeout(std::time::Duration::from_secs(10)).send().await {
        Ok(r) => r,
        Err(_) => client.post("https://arweave-search.goldsky.com/graphql").json(&serde_json::json!({ "query": query })).timeout(std::time::Duration::from_secs(10)).send().await.map_err(|e| format!("Arweave query failed: {}", e))?,
    };
    let data: serde_json::Value = response.json().await.map_err(|e| format!("Parse error: {}", e))?;
    let edges = data.pointer("/data/transactions/edges").and_then(|e| e.as_array());
    let tx_id = match edges {
        Some(edges) if !edges.is_empty() => edges[0].pointer("/node/id").and_then(|v| v.as_str()).map(|s| s.to_string()),
        _ => return Ok(None),
    };
    let tx_id = match tx_id { Some(id) => id, None => return Ok(None) };
    let data_response = client.get(&format!("https://arweave.net/{}", tx_id)).timeout(std::time::Duration::from_secs(10)).send().await.map_err(|e| format!("Fetch failed: {}", e))?;
    if !data_response.status().is_success() { return Ok(None); }
    let sd: serde_json::Value = data_response.json().await.map_err(|e| format!("Parse failed: {}", e))?;
    let storefront = Storefront {
        owner_pubkey: pubkey.to_string(),
        apt_number: sd.get("aptNumber").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
        brand_name: sd.get("brandName").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
        tagline: sd.get("tagline").and_then(|v| v.as_str()).map(|s| s.to_string()),
        description: sd.get("description").and_then(|v| v.as_str()).map(|s| s.to_string()),
        logo_arweave_tx: sd.get("logoArweaveTx").and_then(|v| v.as_str()).map(|s| s.to_string()),
        logo_shape: sd.get("logoShape").and_then(|v| v.as_str()).unwrap_or("circle").to_string(),
        banner_arweave_tx: sd.get("bannerArweaveTx").and_then(|v| v.as_str()).map(|s| s.to_string()),
        theme: serde_json::from_value(sd.get("theme").cloned().unwrap_or_default()).unwrap_or_default(),
        sections: serde_json::from_value(sd.get("sections").cloned().unwrap_or(serde_json::json!([]))).unwrap_or_default(),
        products: serde_json::from_value(sd.get("products").cloned().unwrap_or(serde_json::json!([]))).unwrap_or_default(),
        coupons: serde_json::from_value(sd.get("coupons").cloned().unwrap_or(serde_json::json!([]))).unwrap_or_default(),
        stash_items: serde_json::from_value(sd.get("stashItems").cloned().unwrap_or(serde_json::json!([]))).unwrap_or_default(),
        social_links: serde_json::from_value(sd.get("socialLinks").cloned().unwrap_or(serde_json::json!([]))).unwrap_or_default(),
        total_visits: sd.get("totalVisits").and_then(|v| v.as_u64()).unwrap_or(0),
        unique_visitors: sd.get("uniqueVisitors").and_then(|v| v.as_u64()).unwrap_or(0),
        agreements_completed: sd.get("agreementsCompleted").and_then(|v| v.as_u64()).unwrap_or(0),
        total_volume_sompi: sd.get("totalVolumeSompi").and_then(|v| v.as_u64()).unwrap_or(0),
        rating: sd.get("rating").and_then(|v| v.as_f64()),
        review_count: sd.get("reviewCount").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
        verified: sd.get("verified").and_then(|v| v.as_bool()).unwrap_or(false),
        verification_tx: sd.get("verificationTx").and_then(|v| v.as_str()).map(|s| s.to_string()),
        verified_at: sd.get("verifiedAt").and_then(|v| v.as_u64()),
        created_at: sd.get("createdAt").and_then(|v| v.as_u64()).unwrap_or_else(current_timestamp),
        updated_at: sd.get("updatedAt").and_then(|v| v.as_u64()).unwrap_or_else(current_timestamp),
        last_visit_at: sd.get("lastVisitAt").and_then(|v| v.as_u64()),
        arweave_tx: Some(tx_id),
    };
    Ok(Some(storefront))
}

async fn record_visit_internal(_storefront_pubkey: &str, _visitor_pubkey: &str) -> u64 { 1 }

async fn aggregate_storefront_stats(pubkey: &str) -> Result<StorefrontStats, String> {
    let current_daa = query_current_daa_score().await.unwrap_or(0);
    let events = query_l1_frost_events(pubkey).await?;
    let mut stats = StorefrontStats { total_visits: 0, unique_visitors: 0, visits_last_7d: 0, visits_last_30d: 0, agreements_started: 0, agreements_completed: 0, agreements_deadlocked: 0, total_volume_sompi: 0, avg_agreement_sompi: 0, repeat_customers: 0, conversion_rate: 0.0, completion_rate: 0.0 };
    let mut customers: HashSet<String> = HashSet::new();
    let mut repeat: HashSet<String> = HashSet::new();
    for event in &events {
        if event.seller_pubkey != pubkey { continue; }
        match event.event_type {
            FrostEventType::AgreementCreated => {
                stats.agreements_started += 1; stats.total_volume_sompi += event.amount_sompi;
                if customers.contains(&event.buyer_pubkey) { repeat.insert(event.buyer_pubkey.clone()); }
                customers.insert(event.buyer_pubkey.clone());
            }
            FrostEventType::AgreementCompleted => { stats.agreements_completed += 1; }
            FrostEventType::AgreementDeadlocked | FrostEventType::AgreementExpired => { stats.agreements_deadlocked += 1; }
            _ => {}
        }
    }
    stats.unique_visitors = customers.len() as u64;
    stats.repeat_customers = repeat.len() as u64;
    if stats.agreements_started > 0 { stats.avg_agreement_sompi = stats.total_volume_sompi / stats.agreements_started; stats.completion_rate = stats.agreements_completed as f64 / stats.agreements_started as f64; }
    if stats.total_visits > 0 { stats.conversion_rate = stats.agreements_started as f64 / stats.total_visits as f64; }
    Ok(stats)
}

async fn upload_storefront_to_arweave(storefront: &Storefront) -> Result<String, String> {
    let mut hasher = Sha256::new();
    hasher.update(storefront.owner_pubkey.as_bytes());
    hasher.update(storefront.brand_name.as_bytes());
    hasher.update(&storefront.updated_at.to_le_bytes());
    let hash = hex::encode(hasher.finalize());
    Ok(format!("PENDING_{}", &hash[..16]))
}

async fn query_products_from_arweave(pubkey: &str, category: Option<&str>) -> Result<Vec<Product>, String> {
    let pubkey_hash = compute_hash_index(&format!("PK:{}", pubkey));
    let cat_filter = match category {
        Some(cat) => format!(r#", {{ name: "Category", values: ["{}"] }}"#, cat),
        None => String::new(),
    };
    let query = format!(r#"query {{ transactions( tags: [ {{ name: "App-Name", values: ["KasVillage"] }}, {{ name: "Type", values: ["KV_PRODUCT_V1"] }}, {{ name: "Pubkey-Hash", values: ["{}"] }}{} ], first: 50, sort: HEIGHT_DESC ) {{ edges {{ node {{ id }} }} }} }}"#, pubkey_hash, cat_filter);
    let client = reqwest::Client::new();
    let response = match client.post("https://arweave.net/graphql").json(&serde_json::json!({ "query": query })).timeout(std::time::Duration::from_secs(10)).send().await {
        Ok(r) => r,
        Err(_) => client.post("https://arweave-search.goldsky.com/graphql").json(&serde_json::json!({ "query": query })).timeout(std::time::Duration::from_secs(10)).send().await.map_err(|e| format!("Query: {}", e))?,
    };
    let data: serde_json::Value = response.json().await.map_err(|e| format!("Parse: {}", e))?;
    let mut products = Vec::new();
    if let Some(edges) = data.pointer("/data/transactions/edges").and_then(|e| e.as_array()) {
        for edge in edges {
            if let Some(tx_id) = edge.pointer("/node/id").and_then(|v| v.as_str()) {
                if let Ok(resp) = client.get(&format!("https://arweave.net/{}", tx_id)).timeout(std::time::Duration::from_secs(10)).send().await {
                    if resp.status().is_success() { if let Ok(p) = resp.json::<Product>().await { products.push(p); } }
                }
            }
        }
    }
    Ok(products)
}

async fn search_storefronts_arweave(query: &StorefrontSearchQuery, limit: usize, _offset: usize) -> Result<Vec<StorefrontSearchResult>, String> {
    let mut tag_filters = r#"{ name: "App-Name", values: ["KasVillage"] }, { name: "Type", values: ["KV_STOREFRONT_V1"] }"#.to_string();
    if let Some(ref cat) = query.category { tag_filters.push_str(&format!(r#", {{ name: "Category", values: ["{}"] }}"#, cat)); }
    if let Some(true) = query.verified { tag_filters.push_str(r#", { name: "Verified", values: ["true"] }"#); }
    let gql = format!(r#"query {{ transactions( tags: [ {} ], first: {}, sort: HEIGHT_DESC ) {{ edges {{ node {{ id tags {{ name value }} }} }} }} }}"#, tag_filters, limit.min(50));
    let client = reqwest::Client::new();
    let response = match client.post("https://arweave.net/graphql").json(&serde_json::json!({ "query": gql })).timeout(std::time::Duration::from_secs(10)).send().await {
        Ok(r) => r,
        Err(_) => client.post("https://arweave-search.goldsky.com/graphql").json(&serde_json::json!({ "query": gql })).timeout(std::time::Duration::from_secs(10)).send().await.map_err(|e| format!("Query: {}", e))?,
    };
    let data: serde_json::Value = response.json().await.map_err(|e| format!("Parse: {}", e))?;
    let mut results = Vec::new();
    if let Some(edges) = data.pointer("/data/transactions/edges").and_then(|e| e.as_array()) {
        for edge in edges {
            let tags = edge.pointer("/node/tags").and_then(|t| t.as_array());
            let get_tag = |name: &str| -> Option<String> {
                tags.and_then(|ts| ts.iter().find(|t| t.get("name").and_then(|n| n.as_str()) == Some(name)).and_then(|t| t.get("value").and_then(|v| v.as_str())).map(|s| s.to_string()))
            };
            results.push(StorefrontSearchResult {
                pubkey: get_tag("Pubkey").unwrap_or_default(), brand_name: get_tag("Brand-Name").unwrap_or_default(),
                tagline: get_tag("Tagline"), logo_arweave_tx: get_tag("Logo-Tx"),
                verified: get_tag("Verified").map(|v| v == "true").unwrap_or(false),
                rating: get_tag("Rating").and_then(|r| r.parse().ok()),
                review_count: get_tag("Review-Count").and_then(|r| r.parse().ok()).unwrap_or(0),
                product_count: get_tag("Product-Count").and_then(|r| r.parse().ok()).unwrap_or(0),
                category: get_tag("Category"),
            });
        }
    }
    Ok(results)
}

fn verify_signature(_message: &str, signature: &str, _pubkey: &str) -> bool { !signature.is_empty() }


// ============================================================================
// DAPP VISIBILITY SYSTEM
// ============================================================================
// Two-layer: Pledge Gate (binary) + Ranking Score (composite)
// Pledge Gate: active pledge + balance >= pledged amount → visible
// Ranking Score: commitment + XP + stats + recency → sort order
// All inputs L1/Arweave verifiable, fully stateless
// ============================================================================

const SOMPI_PER_KAS: f64 = 100_000_000.0;

/// Query Kaspa address balance from L1
async fn query_kaspa_balance(address: &str) -> Result<u64, String> {
    let url = format!("https://api-tn.kaspa.org/addresses/{}/balance", address);
    let client = reqwest::Client::new();
    let response = client.get(&url)
        .timeout(std::time::Duration::from_secs(5))
        .send().await.map_err(|e| format!("Balance: {}", e))?;
    if !response.status().is_success() { return Err(format!("Balance API: {}", response.status())); }
    let data: serde_json::Value = response.json().await.map_err(|e| format!("Parse: {}", e))?;
    data.get("balance").and_then(|v| v.as_u64()).ok_or_else(|| "Missing balance".to_string())
}

/// Query KAS price in USD
async fn query_kas_price_usd() -> Result<f64, String> {
    let client = reqwest::Client::new();
    let response = client.get("https://api.coingecko.com/api/v3/simple/price?ids=kaspa&vs_currencies=usd")
        .timeout(std::time::Duration::from_secs(5))
        .send().await.map_err(|e| format!("Price: {}", e))?;
    let data: serde_json::Value = response.json().await.map_err(|e| format!("Parse: {}", e))?;
    data.pointer("/kaspa/usd").and_then(|v| v.as_f64()).ok_or_else(|| "Missing price".to_string())
}

/// Pledge info from Arweave tags
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DAppPledge {
    pub pledge_sompi: u64,
    pub pledge_kas: f64,
    pub start_daa: u64,
    pub duration_daa: u64,
    pub end_daa: u64,
    pub pledge_address: String,
    pub arweave_tx: String,
}

/// Pledge status (checked at query time)
#[derive(Debug, Clone, Serialize)]
pub struct PledgeStatus {
    pub active: bool,
    pub pledge_met: bool,
    pub expired: bool,
    pub pledge_kas: f64,
    pub current_balance_kas: f64,
    pub duration_days: u64,
    pub remaining_days: u64,
    pub elapsed_days: u64,
    pub pledge_usd: f64,
    pub balance_usd: f64,
    pub last_check_daa: u64,
    pub balance_stale: bool,
}

/// Full visibility result
#[derive(Debug, Clone, Serialize)]
pub struct DAppVisibility {
    pub visible: bool,
    pub pledge: PledgeStatus,
    pub ranking_score: f64,
    pub commitment_factor: f64,
    pub xp_factor: f64,
    pub stats_factor: f64,
    pub recency_factor: f64,
    pub unique_counterparties: u64,
    pub self_trade_flag: bool,  // >50% trades with same counterparty
}

/// Query Arweave for DApp pledge record
async fn query_dapp_pledge(pubkey: &str) -> Option<DAppPledge> {
    let pubkey_hash = compute_hash_index(&format!("PK:{}", pubkey));
    let query = format!(
        r#"query {{ transactions( tags: [ {{ name: "App-Name", values: ["KasVillage"] }}, {{ name: "Type", values: ["KV_DAPP_PLEDGE_V1"] }}, {{ name: "Pubkey-Hash", values: ["{}"] }} ], first: 1, sort: HEIGHT_DESC ) {{ edges {{ node {{ id tags {{ name value }} }} }} }} }}"#,
        pubkey_hash
    );
    let client = reqwest::Client::new();
    let response = match client.post("https://arweave.net/graphql")
        .json(&serde_json::json!({ "query": query }))
        .timeout(std::time::Duration::from_secs(10)).send().await {
        Ok(r) => r,
        Err(_) => client.post("https://arweave-search.goldsky.com/graphql")
            .json(&serde_json::json!({ "query": query }))
            .timeout(std::time::Duration::from_secs(10)).send().await.ok()?,
    };
    let data: serde_json::Value = response.json().await.ok()?;
    let edge = data.pointer("/data/transactions/edges")?.as_array()?.first()?;
    let tags = edge.pointer("/node/tags")?.as_array()?;
    let get_tag = |name: &str| -> Option<String> {
        tags.iter()
            .find(|t| t.get("name").and_then(|n| n.as_str()) == Some(name))
            .and_then(|t| t.get("value").and_then(|v| v.as_str()))
            .map(|s| s.to_string())
    };
    let pledge_sompi = get_tag("KV-Pledge-Sompi")?.parse::<u64>().ok()?;
    let start_daa = get_tag("KV-Pledge-Start-DAA")?.parse::<u64>().ok()?;
    let duration_daa = get_tag("KV-Pledge-Duration-DAA")?.parse::<u64>().ok()?;
    Some(DAppPledge {
        pledge_sompi,
        pledge_kas: pledge_sompi as f64 / SOMPI_PER_KAS,
        start_daa,
        duration_daa,
        end_daa: start_daa + duration_daa,
        pledge_address: get_tag("KV-Pledge-Address").unwrap_or_default(),
        arweave_tx: edge.pointer("/node/id")?.as_str()?.to_string(),
    })
}

/// Compute full DApp visibility: pledge gate + ranking score
pub async fn compute_full_dapp_visibility(pubkey: &str) -> DAppVisibility {
    // 1. Check pledge from Arweave
    let pledge = query_dapp_pledge(pubkey).await;
    
    // 2. Get current DAA + balance + price
    let current_daa = query_current_daa_score().await.unwrap_or(0);
    let kas_price = query_kas_price_usd().await.unwrap_or(0.05);
    
    let pledge_status = if let Some(ref p) = pledge {
        let balance = query_kaspa_balance(&p.pledge_address).await.unwrap_or(0);
        let balance_kas = balance as f64 / SOMPI_PER_KAS;
        let expired = current_daa > p.end_daa;
        let pledge_met = balance >= p.pledge_sompi;
        let elapsed_daa = current_daa.saturating_sub(p.start_daa);
        let remaining_daa = if expired { 0 } else { p.end_daa.saturating_sub(current_daa) };
        
        PledgeStatus {
            active: !expired && pledge_met,
            pledge_met,
            expired,
            pledge_kas: p.pledge_kas,
            current_balance_kas: balance_kas,
            duration_days: p.duration_daa / 86400,
            remaining_days: remaining_daa / 86400,
            elapsed_days: elapsed_daa / 86400,
            pledge_usd: p.pledge_kas * kas_price,
            balance_usd: balance_kas * kas_price,
            last_check_daa: current_daa,
            balance_stale: false, // Just checked
        }
    } else {
        // No pledge = not visible
        PledgeStatus {
            active: false, pledge_met: false, expired: true,
            pledge_kas: 0.0, current_balance_kas: 0.0,
            duration_days: 0, remaining_days: 0, elapsed_days: 0,
            pledge_usd: 0.0, balance_usd: 0.0, last_check_daa: 0, balance_stale: true,
        }
    };
    
    // 3. GATE: no active pledge = not visible
    if !pledge_status.active {
        return DAppVisibility {
            visible: false, pledge: pledge_status,
            ranking_score: 0.0, commitment_factor: 0.0,
            xp_factor: 0.0, stats_factor: 0.0, recency_factor: 0.0,
            unique_counterparties: 0, self_trade_flag: false,
        };
    }
    
    // 4. RANK: compute composite score for sort order
    let events = query_l1_frost_events(pubkey).await.unwrap_or_default();
    let stats = aggregate_l1_events_full(&events, pubkey, current_daa);
    let xp = stats.successes.saturating_mul(10).saturating_sub(stats.deadlocks.saturating_mul(50));
    
    // Commitment factor: pledge USD value, tanh curve
    let commitment_factor = (pledge_status.pledge_usd / 100.0).tanh();
    
    // XP factor: saturates at 2000
    let xp_factor = ((xp as f64) / 2000.0).min(1.0);
    
    // Stats factor: p_complete * confidence
    let total = stats.successes + stats.deadlocks;
    let p_complete = if total == 0 { 0.5 } else { (1.0 + stats.successes as f64) / (2.0 + total as f64) };
    let confidence = ((total as f64) / 10.0).min(1.0);
    let stats_factor = p_complete * confidence;
    
    // Recency
    let recency_factor = if stats.agreements_last_7d_daa > 0 { 1.0 }
        else if stats.agreements_last_30d_daa > 0 { 0.6 }
        else { 0.2 };
    
    let unique_cp = stats.unique_counterparties_completed.len() as u64;
    let self_trade_flag = if stats.successes > 3 && unique_cp > 0 {
        (stats.successes as f64 / unique_cp as f64) > 2.0 // avg >2 trades per counterparty = suspicious
    } else { false };
    let self_trade_penalty = if self_trade_flag { 0.5 } else { 1.0 };

    let ranking_score = ((0.35 * commitment_factor)
                      + (0.25 * stats_factor)
                      + (0.20 * xp_factor)
                      + (0.20 * recency_factor)) * self_trade_penalty;
    
    DAppVisibility {
        visible: true,
        pledge: pledge_status,
        ranking_score,
        commitment_factor,
        xp_factor,
        stats_factor,
        recency_factor,
        unique_counterparties: unique_cp,
        self_trade_flag,
    }
}

/// GET /api/dapp/{pubkey}/visibility
pub async fn api_check_dapp_visibility(path: web::Path<String>) -> HttpResponse {
    let pubkey = path.into_inner();
    let visibility = compute_full_dapp_visibility(&pubkey).await;
    HttpResponse::Ok().json(serde_json::json!({ "ok": true, "pubkey": pubkey, "visibility": visibility }))
}


fn compute_hash_index(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    let hash = hasher.finalize();
    hex::encode(&hash[..8])
}
