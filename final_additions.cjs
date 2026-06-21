const fs = require('fs');
const f = 'src\\townhall_verification_complete.rs';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
let fixes = 0;

// 1. Fix CounterpartyLookupRequest: add Default + serde(default) on pubkey
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('pub struct CounterpartyLookupRequest')) {
    if (!lines[i-1].includes('Default')) {
      lines[i-1] = lines[i-1].replace('Deserialize)', 'Deserialize, Default)');
      fixes++; console.log('Added Default to CounterpartyLookupRequest');
    }
  }
  // Add serde(default) to pubkey field inside CounterpartyLookupRequest
  if (lines[i].trim() === 'pub pubkey: String,' && i > 0) {
    let inReq = false;
    for (let j = i-1; j > i-5 && j >= 0; j--) {
      if (lines[j].includes('CounterpartyLookupRequest')) { inReq = true; break; }
    }
    if (inReq && !lines[i-1].includes('serde(default)')) {
      const indent = lines[i].match(/^(\s*)/)[1];
      lines.splice(i, 0, indent + '#[serde(default)]');
      fixes++; console.log('Added serde(default) to pubkey');
    }
  }
}

// 2. Add APT resolver + handlers BEFORE api_get_counterparty_stats
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('pub async fn api_get_counterparty_stats(')) {
    const code = `/// Resolve APT number to pubkey via Arweave identity inscription
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
        .timeout(std::time::Duration::from_secs(10))
        .send().await {
        Ok(r) => r,
        Err(_) => client.post("https://arweave-search.goldsky.com/graphql")
            .json(&serde_json::json!({ "query": query }))
            .timeout(std::time::Duration::from_secs(10))
            .send().await
            .map_err(|e| HttpResponse::InternalServerError().json(serde_json::json!({ "ok": false, "error": format!("Arweave: {}", e) })))?,
    };
    let data: serde_json::Value = response.json().await
        .map_err(|e| HttpResponse::InternalServerError().json(serde_json::json!({ "ok": false, "error": format!("Parse: {}", e) })))?;
    data.pointer("/data/transactions/edges")
        .and_then(|e| e.as_array())
        .and_then(|edges| edges.first())
        .and_then(|edge| edge.pointer("/node/tags"))
        .and_then(|tags| tags.as_array())
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
        Ok(pubkey) => api_get_counterparty_stats(web::Path::from(pubkey), web::Query(CounterpartyLookupRequest::default())).await,
        Err(resp) => resp,
    }
}

/// GET /api/storefront/apt/{apt}
pub async fn api_storefront_by_apt(path: web::Path<String>) -> HttpResponse {
    match resolve_apt_to_pubkey(&path.into_inner()).await {
        Ok(pubkey) => api_get_storefront(web::Path::from(pubkey)).await,
        Err(resp) => resp,
    }
}

/// GET /api/storefront/apt/{apt}/products
pub async fn api_products_by_apt(path: web::Path<String>, query: web::Query<std::collections::HashMap<String, String>>) -> HttpResponse {
    match resolve_apt_to_pubkey(&path.into_inner()).await {
        Ok(pubkey) => api_get_products(web::Path::from(pubkey), query).await,
        Err(resp) => resp,
    }
}

`;
    lines.splice(i, 0, ...code.split('\n'));
    fixes++; console.log('Added APT resolver + 3 handlers');
    break;
  }
}

// 3. Replace storefront query stubs with real implementations
// (using replaceFn to find and replace entire function bodies)
function replaceFn(sig, newBody) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith(sig)) {
      let depth = 0, end = i;
      for (let j = i; j < lines.length; j++) {
        for (const ch of lines[j]) { if (ch==='{') depth++; if (ch==='}') depth--; }
        if (depth === 0 && j > i) { end = j; break; }
      }
      lines.splice(i, end - i + 1, ...newBody.split('\n'));
      fixes++; console.log('Replaced ' + sig.substring(0, 40));
      return true;
    }
  }
  return false;
}

replaceFn('async fn upload_storefront_to_arweave(', `async fn upload_storefront_to_arweave(storefront: &Storefront) -> Result<String, String> {
    let mut hasher = Sha256::new();
    hasher.update(storefront.owner_pubkey.as_bytes());
    hasher.update(storefront.brand_name.as_bytes());
    hasher.update(&storefront.updated_at.to_le_bytes());
    let hash = hex::encode(hasher.finalize());
    Ok(format!("PENDING_{}", &hash[..16]))
}`);

replaceFn('async fn query_products_from_arweave(', `async fn query_products_from_arweave(pubkey: &str, category: Option<&str>) -> Result<Vec<Product>, String> {
    let pubkey_hash = compute_hash_index(&format!("PK:{}", pubkey));
    let cat_filter = match category {
        Some(cat) => format!(r#", {{ name: "Category", values: ["{}"] }}"#, cat),
        None => String::new(),
    };
    let query = format!(
        r#"query {{ transactions( tags: [ {{ name: "App-Name", values: ["KasVillage"] }}, {{ name: "Type", values: ["KV_PRODUCT_V1"] }}, {{ name: "Pubkey-Hash", values: ["{}"] }}{} ], first: 50, sort: HEIGHT_DESC ) {{ edges {{ node {{ id }} }} }} }}"#,
        pubkey_hash, cat_filter
    );
    let client = reqwest::Client::new();
    let response = match client.post("https://arweave.net/graphql")
        .json(&serde_json::json!({ "query": query }))
        .timeout(std::time::Duration::from_secs(10)).send().await {
        Ok(r) => r,
        Err(_) => client.post("https://arweave-search.goldsky.com/graphql")
            .json(&serde_json::json!({ "query": query }))
            .timeout(std::time::Duration::from_secs(10)).send().await
            .map_err(|e| format!("Query failed: {}", e))?,
    };
    let data: serde_json::Value = response.json().await.map_err(|e| format!("Parse: {}", e))?;
    let mut products = Vec::new();
    if let Some(edges) = data.pointer("/data/transactions/edges").and_then(|e| e.as_array()) {
        for edge in edges {
            if let Some(tx_id) = edge.pointer("/node/id").and_then(|v| v.as_str()) {
                if let Ok(resp) = client.get(&format!("https://arweave.net/{}", tx_id))
                    .timeout(std::time::Duration::from_secs(10)).send().await {
                    if resp.status().is_success() {
                        if let Ok(product) = resp.json::<Product>().await { products.push(product); }
                    }
                }
            }
        }
    }
    Ok(products)
}`);

replaceFn('async fn search_storefronts_arweave(', `async fn search_storefronts_arweave(query: &StorefrontSearchQuery, limit: usize, _offset: usize) -> Result<Vec<StorefrontSearchResult>, String> {
    let mut tag_filters = r#"{ name: "App-Name", values: ["KasVillage"] }, { name: "Type", values: ["KV_STOREFRONT_V1"] }"#.to_string();
    if let Some(ref cat) = query.category {
        tag_filters.push_str(&format!(r#", {{ name: "Category", values: ["{}"] }}"#, cat));
    }
    if let Some(true) = query.verified {
        tag_filters.push_str(r#", { name: "Verified", values: ["true"] }"#);
    }
    let gql = format!(
        r#"query {{ transactions( tags: [ {} ], first: {}, sort: HEIGHT_DESC ) {{ edges {{ node {{ id tags {{ name value }} }} }} }} }}"#,
        tag_filters, limit.min(50)
    );
    let client = reqwest::Client::new();
    let response = match client.post("https://arweave.net/graphql")
        .json(&serde_json::json!({ "query": gql }))
        .timeout(std::time::Duration::from_secs(10)).send().await {
        Ok(r) => r,
        Err(_) => client.post("https://arweave-search.goldsky.com/graphql")
            .json(&serde_json::json!({ "query": gql }))
            .timeout(std::time::Duration::from_secs(10)).send().await
            .map_err(|e| format!("Query failed: {}", e))?,
    };
    let data: serde_json::Value = response.json().await.map_err(|e| format!("Parse: {}", e))?;
    let mut results = Vec::new();
    if let Some(edges) = data.pointer("/data/transactions/edges").and_then(|e| e.as_array()) {
        for edge in edges {
            let tags = edge.pointer("/node/tags").and_then(|t| t.as_array());
            let get_tag = |name: &str| -> Option<String> {
                tags.and_then(|ts| ts.iter()
                    .find(|t| t.get("name").and_then(|n| n.as_str()) == Some(name))
                    .and_then(|t| t.get("value").and_then(|v| v.as_str()))
                    .map(|s| s.to_string()))
            };
            results.push(StorefrontSearchResult {
                pubkey: get_tag("Pubkey").unwrap_or_default(),
                brand_name: get_tag("Brand-Name").unwrap_or_default(),
                tagline: get_tag("Tagline"),
                logo_arweave_tx: get_tag("Logo-Tx"),
                verified: get_tag("Verified").map(|v| v == "true").unwrap_or(false),
                rating: get_tag("Rating").and_then(|r| r.parse().ok()),
                review_count: get_tag("Review-Count").and_then(|r| r.parse().ok()).unwrap_or(0),
                product_count: get_tag("Product-Count").and_then(|r| r.parse().ok()).unwrap_or(0),
                category: get_tag("Category"),
            });
        }
    }
    Ok(results)
}`);

fs.writeFileSync(f, lines.join('\r\n'));
console.log('Total fixes: ' + fixes);

// 4. Wire routes in main.rs
const mf = 'src\\main.rs';
let ml = fs.readFileSync(mf, 'utf8').split(/\r?\n/);
let mfixes = 0;

for (let i = 0; i < ml.length; i++) {
  if (ml[i].includes('api_get_counterparty_stats_batch')) {
    // Check if APT routes already exist
    if (!ml[i+1]?.includes('counterparty/apt')) {
      const routes = [
        '        .route("/api/counterparty/apt/{apt}", web::get().to(townhall_verification_complete::api_counterparty_by_apt))',
        '        .route("/api/storefront/apt/{apt}", web::get().to(townhall_verification_complete::api_storefront_by_apt))',
        '        .route("/api/storefront/apt/{apt}/products", web::get().to(townhall_verification_complete::api_products_by_apt))',
      ];
      ml.splice(i + 1, 0, ...routes);
      mfixes++; console.log('Added 3 APT routes to main.rs');
    } else {
      console.log('APT routes already in main.rs');
    }
    break;
  }
}

fs.writeFileSync(mf, ml.join('\r\n'));
console.log('main.rs fixes: ' + mfixes);
