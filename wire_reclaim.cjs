// wire_reclaim.cjs - "My Pledges" card in Profile: reclaim KAS staked by your own store/service, DApp,
//   academic and game posts. Owner-only by construction (addresses come from your key). Safe to run twice.
const fs = require('fs');
const F = 'ProfileScreen.tsx', MARK = 'KV_RECLAIM';
const CARD = `
// KV_RECLAIM: your publishing pledges, with a reclaim button each
const MyPledgesCard: React.FC<{ hidden: boolean }> = ({ hidden }) => {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<any[] | null>(null);
  const [busy, setBusy] = useState('');
  const load = async () => { setRows(null); try { setRows(await require('./kv_reclaim').listMyPledges()); } catch (e: any) { setRows([]); Alert.alert('Pledges', String(e?.message || e)); } };
  useEffect(() => { if (open && rows === null) load(); }, [open]);
  const go = (p: any) => {
    const amt = (Number(p.sompi) / 1e8).toFixed(2);
    Alert.alert('Reclaim ' + (hidden ? '' : amt + ' KAS'), p.label + '\\n\\n' + p.note + '\\n\\nThe coins go back to your wallet (minus a small network fee).', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reclaim', style: 'destructive', onPress: async () => {
        try {
          const ok = await LocalAuthentication.authenticateAsync({ promptMessage: 'Reclaim pledge' });
          if (!ok.success) return;
          setBusy(p.key);
          const kas = await require('./kv_reclaim').reclaimPledge(p);
          Alert.alert('Reclaimed', (hidden ? '' : kas.toFixed(2) + ' KAS ') + 'sent back to your wallet.');
          await load();
        } catch (e: any) { Alert.alert('Reclaim failed', String(e?.message || e) + '\\n\\nWait a minute and try again.'); }
        setBusy('');
      } },
    ]);
  };
  return (
    <View style={{ backgroundColor: '#1A1A1A', borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#333' }}>
      <TouchableOpacity onPress={() => setOpen(!open)} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: '#D4AF37', fontSize: 14 }}>⛓ My Pledges</Text>
        <Text style={{ color: '#888', fontSize: 12 }}>{open ? 'Hide' : 'Show'}</Text>
      </TouchableOpacity>
      {open && (rows === null ? <Text style={{ color: '#888', fontSize: 12, marginTop: 8 }}>Checking your pledge addresses…</Text>
        : rows.length === 0 ? <Text style={{ color: '#888', fontSize: 12, marginTop: 8 }}>No pledges in place.</Text>
        : rows.map((p: any) => (
          <View key={p.key} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#2a2a2a', marginTop: 6 }}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ color: '#fff', fontSize: 13 }} numberOfLines={1}>{p.label}</Text>
              <Text style={{ color: '#10B981', fontSize: 12 }}>{hidden ? '••• KAS' : (Number(p.sompi) / 1e8).toFixed(2) + ' KAS'}</Text>
            </View>
            <TouchableOpacity disabled={!!busy} onPress={() => go(p)} style={{ backgroundColor: busy === p.key ? '#444' : '#7f1d1d', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10 }}>
              <Text style={{ color: '#fff', fontSize: 12 }}>{busy === p.key ? 'Sending…' : 'Reclaim'}</Text>
            </TouchableOpacity>
          </View>
        )))}
    </View>
  );
};

`;
const HUNKS = [
  ["const AvatarLikenessCard: React.FC<{", CARD + "const AvatarLikenessCard: React.FC<{"],
  ["        {/* XP Progress */}\n", "        {/* KV_RECLAIM */}\n        <MyPledgesCard hidden={__sm} />\n\n        {/* XP Progress */}\n"],
];
const raw = fs.readFileSync(F, 'utf8'); const crlf = /\r\n/.test(raw);
let t = crlf ? raw.replace(/\r\n/g, '\n') : raw;
if (t.includes(MARK)) { console.log('  done  ' + F + ' (already patched)'); process.exit(0); }
for (const [a, b] of HUNKS) { if (t.split(a).length !== 2) { console.log('  FAIL  missing: ' + a.slice(0, 60)); process.exit(1); } t = t.replace(a, () => b); }
fs.writeFileSync(F, crlf ? t.replace(/\n/g, '\r\n') : t);
console.log('  ok    ' + F);
