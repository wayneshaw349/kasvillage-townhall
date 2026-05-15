// ============================================================================
// KASVILLAGE TOWN HALL v5.0 - STATELESS AKASH EDITION
// ============================================================================
//
// STATELESS ARCHITECTURE:
// - NO Arc<RwLock> in-memory state
// - Every request reads from Arweave (graphql query)
// - Compute proof, emit result to client
// - Client broadcasts to Arweave if needed
//
// STATE PERSISTENCE:
// - User stats: Arweave GraphQL query by pubkey tag
// - Verified identities: Arweave records with signature
// - XP ledger: Immutable Arweave archive per transaction
// - Avatar snapshots: Arweave tagged with pubkey + identity_hash
//
// DEPLOYMENT:
// - Akash pod restart = no data loss
// - Pod scale 1→N = all identical (no sticky sessions needed)
// - Arweave = single source of truth
//
// ============================================================================

#![allow(dead_code, unused_variables, unused_imports)]

use actix_web::{web, App, HttpServer, HttpRequest, HttpResponse, Responder, middleware::Logger};
use actix_cors::Cors;
use serde::{Serialize, Deserialize};
use serde_json::{json, Value};
use sha2::{Sha256, Digest as Sha2Digest};
use blake2::{Blake2b512, Digest as Blake2Digest};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use regex::Regex;
use once_cell::sync::Lazy;

// Halo2 (same as v4)
use halo2_proofs::{
    circuit::{Layouter, SimpleFloorPlanner, Value, AssignedCell},
    plonk::{
        create_proof, verify_proof, keygen_pk, keygen_vk,
        ProvingKey, VerifyingKey, Circuit, ConstraintSystem,
        Column, Advice, Selector, Expression, Instance,
        Error as PlonkError,
    },
    poly::{
        commitment::ParamsProver,
        ipa::{
            commitment::{IPACommitmentScheme, ParamsIPA},
            multiopen::ProverIPA,
            strategy::SingleStrategy,
        },
        VerificationStrategy,
        Rotation,
    },
    transcript::{
        Blake2bRead, Blake2bWrite, Challenge255,
        TranscriptReadBuffer, TranscriptWriterBuffer,
    },
};
use pasta_curves::{pallas, Fp, Fq, EqAffine};
use ff::{Field, PrimeField, FromUniformBytes};
use rand::rngs::OsRng;

// ============================================================================
// CONSTANTS
// ============================================================================

const ARWEAVE_GATEWAY: &str = "https://arweave.net";
const ARWEAVE_GRAPHQL: &str = "https://arweave.net/graphql";
const BUNDLR_NODE: &str = "https://node2.irys.xyz";
const KASPA_REST: &str = "https://api.kaspa.org";

#[cfg(debug_assertions)]
pub const HALO2_K: u32 = 12;
#[cfg(not(debug_assertions))]
pub const HALO2_K: u32 = 17;

#[cfg(debug_assertions)]
pub const TREE_DEPTH: usize = 8;
#[cfg(not(debug_assertions))]
pub const TREE_DEPTH: usize = 32;

const TRAITS_TO_BUY: u8 = 9;
const TRAITS_TO_SELL: u8 = 13;

const XP_INCUBATOR: u64 = 500;
const XP_MAIN: u64 = 1000;
const XP_ELITE: u64 = 5000;

// Arweave tags for state queries
const TAG_USER_STATS: &str = "KV-UserStats";
const TAG_VERIFIED_IDENTITY: &str = "KV-VerifiedIdentity";
const TAG_XP_LEDGER: &str = "KV-XPLedger";
const TAG_AVATAR_SNAPSHOT: &str = "KV-AvatarSnapshot";

// ============================================================================
// ARWEAVE STATE READER - Replaces Arc<RwLock> HashMap
// ============================================================================

#[derive(Clone)]
pub struct ArweaveStateReader {
    http_client: reqwest::Client,
}

impl ArweaveStateReader {
    pub fn new() -> Self {
        Self {
            http_client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("Failed to create HTTP client"),
        }
    }

    /// Query user stats from Arweave by pubkey
    /// Returns latest record (ordered by block desc)
    pub async fn get_user_stats(&self, pubkey: &str) -> Result<UserCompletionStats, String> {
        let query = format!(
            r#"query {{
                transactions(first: 1, tags: [
                    {{ name: "{}", values: ["{}" ] }},
                    {{ name: "Content-Type", values: ["application/json"] }}
                ], sort: HEIGHT_DESC) {{
                    edges {{
                        node {{
                            id
                            block {{ height timestamp }}
                            tags {{ name value }}
                        }}
                    }}
                }}
            }}"#,
            TAG_USER_STATS, pubkey
        );

        let body = json!({ "query": query });
        let resp = self
            .http_client
            .post(ARWEAVE_GRAPHQL)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("GraphQL request failed: {}", e))?;

        let graphql_result: Value = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse GraphQL response: {}", e))?;

        if let Some(edges) = graphql_result
            .get("data")
            .and_then(|d| d.get("transactions"))
            .and_then(|t| t.get("edges"))
            .and_then(|e| e.as_array())
        {
            if let Some(edge) = edges.first() {
                if let Some(tx_id) = edge
                    .get("node")
                    .and_then(|n| n.get("id"))
                    .and_then(|id| id.as_str())
                {
                    // Fetch full transaction data
                    return self.fetch_user_stats_from_tx(tx_id).await;
                }
            }
        }

        // No record found - return default fresh stats
        Ok(UserCompletionStats::new())
    }

    async fn fetch_user_stats_from_tx(&self, tx_id: &str) -> Result<UserCompletionStats, String> {
        let url = format!("{}/{}", ARWEAVE_GATEWAY, tx_id);
        let resp = self
            .http_client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to fetch tx: {}", e))?;

        let stats_json: UserCompletionStats = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse stats JSON: {}", e))?;

        Ok(stats_json)
    }

    /// Query verified identity from Arweave by pubkey
    pub async fn get_verified_identity(
        &self,
        pubkey: &str,
    ) -> Result<Option<VerifiedIdentityRecord>, String> {
        let query = format!(
            r#"query {{
                transactions(first: 1, tags: [
                    {{ name: "{}", values: ["{}" ] }}
                ], sort: HEIGHT_DESC) {{
                    edges {{
                        node {{
                            id
                        }}
                    }}
                }}
            }}"#,
            TAG_VERIFIED_IDENTITY, pubkey
        );

        let body = json!({ "query": query });
        let resp = self
            .http_client
            .post(ARWEAVE_GRAPHQL)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("GraphQL request failed: {}", e))?;

        let graphql_result: Value = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        if let Some(edges) = graphql_result
            .get("data")
            .and_then(|d| d.get("transactions"))
            .and_then(|t| t.get("edges"))
            .and_then(|e| e.as_array())
        {
            if let Some(edge) = edges.first() {
                if let Some(tx_id) = edge
                    .get("node")
                    .and_then(|n| n.get("id"))
                    .and_then(|id| id.as_str())
                {
                    return self.fetch_identity_record(tx_id).await;
                }
            }
        }

        Ok(None)
    }

    async fn fetch_identity_record(
        &self,
        tx_id: &str,
    ) -> Result<Option<VerifiedIdentityRecord>, String> {
        let url = format!("{}/{}", ARWEAVE_GATEWAY, tx_id);
        let resp = self
            .http_client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to fetch: {}", e))?;

        let record: VerifiedIdentityRecord = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse: {}", e))?;

        Ok(Some(record))
    }

    /// Fetch latest XP ledger entry for pubkey
    pub async fn get_xp_ledger_entry(
        &self,
        pubkey: &str,
    ) -> Result<Option<XPLedgerEntry>, String> {
        let query = format!(
            r#"query {{
                transactions(first: 1, tags: [
                    {{ name: "{}", values: ["{}" ] }}
                ], sort: HEIGHT_DESC) {{
                    edges {{
                        node {{
                            id
                        }}
                    }}
                }}
            }}"#,
            TAG_XP_LEDGER, pubkey
        );

        let body = json!({ "query": query });
        let resp = self
            .http_client
            .post(ARWEAVE_GRAPHQL)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("GraphQL failed: {}", e))?;

        let graphql_result: Value = resp
            .json()
            .await
            .map_err(|e| format!("Parse failed: {}", e))?;

        if let Some(edges) = graphql_result
            .get("data")
            .and_then(|d| d.get("transactions"))
            .and_then(|t| t.get("edges"))
            .and_then(|e| e.as_array())
        {
            if let Some(edge) = edges.first() {
                if let Some(tx_id) = edge
                    .get("node")
                    .and_then(|n| n.get("id"))
                    .and_then(|id| id.as_str())
                {
                    let url = format!("{}/{}", ARWEAVE_GATEWAY, tx_id);
                    let data = self
                        .http_client
                        .get(&url)
                        .send()
                        .await
                        .map_err(|e| format!("Fetch failed: {}", e))?;

                    let entry: XPLedgerEntry = data
                        .json()
                        .await
                        .map_err(|e| format!("Parse failed: {}", e))?;

                    return Ok(Some(entry));
                }
            }
        }

        Ok(None)
    }
}

// ============================================================================
// STATE STRUCTURES (Arweave-serializable)
// ============================================================================

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct UserCompletionStats {
    pub pubkey: String,
    pub xp: u64,
    pub agreements_succeeded: u32,
    pub agreements_deadlocked: u32,
    pub reviews_posted: u32,
    pub stores_created: u32,
    pub dapps_created: u32,
    pub last_updated_ms: u64,
    pub citadel_tier: String, // "Guest", "Resident", "Passport"
}

impl UserCompletionStats {
    pub fn new() -> Self {
        Self {
            xp: 100,
            agreements_succeeded: 0,
            agreements_deadlocked: 0,
            reviews_posted: 0,
            stores_created: 0,
            dapps_created: 0,
            last_updated_ms: current_timestamp(),
            citadel_tier: "Guest".to_string(),
        }
    }

    pub fn p_complete(&self) -> f64 {
        let total = (self.agreements_succeeded + self.agreements_deadlocked) as f64;
        if total < 1.0 {
            return 0.5;
        }
        (self.agreements_succeeded as f64 + 1.0) / (total + 2.0)
    }

    pub fn should_snail_mode(&self) -> bool {
        !self.is_new_user() && self.xp < 100
    }

    pub fn is_new_user(&self) -> bool {
        (self.agreements_succeeded + self.agreements_deadlocked) < 3
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VerifiedIdentityRecord {
    pub pubkey: String,
    pub identity_hash: String,
    pub traits_count: u8,
    pub tier: String, // "Guest", "Resident", "Passport"
    pub verified_at_block: u64,
    pub verified_at_timestamp: u64,
    pub proof_tx_id: String,
    pub signature: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct XPLedgerEntry {
    pub pubkey: String,
    pub event_type: String, // "NeighborSuccess", "NeighborDeadlock", "StoreCreated", etc.
    pub xp_delta: i64,
    pub xp_after: u64,
    pub reason: String,
    pub timestamp_ms: u64,
    pub arweave_block: u64,
    pub signature: String,
}

// ============================================================================
// CANONICAL AVATAR (from v4, unchanged)
// ============================================================================

pub const AVATAR_SCHEMA_VERSION: u32 = 3;

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
    pub fn serialize_canonical(&self) -> String {
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

    pub fn identity_hash(&self) -> [u8; 32] {
        let serialized = self.serialize_canonical();
        let versioned = format!("KV_AVATAR_V{}:{}", AVATAR_SCHEMA_VERSION, serialized);
        sha256_hash(versioned.as_bytes())
    }

    pub fn identity_hash_hex(&self) -> String {
        hex::encode(self.identity_hash())
    }

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

    pub fn can_buy(&self) -> bool {
        self.count_traits() >= TRAITS_TO_BUY
    }

    pub fn can_sell(&self) -> bool {
        self.count_traits() >= TRAITS_TO_SELL
    }
}

// ============================================================================
// VERIFICATION ENDPOINT (STATELESS)
// ============================================================================

#[derive(Deserialize)]
pub struct VerifyIdentityRequest {
    pub pubkey: String,
    pub avatar: CanonicalAvatar,
    pub signature: String,
}

#[derive(Serialize)]
pub struct VerifyIdentityResponse {
    pub success: bool,
    pub tier: String,
    pub traits: u8,
    pub can_buy: bool,
    pub can_sell: bool,
    pub arweave_tx_id: Option<String>,
    pub error: Option<String>,
}

pub async fn verify_identity(
    req: web::Json<VerifyIdentityRequest>,
    state: web::Data<ArweaveStateReader>,
) -> impl Responder {
    let pubkey = &req.pubkey;
    let avatar = &req.avatar;
    let traits = avatar.count_traits();

    let tier = if traits >= TRAITS_TO_SELL {
        "Passport"
    } else if traits >= TRAITS_TO_BUY {
        "Resident"
    } else {
        "Guest"
    };

    // Fetch latest user stats from Arweave
    let stats = match state.get_user_stats(pubkey).await {
        Ok(s) => s,
        Err(e) => {
            return HttpResponse::InternalServerError().json(VerifyIdentityResponse {
                success: false,
                tier: "Guest".to_string(),
                traits: 0,
                can_buy: false,
                can_sell: false,
                arweave_tx_id: None,
                error: Some(format!("Failed to fetch stats: {}", e)),
            })
        }
    };

    // In production: client posts proof to Arweave via Bundlr
    // Town Hall returns response; client handles Arweave upload
    let response = VerifyIdentityResponse {
        success: true,
        tier: tier.to_string(),
        traits,
        can_buy: avatar.can_buy(),
        can_sell: avatar.can_sell(),
        arweave_tx_id: None, // Client will post this
        error: None,
    };

    HttpResponse::Ok().json(response)
}

// ============================================================================
// USER STATS ENDPOINT (READ FROM ARWEAVE)
// ============================================================================

#[derive(Deserialize)]
pub struct GetStatsRequest {
    pub pubkey: String,
}

pub async fn get_user_stats(
    req: web::Json<GetStatsRequest>,
    state: web::Data<ArweaveStateReader>,
) -> impl Responder {
    match state.get_user_stats(&req.pubkey).await {
        Ok(stats) => HttpResponse::Ok().json(stats),
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "error": e,
            "pubkey": &req.pubkey
        })),
    }
}

// ============================================================================
// XP LEDGER ENDPOINT (READ ONLY)
// ============================================================================

#[derive(Deserialize)]
pub struct GetXPLedgerRequest {
    pub pubkey: String,
}

pub async fn get_xp_ledger(
    req: web::Json<GetXPLedgerRequest>,
    state: web::Data<ArweaveStateReader>,
) -> impl Responder {
    match state.get_xp_ledger_entry(&req.pubkey).await {
        Ok(Some(entry)) => HttpResponse::Ok().json(entry),
        Ok(None) => HttpResponse::NotFound().json(json!({
            "error": "No XP ledger entries found",
            "pubkey": &req.pubkey
        })),
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "error": e,
            "pubkey": &req.pubkey
        })),
    }
}

// ============================================================================
// ROUTE CONFIGURATION
// ============================================================================

pub fn configure_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/verify-identity", web::post().to(verify_identity))
        .route("/user-stats", web::post().to(get_user_stats))
        .route("/xp-ledger", web::post().to(get_xp_ledger))
        .route("/health", web::get().to(health_check));
}

async fn health_check() -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "online",
        "version": "5.0-stateless",
        "mode": "Arweave-persisted",
        "timestamp": current_timestamp()
    }))
}

// ============================================================================
// UTILITIES
// ============================================================================

fn sha256_hash(data: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(data);
    let result = hasher.finalize();
    let mut output = [0u8; 32];
    output.copy_from_slice(&result);
    output
}

fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

// ============================================================================
// MAIN
// ============================================================================

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init();

    let port = std::env::var("PORT").unwrap_or_else(|_| "8080".into());
    let addr = format!("0.0.0.0:{}", port);

    println!("🏛️ KasVillage Town Hall v5.0 - STATELESS EDITION");
    println!("   Architecture: Arweave-persisted (no in-memory state)");
    println!("   Deployment: Akash (stateless pods)");
    println!("   Listening on: {}", addr);
    println!("   Arweave Gateway: {}", ARWEAVE_GATEWAY);

    let state = ArweaveStateReader::new();

    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(state.clone()))
            .wrap(Logger::default())
            .wrap(Cors::permissive())
            .configure(configure_routes)
    })
    .bind(&addr)?
    .run()
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_avatar_serialization() {
        let avatar = CanonicalAvatar {
            name: "Test".to_string(),
            class: "Warrior".to_string(),
            race: "Human".to_string(),
            ..Default::default()
        };

        let serialized = avatar.serialize_canonical();
        assert!(serialized.contains("\"animal\":\"\""));
        assert!(serialized.contains("\"class\":\"warrior\""));
        assert!(serialized.contains("\"name\":\"test\""));
        assert!(serialized.contains("\"race\":\"human\""));
    }

    #[test]
    fn test_identity_hash_deterministic() {
        let avatar1 = CanonicalAvatar {
            name: "Hero".to_string(),
            class: "Paladin".to_string(),
            ..Default::default()
        };

        let avatar2 = CanonicalAvatar {
            name: "Hero".to_string(),
            class: "Paladin".to_string(),
            ..Default::default()
        };

        assert_eq!(avatar1.identity_hash(), avatar2.identity_hash());
    }

    #[test]
    fn test_user_stats_p_complete_new_user() {
        let stats = UserCompletionStats::new();
        assert!((stats.p_complete() - 0.5).abs() < 0.01);
        assert!(stats.is_new_user());
    }

    #[test]
    fn test_user_stats_timestamp() {
        let stats = UserCompletionStats::new();
        assert!(stats.last_updated_ms > 0);
    }

    #[test]
    fn test_can_buy_sell_thresholds() {
        let mut avatar = CanonicalAvatar::default();
        assert!(!avatar.can_buy());
        assert!(!avatar.can_sell());

        // Add 9 traits
        avatar.class = "Test".to_string();
        avatar.race = "Test".to_string();
        avatar.occupation = "Test".to_string();
        avatar.mutant = "Test".to_string();
        avatar.animal = "Test".to_string();
        avatar.mutate = "Test".to_string();
        avatar.personality = "Test".to_string();
        avatar.combat_style = "Test".to_string();
        avatar.signature_move = "Test".to_string();

        assert!(avatar.can_buy());
        assert!(!avatar.can_sell());

        // Add 4 seller traits
        avatar.weakness = "Test".to_string();
        avatar.power_spike = "Test".to_string();
        avatar.voice_line = "Test".to_string();
        avatar.lore_origin = "Test".to_string();

        assert!(avatar.can_sell());
    }

    #[test]
    fn test_citadel_tier_string() {
        let stats = UserCompletionStats::new();
        assert_eq!(stats.citadel_tier, "Guest");
    }
}
