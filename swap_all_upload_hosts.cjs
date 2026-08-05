// swap_all_upload_hosts.cjs — repoint every stale Irys upload host to upload.ardrive.io.
// townhall_client.ts is the live agreement-inscription path (found via its own URL const or an import).
const fs = require('fs');
const targets = [
  'townhall_client.ts',
  'identity_inscription_v6.ts',
  'wallet_registration_v2.ts',
];
let total = 0;
for (const p of targets) {
  if (!fs.existsSync(p)) { console.log('SKIP ' + p + ' (not found)'); continue; }
  let s = fs.readFileSync(p, 'utf8');
  const before = s;
  s = s.split('https://node2.irys.xyz/tx').join('https://upload.ardrive.io/v1/tx');
  s = s.split('https://node2.irys.xyz').join('https://upload.ardrive.io');
  s = s.split('https://node1.irys.xyz/tx').join('https://upload.ardrive.io/v1/tx');
  s = s.split('https://node1.irys.xyz').join('https://upload.ardrive.io');
  s = s.split('https://turbo.ardrive.io/v1/tx').join('https://upload.ardrive.io/v1/tx');
  if (s !== before) {
    fs.copyFileSync(p, p + '.bak');
    fs.writeFileSync(p, s);
    const n = (before.match(/irys\.xyz|turbo\.ardrive/g) || []).length;
    console.log('OK   ' + p + ' — swapped ' + n + ' host reference(s)');
    total += n;
  } else {
    console.log('NOCHANGE ' + p + ' — no stale hosts (check its upload URL manually)');
  }
}
// Report where townhall_client actually posts, for verification
const tc = fs.readFileSync('townhall_client.ts', 'utf8').split(/\r?\n/);
console.log('--- townhall_client.ts upload URLs after patch: ---');
tc.forEach((l, i) => { if (/https:\/\/[^'"\s]*(irys|ardrive|ar\.io)[^'"\s]*/.test(l)) console.log((i + 1) + ': ' + l.trim().slice(0, 120)); });
console.log('TOTAL swapped: ' + total);
