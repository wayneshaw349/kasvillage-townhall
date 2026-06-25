const fs = require('fs');
const f = 'src\\townhall_verification_complete.rs';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);

// 1. Add query_arweave_frost_events function before aggregate_and_prove_stats
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('pub async fn aggregate_and_prove_stats(')) {
    const fn = `/// Query Arweave for FROST events (the real stats source)
async fn query_arweave_frost_events(pubkey: &str) -> Result<Vec<FrostEvent>, String> {
    let pubkey_hash = compute_hash_index(&format!("PK:{}", pubkey));
    let query = format!(
        r#"query {{ transactions( tags: [ {{ name: "App-Name", values: ["KasVillage"] }}, {{ name: "Type", values: ["KV_FROST_V1"] }}, {{ name: "Participant-Hash", values: ["{}"] }} ], first: 100, sort: HEIGHT_DESC ) {{ edges {{ node {{ id tags {{ name value }} block {{ timestamp }} }} }} }} }}"#,
        pubkey_hash
    );
    let client = reqwest::Client::new();
    let response = match client.post("https://arweave.net/graphql")
        .json(&serde_json::json!({ "query": query }))
        .timeout(std::time::Duration::from_secs(15)).send().await {
        Ok(r) => r,
        Err(_) => client.post("https://arweave-search.goldsky.com/graphql")
            .json(&serde_json::json!({ "query": query }))
            .timeout(std::time::Duration::from_secs(15)).send().await
            .map_err(|e| format!("Arweave FROST query failed: {}", e))?,
    };
    let data: serde_json::Value = response.json().await.map_err(|e| format!("Parse: {}", e))?;
    let edges = data.pointer("/data/transactions/edges").and_then(|e| e.as_array());
    let mut events = Vec::new();
    if let Some(edges) = edges {
        for edge in edges {
            let tags = edge.pointer("/node/tags").and_then(|t| t.as_array());
            let get_tag = |name: &str| -> Option<String> {
                tags.and_then(|ts| ts.iter()
                    .find(|t| t.get("name").and_then(|n| n.as_str()) == Some(name))
                    .and_then(|t| t.get("value").and_then(|v| v.as_str()))
                    .map(|s| s.to_string()))
            };
            let event_type = match get_tag("Event-Type").as_deref() {
                Some("completed") => FrostEventType::AgreementCompleted,
                Some("deadlocked") => FrostEventType::AgreementDeadlocked,
                Some("refunded") => FrostEventType::AgreementRefunded,
                Some("expired") => FrostEventType::AgreementExpired,
                Some("created") => FrostEventType::AgreementCreated,
                _ => FrostEventType::AgreementCreated,
            };
            let timestamp = edge.pointer("/node/block/timestamp")
                .and_then(|v| v.as_u64()).unwrap_or(0);
            events.push(FrostEvent {
                tx_id: edge.pointer("/node/id").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
                event_type,
                agreement_id: get_tag("Agreement-ID").unwrap_or_default(),
                buyer_pubkey: get_tag("Buyer-Pubkey").unwrap_or_default(),
                seller_pubkey: get_tag("Seller-Pubkey").unwrap_or_default(),
                amount_sompi: get_tag("Amount-Sompi").and_then(|s| s.parse().ok()).unwrap_or(0),
                timestamp,
                daa_score: get_tag("DAA-Score").and_then(|s| s.parse().ok()).unwrap_or(timestamp),
                deadlock_reason: match get_tag("Deadlock-Reason").as_deref() {
                    Some("no_delivery") => Some(DeadlockReason::NoDelivery),
                    Some("quality") => Some(DeadlockReason::QualityDispute),
                    Some("timeout") => Some(DeadlockReason::Timeout),
                    Some(r) if !r.is_empty() => Some(DeadlockReason::Other),
                    _ => None,
                },
                completion_time_ms: None,
            });
        }
    }
    Ok(events)
}

`;
    lines.splice(i, 0, ...fn.split('\n'));
    console.log('Added query_arweave_frost_events');
    break;
  }
}

// 2. In aggregate_and_prove_stats, replace L1 query with Arweave + L1 fallback
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('let l1_query_id = address.unwrap_or(pubkey)')) {
    // Replace the L1 query lines with Arweave-first approach
    // Find the next line with l1_events
    for (let j = i; j < i + 5; j++) {
      if (lines[j].includes('query_l1_frost_events(l1_query_id)')) {
        lines[j] = lines[j].replace(
          /let l1_events = query_l1_frost_events\(l1_query_id\)\.await[^;]*/,
          'let l1_events = query_arweave_frost_events(pubkey).await.unwrap_or_default()'
        );
        // Remove the l1_query_id line since we query by pubkey now
        lines[i] = '    // Query Arweave for FROST events (primary stats source)';
        console.log('Switched to Arweave FROST events as primary source');
        break;
      }
    }
    break;
  }
}

fs.writeFileSync(f, lines.join('\r\n'));
console.log('Done');
