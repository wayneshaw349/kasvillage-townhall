const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const norm = str => str.split('\n').join(EOL);

const marker = 'const _wallet = await loadMainWallet();';
if (s.includes(marker)) { console.log('SKIP — already applied'); process.exit(0); }

// 1) load wallet at the top of the generate onPress (right before buyerR_saved fetch)
const a1 = norm("                          // Generate KV proposal clipboard format\n                          const buyerR_saved = await");
const b1 = norm("                          // Generate KV proposal clipboard format\n                          const _wallet = await loadMainWallet();\n                          const buyerR_saved = await");

// 2) use _wallet.privKeyHex (guarded) in the generateProposal call
const a2 = "buyerPrivKeyHex: wallet.privKeyHex, frostCounter:";
const b2 = "buyerPrivKeyHex: _wallet?.privKeyHex || '', frostCounter:";

let ok = true, log = [];
for (const [tag, a, b] of [['load wallet', a1, b1], ['use _wallet', a2, b2]]) {
  const n = s.split(a).length - 1;
  if (n === 1) { s = s.split(a).join(b); log.push('OK   ' + tag); }
  else { ok = false; log.push('MISS(' + n + ') ' + tag); }
}

if (ok) { fs.writeFileSync(f, s); console.log('WROTE ' + f); }
else { console.log('NO WRITE:'); }
log.forEach(l => console.log('  ' + l));
