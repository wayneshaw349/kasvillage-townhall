// KV_DISCLAIMER: first-entry disclaimer. Shown when the wallet opens until the user accepts;
// acceptance is stored per version key (bump KV_DISCLAIMER_KEY to re-show after big changes).
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const KV_DISCLAIMER_KEY = 'kv_disclaimer_v2';

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
        <P t="Experimental - not audited" b="KasVillage is open-source software in active development. It has NOT been officially security-audited. Proceed with caution: bugs are possible, including ones that could lose funds." />
        <P t="You hold your own keys" b="Your seed phrase and keys live only on this phone. Nobody - including the KasVillage developers - can recover them, freeze them, reverse a transaction, or move your money. If you lose your seed, your funds are gone." />
        <P t="Keep amounts small" b="Treat this wallet like a pocket, not a vault. Only keep what you are actively using, especially while the software is young." />
        <P t="Deals are between people" b="Agreements, escrow, reputation scores and warnings are tools, not guarantees. The wallet never blocks or holds anyone's money. You choose who you deal with, and deals happen at your own risk." />
        <P t="Built with AI" b="Much of this code was written with AI assistance and reviewed by the maintainer. It is open source (github.com/wayneshaw349/kasvillage-townhall): review it, report issues, and verify what you run - that is the security model." />
        <P t="Privacy" b="Kaspa is a public ledger: your addresses, balances, transactions, listings, pledges, flags and game moves are visible to anyone, forever. Your seed and keys never leave this phone, and KasVillage runs no accounts and collects no personal data. A contact handle you attach to an offer is shared with the players in that room. Streamer Mode hides details on YOUR screen only - it changes nothing on-chain." />
        <P t="Moderation and the law" b="Listings flagged by 3 community members are automatically delisted in every wallet, and a moderator can delist content with the reason published on-chain; owners are notified in-app. Content that is illegal or that the law requires to be removed will be delisted when identified. You are responsible for what you publish and trade." />
        <View style={{ marginBottom: 14 }}>
          <Text style={{ color: '#F59E0B', fontSize: 14, fontWeight: 'bold', marginBottom: 4 }}>See something illegal?</Text>
          <Text style={{ color: '#D6D3D1', fontSize: 13, lineHeight: 19 }}>
            Flag the listing in the app, and report it to the authorities - in the US, the FBI's Internet Crime Complaint Center:{' '}
            <Text style={{ color: '#60A5FA' }} onPress={() => { try { Linking.openURL('https://www.ic3.gov'); } catch {} }}>ic3.gov</Text>
          </Text>
        </View>
        <Text style={{ color: '#78716C', fontSize: 11, marginBottom: 20 }}>
          By continuing you confirm you understand and accept these terms. No warranty of any kind is given.
        </Text>
      </ScrollView>
      <View style={{ padding: 20, paddingBottom: 40 }}>
        <TouchableOpacity
          disabled={busy}
          onPress={async () => { setBusy(true); try { await AsyncStorage.setItem(KV_DISCLAIMER_KEY, String(Date.now())); } catch {} onAccept(); }}
          style={{ backgroundColor: '#ec4899', borderRadius: 12, paddingVertical: 16, alignItems: 'center' }} // KV_PINK: matches the Mailbox pledge bar
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>I understand — enter the Village</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
export default DisclaimerGate;
