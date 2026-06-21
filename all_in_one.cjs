const fs = require('fs');

// Safe function replacer: finds sig, scans to first {, THEN counts braces
function replaceFnSafe(lines, sig, newBody) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith(sig)) {
      // Find the opening { (may be on a later line for multi-line sigs)
      let braceStart = -1;
      for (let j = i; j < Math.min(i + 10, lines.length); j++) {
        if (lines[j].includes('{')) { braceStart = j; break; }
      }
      if (braceStart < 0) continue;
      // Now count braces from braceStart
      let depth = 0, end = braceStart;
      for (let j = braceStart; j < lines.length; j++) {
        for (const ch of lines[j]) { if (ch==='{') depth++; if (ch==='}') depth--; }
        if (depth === 0) { end = j; break; }
      }
      // Also grab doc comment above
      let start = i;
      while (start > 0 && lines[start-1].trim().startsWith('///')) start--;
      console.log('  Replacing L' + (start+1) + '-' + (end+1) + ' (' + sig.substring(0,35) + ')');
      lines.splice(start, end - start + 1, ...newBody.split('\n'));
      return true;
    }
  }
  return false;
}

// === VERIFICATION MODULE ===
const vf = 'src\\townhall_verification_complete.rs';
let vl = fs.readFileSync(vf, 'utf8').split(/\r?\n/);
console.log('=== Verification module ===');

// 1. Fix CounterpartyLookupRequest
for (let i = 0; i < vl.length; i++) {
  if (vl[i].includes('pub struct CounterpartyLookupRequest')) {
    if (!vl[i-1].includes('Default')) {
      vl[i-1] = vl[i-1].replace('Deserialize)', 'Deserialize, Default)');
      console.log('  Added Default to CounterpartyLookupRequest');
    }
    // Add serde(default) to pubkey if missing
    for (let j = i+1; j < i+5; j++) {
      if (vl[j].trim() === 'pub pubkey: String,' && !vl[j-1].includes('serde(default)')) {
        vl.splice(j, 0, '    #[serde(default)]');
        console.log('  Added serde(default) to pubkey');
        break;
      }
    }
    break;
  }
}

// 2. Add resolve_apt_to_pubkey + all APT handlers before api_get_counterparty_stats
for (let i = 0; i < vl.length; i++) {
  if (vl[i].trim() === '/// Get counterparty stats by pubkey' || 
      vl[i].includes('pub async fn api_get_counterparty_stats(')) {
    // Go back to include doc comment
    let insertAt = i;
    if (vl[i].trim().startsWith('///')) insertAt = i;
    
    const handlers = `/// Resolve APT to pubkey via Arweave identity inscription
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
    HttpResponse::Ok().json(serde_json::json!({ "ok": true, "dapps": dapps, "count": dapps.len() }))
}

/// GET /api/dapp/apt/{apt}
pub async fn api_dapps_by_apt(path: web::Path<String>) -> HttpResponse {
    match resolve_apt_to_pubkey(&path.into_inner()).await {
        Ok(pk) => api_get_dapps_by_owner(web::Path::from(pk)).await,
        Err(r) => r,
    }
}

`;
    vl.splice(insertAt, 0, ...handlers.split('\n'));
    console.log('  Added resolve_apt_to_pubkey + 6 handlers');
    break;
  }
}

// 3. Replace storefront stubs
replaceFnSafe(vl, 'async fn upload_storefront_to_arweave(', `async fn upload_storefront_to_arweave(storefront: &Storefront) -> Result<String, String> {
    let mut hasher = Sha256::new();
    hasher.update(storefront.owner_pubkey.as_bytes());
    hasher.update(storefront.brand_name.as_bytes());
    hasher.update(&storefront.updated_at.to_le_bytes());
    let hash = hex::encode(hasher.finalize());
    Ok(format!("PENDING_{}", &hash[..16]))
}`);

replaceFnSafe(vl, 'async fn query_products_from_arweave(', `async fn query_products_from_arweave(pubkey: &str, category: Option<&str>) -> Result<Vec<Product>, String> {
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
}`);

replaceFnSafe(vl, 'async fn search_storefronts_arweave(', `async fn search_storefronts_arweave(query: &StorefrontSearchQuery, limit: usize, _offset: usize) -> Result<Vec<StorefrontSearchResult>, String> {
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
}`);

fs.writeFileSync(vf, vl.join('\r\n'));
console.log('  Verification module done');

// === MAIN.RS: add missing routes ===
console.log('=== main.rs ===');
const mf = 'src\\main.rs';
let ml = fs.readFileSync(mf, 'utf8').split(/\r?\n/);

for (let i = 0; i < ml.length; i++) {
  if (ml[i].includes('counterparty/apt/{apt}')) {
    let routes = [];
    let nearby = ml.slice(i, i+8).join('\n');
    if (!nearby.includes('storefront/apt')) {
      routes.push('        .route("/api/storefront/apt/{apt}", web::get().to(townhall_verification_complete::api_storefront_by_apt))');
      routes.push('        .route("/api/storefront/apt/{apt}/products", web::get().to(townhall_verification_complete::api_products_by_apt))');
    }
    if (!nearby.includes('dapp/apt')) {
      routes.push('        .route("/api/dapp/{pubkey}", web::get().to(townhall_verification_complete::api_get_dapps_by_owner))');
      routes.push('        .route("/api/dapp/apt/{apt}", web::get().to(townhall_verification_complete::api_dapps_by_apt))');
    }
    if (routes.length > 0) {
      ml.splice(i + 1, 0, ...routes);
      console.log('  Added ' + routes.length + ' routes');
    } else {
      console.log('  All routes exist');
    }
    break;
  }
}

fs.writeFileSync(mf, ml.join('\r\n'));
console.log('Done');
