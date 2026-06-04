// patch_appnav_pubkey.cjs — fixed filename (AppNaviagator.tsx)
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, 'AppNaviagator.tsx');

const src = fs.readFileSync(FILE, 'utf8');
if (src.includes(`STORE_KEYS.PUBLIC_KEY)) || (await SecureStore.getItemAsync('kaspa_pubkey')`)) {
  console.log('[patch] Already applied — skipping.');
  process.exit(0);
}

let p = src, c = 0;

const o1 = `const publicKey: string = (await SecureStore.getItemAsync(STORE_KEYS.PUBLIC_KEY)) || '';`;
const n1 = `const publicKey: string = (await SecureStore.getItemAsync(STORE_KEYS.PUBLIC_KEY)) || (await SecureStore.getItemAsync('kaspa_pubkey')) || '';`;
if (p.includes(o1)) { p = p.replace(o1, n1); c++; }

const o2 = `const publicKey = (await SecureStore.getItemAsync(STORE_KEYS.PUBLIC_KEY)) || '';`;
const n2 = `const publicKey = (await SecureStore.getItemAsync(STORE_KEYS.PUBLIC_KEY)) || (await SecureStore.getItemAsync('kaspa_pubkey')) || '';`;
if (p.includes(o2)) { p = p.replace(o2, n2); c++; }

if (c === 0) { console.log('[patch] No patterns matched.'); process.exit(1); }
fs.writeFileSync(FILE, p);
console.log(`[patch] Done — ${c} fix(es) applied.`);
