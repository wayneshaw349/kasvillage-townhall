// scope2.cjs — does restore repopulate SecureStore? can we query Arweave by address?
// Run: node scope2.cjs
const fs = require('fs');
const OUT = 'restore_scope2.txt';
let out = [];

function read(f) {
  try { return fs.readFileSync(f, 'utf8').split(/\r?\n/); }
  catch (e) { out.push(`!! cannot read ${f}: ${e.code}`); return null; }
}

function block(title, file, anchor, count, back = 0) {
  out.push('', '='.repeat(70), `== ${title}  [${file}]`, '='.repeat(70));
  const L = read(file);
  if (!L) return;
  const i = L.findIndex(l => l.includes(anchor));
  if (i < 0) { out.push(`!! anchor not found: ${anchor}`); return; }
  const s = Math.max(0, i - back);
  for (let n = s; n < Math.min(L.length, s + count); n++) {
    out.push(String(n + 1).padStart(5) + ' | ' + L[n]);
  }
}

function grepAll(title, re, exts = ['.ts', '.tsx']) {
  out.push('', '='.repeat(70), `== ${title}`, '='.repeat(70));
  let hits = 0;
  (function walk(dir) {
    let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const p = dir + '/' + e.name;
      if (e.isDirectory()) { walk(p); continue; }
      if (!exts.some(x => e.name.endsWith(x))) continue;
      const L = read(p); if (!L) continue;
      L.forEach((l, n) => {
        if (re.test(l)) { out.push(`${e.name}:${n + 1}: ${l.trim()}`); hits++; }
      });
    }
  })('.');
  if (!hits) out.push('!! no matches');
}

// THE question: does restore write the identity keys back?
block('A: restoreWalletFromMnemonic', 'wallet_registration_v2.ts',
      'export async function restoreWalletFromMnemonic', 75);

// can anything query Arweave by KV-Address / kaspa address?
grepAll('B: KV-Address usage', /KV-Address/);

// what does the identity fetch-by-tag surface look like
grepAll('C: identity fetch fns', /getIdentityBy|fetchIdentity|queryIdentity|getAvatarBy/);

// onboarding entry — where restore button would go
block('D: onboarding case', 'AppNaviagator.tsx', "case 'onboarding':", 25);

fs.writeFileSync(OUT, out.join('\n'), 'utf8');
console.log(out.join('\n'));
console.log('\n[written] ' + OUT);
