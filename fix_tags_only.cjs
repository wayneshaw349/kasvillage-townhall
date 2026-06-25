const fs = require('fs');
const f = 'src\\townhall_verification_complete.rs';
let content = fs.readFileSync(f, 'utf8');

// Only replace inside query_arweave_frost_events function
// 1. Fix tag names in the GraphQL query
content = content.replace(
  '{ name: "Type", values: ["KV_FROST_V1"] }}, {{ name: "Participant-Hash", values: ["{}"] }}',
  '{ name: "KV-Type", values: ["frost-agreement"] }}, {{ name: "KV-Pubkey", values: ["{}"] }}'
);
console.log('1. Fixed GraphQL query tags');

// 2. Use raw pubkey instead of hash (KV-Pubkey stores raw pubkey)
content = content.replace(
  'let pubkey_hash = compute_hash_index(&format!("PK:{}", pubkey));',
  'let pubkey_raw = pubkey.to_string(); // KV-Pubkey stores raw pubkey'
);
// Fix the format arg reference
content = content.replace(
  /pubkey_hash\n    \);/,
  'pubkey_raw\n    );'
);
// Handle Windows line endings too
content = content.replace(
  /pubkey_hash\r\n    \);/,
  'pubkey_raw\r\n    );'
);
console.log('2. Fixed pubkey (raw instead of hash)');

// 3. Fix event type mapping: Event-Type → KV-Status
content = content.replace('get_tag("Event-Type")', 'get_tag("KV-Status")');
content = content.replace('Some("completed")', 'Some("Released")');
content = content.replace('Some("deadlocked")', 'Some("Deadlocked")');
content = content.replace('Some("refunded")', 'Some("Refunded")');
content = content.replace('Some("expired")', 'Some("Expired")');
content = content.replace('Some("created")', 'Some("Agreed") | Some("Accepted") | Some("Signed")');
console.log('3. Fixed KV-Status mapping');

// 4. Fix tag name reads
content = content.replace('get_tag("Agreement-ID")', 'get_tag("KV-AgreementId")');
content = content.replace('get_tag("Buyer-Pubkey")', 'get_tag("KV-Pubkey")');
content = content.replace('get_tag("Seller-Pubkey")', 'get_tag("KV-Counterparty")');
content = content.replace('get_tag("Amount-Sompi")', 'get_tag("KV-Amount")');
content = content.replace('get_tag("DAA-Score")', 'get_tag("KV-DAAScore")');
content = content.replace('get_tag("Deadlock-Reason")', 'get_tag("KV-DeadlockReason")');
console.log('4. Fixed tag name reads');

// 5. Add counterparty query after Ok(events) inside the function
// Find the Ok(events) that's inside query_arweave_frost_events
const fnStart = content.indexOf('async fn query_arweave_frost_events');
const fnEnd = content.indexOf('\n}\n', fnStart + 100);
const fnBody = content.substring(fnStart, fnEnd);

if (fnBody.includes('Ok(events)')) {
  const counterpartyQuery = `// Also find agreements where user is counterparty
    let query2 = format!(
        r#"query {{ transactions( tags: [ {{ name: "App-Name", values: ["KasVillage"] }}, {{ name: "KV-Type", values: ["frost-agreement"] }}, {{ name: "KV-Counterparty", values: ["{}"] }} ], first: 100, sort: HEIGHT_DESC ) {{ edges {{ node {{ id tags {{ name value }} block {{ timestamp }} }} }} }} }}"#,
        pubkey_raw
    );
    if let Ok(r2) = client.post("https://arweave.net/graphql")
        .json(&serde_json::json!({ "query": query2 }))
        .timeout(std::time::Duration::from_secs(15)).send().await {
        if let Ok(d2) = r2.json::<serde_json::Value>().await {
            if let Some(e2) = d2.pointer("/data/transactions/edges").and_then(|e| e.as_array()) {
                for edge in e2 {
                    let tx_id = edge.pointer("/node/id").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                    if events.iter().any(|e| e.tx_id == tx_id) { continue; }
                    let tags = edge.pointer("/node/tags").and_then(|t| t.as_array());
                    let get_tag2 = |name: &str| -> Option<String> {
                        tags.and_then(|ts| ts.iter()
                            .find(|t| t.get("name").and_then(|n| n.as_str()) == Some(name))
                            .and_then(|t| t.get("value").and_then(|v| v.as_str()))
                            .map(|s| s.to_string()))
                    };
                    let event_type = match get_tag2("KV-Status").as_deref() {
                        Some("Released") => FrostEventType::AgreementCompleted,
                        Some("Deadlocked") => FrostEventType::AgreementDeadlocked,
                        Some("Refunded") => FrostEventType::AgreementRefunded,
                        _ => FrostEventType::AgreementCreated,
                    };
                    let ts = edge.pointer("/node/block/timestamp").and_then(|v| v.as_u64()).unwrap_or(0);
                    events.push(FrostEvent {
                        tx_id, event_type,
                        agreement_id: get_tag2("KV-AgreementId").unwrap_or_default(),
                        buyer_pubkey: get_tag2("KV-Counterparty").unwrap_or_default(),
                        seller_pubkey: get_tag2("KV-Pubkey").unwrap_or_default(),
                        amount_sompi: get_tag2("KV-Amount").and_then(|s| s.parse().ok()).unwrap_or(0),
                        timestamp: ts,
                        daa_score: get_tag2("KV-DAAScore").and_then(|s| s.parse().ok()).unwrap_or(ts),
                        deadlock_reason: None,
                        completion_time_ms: None,
                    });
                }
            }
        }
    }
    Ok(events)`;
  
  // Replace ONLY the Ok(events) inside this function
  const beforeFn = content.substring(0, fnStart);
  const afterFn = content.substring(fnEnd);
  const newFnBody = fnBody.replace('Ok(events)', counterpartyQuery);
  content = beforeFn + newFnBody + afterFn;
  console.log('5. Added counterparty query');
}

fs.writeFileSync(f, content);
console.log('Done');
