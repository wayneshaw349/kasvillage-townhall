// wire_mod_pubkey.cjs - rotate KV_MOD_PUBKEY (the cold moderation key) in the wallet.
//   node wire_mod_pubkey.cjs <66-hex compressed public key from gen_mod_key.cjs>
// Replaces the old mod pubkey wherever the wallet checks it. Old-key delists stop being honored,
// so re-issue any standing moderator delists with the new key afterwards.
const fs = require('fs');
const pub = String(process.argv[2] || '').trim().toLowerCase();
if (!/^0[23][0-9a-f]{64}$/.test(pub)) { console.log('  FAIL  need the 66-hex COMPRESSED public key (starts 02 or 03), not the secret'); process.exit(1); }
const FILES = ['kaspa_payload.ts', 'VillageMailbox.tsx', 'Workspace.tsx']; // Workspace: mod error-note flow hardcodes the key too
const cur = fs.readFileSync(FILES[0], 'utf8').match(/KV_MOD_PUBKEY = '([0-9a-f]{66})'/);
if (!cur) { console.log('  FAIL  current KV_MOD_PUBKEY not found in ' + FILES[0]); process.exit(1); }
const old = cur[1];
if (old === pub) { console.log('  done  already set to this key'); process.exit(0); }
let total = 0;
for (const f of FILES) {
  const raw = fs.readFileSync(f, 'utf8'); const crlf = /\r\n/.test(raw);
  let t = crlf ? raw.replace(/\r\n/g, '\n') : raw;
  const n = t.split(old).length - 1;
  if (!n) { console.log('  skip  ' + f + ' (old key not present)'); continue; }
  t = t.split(old).join(pub);
  fs.writeFileSync(f, crlf ? t.replace(/\n/g, '\r\n') : t);
  console.log('  ok    ' + f + ' (' + n + ' occurrence' + (n === 1 ? '' : 's') + ')'); total += n;
}
console.log(total ? '\nRotated ' + old.slice(0, 12) + '… -> ' + pub.slice(0, 12) + '…\nCommit + push, then re-issue any standing mod delists with the NEW cold key.' : '\nNothing changed.');
