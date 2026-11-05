// KV_MONEY_AUDIT_CARD: "Where did my KAS go?" - lives on the Transaction History screen.
import React, { useEffect, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const MoneyAuditCard: React.FC<{ hidden?: boolean }> = ({ hidden }) => {
  const [open, setOpen] = useState(false);
  const [a, setA] = useState<any | null>(null);
  const [err, setErr] = useState('');
  const load = async () => {
    setA(null); setErr('');
    try {
      const addr = (await SecureStore.getItemAsync('kv_kaspa_address')) || (await SecureStore.getItemAsync('kaspa_address')) || '';
      if (!addr) throw new Error('wallet address unavailable');
      setA(await require('./kv_money_audit').auditMyMoney(addr, require('./kv_net').KV_NET));
    } catch (e: any) { setErr(String(e?.message || e)); setA(undefined); }
  };
  useEffect(() => { if (open && a === null) load(); }, [open]);
  const K = (v: any) => hidden ? '\u2022\u2022\u2022' : (Number(v) / 1e8).toFixed(2);
  const Row = ({ label, kas, col, note }: any) => (
    <View style={{ paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#2a2a2a' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: '#fff', fontSize: 13 }}>{label}</Text>
        <Text style={{ color: col, fontSize: 13, fontWeight: '700' }}>{K(kas)} KAS</Text>
      </View>
      <Text style={{ color: '#888', fontSize: 10, marginTop: 1 }}>{note}</Text>
    </View>
  );
  return (
    <View style={{ backgroundColor: '#1A1A1A', borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#333' }}>
      <TouchableOpacity onPress={() => setOpen(!open)} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: '#D4AF37', fontSize: 14 }}>{'\uD83E\uDDFE Where did my KAS go?'}</Text>
        <Text style={{ color: '#888', fontSize: 12 }}>{open ? 'Hide' : 'Show'}</Text>
      </TouchableOpacity>
      {open && (a === null ? <Text style={{ color: '#888', fontSize: 12, marginTop: 8 }}>Reading your address history off the chain\u2026</Text>
        : err ? <Text style={{ color: '#e06c5a', fontSize: 12, marginTop: 8 }}>{err}</Text>
        : (<>
          <Row label="Staked on your listings" kas={a.stakedOut} col="#10B981" note="Data chunks parked at addresses only your key can spend. Reclaimable - see Profile > My Pledges." />
          <Row label="Listing records" kas={a.listingOut} col="#D4AF37" note="Registry announces and delists (~1 KAS each). The cost of being listed." />
          <Row label="Network fees" kas={a.fees} col="#e0a040" note="Paid to Kaspa miners on your transactions." />
          <Row label="Sent to others" kas={a.sentOut} col="#e06c5a" note="Plain sends: payments, tips, escrows, funding other wallets of yours." />
          <Row label="Received" kas={a.received} col="#10B981" note="Everything that came in: reclaims, payments, refunds." />
          <Text style={{ color: '#666', fontSize: 9, marginTop: 6 }}>
            {a.txCount + ' transactions' + (a.sinceMs ? ' since ' + new Date(a.sinceMs).toLocaleDateString() : '') + (a.partial ? ' (long history - showing the most recent 500)' : '') + ' \u00b7 read straight from the chain, nothing hidden'}
          </Text>
        </>))}
      {open ? <StakeLedger /> : null}
    </View>
  );
};
export default MoneyAuditCard;

// KV_PLEDGE_LEDGER: your stakes, remembered on this phone (zero network reads until you act).
// Paste a game name to find a forgotten one; Reclaim sweeps it home and the row deletes itself.
const StakeLedger: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState('');
  const load = async () => { try { setRows(await require('./kv_reclaim').listKnownPledges()); } catch { setRows([]); } };
  useEffect(() => { load(); }, []);
  const reclaim = (p: any) => {
    Alert.alert('Reclaim ' + (Number(p.sompi) / 1e8).toFixed(2) + ' KAS?', p.label + '\n\n' + (p.note || '') + '\nThe coins go back to your wallet (minus a small network fee), and this row deletes itself.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reclaim', style: 'destructive', onPress: async () => {
        try {
          const LA = require('expo-local-authentication');
          const ok = await LA.authenticateAsync({ promptMessage: 'Reclaim stake' });
          if (!ok.success) { Alert.alert('Could not confirm it is you', 'Face ID said: ' + String((ok as any).error || 'cancelled') + '. Nothing was moved.'); return; }
          setBusy(p.key);
          const kas = await require('./kv_reclaim').reclaimPledge({ ...p, sompi: BigInt(p.sompi) });
          try { require('./kv_reclaim').forgetPledgeCache(); } catch {}
          Alert.alert(kas > 0 ? 'Reclaimed' : 'Sweeps submitted', kas > 0 ? kas.toFixed(2) + ' KAS sent back to your wallet.' : 'The network accepted the sweeps - the balance updates as they confirm.');
        } catch (e: any) { Alert.alert('Reclaim failed', String(e?.message || e)); }
        setBusy(''); await load();
      } },
    ]);
  };
  const find = async () => {
    const q = String(name || '').trim().toLowerCase();
    if (!q) return;
    setBusy('find');
    try {
      const p = await require('./kv_reclaim').findGamePledges(q);
      if (!p) Alert.alert('Nothing there', 'No coins at that name\u2019s addresses (confirmed by the chain). Check the exact spelling - dashes matter.');
      else { Alert.alert('Found ' + (Number(p.sompi) / 1e8).toFixed(2) + ' KAS', 'Remembered below - press Reclaim when ready.'); setName(''); }
    } catch (e: any) { Alert.alert('Scan failed', String(e?.message || e)); }
    setBusy(''); await load();
  };
  return (
    <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: '#333', paddingTop: 8 }}>
      <Text style={{ color: '#D4AF37', fontSize: 13, fontWeight: '700' }}>{'\u26d3 Your stakes - reclaim ledger'}</Text>
      <Text style={{ color: '#888', fontSize: 10, marginTop: 2 }}>Remembered on this phone. A reclaimed stake deletes itself; what is listed is still out there, yours.</Text>
      {rows.length === 0 ? <Text style={{ color: '#666', fontSize: 11, marginTop: 6 }}>Nothing outstanding - every stake seen here has been reclaimed.</Text>
        : rows.map((p: any) => (
          <View key={p.key} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#2a2a2a' }}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ color: '#fff', fontSize: 12 }} numberOfLines={1}>{p.label}</Text>
              <Text style={{ color: '#10B981', fontSize: 11 }}>{(Number(p.sompi) / 1e8).toFixed(2) + ' KAS'}{p.at ? ' \u00b7 last seen ' + new Date(p.at).toLocaleDateString() : ''}</Text>
            </View>
            <TouchableOpacity disabled={!!busy} onPress={() => reclaim(p)} style={{ backgroundColor: '#7f1d1d', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, opacity: busy ? 0.5 : 1 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 11 }}>{busy === p.key ? 'Sweeping\u2026' : 'Reclaim'}</Text>
            </TouchableOpacity>
          </View>
        ))}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <TextInput value={name} onChangeText={setName} placeholder="Paste a game name (e.g. showcase-kascity-v419-rolldrag)" placeholderTextColor="#666"
          autoCapitalize="none" autoCorrect={false}
          style={{ flex: 1, borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, color: '#fff', fontSize: 11 }} />
        <TouchableOpacity disabled={!!busy || !name.trim()} onPress={find} style={{ borderWidth: 1, borderColor: '#D4AF37', borderRadius: 8, paddingHorizontal: 12, justifyContent: 'center', opacity: busy || !name.trim() ? 0.5 : 1 }}>
          <Text style={{ color: '#D4AF37', fontWeight: '700', fontSize: 11 }}>{busy === 'find' ? 'Scanning\u2026' : 'Find'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
