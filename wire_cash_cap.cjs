// wire_cash_cap.cjs — KV_CASH_CAP: one cash note may hold at most US$100 worth of KAS (mainnet).
// Enforced on the phone only (no server, no exceptions). Price: live feed, else last good price <= 7 days old, else refuse.
const fs = require('fs');
const rep = (F, a, b) => { let s = fs.readFileSync(F, 'utf8'); if (s.split(a).length !== 2) throw new Error(F + ' anchor: ' + a.slice(0, 60)); fs.writeFileSync(F, s.replace(a, () => b)); };
const C = 'kv_cash_note.ts', S = 'CashNoteScreen.tsx';
if (fs.readFileSync(C, 'utf8').includes('KV_CASH_CAP')) { console.log('already wired'); process.exit(0); }
rep(C, "/** Make a note: key saved first, then the hot wallet pays it (Face ID + preview). */",
`// KV_CASH_CAP: at most US$100 worth of KAS per note, checked on this phone only.
export const CN_CAP_USD = 100;
const PX_KEY = 'kv_cn_last_usd_px';
/** Largest note allowed right now, in sompi. null = no price available (then notes are refused on mainnet). */
export async function cnMaxSompi(): Promise<{ max: bigint | null; usdPerKas: number; stale?: boolean }> {
  if (sqActiveNet() !== 'mainnet') return { max: null, usdPerKas: 0 }; // test coins: no cap
  const AS = require('@react-native-async-storage/async-storage').default;
  let px = 0; try { px = Number(await require('./kv_fx').kasPriceIn('USD')) || 0; } catch {}
  let stale = false;
  if (px > 0) { try { await AS.setItem(PX_KEY, JSON.stringify({ v: px, at: Date.now() })); } catch {} }
  else { try { const o = JSON.parse((await AS.getItem(PX_KEY)) || 'null'); if (o && o.v > 0 && Date.now() - o.at < 7 * 86400000) { px = o.v; stale = true; } } catch {} }
  if (!(px > 0)) return { max: null, usdPerKas: 0 };
  return { max: BigInt(Math.floor((CN_CAP_USD / px) * 1e8)), usdPerKas: px, stale };
}

/** Make a note: key saved first, then the hot wallet pays it (Face ID + preview). */`);
rep(C, "  if (sompi < CN_MIN_SOMPI) return { error: 'A cash note must hold at least 0.1 KAS.' };",
`  if (sompi < CN_MIN_SOMPI) return { error: 'A cash note must hold at least 0.1 KAS.' };
  if (sqActiveNet() === 'mainnet') { // KV_CASH_CAP
    const cap = await cnMaxSompi();
    if (cap.max === null) return { error: 'Could not get the KAS price to check the $' + CN_CAP_USD + ' note limit. Connect to the internet and try again. Nothing was sent.' };
    if (sompi > cap.max) return { error: 'A cash note can hold at most $' + CN_CAP_USD + ' worth of KAS (about ' + (Number(cap.max) / 1e8).toFixed(2) + ' KAS right now). Nothing was sent.' };
  }`);
rep(S, "      <TextInput style={st.in} value={amount} onChangeText={setAmount} keyboardType=\"decimal-pad\" placeholder=\"e.g. 20\" placeholderTextColor=\"#78716C\" />\n      <TouchableOpacity style={[st.pri, busy && { opacity: 0.5 }]} disabled={busy} onPress={make}>",
`      <TextInput style={st.in} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="e.g. 20" placeholderTextColor="#78716C" />
      <KvCapLine />
      <TouchableOpacity style={[st.pri, busy && { opacity: 0.5 }]} disabled={busy} onPress={make}>`);
let s = fs.readFileSync(S, 'utf8');
s += `
// KV_CASH_CAP: shows the per-note limit under the amount box
function KvCapLine() {
  const [t, setT] = React.useState('');
  React.useEffect(() => { let live = true; require('./kv_cash_note').cnMaxSompi().then((c: any) => {
    if (!live) return;
    const cap = require('./kv_cash_note').CN_CAP_USD;
    if (c.max !== null) setT('Limit: $' + cap + ' per note (about ' + (Number(c.max) / 1e8).toFixed(2) + ' KAS' + (c.stale ? ', last known price' : '') + ')');
    else if (require('./kv_savings_qr').sqActiveNet() === 'mainnet') setT('Limit: $' + cap + ' per note (price unavailable - connect to the internet to make a note)');
  }).catch(() => {}); return () => { live = false; }; }, []);
  return t ? <Text style={{ color: '#a8a29e', fontSize: 12, marginTop: 4, marginBottom: 8 }}>{t}</Text> : null;
}
`;
fs.writeFileSync(S, s);
console.log('wired KV_CASH_CAP');
