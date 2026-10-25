// wire_no_contact_leak.cjs - stop the wallet putting your developer email into games.
//
// Room kcbad1dffa: a trade offer (i29) carried wayneshaw349@hotmail.com to every
// player's game record. Source: the wallet injected the Workspace developer
// contact (meant for published game listings) into every game as KV_MY_CONTACT,
// and KasCity uses that as the default trade-offer contact. Now nothing is
// injected: a player who wants to make offers types a contact into the game's
// own 'my contact' box (opt-in, visible). Your dev contact stays on listings.
//
// Run from the repo root:   node wire_no_contact_leak.cjs
const fs = require('fs');
const PLAN = [{"file":"OnChainPageView.tsx","hunks":[["+ ';window.KV_MY_CONTACT=' + JSON.stringify(String((globalThis as any).__kvDevContact || '').slice(0, 80)) + ';}catch(e){};') : '') /* KV_GRANTS */","+ ';}catch(e){};') : '') /* KV_GRANTS */ /* KV_NO_CONTACT_LEAK: the developer listing contact (Workspace) is never injected into games; players opt in via the game's own contact box */"]]}];
let okF = 0, skipF = 0, badF = 0;
for (const p of PLAN) {
  if (!fs.existsSync(p.file)) { console.log('  MISSING ' + p.file); badF++; continue; }
  const raw = fs.readFileSync(p.file, 'utf8'); const CRLF = raw.includes('\r\n'); let s = raw.replace(/\r\n/g, '\n');
  if (s.includes('KV_NO_CONTACT_LEAK')) { console.log('  skip  ' + p.file + ' (already done)'); skipF++; continue; }
  let fail = '';
  for (const [o, n] of p.hunks) { const c = s.split(o).length - 1; if (c !== 1) { fail = 'change ' + (p.hunks.indexOf(p.hunks.find((h) => h[0] === o)) + 1) + ' matched ' + c + 'x'; break; } s = s.replace(o, () => n); }
  if (fail) { console.log('  FAIL  ' + p.file + ' - ' + fail + ' (file left unchanged)'); badF++; continue; }
  fs.copyFileSync(p.file, p.file + '.bak_nocontact'); fs.writeFileSync(p.file, CRLF ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  console.log('  ok    ' + p.file + ' (' + p.hunks.length + ' changes)'); okF++;
}
console.log('\n' + okF + ' files patched, ' + skipF + ' already done, ' + badF + ' failed' + (badF ? '  <- send me this output' : ''));
