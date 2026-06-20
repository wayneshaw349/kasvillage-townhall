const fs = require('fs');
let c = fs.readFileSync('src/main.rs', 'utf8');

// 1. Add mod declaration at the top (after existing use statements)
const firstUse = c.indexOf('use ');
const lineStart = c.lastIndexOf('\n', firstUse) + 1;
c = c.substring(0, lineStart) + 'mod townhall_verification_complete;\n\n' + c.substring(lineStart);
console.log('1. Added mod declaration');

// 2. Add /api/verify/stats route (find existing routes)
const routeMarker = '.route("/user-stats"';
const routeIdx = c.indexOf(routeMarker);
if (routeIdx > -1) {
  const lineEnd = c.indexOf('\n', routeIdx);
  c = c.substring(0, lineEnd + 1) + '        .route("/api/verify/stats", web::post().to(api_verify_stats_proof))\n' + c.substring(lineEnd + 1);
  console.log('2. Added /api/verify/stats route');
}

// 3. Add endpoint handler before main()
const mainFn = c.indexOf('#[actix_web::main]');
if (mainFn === -1) { console.log('3. SKIP - no main found'); }
else {
  const handler = `
/// POST /api/verify/stats - Generate Halo2 SNARK proof of user stats
async fn api_verify_stats_proof(body: web::Json<serde_json::Value>) -> HttpResponse {
    let pubkey = match body.get("pubkey").and_then(|v| v.as_str()) {
        Some(p) if p.len() >= 60 => p.to_string(),
        _ => return HttpResponse::BadRequest().json(serde_json::json!({"error": "pubkey required"})),
    };
    
    match townhall_verification_complete::aggregate_and_prove_stats(&pubkey).await {
        Ok((stats, proof)) => {
            HttpResponse::Ok().json(serde_json::json!({
                "ok": true,
                "stats": stats,
                "proof": proof,
            }))
        }
        Err(e) => {
            HttpResponse::InternalServerError().json(serde_json::json!({
                "ok": false,
                "error": e,
            }))
        }
    }
}

`;
  c = c.substring(0, mainFn) + handler + c.substring(mainFn);
  console.log('3. Added endpoint handler');
}

fs.writeFileSync('src/main.rs', c);
console.log('Done - try: cargo check');
