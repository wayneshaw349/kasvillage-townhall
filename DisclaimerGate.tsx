// KV_DISCLAIMER: first-entry disclaimer. Shown when the wallet opens until the user accepts;
// acceptance is stored per version key (bump KV_DISCLAIMER_KEY to re-show after big changes).
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const KV_DISCLAIMER_KEY = 'kv_disclaimer_v1';

const P: React.FC<{ t: string; b: string }> = ({ t, b }) => (
  <View style={{ marginBottom: 14 }}>
    <Text style={{ color: '#F59E0B', fontSize: 14, fontWeight: 'bold', marginBottom: 4 }}>{t}</Text>
    <Text style={{ color: '#D6D3D1', fontSize: 13, lineHeight: 19 }}>{b}</Text>
  </View>
);

export const DisclaimerGate: React.FC<{ onAccept: () => void }> = ({ onAccept }) => {
  const [busy, setBusy] = useState(false);
  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a', paddingTop: 60 }}>
      <ScrollView style={{ flex: 1, paddingHorizontal: 20 }}>
        <Text style={{ fontSize: 40, textAlign: 'center' }}>⚠️</Text>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginVertical: 10 }}>
          Before you enter KasVillage
        </Text>
        <P t="Experimental software" b="KasVillage is open-source, community-reviewed software in active development. It has not had a formal third-party security audit. Bugs are possible, including ones that could lose funds." />
        <P t="You hold your own keys" b="Your seed phrase and keys live only on this phone. Nobody - including the KasVillage developers - can recover them, freeze them, reverse a transaction, or move your money. If you lose your seed, your funds are gone." />
        <P t="Keep amounts small" b="Treat this wallet like a pocket, not a vault. Only keep what you are actively using, especially while the software is young." />
        <P t="Deals are between people" b="Agreements, escrow, reputation scores and warnings are tools, not guarantees. The wallet never blocks or holds anyone's money. You choose who you deal with, and deals happen at your own risk." />
        <P t="Open source" b="All code is public (github.com/wayneshaw349/kasvillage-townhall). Review it, report issues, and verify what you run - that is the security model." />
        <Text style={{ color: '#78716C', fontSize: 11, marginBottom: 20 }}>
          By continuing you confirm you understand and accept these terms. No warranty of any kind is given.
        </Text>
      </ScrollView>
      <View style={{ padding: 20, paddingBottom: 40 }}>
        <TouchableOpacity
          disabled={busy}
          onPress={async () => { setBusy(true); try { await AsyncStorage.setItem(KV_DISCLAIMER_KEY, String(Date.now())); } catch {} onAccept(); }}
          style={{ backgroundColor: '#F59E0B', borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}
        >
          <Text style={{ color: '#0a0a0a', fontSize: 16, fontWeight: 'bold' }}>I understand — enter the Village</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
export default DisclaimerGate;
