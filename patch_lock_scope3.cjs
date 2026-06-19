const fs = require('fs');
let c = fs.readFileSync('src/main.rs', 'utf8');

// Use indexOf on a unique single-line anchor, then brace-count
const anchor = 'let mut queue = proof_queue().write().unwrap();';
// Find the LAST occurrence (the one in tokio::spawn with the push)
const pushMarker = 'eprintln!("[Proof] Push sent to {}", &pubkey_clone[..10]);';
const pushPos = c.indexOf(pushMarker);
if (pushPos === -1) { console.log('push marker not found'); process.exit(1); }

// Find the queue write that precedes this push
const start = c.lastIndexOf(anchor, pushPos);
if (start === -1) { console.log('queue anchor not found'); process.exit(1); }

// Find end: 2 closing braces after the push eprintln
let after = c.indexOf('}', pushPos);  // close if-let-Ok push
after = c.indexOf('}', after + 1);     // close if-let-Some(job)
const blockEnd = after + 1;

console.log('Replacing from', start, 'to', blockEnd);
console.log('OLD:', JSON.stringify(c.substring(start, start+60)));

const nl = c.includes('\r\n') ? '\r\n' : '\n';
const lines = [
  '{',
  '            let mut queue = proof_queue().write().unwrap();',
  '            if let Some(job) = queue.get_mut(&proof_id_clone) {',
  '                job.status = "ready".into();',
  '                job.proof = Some(proof);',
  '                job.response = Some(response);',
  '                eprintln!("[Proof] Job {} complete", proof_id_clone);',
  '            }',
  '        }',
  '        if let Ok(token_data) = state_clone.arweave_reader.get_push_token(&pubkey_clone).await {',
  '            let _ = reqwest::Client::new()',
  '                .post("https://exp.host/--/api/v2/push/send")',
  '                .json(&serde_json::json!({',
  '                    "to": token_data,',
  '                    "title": "Proof Ready",',
  '                    "body": "Your ZK proof is ready. Tap to inscribe to Arweave.",',
  '                    "data": { "event": "proof_ready", "proof_id": proof_id_clone }',
  '                }))',
  '                .send().await;',
  '            eprintln!("[Proof] Push sent to {}", &pubkey_clone[..10]);',
  '        }'
];
const newBlock = lines.join(nl);

c = c.substring(0, start) + newBlock + c.substring(blockEnd);
fs.writeFileSync('src/main.rs', c);
console.log('Done');
