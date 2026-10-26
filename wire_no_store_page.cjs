// wire_no_store_page.cjs - Village Mailbox: stores are wallet-drawn only. Old listings published before
//   KV_NO_PAGE_TAB no longer render their custom HTML page. Games and DApps are untouched (they play in the
//   Entertainment Center, not in this store view).
//   node wire_no_store_page.cjs   (project folder; safe to run twice; backup VillageMailbox.tsx.bak_no_store_page)
const fs = require('fs');
const F = 'VillageMailbox.tsx';
const A = '                        {cfg.pageHash ? (\n';
const B = '                        {(globalThis as any).__kvStorePages === true && cfg.pageHash ? ( /* KV_NO_STORE_PAGE: stores are wallet-drawn - legacy store pages no longer render */\n';
const raw = fs.readFileSync(F, 'utf8'); const crlf = /\r\n/.test(raw);
let t = crlf ? raw.replace(/\r\n/g, '\n') : raw;
if (t.includes('KV_NO_STORE_PAGE')) { console.log('  done  ' + F + ' (already changed)'); process.exit(0); }
if (t.split(A).length !== 2) { console.log('  FAIL  ' + F + ' - store page block not found, left untouched'); process.exit(1); }
t = t.replace(A, () => B);
fs.writeFileSync(F + '.bak_no_store_page', raw); fs.writeFileSync(F, crlf ? t.replace(/\n/g, '\r\n') : t);
console.log('  ok    ' + F + ' - reload the app');
