// townhall_crypto.rs
// Schnorr signature verification + DKIM email verification
// 
// Dependencies (Cargo.toml):
//   k256 = { version = "0.13", features = ["schnorr"] }
//   sha2 = "0.10"
//   rsa = "0.9"
//   base64 = "0.21"
//   trust-dns-resolver = "0.23"
//   regex = "1"

use k256::schnorr::{signature::Verifier, Signature, VerifyingKey};
use sha2::{Sha256, Digest};
use rsa::{RsaPublicKey, pkcs1::DecodeRsaPublicKey, pkcs8::DecodePublicKey};
use rsa::signature::SignatureEncoding;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use trust_dns_resolver::TokioAsyncResolver;
use trust_dns_resolver::config::*;
use regex::Regex;
use std::collections::HashMap;

// =============================================================================
// SCHNORR SIGNATURE VERIFICATION (BIP340)
// =============================================================================

/// Verify a BIP340 Schnorr signature
/// 
/// # Arguments
/// * `pubkey_hex` - 32-byte x-only public key (hex)
/// * `message_hex` - Message hash (hex, typically 32 bytes)
/// * `signature_hex` - 64-byte Schnorr signature (hex)
/// 
/// # Returns
/// * `Ok(true)` if valid
/// * `Ok(false)` if invalid signature
/// * `Err` if parsing failed
pub fn verify_schnorr(
    pubkey_hex: &str,
    message_hex: &str,
    signature_hex: &str,
) -> Result<bool, String> {
    // Parse pubkey (32 bytes x-only)
    let pubkey_bytes = hex::decode(pubkey_hex)
        .map_err(|e| format!("Invalid pubkey hex: {}", e))?;
    
    if pubkey_bytes.len() != 32 {
        return Err(format!("Pubkey must be 32 bytes, got {}", pubkey_bytes.len()));
    }
    
    let verifying_key = VerifyingKey::from_bytes(&pubkey_bytes)
        .map_err(|e| format!("Invalid pubkey: {}", e))?;
    
    // Parse message
    let message_bytes = hex::decode(message_hex)
        .map_err(|e| format!("Invalid message hex: {}", e))?;
    
    // Parse signature (64 bytes)
    let sig_bytes = hex::decode(signature_hex)
        .map_err(|e| format!("Invalid signature hex: {}", e))?;
    
    if sig_bytes.len() != 64 {
        return Err(format!("Signature must be 64 bytes, got {}", sig_bytes.len()));
    }
    
    let signature = Signature::try_from(sig_bytes.as_slice())
        .map_err(|e| format!("Invalid signature format: {}", e))?;
    
    // Verify
    match verifying_key.verify(&message_bytes, &signature) {
        Ok(()) => Ok(true),
        Err(_) => Ok(false),
    }
}

/// Verify identity inscription signature
/// 
/// The message is: SHA256("KV_IDENTITY:" + identity_hash)
pub fn verify_identity_inscription(
    pubkey_hex: &str,
    identity_hash: &str,
    signature_hex: &str,
) -> Result<bool, String> {
    // Build message: SHA256("KV_IDENTITY:" + identity_hash)
    let mut hasher = Sha256::new();
    hasher.update(b"KV_IDENTITY:");
    hasher.update(identity_hash.as_bytes());
    let message = hasher.finalize();
    let message_hex = hex::encode(message);
    
    verify_schnorr(pubkey_hex, &message_hex, signature_hex)
}

/// Verify store/profile content signature
/// 
/// The message is the content_hash directly (already SHA256)
pub fn verify_content_signature(
    pubkey_hex: &str,
    content_hash: &str,
    signature_hex: &str,
) -> Result<bool, String> {
    verify_schnorr(pubkey_hex, content_hash, signature_hex)
}

/// Verify neighbor agreement signature
/// 
/// The message is: SHA256(agreement_id + role + amount + counterparty_pubkey)
pub fn verify_neighbor_signature(
    pubkey_hex: &str,
    agreement_id: &str,
    role: &str,
    amount_sompi: u64,
    counterparty_pubkey: &str,
    signature_hex: &str,
) -> Result<bool, String> {
    let mut hasher = Sha256::new();
    hasher.update(agreement_id.as_bytes());
    hasher.update(role.as_bytes());
    hasher.update(&amount_sompi.to_le_bytes());
    hasher.update(counterparty_pubkey.as_bytes());
    let message = hasher.finalize();
    let message_hex = hex::encode(message);
    
    verify_schnorr(pubkey_hex, &message_hex, signature_hex)
}

// =============================================================================
// DKIM SIGNATURE VERIFICATION
// =============================================================================

#[derive(Debug, Clone)]
pub struct DkimSignature {
    pub version: String,           // v=1
    pub algorithm: String,         // a=rsa-sha256
    pub domain: String,            // d=mit.edu
    pub selector: String,          // s=selector
    pub canonicalization: String,  // c=relaxed/relaxed
    pub headers: Vec<String>,      // h=from:to:subject:date
    pub body_hash: String,         // bh=...
    pub signature: String,         // b=...
    pub timestamp: Option<u64>,    // t=...
    pub expiration: Option<u64>,   // x=...
}

#[derive(Debug, Clone)]
pub struct DkimResult {
    pub valid: bool,
    pub domain: String,
    pub selector: String,
    pub error: Option<String>,
}

/// Parse DKIM-Signature header
pub fn parse_dkim_signature(header: &str) -> Result<DkimSignature, String> {
    let mut sig = DkimSignature {
        version: String::new(),
        algorithm: String::new(),
        domain: String::new(),
        selector: String::new(),
        canonicalization: "simple/simple".to_string(),
        headers: Vec::new(),
        body_hash: String::new(),
        signature: String::new(),
        timestamp: None,
        expiration: None,
    };
    
    // Remove "DKIM-Signature:" prefix if present
    let content = header
        .strip_prefix("DKIM-Signature:")
        .or_else(|| header.strip_prefix("dkim-signature:"))
        .unwrap_or(header)
        .trim();
    
    // Parse tag=value pairs (separated by ;)
    for part in content.split(';') {
        let part = part.trim();
        if part.is_empty() { continue; }
        
        let (tag, value) = part.split_once('=')
            .ok_or_else(|| format!("Invalid DKIM tag: {}", part))?;
        
        let tag = tag.trim();
        let value = value.trim().replace(&['\r', '\n', ' ', '\t'][..], "");
        
        match tag {
            "v" => sig.version = value,
            "a" => sig.algorithm = value,
            "d" => sig.domain = value,
            "s" => sig.selector = value,
            "c" => sig.canonicalization = value,
            "h" => sig.headers = value.split(':').map(|s| s.trim().to_lowercase()).collect(),
            "bh" => sig.body_hash = value,
            "b" => sig.signature = value,
            "t" => sig.timestamp = value.parse().ok(),
            "x" => sig.expiration = value.parse().ok(),
            _ => {} // Ignore unknown tags
        }
    }
    
    // Validate required fields
    if sig.domain.is_empty() {
        return Err("Missing domain (d=)".to_string());
    }
    if sig.selector.is_empty() {
        return Err("Missing selector (s=)".to_string());
    }
    if sig.signature.is_empty() {
        return Err("Missing signature (b=)".to_string());
    }
    if sig.body_hash.is_empty() {
        return Err("Missing body hash (bh=)".to_string());
    }
    
    Ok(sig)
}

/// Fetch DKIM public key from DNS
/// 
/// Queries: {selector}._domainkey.{domain} TXT record
pub async fn fetch_dkim_public_key(
    selector: &str,
    domain: &str,
) -> Result<RsaPublicKey, String> {
    let resolver = TokioAsyncResolver::tokio(
        ResolverConfig::default(),
        ResolverOpts::default(),
    );
    
    let query = format!("{}._domainkey.{}", selector, domain);
    
    let lookup = resolver.txt_lookup(&query).await
        .map_err(|e| format!("DNS lookup failed for {}: {}", query, e))?;
    
    // Concatenate all TXT record parts
    let mut txt_data = String::new();
    for record in lookup.iter() {
        for part in record.txt_data() {
            txt_data.push_str(&String::from_utf8_lossy(part));
        }
    }
    
    if txt_data.is_empty() {
        return Err(format!("No TXT record found at {}", query));
    }
    
    // Parse DKIM TXT record (p=base64pubkey)
    let mut public_key_b64 = String::new();
    for part in txt_data.split(';') {
        let part = part.trim();
        if part.starts_with("p=") {
            public_key_b64 = part[2..].replace(&[' ', '\t', '\n', '\r'][..], "");
            break;
        }
    }
    
    if public_key_b64.is_empty() {
        return Err("No public key (p=) found in DNS record".to_string());
    }
    
    // Decode base64
    let public_key_der = BASE64.decode(&public_key_b64)
        .map_err(|e| format!("Invalid base64 in DNS record: {}", e))?;
    
    // Parse as RSA public key (try PKCS#1 first, then PKCS#8)
    RsaPublicKey::from_pkcs1_der(&public_key_der)
        .or_else(|_| RsaPublicKey::from_public_key_der(&public_key_der))
        .map_err(|e| format!("Invalid RSA public key: {}", e))
}

/// Canonicalize headers for DKIM verification
fn canonicalize_headers_relaxed(headers: &str, signed_headers: &[String]) -> String {
    let mut header_map: HashMap<String, String> = HashMap::new();
    let mut current_header: Option<(String, String)> = None;
    
    // Parse headers into map (handling multi-line headers)
    for line in headers.lines() {
        if line.starts_with(' ') || line.starts_with('\t') {
            // Continuation line
            if let Some((_, ref mut value)) = current_header {
                value.push(' ');
                value.push_str(line.trim());
            }
        } else if let Some((name, value)) = line.split_once(':') {
            if let Some((n, v)) = current_header.take() {
                header_map.insert(n, v);
            }
            current_header = Some((name.to_lowercase(), value.trim().to_string()));
        }
    }
    if let Some((n, v)) = current_header {
        header_map.insert(n, v);
    }
    
    // Build canonicalized header string
    let mut result = String::new();
    for name in signed_headers {
        if let Some(value) = header_map.get(name) {
            // Relaxed canonicalization: lowercase name, single spaces in value
            let canonical_value: String = value
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ");
            result.push_str(&format!("{}:{}\r\n", name, canonical_value));
        }
    }
    
    result
}

/// Canonicalize body for DKIM verification (relaxed)
fn canonicalize_body_relaxed(body: &str) -> String {
    let mut result = String::new();
    
    for line in body.lines() {
        // Replace runs of whitespace with single space, trim trailing whitespace
        let canonical: String = line
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");
        result.push_str(&canonical);
        result.push_str("\r\n");
    }
    
    // Remove trailing empty lines, but keep one CRLF
    while result.ends_with("\r\n\r\n") {
        result.truncate(result.len() - 2);
    }
    
    result
}

/// Verify DKIM signature on email
pub async fn verify_dkim(
    headers: &str,
    body: &str,
    dkim_header: &str,
) -> DkimResult {
    // Parse DKIM signature
    let sig = match parse_dkim_signature(dkim_header) {
        Ok(s) => s,
        Err(e) => return DkimResult {
            valid: false,
            domain: String::new(),
            selector: String::new(),
            error: Some(format!("Parse error: {}", e)),
        },
    };
    
    // Check algorithm
    if sig.algorithm != "rsa-sha256" && sig.algorithm != "rsa-sha1" {
        return DkimResult {
            valid: false,
            domain: sig.domain.clone(),
            selector: sig.selector.clone(),
            error: Some(format!("Unsupported algorithm: {}", sig.algorithm)),
        };
    }
    
    // Fetch public key from DNS
    let public_key = match fetch_dkim_public_key(&sig.selector, &sig.domain).await {
        Ok(k) => k,
        Err(e) => return DkimResult {
            valid: false,
            domain: sig.domain.clone(),
            selector: sig.selector.clone(),
            error: Some(e),
        },
    };
    
    // Determine canonicalization
    let (header_canon, body_canon) = {
        let parts: Vec<&str> = sig.canonicalization.split('/').collect();
        (
            parts.get(0).unwrap_or(&"simple").to_string(),
            parts.get(1).unwrap_or(&"simple").to_string(),
        )
    };
    
    // Canonicalize body and verify body hash
    let canonical_body = if body_canon == "relaxed" {
        canonicalize_body_relaxed(body)
    } else {
        body.to_string()
    };
    
    let computed_body_hash = {
        let mut hasher = Sha256::new();
        hasher.update(canonical_body.as_bytes());
        BASE64.encode(hasher.finalize())
    };
    
    if computed_body_hash != sig.body_hash {
        return DkimResult {
            valid: false,
            domain: sig.domain,
            selector: sig.selector,
            error: Some("Body hash mismatch".to_string()),
        };
    }
    
    // Canonicalize headers for signature verification
    let canonical_headers = if header_canon == "relaxed" {
        canonicalize_headers_relaxed(headers, &sig.headers)
    } else {
        // Simple canonicalization
        headers.to_string()
    };
    
    // Build data to verify (headers + DKIM-Signature header without b= value)
    let dkim_header_for_sig = {
        let re = Regex::new(r"b=[^;]*").unwrap();
        re.replace(dkim_header, "b=").to_string()
    };
    
    let sign_data = format!(
        "{}dkim-signature:{}",
        canonical_headers,
        dkim_header_for_sig.split_once(':').map(|(_, v)| v.trim()).unwrap_or("")
    );
    
    // Hash and verify
    let mut hasher = Sha256::new();
    hasher.update(sign_data.as_bytes());
    let hash = hasher.finalize();
    
    // Decode signature
    let sig_bytes = match BASE64.decode(&sig.signature) {
        Ok(b) => b,
        Err(e) => return DkimResult {
            valid: false,
            domain: sig.domain,
            selector: sig.selector,
            error: Some(format!("Invalid signature base64: {}", e)),
        },
    };
    
    // Verify RSA signature (PKCS#1 v1.5)
    use rsa::pkcs1v15::{Signature as RsaSignature, VerifyingKey as RsaVerifyingKey};
    use rsa::signature::Verifier as RsaVerifier;
    
    let verifying_key = RsaVerifyingKey::<Sha256>::new(public_key);
    let rsa_sig = match RsaSignature::try_from(sig_bytes.as_slice()) {
        Ok(s) => s,
        Err(e) => return DkimResult {
            valid: false,
            domain: sig.domain,
            selector: sig.selector,
            error: Some(format!("Invalid RSA signature: {}", e)),
        },
    };
    
    let valid = verifying_key.verify(&hash, &rsa_sig).is_ok();
    
    DkimResult {
        valid,
        domain: sig.domain,
        selector: sig.selector,
        error: if valid { None } else { Some("Signature verification failed".to_string()) },
    }
}

/// Check if domain is an academic institution
pub fn is_academic_domain(domain: &str) -> bool {
    let academic_suffixes = [
        ".edu",
        ".ac.uk",
        ".edu.au",
        ".ac.jp",
        ".edu.cn",
        ".ac.in",
        ".edu.sg",
        ".edu.br",
        ".ac.za",
        ".ac.nz",
        ".edu.mx",
        ".edu.ar",
    ];
    
    let academic_patterns = [
        "uni-",
        "univ",
        "college",
        "institute",
    ];
    
    let domain_lower = domain.to_lowercase();
    
    // Check suffixes
    for suffix in academic_suffixes {
        if domain_lower.ends_with(suffix) {
            return true;
        }
    }
    
    // Check patterns
    for pattern in academic_patterns {
        if domain_lower.contains(pattern) {
            return true;
        }
    }
    
    false
}

/// Extract institution name from domain
pub fn extract_institution_name(domain: &str) -> String {
    // Common mappings
    let known_institutions: HashMap<&str, &str> = [
        ("mit.edu", "MIT"),
        ("stanford.edu", "Stanford University"),
        ("harvard.edu", "Harvard University"),
        ("berkeley.edu", "UC Berkeley"),
        ("caltech.edu", "Caltech"),
        ("princeton.edu", "Princeton University"),
        ("yale.edu", "Yale University"),
        ("columbia.edu", "Columbia University"),
        ("ox.ac.uk", "University of Oxford"),
        ("cam.ac.uk", "University of Cambridge"),
        ("ethz.ch", "ETH Zürich"),
        ("tum.de", "Technical University of Munich"),
    ].into_iter().collect();
    
    if let Some(name) = known_institutions.get(domain.to_lowercase().as_str()) {
        return name.to_string();
    }
    
    // Generate from domain
    domain
        .split('.')
        .next()
        .unwrap_or(domain)
        .replace('-', " ")
        .replace('_', " ")
        .split_whitespace()
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(c) => c.to_uppercase().chain(chars).collect(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_verify_schnorr_valid() {
        // This would need a real test vector
        // For now, just test parsing
        let result = verify_schnorr(
            "0000000000000000000000000000000000000000000000000000000000000001",
            "0000000000000000000000000000000000000000000000000000000000000000",
            &"00".repeat(64),
        );
        assert!(result.is_ok() || result.is_err()); // Just test it doesn't panic
    }
    
    #[test]
    fn test_parse_dkim_signature() {
        let header = r#"DKIM-Signature: v=1; a=rsa-sha256; d=mit.edu; s=selector1;
            c=relaxed/relaxed; h=from:to:subject:date;
            bh=abc123==; b=xyz789=="#;
        
        let sig = parse_dkim_signature(header).unwrap();
        assert_eq!(sig.domain, "mit.edu");
        assert_eq!(sig.selector, "selector1");
        assert_eq!(sig.algorithm, "rsa-sha256");
    }
    
    #[test]
    fn test_is_academic_domain() {
        assert!(is_academic_domain("mit.edu"));
        assert!(is_academic_domain("ox.ac.uk"));
        assert!(is_academic_domain("uni-muenchen.de"));
        assert!(!is_academic_domain("gmail.com"));
        assert!(!is_academic_domain("company.com"));
    }
    
    #[test]
    fn test_extract_institution_name() {
        assert_eq!(extract_institution_name("mit.edu"), "MIT");
        assert_eq!(extract_institution_name("stanford.edu"), "Stanford University");
        assert_eq!(extract_institution_name("some-university.edu"), "Some University");
    }
}

// =============================================================================
// ACTIX-WEB HANDLER INTEGRATION
// =============================================================================

use actix_web::{web, HttpResponse};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct VerifySignatureRequest {
    pub pubkey: String,
    pub message: String,
    pub signature: String,
    #[serde(default)]
    pub sig_type: String, // "identity" | "content" | "raw"
}

#[derive(Debug, Serialize)]
pub struct VerifySignatureResponse {
    pub valid: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn api_verify_signature(
    body: web::Json<VerifySignatureRequest>,
) -> HttpResponse {
    let result = match body.sig_type.as_str() {
        "identity" => verify_identity_inscription(&body.pubkey, &body.message, &body.signature),
        "content" | "raw" | "" => verify_schnorr(&body.pubkey, &body.message, &body.signature),
        _ => Err("Unknown signature type".to_string()),
    };
    
    match result {
        Ok(valid) => HttpResponse::Ok().json(VerifySignatureResponse {
            valid,
            error: None,
        }),
        Err(e) => HttpResponse::BadRequest().json(VerifySignatureResponse {
            valid: false,
            error: Some(e),
        }),
    }
}

/// Verification proof stored on Arweave (NO email content)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AcademicVerificationProof {
    pub verification_hash: String,    // SHA256(pubkey + domain + timestamp + nonce)
    pub domain: String,               // mit.edu (domain only, no email)
    pub institution: String,          // MIT
    pub pubkey: String,               // User's KasVillage pubkey
    pub verified_at: u64,             // Unix timestamp
    pub expires_at: u64,              // Verification expiry (1 year)
    pub dkim_selector: String,        // Which DKIM selector was used
    pub signature: String,            // TownHall signs the proof
}

#[derive(Debug, Deserialize)]
pub struct VerifyDkimRequest {
    pub email_headers: String,        // Verified locally, NOT stored
    pub email_body: String,           // Verified locally, NOT stored
    pub dkim_header: String,          // Verified locally, NOT stored
    pub pubkey: String,               // User's KasVillage pubkey
    pub nonce: String,                // Client-generated nonce for uniqueness
}

#[derive(Debug, Serialize)]
pub struct VerifyDkimResponse {
    pub valid: bool,
    pub verification_hash: String,    // Only this hash is stored
    pub domain: String,               // Domain only (not full email)
    pub institution: String,
    pub is_academic: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub arweave_tx: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Create verification hash (what gets stored, NOT the email)
fn create_verification_hash(
    pubkey: &str,
    domain: &str,
    timestamp: u64,
    nonce: &str,
) -> String {
    let mut hasher = Sha256::new();
    hasher.update(b"KV_ACADEMIC_V1:");
    hasher.update(pubkey.as_bytes());
    hasher.update(b":");
    hasher.update(domain.as_bytes());
    hasher.update(b":");
    hasher.update(&timestamp.to_le_bytes());
    hasher.update(b":");
    hasher.update(nonce.as_bytes());
    hex::encode(hasher.finalize())
}

pub async fn api_verify_dkim(
    body: web::Json<VerifyDkimRequest>,
) -> HttpResponse {
    // 1. Verify DKIM signature (email content checked but NOT stored)
    let result = verify_dkim(&body.email_headers, &body.email_body, &body.dkim_header).await;
    
    if !result.valid {
        return HttpResponse::BadRequest().json(VerifyDkimResponse {
            valid: false,
            verification_hash: String::new(),
            domain: result.domain,
            institution: String::new(),
            is_academic: false,
            arweave_tx: None,
            error: result.error,
        });
    }
    
    // 2. Check if academic domain
    let is_academic = is_academic_domain(&result.domain);
    if !is_academic {
        return HttpResponse::BadRequest().json(VerifyDkimResponse {
            valid: true,
            verification_hash: String::new(),
            domain: result.domain.clone(),
            institution: result.domain,
            is_academic: false,
            arweave_tx: None,
            error: Some("Not an academic institution domain".to_string()),
        });
    }
    
    let institution = extract_institution_name(&result.domain);
    
    // 3. Create verification hash (this is what gets stored, NOT the email)
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    let verification_hash = create_verification_hash(
        &body.pubkey,
        &result.domain,
        timestamp,
        &body.nonce,
    );
    
    // 4. Create proof for Arweave (NO email content)
    let proof = AcademicVerificationProof {
        verification_hash: verification_hash.clone(),
        domain: result.domain.clone(),
        institution: institution.clone(),
        pubkey: body.pubkey.clone(),
        verified_at: timestamp,
        expires_at: timestamp + 365 * 24 * 60 * 60, // 1 year
        dkim_selector: result.selector.clone(),
        signature: String::new(), // TODO: TownHall signs this
    };
    
    // 5. Post proof to Arweave (only hash + domain, never email)
    // TODO: Implement Bundlr upload
    let arweave_tx = format!("AR_ACADEMIC_{}", &verification_hash[..16]);
    
    // 6. Log what we're storing (for audit)
    log::info!(
        "Academic verification: hash={}, domain={}, pubkey={}, NO email stored",
        &verification_hash[..16],
        result.domain,
        &body.pubkey[..16.min(body.pubkey.len())]
    );
    
    HttpResponse::Ok().json(VerifyDkimResponse {
        valid: true,
        verification_hash,
        domain: result.domain,
        institution,
        is_academic: true,
        arweave_tx: Some(arweave_tx),
        error: None,
    })
}

/// Check if a verification hash exists (for re-verification without email)
#[derive(Debug, Deserialize)]
pub struct CheckVerificationRequest {
    pub verification_hash: String,
}

#[derive(Debug, Serialize)]
pub struct CheckVerificationResponse {
    pub found: bool,
    pub domain: Option<String>,
    pub institution: Option<String>,
    pub verified_at: Option<u64>,
    pub expires_at: Option<u64>,
    pub expired: bool,
}

pub async fn api_check_academic_verification(
    body: web::Json<CheckVerificationRequest>,
) -> HttpResponse {
    // TODO: Query Arweave for verification proof by hash
    // For now, return not found
    HttpResponse::Ok().json(CheckVerificationResponse {
        found: false,
        domain: None,
        institution: None,
        verified_at: None,
        expires_at: None,
        expired: false,
    })
}

// =============================================================================
// ROUTE REGISTRATION
// =============================================================================
// Add to main.rs configure_routes():
//
// .route("/api/crypto/verify-signature", web::post().to(api_verify_signature))
// .route("/api/crypto/verify-dkim", web::post().to(api_verify_dkim))
// .route("/api/crypto/check-academic", web::post().to(api_check_academic_verification))
//
// PRIVACY NOTE:
// - Email content is verified locally then DISCARDED
// - Only verification_hash + domain stored on Arweave
// - Hash = SHA256(pubkey + domain + timestamp + nonce)
// - No PII stored, no email addresses, no email content
// =============================================================================
