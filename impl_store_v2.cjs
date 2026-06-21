const fs = require('fs');
const f = 'src\\townhall_verification_complete.rs';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);

const products = `async fn query_products_from_arweave(pubkey: &str, category: Option<&str>) -> Result<Vec<Product>, String> {
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
        .timeout(std::time::Duration::from_secs(10))
        .send().await {
        Ok(r) => r,
        Err(_) => client.post("https://arweave-search.goldsky.com/graphql")
            .json(&serde_json::json!({ "query": query }))
            .timeout(std::time::Duration::from_secs(10))
            .send().await
            .map_err(|e| format!("Query failed: {}", e))?,
    };
    let data: serde_json::Value = response.json().await.map_err(|e| format!("Parse: {}", e))?;
    let edges = data.pointer("/data/transactions/edges").and_then(|e| e.as_array());
    let mut products = Vec::new();
    if let Some(edges) = edges {
        for edge in edges {
            let tx_id = match edge.pointer("/node/id").and_then(|v| v.as_str()) {
                Some(id) => id, None => continue,
            };
            if let Ok(resp) = client.get(&format!("https://arweave.net/{}", tx_id))
                .timeout(std::time::Duration::from_secs(10))
                .send().await {
                if resp.status().is_success() {
                    if let Ok(product) = resp.json::<Product>().await {
                        products.push(product);
                    }
                }
            }
        }
    }
    Ok(products)
}`.split('\n');

const search = `async fn search_storefronts_arweave(query: &StorefrontSearchQuery, limit: usize, _offset: usize) -> Result<Vec<StorefrontSearchResult>, String> {
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
        .timeout(std::time::Duration::from_secs(10))
        .send().await {
        Ok(r) => r,
        Err(_) => client.post("https://arweave-search.goldsky.com/graphql")
            .json(&serde_json::json!({ "query": gql }))
            .timeout(std::time::Duration::from_secs(10))
            .send().await
            .map_err(|e| format!("Query failed: {}", e))?,
    };
    let data: serde_json::Value = response.json().await.map_err(|e| format!("Parse: {}", e))?;
    let edges = data.pointer("/data/transactions/edges").and_then(|e| e.as_array());
    let mut results = Vec::new();
    if let Some(edges) = edges {
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
}`.split('\n');

const upload = `async fn upload_storefront_to_arweave(storefront: &Storefront) -> Result<String, String> {
    let mut hasher = Sha256::new();
    hasher.update(storefront.owner_pubkey.as_bytes());
    hasher.update(storefront.brand_name.as_bytes());
    hasher.update(&storefront.updated_at.to_le_bytes());
    let hash = hex::encode(hasher.finalize());
    Ok(format!("PENDING_{}", &hash[..16]))
}`.split('\n');

function replaceFn(lines, sig, newBody) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith(sig)) {
      let depth = 0, end = i;
      for (let j = i; j < lines.length; j++) {
        for (const ch of lines[j]) { if (ch==='{') depth++; if (ch==='}') depth--; }
        if (depth === 0 && j > i) { end = j; break; }
      }
      lines.splice(i, end - i + 1, ...newBody);
      return true;
    }
  }
  return false;
}

if (replaceFn(lines, 'async fn query_products_from_arweave(', products))
  console.log('Replaced query_products_from_arweave');
else console.log('WARN: products fn not found');

if (replaceFn(lines, 'async fn search_storefronts_arweave(', search))
  console.log('Replaced search_storefronts_arweave');
else console.log('WARN: search fn not found');

if (replaceFn(lines, 'async fn upload_storefront_to_arweave(', upload))
  console.log('Replaced upload_storefront_to_arweave');
else console.log('WARN: upload fn not found');

fs.writeFileSync(f, lines.join('\r\n'));
console.log('Done');
