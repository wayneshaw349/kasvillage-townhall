const fs = require('fs');
let c = fs.readFileSync('src/main.rs', 'utf8');

const handler = [
'// APT lookup with attestations',
'async fn check_device_by_apt(',
'    query: web::Query<std::collections::HashMap<String, String>>,',
'    state: web::Data<AppStateV3>,',
') -> impl Responder {',
'    let apt_raw = match query.get("apt") {',
'        Some(a) => a.replace("APT-", ""),',
'        None => return HttpResponse::BadRequest().json(json!({ "error": "apt parameter required" })),',
'    };',
'    let gql = format!(r#"{{"query":"{{ transactions(tags: [{{ name: \\"App-Name\\", values: [\\"KasVillage\\"] }}, {{ name: \\"KV-Type\\", values: [\\"device-attestation\\"] }}, {{ name: \\"KV-Apt\\", values: [\\"{}\\"] }}], sort: HEIGHT_DESC, first: 1) {{ edges {{ node {{ id tags {{ name value }} }} }} }} }}"}}"#, apt_raw);',
'    let client = reqwest::Client::new();',
'    let resp = match client.post("https://arweave.net/graphql").header("Content-Type","application/json").body(gql).timeout(std::time::Duration::from_secs(8)).send().await {',
'        Ok(r) => r,',
'        Err(e) => return HttpResponse::InternalServerError().json(json!({"error": format!("Arweave query failed: {}", e)})),',
'    };',
'    let data = match resp.json::<serde_json::Value>().await { Ok(d) => d, Err(_) => return HttpResponse::Ok().json(json!({"found":false,"apt":apt_raw})) };',
'    let edges = &data["data"]["transactions"]["edges"];',
'    let edge = match edges.as_array().and_then(|a| a.first()) { Some(e) => e, None => return HttpResponse::Ok().json(json!({"found":false,"apt":apt_raw})) };',
'    let attestation_tx = edge["node"]["id"].as_str().unwrap_or("").to_string();',
'    let mut pubkey = String::new(); let mut platform = String::new();',
'    if let Some(arr) = edge["node"]["tags"].as_array() { for t in arr { match t["name"].as_str() { Some("KV-Pubkey") => pubkey = t["value"].as_str().unwrap_or("").to_string(), Some("KV-Platform") => platform = t["value"].as_str().unwrap_or("").to_string(), _ => {} } } }',
'    if pubkey.is_empty() { return HttpResponse::Ok().json(json!({"found":false,"apt":apt_raw})); }',
'    let stats = state.arweave_reader.get_user_stats(&pubkey).await.ok();',
'    let agr_gql = format!(r#"{{"query":"{{ transactions(tags: [{{ name: \\"App-Name\\", values: [\\"KasVillage\\"] }}, {{ name: \\"KV-Type\\", values: [\\"frost-agreement\\"] }}, {{ name: \\"KV-Pubkey\\", values: [\\"{}\\"] }}, {{ name: \\"KV-Status\\", values: [\\"Released\\"] }}], sort: HEIGHT_DESC, first: 10) {{ edges {{ node {{ id tags {{ name value }} }} }} }} }}"}}"#, pubkey);',
'    let mut agreements: Vec<serde_json::Value> = Vec::new();',
'    if let Ok(ar) = client.post("https://arweave.net/graphql").header("Content-Type","application/json").body(agr_gql).timeout(std::time::Duration::from_secs(8)).send().await {',
'        if let Ok(ad) = ar.json::<serde_json::Value>().await { if let Some(ae) = ad["data"]["transactions"]["edges"].as_array() { for e in ae { let mut m = serde_json::Map::new(); m.insert("tx".into(), e["node"]["id"].clone()); m.insert("role".into(), json!("buyer")); if let Some(ts) = e["node"]["tags"].as_array() { for t in ts { let n=t["name"].as_str().unwrap_or(""); let v=t["value"].as_str().unwrap_or(""); match n { "KV-AgreementId"|"KV-Amount"|"KV-FrostAddress"|"KV-Status"|"Unix-Time" => { m.insert(n.into(), json!(v)); }, _ => {} } } } agreements.push(serde_json::Value::Object(m)); } } }',
'    }',
'    let cp_gql = format!(r#"{{"query":"{{ transactions(tags: [{{ name: \\"App-Name\\", values: [\\"KasVillage\\"] }}, {{ name: \\"KV-Type\\", values: [\\"frost-agreement\\"] }}, {{ name: \\"KV-Counterparty\\", values: [\\"{}\\"] }}, {{ name: \\"KV-Status\\", values: [\\"Released\\"] }}], sort: HEIGHT_DESC, first: 10) {{ edges {{ node {{ id tags {{ name value }} }} }} }} }}"}}"#, pubkey);',
'    if let Ok(cr) = client.post("https://arweave.net/graphql").header("Content-Type","application/json").body(cp_gql).timeout(std::time::Duration::from_secs(8)).send().await {',
'        if let Ok(cd) = cr.json::<serde_json::Value>().await { if let Some(ce) = cd["data"]["transactions"]["edges"].as_array() { for e in ce { let mut m = serde_json::Map::new(); m.insert("tx".into(), e["node"]["id"].clone()); m.insert("role".into(), json!("seller")); if let Some(ts) = e["node"]["tags"].as_array() { for t in ts { let n=t["name"].as_str().unwrap_or(""); let v=t["value"].as_str().unwrap_or(""); match n { "KV-AgreementId"|"KV-Amount"|"KV-FrostAddress"|"KV-Status"|"Unix-Time" => { m.insert(n.into(), json!(v)); }, _ => {} } } } agreements.push(serde_json::Value::Object(m)); } } }',
'    }',
'    HttpResponse::Ok().json(json!({"found":true,"apt":apt_raw,"pubkey":pubkey,"platform":platform,"attestation_tx":attestation_tx,"stats":stats,"completed_agreements":agreements,"source":"arweave"}))',
'}',
].join('\n');

const marker = 'async fn check_device_attestation(';
if (c.includes(marker)) {
  c = c.replace(marker, '\n' + handler + '\n\n' + marker);
  console.log('1. Added check_device_by_apt handler');
} else { console.log('1. SKIP'); }

const routeMarker = '.route("/api/device/recover"';
if (c.includes(routeMarker)) {
  c = c.replace(routeMarker, '.route("/api/device/check", web::get().to(check_device_by_apt))\n                ' + routeMarker);
  console.log('2. Added /api/device/check route');
} else { console.log('2. SKIP'); }

fs.writeFileSync('src/main.rs', c);
console.log('Done');