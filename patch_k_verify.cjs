const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');
const anchor = "Alert.alert('Funds Released!'";
const idx = s.indexOf(anchor);
if (idx < 0) { console.log('not found'); process.exit(1); }
if (s.includes('[K-DESTROY]')) { console.log('Already patched'); process.exit(0); }
const inject = `
        // VERIFY k destruction
        const _kCheck = await SecureStore.getItemAsync('kv_frost_nonce_' + contract.agreementId);
        const _tCheck = await SecureStore.getItemAsync('kv_frost_template_' + contract.agreementId);
        console.log('[K-DESTROY] nonce:', _kCheck ? 'STILL EXISTS' : 'DESTROYED');
        console.log('[K-DESTROY] template:', _tCheck ? 'STILL EXISTS' : 'DESTROYED');
`;
s = s.slice(0, idx) + inject + s.slice(idx);
fs.writeFileSync(f, s);
console.log('Added k-destruction logging');
