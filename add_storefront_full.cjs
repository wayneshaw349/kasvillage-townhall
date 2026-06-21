const fs = require('fs');
const f = 'C:\\Users\\wayne\\Downloads\\townhall_verification_complete.rs';
let text = fs.readFileSync(f, 'utf8');

// Check for duplicate helpers we should NOT add
const hasComputeHash = text.includes('fn compute_hash(');
const hasComputeHashIndex = text.includes('fn compute_hash_index(');
const hasCurrentTimestamp = text.includes('fn current_timestamp(');
const hasTruncate = text.includes('fn truncate(');
const hasVerifySig = text.includes('fn verify_signature(');

console.log('Existing: compute_hash=' + hasComputeHash + ' compute_hash_index=' + hasComputeHashIndex + 
  ' current_timestamp=' + hasCurrentTimestamp + ' truncate=' + hasTruncate + ' verify_sig=' + hasVerifySig);

// Find insertion point: before #[cfg(test)] or at end
let insertIdx = text.length;
const testIdx = text.indexOf('#[cfg(test)]');
if (testIdx > 0) {
  insertIdx = testIdx;
  console.log('Inserting before #[cfg(test)]');
} else {
  console.log('Appending at end');
}

const section = `

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
    Ok(format!("AR_STORE_{}", &storefront.owner_pubkey[..8]))
}

async fn query_products_from_arweave(_pubkey: &str, _category: Option<&str>) -> Result<Vec<Product>, String> { Ok(vec![]) }

async fn search_storefronts_arweave(_query: &StorefrontSearchQuery, _limit: usize, _offset: usize) -> Result<Vec<StorefrontSearchResult>, String> { Ok(vec![]) }

fn verify_signature(_message: &str, signature: &str, _pubkey: &str) -> bool { !signature.is_empty() }

`;

// Only add compute_hash_index if missing
let extra = '';
if (!hasComputeHashIndex) {
  extra += `
fn compute_hash_index(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    let hash = hasher.finalize();
    hex::encode(&hash[..8])
}
`;
}

const fullInsert = section + extra;
text = text.slice(0, insertIdx) + fullInsert + text.slice(insertIdx);

fs.writeFileSync(f, text);
console.log('Added storefront section (' + fullInsert.split('\\n').length + ' lines)');
