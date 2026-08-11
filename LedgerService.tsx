// LedgerService.tsx — "TownHall Ledger Service" wallet panel
// Shows registered archival/indexer operators, bond + audit status, and lets
// the user tip passing operators in KAS. Wire into TownHallScreen (or wallet):
//
//   import { LedgerService } from './LedgerService';
//   ...
//   <LedgerService />
//
// Registry entries + audits come from TownHall; tips ride the normal send rail.

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, Alert } from 'react-native';
import {
  fetchRegistry, fetchAudit, tipOperators,
  NodeRegistryEntry, NodeAuditEntry,
} from './node_registry';

const C = {
  bg: '#F5EFE6', card: '#EFE6D9', border: '#C8B79A',
  text: '#3E2F23', dim: '#7A6A57', accent: '#D98E2B',
  good: '#3FB950', bad: '#F85149', warn: '#D29922',
};

export function LedgerService({ onRegister }: { onRegister?: () => void } = {}) {
  const [nodes, setNodes] = useState<NodeRegistryEntry[]>([]);
  const [audit, setAudit] = useState<Record<string, NodeAuditEntry>>({});
  const [loading, setLoading] = useState(false);
  const [tipKas, setTipKas] = useState('1');
  const [tipping, setTipping] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reg, aud] = await Promise.all([fetchRegistry(), fetchAudit()]);
      setNodes(reg);
      const byPayout: Record<string, NodeAuditEntry> = {};
      for (const a of aud) byPayout[a.payout] = a;
      setAudit(byPayout);
    } catch (e: any) {
      console.log('[LedgerService] load failed:', e?.message || e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const passing = nodes.filter((n) => audit[n.payout]?.pass && n.bond_unspent);

  const onTip = async () => {
    const kas = parseFloat(tipKas);
    if (!isFinite(kas) || kas <= 0) { Alert.alert('Tip', 'Enter a valid KAS amount'); return; }
    if (passing.length === 0) { Alert.alert('Tip', 'No passing operators to tip right now'); return; }
    setTipping(true);
    try {
      const res = await tipOperators({ totalSompi: BigInt(Math.round(kas * 1e8)) });
      if (res.success) {
        Alert.alert('Tip sent', `${kas} KAS split across ${res.paid} operator(s)\n${(res.txid || '').slice(0, 16)}…`);
      } else {
        Alert.alert('Tip failed', res.error || 'unknown error');
      }
    } finally {
      setTipping(false);
    }
  };

  const statusFor = (n: NodeRegistryEntry) => {
    if (!n.bond_unspent) return { label: 'DEREGISTERED', color: C.dim };
    const a = audit[n.payout];
    if (!a || !a.audited) return { label: 'UNAUDITED', color: C.warn };
    return a.pass ? { label: 'VERIFIED', color: C.good } : { label: 'FAILED AUDIT', color: C.bad };
  };

  return (
    <View style={{ backgroundColor: C.card, borderColor: C.border, borderWidth: 1, borderRadius: 12, padding: 14, marginVertical: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: C.text, fontSize: 16, fontWeight: '700' }}>📒 Ledger Service</Text>
        <TouchableOpacity onPress={load} disabled={loading}>
          <Text style={{ color: C.accent }}>{loading ? '…' : '↻ Refresh'}</Text>
        </TouchableOpacity>
      </View>
      <Text style={{ color: C.dim, fontSize: 12, marginTop: 2, marginBottom: 8 }}>
        Independent operators archiving KasVillage history. VERIFIED = proved storage of on-chain records this audit round.
      </Text>

      {loading && nodes.length === 0 ? (
        <ActivityIndicator color={C.accent} />
      ) : nodes.length === 0 ? (
        <Text style={{ color: C.dim, fontSize: 13 }}>No operators registered yet.</Text>
      ) : (
        <ScrollView style={{ maxHeight: 260 }}>
          {nodes.map((n) => {
            const st = statusFor(n);
            return (
              <View key={n.txid} style={{ borderTopColor: C.border, borderTopWidth: 1, paddingVertical: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: C.text, fontSize: 13, fontWeight: '600' }}>
                    {n.svc.toUpperCase()} · {n.payout.slice(0, 18)}…
                  </Text>
                  <Text style={{ color: st.color, fontSize: 12, fontWeight: '700' }}>{st.label}</Text>
                </View>
                <Text style={{ color: C.dim, fontSize: 11 }} numberOfLines={1}>{n.api}</Text>
                <Text style={{ color: C.dim, fontSize: 11 }}>
                  Bond {(n.bond_amount / 1e8).toFixed(2)} KAS · {n.bond_unspent ? 'held' : 'reclaimed'}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 }}>
        <TextInput
          value={tipKas}
          onChangeText={setTipKas}
          keyboardType="decimal-pad"
          style={{ flex: 1, color: C.text, borderColor: C.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
          placeholder="KAS"
          placeholderTextColor={C.dim}
        />
        <TouchableOpacity
          onPress={onTip}
          disabled={tipping || passing.length === 0}
          style={{ backgroundColor: passing.length ? C.accent : C.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }}
        >
          <Text style={{ color: '#3E2F23', fontWeight: '700' }}>
            {tipping ? 'Sending…' : `Tip ${passing.length} verified`}
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={{ color: C.dim, fontSize: 10, marginTop: 6 }}>
        Tips split equally among verified operators. You pay from your wallet; KasVillage takes nothing.
      </Text>

      {onRegister ? (
        <TouchableOpacity
          onPress={onRegister}
          style={{ borderColor: C.border, borderWidth: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 12 }}
        >
          <Text style={{ color: C.text, fontWeight: '700', fontSize: 13 }}>Become an operator</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default LedgerService;
