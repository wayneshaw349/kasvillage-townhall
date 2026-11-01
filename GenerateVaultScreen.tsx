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
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, TextInput, Switch,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
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
  onRestorePaper?: () => void;        // KV_CARD_PAPER_VAULT: rebuild a card + paper vault on a new phone
}

export const GenerateVaultScreen: React.FC<Props> = ({
  onDone, onCancel, network = require('./kv_net').KV_NET, total = 4, threshold = 2, onRestorePaper,
}) => {
  // KV_CARD_PAPER_VAULT: optional paper cosign key. The vault key stays on cards exactly as before;
  // with paper on, every spend ALSO needs the paper key (FROST 2-of-2). Paper key shown once, never stored.
  const [withPaper, setWithPaper] = useState(false);
  const [paperQR, setPaperQR] = useState('');
  const [paperHex, setPaperHex] = useState('');
  const [paperCheck, setPaperCheck] = useState('');
  const [restoreMode, setRestoreMode] = useState(false);
  const [restoreText, setRestoreText] = useState('');
  const [camOk, setCamOk] = useState(false);
  const _cam = (() => { try { return require('expo-camera'); } catch { return null; } })();
  // Restore step 1 of 2: read the paper's PUBLIC facts (vault id, network, cosign pubkey) and keep only
  // those; step 2 is Restore from Cards, which rebuilds the vault (AppNavigator vault_recovery).
  const takePaper = async (raw: string) => {
    const r = require('./frost_qr_signer').paperQrPublic(raw);
    setRestoreText('');
    if ('error' in r) { Alert.alert('Not a paper key', r.error); return; }
    await SecureStore.setItemAsync('kv_pending_paper_restore', JSON.stringify(r));
    setRestoreMode(false);
    Alert.alert('Paper read', 'Now scan your vault cards. The vault is rebuilt from both.', [{ text: 'Scan cards', onPress: () => onRestorePaper && onRestorePaper() }]);
  };
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
      let vaultAddr = w.kaspaAddress;
      if (withPaper) {
        const F = require('./frost_qr_signer');
        const vid = 'VLT_' + Date.now() + '_' + Math.floor(Math.random() * 0xffffffff).toString(16);
        const k = F.makePaperCosignKey(vid, network);
        const fv = { ...F.deriveVault({ vaultId: vid, myPubkey: w.publicKeyHex, cosignerPubkey: k.pubkey, network }), paperCosign: true };
        vaultAddr = fv.address;
        await SecureStore.setItemAsync('kv_frost_vault', JSON.stringify(fv));
        await SecureStore.setItemAsync('kv_vault_kind', 'cards_paper');
        setPaperQR(k.qr); setPaperHex(k.privHex); setPaperCheck('');
      } else {
        try { await SecureStore.deleteItemAsync('kv_vault_kind'); } catch {}
      }
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

  if (restoreMode) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Restore card + paper vault</Text>
        <Text style={styles.body}>Step 1: scan the paper key QR (use only this screen, never the camera app). Step 2: scan your vault cards.</Text>
        {_cam?.CameraView && camOk ? (
          <View style={{ height: 260, borderRadius: 12, overflow: 'hidden', marginVertical: 10 }}>
            <_cam.CameraView style={{ flex: 1 }} barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={(e: any) => { const d = String(e?.data || ''); if (d.startsWith('KVCK1|')) takePaper(d); }} />
          </View>
        ) : (
          <TouchableOpacity style={styles.secondary} onPress={async () => { try { const r = await _cam?.Camera?.requestCameraPermissionsAsync?.(); setCamOk(r?.status === 'granted'); } catch {} }}>
            <Text style={styles.secondaryText}>Turn on camera</Text>
          </TouchableOpacity>
        )}
        <TextInput value={restoreText} onChangeText={setRestoreText} placeholder="or paste the KVCK1|… text" placeholderTextColor="#78716C" secureTextEntry autoCapitalize="none" autoCorrect={false}
          style={{ borderWidth: 1, borderColor: '#78716C', borderRadius: 8, padding: 10, color: '#F5F5F4', marginTop: 10 }} />
        <TouchableOpacity style={[styles.primary, { marginTop: 10 }]} onPress={() => takePaper(restoreText)}>
          <Text style={styles.primaryText}>Use this paper</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={() => setRestoreMode(false)}>
          <Text style={styles.secondaryText}>Back</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // KV_CARD_PAPER_VAULT: paper key first (shown once), then the cards as before.
  if (wires && paperQR) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>📄 Your paper key</Text>
        <Text style={styles.body}>
          Every spend from this vault needs your vault cards AND this paper key. It is shown ONCE and is not saved anywhere.
          Write the 64 characters on paper (or print the QR from a computer). Do NOT screenshot or photograph it.
        </Text>
        <View style={{ alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 12, marginVertical: 12 }}>
          <QRCode value={paperQR} size={220} backgroundColor="#FFFFFF" color="#000000" />
        </View>
        <Text style={[styles.li, { fontFamily: 'Courier', letterSpacing: 1, textAlign: 'center' }]}>{(paperHex.match(/.{1,4}/g) || []).join(' ')}</Text>
        <Text style={[styles.body, { marginTop: 10 }]}>To prove you saved it, type its LAST 6 characters:</Text>
        <TextInput value={paperCheck} onChangeText={(t) => setPaperCheck(t.trim().toLowerCase())} autoCapitalize="none" autoCorrect={false}
          style={{ borderWidth: 1, borderColor: '#78716C', borderRadius: 8, padding: 10, color: '#F5F5F4', textAlign: 'center', fontFamily: 'Courier' }} />
        <TouchableOpacity style={[styles.primary, { marginTop: 12 }, paperCheck !== paperHex.slice(-6) && styles.primaryDisabled]}
          disabled={paperCheck !== paperHex.slice(-6)} onPress={() => { setPaperQR(''); setPaperHex(''); setPaperCheck(''); }}>
          <Text style={styles.primaryText}>I saved the paper key → Next: vault cards</Text>
        </TouchableOpacity>
        <Text style={[styles.li, { marginTop: 10 }]}>Lose the paper OR all your cards and the vault funds are lost. Store them in different places.</Text>
      </ScrollView>
    );
  }

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
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[styles.cardHead, { flex: 1 }]}>Also require a paper key (recommended)</Text>
          <Switch value={withPaper} onValueChange={setWithPaper} disabled={busy} />
        </View>
        <Text style={styles.li}>• Spending then needs your cards AND a paper key you scan (FROST 2-of-2).</Text>
        <Text style={styles.li}>• Someone with your cards alone, or the paper alone, cannot spend.</Text>
        {onRestorePaper ? (
          <TouchableOpacity onPress={() => setRestoreMode(true)} disabled={busy} style={{ marginTop: 8 }}>
            <Text style={[styles.li, { textDecorationLine: 'underline' }]}>New phone? Restore a card + paper vault</Text>
          </TouchableOpacity>
        ) : null}
      </View>
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
