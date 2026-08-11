// NodeRegisterScreen.tsx - register as a KasVillage archival/indexer operator.
// Bond 10 KAS (own address, unspent = active) + 1 KAS announce to the registry.
// Payout address and keys come from SecureStore inside registerNode().
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { registerNode, NODE_REGISTRY_ADDRESS } from './node_registry';
import * as SecureStore from 'expo-secure-store';

const C = {
  bg: '#F5EFE6', card: '#EFE6D9', border: '#C8B79A',
  text: '#3E2F23', dim: '#7A6A57', accent: '#D98E2B',
};

const SERVICES: Array<{ id: 'index' | 'relay' | 'archive'; label: string; blurb: string }> = [
  { id: 'index',   label: 'Indexer', blurb: 'Scans L1 payloads, serves search queries.' },
  { id: 'relay',   label: 'Relay',   blurb: 'Accepts signed txs, submits to the Kaspa node.' },
  { id: 'archive', label: 'Archive', blurb: 'Stores full KasVillage history, answers audits.' },
];

export function NodeRegisterScreen({ onClose }: { onClose: () => void }) {
  const [svc, setSvc] = useState<'index' | 'relay' | 'archive'>('archive');
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [payout, setPayout] = useState('');

  useEffect(() => {
    (async () => {
      const a = (await SecureStore.getItemAsync('kv_kaspa_address'))
        || (await SecureStore.getItemAsync('kaspa_address')) || '';
      setPayout(a);
    })();
  }, []);

  const submit = async () => {
    const url = apiBaseUrl.trim();
    if (!/^https?:\/\/.+/.test(url)) {
      Alert.alert('Invalid URL', 'Enter a reachable base URL, e.g. https://node.example.com');
      return;
    }
    Alert.alert(
      'Register operator?',
      'This spends 11 KAS: 10 KAS bond (returns to you, unspent while active) + 1 KAS announce. Your node must stay reachable to pass audits.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Register',
          onPress: async () => {
            setBusy(true);
            try {
              const res = await registerNode({ svc, apiBaseUrl: url });
              if (res.success) {
                Alert.alert('Registered', 'Announce tx: ' + (res.txid || '').slice(0, 16) + '...');
                onClose();
              } else {
                Alert.alert('Failed', res.error || 'unknown error');
              }
            } catch (e: any) {
              Alert.alert('Failed', String(e?.message || e));
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
          <Text style={{ color: C.text, fontSize: 16 }}>{'< Back'}</Text>
        </TouchableOpacity>
        <Text style={{ color: C.text, fontSize: 18, fontWeight: '700', marginLeft: 8 }}>Become an Operator</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ color: C.dim, marginBottom: 16, lineHeight: 20 }}>
          Operators archive KasVillage history and answer proof-of-storage audits. Users tip
          operators that pass. KasVillage takes nothing.
        </Text>

        <Text style={{ color: C.text, fontWeight: '700', marginBottom: 8 }}>Service type</Text>
        {SERVICES.map((s) => (
          <TouchableOpacity
            key={s.id}
            onPress={() => setSvc(s.id)}
            style={{
              backgroundColor: svc === s.id ? C.accent : C.card,
              borderColor: C.border, borderWidth: 1, borderRadius: 10,
              padding: 12, marginBottom: 8,
            }}
          >
            <Text style={{ color: C.text, fontWeight: '700' }}>{s.label}</Text>
            <Text style={{ color: svc === s.id ? C.text : C.dim, fontSize: 12, marginTop: 2 }}>{s.blurb}</Text>
          </TouchableOpacity>
        ))}

        <Text style={{ color: C.text, fontWeight: '700', marginTop: 12, marginBottom: 8 }}>API base URL</Text>
        <TextInput
          value={apiBaseUrl}
          onChangeText={setApiBaseUrl}
          placeholder="https://node.example.com"
          placeholderTextColor={C.dim}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            color: C.text, backgroundColor: C.card, borderColor: C.border, borderWidth: 1,
            borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
          }}
        />
        <Text style={{ color: C.dim, fontSize: 12, marginTop: 6 }}>
          Must be reachable from the public internet. Auditors fetch challenge responses here.
        </Text>

        <View style={{ backgroundColor: C.card, borderColor: C.border, borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 16 }}>
          <Text style={{ color: C.text, fontWeight: '700', marginBottom: 6 }}>Tips are paid to</Text>
          <Text style={{ color: C.dim, fontSize: 11 }} numberOfLines={2}>
            {payout || 'wallet address unavailable'}
          </Text>
          <Text style={{ color: C.dim, fontSize: 11, marginTop: 6 }}>
            This phone's wallet. The same key signs the announce and holds the bond.
          </Text>
        </View>

        <View style={{ backgroundColor: C.card, borderColor: C.border, borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 16 }}>
          <Text style={{ color: C.text, fontWeight: '700', marginBottom: 6 }}>Cost</Text>
          <Text style={{ color: C.dim, fontSize: 13 }}>10 KAS bond - held at your own address, unspent while active</Text>
          <Text style={{ color: C.dim, fontSize: 13 }}>1 KAS announce - burned to the registry address</Text>
          <Text style={{ color: C.dim, fontSize: 11, marginTop: 8 }} numberOfLines={2}>
            Registry: {NODE_REGISTRY_ADDRESS}
          </Text>
        </View>

        <TouchableOpacity
          onPress={submit}
          disabled={busy}
          style={{
            backgroundColor: busy ? C.border : C.accent, borderRadius: 10,
            paddingVertical: 14, alignItems: 'center', marginTop: 20, marginBottom: 40,
          }}
        >
          {busy ? <ActivityIndicator color={C.text} /> : <Text style={{ color: C.text, fontWeight: '700', fontSize: 16 }}>Register - 11 KAS</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

export default NodeRegisterScreen;
