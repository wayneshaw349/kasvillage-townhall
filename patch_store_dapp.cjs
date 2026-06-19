const fs = require('fs');
let c = fs.readFileSync('src/main.rs', 'utf8');

// Find ALL remaining arweave_tx: None in verify functions
let count = 0;
// Store - find by store_id context
const storeIdx = c.indexOf('arweave_tx: None', c.indexOf('store_id: body.store_id'));
if (storeIdx > -1) {
  c = c.substring(0, storeIdx) +
    'arweave_tx: { let p = generate_entity_proof("store", &body.store_id, body.code.as_bytes()); Some(p.proof_bytes) }' +
    c.substring(storeIdx + 'arweave_tx: None'.length);
  count++;
  console.log('Store wired');
}

// DApp - find by dapp_id context  
const dappIdx = c.indexOf('arweave_tx: None', c.indexOf('dapp_id: body.dapp_id'));
if (dappIdx > -1) {
  c = c.substring(0, dappIdx) +
    'arweave_tx: { let p = generate_entity_proof("dapp", &body.dapp_id, body.code.as_bytes()); Some(p.proof_bytes) }' +
    c.substring(dappIdx + 'arweave_tx: None'.length);
  count++;
  console.log('DApp wired');
}

fs.writeFileSync('src/main.rs', c);
console.log('Fixed', count, 'remaining');
