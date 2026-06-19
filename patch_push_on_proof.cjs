const fs = require('fs');
let c = fs.readFileSync('src/main.rs', 'utf8');

// Find the proof completion block in the tokio::spawn
const anchor = 'eprintln!("[Proof] Job {} complete", proof_id_clone);';
if (c.includes(anchor) && !c.includes('exp.host')) {
  const pushCode = `
            // Send push notification that proof is ready
            if let Ok(token_data) = state_clone.arweave_reader.get_push_token(&pubkey_clone).await {
                let _ = reqwest::Client::new()
                    .post("https://exp.host/--/api/v2/push/send")
                    .json(&serde_json::json!({
                        "to": token_data,
                        "title": "\\u2705 Proof Ready",
                        "body": "Your ZK verification proof is ready. Tap to inscribe to Arweave.",
                        "data": { "event": "proof_ready", "proof_id": proof_id_clone }
                    }))
                    .send().await;
                eprintln!("[Proof] Push sent to {}", &pubkey_clone[..10]);
            }`;
  c = c.replace(anchor, anchor + pushCode);
  fs.writeFileSync('src/main.rs', c);
  console.log('OK: push notification on proof completion');
} else {
  console.log(c.includes(anchor) ? 'SKIP: already has push' : 'FAIL: anchor not found');
}
