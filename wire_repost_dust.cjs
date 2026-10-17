// wire_repost_dust.cjs — reposts cost 0.1 KAS per record instead of 1.
// Probe (Oct 16, TN10): self-sends with an announce-sized payload accepted at
// 0.5/0.3/0.2/0.1/0.05 KAS, same 0.0026 fee - storage mass not binding.
// 0.1 = 2x margin over the smallest proven. Publishing/announces stay 1 KAS.
const fs = require('fs');

const jobs = [
  {
    f: 'payload_publish.ts',
    marker: 'REPOST_SOMPI',
    edits: [
      ['export const ANNOUNCE_SOMPI = 100_000_000n;',
       'export const ANNOUNCE_SOMPI = 100_000_000n;\n// Keeper replays: probed on TN10 (accepted down to 0.05 KAS); 0.1 = 2x margin.\nexport const REPOST_SOMPI = 10_000_000n;'],
      ['    amountSompi: ANNOUNCE_SOMPI,\n    privateKeyHex: keeper.privateKeyHex,',
       '    amountSompi: REPOST_SOMPI,\n    privateKeyHex: keeper.privateKeyHex,'],
      ['        amountSompi: ANNOUNCE_SOMPI,\n        privateKeyHex: keeper.privateKeyHex,',
       '        amountSompi: REPOST_SOMPI,\n        privateKeyHex: keeper.privateKeyHex,'],
    ],
  },
  {
    f: 'VillageMailbox.tsx',
    marker: 'keep this listing alive (0.1 KAS)',
    all: [["'Repost \\u2014 keep this listing alive (1 KAS)'", "'Repost \\u2014 keep this listing alive (0.1 KAS)'", 2]],
    edits: [
      ["' (' + (1 + _stripN) + ' KAS total).", "' (' + ((1 + _stripN) * 0.1).toFixed(1) + ' KAS total)."],
    ],
  },
];

let ok = true;
const staged = [];
for (const j of jobs) {
  let s = fs.readFileSync(j.f, 'utf8');
  const CRLF = s.includes('\r\n');
  if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes(j.marker)) { console.log(j.f + ': already patched - skipping'); continue; }
  for (const [a, , want] of (j.all || [])) { const c = s.split(a).length - 1; if (c !== want) { console.error(j.f + ' ALL-ANCHOR count = ' + c + ' - expected ' + want); ok = false; } }
  for (let i = 0; i < j.edits.length; i++) { const c = s.split(j.edits[i][0]).length - 1; if (c !== 1) { console.error(j.f + ' ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1.'); ok = false; } }
  staged.push({ ...j, s, CRLF });
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const j of staged) {
  let s = j.s;
  for (const [a, b] of (j.all || [])) s = s.split(a).join(b);
  for (const [a, b] of j.edits) s = s.split(a).join(b);
  fs.writeFileSync(j.f, j.CRLF ? s.replace(/\n/g, '\r\n') : s);
  console.log(j.f + ': patched');
}
console.log('DONE - reposts now 0.1 KAS per record.');
