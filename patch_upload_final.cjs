const fs = require('fs');
let c = fs.readFileSync('townhallscreen.tsx', 'utf8');
c = c.replace(
  `const arweaveUpload = await import('./arweave_upload');
            const buildFn = arweaveUpload.buildAns104Item || arweaveUpload.default?.buildAns104Item;
            const uploadFn = arweaveUpload.uploadToIrys || arweaveUpload.default?.uploadToIrys;
            if (buildFn && uploadFn) {
              const dataBytes = new TextEncoder().encode(proofPayload);
              const result = await buildFn(dataBytes, tags, privKey).then(uploadFn);`,
  `const arweaveUpload = await import('./arweave_upload');
            console.log('[TownHall] Starting Arweave inscription, payload:', proofPayload.length, 'bytes');
            if (arweaveUpload.uploadToTurbo) {
              const result = await arweaveUpload.uploadToTurbo(proofPayload, tags);
              console.log('[TownHall] Upload result:', JSON.stringify(result));`
);
fs.writeFileSync('townhallscreen.tsx', c);
console.log('Has uploadToTurbo:', c.includes('uploadToTurbo'));
console.log('No buildAns104Item:', !c.includes('buildAns104Item'));
