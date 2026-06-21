const fs = require('fs');

// === 1. DApp Visibility System — townhall_verification_complete.rs ===
const vf = 'src\\townhall_verification_complete.rs';
let vl = fs.readFileSync(vf, 'utf8').split(/\r?\n/);
console.log('=== DApp Visibility System ===');

for (let i = vl.length - 1; i >= 0; i--) {
  if (vl[i].includes('fn compute_hash_index(')) {
    const code = `// ============================================================================
// DAPP VISIBILITY SYSTEM
// ============================================================================
// Two-layer: Pledge Gate (binary) + Ranking Score (composite)
// Pledge Gate: active pledge + balance >= pledged amount → visible
// Ranking Score: commitment + XP + stats + recency → sort order
// All inputs L1/Arweave verifiable, fully stateless
// ============================================================================

const SOMPI_PER_KAS: f64 = 100_000_000.0;

/// Query Kaspa address balance from L1
async fn query_kaspa_balance(address: &str) -> Result<u64, String> {
    let url = format!("https://api-tn.kaspa.org/addresses/{}/balance", address);
    let client = reqwest::Client::new();
    let response = client.get(&url)
        .timeout(std::time::Duration::from_secs(5))
        .send().await.map_err(|e| format!("Balance: {}", e))?;
    if !response.status().is_success() { return Err(format!("Balance API: {}", response.status())); }
    let data: serde_json::Value = response.json().await.map_err(|e| format!("Parse: {}", e))?;
    data.get("balance").and_then(|v| v.as_u64()).ok_or_else(|| "Missing balance".to_string())
}

/// Query KAS price in USD
async fn query_kas_price_usd() -> Result<f64, String> {
    let client = reqwest::Client::new();
    let response = client.get("https://api.coingecko.com/api/v3/simple/price?ids=kaspa&vs_currencies=usd")
        .timeout(std::time::Duration::from_secs(5))
        .send().await.map_err(|e| format!("Price: {}", e))?;
    let data: serde_json::Value = response.json().await.map_err(|e| format!("Parse: {}", e))?;
    data.pointer("/kaspa/usd").and_then(|v| v.as_f64()).ok_or_else(|| "Missing price".to_string())
}

/// Pledge info from Arweave tags
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DAppPledge {
    pub pledge_sompi: u64,
    pub pledge_kas: f64,
    pub start_daa: u64,
    pub duration_daa: u64,
    pub end_daa: u64,
    pub pledge_address: String,
    pub arweave_tx: String,
}

/// Pledge status (checked at query time)
#[derive(Debug, Clone, Serialize)]
pub struct PledgeStatus {
    pub active: bool,
    pub pledge_met: bool,
    pub expired: bool,
    pub pledge_kas: f64,
    pub current_balance_kas: f64,
    pub duration_days: u64,
    pub remaining_days: u64,
    pub elapsed_days: u64,
    pub pledge_usd: f64,
    pub balance_usd: f64,
}

/// Full visibility result
#[derive(Debug, Clone, Serialize)]
pub struct DAppVisibility {
    pub visible: bool,
    pub pledge: PledgeStatus,
    pub ranking_score: f64,
    pub commitment_factor: f64,
    pub xp_factor: f64,
    pub stats_factor: f64,
    pub recency_factor: f64,
}

/// Query Arweave for DApp pledge record
async fn query_dapp_pledge(pubkey: &str) -> Option<DAppPledge> {
    let pubkey_hash = compute_hash_index(&format!("PK:{}", pubkey));
    let query = format!(
        r#"query {{ transactions( tags: [ {{ name: "App-Name", values: ["KasVillage"] }}, {{ name: "Type", values: ["KV_DAPP_PLEDGE_V1"] }}, {{ name: "Pubkey-Hash", values: ["{}"] }} ], first: 1, sort: HEIGHT_DESC ) {{ edges {{ node {{ id tags {{ name value }} }} }} }} }}"#,
        pubkey_hash
    );
    let client = reqwest::Client::new();
    let response = match client.post("https://arweave.net/graphql")
        .json(&serde_json::json!({ "query": query }))
        .timeout(std::time::Duration::from_secs(10)).send().await {
        Ok(r) => r,
        Err(_) => client.post("https://arweave-search.goldsky.com/graphql")
            .json(&serde_json::json!({ "query": query }))
            .timeout(std::time::Duration::from_secs(10)).send().await.ok()?,
    };
    let data: serde_json::Value = response.json().await.ok()?;
    let edge = data.pointer("/data/transactions/edges")?.as_array()?.first()?;
    let tags = edge.pointer("/node/tags")?.as_array()?;
    let get_tag = |name: &str| -> Option<String> {
        tags.iter()
            .find(|t| t.get("name").and_then(|n| n.as_str()) == Some(name))
            .and_then(|t| t.get("value").and_then(|v| v.as_str()))
            .map(|s| s.to_string())
    };
    let pledge_sompi = get_tag("KV-Pledge-Sompi")?.parse::<u64>().ok()?;
    let start_daa = get_tag("KV-Pledge-Start-DAA")?.parse::<u64>().ok()?;
    let duration_daa = get_tag("KV-Pledge-Duration-DAA")?.parse::<u64>().ok()?;
    Some(DAppPledge {
        pledge_sompi,
        pledge_kas: pledge_sompi as f64 / SOMPI_PER_KAS,
        start_daa,
        duration_daa,
        end_daa: start_daa + duration_daa,
        pledge_address: get_tag("KV-Pledge-Address").unwrap_or_default(),
        arweave_tx: edge.pointer("/node/id")?.as_str()?.to_string(),
    })
}

/// Compute full DApp visibility: pledge gate + ranking score
pub async fn compute_full_dapp_visibility(pubkey: &str) -> DAppVisibility {
    // 1. Check pledge from Arweave
    let pledge = query_dapp_pledge(pubkey).await;
    
    // 2. Get current DAA + balance + price
    let current_daa = query_current_daa_score().await.unwrap_or(0);
    let kas_price = query_kas_price_usd().await.unwrap_or(0.05);
    
    let pledge_status = if let Some(ref p) = pledge {
        let balance = query_kaspa_balance(&p.pledge_address).await.unwrap_or(0);
        let balance_kas = balance as f64 / SOMPI_PER_KAS;
        let expired = current_daa > p.end_daa;
        let pledge_met = balance >= p.pledge_sompi;
        let elapsed_daa = current_daa.saturating_sub(p.start_daa);
        let remaining_daa = if expired { 0 } else { p.end_daa.saturating_sub(current_daa) };
        
        PledgeStatus {
            active: !expired && pledge_met,
            pledge_met,
            expired,
            pledge_kas: p.pledge_kas,
            current_balance_kas: balance_kas,
            duration_days: p.duration_daa / 86400,
            remaining_days: remaining_daa / 86400,
            elapsed_days: elapsed_daa / 86400,
            pledge_usd: p.pledge_kas * kas_price,
            balance_usd: balance_kas * kas_price,
        }
    } else {
        // No pledge = not visible
        PledgeStatus {
            active: false, pledge_met: false, expired: true,
            pledge_kas: 0.0, current_balance_kas: 0.0,
            duration_days: 0, remaining_days: 0, elapsed_days: 0,
            pledge_usd: 0.0, balance_usd: 0.0,
        }
    };
    
    // 3. GATE: no active pledge = not visible
    if !pledge_status.active {
        return DAppVisibility {
            visible: false, pledge: pledge_status,
            ranking_score: 0.0, commitment_factor: 0.0,
            xp_factor: 0.0, stats_factor: 0.0, recency_factor: 0.0,
        };
    }
    
    // 4. RANK: compute composite score for sort order
    let events = query_l1_frost_events(pubkey).await.unwrap_or_default();
    let stats = aggregate_l1_events_full(&events, pubkey, current_daa);
    let xp = stats.successes.saturating_mul(10).saturating_sub(stats.deadlocks.saturating_mul(50));
    
    // Commitment factor: pledge USD value, tanh curve
    let commitment_factor = (pledge_status.pledge_usd / 100.0).tanh();
    
    // XP factor: saturates at 2000
    let xp_factor = ((xp as f64) / 2000.0).min(1.0);
    
    // Stats factor: p_complete * confidence
    let total = stats.successes + stats.deadlocks;
    let p_complete = if total == 0 { 0.5 } else { (1.0 + stats.successes as f64) / (2.0 + total as f64) };
    let confidence = ((total as f64) / 10.0).min(1.0);
    let stats_factor = p_complete * confidence;
    
    // Recency
    let recency_factor = if stats.agreements_last_7d_daa > 0 { 1.0 }
        else if stats.agreements_last_30d_daa > 0 { 0.6 }
        else { 0.2 };
    
    let ranking_score = (0.35 * commitment_factor)
                      + (0.25 * stats_factor)
                      + (0.20 * xp_factor)
                      + (0.20 * recency_factor);
    
    DAppVisibility {
        visible: true,
        pledge: pledge_status,
        ranking_score,
        commitment_factor,
        xp_factor,
        stats_factor,
        recency_factor,
    }
}

/// GET /api/dapp/{pubkey}/visibility
pub async fn api_check_dapp_visibility(path: web::Path<String>) -> HttpResponse {
    let pubkey = path.into_inner();
    let visibility = compute_full_dapp_visibility(&pubkey).await;
    HttpResponse::Ok().json(serde_json::json!({ "ok": true, "pubkey": pubkey, "visibility": visibility }))
}

`;
    vl.splice(i, 0, ...code.split('\n'));
    console.log('  Added pledge-gated visibility system');
    break;
  }
}

fs.writeFileSync(vf, vl.join('\r\n'));

// === 2. Add route to main.rs ===
const mf = 'src\\main.rs';
let ml = fs.readFileSync(mf, 'utf8').split(/\r?\n/);
for (let i = 0; i < ml.length; i++) {
  if (ml[i].includes('dapp/apt/{apt}')) {
    if (!ml.slice(i, i+3).some(l => l.includes('visibility'))) {
      ml.splice(i + 1, 0,
        '        .route("/api/dapp/{pubkey}/visibility", web::get().to(townhall_verification_complete::api_check_dapp_visibility))'
      );
      console.log('  Added visibility route');
    }
    break;
  }
}
fs.writeFileSync(mf, ml.join('\r\n'));

// === 3. PassportGate UI fix ===
console.log('=== PassportGate ===');
const wf = 'Workspace.tsx';
if (fs.existsSync(wf)) {
  let wl = fs.readFileSync(wf, 'utf8').split(/\r?\n/);
  let wf2 = 0;
  for (let i = 0; i < wl.length; i++) {
    if (wl[i].includes('Complete all 12 Lore traits')) { wl[i] = wl[i].replace('Complete all 12 Lore traits', 'Complete 6 identity traits'); wf2++; }
    if (wl[i].includes('{filledTraits}/12')) { wl[i] = wl[i].replace('{filledTraits}/12', '{filledTraits}/6'); wf2++; }
    if (wl[i].includes('Resident (8)')) { wl[i] = wl[i].replace('Resident (8)', 'Resident (5)'); wf2++; }
    if (wl[i].includes('Passport (12)')) { wl[i] = wl[i].replace('Passport (12)', 'Passport (6)'); wf2++; }
  }
  fs.writeFileSync(wf, wl.join('\r\n'));
  console.log('  Fixes: ' + wf2);
} else { console.log('  Workspace.tsx not found'); }

console.log('Done');
