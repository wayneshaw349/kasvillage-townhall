const fs = require('fs');
let c = fs.readFileSync('src/main.rs', 'utf8');

// Find the proof completion block: queue update + push are tangled
// Need to scope the queue write so it drops before the push await
const oldBlock = `let mut queue = proof_queue().write().unwrap();
        if let Some(job) = queue.get_mut(&proof_id_clone) {
            job.status = "ready".into();
            job.proof = Some(proof);
            job.response = Some(response);
            eprintln!("[Proof] Job {} complete", proof_id_clone);`;

const newBlock = `{
            let mut queue = proof_queue().write().unwrap();
            if let Some(job) = queue.get_mut(&proof_id_clone) {
                job.status = "ready".into();
                job.proof = Some(proof);
                job.response = Some(response);
                eprintln!("[Proof] Job {} complete", proof_id_clone);
            }
        } // lock drops here before push`;

if (c.includes(oldBlock)) {
  c = c.replace(oldBlock, newBlock);
  console.log('Restructured queue scope');
} else {
  console.log('Block not found, checking structure...');
  const idx = c.indexOf('job.status = "ready"');
  console.log('Context:', c.substring(idx - 100, idx + 400));
}
fs.writeFileSync('src/main.rs', c);
