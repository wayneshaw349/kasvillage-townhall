const fs = require('fs');
let c = fs.readFileSync('townhallscreen.tsx', 'utf8');

const old = `const arweaveUpload = await import('./arweave_upload');
            const buildFn = arweaveUpload.buildAns104Item || arweaveUpload.default?.buildAns104Item;
            const uploadFn = arweaveUpload.uploadToIrys || arweaveUpload.default?.uploadToIrys;
            if (buildFn && uploadFn) {
              const dataBytes = new TextEncoder().encode(proofPayload);
              const result = await buildFn(dataBytes, tags, privKey).then(uploadFn);
              arweaveTxId = result?.txId || null;`;

const rep = `const arweaveUpload = await import('./arweave_upload');
            if (arweaveUpload.uploadToTurbo) {
              const result = await arweaveUpload.uploadToTurbo(proofPayload, tags);
              arweaveTxId = result?.txId || null;`;

if (c.includes('buildAns104Item')) {
  c = c.replace(old, rep);
  fs.writeFileSync('townhallscreen.tsx', c);
  console.log('OK');
} else { console.log('Not found'); }
