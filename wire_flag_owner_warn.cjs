// wire_flag_owner_warn.cjs — owners get an alert when THEIR listing is flagged
// (once per new flag count) or auto-delisted at 3. Run AFTER wire_flag_badge.cjs.
const fs = require('fs');
const jobs = [
  { f: 'kaspa_payload.ts', marker: 'KV_FLAG_HIDDEN_INFO', edits: [
    ["      if (_kvFl.size >= KV_FLAG_THRESHOLD) { console.warn('[Directory] hidden by'",
     "      // KV_FLAG_HIDDEN_INFO: remember auto-delisted heads so the owner can be told\n      if (_kvFl.size >= KV_FLAG_THRESHOLD) { try { const _g: any = globalThis as any; if (!_g.__kvFlagInfo) _g.__kvFlagInfo = new Map(); _g.__kvFlagInfo.set(String(record.d.storeAddress), { n: _kvFl.size, reasons: Array.from(new Set(Array.from(_kvFl.values()))), owner: String(owner), name: String(record.d.name || ''), hidden: true }); } catch {} }\n      if (_kvFl.size >= KV_FLAG_THRESHOLD) { console.warn('[Directory] hidden by'"],
  ] },
  { f: 'mailbox_kaspa_api.ts', marker: 'KV_FLAG_OWNER_WARN', edits: [
    ["    console.log('[Mailbox] store scan found', dir.length, 'entries:', dir.map((e: any) => e.name).join(', '));\n",
     `    console.log('[Mailbox] store scan found', dir.length, 'entries:', dir.map((e: any) => e.name).join(', '));
    // KV_FLAG_OWNER_WARN: tell the owner when their listing is flagged / auto-delisted (once per change)
    (async () => {
      try {
        const g: any = globalThis as any;
        if (!g.__kvMyPub) {
          const ps = require('./proposal_share');
          const priv = await ps._kvResolvePrivHex();
          if (!priv) return;
          const { bytesToHex, hexToBytes } = require('@noble/hashes/utils');
          const { secp256k1 } = require('@noble/curves/secp256k1');
          g.__kvMyPub = bytesToHex(secp256k1.getPublicKey(hexToBytes(priv), true));
        }
        const me = g.__kvMyPub;
        const AS = require('@react-native-async-storage/async-storage').default;
        const seen = JSON.parse((await AS.getItem('kv_flag_warned')) || '{}');
        const msgs: string[] = [];
        for (const [h, fi] of (g.__kvFlagInfo || new Map())) {
          if (!fi || fi.owner !== me) continue;
          const key = fi.n + (fi.hidden ? ':h' : '');
          if (seen[h] === key) continue;
          seen[h] = key;
          msgs.push(fi.hidden
            ? '"' + fi.name + '" was delisted by ' + fi.n + ' community flags (' + fi.reasons.join(', ') + '). Flags expire with chain pruning (~30-40h); fix the issue before re-announcing.'
            : '"' + fi.name + '" has ' + fi.n + '/3 flags (' + fi.reasons.join(', ') + '). At 3 it is delisted in every wallet.');
        }
        if (msgs.length) {
          await AS.setItem('kv_flag_warned', JSON.stringify(seen));
          require('react-native').Alert.alert('Your listing was flagged', msgs.join('\\n\\n'));
        }
      } catch (e) { console.warn('[FlagWarn]', e); }
    })();
`],
  ] },
];
let ok = true; const staged = [];
for (const j of jobs) {
  let s = fs.readFileSync(j.f, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes(j.marker)) { console.log(j.f + ': already patched - skipping'); continue; }
  for (const [a] of j.edits) { const c = s.split(a).length - 1; if (c !== 1) { console.error(j.f + ' ANCHOR count ' + c + ' expected 1 (run wire_flags.cjs + wire_flag_badge.cjs first)'); ok = false; } }
  staged.push({ ...j, s, CRLF });
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const j of staged) { let s = j.s; for (const [a, b] of j.edits) s = s.split(a).join(b); fs.writeFileSync(j.f, j.CRLF ? s.replace(/\n/g, '\r\n') : s); console.log(j.f + ': patched'); }
console.log('DONE - owners alerted when their listing is flagged or auto-delisted.');
