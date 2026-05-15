// ============================================================================
// KASVILLAGE CANONICAL AVATAR SCHEMA - Rust (Town Hall)
// ============================================================================
// Version: 3
// Fields: 18 (alphabetically sorted for deterministic hashing)
// Thresholds: 9 traits = Buyer (Resident), 13 traits = Seller (Passport)
// 
// CRITICAL: Field order MUST match TypeScript exactly for hash compatibility
// ============================================================================

use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};

// ============================================================================
// SCHEMA VERSION
// ============================================================================
pub const AVATAR_SCHEMA_VERSION: u32 = 3;

// ============================================================================
// CANONICAL FIELD ORDER (ALPHABETICAL)
// ============================================================================
pub const CANONICAL_AVATAR_FIELDS: &[&str] = &[
    "animal",
    "class",
    "combatStyle",
    "definingMoment",
    "formativeMemory",
    "lifePhilosophy",
    "loreOrigin",
    "mutant",
    "mutate",
    "name",
    "occupation",
    "originStory",
    "personality",
    "powerSpike",
    "race",
    "signatureMove",
    "voiceLine",
    "weakness",
];

// ============================================================================
// CITADEL THRESHOLDS
// ============================================================================
pub const CITADEL_BUYER_THRESHOLD: u8 = 9;
pub const CITADEL_SELLER_THRESHOLD: u8 = 13;

pub const BUYER_TRAITS: &[&str] = &[
    "class", "race", "occupation", "mutant", "animal",
    "mutate", "personality", "combatStyle", "signatureMove"
];

pub const SELLER_EXTRA_TRAITS: &[&str] = &[
    "weakness", "powerSpike", "voiceLine", "loreOrigin"
];

pub const BACKSTORY_TRAITS: &[&str] = &[
    "originStory", "formativeMemory", "lifePhilosophy", "definingMoment"
];

// ============================================================================
// CANONICAL AVATAR STRUCT
// ============================================================================
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CanonicalAvatar {
    pub animal: String,
    pub class: String,
    pub combat_style: String,
    pub defining_moment: String,
    pub formative_memory: String,
    pub life_philosophy: String,
    pub lore_origin: String,
    pub mutant: String,
    pub mutate: String,
    pub name: String,
    pub occupation: String,
    pub origin_story: String,
    pub personality: String,
    pub power_spike: String,
    pub race: String,
    pub signature_move: String,
    pub voice_line: String,
    pub weakness: String,
}

impl CanonicalAvatar {
    pub fn new() -> Self {
        Self::default()
    }

    /// Serialize to canonical JSON (alphabetical field order, lowercase values)
    pub fn serialize_canonical(&self) -> String {
        // Build JSON manually to ensure exact field order
        let fields = [
            ("animal", &self.animal),
            ("class", &self.class),
            ("combatStyle", &self.combat_style),
            ("definingMoment", &self.defining_moment),
            ("formativeMemory", &self.formative_memory),
            ("lifePhilosophy", &self.life_philosophy),
            ("loreOrigin", &self.lore_origin),
            ("mutant", &self.mutant),
            ("mutate", &self.mutate),
            ("name", &self.name),
            ("occupation", &self.occupation),
            ("originStory", &self.origin_story),
            ("personality", &self.personality),
            ("powerSpike", &self.power_spike),
            ("race", &self.race),
            ("signatureMove", &self.signature_move),
            ("voiceLine", &self.voice_line),
            ("weakness", &self.weakness),
        ];

        let pairs: Vec<String> = fields
            .iter()
            .map(|(k, v)| format!("\"{}\":\"{}\"", k, v.trim().to_lowercase()))
            .collect();

        format!("{{{}}}", pairs.join(","))
    }

    /// Generate identity hash (SHA-256)
    pub fn identity_hash(&self) -> [u8; 32] {
        let serialized = self.serialize_canonical();
        let versioned = format!("KV_AVATAR_V{}:{}", AVATAR_SCHEMA_VERSION, serialized);
        
        let mut hasher = Sha256::new();
        hasher.update(versioned.as_bytes());
        hasher.finalize().into()
    }

    /// Generate identity hash as hex string
    pub fn identity_hash_hex(&self) -> String {
        hex::encode(self.identity_hash())
    }

    /// Count filled traits
    pub fn count_traits(&self) -> u8 {
        let fields = [
            &self.animal, &self.class, &self.combat_style, &self.defining_moment,
            &self.formative_memory, &self.life_philosophy, &self.lore_origin,
            &self.mutant, &self.mutate, &self.name, &self.occupation,
            &self.origin_story, &self.personality, &self.power_spike,
            &self.race, &self.signature_move, &self.voice_line, &self.weakness,
        ];
        
        fields.iter().filter(|f| f.trim().len() >= 2).count() as u8
    }

    /// Count buyer traits (first 9)
    pub fn count_buyer_traits(&self) -> u8 {
        let buyer_fields = [
            &self.class, &self.race, &self.occupation, &self.mutant, &self.animal,
            &self.mutate, &self.personality, &self.combat_style, &self.signature_move,
        ];
        
        buyer_fields.iter().filter(|f| f.trim().len() >= 2).count() as u8
    }

    /// Count seller traits (buyer + 4 extra)
    pub fn count_seller_traits(&self) -> u8 {
        let extra_fields = [
            &self.weakness, &self.power_spike, &self.voice_line, &self.lore_origin,
        ];
        
        let extra = extra_fields.iter().filter(|f| f.trim().len() >= 2).count() as u8;
        self.count_buyer_traits() + extra
    }

    /// Get Citadel tier
    pub fn citadel_tier(&self) -> CitadelTier {
        let traits = self.count_seller_traits();
        if traits >= CITADEL_SELLER_THRESHOLD {
            CitadelTier::Passport
        } else if traits >= CITADEL_BUYER_THRESHOLD {
            CitadelTier::Resident
        } else {
            CitadelTier::Guest
        }
    }

    pub fn can_buy(&self) -> bool {
        self.count_seller_traits() >= CITADEL_BUYER_THRESHOLD
    }

    pub fn can_sell(&self) -> bool {
        self.count_seller_traits() >= CITADEL_SELLER_THRESHOLD
    }
}

// ============================================================================
// CITADEL TIER
// ============================================================================
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum CitadelTier {
    Guest,
    Resident,
    Passport,
}

impl CitadelTier {
    pub fn as_str(&self) -> &'static str {
        match self {
            CitadelTier::Guest => "Guest",
            CitadelTier::Resident => "Resident",
            CitadelTier::Passport => "Passport",
        }
    }
}

// ============================================================================
// USER COMPLETION STATS (Bayesian)
// ============================================================================
pub const SNAIL_MODE_XP_THRESHOLD: u64 = 150;
pub const SNAIL_MODE_P_COMPLETE_THRESHOLD: f64 = 0.5;
pub const SNAIL_MODE_MIN_SAMPLES: u64 = 3;
pub const SNAIL_MODE_BASE_DELAY_MS: u64 = 60_000;
pub const SNAIL_MODE_MAX_DELAY_MS: u64 = 600_000;
pub const SNAIL_MODE_DELAY_PER_DEADLOCK: u64 = 60_000;
pub const DEFAULT_STARTING_XP: u64 = 150;

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct UserCompletionStats {
    pub successes: u64,
    pub deadlocks: u64,
    pub xp: u64,
    pub total_samples: u64,
}

impl UserCompletionStats {
    pub fn new() -> Self {
        Self {
            successes: 0,
            deadlocks: 0,
            xp: DEFAULT_STARTING_XP,
            total_samples: 0,
        }
    }

    /// Bayesian: p_complete = (1 + S) / (2 + S + F)
    pub fn p_complete(&self) -> f64 {
        let alpha = 1.0 + self.successes as f64;
        let beta = 1.0 + self.deadlocks as f64;
        alpha / (alpha + beta)
    }

    pub fn confidence(&self) -> f64 {
        (self.total_samples as f64 / 10.0).min(1.0)
    }

    pub fn is_new_user(&self) -> bool {
        self.total_samples < SNAIL_MODE_MIN_SAMPLES
    }

    pub fn should_snail_mode(&self) -> bool {
        if self.is_new_user() {
            return false;
        }
        if self.xp < SNAIL_MODE_XP_THRESHOLD {
            return true;
        }
        if self.p_complete() < SNAIL_MODE_P_COMPLETE_THRESHOLD {
            return true;
        }
        false
    }

    pub fn creation_delay_ms(&self) -> u64 {
        if !self.should_snail_mode() {
            return 0;
        }
        let delay = SNAIL_MODE_BASE_DELAY_MS + (self.deadlocks * SNAIL_MODE_DELAY_PER_DEADLOCK);
        delay.min(SNAIL_MODE_MAX_DELAY_MS)
    }

    pub fn risk_rating(&self) -> RiskRating {
        let p = self.p_complete();
        let conf = self.confidence();
        
        if p > 0.9 && conf > 0.5 {
            RiskRating::HighlyTrusted
        } else if p > 0.75 {
            RiskRating::Reliable
        } else if p < 0.4 {
            RiskRating::HighRisk
        } else {
            RiskRating::MediumRisk
        }
    }

    pub fn trust_badge(&self) -> (&'static str, &'static str) {
        match self.risk_rating() {
            RiskRating::HighlyTrusted => ("✓✓", "Highly Trusted"),
            RiskRating::Reliable => ("✓", "Reliable"),
            RiskRating::HighRisk => ("⚠", "High Risk"),
            RiskRating::MediumRisk => ("~", "Medium Risk"),
        }
    }

    pub fn record_success(&mut self) {
        self.successes += 1;
        self.total_samples += 1;
    }

    pub fn record_deadlock(&mut self) {
        self.deadlocks += 1;
        self.total_samples += 1;
    }
}

// ============================================================================
// RISK RATING
// ============================================================================
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum RiskRating {
    HighlyTrusted,
    Reliable,
    MediumRisk,
    HighRisk,
}

impl RiskRating {
    pub fn as_str(&self) -> &'static str {
        match self {
            RiskRating::HighlyTrusted => "Highly Trusted",
            RiskRating::Reliable => "Reliable",
            RiskRating::MediumRisk => "Medium Risk",
            RiskRating::HighRisk => "High Risk",
        }
    }
}

// ============================================================================
// SNAIL MODE STATUS
// ============================================================================
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SnailModeStatus {
    pub active: bool,
    pub reason: String,
    pub xp: u64,
    pub p_complete: f64,
    pub deadlocks: u64,
    pub creation_delay_ms: u64,
    pub is_new_user: bool,
    pub risk_rating: RiskRating,
    pub message: Option<String>,
}

impl SnailModeStatus {
    pub fn from_stats(stats: &UserCompletionStats) -> Self {
        let active = stats.should_snail_mode();
        let p = stats.p_complete();
        
        let reason = if !active {
            "Good standing".to_string()
        } else if stats.xp < SNAIL_MODE_XP_THRESHOLD {
            format!("Low XP ({} < {})", stats.xp, SNAIL_MODE_XP_THRESHOLD)
        } else {
            format!("Low completion rate ({:.0}% < 50%)", p * 100.0)
        };
        
        let delay = stats.creation_delay_ms();
        let message = if active {
            Some(format!(
                "⏳ App slow due to low trust score. ~{}s delay on new agreements.",
                delay / 1000
            ))
        } else {
            None
        };
        
        Self {
            active,
            reason,
            xp: stats.xp,
            p_complete: p,
            deadlocks: stats.deadlocks,
            creation_delay_ms: delay,
            is_new_user: stats.is_new_user(),
            risk_rating: stats.risk_rating(),
            message,
        }
    }
}

// ============================================================================
// XP SLASHING
// ============================================================================
#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum XpSlashReason {
    NeighborDeadlock,
    TookMoreThanPosted,
    BadDappCreation,
    DiscountNotHonored,
    BadAcademicContent,
    DeceptivePricing,
    AdminAction,
}

impl XpSlashReason {
    pub fn default_penalty(&self) -> u64 {
        match self {
            XpSlashReason::NeighborDeadlock => 50,
            XpSlashReason::TookMoreThanPosted => 75,
            XpSlashReason::BadDappCreation => 100,
            XpSlashReason::DiscountNotHonored => 50,
            XpSlashReason::BadAcademicContent => 50,
            XpSlashReason::DeceptivePricing => 100,
            XpSlashReason::AdminAction => 0,
        }
    }
}

pub fn slash_xp(stats: &mut UserCompletionStats, reason: XpSlashReason, custom_amount: Option<u64>) {
    let penalty = custom_amount.unwrap_or_else(|| reason.default_penalty());
    stats.xp = stats.xp.saturating_sub(penalty);
}

// ============================================================================
// XP TIERS
// ============================================================================
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum XPTier {
    Base,
    Verified,
    Custodian,
    Sentinel,
    Archon,
}

impl XPTier {
    pub fn from_xp(xp: u64) -> Self {
        if xp >= 2000 {
            XPTier::Archon
        } else if xp >= 1000 {
            XPTier::Sentinel
        } else if xp >= 500 {
            XPTier::Custodian
        } else if xp >= 200 {
            XPTier::Verified
        } else {
            XPTier::Base
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            XPTier::Base => "Base",
            XPTier::Verified => "Verified",
            XPTier::Custodian => "Custodian",
            XPTier::Sentinel => "Sentinel",
            XPTier::Archon => "Archon",
        }
    }

    pub fn color(&self) -> &'static str {
        match self {
            XPTier::Base => "#9CA3AF",
            XPTier::Verified => "#60A5FA",
            XPTier::Custodian => "#34D399",
            XPTier::Sentinel => "#A78BFA",
            XPTier::Archon => "#FBBF24",
        }
    }
}

// ============================================================================
// TESTS
// ============================================================================
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_canonical_serialization() {
        let avatar = CanonicalAvatar {
            name: "Shadow".to_string(),
            class: "Ninja".to_string(),
            race: "Dark Elf".to_string(),
            ..Default::default()
        };
        
        let serialized = avatar.serialize_canonical();
        
        // Verify alphabetical order
        assert!(serialized.starts_with("{\"animal\":"));
        assert!(serialized.contains("\"class\":\"ninja\""));
        assert!(serialized.contains("\"name\":\"shadow\""));
    }

    #[test]
    fn test_identity_hash_deterministic() {
        let avatar1 = CanonicalAvatar {
            name: "Test".to_string(),
            class: "Warrior".to_string(),
            ..Default::default()
        };
        
        let avatar2 = CanonicalAvatar {
            name: "Test".to_string(),
            class: "Warrior".to_string(),
            ..Default::default()
        };
        
        assert_eq!(avatar1.identity_hash(), avatar2.identity_hash());
    }

    #[test]
    fn test_citadel_tiers() {
        let mut avatar = CanonicalAvatar::default();
        assert_eq!(avatar.citadel_tier(), CitadelTier::Guest);
        
        // Add 9 traits
        avatar.class = "Warrior".to_string();
        avatar.race = "Human".to_string();
        avatar.occupation = "Knight".to_string();
        avatar.mutant = "Super Strength".to_string();
        avatar.animal = "Wolf".to_string();
        avatar.mutate = "Cyborg".to_string();
        avatar.personality = "Brave".to_string();
        avatar.combat_style = "Melee".to_string();
        avatar.signature_move = "Slash".to_string();
        
        assert_eq!(avatar.citadel_tier(), CitadelTier::Resident);
        assert!(avatar.can_buy());
        assert!(!avatar.can_sell());
        
        // Add 4 more traits
        avatar.weakness = "Fire".to_string();
        avatar.power_spike = "Level 6".to_string();
        avatar.voice_line = "For honor!".to_string();
        avatar.lore_origin = "Mountain kingdom".to_string();
        
        assert_eq!(avatar.citadel_tier(), CitadelTier::Passport);
        assert!(avatar.can_sell());
    }

    #[test]
    fn test_bayesian_p_complete() {
        let mut stats = UserCompletionStats::new();
        
        // New user: p = 1/2 = 0.5
        assert!((stats.p_complete() - 0.5).abs() < 0.01);
        
        // After 1 success: p = 2/3 ≈ 0.67
        stats.record_success();
        assert!((stats.p_complete() - 0.67).abs() < 0.01);
        
        // After 1 deadlock: p = 2/4 = 0.5
        stats.record_deadlock();
        assert!((stats.p_complete() - 0.5).abs() < 0.01);
    }

    #[test]
    fn test_snail_mode() {
        let mut stats = UserCompletionStats::new();
        
        // New user exempt
        assert!(!stats.should_snail_mode());
        
        // Add 3 samples (no longer new)
        stats.record_success();
        stats.record_success();
        stats.record_success();
        
        // Good standing
        assert!(!stats.should_snail_mode());
        
        // Drop XP below threshold
        stats.xp = 100;
        assert!(stats.should_snail_mode());
        assert!(stats.creation_delay_ms() > 0);
    }
}
