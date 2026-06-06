// patch_main_device_check.cjs
// Adds /api/device/check to main.rs configure_routes_v3
// Pure Arweave query — no state stored
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'main.rs');
let src = fs.readFileSync(file, 'utf8');

// 1. Add check_device handler before configure_routes_v3
if (!src.includes('check_device_attestation')) {
  const handler = `
// ── Device attestation check — stateless Arweave query ──────────────────────
async fn check_device_attestation(
    body: web::Json<serde_json::Value>,
) -> impl Responder {
    let device_hash = match body.get("device_hash").and_then(|v| v.as_str()) {
        Some(h) => h.to_string(),
        None => return HttpResponse::BadRequest().json(json!({ "error": "device_hash required" })),
    };

    // Query Arweave for device attestation
    let gql = format!(
        r#"{{"query":"{{ transactions(tags: [{{ name: \\"App-Name\\", values: [\\"KasVillage\\"] }}, {{ name: \\"KV-Type\\", values: [\\"device-attestation\\"] }}, {{ name: \\"KV-DeviceHash\\", values: [\\"{}\\"] }}], sort: HEIGHT_DESC, first: 1) {{ edges {{ node {{ tags {{ name value }} }} }} }} }}"}}"#,
        device_hash
    );

    let client = reqwest::Client::new();
    match client.post("https://arweave.net/graphql")
        .header("Content-Type", "application/json")
        .body(gql)
        .timeout(std::time::Duration::from_secs(8))
        .send()
        .await
    {
        Ok(resp) => {
            if let Ok(data) = resp.json::<serde_json::Value>().await {
                let edges = &data["data"]["transactions"]["edges"];
                if let Some(edge) = edges.as_array().and_then(|a| a.first()) {
                    let tags = &edge["node"]["tags"];
                    let mut pubkey = String::new();
                    let mut apt = String::new();
                    let mut platform = String::new();
                    if let Some(arr) = tags.as_array() {
                        for t in arr {
                            match t["name"].as_str() {
                                Some("KV-Pubkey") => pubkey = t["value"].as_str().unwrap_or("").to_string(),
                                Some("KV-Apt") => apt = t["value"].as_str().unwrap_or("").to_string(),
                                Some("KV-Platform") => platform = t["value"].as_str().unwrap_or("").to_string(),
                                _ => {}
                            }
                        }
                    }
                    return HttpResponse::Ok().json(json!({
                        "attested": true,
                        "pubkey": pubkey,
                        "apt": apt,
                        "platform": platform,
                        "source": "arweave"
                    }));
                }
            }
            HttpResponse::Ok().json(json!({ "attested": false }))
        }
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "error": format!("Arweave query failed: {}", e)
        })),
    }
}
`;

  src = src.replace(
    'pub fn configure_routes_v3',
    handler + 'pub fn configure_routes_v3'
  );
  console.log('✅ Added check_device_attestation handler');
}

// 2. Add route to configure_routes_v3
if (!src.includes('/api/device/check')) {
  src = src.replace(
    `.route("/api/code/register", web::post().to(register_signature_api));`,
    `.route("/api/code/register", web::post().to(register_signature_api))
        .route("/api/device/check", web::post().to(check_device_attestation));`
  );
  console.log('✅ Added /api/device/check route to configure_routes_v3');
}

// 3. Add reqwest to imports if not present
if (!src.includes('use reqwest')) {
  // reqwest is likely already a dependency but not imported in main.rs
  // The handler uses reqwest::Client — check if it's available
  console.log('   Note: ensure reqwest is in Cargo.toml dependencies');
}

fs.writeFileSync(file, src, 'utf8');
console.log('✅ main.rs patched');
console.log('   POST /api/device/check { device_hash: "..." }');
console.log('   → Arweave query → { attested, pubkey, apt, platform }');
