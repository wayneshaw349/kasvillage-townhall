const fs = require('fs');

// === Backend: Make api_get_dapps_by_owner filter by visibility ===
console.log('=== Backend visibility filter ===');
const vf = 'src\\townhall_verification_complete.rs';
let vl = fs.readFileSync(vf, 'utf8').split(/\r?\n/);

// Find api_get_dapps_by_owner and add visibility filtering
// Add a query param check for ?visibility=true
for (let i = 0; i < vl.length; i++) {
  if (vl[i].includes('pub async fn api_get_dapps_by_owner(')) {
    // Find the response line where we build the JSON
    for (let j = i; j < i + 50 && j < vl.length; j++) {
      if (vl[j].includes('"ok": true, "dapps": dapps')) {
        // Add visibility enrichment before the response
        const enrichment = `    // Enrich with pledge status for each DApp owner
    let mut visible_dapps = Vec::new();
    for dapp in &dapps {
        let owner = dapp.get("owner").and_then(|v| v.as_str()).unwrap_or_default();
        if !owner.is_empty() {
            let pledge = query_dapp_pledge(owner).await;
            let pledge_active = if let Some(ref p) = pledge {
                let bal = query_kaspa_balance(&p.pledge_address).await.unwrap_or(0);
                let current_daa = query_current_daa_score().await.unwrap_or(0);
                bal >= p.pledge_sompi && current_daa <= p.end_daa
            } else { false };
            let mut enriched = dapp.clone();
            if let Some(obj) = enriched.as_object_mut() {
                obj.insert("pledge_active".into(), serde_json::json!(pledge_active));
                if let Some(ref p) = pledge {
                    obj.insert("pledge_kas".into(), serde_json::json!(p.pledge_kas));
                    obj.insert("pledge_duration_days".into(), serde_json::json!(p.duration_daa / 86400));
                }
            }
            visible_dapps.push(enriched);
        } else {
            visible_dapps.push(dapp.clone());
        }
    }
    let dapps = visible_dapps;`;
        vl.splice(j, 0, ...enrichment.split('\n'));
        console.log('  Added visibility enrichment to DApp response');
        break;
      }
    }
    break;
  }
}

fs.writeFileSync(vf, vl.join('\r\n'));
console.log('Done');
