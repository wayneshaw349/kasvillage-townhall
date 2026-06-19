const fs = require('fs');
let c = fs.readFileSync('townhallscreen.tsx', 'utf8');

// Add logging around the upload
const old = `if (arweaveUpload.uploadToTurbo) {
              const result = await arweaveUpload.uploadToTurbo(proofPayload, tags);
              arweaveTxId = result?.txId || null;`;

const rep = `console.log('[TownHall] Starting Arweave inscription...');
            console.log('[TownHall] Payload size:', proofPayload.length, 'tags:', tags.length);
            if (arweaveUpload.uploadToTurbo) {
              console.log('[TownHall] uploadToTurbo found, calling...');
              const result = await arweaveUpload.uploadToTurbo(proofPayload, tags);
              console.log('[TownHall] Upload result:', JSON.stringify(result));
              arweaveTxId = result?.txId || null;`;

if (c.includes('arweaveUpload.uploadToTurbo(proofPayload')) {
  c = c.replace(old, rep);
  fs.writeFileSync('townhallscreen.tsx', c);
  console.log('OK: added logging');
} else {
  console.log('Not found');
}
