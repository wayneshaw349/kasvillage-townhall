// wire_no_store_page.cjs - Mailbox: stores are wallet-drawn only. Old listings that still carry a custom
//   HTML page (from before KV_NO_PAGE_TAB) no longer render it. Games are separate and unaffected.
//   node wire_no_store_page.cjs   (project folder; safe to run twice; backup VillageMailbox.tsx.bak_nostorepage)
const fs = require('fs');
const F = 'VillageMailbox.tsx';
const A = '                        {cfg.pageHash ? (\n                          <View style={{ height: rs.s(360)';
const B = '                        {false && cfg.pageHash ? ( /* KV_NO_STORE_PAGE: stores are wallet-drawn - legacy store pages are not rendered */\n                          <View style={{ height: rs.s(360)';
const raw = fs.readFileSync(F, 'utf8'); const crlf = /\r\n/.test(raw);
let t = crlf ? raw.replace(/\r\n/g, '\n') : raw;
if (t.includes('KV_NO_STORE_PAGE')) { console.log('  done  ' + F + ' (already changed)'); process.exit(0); }
if (t.split(A).length !== 2) { console.log('  FAIL  ' + F + ' - store page block not found, left untouched'); process.exit(1); }
t = t.replace(A, () => B);
fs.writeFileSync(F + '.bak_nostorepage', raw); fs.writeFileSync(F, crlf ? t.replace(/\n/g, '\r\n') : t);
console.log('  ok    ' + F + ' - reload the app');
