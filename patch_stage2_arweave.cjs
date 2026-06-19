const fs = require('fs');
let c = fs.readFileSync('townhallscreen.tsx', 'utf8');

// Find the exact boundaries
const start = c.indexOf("if (data.ok || data.success) {");
const alertEnd = c.indexOf("[{ text: 'OK' }]", start);
const blockEnd = c.indexOf(');', alertEnd) + 2;

if (start === -1 || alertEnd === -1) { console.log('FAIL: markers not found'); process.exit(1); }

const oldBlock = c.substring(start, blockEnd);
console.log('Found block length:', oldBlock.length);

const nl = oldBlock.includes('\r\n') ? '\r\n' : '\n';

const rep = [
  "if (data.ok || data.success) {",
  "        setIsVerified(true);",
  "        let arweaveTxId = null;",
  "        try {",
  "          const privKey = await SecureStore.getItemAsync('kv_l1_privkey') || await SecureStore.getItemAsync('kv_private_key') || '';",
  "          if (privKey && data.proof_hash) {",
  "            const proofPayload = JSON.stringify({ v:1, type:'identity-verification', pubkey:myPubkey, apt:myApt, tier:data.tier, traits:data.traits, proof_hash:data.proof_hash, public_inputs:data.proof_public_inputs||[], timestamp:Date.now() });",
  "            const tags = [{ name:'App-Name', value:'KasVillage' },{ name:'KV-Type', value:'verification-proof' },{ name:'KV-Pubkey', value:myPubkey||'' },{ name:'KV-ProofHash', value:data.proof_hash },{ name:'KV-Tier', value:data.tier||'Guest' },{ name:'Content-Type', value:'application/json' }];",
  "            const arweaveUpload = await import('./arweave_upload');",
  "            const buildFn = arweaveUpload.buildAns104Item || arweaveUpload.default?.buildAns104Item;",
  "            const uploadFn = arweaveUpload.uploadToIrys || arweaveUpload.default?.uploadToIrys;",
  "            if (buildFn && uploadFn) {",
  "              const dataBytes = new TextEncoder().encode(proofPayload);",
  "              const result = await buildFn(dataBytes, tags, privKey).then(uploadFn);",
  "              arweaveTxId = result?.txId || null;",
  "              console.log('[TownHall] Proof inscribed:', arweaveTxId);",
  "            }",
  "          }",
  "        } catch (e) { console.warn('[TownHall] Arweave inscription failed:', e); }",
  "        Alert.alert('? Verified!', arweaveTxId ? 'Proof on Arweave! TX: '+arweaveTxId.slice(0,24)+'...' : 'Verified! Proof: '+(data.proof_hash||'').slice(0,24)+'...', [{ text: 'OK' }]);",
].join(nl);

c = c.substring(0, start) + rep + c.substring(blockEnd);
fs.writeFileSync('townhallscreen.tsx', c);
console.log('Stage 2: OK');
