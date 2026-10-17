// wire_listing_clock.cjs — show the clock, spend nothing. A freshness line in
// the store/abstract modal: hours since the listing's newest announce (by
// anyone - owner or keeper), and an expiry estimate against the guaranteed
// ~30h window. Green <18h, orange 18-26h, red >26h. Reads createdAt only.
const fs = require('fs');
const F = 'VillageMailbox.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_LISTING_CLOCK')) { console.log('already patched'); process.exit(0); }

const CLOCK = (mt) => `{(() => { // KV_LISTING_CLOCK
                      const _ca = Number((storeView.entry as any).createdAt || 0);
                      if (!_ca) return null;
                      const _ah = Math.max(0, (Date.now() - _ca) / 3600000);
                      const _left = Math.max(0, 30 - _ah);
                      const _col = _ah < 18 ? '#16a34a' : _ah < 26 ? '#d97706' : '#b91c1c';
                      const _msg = _ah < 18 ? 'fresh - no repost needed' : _ah < 26 ? 'renew soon' : 'expiring - repost to keep it alive';
                      return <Text style={{ color: _col, fontSize: rs.font(10), fontWeight: 'bold', marginTop: rs.s(${mt}), textAlign: 'center' }}>Last announced {_ah < 1 ? '<1' : Math.floor(_ah)}h ago {'\\u00b7'} ~{Math.floor(_left)}h+ left {'\\u00b7'} {_msg}</Text>;
                    })()}`;

const edits = [
  // abstract branch: above the keepers block
  [
`                    {(((storeView.entry as any).keepers || []) as string[]).length > 0 ? (
                      <View style={{ marginTop: rs.s(12) }}>`,
`                    ` + CLOCK(12) + `
                    {(((storeView.entry as any).keepers || []) as string[]).length > 0 ? (
                      <View style={{ marginTop: rs.s(12) }}>`,
  ],
  // store branch: top of the keeper bar
  [
`                  {/* KV_REPOST_UI: keeper bar (stores) */}
                  <View style={{ paddingHorizontal: rs.s(14), paddingTop: rs.s(10) }}>`,
`                  {/* KV_REPOST_UI: keeper bar (stores) */}
                  <View style={{ paddingHorizontal: rs.s(14), paddingTop: rs.s(10) }}>
                    ` + CLOCK(0),
  ],
];

let ok = true;
for (let i = 0; i < edits.length; i++) {
  const c = s.split(edits[i][0]).length - 1;
  if (c !== 1) { console.error('ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1.'); ok = false; }
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const [a, b] of edits) s = s.split(a).join(b);
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: listing clock in the store/abstract modal');
