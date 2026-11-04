// KV_MONEY_AUDIT_CARD: "Where did my KAS go?" - lives on the Transaction History screen.
import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
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
    </View>
  );
};
export default MoneyAuditCard;
