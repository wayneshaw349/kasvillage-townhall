const fs = require('fs');

// === 1. Add DApp query + APT handler to verification module ===
const vf = 'src\\townhall_verification_complete.rs';
let vlines = fs.readFileSync(vf, 'utf8').split(/\r?\n/);

// Find api_get_storefront and insert DApp endpoints before it
for (let i = 0; i < vlines.length; i++) {
  if (vlines[i].includes('pub async fn api_get_storefront(')) {
    const code = `/// GET /api/dapp/{pubkey} — list DApps by owner
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
            Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({ "ok": false, "error": format!("Query failed: {}", e) })),
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
        Ok(pubkey) => api_get_dapps_by_owner(web::Path::from(pubkey)).await,
        Err(resp) => resp,
    }
}

`;
    vlines.splice(i, 0, ...code.split('\n'));
    console.log('Added DApp query + APT handler');
    break;
  }
}
fs.writeFileSync(vf, vlines.join('\r\n'));

// === 2. Add ALL missing APT routes to main.rs ===
const mf = 'src\\main.rs';
let ml = fs.readFileSync(mf, 'utf8').split(/\r?\n/);

for (let i = 0; i < ml.length; i++) {
  if (ml[i].includes('counterparty/apt/{apt}')) {
    let routes = [];
    // Check each route individually
    if (!ml.slice(i, i+5).some(l => l.includes('storefront/apt/{apt}"'))) {
      routes.push('        .route("/api/storefront/apt/{apt}", web::get().to(townhall_verification_complete::api_storefront_by_apt))');
      routes.push('        .route("/api/storefront/apt/{apt}/products", web::get().to(townhall_verification_complete::api_products_by_apt))');
    }
    if (!ml.slice(i, i+5).some(l => l.includes('dapp/apt'))) {
      routes.push('        .route("/api/dapp/{pubkey}", web::get().to(townhall_verification_complete::api_get_dapps_by_owner))');
      routes.push('        .route("/api/dapp/apt/{apt}", web::get().to(townhall_verification_complete::api_dapps_by_apt))');
    }
    if (routes.length > 0) {
      ml.splice(i + 1, 0, ...routes);
      console.log('Added ' + routes.length + ' routes to main.rs');
    } else {
      console.log('All routes already exist');
    }
    break;
  }
}

fs.writeFileSync(mf, ml.join('\r\n'));
console.log('Done');
