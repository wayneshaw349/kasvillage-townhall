const fs = require('fs');

// Add handler to townhall_verification_complete.rs (no AppState needed)
const vf = 'src\\townhall_verification_complete.rs';
let vlines = fs.readFileSync(vf, 'utf8').split(/\r?\n/);

// Find api_get_counterparty_stats and insert before it
for (let i = 0; i < vlines.length; i++) {
  if (vlines[i].includes('pub async fn api_get_counterparty_stats(')) {
    const handler = [
      '/// GET /api/counterparty/apt/{apt} — resolve APT via Arweave identity inscription',
      'pub async fn api_counterparty_by_apt(',
      '    path: web::Path<String>,',
      ') -> HttpResponse {',
      '    let apt_raw = path.into_inner();',
      '    let apt_clean = apt_raw.trim_start_matches("APT-").trim_start_matches("apt-");',
      '',
      '    // Hash APT same way as phone: SHA256("APT:" + alias) first 8 bytes',
      '    let apt_hash = compute_hash_index(&format!("APT:{}", apt_clean));',
      '',
      '    // Query Arweave for identity inscription with this APT-Hash',
      '    let query = format!(',
      '        r#"query {{ transactions( tags: [ {{ name: "App-Name", values: ["KasVillage"] }}, {{ name: "Type", values: ["KV_IDENTITY_V1"] }}, {{ name: "APT-Hash", values: ["{}"] }} ], first: 1, sort: HEIGHT_DESC ) {{ edges {{ node {{ id tags {{ name value }} }} }} }} }}"#,',
      '        apt_hash',
      '    );',
      '',
      '    let client = reqwest::Client::new();',
      '    let response = match client.post("https://arweave.net/graphql")',
      '        .json(&serde_json::json!({ "query": query }))',
      '        .timeout(std::time::Duration::from_secs(10))',
      '        .send().await {',
      '        Ok(r) => r,',
      '        Err(_) => match client.post("https://arweave-search.goldsky.com/graphql")',
      '            .json(&serde_json::json!({ "query": query }))',
      '            .timeout(std::time::Duration::from_secs(10))',
      '            .send().await {',
      '            Ok(r) => r,',
      '            Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({',
      '                "ok": false, "error": format!("Arweave query failed: {}", e)',
      '            })),',
      '        },',
      '    };',
      '',
      '    let data: serde_json::Value = match response.json().await {',
      '        Ok(d) => d,',
      '        Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({',
      '            "ok": false, "error": format!("Parse error: {}", e)',
      '        })),',
      '    };',
      '',
      '    // Extract Owner-Pubkey from tags',
      '    let edges = data.pointer("/data/transactions/edges").and_then(|e| e.as_array());',
      '    let pubkey = edges.and_then(|edges| {',
      '        edges.first()?.pointer("/node/tags")?.as_array()?.iter()',
      '            .find(|t| t.get("name").and_then(|n| n.as_str()) == Some("Owner-Pubkey"))',
      '            .and_then(|t| t.get("value").and_then(|v| v.as_str()))',
      '            .map(|s| s.to_string())',
      '    });',
      '',
      '    match pubkey {',
      '        Some(pk) if pk.len() == 64 || pk.len() == 66 => {',
      '            // Forward to counterparty stats',
      '            api_get_counterparty_stats(',
      '                web::Path::from(pk),',
      '                web::Query(CounterpartyLookupRequest::default()),',
      '            ).await',
      '        }',
      '        Some(pk) => HttpResponse::BadRequest().json(serde_json::json!({',
      '            "ok": false,',
      '            "error": format!("APT {} resolved but pubkey invalid (len {})", apt_raw, pk.len()),',
      '            "apt_hash": apt_hash',
      '        })),',
      '        None => HttpResponse::NotFound().json(serde_json::json!({',
      '            "ok": false,',
      '            "error": format!("APT {} not found on Arweave", apt_raw),',
      '            "apt_hash": apt_hash',
      '        })),',
      '    }',
      '}',
      '',
    ];
    vlines.splice(i, 0, ...handler);
    console.log('Added api_counterparty_by_apt handler');
    break;
  }
}

// Add Default derive to CounterpartyLookupRequest if missing
for (let i = 0; i < vlines.length; i++) {
  if (vlines[i].includes('pub struct CounterpartyLookupRequest')) {
    const prev = vlines[i-1].trim();
    if (!prev.includes('Default')) {
      vlines[i-1] = vlines[i-1].replace('Deserialize)', 'Deserialize, Default)');
      console.log('Added Default to CounterpartyLookupRequest');
    }
    break;
  }
}

fs.writeFileSync(vf, vlines.join('\r\n'));

// Wire route in main.rs
const mf = 'src\\main.rs';
let mlines = fs.readFileSync(mf, 'utf8').split(/\r?\n/);

for (let i = 0; i < mlines.length; i++) {
  if (mlines[i].includes('api_get_counterparty_stats_batch')) {
    const route = '        .route("/api/counterparty/apt/{apt}", web::get().to(townhall_verification_complete::api_counterparty_by_apt))';
    mlines.splice(i + 1, 0, route);
    console.log('Added /api/counterparty/apt/{apt} route');
    break;
  }
}

fs.writeFileSync(mf, mlines.join('\r\n'));
console.log('Done');
