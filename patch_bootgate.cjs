// patch_bootgate.cjs — boot gate reads keys that are actually written
// Run from project root: node patch_bootgate.cjs
const fs = require('fs');
const P = 'AppNaviagator.tsx';

let src = fs.readFileSync(P, 'utf8');
const EOL = src.includes('\r\n') ? '\r\n' : '\n';
const before = src;

function rep(name, oldStr, newStr, expect = 1) {
  const n = src.split(oldStr).length - 1;
  if (n !== expect) throw new Error(`[${name}] expected ${expect}, found ${n}`);
  src = src.split(oldStr).join(newStr);
  console.log(`[ok] ${name} (${n})`);
}

// privateKey: fall back to keys registration actually writes
rep('privateKey',
  "const privateKey: string = (await SecureStore.getItemAsync(STORE_KEYS.PRIVATE_KEY)) || '';",
  "const privateKey: string = (await SecureStore.getItemAsync('kv_private_key'))" + EOL +
  "          || (await SecureStore.getItemAsync(STORE_KEYS.PRIVATE_KEY)) || '';" + EOL +
  "        const privKeyEnc: string = (await SecureStore.getItemAsync('kv_l1_privkey_enc')) || '';" + EOL +
  "        const kaspaAddrBoot: string = (await SecureStore.getItemAsync('kv_kaspa_address'))" + EOL +
  "          || (await SecureStore.getItemAsync('kaspa_address')) || '';"
);

// aptAlias: kv_apt_alias is the written variant
rep('aptAlias',
  "const aptAlias: string = (await SecureStore.getItemAsync(STORE_KEYS.APT_ALIAS)) || '';",
  "const aptAlias: string = (await SecureStore.getItemAsync('kv_apt_alias'))" + EOL +
  "          || (await SecureStore.getItemAsync(STORE_KEYS.APT_ALIAS)) || '';"
);

// gate: a wallet on device counts as returning, regardless of ritual completion
rep('isReturning',
  "const isReturning = !!(privateKey && aptAlias) || kvVerified === 'true';",
  "const hasWallet = !!((privateKey || privKeyEnc) && kaspaAddrBoot);" + EOL +
  "        console.log('[AppNav] boot keys — priv:', !!privateKey, 'privEnc:', !!privKeyEnc," + EOL +
  "          'addr:', !!kaspaAddrBoot, 'alias:', !!aptAlias, 'verified:', kvVerified || 'none');" + EOL +
  "        const isReturning = hasWallet || kvVerified === 'true';"
);

// pubkey: kv_public_key is what registration writes
rep('publicKey',
  "const publicKey: string = (await SecureStore.getItemAsync(STORE_KEYS.PUBLIC_KEY)) || (await SecureStore.getItemAsync('kaspa_pubkey')) || '';",
  "const publicKey: string = (await SecureStore.getItemAsync('kv_public_key'))" + EOL +
  "          || (await SecureStore.getItemAsync(STORE_KEYS.PUBLIC_KEY))" + EOL +
  "          || (await SecureStore.getItemAsync('kaspa_pubkey')) || '';"
);

for (const m of ["const hasWallet =", "'kv_l1_privkey_enc'", "[AppNav] boot keys"]) {
  if (!src.includes(m)) throw new Error(`post-condition failed: ${m}`);
}
if (src === before) throw new Error('no changes written');

fs.writeFileSync(P + '.bak', before, 'utf8');
fs.writeFileSync(P, src, 'utf8');
console.log('[done] backup at ' + P + '.bak');
