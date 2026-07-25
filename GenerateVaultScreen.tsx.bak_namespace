// ============================================================================
// GenerateVaultScreen.tsx — mint a NEW backable wallet + show its QR cards
// ============================================================================
// Flow: tap Generate -> generateBackableWallet() (RNG mnemonic -> key)
//   -> restoreWalletFromMnemonic() ACTIVATES it (writes keys + kv_mnemonic)
//   -> createIdentityBoundBackup() -> hands wires to VaultBackupScreen.
//
// This creates a NEW address and makes it the active wallet. Your previous
// (iCloud-restoring) wallet is not touched by generation itself, but this new
// wallet becomes active afterwards. The QR cards are the ONLY portable,
// cross-platform recovery for it — screenshot/print all of them.
// ============================================================================

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { VaultBackupScreen } from './VaultBackupScreen';
import { generateBackableWallet, createIdentityBoundBackup } from './vault_generator';
import { restoreWalletFromMnemonic } from './wallet_registration_v2';

type Net = 'mainnet' | 'testnet-10' | 'testnet-11';

interface Props {
  onDone: () => void;                 // finished backing up -> leave
  onCancel: () => void;               // back out before generating
  network?: Net;                      // default testnet-10
  total?: number;                     // cards to issue (default 4)
  threshold?: number;                 // cards needed to recover (default 2)
}

export const GenerateVaultScreen: React.FC<Props> = ({
  onDone, onCancel, network = 'testnet-10', total = 4, threshold = 2,
}) => {
  const [busy, setBusy] = useState(false);
  const [wires, setWires] = useState<string[] | null>(null);
  const [address, setAddress] = useState('');
  const [bindingHex, setBindingHex] = useState('');

  const handleGenerate = async () => {
    setBusy(true);
    try {
      // 1) mint from CSPRNG (key derived FROM the mnemonic)
      const w = await generateBackableWallet(network);

      // 2) build identity-bound cards (2-of-N) BEFORE activating,
      //    so a split failure aborts without changing the active wallet
      const backup = createIdentityBoundBackup(w.mnemonic, w.publicKeyHex, total, 1, threshold);

      // 3) activate: persist keys + kv_mnemonic (same path createWallet uses)
      const res = await restoreWalletFromMnemonic(w.mnemonic, network);
      if (!res.success) throw new Error(res.error || 'activation failed');

      const vaultAddr = res.kaspaAddress || w.kaspaAddress;
      try { await SecureStore.setItemAsync('kv_vault_address', vaultAddr); } catch {}
      setAddress(vaultAddr);
      setBindingHex(backup.bindingHex);
      setWires(backup.wires);           // -> renders VaultBackupScreen below
    } catch (e: any) {
      Alert.alert('Generation failed', e?.message || 'Could not mint the wallet.');
    } finally {
      setBusy(false);
    }
  };

  // Once wires exist, hand off to the existing backup UI (QR cards).
  if (wires) {
    return (
      <View style={{ flex: 1 }}>
        <View style={styles.banner}>
          <Text style={styles.bannerText}>New wallet active</Text>
          <Text style={styles.bannerSub} numberOfLines={1}>{address}</Text>
          <Text style={styles.bindTag}>card set · {bindingHex}</Text>
        </View>
        <VaultBackupScreen
          wires={wires}
          threshold={threshold}
          onDone={onDone}
          onCancel={onDone}
        />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>🔐 Generate Backable Wallet</Text>
      <Text style={styles.body}>
        Creates a brand-new wallet whose recovery is portable across devices and
        platforms. You'll get {total} QR cards; any {threshold} restore the wallet.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardHead}>What happens</Text>
        <Text style={styles.li}>• A fresh 12-word seed is generated on-device.</Text>
        <Text style={styles.li}>• It becomes your active wallet (new address).</Text>
        <Text style={styles.li}>• The seed is split into {total} identity-bound QR cards.</Text>
        <Text style={styles.li}>• Any {threshold} of {total} cards rebuild it — on any phone.</Text>
      </View>

      <View style={styles.warn}>
        <Text style={styles.warnText}>
          ⚠ The QR cards are the only portable backup. Save/print all {total} before
          sending funds. Your previous wallet stays intact but this new one becomes active.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.primary, busy && styles.primaryDisabled]}
        onPress={handleGenerate}
        disabled={busy}
      >
        {busy
          ? <ActivityIndicator color="#0C0A09" />
          : <Text style={styles.primaryText}>Generate & Activate</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondary} onPress={onCancel} disabled={busy}>
        <Text style={styles.secondaryText}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 56, backgroundColor: '#0C0A09', flexGrow: 1 },
  title: { fontSize: 22, fontWeight: '800', color: '#F5F5F4', marginBottom: 10 },
  body: { fontSize: 14, color: '#A8A29E', lineHeight: 20, marginBottom: 18 },
  card: { backgroundColor: '#292524', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#44403C', marginBottom: 14 },
  cardHead: { fontSize: 13, fontWeight: '700', color: '#F5F5F4', marginBottom: 8 },
  li: { fontSize: 13, color: '#D6D3D1', lineHeight: 22 },
  warn: { backgroundColor: '#292018', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#78350F', marginBottom: 22 },
  warnText: { fontSize: 13, color: '#FCD34D', lineHeight: 19 },
  primary: { backgroundColor: '#F5C542', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  primaryDisabled: { opacity: 0.6 },
  primaryText: { fontSize: 16, fontWeight: '800', color: '#0C0A09' },
  secondary: { paddingVertical: 14, alignItems: 'center' },
  secondaryText: { fontSize: 14, color: '#A8A29E' },
  banner: { backgroundColor: '#14532D', paddingTop: 52, paddingBottom: 12, paddingHorizontal: 16 },
  bannerText: { color: '#BBF7D0', fontSize: 13, fontWeight: '700' },
  bannerSub: { color: '#86EFAC', fontSize: 11, marginTop: 2 },
  bindTag: { color: '#4ADE80', fontSize: 10, marginTop: 2, fontFamily: 'Courier' },
});

export default GenerateVaultScreen;
