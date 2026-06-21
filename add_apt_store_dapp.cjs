const fs = require('fs');
const vf = 'src\\townhall_verification_complete.rs';
let vlines = fs.readFileSync(vf, 'utf8').split(/\r?\n/);

// 1. Add shared resolve_apt_to_pubkey helper + storefront/dapp APT handlers
// Insert before api_counterparty_by_apt
for (let i = 0; i < vlines.length; i++) {
  if (vlines[i].includes('pub async fn api_counterparty_by_apt(')) {
    const code = [
      '/// Resolve APT number to pubkey via Arweave identity inscription',
      'async fn resolve_apt_to_pubkey(apt_raw: &str) -> Result<String, HttpResponse> {',
      '    let apt_clean = apt_raw.trim_start_matches("APT-").trim_start_matches("apt-");',
      '    let apt_hash = compute_hash_index(&format!("APT:{}", apt_clean));',
      '    let query = format!(',
      '        r#"query {{ transactions( tags: [ {{ name: "App-Name", values: ["KasVillage"] }}, {{ name: "Type", values: ["KV_IDENTITY_V1"] }}, {{ name: "APT-Hash", values: ["{}"] }} ], first: 1, sort: HEIGHT_DESC ) {{ edges {{ node {{ tags {{ name value }} }} }} }} }}"#,',
      '        apt_hash',
      '    );',
      '    let client = reqwest::Client::new();',
      '    let response = match client.post("https://arweave.net/graphql")',
      '        .json(&serde_json::json!({ "query": query }))',
      '        .timeout(std::time::Duration::from_secs(10))',
      '        .send().await {',
      '        Ok(r) => r,',
      '        Err(_) => client.post("https://arweave-search.goldsky.com/graphql")',
      '            .json(&serde_json::json!({ "query": query }))',
      '            .timeout(std::time::Duration::from_secs(10))',
      '            .send().await',
      '            .map_err(|e| HttpResponse::InternalServerError().json(serde_json::json!({ "ok": false, "error": format!("Arweave: {}", e) })))?,',
      '    };',
      '    let data: serde_json::Value = response.json().await',
      '        .map_err(|e| HttpResponse::InternalServerError().json(serde_json::json!({ "ok": false, "error": format!("Parse: {}", e) })))?;',
      '    data.pointer("/data/transactions/edges")',
      '        .and_then(|e| e.as_array())',
      '        .and_then(|edges| edges.first())',
      '        .and_then(|edge| edge.pointer("/node/tags"))',
      '        .and_then(|tags| tags.as_array())',
      '        .and_then(|tags| tags.iter()',
      '            .find(|t| t.get("name").and_then(|n| n.as_str()) == Some("Owner-Pubkey"))',
      '            .and_then(|t| t.get("value").and_then(|v| v.as_str()))',
      '            .map(|s| s.to_string()))',
      '        .ok_or_else(|| HttpResponse::NotFound().json(serde_json::json!({',
      '            "ok": false, "error": format!("APT {} not found on Arweave", apt_raw), "apt_hash": apt_hash',
      '        })))',
      '}',
      '',
      '/// GET /api/storefront/apt/{apt} — resolve APT, return storefront',
      'pub async fn api_storefront_by_apt(path: web::Path<String>) -> HttpResponse {',
      '    let apt_raw = path.into_inner();',
      '    match resolve_apt_to_pubkey(&apt_raw).await {',
      '        Ok(pubkey) => api_get_storefront(web::Path::from(pubkey)).await,',
      '        Err(resp) => resp,',
      '    }',
      '}',
      '',
      '/// GET /api/storefront/apt/{apt}/products — resolve APT, return products',
      'pub async fn api_products_by_apt(path: web::Path<String>, query: web::Query<std::collections::HashMap<String, String>>) -> HttpResponse {',
      '    let apt_raw = path.into_inner();',
      '    match resolve_apt_to_pubkey(&apt_raw).await {',
      '        Ok(pubkey) => api_get_products(web::Path::from(pubkey), query).await,',
      '        Err(resp) => resp,',
      '    }',
      '}',
      '',
    ];
    vlines.splice(i, 0, ...code);
    console.log('Added resolve_apt_to_pubkey + storefront/products APT handlers');
    break;
  }
}

// 2. Simplify api_counterparty_by_apt to use shared helper
// Find the existing handler and replace its body
for (let i = 0; i < vlines.length; i++) {
  if (vlines[i].includes('pub async fn api_counterparty_by_apt(')) {
    let depth = 0, end = i;
    for (let j = i; j < vlines.length; j++) {
      for (const ch of vlines[j]) { if (ch==='{') depth++; if (ch==='}') depth--; }
      if (depth === 0 && j > i) { end = j; break; }
    }
    const simplified = [
      '/// GET /api/counterparty/apt/{apt} — resolve APT, return stats',
      'pub async fn api_counterparty_by_apt(path: web::Path<String>) -> HttpResponse {',
      '    let apt_raw = path.into_inner();',
      '    match resolve_apt_to_pubkey(&apt_raw).await {',
      '        Ok(pubkey) => api_get_counterparty_stats(',
      '            web::Path::from(pubkey),',
      '            web::Query(CounterpartyLookupRequest::default()),',
      '        ).await,',
      '        Err(resp) => resp,',
      '    }',
      '}',
    ];
    vlines.splice(i, end - i + 1, ...simplified);
    console.log('Simplified api_counterparty_by_apt to use shared resolver');
    break;
  }
}

fs.writeFileSync(vf, vlines.join('\r\n'));

// 3. Wire routes in main.rs
const mf = 'src\\main.rs';
let mlines = fs.readFileSync(mf, 'utf8').split(/\r?\n/);

for (let i = 0; i < mlines.length; i++) {
  if (mlines[i].includes('api_counterparty_by_apt')) {
    // Add storefront APT routes after counterparty APT
    const routes = [
      '        .route("/api/storefront/apt/{apt}", web::get().to(townhall_verification_complete::api_storefront_by_apt))',
      '        .route("/api/storefront/apt/{apt}/products", web::get().to(townhall_verification_complete::api_products_by_apt))',
    ];
    mlines.splice(i + 1, 0, ...routes);
    console.log('Added storefront APT routes');
    break;
  }
}

fs.writeFileSync(mf, mlines.join('\r\n'));
console.log('Done');
