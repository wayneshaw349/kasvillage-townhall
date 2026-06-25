const fs = require('fs');
const f = 'src\\townhall_verification_complete.rs';
let content = fs.readFileSync(f, 'utf8');

// Replace the Arweave query to use correct tags
const oldQuery = '{ name: "Type", values: ["KV_FROST_V1"] }}, {{ name: "Participant-Hash", values: ["{}"] }}';
const newQuery = '{ name: "KV-Type", values: ["frost-agreement"] }}, {{ name: "KV-Pubkey", values: ["{}"] }}';

if (content.includes(oldQuery)) {
  content = content.replace(oldQuery, newQuery);
  console.log('Fixed query: KV-Type frost-agreement + KV-Pubkey');
} else {
  // Try the raw format string version
  const old2 = 'name: \\"Type\\", values: [\\"KV_FROST_V1\\"]';
  const new2 = 'name: \\"KV-Type\\", values: [\\"frost-agreement\\"]';
  if (content.includes(old2)) {
    content = content.replace(old2, new2);
    console.log('Fixed query (escaped): KV-Type frost-agreement');
  }
  const old3 = 'name: \\"Participant-Hash\\"';
  const new3 = 'name: \\"KV-Pubkey\\"';
  if (content.includes(old3)) {
    content = content.replace(old3, new3);
    console.log('Fixed query (escaped): KV-Pubkey');
  }
}

// Also fix: pass raw pubkey (no hash) since KV-Pubkey stores raw pubkey
const oldHash = 'let pubkey_hash = compute_hash_index(&format!("PK:{}", pubkey));';
if (content.includes(oldHash)) {
  content = content.replace(oldHash, 'let pubkey_hash = pubkey.to_string(); // KV-Pubkey stores raw pubkey, not hash');
  console.log('Fixed: use raw pubkey instead of hash');
}

// Fix event type mapping: KV-Status → FrostEventType
// Replace Event-Type tag reads with KV-Status
content = content.replace(/get_tag\("Event-Type"\)/g, 'get_tag("KV-Status")');
content = content.replace(/Some\("completed"\)/g, 'Some("Released")');
content = content.replace(/Some\("deadlocked"\)/g, 'Some("Deadlocked")');
content = content.replace(/Some\("refunded"\)/g, 'Some("Refunded")');
content = content.replace(/Some\("expired"\)/g, 'Some("Expired")');
content = content.replace(/Some\("created"\)/g, 'Some("Agreed")');
console.log('Fixed: KV-Status mapping (Released/Deadlocked/Agreed)');

// Fix tag reads for agreement fields
content = content.replace(/get_tag\("Agreement-ID"\)/g, 'get_tag("KV-AgreementId")');
content = content.replace(/get_tag\("Buyer-Pubkey"\)/g, 'get_tag("KV-Pubkey")');
content = content.replace(/get_tag\("Seller-Pubkey"\)/g, 'get_tag("KV-Counterparty")');
content = content.replace(/get_tag\("Amount-Sompi"\)/g, 'get_tag("KV-Amount")');
content = content.replace(/get_tag\("DAA-Score"\)/g, 'get_tag("KV-DAAScore")');
content = content.replace(/get_tag\("Deadlock-Reason"\)/g, 'get_tag("KV-DeadlockReason")');
console.log('Fixed: tag name mappings');

// Also need to query by KV-Counterparty too (user could be buyer OR seller)
// Add a second query for counterparty matches
const singleQuery = content.match(/let query = format!\(\s*r#"query \{\{ transactions/);
if (singleQuery) {
  // After the first query results, add second query for counterparty
  const afterParse = 'Ok(events)';
  if (content.includes(afterParse)) {
    content = content.replace(
      'Ok(events)',
      `// Also query where user is counterparty
    let query2 = format!(
        r#"query {{ transactions( tags: [ {{ name: "App-Name", values: ["KasVillage"] }}, {{ name: "KV-Type", values: ["frost-agreement"] }}, {{ name: "KV-Counterparty", values: ["{}"] }} ], first: 100, sort: HEIGHT_DESC ) {{ edges {{ node {{ id tags {{ name value }} block {{ timestamp }} }} }} }} }}"#,
        pubkey_hash
    );
    if let Ok(response2) = client.post("https://arweave.net/graphql")
        .json(&serde_json::json!({ "query": query2 }))
        .timeout(std::time::Duration::from_secs(15)).send().await {
        if let Ok(data2) = response2.json::<serde_json::Value>().await {
            if let Some(edges2) = data2.pointer("/data/transactions/edges").and_then(|e| e.as_array()) {
                for edge in edges2 {
                    let tags = edge.pointer("/node/tags").and_then(|t| t.as_array());
                    let get_tag = |name: &str| -> Option<String> {
                        tags.and_then(|ts| ts.iter()
                            .find(|t| t.get("name").and_then(|n| n.as_str()) == Some(name))
                            .and_then(|t| t.get("value").and_then(|v| v.as_str()))
                            .map(|s| s.to_string()))
                    };
                    let tx_id = edge.pointer("/node/id").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                    if !events.iter().any(|e| e.tx_id == tx_id) {
                        let event_type = match get_tag("KV-Status").as_deref() {
                            Some("Released") => FrostEventType::AgreementCompleted,
                            Some("Deadlocked") => FrostEventType::AgreementDeadlocked,
                            Some("Refunded") => FrostEventType::AgreementRefunded,
                            Some("Expired") => FrostEventType::AgreementExpired,
                            _ => FrostEventType::AgreementCreated,
                        };
                        let timestamp = edge.pointer("/node/block/timestamp").and_then(|v| v.as_u64()).unwrap_or(0);
                        events.push(FrostEvent {
                            tx_id,
                            event_type,
                            agreement_id: get_tag("KV-AgreementId").unwrap_or_default(),
                            buyer_pubkey: get_tag("KV-Counterparty").unwrap_or_default(),
                            seller_pubkey: get_tag("KV-Pubkey").unwrap_or_default(),
                            amount_sompi: get_tag("KV-Amount").and_then(|s| s.parse().ok()).unwrap_or(0),
                            timestamp,
                            daa_score: get_tag("KV-DAAScore").and_then(|s| s.parse().ok()).unwrap_or(timestamp),
                            deadlock_reason: None,
                            completion_time_ms: None,
                        });
                    }
                }
            }
        }
    }
    Ok(events)`
    );
    console.log('Added second query for KV-Counterparty');
  }
}

fs.writeFileSync(f, content);
console.log('Done');
