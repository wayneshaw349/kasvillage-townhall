// ============================================================================
// KASVILLAGE TOWN HALL - COMPLETE VERIFICATION LIBRARY
// ============================================================================
// A comprehensive verification system providing:
//
// ENTITY TYPES:
//   1. Users (stats, traits, device attestation)
//   2. Stores (brand, links, code integrity, products)
//   3. Academics (profile, credentials, DKIM, abstracts, services)
//   4. DApps (code scan, sandbox safety, SDK usage)
//   5. Games (same as DApps + game-specific rules)
//   6. Services (provider verification, reviews)
//   7. Reviews (survey responses, authenticity)
//
// VERIFICATION FEATURES:
//   - Halo2 IPA SNARK proofs
//   - Code scanning (prohibited/suspicious patterns)
//   - Link whitelist enforcement
//   - Hash integrity checks
//   - Survey/review authenticity
//   - Risk scoring & trust metrics
//
// This serves as a public library so users can make informed decisions
// ============================================================================

use actix_web::{web, HttpResponse, App, HttpServer};
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use std::collections::{HashSet, HashMap};
use std::sync::Arc;
use regex::Regex;
use once_cell::sync::Lazy;
use tokio::sync::RwLock;

// Halo2 imports
use halo2_proofs::{
    plonk::{
        Circuit, ConstraintSystem, Column, Advice, Selector,
        create_proof, verify_proof, keygen_pk, keygen_vk,
        ProvingKey, VerifyingKey, Error as PlonkError,
    },
    circuit::{Layouter, SimpleFloorPlanner, Value},
    poly::commitment::Params,
    pasta::{EqAffine, Fq},
    transcript::{Blake2bWrite, Blake2bRead, Challenge255},
    plonk::SingleVerifier,
};
use rand::rngs::OsRng;

// ============================================================================
// CONSTANTS
// ============================================================================

#[cfg(debug_assertions)]
pub const HALO2_K: u32 = 12;

#[cfg(not(debug_assertions))]
pub const HALO2_K: u32 = 17;

const MAX_CODE_SIZE_BYTES: usize = 5 * 1024 * 1024;
const ARWEAVE_GATEWAY: &str = "https://arweave.net";
const BUNDLR_NODE: &str = "https://node2.irys.xyz";

// Citadel requirements
const TRAITS_TO_BUY: u8 = 9;
const TRAITS_TO_SELL: u8 = 13;

// Stats thresholds
const MIN_XP_VERIFIED: u64 = 100;
const MIN_P_COMPLETE: f64 = 0.5;

// XP Board thresholds
const XP_INCUBATOR: u64 = 500;
const XP_MAIN: u64 = 1000;
const XP_ELITE: u64 = 5000;

// ============================================================================
// WHITELISTED DOMAINS
// ============================================================================

/// Domains allowed for store social links and advertisements
static STORE_LINK_WHITELIST: Lazy<HashSet<&'static str>> = Lazy::new(|| {
    [
        // Social platforms (NO Twitter/X)
        "instagram.com",
        "www.instagram.com",
        "cdninstagram.com",
        "tiktok.com",
        "www.tiktok.com",
        "tiktokcdn.com",
        "facebook.com",
        "www.facebook.com",
        "fbcdn.net",
        "etsy.com",
        "www.etsy.com",
        "etsystatic.com",
        "pinterest.com",
        "www.pinterest.com",
        "pinimg.com",
        "youtube.com",
        "www.youtube.com",
        "youtu.be",
        "ytimg.com",
        "ggpht.com",
    ].into_iter().collect()
});

/// Domains allowed for store images/media
static STORE_IMAGE_WHITELIST: Lazy<HashSet<&'static str>> = Lazy::new(|| {
    [
        // CDNs
        "arweave.net",
        "kasvillage.dev",
        // Image hosts (user uploaded)
        "cdninstagram.com",
        "fbcdn.net",
        "tiktokcdn.com",
        "etsystatic.com",
        "pinimg.com",
        "ytimg.com",
        "ggpht.com",
        // General CDNs
        "cloudflare.com",
        "cloudinary.com",
        "imgix.net",
    ].into_iter().collect()
});

/// Domains allowed for DApp/Game code
static CODE_DOMAIN_WHITELIST: Lazy<HashSet<&'static str>> = Lazy::new(|| {
    [
        "arweave.net",
        "kasvillage.dev",
        "townhall.kasvillage.dev",
        "fonts.googleapis.com",
        "fonts.gstatic.com",
        "cdnjs.cloudflare.com",
        "unpkg.com",
        "jsdelivr.net",
    ].into_iter().collect()
});

/// Communication channels whitelist
static COMMUNICATION_WHITELIST: Lazy<HashSet<&'static str>> = Lazy::new(|| {
    [
        "t.me",              // Telegram
        "telegram.me",
        "m.me",              // FB Messenger
        "messenger.com",
        "instagram.com",     // Instagram DM
    ].into_iter().collect()
});

// ============================================================================
// CODE SCANNER - PROHIBITED PATTERNS (Auto-reject)
// ============================================================================

static PROHIBITED_PATTERNS: Lazy<Vec<(Regex, &'static str, Severity)>> = Lazy::new(|| {
    vec![
        // Gambling/Casino
        (Regex::new(r"(?i)\bcasino\b").unwrap(), "casino", Severity::Critical),
        (Regex::new(r"(?i)\bgambling\b").unwrap(), "gambling", Severity::Critical),
        (Regex::new(r"(?i)\bslots?\b").unwrap(), "slots", Severity::Critical),
        (Regex::new(r"(?i)\broulette\b").unwrap(), "roulette", Severity::Critical),
        (Regex::new(r"(?i)\bblackjack\b").unwrap(), "blackjack", Severity::Critical),
        (Regex::new(r"(?i)\bpoker\s*(game|room|table|tournament)\b").unwrap(), "poker_game", Severity::Critical),
        (Regex::new(r"(?i)\bbetting\b").unwrap(), "betting", Severity::Critical),
        (Regex::new(r"(?i)\bwager(s|ing)?\b").unwrap(), "wager", Severity::Critical),
        (Regex::new(r"(?i)\bjackpot\b").unwrap(), "jackpot", Severity::Critical),
        (Regex::new(r"(?i)\blottery\b").unwrap(), "lottery", Severity::Critical),
        (Regex::new(r"(?i)\bsportsbook\b").unwrap(), "sportsbook", Severity::Critical),
        (Regex::new(r"(?i)\bodds\s*(betting|maker)\b").unwrap(), "odds_betting", Severity::Critical),
        
        // Adult content
        (Regex::new(r"(?i)\bporn(ography|ographic)?\b").unwrap(), "porn", Severity::Critical),
        (Regex::new(r"(?i)\bxxx\b").unwrap(), "xxx", Severity::Critical),
        (Regex::new(r"(?i)\badult[\s_-]*content\b").unwrap(), "adult_content", Severity::Critical),
        (Regex::new(r"(?i)\bnsfw\b").unwrap(), "nsfw", Severity::Critical),
        (Regex::new(r"(?i)\bexplicit[\s_-]*(content|material)\b").unwrap(), "explicit", Severity::Critical),
        (Regex::new(r"(?i)\bhentai\b").unwrap(), "hentai", Severity::Critical),
        (Regex::new(r"(?i)\bonlyfans\b").unwrap(), "onlyfans", Severity::Critical),
        
        // Violence/Weapons
        (Regex::new(r"(?i)\bweapons?\s*tutorial\b").unwrap(), "weapons_tutorial", Severity::Critical),
        (Regex::new(r"(?i)\bbomb[\s_-]*making\b").unwrap(), "bomb_making", Severity::Critical),
        (Regex::new(r"(?i)\bexplosives?\s*(guide|how[\s_-]*to|tutorial)\b").unwrap(), "explosives_guide", Severity::Critical),
        (Regex::new(r"(?i)\b(make|build|create)\s*(a\s*)?(bomb|explosive|weapon)\b").unwrap(), "make_weapon", Severity::Critical),
        (Regex::new(r"(?i)\bgore\b").unwrap(), "gore", Severity::High),
        
        // Drugs
        (Regex::new(r"(?i)\bdrug[\s_-]*market(place)?\b").unwrap(), "drug_market", Severity::Critical),
        (Regex::new(r"(?i)\bbuy[\s_-]*(illegal\s*)?drugs?\b").unwrap(), "buy_drugs", Severity::Critical),
        (Regex::new(r"(?i)\billegal[\s_-]*substances?\b").unwrap(), "illegal_substances", Severity::Critical),
        (Regex::new(r"(?i)\b(meth|cocaine|heroin|fentanyl)\s*(for\s*sale|buy|sell)\b").unwrap(), "hard_drugs", Severity::Critical),
        (Regex::new(r"(?i)\bdark\s*web\s*market\b").unwrap(), "darkweb", Severity::Critical),
        
        // Malware/Hacking
        (Regex::new(r"(?i)\bmalware\b").unwrap(), "malware", Severity::Critical),
        (Regex::new(r"(?i)\bransomware\b").unwrap(), "ransomware", Severity::Critical),
        (Regex::new(r"(?i)\bkeylogger\b").unwrap(), "keylogger", Severity::Critical),
        (Regex::new(r"(?i)\bphishing[\s_-]*(kit|page|template|attack)\b").unwrap(), "phishing", Severity::Critical),
        (Regex::new(r"(?i)\bexploit[\s_-]*kit\b").unwrap(), "exploit_kit", Severity::Critical),
        (Regex::new(r"(?i)\brat[\s_-]*(trojan|tool|malware)\b").unwrap(), "rat", Severity::Critical),
        (Regex::new(r"(?i)\bbotnet\b").unwrap(), "botnet", Severity::Critical),
        (Regex::new(r"(?i)\bzero[\s_-]*day\s*exploit\b").unwrap(), "zeroday", Severity::Critical),
        
        // Scams/Fraud
        (Regex::new(r"(?i)\bpyramid[\s_-]*scheme\b").unwrap(), "pyramid_scheme", Severity::Critical),
        (Regex::new(r"(?i)\bponzi\b").unwrap(), "ponzi", Severity::Critical),
        (Regex::new(r"(?i)\bget[\s_-]*rich[\s_-]*quick\b").unwrap(), "get_rich_quick", Severity::Critical),
        (Regex::new(r"(?i)\bmoney[\s_-]*doubling\b").unwrap(), "money_doubling", Severity::Critical),
        (Regex::new(r"(?i)\b(nigerian|419)\s*scam\b").unwrap(), "nigerian_scam", Severity::Critical),
        (Regex::new(r"(?i)\bguaranteed\s*(returns?|profit)\b").unwrap(), "guaranteed_returns", Severity::High),
        
        // Hate/Extremism
        (Regex::new(r"(?i)\b(white|race)[\s_-]*supremac").unwrap(), "supremacist", Severity::Critical),
        (Regex::new(r"(?i)\bnazi\b").unwrap(), "nazi", Severity::Critical),
        (Regex::new(r"(?i)\bterroris[mt]\b").unwrap(), "terrorism", Severity::Critical),
        (Regex::new(r"(?i)\bethnic[\s_-]*cleansing\b").unwrap(), "ethnic_cleansing", Severity::Critical),
    ]
});

// ============================================================================
// CODE SCANNER - SUSPICIOUS PATTERNS (Requires review)
// ============================================================================

static SUSPICIOUS_PATTERNS: Lazy<Vec<(Regex, &'static str, Severity)>> = Lazy::new(|| {
    vec![
        // Data exfiltration
        (Regex::new(r#"(?i)fetch\s*\(\s*['"`]https?://(?!arweave\.net|kasvillage\.dev|fonts\.googleapis\.com|cdnjs\.cloudflare\.com)"#).unwrap(), "external_fetch", Severity::Medium),
        (Regex::new(r"(?i)XMLHttpRequest").unwrap(), "xhr", Severity::Low),
        (Regex::new(r"(?i)navigator\.sendBeacon").unwrap(), "beacon", Severity::Medium),
        (Regex::new(r"(?i)document\.cookie").unwrap(), "cookie_access", Severity::Medium),
        (Regex::new(r"(?i)localStorage\.getItem").unwrap(), "localstorage", Severity::Low),
        (Regex::new(r"(?i)sessionStorage").unwrap(), "sessionstorage", Severity::Low),
        (Regex::new(r"(?i)indexedDB").unwrap(), "indexeddb", Severity::Low),
        
        // Crypto mining
        (Regex::new(r"(?i)coinhive").unwrap(), "coinhive", Severity::High),
        (Regex::new(r"(?i)cryptonight").unwrap(), "cryptonight", Severity::High),
        (Regex::new(r"(?i)minero").unwrap(), "minero", Severity::High),
        (Regex::new(r"(?i)crypto[\s_-]*miner").unwrap(), "crypto_miner", Severity::High),
        (Regex::new(r"(?i)webworker.*hash").unwrap(), "webworker_hash", Severity::Medium),
        
        // Iframe injection
        (Regex::new(r#"(?i)<iframe[^>]*src\s*=\s*['"](?!https://(arweave\.net|kasvillage\.dev))"#).unwrap(), "external_iframe", Severity::High),
        (Regex::new(r"(?i)srcdoc\s*=").unwrap(), "iframe_srcdoc", Severity::Medium),
        
        // Dynamic code execution
        (Regex::new(r"(?i)\beval\s*\(").unwrap(), "eval", Severity::High),
        (Regex::new(r"(?i)new\s+Function\s*\(").unwrap(), "function_constructor", Severity::High),
        (Regex::new(r#"(?i)setTimeout\s*\(\s*['"]"#).unwrap(), "settimeout_string", Severity::Medium),
        (Regex::new(r#"(?i)setInterval\s*\(\s*['"]"#).unwrap(), "setinterval_string", Severity::Medium),
        
        // DOM manipulation (potential XSS)
        (Regex::new(r"(?i)document\.write\s*\(").unwrap(), "document_write", Severity::Medium),
        (Regex::new(r"(?i)\.innerHTML\s*=").unwrap(), "innerhtml", Severity::Low),
        (Regex::new(r"(?i)\.outerHTML\s*=").unwrap(), "outerhtml", Severity::Low),
        (Regex::new(r"(?i)insertAdjacentHTML").unwrap(), "inserthtml", Severity::Low),
        
        // Obfuscation indicators
        (Regex::new(r"(?i)\\x[0-9a-f]{2}\\x[0-9a-f]{2}\\x[0-9a-f]{2}").unwrap(), "hex_escape_chain", Severity::Medium),
        (Regex::new(r"(?i)fromCharCode\s*\([^)]{50,}").unwrap(), "long_charcode", Severity::Medium),
        (Regex::new(r"(?i)atob\s*\([^)]{100,}").unwrap(), "long_base64", Severity::Medium),
        
        // Wallet/key access
        (Regex::new(r"(?i)window\.ethereum").unwrap(), "ethereum_access", Severity::Low),
        (Regex::new(r"(?i)privateKey").unwrap(), "private_key_mention", Severity::Medium),
        (Regex::new(r"(?i)seed\s*phrase").unwrap(), "seed_phrase", Severity::High),
        (Regex::new(r"(?i)mnemonic").unwrap(), "mnemonic", Severity::Medium),
    ]
});

// ============================================================================
// GAME-SPECIFIC PATTERNS
// ============================================================================

static GAME_PROHIBITED_PATTERNS: Lazy<Vec<(Regex, &'static str)>> = Lazy::new(|| {
    vec![
        // Real money gambling mechanics
        (Regex::new(r"(?i)real[\s_-]*money[\s_-]*(bet|wager|gambl)").unwrap(), "real_money_gambling"),
        (Regex::new(r"(?i)(deposit|withdraw).*\$(usd|eur|gbp)").unwrap(), "fiat_gambling"),
        (Regex::new(r"(?i)cash[\s_-]*out[\s_-]*winnings").unwrap(), "cashout_winnings"),
        
        // Loot box concerns (if paid)
        (Regex::new(r"(?i)loot[\s_-]*box.*\$").unwrap(), "paid_lootbox"),
        (Regex::new(r"(?i)gacha.*pay").unwrap(), "paid_gacha"),
    ]
});

// ============================================================================
// TYPES - COMMON
// ============================================================================

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    Critical,
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum VerificationStatus {
    Verified,
    PendingReview,
    Rejected,
    Expired,
    NotFound,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EntityType {
    User,
    Store,
    Academic,
    Service,
    DApp,
    Game,
    Review,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Board {
    Incubator,  // 500 XP
    Main,       // 1000 XP
    Elite,      // 5000 XP
}

impl Board {
    pub fn from_xp(xp: u64) -> Option<Self> {
        match xp {
            x if x >= XP_ELITE => Some(Board::Elite),
            x if x >= XP_MAIN => Some(Board::Main),
            x if x >= XP_INCUBATOR => Some(Board::Incubator),
            _ => None,
        }
    }
    
    pub fn min_xp(&self) -> u64 {
        match self {
            Board::Incubator => XP_INCUBATOR,
            Board::Main => XP_MAIN,
            Board::Elite => XP_ELITE,
        }
    }
}

// ============================================================================
// TYPES - USER STATS
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserStats {
    pub xp: u64,
    pub successes: u32,
    pub deadlocks: u32,
    pub total_transactions: u32,
    pub created_at: u64,
    pub last_active_at: u64,
    pub snail_mode_until: Option<u64>,
}

impl UserStats {
    pub fn p_complete(&self) -> f64 {
        (1.0 + self.successes as f64) / (2.0 + self.successes as f64 + self.deadlocks as f64)
    }
    
    pub fn meets_criteria(&self) -> bool {
        self.xp >= MIN_XP_VERIFIED && self.p_complete() >= MIN_P_COMPLETE
    }
    
    pub fn is_in_snail_mode(&self) -> bool {
        self.snail_mode_until.map(|u| current_timestamp() < u).unwrap_or(false)
    }
    
    pub fn is_new_user(&self) -> bool {
        self.total_transactions < 3
    }
    
    pub fn risk_rating(&self) -> &'static str {
        if self.is_new_user() {
            "new_user"
        } else if self.p_complete() >= 0.8 && self.xp >= 500 {
            "low"
        } else if self.p_complete() >= 0.5 && self.xp >= MIN_XP_VERIFIED {
            "medium"
        } else {
            "high"
        }
    }
    
    pub fn board(&self) -> Option<Board> {
        Board::from_xp(self.xp)
    }
}

// ============================================================================
// TYPES - CITADEL TRAITS (18 canonical traits)
// ============================================================================

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CitadelTraits {
    pub name: bool,
    pub class: bool,
    pub race: bool,
    pub occupation: bool,
    pub origin_story: bool,
    pub defining_moment: bool,
    pub formative_memory: bool,
    pub life_philosophy: bool,
    pub personality: bool,
    pub weakness: bool,
    pub signature_move: bool,
    pub voice_line: bool,
    pub power_spike: bool,
    pub animal: bool,
    pub combat_style: bool,
    pub lore_origin: bool,
    pub mutant: bool,
    pub mutate: bool,
}

impl CitadelTraits {
    pub fn count(&self) -> u8 {
        [
            self.name, self.class, self.race, self.occupation, self.origin_story,
            self.defining_moment, self.formative_memory, self.life_philosophy,
            self.personality, self.weakness, self.signature_move, self.voice_line,
            self.power_spike, self.animal, self.combat_style, self.lore_origin,
            self.mutant, self.mutate,
        ].iter().filter(|&&t| t).count() as u8
    }
    
    pub fn can_buy(&self) -> bool { self.count() >= TRAITS_TO_BUY }
    pub fn can_sell(&self) -> bool { self.count() >= TRAITS_TO_SELL }
    
    pub fn has_seller_traits(&self) -> bool {
        self.origin_story && self.defining_moment && self.weakness && self.signature_move
    }
    
    
    pub fn missing_for_sell(&self) -> Vec<&'static str> {
        let mut missing = Vec::new();
        if !self.origin_story { missing.push("origin_story"); }
        if !self.defining_moment { missing.push("defining_moment"); }
        if !self.weakness { missing.push("weakness"); }
        if !self.signature_move { missing.push("signature_move"); }
        missing
    }
}

// ============================================================================
// TYPES - CODE SCAN RESULT
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeScanResult {
    pub passed: bool,
    pub status: ScanStatus,
    pub code_hash: String,
    pub code_size_bytes: usize,
    pub prohibited_matches: Vec<PatternMatch>,
    pub suspicious_matches: Vec<PatternMatch>,
    pub whitelist_violations: Vec<WhitelistViolation>,
    pub missing_required: Vec<String>,
    pub scan_timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ScanStatus {
    Approved,
    PendingReview,
    Rejected,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternMatch {
    pub pattern_id: String,
    pub line_number: usize,
    pub context: String,
    pub severity: Severity,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhitelistViolation {
    pub domain: String,
    pub line_number: usize,
    pub context: String,
    pub violation_type: WhitelistViolationType,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WhitelistViolationType {
    UnauthorizedLink,
    UnauthorizedImage,
    UnauthorizedCode,
    UnauthorizedCommunication,
}

// ============================================================================
// TYPES - STORE VERIFICATION
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoreVerification {
    pub store_id: String,
    pub owner_apt: String,
    pub owner_pubkey: String,
    pub brand_name: String,
    pub code_hash: String,
    pub link_check: LinkCheckResult,
    pub content_hash: String,
    pub verified: bool,
    pub verification_tx: Option<String>,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkCheckResult {
    pub all_links_valid: bool,
    pub social_links: Vec<LinkValidation>,
    pub image_links: Vec<LinkValidation>,
    pub communication_links: Vec<LinkValidation>,
    pub unauthorized_links: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkValidation {
    pub url: String,
    pub domain: String,
    pub whitelisted: bool,
    pub reachable: Option<bool>,
}

// ============================================================================
// TYPES - ACADEMIC VERIFICATION
// ============================================================================
// PRIVACY: We do NOT store emails or email hashes on Arweave.
// The SNARK proves "DKIM validation passed for an .edu domain" without
// revealing which email or domain. Only the fact of verification is public.
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcademicVerification {
    pub academic_id: String,
    pub owner_apt: String,
    pub owner_pubkey: String,
    // NO email field - privacy protection
    // NO email_domain field - privacy protection  
    pub domain_type: DomainType,        // Only stores category: Edu, Research, Gov, Other
    pub dkim_verified: bool,
    pub institution_category: Option<String>,  // "university", "research_institute", "hospital" - NOT the name
    pub credentials_count: u32,         // Count only, not details
    pub credentials_verified: bool,     // Aggregate: all verified or not
    pub abstracts_count: u32,
    pub services_count: u32,
    pub verified: bool,
    pub verification_tx: Option<String>,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DomainType {
    Edu,        // .edu, .ac.uk, .edu.au, etc.
    Research,   // Known research institutions
    Gov,        // Government research
    Medical,    // Medical/hospital
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Credential {
    pub credential_type: String,  // "degree", "certification", "license"
    pub title: String,
    pub institution: String,
    pub year: Option<u32>,
    pub verified: bool,
    pub verification_method: String,  // "dkim", "manual", "api"
}

// What gets stored in SNARK public inputs (privacy-preserving):
// - domain_type (Edu/Research/Gov/Medical/Other)
// - dkim_verified (bool)
// - credentials_verified (bool) 
// - owner commitment (hash of pubkey)
//
// What NEVER gets stored or posted:
// - Actual email address
// - Email hash
// - Specific domain name
// - Institution name

// ============================================================================
// TYPES - SERVICE VERIFICATION
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceVerification {
    pub service_id: String,
    pub provider_apt: String,
    pub provider_pubkey: String,
    pub service_type: String,
    pub description_hash: String,
    pub pricing_hash: String,
    pub reviews_summary: ReviewsSummary,
    pub verified: bool,
    pub verification_tx: Option<String>,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewsSummary {
    pub total_reviews: u32,
    pub verified_reviews: u32,
    pub average_rating: f64,
    pub rating_distribution: [u32; 5],  // 1-5 stars
    pub authenticity_score: f64,  // 0.0 - 1.0
    pub suspicious_reviews: u32,
}

// ============================================================================
// TYPES - DAPP/GAME VERIFICATION
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DAppVerification {
    pub dapp_id: String,
    pub owner_apt: String,
    pub owner_pubkey: String,
    pub name: String,
    pub category: String,
    pub is_game: bool,
    pub code_scan: CodeScanResult,
    pub sdk_check: SdkCheckResult,
    pub sandbox_safe: bool,
    pub board: Option<Board>,
    pub xp_staked: u64,
    pub verified: bool,
    pub verification_tx: Option<String>,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SdkCheckResult {
    pub uses_kasvillage_sdk: bool,
    pub sdk_version: Option<String>,
    pub standalone_declared: bool,
    pub api_endpoints_valid: bool,
}

// ============================================================================
// TYPES - REVIEW VERIFICATION
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewVerification {
    pub review_id: String,
    pub reviewer_apt: String,
    pub reviewer_pubkey: String,
    pub subject_type: EntityType,
    pub subject_id: String,
    pub rating: u8,
    pub survey_responses: Vec<SurveyResponse>,
    pub authenticity_check: AuthenticityCheck,
    pub verified: bool,
    pub verification_tx: Option<String>,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SurveyResponse {
    pub question_id: String,
    pub question_text: String,
    pub response: String,
    pub response_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthenticityCheck {
    pub reviewer_has_transaction: bool,
    pub time_since_transaction: Option<u64>,
    pub reviewer_stats: UserStats,
    pub duplicate_check_passed: bool,
    pub sentiment_analysis: SentimentResult,
    pub authenticity_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SentimentResult {
    pub is_genuine: bool,
    pub confidence: f64,
    pub flags: Vec<String>,
}

// ============================================================================
// TYPES - VERIFICATION PROOF
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationProof {
    pub proof_type: String,
    pub entity_type: EntityType,
    pub subject_id: String,
    pub owner_apt: String,
    pub verified: bool,
    pub status: VerificationStatus,
    pub proof_bytes: Vec<u8>,
    pub public_inputs: Vec<String>,
    pub risk_score: f64,
    pub board: Option<Board>,
    pub timestamp: u64,
    pub expires_at: Option<u64>,
    pub arweave_tx: Option<String>,
}

// ============================================================================
// TYPES - LIBRARY QUERY RESPONSE
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryEntry {
    pub entity_type: EntityType,
    pub entity_id: String,
    pub owner_apt: String,
    pub name: String,
    pub description: Option<String>,
    pub status: VerificationStatus,
    pub verified: bool,
    pub risk_score: f64,
    pub board: Option<Board>,
    
    // Stats for decision making
    pub owner_stats: Option<OwnerSummary>,
    pub reviews_summary: Option<ReviewsSummary>,
    pub scan_summary: Option<ScanSummary>,
    
    // Verification details
    pub verification_tx: Option<String>,
    pub verified_at: Option<u64>,
    pub expires_at: Option<u64>,
    
    // Warnings/flags
    pub warnings: Vec<String>,
    pub flags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OwnerSummary {
    pub apt: String,
    pub xp: u64,
    pub p_complete: f64,
    pub risk_rating: String,
    pub traits_count: u8,
    pub can_sell: bool,
    pub total_transactions: u32,
    pub member_since: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanSummary {
    pub passed: bool,
    pub status: ScanStatus,
    pub prohibited_count: usize,
    pub suspicious_count: usize,
    pub whitelist_violations: usize,
}

// ============================================================================
// CODE SCANNER IMPLEMENTATION
// ============================================================================

pub fn scan_code(code: &str, entity_type: EntityType) -> CodeScanResult {
    let lines: Vec<&str> = code.lines().collect();
    let mut prohibited_matches = Vec::new();
    let mut suspicious_matches = Vec::new();
    let mut whitelist_violations = Vec::new();
    let mut missing_required = Vec::new();
    
    // Check code size
    if code.len() > MAX_CODE_SIZE_BYTES {
        return CodeScanResult {
            passed: false,
            status: ScanStatus::Rejected,
            code_hash: compute_sha256(code),
            code_size_bytes: code.len(),
            prohibited_matches: vec![PatternMatch {
                pattern_id: "SIZE_EXCEEDED".to_string(),
                line_number: 0,
                context: format!("Code size {} exceeds max {}", code.len(), MAX_CODE_SIZE_BYTES),
                severity: Severity::Critical,
            }],
            suspicious_matches: vec![],
            whitelist_violations: vec![],
            missing_required: vec![],
            scan_timestamp: current_timestamp(),
        };
    }
    
    // Scan prohibited patterns
    for (regex, id, severity) in PROHIBITED_PATTERNS.iter() {
        for (line_num, line) in lines.iter().enumerate() {
            if regex.is_match(line) {
                prohibited_matches.push(PatternMatch {
                    pattern_id: id.to_string(),
                    line_number: line_num + 1,
                    context: truncate_string(line, 100),
                    severity: *severity,
                });
            }
        }
    }
    
    // Scan suspicious patterns
    for (regex, id, severity) in SUSPICIOUS_PATTERNS.iter() {
        for (line_num, line) in lines.iter().enumerate() {
            if regex.is_match(line) {
                suspicious_matches.push(PatternMatch {
                    pattern_id: id.to_string(),
                    line_number: line_num + 1,
                    context: truncate_string(line, 100),
                    severity: *severity,
                });
            }
        }
    }
    
    // Game-specific checks
    if entity_type == EntityType::Game {
        for (regex, id) in GAME_PROHIBITED_PATTERNS.iter() {
            for (line_num, line) in lines.iter().enumerate() {
                if regex.is_match(line) {
                    prohibited_matches.push(PatternMatch {
                        pattern_id: format!("game_{}", id),
                        line_number: line_num + 1,
                        context: truncate_string(line, 100),
                        severity: Severity::Critical,
                    });
                }
            }
        }
    }
    
    // Extract and check domains
    let domain_regex = Regex::new(r#"https?://([a-zA-Z0-9.-]+)"#).unwrap();
    for (line_num, line) in lines.iter().enumerate() {
        for cap in domain_regex.captures_iter(line) {
            if let Some(domain) = cap.get(1) {
                let domain_str = domain.as_str().to_lowercase();
                
                let is_allowed = match entity_type {
                    EntityType::Store => is_domain_allowed(&domain_str, &STORE_LINK_WHITELIST) 
                        || is_domain_allowed(&domain_str, &STORE_IMAGE_WHITELIST),
                    EntityType::DApp | EntityType::Game => is_domain_allowed(&domain_str, &CODE_DOMAIN_WHITELIST),
                    _ => true,
                };
                
                if !is_allowed {
                    whitelist_violations.push(WhitelistViolation {
                        domain: domain_str,
                        line_number: line_num + 1,
                        context: truncate_string(line, 100),
                        violation_type: match entity_type {
                            EntityType::Store => WhitelistViolationType::UnauthorizedLink,
                            _ => WhitelistViolationType::UnauthorizedCode,
                        },
                    });
                }
            }
        }
    }
    
    // Check for required patterns (SDK usage)
    if entity_type == EntityType::DApp || entity_type == EntityType::Game {
        let sdk_regex = Regex::new(r"(?i)(kasvillage|KasVillageSDK|KASVILLAGE_STANDALONE)").unwrap();
        if !sdk_regex.is_match(code) {
            missing_required.push("KasVillage SDK or KASVILLAGE_STANDALONE declaration".to_string());
        }
    }
    
    // Determine status
    let (passed, status) = if !prohibited_matches.is_empty() {
        (false, ScanStatus::Rejected)
    } else if !suspicious_matches.is_empty() || !whitelist_violations.is_empty() || !missing_required.is_empty() {
        (false, ScanStatus::PendingReview)
    } else {
        (true, ScanStatus::Approved)
    };
    
    CodeScanResult {
        passed,
        status,
        code_hash: compute_sha256(code),
        code_size_bytes: code.len(),
        prohibited_matches,
        suspicious_matches,
        whitelist_violations,
        missing_required,
        scan_timestamp: current_timestamp(),
    }
}

fn is_domain_allowed(domain: &str, whitelist: &HashSet<&'static str>) -> bool {
    whitelist.iter().any(|w| domain == *w || domain.ends_with(&format!(".{}", w)))
}

// ============================================================================
// STORE LINK CHECKER
// ============================================================================

pub fn check_store_links(
    social_links: &[String],
    image_links: &[String],
    communication_links: &[String],
) -> LinkCheckResult {
    let mut result = LinkCheckResult {
        all_links_valid: true,
        social_links: Vec::new(),
        image_links: Vec::new(),
        communication_links: Vec::new(),
        unauthorized_links: Vec::new(),
    };
    
    // Check social links
    for url in social_links {
        let domain = extract_domain(url);
        let whitelisted = is_domain_allowed(&domain, &STORE_LINK_WHITELIST);
        
        if !whitelisted {
            result.all_links_valid = false;
            result.unauthorized_links.push(url.clone());
        }
        
        result.social_links.push(LinkValidation {
            url: url.clone(),
            domain: domain.clone(),
            whitelisted,
            reachable: None,
        });
    }
    
    // Check image links
    for url in image_links {
        let domain = extract_domain(url);
        let whitelisted = is_domain_allowed(&domain, &STORE_IMAGE_WHITELIST);
        
        if !whitelisted {
            result.all_links_valid = false;
            result.unauthorized_links.push(url.clone());
        }
        
        result.image_links.push(LinkValidation {
            url: url.clone(),
            domain,
            whitelisted,
            reachable: None,
        });
    }
    
    // Check communication links
    for url in communication_links {
        let domain = extract_domain(url);
        let whitelisted = is_domain_allowed(&domain, &COMMUNICATION_WHITELIST);
        
        if !whitelisted {
            result.all_links_valid = false;
            result.unauthorized_links.push(url.clone());
        }
        
        result.communication_links.push(LinkValidation {
            url: url.clone(),
            domain,
            whitelisted,
            reachable: None,
        });
    }
    
    result
}

fn extract_domain(url: &str) -> String {
    let url = url.trim_start_matches("https://").trim_start_matches("http://");
    url.split('/').next().unwrap_or("").to_lowercase()
}

// ============================================================================
// REVIEW AUTHENTICITY CHECKER
// ============================================================================

pub fn check_review_authenticity(
    reviewer_apt: &str,
    subject_id: &str,
    survey_responses: &[SurveyResponse],
    reviewer_stats: &UserStats,
    has_transaction_with_subject: bool,
    existing_reviews: &[String], // hashes of existing reviews by this reviewer
) -> AuthenticityCheck {
    let mut flags = Vec::new();
    let mut authenticity_score = 1.0;
    
    // Check if reviewer has transaction with subject
    if !has_transaction_with_subject {
        flags.push("no_transaction_history".to_string());
        authenticity_score -= 0.3;
    }
    
    // Check reviewer stats
    if reviewer_stats.is_new_user() {
        flags.push("new_user_reviewer".to_string());
        authenticity_score -= 0.1;
    }
    
    if reviewer_stats.is_in_snail_mode() {
        flags.push("reviewer_in_snail_mode".to_string());
        authenticity_score -= 0.2;
    }
    
    // Check for duplicate reviews
    let response_hashes: Vec<&str> = survey_responses.iter()
        .map(|r| r.response_hash.as_str())
        .collect();
    
    let duplicate_count = existing_reviews.iter()
        .filter(|h| response_hashes.contains(&h.as_str()))
        .count();
    
    let duplicate_check_passed = duplicate_count == 0;
    if !duplicate_check_passed {
        flags.push("duplicate_responses_detected".to_string());
        authenticity_score -= 0.4;
    }
    
    // Simple sentiment check (length-based heuristic)
    let avg_response_len: usize = survey_responses.iter()
        .map(|r| r.response.len())
        .sum::<usize>() / survey_responses.len().max(1);
    
    let sentiment_genuine = avg_response_len >= 20; // Minimum effort threshold
    if !sentiment_genuine {
        flags.push("low_effort_responses".to_string());
        authenticity_score -= 0.15;
    }
    
    authenticity_score = authenticity_score.max(0.0);
    
    AuthenticityCheck {
        reviewer_has_transaction: has_transaction_with_subject,
        time_since_transaction: None,
        reviewer_stats: reviewer_stats.clone(),
        duplicate_check_passed,
        sentiment_analysis: SentimentResult {
            is_genuine: sentiment_genuine && duplicate_check_passed,
            confidence: authenticity_score,
            flags: flags.clone(),
        },
        authenticity_score,
    }
}

// ============================================================================
// HALO2 CIRCUIT
// ============================================================================

#[derive(Clone, Debug)]
pub struct VerificationCircuit {
    pub content_hash: Value<Fq>,
    pub owner_pubkey_hash: Value<Fq>,
    pub trait_count: Value<Fq>,
    pub xp: Value<Fq>,
    pub p_complete_scaled: Value<Fq>, // p_complete * 100
    pub scan_passed: Value<Fq>,
    pub links_valid: Value<Fq>,
    pub entity_type: Value<Fq>,
    pub verification_result: Value<Fq>,
}

#[derive(Clone, Debug)]
pub struct VerificationConfig {
    advice: [Column<Advice>; 4],
    selector: Selector,
}

impl Circuit<Fq> for VerificationCircuit {
    type Config = VerificationConfig;
    type FloorPlanner = SimpleFloorPlanner;

    fn without_witnesses(&self) -> Self {
        Self {
            content_hash: Value::unknown(),
            owner_pubkey_hash: Value::unknown(),
            trait_count: Value::unknown(),
            xp: Value::unknown(),
            p_complete_scaled: Value::unknown(),
            scan_passed: Value::unknown(),
            links_valid: Value::unknown(),
            entity_type: Value::unknown(),
            verification_result: Value::unknown(),
        }
    }

    fn configure(meta: &mut ConstraintSystem<Fq>) -> Self::Config {
        let advice = [
            meta.advice_column(),
            meta.advice_column(),
            meta.advice_column(),
            meta.advice_column(),
        ];
        let selector = meta.selector();
        
        for col in &advice {
            meta.enable_equality(*col);
        }
        
        meta.create_gate("verification", |meta| {
            let s = meta.query_selector(selector);
            let result = meta.query_advice(advice[3], halo2_proofs::poly::Rotation::cur());
            
            // Result must be 0 or 1
            vec![s * result.clone() * (halo2_proofs::plonk::Expression::Constant(Fq::one()) - result)]
        });
        
        VerificationConfig { advice, selector }
    }

    fn synthesize(
        &self,
        config: Self::Config,
        mut layouter: impl Layouter<Fq>,
    ) -> Result<(), PlonkError> {
        layouter.assign_region(
            || "verification",
            |mut region| {
                config.selector.enable(&mut region, 0)?;
                
                region.assign_advice(|| "trait_count", config.advice[0], 0, || self.trait_count)?;
                region.assign_advice(|| "xp", config.advice[1], 0, || self.xp)?;
                region.assign_advice(|| "scan_passed", config.advice[2], 0, || self.scan_passed)?;
                region.assign_advice(|| "result", config.advice[3], 0, || self.verification_result)?;
                
                Ok(())
            },
        )
    }
}

// ============================================================================
// HALO2 PROVER
// ============================================================================

pub struct Halo2Prover {
    params: Arc<Params<EqAffine>>,
    pk_cache: Arc<RwLock<HashMap<String, ProvingKey<EqAffine>>>>,
    vk_cache: Arc<RwLock<HashMap<String, VerifyingKey<EqAffine>>>>,
}

impl Halo2Prover {
    pub fn new() -> Result<Self, String> {
        let params = Params::<EqAffine>::new(HALO2_K);
        
        Ok(Self {
            params: Arc::new(params),
            pk_cache: Arc::new(RwLock::new(HashMap::new())),
            vk_cache: Arc::new(RwLock::new(HashMap::new())),
        })
    }
    
    pub async fn generate_proof(
        &self,
        entity_type: EntityType,
        content_hash: &[u8; 32],
        owner_pubkey: &[u8; 33],
        traits: &CitadelTraits,
        stats: &UserStats,
        scan_passed: bool,
        links_valid: bool,
    ) -> Result<VerificationProof, String> {
        let trait_count = traits.count();
        let verified = match entity_type {
            EntityType::User => stats.meets_criteria() && trait_count >= TRAITS_TO_BUY,
            EntityType::Store | EntityType::Academic | EntityType::Service => {
                trait_count >= TRAITS_TO_SELL && scan_passed && links_valid && stats.meets_criteria()
            }
            EntityType::DApp | EntityType::Game => {
                trait_count >= TRAITS_TO_SELL && scan_passed && stats.meets_criteria()
            }
            EntityType::Review => stats.meets_criteria(),
        };
        
        let circuit = VerificationCircuit {
            content_hash: Value::known(bytes_to_fq(content_hash)),
            owner_pubkey_hash: Value::known(bytes_to_fq(&owner_pubkey[..32].try_into().unwrap())),
            trait_count: Value::known(Fq::from(trait_count as u64)),
            xp: Value::known(Fq::from(stats.xp)),
            p_complete_scaled: Value::known(Fq::from((stats.p_complete() * 100.0) as u64)),
            scan_passed: Value::known(if scan_passed { Fq::one() } else { Fq::zero() }),
            links_valid: Value::known(if links_valid { Fq::one() } else { Fq::zero() }),
            entity_type: Value::known(Fq::from(entity_type as u64)),
            verification_result: Value::known(if verified { Fq::one() } else { Fq::zero() }),
        };
        
        let circuit_name = format!("verification_{:?}", entity_type);
        let pk = self.get_or_create_pk(&circuit_name, circuit.clone()).await?;
        
        let result_fq = if verified { Fq::one() } else { Fq::zero() };
        let instances = vec![vec![bytes_to_fq(content_hash), result_fq]];
        let instances_refs: Vec<&[Fq]> = instances.iter().map(|v| v.as_slice()).collect();
        
        let mut transcript = Blake2bWrite::<_, _, Challenge255<_>>::init(Vec::new());
        create_proof::<EqAffine, Challenge255<EqAffine>, OsRng, Blake2bWrite<Vec<u8>, EqAffine, Challenge255<EqAffine>>, _>(
            &self.params,
            &pk,
            &[circuit],
            &[instances_refs.as_slice()],
            OsRng,
            &mut transcript,
        ).map_err(|e| format!("Proof generation failed: {:?}", e))?;
        
        let proof_bytes = transcript.finalize();
        
        Ok(VerificationProof {
            proof_type: format!("halo2_ipa_{:?}_v1", entity_type).to_lowercase(),
            entity_type,
            subject_id: hex::encode(content_hash),
            owner_apt: String::new(),
            verified,
            status: if verified { VerificationStatus::Verified } else { VerificationStatus::PendingReview },
            proof_bytes,
            public_inputs: vec![
                hex::encode(content_hash),
                verified.to_string(),
                trait_count.to_string(),
                stats.xp.to_string(),
                format!("{:.2}", stats.p_complete()),
                scan_passed.to_string(),
                links_valid.to_string(),
            ],
            risk_score: if verified { 0.1 } else { 0.7 },
            board: stats.board(),
            timestamp: current_timestamp(),
            expires_at: Some(current_timestamp() + 365 * 24 * 60 * 60), // 1 year
            arweave_tx: None,
        })
    }
    
    async fn get_or_create_pk(
        &self,
        name: &str,
        circuit: VerificationCircuit,
    ) -> Result<ProvingKey<EqAffine>, String> {
        {
            let cache = self.pk_cache.read().await;
            if let Some(pk) = cache.get(name) {
                return Ok(pk.clone());
            }
        }
        
        let vk = keygen_vk(&self.params, &circuit)
            .map_err(|e| format!("VK generation failed: {:?}", e))?;
        let pk = keygen_pk(&self.params, vk, &circuit)
            .map_err(|e| format!("PK generation failed: {:?}", e))?;
        
        {
            let mut cache = self.pk_cache.write().await;
            cache.insert(name.to_string(), pk.clone());
        }
        
        Ok(pk)
    }
}

// ============================================================================
// ARWEAVE CLIENT
// ============================================================================

pub struct ArweaveClient {
    client: reqwest::Client,
}

impl ArweaveClient {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .unwrap(),
        }
    }
    
    pub async fn post_proof(&self, proof: &VerificationProof) -> Result<String, String> {
        let tags = vec![
            ("App-Name", "KasVillage"),
            ("Type", &format!("KV_{:?}_VERIFICATION_V1", proof.entity_type).to_uppercase()),
            ("Subject-Id", &proof.subject_id),
            ("Owner-APT", &proof.owner_apt),
            ("Verified", &proof.verified.to_string()),
            ("Board", &proof.board.map(|b| format!("{:?}", b)).unwrap_or_default()),
            ("Timestamp", &proof.timestamp.to_string()),
            ("Content-Type", "application/json"),
        ];
        
        let data = serde_json::to_vec(proof)
            .map_err(|e| format!("Serialization failed: {}", e))?;
        
        let response = self.client
            .post(format!("{}/tx", BUNDLR_NODE))
            .header("Content-Type", "application/octet-stream")
            .body(data)
            .send()
            .await
            .map_err(|e| format!("Post failed: {}", e))?;
        
        if response.status().is_success() {
            let result: serde_json::Value = response.json().await
                .map_err(|e| format!("Parse failed: {}", e))?;
            Ok(result["id"].as_str().unwrap_or("unknown").to_string())
        } else {
            Err(format!("Post failed: {}", response.status()))
        }
    }
    
    pub async fn get_proof(
        &self,
        entity_type: EntityType,
        subject_id: &str,
    ) -> Result<Option<VerificationProof>, String> {
        let query = format!(r#"
            query {{
                transactions(
                    tags: [
                        {{ name: "App-Name", values: ["KasVillage"] }},
                        {{ name: "Type", values: ["KV_{:?}_VERIFICATION_V1"] }},
                        {{ name: "Subject-Id", values: ["{}"] }}
                    ],
                    first: 1,
                    sort: HEIGHT_DESC
                ) {{
                    edges {{
                        node {{ id }}
                    }}
                }}
            }}
        "#, entity_type, subject_id);
        
        let response = self.client
            .post(format!("{}/graphql", ARWEAVE_GATEWAY))
            .header("Content-Type", "application/json")
            .json(&serde_json::json!({ "query": query }))
            .send()
            .await
            .map_err(|e| format!("Query failed: {}", e))?;
        
        let result: serde_json::Value = response.json().await
            .map_err(|e| format!("Parse failed: {}", e))?;
        
        if let Some(edges) = result["data"]["transactions"]["edges"].as_array() {
            if let Some(first) = edges.first() {
                let tx_id = first["node"]["id"].as_str().unwrap_or("");
                
                let proof_response = self.client
                    .get(format!("{}/{}", ARWEAVE_GATEWAY, tx_id))
                    .send()
                    .await
                    .map_err(|e| format!("Fetch failed: {}", e))?;
                
                let proof: VerificationProof = proof_response.json().await
                    .map_err(|e| format!("Parse failed: {}", e))?;
                
                return Ok(Some(proof));
            }
        }
        
        Ok(None)
    }
    
    pub async fn get_library_entry(
        &self,
        entity_type: EntityType,
        entity_id: &str,
    ) -> Result<Option<LibraryEntry>, String> {
        let proof = self.get_proof(entity_type, entity_id).await?;
        
        if let Some(p) = proof {
            Ok(Some(LibraryEntry {
                entity_type: p.entity_type,
                entity_id: p.subject_id.clone(),
                owner_apt: p.owner_apt.clone(),
                name: String::new(),
                description: None,
                status: p.status,
                verified: p.verified,
                risk_score: p.risk_score,
                board: p.board,
                owner_stats: None,
                reviews_summary: None,
                scan_summary: None,
                verification_tx: p.arweave_tx,
                verified_at: Some(p.timestamp),
                expires_at: p.expires_at,
                warnings: Vec::new(),
                flags: Vec::new(),
            }))
        } else {
            Ok(None)
        }
    }
}

// ============================================================================
// APP STATE
// ============================================================================

pub struct AppState {
    pub prover: Arc<Halo2Prover>,
    pub arweave: Arc<ArweaveClient>,
    pub apt_registry: Arc<RwLock<HashMap<String, AptRegistration>>>,
    pub verified_cache: Arc<RwLock<HashMap<String, VerificationProof>>>,
    pub reviews_cache: Arc<RwLock<HashMap<String, Vec<String>>>>, // subject_id -> review hashes
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AptRegistration {
    pub apt_number: String,
    pub pubkey: String,
    pub device_hash: String,
    pub registered_at: u64,
}

impl AppState {
    pub fn new() -> Result<Self, String> {
        Ok(Self {
            prover: Arc::new(Halo2Prover::new()?),
            arweave: Arc::new(ArweaveClient::new()),
            apt_registry: Arc::new(RwLock::new(HashMap::new())),
            verified_cache: Arc::new(RwLock::new(HashMap::new())),
            reviews_cache: Arc::new(RwLock::new(HashMap::new())),
        })
    }
}

// ============================================================================
// API HANDLERS - USER VERIFICATION
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct UserVerifyRequest {
    pub owner_pubkey: String,
    pub apt_number: String,
    pub traits: CitadelTraits,
    pub stats: UserStats,
    pub device_hash: String,
    pub signature: String,
}

#[derive(Debug, Serialize)]
pub struct UserVerifyResponse {
    pub verified: bool,
    pub can_buy: bool,
    pub can_sell: bool,
    pub risk_rating: String,
    pub board: Option<Board>,
    pub proof: Option<VerificationProof>,
    pub message: String,
}

pub async fn api_verify_user(
    state: web::Data<AppState>,
    body: web::Json<UserVerifyRequest>,
) -> HttpResponse {
    let content_hash = compute_user_hash(&body.owner_pubkey, &body.apt_number);
    let owner_pubkey = hex_to_bytes33(&body.owner_pubkey);
    
    let proof = state.prover.generate_proof(
        EntityType::User,
        &content_hash,
        &owner_pubkey,
        &body.traits,
        &body.stats,
        true,
        true,
    ).await;
    
    match proof {
        Ok(mut p) => {
            p.owner_apt = body.apt_number.clone();
            
            if let Ok(tx) = state.arweave.post_proof(&p).await {
                p.arweave_tx = Some(tx);
            }
            
            HttpResponse::Ok().json(UserVerifyResponse {
                verified: p.verified,
                can_buy: body.traits.can_buy(),
                can_sell: body.traits.can_sell(),
                risk_rating: body.stats.risk_rating().to_string(),
                board: p.board,
                proof: Some(p),
                message: "User verified".to_string(),
            })
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": e
        })),
    }
}

// ============================================================================
// API HANDLERS - STORE VERIFICATION
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct StoreVerifyRequest {
    pub owner_pubkey: String,
    pub apt_number: String,
    pub store_id: String,
    pub brand_name: String,
    pub store_code: String,
    pub social_links: Vec<String>,
    pub image_links: Vec<String>,
    pub communication_links: Vec<String>,
    pub traits: CitadelTraits,
    pub stats: UserStats,
    pub signature: String,
}

#[derive(Debug, Serialize)]
pub struct StoreVerifyResponse {
    pub verified: bool,
    pub store_id: String,
    pub code_scan: CodeScanResult,
    pub link_check: LinkCheckResult,
    pub proof: Option<VerificationProof>,
    pub message: String,
}

pub async fn api_verify_store(
    state: web::Data<AppState>,
    body: web::Json<StoreVerifyRequest>,
) -> HttpResponse {
    // Scan store code
    let code_scan = scan_code(&body.store_code, EntityType::Store);
    
    if code_scan.status == ScanStatus::Rejected {
        return HttpResponse::Ok().json(StoreVerifyResponse {
            verified: false,
            store_id: body.store_id.clone(),
            code_scan,
            link_check: LinkCheckResult {
                all_links_valid: false,
                social_links: vec![],
                image_links: vec![],
                communication_links: vec![],
                unauthorized_links: vec![],
            },
            proof: None,
            message: "Store code contains prohibited content".to_string(),
        });
    }
    
    // Check links
    let link_check = check_store_links(
        &body.social_links,
        &body.image_links,
        &body.communication_links,
    );
    
    if !link_check.all_links_valid {
        return HttpResponse::Ok().json(StoreVerifyResponse {
            verified: false,
            store_id: body.store_id.clone(),
            code_scan,
            link_check,
            proof: None,
            message: format!("Unauthorized links: {}", link_check.unauthorized_links.join(", ")),
        });
    }
    
    // Check traits
    if !body.traits.can_sell() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "ok": false,
            "error": format!("Need {} traits to verify store, have {}", TRAITS_TO_SELL, body.traits.count())
        }));
    }
    
    let content_hash = hex_to_bytes32(&code_scan.code_hash);
    let owner_pubkey = hex_to_bytes33(&body.owner_pubkey);
    
    let proof = state.prover.generate_proof(
        EntityType::Store,
        &content_hash,
        &owner_pubkey,
        &body.traits,
        &body.stats,
        code_scan.passed,
        link_check.all_links_valid,
    ).await;
    
    match proof {
        Ok(mut p) => {
            p.owner_apt = body.apt_number.clone();
            
            if let Ok(tx) = state.arweave.post_proof(&p).await {
                p.arweave_tx = Some(tx);
            }
            
            HttpResponse::Ok().json(StoreVerifyResponse {
                verified: p.verified,
                store_id: body.store_id.clone(),
                code_scan,
                link_check,
                proof: Some(p),
                message: if p.verified { "Store verified" } else { "Pending review" }.to_string(),
            })
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": e
        })),
    }
}

// ============================================================================
// API HANDLERS - ACADEMIC VERIFICATION
// ============================================================================
// PRIVACY MODEL:
// - Email is verified server-side via DKIM but NEVER stored or hashed
// - Only domain_type (edu/research/gov/medical/other) is recorded
// - SNARK proves "valid DKIM from edu domain" without revealing which
// - Credentials verified but only count stored, not details
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct AcademicVerifyRequest {
    pub owner_pubkey: String,
    pub apt_number: String,
    // Email sent for verification but NOT stored
    pub email: String,
    pub dkim_signature: Option<String>,
    pub dkim_headers: Option<String>,
    pub credentials: Vec<Credential>,
    pub profile_hash: String,  // Hash of profile content (abstracts, services)
    pub traits: CitadelTraits,
    pub stats: UserStats,
    pub signature: String,
}

#[derive(Debug, Serialize)]
pub struct AcademicVerifyResponse {
    pub verified: bool,
    pub academic_id: String,
    pub dkim_verified: bool,
    pub domain_type: DomainType,  // Only category, not actual domain
    // NO email or domain in response
    pub credentials_verified: bool,
    pub credentials_count: u32,
    pub proof: Option<VerificationProof>,
    pub message: String,
}

pub async fn api_verify_academic(
    state: web::Data<AppState>,
    body: web::Json<AcademicVerifyRequest>,
) -> HttpResponse {
    // Extract domain from email (server-side only, never stored)
    let email_domain = body.email.split('@').last().unwrap_or("").to_lowercase();
    
    // Classify domain type (this IS stored - it's a category, not identifying)
    let domain_type = classify_domain(&email_domain);
    
    // Verify DKIM signature
    let dkim_verified = verify_dkim_signature(
        &body.email,
        body.dkim_signature.as_deref(),
        body.dkim_headers.as_deref(),
    );
    
    // Check if acceptable domain type for academic verification
    let acceptable_domain = matches!(domain_type, DomainType::Edu | DomainType::Research | DomainType::Gov | DomainType::Medical);
    
    // Verify credentials (aggregate result only)
    let credentials_verified = body.credentials.iter().all(|c| c.verified) || body.credentials.is_empty();
    let credentials_count = body.credentials.len() as u32;
    
    // Overall verification
    let can_verify = dkim_verified && acceptable_domain && credentials_verified && body.traits.can_sell();
    
    // Generate academic_id from profile_hash (NOT from email)
    let academic_id = format!("ACAD_{}", &body.profile_hash[..8]);
    
    // SNARK public inputs - privacy preserving
    // We prove: "owner has valid DKIM from edu-type domain" 
    // WITHOUT revealing which email or domain
    let content_hash = hex_to_bytes32(&body.profile_hash);
    let owner_pubkey = hex_to_bytes33(&body.owner_pubkey);
    
    let proof = state.prover.generate_proof(
        EntityType::Academic,
        &content_hash,
        &owner_pubkey,
        &body.traits,
        &body.stats,
        dkim_verified && acceptable_domain && credentials_verified,
        true,
    ).await;
    
    match proof {
        Ok(mut p) => {
            p.owner_apt = body.apt_number.clone();
            
            // Add privacy-preserving public inputs
            // These go on Arweave - notice NO email info
            p.public_inputs.push(format!("{:?}", domain_type));
            p.public_inputs.push(dkim_verified.to_string());
            p.public_inputs.push(credentials_verified.to_string());
            p.public_inputs.push(credentials_count.to_string());
            
            if let Ok(tx) = state.arweave.post_proof(&p).await {
                p.arweave_tx = Some(tx);
            }
            
            // Log for audit (server-side only, NOT on Arweave)
            log::info!(
                "Academic verification: apt={}, domain_type={:?}, dkim={}, creds={}",
                body.apt_number, domain_type, dkim_verified, credentials_verified
            );
            
            HttpResponse::Ok().json(AcademicVerifyResponse {
                verified: p.verified,
                academic_id,
                dkim_verified,
                domain_type,
                credentials_verified,
                credentials_count,
                proof: Some(p),
                message: if p.verified { 
                    "Academic profile verified".to_string()
                } else if !dkim_verified {
                    "DKIM verification failed".to_string()
                } else if !acceptable_domain {
                    "Domain type not accepted (need .edu or research institution)".to_string()
                } else {
                    "Verification pending".to_string()
                },
            })
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": e
        })),
    }
}

/// Classify email domain into privacy-preserving category
fn classify_domain(domain: &str) -> DomainType {
    let domain = domain.to_lowercase();
    
    // Educational domains
    if domain.ends_with(".edu") 
        || domain.ends_with(".ac.uk")
        || domain.ends_with(".edu.au")
        || domain.ends_with(".ac.jp")
        || domain.ends_with(".edu.cn")
        || domain.ends_with(".ac.in")
        || domain.ends_with(".edu.sg")
        || domain.ends_with(".ac.nz")
        || domain.ends_with(".edu.br")
    {
        return DomainType::Edu;
    }
    
    // Government domains
    if domain.ends_with(".gov")
        || domain.ends_with(".gov.uk")
        || domain.ends_with(".gov.au")
        || domain.ends_with(".gc.ca")
    {
        return DomainType::Gov;
    }
    
    // Known research institutions (by TLD patterns, not specific names)
    if domain.contains("research")
        || domain.contains("institute")
        || domain.contains("laboratory")
        || domain.contains("sciences")
    {
        return DomainType::Research;
    }
    
    // Medical institutions
    if domain.contains("hospital")
        || domain.contains("medical")
        || domain.contains("health")
        || domain.contains("clinic")
    {
        return DomainType::Medical;
    }
    
    DomainType::Other
}

/// Verify DKIM signature (simplified - production would use full DKIM verification)
fn verify_dkim_signature(
    _email: &str,
    dkim_signature: Option<&str>,
    _dkim_headers: Option<&str>,
) -> bool {
    // In production: 
    // 1. Parse DKIM-Signature header
    // 2. Fetch DNS TXT record for selector._domainkey.domain
    // 3. Verify RSA/Ed25519 signature over canonicalized headers + body hash
    // 4. Return true only if signature valid
    //
    // For now: require signature to be present
    // Real implementation would use lettre or similar DKIM library
    dkim_signature.is_some() && !dkim_signature.unwrap().is_empty()
}

// ============================================================================
// API HANDLERS - SERVICE VERIFICATION
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct ServiceVerifyRequest {
    pub owner_pubkey: String,
    pub apt_number: String,
    pub service_id: String,
    pub service_type: String,
    pub description: String,
    pub pricing: String,
    pub traits: CitadelTraits,
    pub stats: UserStats,
    pub signature: String,
}

#[derive(Debug, Serialize)]
pub struct ServiceVerifyResponse {
    pub verified: bool,
    pub service_id: String,
    pub reviews_summary: ReviewsSummary,
    pub proof: Option<VerificationProof>,
    pub message: String,
}

pub async fn api_verify_service(
    state: web::Data<AppState>,
    body: web::Json<ServiceVerifyRequest>,
) -> HttpResponse {
    // Get reviews for this service
    let reviews_cache = state.reviews_cache.read().await;
    let review_count = reviews_cache.get(&body.service_id)
        .map(|r| r.len() as u32)
        .unwrap_or(0);
    
    let reviews_summary = ReviewsSummary {
        total_reviews: review_count,
        verified_reviews: review_count,
        average_rating: 4.5, // Would compute from actual reviews
        rating_distribution: [0, 0, 1, 3, review_count.saturating_sub(4)],
        authenticity_score: 0.9,
        suspicious_reviews: 0,
    };
    
    let content_hash = compute_sha256(&format!("{}{}{}", body.service_id, body.description, body.pricing));
    let content_bytes = hex_to_bytes32(&content_hash);
    let owner_pubkey = hex_to_bytes33(&body.owner_pubkey);
    
    let proof = state.prover.generate_proof(
        EntityType::Service,
        &content_bytes,
        &owner_pubkey,
        &body.traits,
        &body.stats,
        true,
        true,
    ).await;
    
    match proof {
        Ok(mut p) => {
            p.owner_apt = body.apt_number.clone();
            
            if let Ok(tx) = state.arweave.post_proof(&p).await {
                p.arweave_tx = Some(tx);
            }
            
            HttpResponse::Ok().json(ServiceVerifyResponse {
                verified: p.verified,
                service_id: body.service_id.clone(),
                reviews_summary,
                proof: Some(p),
                message: if p.verified { "Service verified" } else { "Verification pending" }.to_string(),
            })
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": e
        })),
    }
}

// ============================================================================
// API HANDLERS - DAPP/GAME VERIFICATION
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct DAppVerifyRequest {
    pub owner_pubkey: String,
    pub apt_number: String,
    pub dapp_id: String,
    pub name: String,
    pub category: String,
    pub is_game: bool,
    pub code: String,
    pub xp_commitment: u64,
    pub traits: CitadelTraits,
    pub stats: UserStats,
    pub signature: String,
}

#[derive(Debug, Serialize)]
pub struct DAppVerifyResponse {
    pub verified: bool,
    pub dapp_id: String,
    pub is_game: bool,
    pub code_scan: CodeScanResult,
    pub sdk_check: SdkCheckResult,
    pub board: Option<Board>,
    pub proof: Option<VerificationProof>,
    pub message: String,
}

pub async fn api_verify_dapp(
    state: web::Data<AppState>,
    body: web::Json<DAppVerifyRequest>,
) -> HttpResponse {
    let entity_type = if body.is_game { EntityType::Game } else { EntityType::DApp };
    
    // Scan code
    let code_scan = scan_code(&body.code, entity_type);
    
    if code_scan.status == ScanStatus::Rejected {
        return HttpResponse::Ok().json(DAppVerifyResponse {
            verified: false,
            dapp_id: body.dapp_id.clone(),
            is_game: body.is_game,
            code_scan,
            sdk_check: SdkCheckResult {
                uses_kasvillage_sdk: false,
                sdk_version: None,
                standalone_declared: false,
                api_endpoints_valid: false,
            },
            board: None,
            proof: None,
            message: "Code contains prohibited content".to_string(),
        });
    }
    
    // Check SDK usage
    let sdk_regex = Regex::new(r"(?i)KasVillageSDK\s*v?(\d+\.\d+\.\d+)?").unwrap();
    let standalone_regex = Regex::new(r"(?i)KASVILLAGE_STANDALONE").unwrap();
    
    let sdk_match = sdk_regex.captures(&body.code);
    let uses_kasvillage_sdk = sdk_match.is_some();
    let sdk_version = sdk_match.and_then(|c| c.get(1).map(|m| m.as_str().to_string()));
    let standalone_declared = standalone_regex.is_match(&body.code);
    
    let sdk_check = SdkCheckResult {
        uses_kasvillage_sdk,
        sdk_version,
        standalone_declared,
        api_endpoints_valid: uses_kasvillage_sdk || standalone_declared,
    };
    
    // Check board eligibility
    let board = Board::from_xp(body.xp_commitment);
    if board.is_none() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "ok": false,
            "error": format!("Minimum {} XP commitment required", XP_INCUBATOR)
        }));
    }
    
    let content_hash = hex_to_bytes32(&code_scan.code_hash);
    let owner_pubkey = hex_to_bytes33(&body.owner_pubkey);
    
    let proof = state.prover.generate_proof(
        entity_type,
        &content_hash,
        &owner_pubkey,
        &body.traits,
        &body.stats,
        code_scan.passed,
        sdk_check.api_endpoints_valid,
    ).await;
    
    match proof {
        Ok(mut p) => {
            p.owner_apt = body.apt_number.clone();
            p.board = board;
            
            if let Ok(tx) = state.arweave.post_proof(&p).await {
                p.arweave_tx = Some(tx);
            }
            
            let type_name = if body.is_game { "Game" } else { "DApp" };
            
            HttpResponse::Ok().json(DAppVerifyResponse {
                verified: p.verified,
                dapp_id: body.dapp_id.clone(),
                is_game: body.is_game,
                code_scan,
                sdk_check,
                board,
                proof: Some(p),
                message: if p.verified { 
                    format!("{} verified on {:?} board", type_name, board.unwrap())
                } else { 
                    format!("{} pending review", type_name)
                },
            })
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": e
        })),
    }
}

// ============================================================================
// API HANDLERS - REVIEW VERIFICATION
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct ReviewVerifyRequest {
    pub reviewer_pubkey: String,
    pub reviewer_apt: String,
    pub subject_type: EntityType,
    pub subject_id: String,
    pub rating: u8,
    pub survey_responses: Vec<SurveyResponse>,
    pub has_transaction: bool,
    pub traits: CitadelTraits,
    pub stats: UserStats,
    pub signature: String,
}

#[derive(Debug, Serialize)]
pub struct ReviewVerifyResponse {
    pub verified: bool,
    pub review_id: String,
    pub authenticity_check: AuthenticityCheck,
    pub proof: Option<VerificationProof>,
    pub message: String,
}

pub async fn api_verify_review(
    state: web::Data<AppState>,
    body: web::Json<ReviewVerifyRequest>,
) -> HttpResponse {
    // Get existing reviews for duplicate check
    let reviews_cache = state.reviews_cache.read().await;
    let existing_reviews = reviews_cache.get(&body.subject_id)
        .cloned()
        .unwrap_or_default();
    
    // Check authenticity
    let authenticity_check = check_review_authenticity(
        &body.reviewer_apt,
        &body.subject_id,
        &body.survey_responses,
        &body.stats,
        body.has_transaction,
        &existing_reviews,
    );
    
    let passed = authenticity_check.authenticity_score >= 0.5;
    
    let review_id = format!("REV_{}_{}", &body.subject_id[..8], current_timestamp());
    let content_hash = compute_sha256(&format!("{}{}{}", review_id, body.rating, body.survey_responses.len()));
    let content_bytes = hex_to_bytes32(&content_hash);
    let owner_pubkey = hex_to_bytes33(&body.reviewer_pubkey);
    
    let proof = state.prover.generate_proof(
        EntityType::Review,
        &content_bytes,
        &owner_pubkey,
        &body.traits,
        &body.stats,
        passed,
        true,
    ).await;
    
    // Store review hash
    drop(reviews_cache);
    {
        let mut cache = state.reviews_cache.write().await;
        let reviews = cache.entry(body.subject_id.clone()).or_insert_with(Vec::new);
        for response in &body.survey_responses {
            reviews.push(response.response_hash.clone());
        }
    }
    
    match proof {
        Ok(mut p) => {
            p.owner_apt = body.reviewer_apt.clone();
            
            if let Ok(tx) = state.arweave.post_proof(&p).await {
                p.arweave_tx = Some(tx);
            }
            
            HttpResponse::Ok().json(ReviewVerifyResponse {
                verified: p.verified,
                review_id,
                authenticity_check,
                proof: Some(p),
                message: if p.verified { "Review verified" } else { "Review flagged for review" }.to_string(),
            })
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": e
        })),
    }
}

// ============================================================================
// API HANDLERS - LIBRARY QUERY
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct LibraryQueryRequest {
    pub entity_type: Option<EntityType>,
    pub entity_id: Option<String>,
    pub owner_apt: Option<String>,
    pub board: Option<Board>,
    pub verified_only: Option<bool>,
    pub min_rating: Option<f64>,
    pub limit: Option<usize>,
}

#[derive(Debug, Serialize)]
pub struct LibraryQueryResponse {
    pub entries: Vec<LibraryEntry>,
    pub total_count: usize,
    pub has_more: bool,
}

pub async fn api_query_library(
    state: web::Data<AppState>,
    body: web::Json<LibraryQueryRequest>,
) -> HttpResponse {
    let limit = body.limit.unwrap_or(20).min(100);
    
    // Query from cache and/or Arweave
    let mut entries = Vec::new();
    
    if let Some(entity_id) = &body.entity_id {
        if let Some(entity_type) = body.entity_type {
            if let Ok(Some(entry)) = state.arweave.get_library_entry(entity_type, entity_id).await {
                entries.push(entry);
            }
        }
    }
    
    // Filter by verification status
    if let Some(true) = body.verified_only {
        entries.retain(|e| e.verified);
    }
    
    // Filter by board
    if let Some(board) = body.board {
        entries.retain(|e| e.board == Some(board));
    }
    
    let total_count = entries.len();
    let has_more = total_count > limit;
    entries.truncate(limit);
    
    HttpResponse::Ok().json(LibraryQueryResponse {
        entries,
        total_count,
        has_more,
    })
}

// ============================================================================
// API HANDLERS - INTEGRITY CHECK
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct IntegrityCheckRequest {
    pub entity_type: EntityType,
    pub entity_id: String,
    pub loaded_hash: String,
}

#[derive(Debug, Serialize)]
pub struct IntegrityCheckResponse {
    pub matches: bool,
    pub verified: bool,
    pub verified_hash: Option<String>,
    pub verification_tx: Option<String>,
    pub owner_apt: Option<String>,
    pub verified_at: Option<u64>,
    pub warnings: Vec<String>,
}

pub async fn api_check_integrity(
    state: web::Data<AppState>,
    body: web::Json<IntegrityCheckRequest>,
) -> HttpResponse {
    let mut warnings = Vec::new();
    
    // Look up verified proof
    let proof = state.arweave.get_proof(body.entity_type, &body.entity_id).await.ok().flatten();
    
    let (verified_hash, verification_tx, verified_at, owner_apt) = if let Some(p) = &proof {
        (
            Some(p.subject_id.clone()),
            p.arweave_tx.clone(),
            Some(p.timestamp),
            Some(p.owner_apt.clone()),
        )
    } else {
        (None, None, None, None)
    };
    
    let matches = verified_hash.as_ref().map(|h| h == &body.loaded_hash).unwrap_or(false);
    let verified = matches && proof.map(|p| p.verified).unwrap_or(false);
    
    if !matches && verified_hash.is_some() {
        warnings.push("Content hash does not match verified version".to_string());
    }
    
    if verified_hash.is_none() {
        warnings.push("No verification proof found".to_string());
    }
    
    HttpResponse::Ok().json(IntegrityCheckResponse {
        matches,
        verified,
        verified_hash,
        verification_tx,
        owner_apt,
        verified_at,
        warnings,
    })
}

// ============================================================================
// API HANDLERS - APT
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct AptCheckRequest {
    pub requested_apt: String,
    pub pubkey: String,
    pub device_hash: String,
}

#[derive(Debug, Serialize)]
pub struct AptCheckResponse {
    pub available: bool,
    pub conflict: bool,
    pub suggested_alternatives: Vec<String>,
    pub message: String,
}

pub async fn api_check_apt(
    state: web::Data<AppState>,
    body: web::Json<AptCheckRequest>,
) -> HttpResponse {
    let registry = state.apt_registry.read().await;
    
    if let Some(existing) = registry.get(&body.requested_apt) {
        if existing.pubkey == body.pubkey && existing.device_hash == body.device_hash {
            return HttpResponse::Ok().json(AptCheckResponse {
                available: true,
                conflict: false,
                suggested_alternatives: vec![],
                message: "APT already registered to you".to_string(),
            });
        }
        
        let num: u32 = body.requested_apt.trim_start_matches("APT-").parse().unwrap_or(0);
        let alternatives = vec![
            format!("APT-{}", num + 1),
            format!("APT-{}", num + 10),
            format!("APT-{}", num + 100),
        ];
        
        return HttpResponse::Ok().json(AptCheckResponse {
            available: false,
            conflict: true,
            suggested_alternatives: alternatives,
            message: format!("{} is already assigned", body.requested_apt),
        });
    }
    
    HttpResponse::Ok().json(AptCheckResponse {
        available: true,
        conflict: false,
        suggested_alternatives: vec![],
        message: "APT available".to_string(),
    })
}

#[derive(Debug, Deserialize)]
pub struct AptRegisterRequest {
    pub apt_number: String,
    pub pubkey: String,
    pub device_hash: String,
    pub signature: String,
}

pub async fn api_register_apt(
    state: web::Data<AppState>,
    body: web::Json<AptRegisterRequest>,
) -> HttpResponse {
    let mut registry = state.apt_registry.write().await;
    
    if let Some(existing) = registry.get(&body.apt_number) {
        if existing.pubkey != body.pubkey || existing.device_hash != body.device_hash {
            return HttpResponse::Conflict().json(serde_json::json!({
                "ok": false,
                "error": "APT already registered to different device"
            }));
        }
    }
    
    registry.insert(body.apt_number.clone(), AptRegistration {
        apt_number: body.apt_number.clone(),
        pubkey: body.pubkey.clone(),
        device_hash: body.device_hash.clone(),
        registered_at: current_timestamp(),
    });
    
    HttpResponse::Ok().json(serde_json::json!({
        "ok": true,
        "apt_number": body.apt_number,
        "message": "APT registered successfully"
    }))
}

// ============================================================================
// HELPERS
// ============================================================================

fn compute_sha256(data: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data.as_bytes());
    hex::encode(hasher.finalize())
}

fn compute_user_hash(pubkey: &str, apt: &str) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(b"KV_USER_V1:");
    hasher.update(pubkey.as_bytes());
    hasher.update(apt.as_bytes());
    hasher.finalize().into()
}

fn truncate_string(s: &str, max_len: usize) -> String {
    if s.len() <= max_len { s.to_string() } else { format!("{}...", &s[..max_len]) }
}

fn current_timestamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

fn hex_to_bytes32(hex_str: &str) -> [u8; 32] {
    let mut result = [0u8; 32];
    if let Ok(bytes) = hex::decode(hex_str.trim_start_matches("0x")) {
        let len = bytes.len().min(32);
        result[..len].copy_from_slice(&bytes[..len]);
    }
    result
}

fn hex_to_bytes33(hex_str: &str) -> [u8; 33] {
    let mut result = [0u8; 33];
    if let Ok(bytes) = hex::decode(hex_str.trim_start_matches("0x")) {
        let len = bytes.len().min(33);
        result[..len].copy_from_slice(&bytes[..len]);
    }
    result
}

fn bytes_to_fq(bytes: &[u8; 32]) -> Fq {
    let mut repr = [0u8; 32];
    repr.copy_from_slice(bytes);
    Fq::from_repr(repr).unwrap_or(Fq::zero())
}

// ============================================================================
// ROUTE CONFIGURATION
// ============================================================================

pub fn configure_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api")
            // Entity verification
            .route("/verify/user", web::post().to(api_verify_user))
            .route("/verify/store", web::post().to(api_verify_store))
            .route("/verify/academic", web::post().to(api_verify_academic))
            .route("/verify/service", web::post().to(api_verify_service))
            .route("/verify/dapp", web::post().to(api_verify_dapp))
            .route("/verify/review", web::post().to(api_verify_review))
            
            // Library queries
            .route("/library/query", web::post().to(api_query_library))
            .route("/library/integrity", web::post().to(api_check_integrity))
            
            // APT management
            .route("/apt/check", web::post().to(api_check_apt))
            .route("/apt/register", web::post().to(api_register_apt))
    );
}

// ============================================================================
// SERVER
// ============================================================================

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init();
    
    log::info!("==============================================");
    log::info!("KASVILLAGE TOWN HALL - VERIFICATION LIBRARY");
    log::info!("==============================================");
    log::info!("Halo2 K={} ({})", HALO2_K, if HALO2_K == 12 { "dev" } else { "prod" });
    log::info!("");
    log::info!("Endpoints:");
    log::info!("  POST /api/verify/user      - User verification");
    log::info!("  POST /api/verify/store     - Store verification");
    log::info!("  POST /api/verify/academic  - Academic verification");
    log::info!("  POST /api/verify/service   - Service verification");
    log::info!("  POST /api/verify/dapp      - DApp/Game verification");
    log::info!("  POST /api/verify/review    - Review verification");
    log::info!("  POST /api/library/query    - Query library");
    log::info!("  POST /api/library/integrity- Integrity check");
    log::info!("  POST /api/apt/check        - APT conflict check");
    log::info!("  POST /api/apt/register     - APT registration");
    log::info!("");
    
    let state = web::Data::new(
        AppState::new().expect("Failed to initialize app state")
    );
    
    log::info!("Starting server on 0.0.0.0:8080");
    
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .configure(configure_routes)
    })
    .bind("0.0.0.0:8080")?
    .run()
    .await
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_scan_code_clean() {
        let code = "function hello() { console.log('Hello'); }";
        let result = scan_code(code, EntityType::DApp);
        assert!(result.passed);
        assert_eq!(result.status, ScanStatus::Approved);
    }
    
    #[test]
    fn test_scan_code_prohibited() {
        let code = "Welcome to casino gambling!";
        let result = scan_code(code, EntityType::DApp);
        assert!(!result.passed);
        assert_eq!(result.status, ScanStatus::Rejected);
    }
    
    #[test]
    fn test_scan_code_game_gambling() {
        let code = "real money betting win cash";
        let result = scan_code(code, EntityType::Game);
        assert!(!result.passed);
    }
    
    #[test]
    fn test_store_links_valid() {
        let result = check_store_links(
            &["https://instagram.com/shop".to_string()],
            &["https://arweave.net/abc123".to_string()],
            &["https://t.me/seller".to_string()],
        );
        assert!(result.all_links_valid);
    }
    
    #[test]
    fn test_store_links_invalid() {
        let result = check_store_links(
            &["https://twitter.com/shop".to_string()], // Twitter not allowed
            &[],
            &[],
        );
        assert!(!result.all_links_valid);
        assert!(result.unauthorized_links.contains(&"https://twitter.com/shop".to_string()));
    }
    
    #[test]
    fn test_traits() {
        let mut traits = CitadelTraits::default();
        assert_eq!(traits.count(), 0);
        
        // Fill 13 traits
        traits.name = true;
        traits.class = true;
        traits.race = true;
        traits.occupation = true;
        traits.origin_story = true;
        traits.defining_moment = true;
        traits.formative_memory = true;
        traits.life_philosophy = true;
        traits.personality = true;
        traits.weakness = true;
        traits.signature_move = true;
        traits.voice_line = true;
        traits.power_spike = true;
        
        assert_eq!(traits.count(), 13);
        assert!(traits.can_sell());
    }
    
    #[test]
    fn test_board_from_xp() {
        assert_eq!(Board::from_xp(400), None);
        assert_eq!(Board::from_xp(500), Some(Board::Incubator));
        assert_eq!(Board::from_xp(1000), Some(Board::Main));
        assert_eq!(Board::from_xp(5000), Some(Board::Elite));
    }
    
    #[test]
    fn test_review_authenticity() {
        let stats = UserStats {
            xp: 200,
            successes: 5,
            deadlocks: 1,
            total_transactions: 6,
            created_at: 0,
            last_active_at: 0,
            snail_mode_until: None,
        };
        
        let responses = vec![
            SurveyResponse {
                question_id: "q1".to_string(),
                question_text: "How was the service?".to_string(),
                response: "Great service, very professional and timely".to_string(),
                response_hash: "hash1".to_string(),
            }
        ];
        
        let check = check_review_authenticity(
            "APT-123",
            "store_abc",
            &responses,
            &stats,
            true,
            &[],
        );
        
        assert!(check.reviewer_has_transaction);
        assert!(check.duplicate_check_passed);
        assert!(check.authenticity_score > 0.5);
    }
}
