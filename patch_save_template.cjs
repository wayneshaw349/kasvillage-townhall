const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');

const anchor = "await SecureStore.setItemAsync('kv_frost_nonce_' + contract.agreementId, JSON.stringify({ k: result.nonce.k.toString(16), d_tweaked: result.nonce.d_tweaked.toString(16), R_hex: result.nonce.R_hex }));";

if (!s.includes(anchor)) { console.log('Anchor not found'); process.exit(1); }

const fix = anchor + "\n      await SecureStore.setItemAsync('kv_frost_template_' + contract.agreementId, JSON.stringify(result.template));";

s = s.replace(anchor, fix);
fs.writeFileSync(f, s);
console.log('Fixed: template now saved to SecureStore');
console.log('Verify:', s.includes('kv_frost_template_'));
