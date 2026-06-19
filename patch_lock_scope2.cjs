const fs = require('fs');
let c = fs.readFileSync('src/main.rs', 'utf8');

const raw = c;
const startMarker = 'let mut queue = proof_queue().write().unwrap();\n        if let Some(job) = queue.get_mut(&proof_id_clone) {';
const start = c.indexOf(startMarker);
if (start === -1) { console.log('start not found'); process.exit(1); }

// Find the end: after the push block closes. Look for the closing of the push eprintln + braces
const pushEnd = c.indexOf('eprintln!("[Proof] Push sent to {}", &pubkey_clone[..10]);', start);
if (pushEnd === -1) { console.log('push end not found'); process.exit(1); }
// Find the next two closing braces after pushEnd (close if-let-Ok, close if-let-Some... actually push is inside Some)
let after = c.indexOf('}', pushEnd); // close push if-let-Ok
after = c.indexOf('}', after + 1);    // close if-let-Some(job)
const blockEnd = after + 1;

const newBlock = `// Store proof result, then push (lock must drop before await)
        {
            let mut queue = proof_queue().write().unwrap();
            if let Some(job) = queue.get_mut(&proof_id_clone) {
                job.status = "ready".into();
                job.proof = Some(proof);
                job.response = Some(response);
                eprintln!("[Proof] Job {} complete", proof_id_clone);
            }
        }
        // Lock dropped — now send push notification
        if let Ok(token_data) = state_clone.arweave_reader.get_push_token(&pubkey_clone).await {
            let _ = reqwest::Client::new()
                .post("https://exp.host/--/api/v2/push/send")
                .json(&serde_json::json!({
                    "to": token_data,
                    "title": "Proof Ready",
                    "body": "Your ZK verification proof is ready. Tap to inscribe to Arweave.",
                    "data": { "event": "proof_ready", "proof_id": proof_id_clone }
                }))
                .send().await;
            eprintln!("[Proof] Push sent to {}", &pubkey_clone[..10]);
        }`;

c = c.substring(0, start) + newBlock + c.substring(blockEnd);
fs.writeFileSync('src/main.rs', c);
console.log('Restructured: lock drops before push await');
