// scope.cjs — extract restore-flow scope blocks. Run: node scope.cjs
const fs = require('fs');
const OUT = 'restore_scope.txt';
let out = [];

function read(f) {
  try { return fs.readFileSync(f, 'utf8').split(/\r?\n/); }
  catch (e) { out.push(`!! cannot read ${f}: ${e.code}`); return null; }
}

// print `count` lines starting at the line containing `anchor` (offset by `back`)
function block(title, file, anchor, count, back = 0) {
  out.push('', '='.repeat(70), `== ${title}  [${file}]`, '='.repeat(70));
  const L = read(file);
  if (!L) return;
  const i = L.findIndex(l => l.includes(anchor));
  if (i < 0) { out.push(`!! anchor not found: ${anchor}`); return; }
  const start = Math.max(0, i - back);
  for (let n = start; n < Math.min(L.length, start + count); n++) {
    out.push(String(n + 1).padStart(5) + ' | ' + L[n]);
  }
}

// grep across a single file
function grep(title, file, re) {
  out.push('', '='.repeat(70), `== ${title}  [${file}]`, '='.repeat(70));
  const L = read(file);
  if (!L) return;
  let hits = 0;
  L.forEach((l, n) => {
    if (re.test(l)) { out.push(String(n + 1).padStart(5) + ' | ' + l.trim()); hits++; }
  });
  if (!hits) out.push('!! no matches');
}

// A — what happens after cards are recovered
block('A: onRecovered handler', 'AppNaviagator.tsx', '<VaultRecoveryScreen', 40, 6);

// B — where pubHex comes from when cards are generated
block('B: card generation', 'AppNaviagator.tsx', 'createIdentityBoundBackup(mnemonic', 45, 20);

// C — DECISIVE: does the ritual inscription carry a pubkey tag?
block('C: ritual Arweave tags', 'expo_identity_ritual.tsx', 'KV-IdentityHash', 45, 25);

// D — screen routing: is recovery reachable pre-login?
grep('D: setScreen calls', 'AppNaviagator.tsx', /setScreen\('/);
grep('D2: screen cases', 'AppNaviagator.tsx', /case\s+'[a-z_]+'\s*:/i);

// E — the boot gate as it stands right now
block('E: boot gate', 'AppNaviagator.tsx', 'const isReturning', 22, 8);

fs.writeFileSync(OUT, out.join('\n'), 'utf8');
console.log(out.join('\n'));
console.log('\n[written] ' + OUT + '  (' + out.join('\n').length + ' bytes)');
