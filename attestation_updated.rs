// ============================================================================
// DEVICE ATTESTATION - No Apple/Google Store dependency
// ============================================================================
// Stack: Jitter ZK Commitment + Device Fingerprint + Biometric + Timing
// Privacy: Only blind commitments reach TownHall, no raw biometrics/rhythm
// ============================================================================

use serde::{Deserialize, Serialize};

// ============================================================================
// STRUCTS
// ============================================================================

/// Replaces old DeviceAttestation that relied on attestation_blob from Apple/Google
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DeviceAttestation {
    /// "ios" | "android" | "web"
    pub platform: String,
    /// SHA256-truncated device fingerprint (brand:model:os:appId)
    pub device_hash: String,
    /// Poseidon(pass_flag=1, salt) — blind commitment, server can't reverse
    pub jitter_commitment: String,
    /// Salt for ZK proof (hex Fq) — used once for proof gen, then discarded
    pub jitter_salt: Option<String>,
    /// Did biometric gate pass on device (FaceID/TouchID/fingerprint)
    pub biometric_passed: bool,
    /// SHA256 of all timing metrics (phase durations, keystroke/tap counts)
    pub timing_hash: String,
    /// Device.isDevice — false = emulator
    pub is_real_device: bool,
    /// Basic root/jailbreak heuristic result
    pub is_rooted: bool,
    /// Server-generated challenge nonce (replay prevention)
    pub nonce: String,
    /// Unix ms
    pub timestamp: u64,
    /// Quiz score ratio 0.0-1.0
    pub quiz_score: f64,
    /// Hashes of questions asked (proves which questions, not answers)
    pub question_hashes: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AttestationResult {
    pub valid: bool,
    pub platform: String,
    pub hash: String,
    pub score: u8,           // 0-100 composite
    pub flags: Vec<String>,  // failure reasons
    pub error: Option<String>,
}

// ============================================================================
// VERIFICATION
// ============================================================================

/// Staleness window: 5 minutes
const MAX_ATTESTATION_AGE_MS: u64 = 5 * 60 * 1000;
/// Minimum quiz pass ratio
const MIN_QUIZ_RATIO: f64 = 0.8;

pub fn verify_attestation(att: &DeviceAttestation) -> AttestationResult {
    let mut flags: Vec<String> = Vec::new();
    let mut score: u8 = 0;

    // ── 1. Jitter commitment must be present ──
    if att.jitter_commitment.is_empty() {
        flags.push("missing_jitter_commitment".into());
    } else {
        score += 30;
    }

    // ── 2. Biometric must have passed ──
    if !att.biometric_passed {
        flags.push("biometric_failed".into());
    } else {
        score += 20;
    }

    // ── 3. Timing hash must be present ──
    if att.timing_hash.is_empty() {
        flags.push("missing_timing_hash".into());
    } else {
        score += 15;
    }

    // ── 4. Real device check ──
    if !att.is_real_device {
        flags.push("emulator_detected".into());
    } else {
        score += 10;
    }

    // ── 5. Root check ──
    if att.is_rooted {
        flags.push("root_detected".into());
    } else {
        score += 5;
    }

    // ── 6. Quiz score ──
    if att.quiz_score < MIN_QUIZ_RATIO {
        flags.push("quiz_failed".into());
    } else {
        score += 15;
    }

    // ── 7. Timestamp freshness ──
    let now = current_timestamp();
    if att.timestamp == 0 || now.saturating_sub(att.timestamp) > MAX_ATTESTATION_AGE_MS {
        flags.push("attestation_stale".into());
    } else {
        score += 5;
    }

    // ── 8. Device hash present ──
    if att.device_hash.is_empty() {
        flags.push("missing_device_hash".into());
    }

    // Valid = no critical flags (jitter + biometric + timing all present + quiz passed)
    let critical_flags = ["missing_jitter_commitment", "biometric_failed", "missing_timing_hash", "quiz_failed"];
    let has_critical = flags.iter().any(|f| critical_flags.contains(&f.as_str()));
    let valid = !has_critical;

    let hash = hex::encode(&sha256_hash(
        format!("{}:{}:{}", att.jitter_commitment, att.timing_hash, att.device_hash).as_bytes()
    )[..16]);

    AttestationResult {
        valid,
        platform: att.platform.clone(),
        hash,
        score,
        flags: flags.clone(),
        error: if valid { None } else { Some(flags.join(", ")) },
    }
}

// ============================================================================
// FULL USER VERIFICATION (updated signature — drop-in replacement)
// ============================================================================

pub fn verify_user_full(
    stats: &UserStatsL1,
    traits: &CitadelTraits,
    attestation: &DeviceAttestation,
) -> FullUserVerification {
    let att_result = verify_attestation(attestation);
    let snail = SnailModeStatus::from_stats_l1(stats);
    let proof = generate_user_proof(stats, traits);

    let can_buy = traits.can_buy();
    let can_sell = traits.can_sell() && stats.meets_criteria();
    let verified_passport = can_sell && att_result.valid;

    let access_level = if traits.count() < 9 {
        "GUEST"
    } else if traits.count() < 13 {
        "RESIDENT"
    } else if !verified_passport {
        "PASSPORT_ELIGIBLE"
    } else {
        "VERIFIED_PASSPORT"
    };

    FullUserVerification {
        apt: stats.pubkey_hash.clone(),
        stats: stats.clone(),
        traits: traits.clone(),
        snail_mode: snail,
        attestation: att_result,
        access_level: access_level.into(),
        can_buy,
        can_sell,
        search_visible: att_result.valid,
        proof,
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn make_valid_attestation() -> DeviceAttestation {
        DeviceAttestation {
            platform: "android".into(),
            device_hash: "abc123def456".into(),
            jitter_commitment: "0x1a2b3c4d5e6f".into(),
            jitter_salt: None, // salt not sent to server in normal flow
            biometric_passed: true,
            timing_hash: "deadbeef01234567".into(),
            is_real_device: true,
            is_rooted: false,
            nonce: "server_nonce_123".into(),
            timestamp: current_timestamp(),
            quiz_score: 0.8,
            question_hashes: vec!["h1".into(), "h2".into()],
        }
    }

    #[test]
    fn test_valid_attestation() {
        let att = make_valid_attestation();
        let result = verify_attestation(&att);
        assert!(result.valid);
        assert_eq!(result.score, 100);
        assert!(result.flags.is_empty());
    }

    #[test]
    fn test_missing_jitter() {
        let mut att = make_valid_attestation();
        att.jitter_commitment = "".into();
        let result = verify_attestation(&att);
        assert!(!result.valid); // critical flag
    }

    #[test]
    fn test_biometric_failed() {
        let mut att = make_valid_attestation();
        att.biometric_passed = false;
        let result = verify_attestation(&att);
        assert!(!result.valid); // critical flag
    }

    #[test]
    fn test_emulator_still_valid() {
        let mut att = make_valid_attestation();
        att.is_real_device = false;
        let result = verify_attestation(&att);
        // emulator is non-critical — valid but lower score
        assert!(result.valid);
        assert!(result.score < 100);
        assert!(result.flags.contains(&"emulator_detected".to_string()));
    }

    #[test]
    fn test_quiz_failed() {
        let mut att = make_valid_attestation();
        att.quiz_score = 0.3;
        let result = verify_attestation(&att);
        assert!(!result.valid); // critical flag
    }

    #[test]
    fn test_stale_timestamp() {
        let mut att = make_valid_attestation();
        att.timestamp = 1000; // ancient
        let result = verify_attestation(&att);
        // stale is non-critical
        assert!(result.valid);
        assert!(result.flags.contains(&"attestation_stale".to_string()));
    }
}
