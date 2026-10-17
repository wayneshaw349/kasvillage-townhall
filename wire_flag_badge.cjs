// wire_flag_badge.cjs — flag transparency: the listing modal shows
// "Flagged 1/3 - spam" so the owner and buyers see it BEFORE auto-delist at 3.
// kaspa_payload tally publishes counts to globalThis.__kvFlagInfo (head -> {n, reasons, owner, name}).
// Run AFTER wire_flags.cjs.
const fs = require('fs');
const BADGE = (mt) => `{(() => { // KV_FLAG_BADGE
                      const _fi = ((globalThis as any).__kvFlagInfo || new Map()).get(String((storeView.entry as any).arweaveTx || (storeView.entry as any).id));
                      if (!_fi || !_fi.n) return null;
                      return (
                        <View style={{ marginTop: rs.s(${mt}), backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#d97706', borderRadius: rs.s(10), padding: rs.s(8) }}>
                          <Text style={{ color: '#92400e', fontSize: rs.font(11), fontWeight: 'bold' }}>{'\\u2691 Flagged ' + _fi.n + '/3 \\u2014 ' + _fi.reasons.join(', ')}</Text>
                          <Text style={{ color: '#92400e', fontSize: rs.font(10), marginTop: rs.s(2) }}>At 3 flags from different publishers this listing is delisted in every wallet. Flags are public on the Kaspa chain.</Text>
                        </View>
                      );
                    })()}
`;
const jobs = [
  { f: 'kaspa_payload.ts', marker: 'KV_FLAG_INFO', edits: [
    ["      if (_kvFl.size) console.log('[Directory] flags', _kvFl.size + '/' + KV_FLAG_THRESHOLD, String(record.d.name || '').slice(0, 24));\n    }",
     `      if (_kvFl.size) console.log('[Directory] flags', _kvFl.size + '/' + KV_FLAG_THRESHOLD, String(record.d.name || '').slice(0, 24));
    }
    // KV_FLAG_INFO: expose counts to the UI (badge + owner warning)
    try {
      const _g: any = globalThis as any; if (!_g.__kvFlagInfo) _g.__kvFlagInfo = new Map();
      const _hk = String(record.d.storeAddress);
      if (_kvFl && _kvFl.size) _g.__kvFlagInfo.set(_hk, { n: _kvFl.size, reasons: Array.from(new Set(Array.from(_kvFl.values()))), owner: String(owner), name: String(record.d.name || '') });
      else _g.__kvFlagInfo.delete(_hk);
    } catch {}`],
  ] },
  { f: 'VillageMailbox.tsx', marker: 'KV_FLAG_BADGE', edits: [
    ["                    {/* KV_FLAG_BTN */}\n", BADGE(8) + "                    {/* KV_FLAG_BTN */}\n"],
    ["                    {/* KV_FLAG_BTN store */}\n", BADGE(6) + "                    {/* KV_FLAG_BTN store */}\n"],
  ] },
];
let ok = true; const staged = [];
for (const j of jobs) {
  let s = fs.readFileSync(j.f, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes(j.marker)) { console.log(j.f + ': already patched - skipping'); continue; }
  for (const [a] of j.edits) { const c = s.split(a).length - 1; if (c !== 1) { console.error(j.f + ' ANCHOR count ' + c + ' expected 1 (run wire_flags.cjs first)'); ok = false; } }
  staged.push({ ...j, s, CRLF });
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const j of staged) { let s = j.s; for (const [a, b] of j.edits) s = s.split(a).join(b); fs.writeFileSync(j.f, j.CRLF ? s.replace(/\n/g, '\r\n') : s); console.log(j.f + ': patched'); }
console.log('DONE - flag badge in the listing modal.');
