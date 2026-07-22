// ============================================================================
// VaultQRSignScreen.tsx — PHONE side of the FROST 2-QR vault spend
// ============================================================================
// Flow: enter recipient+amount -> vaultBuildSpendTemplate -> animate QR#1
// frames (cold device scans) -> scan QR#2 frames back (camera, or paste
// fallback) -> vaultAggregate -> BIP340-verified -> broadcast.
//
// Nonce hygiene: nonces live in a ref for the ceremony ONLY and are wiped on
// aggregate, error, abort, and unmount. Abandoning mid-ceremony is safe — the
// cosigner's partials are useless without this device's k values.
//
// Camera is OPTIONAL: expo-camera is loaded via require-guard. If absent, the
// paste fallback (cold device shows frames -> user relays text) still works.
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet, Modal,
  ActivityIndicator, ScrollView, Alert, Dimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import {
  type VaultInfo,
  vaultBuildSpendTemplate,
  vaultAggregate,
  templateToQRFrames,
  QrAssembler,
  parseAssembledResponse,
} from './frost_qr_signer';
import type { FrostNonce, TxTemplate } from './canonical_agreement_steps';

// Camera is optional — require-guarded so the screen works without the dep.
declare const require: any; // Metro provides this at runtime; type-only declaration
let _cam: any = null;
try { _cam = require('expo-camera'); } catch {}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const QR_SIZE = Math.min(SCREEN_WIDTH - 80, 300);
const FRAME_INTERVAL_MS = 700;

const API_BASES: Record<string, string> = {
  'mainnet': 'https://api.kaspa.org',
  'testnet-10': 'https://api-tn10.kaspa.org',
  'testnet-11': 'https://api-tn11.kaspa.org',
};

// ---------------------------------------------------------------------------
// Local: kaspa address -> P2PK script (vault sends are P2PK-only)
// ---------------------------------------------------------------------------
function addressToP2pkScript(address: string): string | null {
  try {
    const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    const colonIdx = address.indexOf(':');
    if (colonIdx < 0) return null;
    const dataPart = address.slice(colonIdx + 1);
    const data5: number[] = [];
    for (const c of dataPart) { const v = CHARSET.indexOf(c); if (v < 0) return null; data5.push(v); }
    const payload5 = data5.slice(0, data5.length - 8);
    let bits = 0, acc = 0;
    const bytes: number[] = [];
    for (const v of payload5) { acc = (acc << 5) | v; bits += 5; while (bits >= 8) { bits -= 8; bytes.push((acc >> bits) & 0xff); acc &= (1 << bits) - 1; } }
    if (bytes[0] !== 0x00 || bytes.length < 33) return null; // P2PK only
    const xonly = bytes.slice(1, 33).map((b) => b.toString(16).padStart(2, '0')).join('');
    return '20' + xonly + 'ac';
  } catch { return null; }
}

function isValidKaspaAddr(a: string): boolean {
  return (a.startsWith('kaspa:') || a.startsWith('kaspatest:')) && addressToP2pkScript(a) !== null;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Step = 'input' | 'building' | 'show' | 'scan' | 'broadcast' | 'success' | 'error';

export interface VaultQRSignScreenProps {
  visible: boolean;
  onClose: () => void;
  vault: VaultInfo;
  /** Returns the PHONE's private key hex (from SecureStore). */
  getPrivateKeyHex: () => Promise<string>;
  onSuccess?: (txId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const VaultQRSignScreen: React.FC<VaultQRSignScreenProps> = ({
  visible, onClose, vault, getPrivateKeyHex, onSuccess,
}) => {
  const [step, setStep] = useState<Step>('input');
  const [recipient, setRecipient] = useState('');
  const [amountKas, setAmountKas] = useState('');
  const [balance, setBalance] = useState<bigint>(0n);
  const [error, setError] = useState<string | null>(null);
  const [txId, setTxId] = useState<string | null>(null);

  // Ceremony state — template is display-safe; nonces are SECRET (ref only)
  const [frames, setFrames] = useState<string[]>([]);
  const [frameIdx, setFrameIdx] = useState(0);
  const [scanHave, setScanHave] = useState(0);
  const [scanTotal, setScanTotal] = useState(0);
  const [pasteBuf, setPasteBuf] = useState('');
  const [camGranted, setCamGranted] = useState(false);

  const noncesRef = useRef<FrostNonce[] | null>(null);
  const templateRef = useRef<TxTemplate | null>(null);
  const assemblerRef = useRef(new QrAssembler());
  const busyRef = useRef(false);

  const wipeCeremony = useCallback(() => {
    // Overwrite secrets before dropping the reference
    if (noncesRef.current) {
      for (const n of noncesRef.current) { n.k = 0n; n.d_tweaked = 0n; }
    }
    noncesRef.current = null;
    templateRef.current = null;
    assemblerRef.current.reset();
    setFrames([]); setFrameIdx(0); setScanHave(0); setScanTotal(0); setPasteBuf('');
  }, []);

  // Reset on open/close; wipe secrets on close/unmount
  useEffect(() => {
    if (visible) {
      setStep('input'); setRecipient(''); setAmountKas('');
      setError(null); setTxId(null);
      wipeCeremony();
    } else {
      wipeCeremony();
    }
    return () => wipeCeremony();
  }, [visible, wipeCeremony]);

  // Vault balance
  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const resp = await fetch(API_BASES[vault.network] + '/addresses/' + vault.address + '/balance');
        if (resp.ok) { const d = await resp.json(); setBalance(BigInt(d.balance || '0')); }
      } catch {}
    })();
  }, [visible, vault]);

  // Frame animation while showing QR#1
  useEffect(() => {
    if (step !== 'show' || frames.length <= 1) return;
    const id = setInterval(() => setFrameIdx((i) => (i + 1) % frames.length), FRAME_INTERVAL_MS);
    return () => clearInterval(id);
  }, [step, frames.length]);

  // Camera permission when entering scan step
  useEffect(() => {
    if (step !== 'scan' || !_cam?.Camera?.requestCameraPermissionsAsync) return;
    _cam.Camera.requestCameraPermissionsAsync()
      .then((r: any) => setCamGranted(r?.status === 'granted'))
      .catch(() => setCamGranted(false));
  }, [step]);

  const amountSompi = (() => {
    const f = parseFloat(amountKas || '0');
    return Number.isFinite(f) && f > 0 ? BigInt(Math.floor(f * 1e8)) : 0n;
  })();
  const recipValid = isValidKaspaAddr(recipient.trim());
  const canBuild = recipValid && amountSompi > 0n && amountSompi < balance;

  // -------------------------------------------------------------------------
  // Step 1: build template -> QR#1 frames
  // -------------------------------------------------------------------------
  const handleBuild = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setStep('building'); setError(null);
    try {
      const recipScript = addressToP2pkScript(recipient.trim());
      if (!recipScript) throw new Error('Recipient must be a standard P2PK kaspa address');
      if (recipScript === vault.escrowScript) throw new Error('Recipient is the vault itself');

      const resp = await fetch(API_BASES[vault.network] + '/addresses/' + vault.address + '/utxos');
      if (!resp.ok) throw new Error('UTXO fetch failed: ' + resp.status);
      const raw = await resp.json();
      if (!raw || raw.length === 0) throw new Error('Vault has no UTXOs');
      const utxos = raw.map((u: any) => ({
        txId: u.outpoint.transactionId,
        index: u.outpoint.index,
        amount: u.utxoEntry.amount,
        scriptPubKey: u.utxoEntry.scriptPublicKey.scriptPublicKey,
      }));

      const priv = await getPrivateKeyHex();
      const built = vaultBuildSpendTemplate({
        vault, privateKeyHex: priv, utxos,
        recipientScript: recipScript, amountSompi,
      });
      if ('error' in built) throw new Error(built.error);

      noncesRef.current = built.nonces;          // SECRET — ref only
      templateRef.current = built.template;
      const fs = templateToQRFrames(built.templateB64);
      setFrames(fs.frames);
      setFrameIdx(0);
      setStep('show');
    } catch (e: any) {
      wipeCeremony();
      setError(e?.message || 'Failed to build spend');
      setStep('error');
    } finally { busyRef.current = false; }
  };

  // -------------------------------------------------------------------------
  // Step 3: receive QR#2 (camera or paste) -> aggregate -> broadcast
  // -------------------------------------------------------------------------
  const feedFrame = useCallback((data: string) => {
    const r = assemblerRef.current.feed(data.trim());
    if (r.error && r.error !== 'Not a KVQ1 frame') {
      // session mismatch / checksum — surface it
      setError(r.error);
      return;
    }
    setScanHave(r.have); setScanTotal(r.total);
    if (r.payloadB64 && r.kind === 'S') {
      completeCeremony(r.payloadB64);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePasteFrames = async () => {
    const text = pasteBuf.trim() || (await Clipboard.getStringAsync()).trim();
    if (!text) return;
    // Accept multiple frames separated by whitespace/newlines
    for (const piece of text.split(/\s+/)) {
      if (piece.startsWith('KVQ1|')) feedFrame(piece);
    }
    setPasteBuf('');
  };

  const completeCeremony = async (responseB64: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setStep('broadcast'); setError(null);
    try {
      const cosignerResponse = parseAssembledResponse(responseB64);
      if (!cosignerResponse) throw new Error('Invalid cosigner response');
      const nonces = noncesRef.current;
      const template = templateRef.current;
      if (!nonces || !template) throw new Error('Ceremony state lost — start again');

      const agg = vaultAggregate({ nonces, vault, template, cosignerResponse });
      if ('error' in agg) throw new Error(agg.error);

      // k values are consumed — destroy immediately, before broadcast
      wipeCeremony();

      const submitResp = await fetch(API_BASES[vault.network] + '/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agg.txBody),
      });
      if (!submitResp.ok) {
        const errText = await submitResp.text();
        throw new Error('L1 rejected: ' + errText);
      }
      const result = await submitResp.json();
      const id = result.transactionId || result.txId || '';
      setTxId(id);
      setStep('success');
      onSuccess?.(id);
    } catch (e: any) {
      wipeCeremony();
      setError(e?.message || 'Ceremony failed');
      setStep('error');
    } finally { busyRef.current = false; }
  };

  const handleAbort = () => {
    wipeCeremony();
    setStep('input');
  };

  const fmtKas = (s: bigint) => (Number(s) / 1e8).toFixed(4);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const CameraView = _cam?.CameraView;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>🔐 Vault Send (2-device)</Text>
            <TouchableOpacity onPress={() => { wipeCeremony(); onClose(); }}>
              <Text style={styles.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.balanceBar}>
            <Text style={styles.balanceLabel}>Vault</Text>
            <Text style={styles.balanceAmt}>{fmtKas(balance)} KAS</Text>
            <Text style={styles.balanceAddr} numberOfLines={1}>{vault.address}</Text>
            <Text style={styles.verifyCode}>verify: {vault.verificationCode}</Text>
          </View>

          {/* STEP: input */}
          {step === 'input' && (
            <ScrollView contentContainerStyle={styles.content}>
              <Text style={styles.label}>Send To (P2PK address)</Text>
              <TextInput
                style={[styles.input, recipient.length > 4 && (recipValid ? styles.inputOk : styles.inputBad)]}
                value={recipient} onChangeText={setRecipient}
                placeholder="kaspa:..." placeholderTextColor="#78716c"
                autoCapitalize="none" autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.pasteLink}
                onPress={async () => { const t = await Clipboard.getStringAsync(); if (t) setRecipient(t.trim()); }}
              >
                <Text style={styles.pasteLinkText}>Paste address</Text>
              </TouchableOpacity>

              <Text style={styles.label}>Amount (KAS)</Text>
              <TextInput
                style={styles.input}
                value={amountKas} onChangeText={setAmountKas}
                placeholder="0.00" placeholderTextColor="#78716c"
                keyboardType="decimal-pad"
              />
              {amountSompi > 0n && amountSompi >= balance && (
                <Text style={styles.errSmall}>Exceeds vault balance (fee needs headroom)</Text>
              )}

              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  This builds an unsigned transaction and shows it as looping QR frames.
                  Scan them with your co-signer device, confirm the payment there, then
                  scan its response back here. Change returns to the vault.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, !canBuild && styles.btnDisabled]}
                onPress={handleBuild} disabled={!canBuild}
              >
                <Text style={styles.primaryBtnText}>Build & Show QR</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* STEP: building */}
          {step === 'building' && (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#F5C542" />
              <Text style={styles.statusText}>Fetching vault UTXOs & building template…</Text>
            </View>
          )}

          {/* STEP: show QR#1 */}
          {step === 'show' && frames.length > 0 && (
            <View style={styles.center}>
              <Text style={styles.stepTitle}>Scan with co-signer device</Text>
              <View style={styles.qrBox}>
                <QRCode value={frames[frameIdx]} size={QR_SIZE} backgroundColor="#FFFFFF" color="#000000" />
              </View>
              <Text style={styles.frameCounter}>frame {frameIdx + 1} / {frames.length} (looping)</Text>
              <View style={styles.rowBtns}>
                <TouchableOpacity style={styles.smallBtn} onPress={() => setFrameIdx((i) => (i - 1 + frames.length) % frames.length)}>
                  <Text style={styles.smallBtnText}>◀ Prev</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.smallBtn} onPress={() => setFrameIdx((i) => (i + 1) % frames.length)}>
                  <Text style={styles.smallBtnText}>Next ▶</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.smallBtn}
                onPress={async () => { await Clipboard.setStringAsync(frames.join('\n')); Alert.alert('Copied', 'All ' + frames.length + ' frames copied (paste fallback).'); }}
              >
                <Text style={styles.smallBtnText}>Copy frames as text</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => { setError(null); setStep('scan'); }}>
                <Text style={styles.primaryBtnText}>Co-signer confirmed → Scan response</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.abortBtn} onPress={handleAbort}>
                <Text style={styles.abortBtnText}>Abort (destroys nonces)</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STEP: scan QR#2 */}
          {step === 'scan' && (
            <View style={styles.center}>
              <Text style={styles.stepTitle}>Scan co-signer's response</Text>
              {CameraView && camGranted ? (
                <View style={styles.cameraBox}>
                  <CameraView
                    style={{ flex: 1 }}
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    onBarcodeScanned={(e: any) => { if (e?.data) feedFrame(String(e.data)); }}
                  />
                </View>
              ) : (
                <Text style={styles.dimText}>
                  {CameraView ? 'Camera permission denied — use paste fallback below.' : 'Camera module not installed — use paste fallback below.'}
                </Text>
              )}
              {scanTotal > 0 && (
                <Text style={styles.frameCounter}>frames {scanHave} / {scanTotal}</Text>
              )}
              {error && <Text style={styles.errSmall}>{error}</Text>}

              <Text style={[styles.label, { marginTop: 14 }]}>Paste fallback (KVQ1 frames)</Text>
              <TextInput
                style={[styles.input, { minHeight: 60 }]}
                value={pasteBuf} onChangeText={setPasteBuf}
                placeholder="KVQ1|…" placeholderTextColor="#78716c"
                multiline autoCapitalize="none" autoCorrect={false}
              />
              <TouchableOpacity style={styles.smallBtn} onPress={handlePasteFrames}>
                <Text style={styles.smallBtnText}>Feed pasted frames</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.smallBtn} onPress={() => setStep('show')}>
                <Text style={styles.smallBtnText}>◀ Back to my QR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.abortBtn} onPress={handleAbort}>
                <Text style={styles.abortBtnText}>Abort (destroys nonces)</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STEP: broadcast */}
          {step === 'broadcast' && (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#F5C542" />
              <Text style={styles.statusText}>Aggregating, verifying BIP340, broadcasting…</Text>
            </View>
          )}

          {/* STEP: success */}
          {step === 'success' && txId && (
            <View style={styles.center}>
              <Text style={styles.successTitle}>✓ Sent from vault</Text>
              <Text style={styles.txIdText} numberOfLines={1}>{txId}</Text>
              <TouchableOpacity
                style={styles.smallBtn}
                onPress={() => { Clipboard.setStringAsync(txId); Alert.alert('Copied', 'TX ID copied'); }}
              >
                <Text style={styles.smallBtnText}>Copy TX ID</Text>
              </TouchableOpacity>
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
              <TouchableOpacity style={styles.primaryBtn} onPress={() => { setError(null); setStep('input'); }}>
                <Text style={styles.primaryBtnText}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.abortBtn} onPress={onClose}>
                <Text style={styles.abortBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Styles (dark vault theme to match GenerateVaultScreen)
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#0C0A09', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%', minHeight: '70%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#292524' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#F5F5F4' },
  closeX: { fontSize: 20, color: '#A8A29E', padding: 4 },
  balanceBar: { paddingHorizontal: 18, paddingVertical: 10, backgroundColor: '#1C1917' },
  balanceLabel: { fontSize: 11, color: '#A8A29E' },
  balanceAmt: { fontSize: 20, fontWeight: '800', color: '#F5C542' },
  balanceAddr: { fontSize: 10, color: '#78716C', fontFamily: 'Courier', marginTop: 2 },
  verifyCode: { fontSize: 10, color: '#4ADE80', fontFamily: 'Courier', marginTop: 2 },
  content: { padding: 18 },
  center: { padding: 18, alignItems: 'center' },
  label: { fontSize: 12, fontWeight: '700', color: '#D6D3D1', marginBottom: 6, alignSelf: 'flex-start' },
  input: { width: '100%', backgroundColor: '#1C1917', borderWidth: 1, borderColor: '#44403C', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 13, fontFamily: 'Courier', color: '#F5F5F4', marginBottom: 8 },
  inputOk: { borderColor: '#22C55E' },
  inputBad: { borderColor: '#EF4444' },
  pasteLink: { alignSelf: 'flex-end', marginBottom: 10 },
  pasteLinkText: { fontSize: 12, color: '#F5C542' },
  infoBox: { backgroundColor: '#292018', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#78350F', marginVertical: 14 },
  infoText: { fontSize: 12, color: '#FCD34D', lineHeight: 18 },
  primaryBtn: { width: '100%', backgroundColor: '#F5C542', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 12 },
  btnDisabled: { opacity: 0.4 },
  primaryBtnText: { fontSize: 15, fontWeight: '800', color: '#0C0A09' },
  smallBtn: { backgroundColor: '#292524', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', marginTop: 8 },
  smallBtnText: { fontSize: 13, color: '#D6D3D1', fontWeight: '600' },
  rowBtns: { flexDirection: 'row', gap: 10 },
  abortBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 6 },
  abortBtnText: { fontSize: 13, color: '#EF4444' },
  stepTitle: { fontSize: 15, fontWeight: '700', color: '#F5F5F4', marginBottom: 12 },
  qrBox: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 12 },
  frameCounter: { fontSize: 12, color: '#A8A29E', marginTop: 8, fontFamily: 'Courier' },
  cameraBox: { width: QR_SIZE, height: QR_SIZE, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1C1917' },
  dimText: { fontSize: 12, color: '#78716C', textAlign: 'center', paddingHorizontal: 20 },
  statusText: { fontSize: 13, color: '#A8A29E', marginTop: 14, textAlign: 'center' },
  successTitle: { fontSize: 20, fontWeight: '900', color: '#4ADE80', marginBottom: 8 },
  txIdText: { fontSize: 11, fontFamily: 'Courier', color: '#D6D3D1', paddingHorizontal: 20 },
  errorTitle: { fontSize: 18, fontWeight: '900', color: '#EF4444', marginBottom: 6 },
  errSmall: { fontSize: 12, color: '#EF4444', marginTop: 4, textAlign: 'center' },
});

export default VaultQRSignScreen;
