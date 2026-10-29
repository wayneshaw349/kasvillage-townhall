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
  onDone, onCancel, network = require('./kv_net').KV_NET, total = 4, threshold = 2,
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

      // 3) VAULT-NAMESPACED: store in vault slots ONLY - never touches the
      //    active (hot) wallet. Spending uses sendKASFromVault, which derives
      //    the key from kv_vault_mnemonic at sign time.
      const vaultAddr = w.kaspaAddress;
      await SecureStore.setItemAsync('kv_vault_mnemonic', w.mnemonic, {
        keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
      });
      await SecureStore.setItemAsync('kv_vault_pubkey', w.publicKeyHex);
      await SecureStore.setItemAsync('kv_vault_address', vaultAddr);
      setAddress(vaultAddr);
      setBindingHex(backup.bindingHex);
      setWires(backup.wires);           // -> renders VaultBackupScreen below
    } catch (e: any) {
      Alert.alert('Generation failed', e?.message || 'Could not mint the wallet.');
    } finally {
      setBusy(false);
    }
  };

  const finishVault = () => { /* KV_VAULT_AUTOCOLD */
    Alert.alert('Take the vault key off this phone?',
      'Only if you saved ALL your cards. Going cold removes the vault key from this phone, so a stolen phone cannot spend the vault. To spend later: Restore from Cards, send, then Go Cold again.',
      [{ text: 'Keep warm', style: 'cancel', onPress: onDone },
       { text: 'Go Cold (recommended)', onPress: async () => { try { const { vaultGoCold } = require('./kasvillage_cold_wallet'); const r = await vaultGoCold(); if (!r.success) Alert.alert('Go Cold', r.error || 'Failed'); } catch {} onDone(); } }]);
  };

  // Once wires exist, hand off to the existing backup UI (QR cards).
  if (wires) {
    return (
      <View style={{ flex: 1 }}>
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Vault created</Text>
          <Text style={styles.bannerSub} numberOfLines={1}>{address}</Text>
          <Text style={styles.bindTag}>card set · {bindingHex}</Text>
        </View>
        <VaultBackupScreen
          wires={wires}
          threshold={threshold}
          onDone={finishVault}
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
        <Text style={styles.li}>• It becomes your VAULT (separate from your hot wallet).</Text>
        <Text style={styles.li}>• The seed is split into {total} identity-bound QR cards.</Text>
        <Text style={styles.li}>• Any {threshold} of {total} cards rebuild it — on any phone.</Text>
      </View>

      <View style={styles.warn}>
        <Text style={styles.warnText}>
          ⚠ The QR cards are the only portable backup. Save/print all {total} before
          sending funds. Your hot wallet is untouched; the vault is a separate cold wallet.
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
