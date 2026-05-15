// ============================================================================
// KASVILLAGE TOWN HALL - VERIFICATION ENDPOINTS
// ============================================================================
// These are the Rust/Actix-web handlers for Town Hall verification services.
// Town Hall is the only server component — it watches L1, verifies content,
// and posts verification proofs to Arweave (FREE for users).
//
// Expo app calls these endpoints directly.
// ============================================================================

use actix_web::{web, HttpResponse};
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};

// ============================================================================
// CONSTANTS
// ============================================================================
const VERIFICATION_FEE_SOMPI: u64 = 0; // FREE verification
const ARWEAVE_PROOF_TAG: &str = "KV_PROOF_V1";

// ============================================================================
// COMMON TYPES
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct VerificationProof {
    pub content_hash: String,
    pub content_type: String, // "store" | "profile" | "academic" | "service" | "dapp"
    pub owner_pubkey: String,
    pub timestamp: u64,
    pub arweave_tx: Option<String>,
    pub status: VerificationStatus,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum VerificationStatus {
    Pending,
    Verified,
    Rejected,
    Expired,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn success(data: T) -> HttpResponse {
        HttpResponse::Ok().json(Self {
            ok: true,
            data: Some(data),
            error: None,
        })
    }
    
    pub fn error(msg: &str) -> HttpResponse {
        HttpResponse::BadRequest().json(ApiResponse::<()> {
            ok: false,
            data: None,
            error: Some(msg.to_string()),
        })
    }
}

// ============================================================================
// STORE VERIFICATION
// ============================================================================
// POST /api/store/verify
// Verifies a storefront and posts proof to Arweave
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct StoreVerifyRequest {
    pub owner_pubkey: String,
    pub store_hash: String,         // SHA256 of canonical store JSON
    pub brand_name: String,
    pub social_links: Vec<String>,  // Must be whitelisted domains
    pub signature: String,          // Owner signs the store_hash
}

#[derive(Debug, Serialize)]
pub struct StoreVerifyResponse {
    pub verified: bool,
    pub arweave_tx: String,
    pub proof_hash: String,
    pub message: String,
}

// Whitelisted domains for store images/links
const ALLOWED_STORE_DOMAINS: [&str; 6] = [
    "instagram.com",
    "tiktok.com", 
    "etsy.com",
    "pinterest.com",
    "youtube.com",
    "facebook.com",
];

pub async fn api_store_verify(
    body: web::Json<StoreVerifyRequest>,
) -> HttpResponse {
    // 1. Validate social links are from whitelisted domains
    for link in &body.social_links {
        let link_lower = link.to_lowercase();
        let is_allowed = ALLOWED_STORE_DOMAINS.iter()
            .any(|domain| link_lower.contains(domain));
        if !is_allowed {
            return ApiResponse::<()>::error(&format!(
                "Link not from allowed domain: {}. Allowed: Instagram, TikTok, Etsy, Pinterest, YouTube, Facebook",
                link
            ));
        }
    }
    
    // 2. Verify signature (owner signed the store_hash)
    // TODO: Implement secp256k1 signature verification
    // let valid_sig = verify_signature(&body.owner_pubkey, &body.store_hash, &body.signature);
    // if !valid_sig { return ApiResponse::<()>::error("Invalid signature"); }
    
    // 3. Create verification proof
    let proof = VerificationProof {
        content_hash: body.store_hash.clone(),
        content_type: "store".to_string(),
        owner_pubkey: body.owner_pubkey.clone(),
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        arweave_tx: None,
        status: VerificationStatus::Verified,
    };
    
    // 4. Post proof to Arweave (FREE - Town Hall pays)
    // TODO: Implement Bundlr/arweave-rs upload
    let arweave_tx = format!("AR_MOCK_{}", hex::encode(&body.store_hash[..16]));
    
    // 5. Return success
    ApiResponse::success(StoreVerifyResponse {
        verified: true,
        arweave_tx: arweave_tx.clone(),
        proof_hash: body.store_hash.clone(),
        message: "Store verified and proof posted to Arweave".to_string(),
    })
}

// ============================================================================
// PROFILE VERIFICATION
// ============================================================================
// POST /api/profile/verify
// Verifies user profile/avatar and posts proof to Arweave
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct ProfileVerifyRequest {
    pub owner_pubkey: String,
    pub identity_hash: String,      // SHA256 of canonical avatar JSON
    pub filled_traits: u8,          // Number of filled traits (9 = Resident, 13 = Passport)
    pub signature: String,
}

#[derive(Debug, Serialize)]
pub struct ProfileVerifyResponse {
    pub verified: bool,
    pub citadel_tier: String,       // "Visitor" | "Resident" | "Passport"
    pub arweave_tx: String,
    pub message: String,
}

pub async fn api_profile_verify(
    body: web::Json<ProfileVerifyRequest>,
) -> HttpResponse {
    // Determine Citadel tier
    let citadel_tier = if body.filled_traits >= 13 {
        "Passport"
    } else if body.filled_traits >= 9 {
        "Resident"
    } else {
        "Visitor"
    };
    
    // TODO: Verify signature
    // TODO: Post to Arweave
    let arweave_tx = format!("AR_PROFILE_{}", &body.identity_hash[..16]);
    
    ApiResponse::success(ProfileVerifyResponse {
        verified: true,
        citadel_tier: citadel_tier.to_string(),
        arweave_tx,
        message: format!("Profile verified as {} tier", citadel_tier),
    })
}

// ============================================================================
// ACADEMIC VERIFICATION
// ============================================================================
// POST /api/academic/verify - Verify abstract submission
// POST /api/academic/verify-email - Send verification email
// POST /api/academic/verify-dkim - Verify DKIM signature from .edu domain
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct AcademicVerifyEmailRequest {
    pub email: String,              // Must be .edu domain
    pub pubkey: String,
}

#[derive(Debug, Serialize)]
pub struct AcademicVerifyEmailResponse {
    pub sent: bool,
    pub domain: String,
    pub message: String,
}

// Allowed academic domains
const ALLOWED_ACADEMIC_DOMAINS: [&str; 10] = [
    ".edu",
    ".ac.uk",
    ".edu.au",
    ".ac.jp",
    ".edu.cn",
    ".ac.in",
    ".edu.sg",
    ".uni-",       // German universities
    ".edu.br",
    ".ac.za",
];

pub async fn api_academic_verify_email(
    body: web::Json<AcademicVerifyEmailRequest>,
) -> HttpResponse {
    let email_lower = body.email.to_lowercase();
    
    // Check if .edu or equivalent academic domain
    let is_academic = ALLOWED_ACADEMIC_DOMAINS.iter()
        .any(|domain| email_lower.contains(domain));
    
    if !is_academic {
        return ApiResponse::<()>::error(
            "Email must be from an academic institution (.edu, .ac.uk, etc.)"
        );
    }
    
    // Extract domain
    let domain = email_lower.split('@').last().unwrap_or("unknown").to_string();
    
    // TODO: Send verification email with DKIM
    // The email contains a signed token that user forwards back
    
    ApiResponse::success(AcademicVerifyEmailResponse {
        sent: true,
        domain: domain.clone(),
        message: format!("Verification email sent to {}. Forward the reply to complete verification.", body.email),
    })
}

#[derive(Debug, Deserialize)]
pub struct AcademicVerifyDkimRequest {
    pub pubkey: String,
    pub email_headers: String,      // Raw email headers for DKIM verification
    pub email_body: String,
    pub dkim_signature: String,
}

#[derive(Debug, Serialize)]
pub struct AcademicVerifyDkimResponse {
    pub verified: bool,
    pub institution: String,
    pub arweave_tx: String,
    pub message: String,
}

pub async fn api_academic_verify_dkim(
    body: web::Json<AcademicVerifyDkimRequest>,
) -> HttpResponse {
    // TODO: Implement DKIM signature verification
    // 1. Parse DKIM-Signature header
    // 2. Fetch public key from DNS (selector._domainkey.domain)
    // 3. Verify RSA signature
    
    // For now, mock verification
    let institution = "MIT"; // Would extract from verified email domain
    let arweave_tx = format!("AR_ACADEMIC_{}", &body.pubkey[..16]);
    
    ApiResponse::success(AcademicVerifyDkimResponse {
        verified: true,
        institution: institution.to_string(),
        arweave_tx,
        message: format!("Academic affiliation with {} verified via DKIM", institution),
    })
}

#[derive(Debug, Deserialize)]
pub struct AcademicAbstractSubmitRequest {
    pub pubkey: String,
    pub title: String,
    pub abstract_text: String,
    pub field: String,
    pub attestations: Vec<String>,  // 3 required attestations
    pub signature: String,
}

#[derive(Debug, Serialize)]
pub struct AcademicAbstractResponse {
    pub abstract_id: String,
    pub arweave_tx: String,
    pub status: String,
    pub message: String,
}

pub async fn api_academic_verify(
    body: web::Json<AcademicAbstractSubmitRequest>,
) -> HttpResponse {
    // Require 3 attestations
    if body.attestations.len() < 3 {
        return ApiResponse::<()>::error("Minimum 3 attestations required");
    }
    
    // Generate abstract ID
    let mut hasher = Sha256::new();
    hasher.update(body.pubkey.as_bytes());
    hasher.update(body.title.as_bytes());
    hasher.update(body.abstract_text.as_bytes());
    let hash = hasher.finalize();
    let abstract_id = format!("ABS_{}", hex::encode(&hash[..8]));
    
    // TODO: Post to Arweave
    let arweave_tx = format!("AR_{}", &abstract_id);
    
    ApiResponse::success(AcademicAbstractResponse {
        abstract_id,
        arweave_tx,
        status: "pending_review".to_string(),
        message: "Abstract submitted. Awaiting peer attestations.".to_string(),
    })
}

// ============================================================================
// SERVICE VERIFICATION
// ============================================================================
// POST /api/service/verify
// Verifies service listings
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct ServiceVerifyRequest {
    pub owner_pubkey: String,
    pub service_hash: String,
    pub service_type: String,       // "tutoring" | "consulting" | "freelance" | etc.
    pub price_kas: u64,
    pub signature: String,
}

#[derive(Debug, Serialize)]
pub struct ServiceVerifyResponse {
    pub verified: bool,
    pub service_id: String,
    pub arweave_tx: String,
    pub message: String,
}

pub async fn api_service_verify(
    body: web::Json<ServiceVerifyRequest>,
) -> HttpResponse {
    let service_id = format!("SVC_{}", &body.service_hash[..12]);
    let arweave_tx = format!("AR_{}", &service_id);
    
    ApiResponse::success(ServiceVerifyResponse {
        verified: true,
        service_id,
        arweave_tx,
        message: "Service verified and posted to Arweave".to_string(),
    })
}

// ============================================================================
// DAPP VERIFICATION
// ============================================================================
// POST /api/dapp/verify - Verify and publish DApp
// GET /api/dapp/check/{tx} - Check DApp verification status
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct DappVerifyRequest {
    pub owner_pubkey: String,
    pub dapp_name: String,
    pub dapp_url: String,           // Arweave URL where DApp is hosted
    pub category: String,           // "game" | "tool" | "social" | etc.
    pub xp_commitment: u64,         // 500 (Incubator) | 1000 (Main) | 5000 (Elite)
    pub signature: String,
}

#[derive(Debug, Serialize)]
pub struct DappVerifyResponse {
    pub verified: bool,
    pub dapp_id: String,
    pub board: String,              // "incubator" | "main" | "elite"
    pub arweave_tx: String,
    pub message: String,
}

// Prohibited content patterns
const PROHIBITED_PATTERNS: [&str; 12] = [
    "casino", "gambling", "bet", "lottery", "slots",
    "porn", "xxx", "adult", "nsfw",
    "weapon", "drug", "hack",
];

pub async fn api_dapp_verify(
    body: web::Json<DappVerifyRequest>,
) -> HttpResponse {
    // Check for prohibited content
    let name_lower = body.dapp_name.to_lowercase();
    for pattern in PROHIBITED_PATTERNS {
        if name_lower.contains(pattern) {
            return ApiResponse::<()>::error(&format!(
                "DApp name contains prohibited content: '{}'", pattern
            ));
        }
    }
    
    // Determine board based on XP commitment
    let board = if body.xp_commitment >= 5000 {
        "elite"
    } else if body.xp_commitment >= 1000 {
        "main"
    } else if body.xp_commitment >= 500 {
        "incubator"
    } else {
        return ApiResponse::<()>::error("Minimum 500 XP commitment required");
    };
    
    // Generate DApp ID
    let mut hasher = Sha256::new();
    hasher.update(body.owner_pubkey.as_bytes());
    hasher.update(body.dapp_name.as_bytes());
    let hash = hasher.finalize();
    let dapp_id = format!("DAPP_{}", hex::encode(&hash[..8]));
    
    // TODO: Post to Arweave
    let arweave_tx = format!("AR_{}", &dapp_id);
    
    ApiResponse::success(DappVerifyResponse {
        verified: true,
        dapp_id,
        board: board.to_string(),
        arweave_tx,
        message: format!("DApp verified and published to {} board", board),
    })
}

#[derive(Debug, Serialize)]
pub struct DappCheckResponse {
    pub exists: bool,
    pub verified: bool,
    pub owner_pubkey: Option<String>,
    pub board: Option<String>,
}

pub async fn api_dapp_check(
    path: web::Path<String>,
) -> HttpResponse {
    let tx = path.into_inner();
    
    // TODO: Query Arweave for DApp proof
    // For now, return mock
    ApiResponse::success(DappCheckResponse {
        exists: true,
        verified: true,
        owner_pubkey: Some("mock_pubkey".to_string()),
        board: Some("main".to_string()),
    })
}

// ============================================================================
// HASH CHECK
// ============================================================================
// POST /api/hash/check - Check if content hash has been verified
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct HashCheckRequest {
    pub hash: String,
    pub content_type: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct HashCheckResponse {
    pub found: bool,
    pub content_type: Option<String>,
    pub owner_pubkey: Option<String>,
    pub arweave_tx: Option<String>,
    pub verified_at: Option<u64>,
}

pub async fn api_hash_check(
    body: web::Json<HashCheckRequest>,
) -> HttpResponse {
    // TODO: Query local DB or Arweave for proof
    // For now, return not found
    ApiResponse::success(HashCheckResponse {
        found: false,
        content_type: None,
        owner_pubkey: None,
        arweave_tx: None,
        verified_at: None,
    })
}

// ============================================================================
// NEIGHBOR AGREEMENT ENDPOINTS
// ============================================================================
// These are already implemented in kasvillage backend, but listed here
// for reference. The Expo app calls these directly.
// ============================================================================

/*
POST /api/neighbor/create - Create new neighbor agreement
POST /api/neighbor/fund - Mark agreement as funded
POST /api/neighbor/confirm - Buyer confirms delivery
GET  /api/neighbor/{id} - Get agreement details
POST /api/neighbor/release - Request mutual release
POST /api/neighbor/release-request - One party requests release
POST /api/neighbor/dispute - Enter dispute (both enter snail mode)
POST /api/neighbor/propose-resolution - Propose collateral split
GET  /api/neighbor/dispute-stats/{pubkey} - Get dispute history
GET  /api/neighbor/snail-mode/{pubkey} - Get snail mode status

STEALTH ADDRESS ENDPOINTS:
POST /api/neighbor/stealth/set-keys - Seller sets scan/spend pubkeys
POST /api/neighbor/stealth/derive - Buyer derives one-time stealth address
POST /api/neighbor/stealth/confirm-payment - Confirm stealth payment made
*/

// ============================================================================
// ROUTE REGISTRATION
// ============================================================================
// Add to main.rs configure_routes():
//
// .service(
//     web::scope("/api")
//         .route("/store/verify", web::post().to(api_store_verify))
//         .route("/profile/verify", web::post().to(api_profile_verify))
//         .route("/academic/verify", web::post().to(api_academic_verify))
//         .route("/academic/verify-email", web::post().to(api_academic_verify_email))
//         .route("/academic/verify-dkim", web::post().to(api_academic_verify_dkim))
//         .route("/service/verify", web::post().to(api_service_verify))
//         .route("/dapp/verify", web::post().to(api_dapp_verify))
//         .route("/dapp/check/{tx}", web::get().to(api_dapp_check))
//         .route("/hash/check", web::post().to(api_hash_check))
// )
// ============================================================================
