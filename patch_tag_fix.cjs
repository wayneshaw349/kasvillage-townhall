const fs = require('fs');
let c = fs.readFileSync('townhallscreen.tsx', 'utf8');

// 1. Hash the proof before using as tag (SHA256 of first 64 chars as fingerprint)
const oldTag = "{ name:'KV-ProofHash', value:data.proof_hash }";
const newTag = "{ name:'KV-ProofHash', value:(data.proof_hash||'').slice(0,64) }";
if (c.includes(oldTag)) {
  c = c.replace(oldTag, newTag);
  console.log('1. ProofHash tag truncated to 64 chars');
}

// 2. Fix SecureStore null — only save if arweaveTxId exists
const oldSave = "await SecureStore.setItemAsync('kv_verification_tx', arweaveTxId);";
const newSave = "if (arweaveTxId) await SecureStore.setItemAsync('kv_verification_tx', arweaveTxId);";
if (c.includes(oldSave)) {
  c = c.replace(oldSave, newSave);
  console.log('2. SecureStore null check added');
}

// 3. Only save verified flag if upload succeeded
const oldVerified = "await SecureStore.setItemAsync('kv_townhall_verified', 'true');";
const newVerified = "if (arweaveTxId) await SecureStore.setItemAsync('kv_townhall_verified', 'true');";
if (c.includes(oldVerified)) {
  c = c.replace(oldVerified, newVerified);
  console.log('3. Only save verified if upload succeeded');
}

fs.writeFileSync('townhallscreen.tsx', c);
