// fix_qa_always.cjs — show "Ask the researcher" on every abstract, not only
// ones that list a DM channel. No channel set -> the message is still composed
// and copied, and the repository link opens instead (issues/contact page).
const fs = require('fs');
const F = 'VillageMailbox.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');
if (s.includes('KV_QA_ALWAYS')) { console.log('already patched'); process.exit(0); }

const edits = [
  ['                    {_qa ? ( /* KV_QA_DM */', '                    {true ? ( /* KV_QA_DM KV_QA_ALWAYS */'],
  ['      try { Clipboard.setString(msg); } catch {}',
   "      if (!url && !rawHandle && cfg && cfg.repositoryUrl) url = String(cfg.repositoryUrl); // KV_QA_ALWAYS: no DM listed -> repo page\n      try { Clipboard.setString(msg); } catch {}"],
  ["'Paste it into ' + (cfg.qaChannel || 'their channel') + ': ' + rawHandle",
   "(rawHandle ? 'Paste it into ' + (cfg.qaChannel || 'their channel') + ': ' + rawHandle : 'This researcher has not listed a DM channel yet - keep the copied message for when they do.')"],
];
let ok = true;
for (let i = 0; i < edits.length; i++) {
  const c = s.split(edits[i][0]).length - 1;
  if (c !== 1) { console.error('ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1.'); ok = false; }
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const [a, b] of edits) s = s.split(a).join(b);
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: Ask box on every abstract (repo link fallback when no DM listed)');
