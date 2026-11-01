// ============================================================================
// VaultSetupScreen.tsx — create the 2-device FROST vault (runs on BOTH devices)
// ============================================================================
// Symmetric flow:
//   Device A: "Create new" -> mints vaultId -> shows setup QR + scans B's QR
//   Device B: "Join"       -> scans A's QR (adopts vaultId) -> shows its QR back
//   Both:     deriveVault -> SAME address + verification code -> humans COMPARE
//             the codes out loud -> Save (persists kv_frost_vault + kv_frost_vault_address)
//
// No secrets are exchanged — only compressed pubkeys. The verification code
// (48-bit) is the MITM check: if the codes differ, someone substituted a key.
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet, Modal,
  ActivityIndicator, ScrollView, Alert, Dimensions,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import {
  type VaultInfo,
  deriveVault,
  makeVaultSetupQR,
  parseVaultSetupQR,
} from './frost_qr_signer';

declare const require: any; // Metro provides this at runtime; type-only declaration
let _cam: any = null;
try { _cam = require('expo-camera'); } catch {}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const QR_SIZE = Math.min(SCREEN_WIDTH - 100, 260);

export const KV_FROST_VAULT_KEY = 'kv_frost_vault';
export const KV_FROST_VAULT_ADDR_KEY = 'kv_frost_vault_address';

/** Load the stored FROST vault (null if none). */
export async function loadFrostVault(): Promise<VaultInfo | null> {
  try {
    return (await require('./kv_vault_active').kvFrostVaultActive()) as VaultInfo | null; // KV_VAULT_ACTIVE
  } catch { return null; }
}

type Net = 'mainnet' | 'testnet-10' | 'testnet-11';
type Step = 'start' | 'exchange' | 'paper' | 'restorePaper' | 'confirm' | 'saving' | 'done' | 'error';

export interface VaultSetupScreenProps {
  visible: boolean;
  onClose: () => void;
  /** Returns THIS device's compressed pubkey hex (66 chars). */
  getMyPubkey: () => Promise<string>;
  network?: Net;
  onCreated?: (vault: VaultInfo) => void;
}

export const VaultSetupScreen: React.FC<VaultSetupScreenProps> = ({
  visible, onClose, getMyPubkey, network = require('./kv_net').KV_NET, onCreated,
}) => {
  const [step, setStep] = useState<Step>('start');
  const [error, setError] = useState<string | null>(null);
  const [myPubkey, setMyPubkey] = useState('');
  const [vaultId, setVaultId] = useState('');
  const [myQR, setMyQR] = useState('');
  const [theirPubkey, setTheirPubkey] = useState('');
  const [vault, setVault] = useState<VaultInfo | null>(null);
  const [pasteBuf, setPasteBuf] = useState('');
  const [camGranted, setCamGranted] = useState(false);
  const [waitingForCreatorScan, setWaitingForCreatorScan] = useState(false);
  const busyRef = useRef(false);
  // KV_PAPER_COSIGN: the paper key is shown once, held only in this state, never stored
  const [paperQR, setPaperQR] = useState('');
  const [paperHex, setPaperHex] = useState('');
  const [paperCheck, setPaperCheck] = useState('');

  const reset = useCallback(() => {
    setPaperQR(''); setPaperHex(''); setPaperCheck('');
    setError(null); setMyQR(''); setTheirPubkey(''); setVault(null);
    setPasteBuf(''); setVaultId(''); setWaitingForCreatorScan(false);
  }, []);

  useEffect(() => {
    if (visible) {
      setStep('start'); reset();
      getMyPubkey().then(setMyPubkey).catch(() => setError('Could not load this device\'s pubkey'));
    } else reset();
  }, [visible, reset, getMyPubkey]);

  useEffect(() => {
    if ((step !== 'exchange' && step !== 'restorePaper') || !_cam?.Camera?.requestCameraPermissionsAsync) return;
    _cam.Camera.requestCameraPermissionsAsync()
      .then((r: any) => setCamGranted(r?.status === 'granted'))
      .catch(() => setCamGranted(false));
  }, [step]);

  // -------------------------------------------------------------------------
  // Start: create (mint vaultId) or join (vaultId arrives in the scanned QR)
  // -------------------------------------------------------------------------
  const beginExchange = (vid: string) => {
    setVaultId(vid);
    setMyQR(makeVaultSetupQR({ pubkey: myPubkey, vaultId: vid, network }));
    setStep('exchange');
  };

  const handleCreate = () => {
    if (!myPubkey) return;
    // Random vaultId — uniqueness is what matters; counter derives from it
    const rnd = Array.from({ length: 4 }, () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0')).join('');
    beginExchange('VLT_' + Date.now() + '_' + rnd);
  };

  const handlePaper = () => {
    if (!myPubkey) return;
    try {
      const { makePaperCosignKey } = require('./frost_qr_signer');
      const rnd = Array.from({ length: 4 }, () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0')).join('');
      const vid = 'VLT_' + Date.now() + '_' + rnd;
      const k = makePaperCosignKey(vid, network);
      const v = deriveVault({ vaultId: vid, myPubkey, cosignerPubkey: k.pubkey, network });
      setVaultId(vid);
      setVault({ ...v, paperCosign: true });
      setPaperQR(k.qr); setPaperHex(k.privHex); setPaperCheck('');
      setStep('paper');
    } catch (e: any) { setError(e?.message || 'Could not create the cosign key'); }
  };

  const handleRestorePaper = (raw: string) => {
    const r = require('./frost_qr_signer').restorePaperVault(raw, myPubkey);
    setPasteBuf('');
    if ('error' in r) { setError(r.error); return; }
    if (r.vault.network !== network) { setError('This paper is for ' + r.vault.network + ', the app is on ' + network + '.'); return; }
    setError(null); setVaultId(r.vault.vaultId); setVault(r.vault); setStep('confirm');
  };

  const handleJoin = () => {
    if (!myPubkey) return;
    setVaultId(''); // will adopt from the first scanned setup QR
    setMyQR('');    // shown after adoption (needs the vaultId)
    setStep('exchange');
  };

  // -------------------------------------------------------------------------
  // Exchange: process a scanned/pasted setup payload
  // -------------------------------------------------------------------------
  const processSetupPayload = useCallback((data: string) => {
    const p = parseVaultSetupQR(data.trim());
    if (!p) { setError('Not a valid vault setup QR'); return; }
    if (p.network !== network) { setError('Network mismatch: theirs=' + p.network + ' mine=' + network); return; }
    if (p.pubkey === myPubkey) { setError('Scanned this device\'s own QR — scan the OTHER device'); return; }

    setError(null);
    if (!vaultId) {
      // Joiner: adopt their vaultId and show my QR back — do NOT auto-derive yet
      setVaultId(p.vaultId);
      setMyQR(makeVaultSetupQR({ pubkey: myPubkey, vaultId: p.vaultId, network }));
      setTheirPubkey(p.pubkey);
      setWaitingForCreatorScan(true); // Joiner waits for creator to scan before deriving
      return;
    } else if (p.vaultId !== vaultId) {
      setError('Vault ID mismatch — the other device is in a different session');
      return;
    }
    setTheirPubkey(p.pubkey);
  }, [myPubkey, vaultId, network]);

  // Both sides present -> derive (but Joiner must manually continue after showing their QR)
  useEffect(() => {
    if (step !== 'exchange' || !theirPubkey || !vaultId || !myPubkey) return;
    if (waitingForCreatorScan) return; // Joiner: wait for manual "Continue" tap
    try {
      const v = deriveVault({ vaultId, myPubkey, cosignerPubkey: theirPubkey, network });
      setVault(v);
      setStep('confirm');
    } catch (e: any) {
      setError(e?.message || 'Derivation failed');
    }
  }, [step, theirPubkey, vaultId, myPubkey, network, waitingForCreatorScan]);

  const handlePaste = async () => {
    const text = pasteBuf.trim() || (await Clipboard.getStringAsync()).trim();
    if (text) processSetupPayload(text);
    setPasteBuf('');
  };

  // -------------------------------------------------------------------------
  // Confirm: humans compare codes -> save
  // -------------------------------------------------------------------------
  const handleSave = async () => {
    if (busyRef.current || !vault) return;
    busyRef.current = true;
    setStep('saving');
    try {
      await SecureStore.setItemAsync(KV_FROST_VAULT_KEY, JSON.stringify(vault));
      await SecureStore.setItemAsync(KV_FROST_VAULT_ADDR_KEY, vault.address);
      onCreated?.(vault);
      setStep('done');
    } catch (e: any) {
      setError(e?.message || 'Save failed');
      setStep('error');
    } finally { busyRef.current = false; }
  };

  const CameraView = _cam?.CameraView;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>🔗 Create FROST Vault</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}>
              <Text style={styles.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* STEP: start */}
          {step === 'start' && (
            <ScrollView contentContainerStyle={styles.center}>
              <Text style={styles.body}>
                A FROST vault needs BOTH devices to approve every spend. Each device
                keeps only its own key — the full key never exists anywhere.
              </Text>
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  Run this screen on both devices. One taps Create, the other taps
                  Join, then point the cameras at each other's QR.
                </Text>
              </View>
              <TouchableOpacity style={[styles.primaryBtn, !myPubkey && styles.btnDisabled]} onPress={handleCreate} disabled={!myPubkey}>
                <Text style={styles.primaryBtnText}>Create new vault (this device starts)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryBtn, !myPubkey && styles.btnDisabled]} onPress={handleJoin} disabled={!myPubkey}>
                <Text style={styles.secondaryBtnText}>Join (scan the other device)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryBtn, !myPubkey && styles.btnDisabled]} onPress={handlePaper} disabled={!myPubkey}>
                <Text style={styles.secondaryBtnText}>Paper cosign key (no second phone)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryBtn, !myPubkey && styles.btnDisabled]} onPress={() => { setError(null); setStep('restorePaper'); }} disabled={!myPubkey}>
                <Text style={styles.secondaryBtnText}>Restore paper vault (scan your cosign paper)</Text>
              </TouchableOpacity>
              {error && <Text style={styles.errSmall}>{error}</Text>}
            </ScrollView>
          )}

          {/* STEP: paper - KV_PAPER_COSIGN */}
          {step === 'paper' && paperQR ? (
            <ScrollView contentContainerStyle={styles.center}>
              <Text style={styles.stepTitle}>Your paper cosign key</Text>
              <Text style={styles.body}>
                Every spend from this vault needs this phone AND this key. It is shown ONCE and is not saved anywhere.
                Write the 64 characters on paper (or print the QR from a computer). Do NOT screenshot or photograph it.
              </Text>
              <View style={styles.qrBox}>
                <QRCode value={paperQR} size={QR_SIZE} backgroundColor="#FFFFFF" color="#000000" />
              </View>
              <Text selectable={false} style={[styles.body, { fontFamily: 'Courier', letterSpacing: 1 }]}>
                {(paperHex.match(/.{1,4}/g) || []).join(' ')}
              </Text>
              <Text style={[styles.body, { marginTop: 10 }]}>To prove you saved it, type its LAST 6 characters:</Text>
              <TextInput value={paperCheck} onChangeText={(t) => setPaperCheck(t.trim().toLowerCase())} autoCapitalize="none" autoCorrect={false}
                style={[styles.input || {}, { borderWidth: 1, borderColor: '#999', borderRadius: 8, padding: 8, minWidth: 140, textAlign: 'center' }]} />
              <TouchableOpacity
                style={[styles.primaryBtn, paperCheck !== paperHex.slice(-6) && styles.btnDisabled]}
                disabled={paperCheck !== paperHex.slice(-6)}
                onPress={() => { setPaperQR(''); setPaperHex(''); setPaperCheck(''); setStep('confirm'); }}>
                <Text style={styles.primaryBtnText}>I saved it on paper → Continue</Text>
              </TouchableOpacity>
              <Text style={styles.errSmall}>If you lose this paper AND this phone's key, the vault funds are lost.</Text>
            </ScrollView>
          ) : null}

          {/* STEP: restore paper vault - KV_PAPER_COSIGN */}
          {step === 'restorePaper' && (
            <ScrollView contentContainerStyle={styles.center}>
              <Text style={styles.stepTitle}>Restore paper vault</Text>
              <Text style={styles.body}>
                First restore your wallet from its seed on this phone. Then scan the cosign QR on your paper. The vault is rebuilt from both - the paper key is NOT saved.
                Use only this screen, never your phone's camera app.
              </Text>
              {_cam?.CameraView && camGranted ? (
                <View style={{ width: '100%', height: 260, borderRadius: 12, overflow: 'hidden', marginVertical: 10 }}>
                  <_cam.CameraView style={{ flex: 1 }} barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    onBarcodeScanned={(e: any) => { const d = String(e?.data || ''); if (d.startsWith('KVCK1|')) handleRestorePaper(d); }} />
                </View>
              ) : null}
              <TextInput value={pasteBuf} onChangeText={setPasteBuf} placeholder="or paste the KVCK1|… text" placeholderTextColor="#78716C" autoCapitalize="none" autoCorrect={false} secureTextEntry style={styles.input} />
              <TouchableOpacity style={styles.primaryBtn} onPress={() => handleRestorePaper(pasteBuf)}>
                <Text style={styles.primaryBtnText}>Rebuild vault</Text>
              </TouchableOpacity>
              {error && <Text style={styles.errSmall}>{error}</Text>}
            </ScrollView>
          )}

          {/* STEP: exchange */}
          {step === 'exchange' && (
            <ScrollView contentContainerStyle={styles.center}>
              {myQR ? (
                <>
                  <Text style={styles.stepTitle}>1 · Show this to the other device</Text>
                  <View style={styles.qrBox}>
                    <QRCode value={myQR} size={QR_SIZE} backgroundColor="#FFFFFF" color="#000000" />
                  </View>
                  <TouchableOpacity
                    style={styles.smallBtn}
                    onPress={async () => { await Clipboard.setStringAsync(myQR); Alert.alert('Copied', 'Setup payload copied (paste fallback).'); }}
                  >
                    <Text style={styles.smallBtnText}>Copy as text</Text>
                  </TouchableOpacity>
                  {waitingForCreatorScan && (
                    <>
                      <Text style={[styles.body, { marginTop: 12 }]}>
                        Let the other device scan this QR, then tap Continue.
                      </Text>
                      <TouchableOpacity
                        style={styles.primaryBtn}
                        onPress={() => setWaitingForCreatorScan(false)}
                      >
                        <Text style={styles.primaryBtnText}>They scanned it → Continue</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </>
              ) : (
                <Text style={styles.stepTitle}>Scan the creating device first</Text>
              )}

              {!waitingForCreatorScan && (
                <>
                  <Text style={[styles.stepTitle, { marginTop: 16 }]}>2 · Scan the other device</Text>
                  {CameraView && camGranted ? (
                    <View style={styles.cameraBox}>
                      <CameraView
                        style={{ flex: 1 }}
                        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                        onBarcodeScanned={(e: any) => { if (e?.data) processSetupPayload(String(e.data)); }}
                      />
                    </View>
                  ) : (
                    <Text style={styles.dimText}>
                      {CameraView ? 'Camera permission denied — use paste fallback.' : 'Camera module not installed — use paste fallback.'}
                    </Text>
                  )}
                  {theirPubkey !== '' && <Text style={styles.okSmall}>✓ Other device's key received</Text>}
                  {error && <Text style={styles.errSmall}>{error}</Text>}

                  <Text style={[styles.label, { marginTop: 12 }]}>Paste fallback</Text>
                  <TextInput
                    style={[styles.input, { minHeight: 50 }]}
                    value={pasteBuf} onChangeText={setPasteBuf}
                    placeholder='{"type":"kvv_setup"…}' placeholderTextColor="#78716c"
                    multiline autoCapitalize="none" autoCorrect={false}
                  />
                  <TouchableOpacity style={styles.smallBtn} onPress={handlePaste}>
                    <Text style={styles.smallBtnText}>Feed pasted payload</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity style={styles.abortBtn} onPress={() => { reset(); setStep('start'); }}>
                <Text style={styles.abortBtnText}>Start over</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* STEP: confirm */}
          {step === 'confirm' && vault && (
            <ScrollView contentContainerStyle={styles.center}>
              <Text style={styles.stepTitle}>Compare codes OUT LOUD</Text>
              <View style={styles.codeBox}>
                <Text style={styles.codeText}>{vault.verificationCode}</Text>
              </View>
              <Text style={styles.body}>
                Both devices must show this EXACT code. If they differ, someone
                tampered with the exchange — do NOT save.
              </Text>
              <View style={styles.confirmCard}>
                <Text style={styles.confirmLabel}>Vault address</Text>
                <Text style={styles.confirmValue}>{vault.address}</Text>
                <Text style={styles.confirmLabel}>Vault ID</Text>
                <Text style={styles.confirmValue}>{vault.vaultId}</Text>
              </View>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleSave}>
                <Text style={styles.primaryBtnText}>Codes match → Save vault</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.abortBtn} onPress={() => { reset(); setStep('start'); }}>
                <Text style={styles.abortBtnText}>Codes differ — abort</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* STEP: saving */}
          {step === 'saving' && (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#F5C542" />
            </View>
          )}

          {/* STEP: done */}
          {step === 'done' && vault && (
            <View style={styles.center}>
              <Text style={styles.successTitle}>✓ Vault saved on this device</Text>
              <Text style={styles.body}>
                Save it on the OTHER device too (same button there). Fund the vault
                with the Send-to "FROST Vault" chip. Every spend will need both devices.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={onClose}>
                <Text style={styles.primaryBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STEP: error */}
          {step === 'error' && (
            <View style={styles.center}>
              <Text style={styles.errorTitle}>Failed</Text>
              <Text style={styles.errSmall}>{error}</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => { reset(); setStep('start'); }}>
                <Text style={styles.primaryBtnText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#0C0A09', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%', minHeight: '70%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#292524' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#F5F5F4' },
  closeX: { fontSize: 20, color: '#A8A29E', padding: 4 },
  center: { padding: 18, alignItems: 'center' },
  body: { fontSize: 13, color: '#A8A29E', lineHeight: 19, textAlign: 'center', marginVertical: 10 },
  label: { fontSize: 12, fontWeight: '700', color: '#D6D3D1', marginBottom: 6, alignSelf: 'flex-start' },
  input: { width: '100%', backgroundColor: '#1C1917', borderWidth: 1, borderColor: '#44403C', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 12, fontFamily: 'Courier', color: '#F5F5F4', marginBottom: 8 },
  infoBox: { width: '100%', backgroundColor: '#292018', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#78350F', marginVertical: 12 },
  infoText: { fontSize: 12, color: '#FCD34D', lineHeight: 18 },
  primaryBtn: { width: '100%', backgroundColor: '#F5C542', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 12 },
  primaryBtnText: { fontSize: 15, fontWeight: '800', color: '#0C0A09' },
  secondaryBtn: { width: '100%', backgroundColor: '#292524', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 10 },
  secondaryBtnText: { fontSize: 15, fontWeight: '700', color: '#D6D3D1' },
  btnDisabled: { opacity: 0.4 },
  smallBtn: { backgroundColor: '#292524', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', marginTop: 8 },
  smallBtnText: { fontSize: 13, color: '#D6D3D1', fontWeight: '600' },
  abortBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 6 },
  abortBtnText: { fontSize: 13, color: '#EF4444' },
  stepTitle: { fontSize: 15, fontWeight: '700', color: '#F5F5F4', marginBottom: 10 },
  qrBox: { backgroundColor: '#FFFFFF', padding: 12, borderRadius: 12 },
  cameraBox: { width: QR_SIZE, height: QR_SIZE, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1C1917' },
  dimText: { fontSize: 12, color: '#78716C', textAlign: 'center', paddingHorizontal: 20 },
  okSmall: { fontSize: 12, color: '#4ADE80', marginTop: 6 },
  errSmall: { fontSize: 12, color: '#EF4444', marginTop: 6, textAlign: 'center' },
  successTitle: { fontSize: 18, fontWeight: '900', color: '#4ADE80', marginBottom: 8 },
  errorTitle: { fontSize: 18, fontWeight: '900', color: '#EF4444', marginBottom: 6 },
  codeBox: { backgroundColor: '#14532D', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, marginVertical: 8 },
  codeText: { fontSize: 26, fontWeight: '900', color: '#BBF7D0', fontFamily: 'Courier', letterSpacing: 2 },
  confirmCard: { width: '100%', backgroundColor: '#1C1917', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#44403C', marginTop: 8 },
  confirmLabel: { fontSize: 10, color: '#A8A29E', marginTop: 8 },
  confirmValue: { fontSize: 11, color: '#F5F5F4', fontFamily: 'Courier' },
});

export default VaultSetupScreen;
