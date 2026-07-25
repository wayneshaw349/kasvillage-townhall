// patch_refresh_addr.cjs — refresh must query the same address the loader used
// Run: node patch_refresh_addr.cjs
const fs = require('fs');
const P = 'AppNaviagator.tsx';

let src = fs.readFileSync(P, 'utf8');
const EOL = src.includes('\r\n') ? '\r\n' : '\n';
const before = src;

function rep(name, oldStr, newStr, expect = 1) {
  const n = src.split(oldStr).length - 1;
  if (n !== expect) throw new Error(`[${name}] expected ${expect}, found ${n}`);
  src = src.split(oldStr).join(newStr);
  console.log(`[ok] ${name}`);
}

// 1. state init: mode-aware, tutorial-first — mirrors loadUserStats exactly
rep('state-init',
  "SecureStore.getItemAsync('kaspa_address').then(addr => {" + EOL +
  "      if (addr) setKaspaAddress(addr);" + EOL +
  "    });",
  [
    "(async () => {",
    "      const mode = (await SecureStore.getItemAsync('kaspa_active_mode')) === 'real' ? 'real' : 'tutorial';",
    "      const addr = mode === 'real'",
    "        ? (await SecureStore.getItemAsync('kaspa_address_real')) || ''",
    "        : (await SecureStore.getItemAsync('kaspa_address_tutorial'))",
    "          || (await SecureStore.getItemAsync('kaspa_address')) || '';",
    "      console.log('[AppNav] kaspaAddress state init:', mode, addr.slice(0, 20) || 'none');",
    "      if (addr) setKaspaAddress(addr);",
    "    })();",
  ].join(EOL)
);

// 2. refresh: log the address + result so a silent zero can never hide again
rep('refresh-log',
  "if (resp.ok) {" + EOL +
  "        const data = await resp.json();" + EOL +
  "        setBalanceSompi(BigInt(data.balance || '0'));",
  "if (resp.ok) {" + EOL +
  "        const data = await resp.json();" + EOL +
  "        console.log('[Refresh]', kaspaAddress.slice(0, 20), '->', data.balance);" + EOL +
  "        setBalanceSompi(BigInt(data.balance || '0'));"
);

for (const m of ['kaspaAddress state init', "[Refresh]'"]) {
  if (!src.includes(m)) throw new Error('post-condition failed: ' + m);
}
if (src === before) throw new Error('no changes written');

fs.writeFileSync(P + '.bak-refresh', before, 'utf8');
fs.writeFileSync(P, src, 'utf8');
console.log('[done] backup at ' + P + '.bak-refresh');
