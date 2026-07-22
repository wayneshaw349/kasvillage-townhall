// ============================================================================
// VaultCosignScreen.tsx — COLD DEVICE side of the FROST 2-QR vault spend
// ============================================================================
// Flow: scan QR#1 frames from the phone (camera or paste) -> verify against
// THIS device's stored vault -> display recipient/amount/change/fee -> HUMAN
// confirms -> vaultCosignTemplate (k born and dies inside the call) -> show
// response frames for the phone to scan back.
//
// This device receives nothing from the spend. Its safety comes from:
//   (a) every input must be THIS vault's escrow script (L-guard throws),
//   (b) outputs must be pure P2PK, no inflation, sane fee, no lockTime,
//   (c) the human reading the recipient + amount on THIS screen.
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
  vaultVerifySpendTemplate,
  vaultCosignTemplate,
  responseToQRFrames,
  QrAssembler,
  parseAssembledTemplate,
} from './frost_qr_signer';
import { deriveAddress } from './canonical_agreement_steps';
import type { TxTemplate } from './canonical_agreement_steps';

declare const require: any; // Metro provides this at runtime; type-only declaration
let _cam: any = null;
try { _cam = require('expo-camera'); } catch {}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const QR_SIZE = Math.min(SCREEN_WIDTH - 80, 300);
const FRAME_INTERVAL_MS = 700;

/** P2PK script '20'+x+'ac' -> kaspa address for human display. */
function scriptToAddress(script: string, network: VaultInfo['network']): string {
  if (script.length === 68 && script.startsWith('20') && script.endsWith('ac')) {
    try { return deriveAddress(script.slice(2, 66), network); } catch {}
  }
  return '(non-P2PK script)';
}

type Step = 'scan' | 'confirm' | 'signing' | 'show' | 'error';

export interface VaultCosignScreenProps {
  visible: boolean;
  onClose: () => void;
  vault: VaultInfo;
  /** Returns THIS (cold) device's private key hex. */
  getPrivateKeyHex: () => Promise<string>;
}

export const VaultCosignScreen: React.FC<VaultCosignScreenProps> = ({
  visible, onClose, vault, getPrivateKeyHex,
}) => {
  const [step, setStep] = useState<Step>('scan');
  const [error, setError] = useState<string | null>(null);
  const [scanHave, setScanHave] = useState(0);
  const [scanTotal, setScanTotal] = useState(0);
  const [pasteBuf, setPasteBuf] = useState('');
  const [camGranted, setCamGranted] = useState(false);

  const [display, setDisplay] = useState<{
    recipient: string; amountKas: string; changeKas: string; feeKas: string; inputs: number; selfSweep: boolean;
  } | null>(null);
  const [frames, setFrames] = useState<string[]>([]);
  const [frameIdx, setFrameIdx] = useState(0);

  const templateRef = useRef<TxTemplate | null>(null);
  const assemblerRef = useRef(new QrAssembler());
  const busyRef = useRef(false);

  const reset = useCallback(() => {
    templateRef.current = null;
    assemblerRef.current.reset();
    setScanHave(0); setScanTotal(0); setPasteBuf('');
    setDisplay(null); setFrames([]); setFrameIdx(0); setError(null);
  }, []);

  useEffect(() => {
    if (visible) { setStep('scan'); reset(); }
    else reset();
    return () => reset();
  }, [visible, reset]);

  useEffect(() => {
    if (step !== 'scan' || !_cam?.Camera?.requestCameraPermissionsAsync) return;
    _cam.Camera.requestCameraPermissionsAsync()
      .then((r: any) => setCamGranted(r?.status === 'granted'))
      .catch(() => setCamGranted(false));
  }, [step]);

  useEffect(() => {
    if (step !== 'show' || frames.length <= 1) return;
    const id = setInterval(() => setFrameIdx((i) => (i + 1) % frames.length), FRAME_INTERVAL_MS);
    return () => clearInterval(id);
  }, [step, frames.length]);

  const fmt = (s: bigint) => (Number(s) / 1e8).toFixed(4);

  // -------------------------------------------------------------------------
  // Assemble template -> verify -> confirm screen
  // -------------------------------------------------------------------------
  const onTemplateAssembled = useCallback((payloadB64: string) => {
    const template = parseAssembledTemplate(payloadB64);
    if (!template) { setError('Invalid template payload'); return; }
    const v = vaultVerifySpendTemplate(template, vault);
    if (!v.valid) { setError(v.error || 'Template rejected'); setStep('error'); return; }

    templateRef.current = template;
    const selfSweep = v.recipientScript === vault.escrowScript;
    setDisplay({
      recipient: selfSweep ? vault.address + ' (this vault — consolidation)' : scriptToAddress(v.recipientScript!, vault.network),
      amountKas: fmt(v.amountSompi!),
      changeKas: fmt(v.changeSompi!),
      feeKas: fmt(v.feeSompi!),
      inputs: template.u.length,
      selfSweep,
    });
    setStep('confirm');
  }, [vault]);

  const feedFrame = useCallback((data: string) => {
    const r = assemblerRef.current.feed(data.trim());
    if (r.error && r.error !== 'Not a KVQ1 frame') { setError(r.error); return; }
    setScanHave(r.have); setScanTotal(r.total);
    if (r.payloadB64 && r.kind === 'T') onTemplateAssembled(r.payloadB64);
  }, [onTemplateAssembled]);

  const handlePasteFrames = async () => {
    const text = pasteBuf.trim() || (await Clipboard.getStringAsync()).trim();
    if (!text) return;
    for (const piece of text.split(/\s+/)) {
      if (piece.startsWith('KVQ1|')) feedFrame(piece);
    }
    setPasteBuf('');
  };

  // -------------------------------------------------------------------------
  // Human confirmed -> sign (k born and dies inside vaultCosignTemplate)
  // -------------------------------------------------------------------------
  const handleSign = async () => {
    if (busyRef.current || !templateRef.current) return;
    busyRef.current = true;
    setStep('signing'); setError(null);
    try {
      const priv = await getPrivateKeyHex();
      const co = vaultCosignTemplate({ privateKeyHex: priv, vault, template: templateRef.current });
      if ('error' in co) throw new Error(co.error);
      const fs = responseToQRFrames(co.responseB64);
      setFrames(fs.frames);
      setFrameIdx(0);
      setStep('show');
    } catch (e: any) {
      setError(e?.message || 'Signing failed');
      setStep('error');
    } finally { busyRef.current = false; }
  };

  const CameraView = _cam?.CameraView;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>🧊 Vault Co-Sign</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}>
              <Text style={styles.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.vaultBar}>
            <Text style={styles.vaultAddr} numberOfLines={1}>{vault.address}</Text>
            <Text style={styles.verifyCode}>verify: {vault.verificationCode}</Text>
          </View>

          {/* STEP: scan QR#1 */}
          {step === 'scan' && (
            <ScrollView contentContainerStyle={styles.center}>
              <Text style={styles.stepTitle}>Scan the phone's spend request</Text>
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
              {scanTotal > 0 && <Text style={styles.frameCounter}>frames {scanHave} / {scanTotal}</Text>}
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
            </ScrollView>
          )}

          {/* STEP: confirm (THE human gate) */}
          {step === 'confirm' && display && (
            <ScrollView contentContainerStyle={styles.center}>
              <Text style={styles.stepTitle}>Confirm this payment</Text>
              <View style={styles.confirmCard}>
                <Text style={styles.confirmLabel}>Pay to</Text>
                <Text style={[styles.confirmValue, display.selfSweep && { color: '#4ADE80' }]}>{display.recipient}</Text>
                <Text style={styles.confirmLabel}>Amount</Text>
                <Text style={styles.confirmAmount}>{display.amountKas} KAS</Text>
                <Text style={styles.confirmLabel}>Change back to vault</Text>
                <Text style={styles.confirmValue}>{display.changeKas} KAS</Text>
                <Text style={styles.confirmLabel}>Fee</Text>
                <Text style={styles.confirmValue}>{display.feeKas} KAS</Text>
                <Text style={styles.confirmLabel}>Inputs spent</Text>
                <Text style={styles.confirmValue}>{display.inputs}</Text>
              </View>
              <View style={styles.warnBox}>
                <Text style={styles.warnText}>
                  Read the recipient address CAREFULLY. Signing authorizes this exact
                  payment. Nothing is broadcast from this device.
                </Text>
              </View>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleSign}>
                <Text style={styles.primaryBtnText}>Approve & Sign</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.abortBtn} onPress={() => { reset(); setStep('scan'); }}>
                <Text style={styles.abortBtnText}>Reject</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* STEP: signing */}
          {step === 'signing' && (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#F5C542" />
              <Text style={styles.statusText}>Signing (nonces are destroyed immediately)…</Text>
            </View>
          )}

          {/* STEP: show response frames */}
          {step === 'show' && frames.length > 0 && (
            <View style={styles.center}>
              <Text style={styles.stepTitle}>Scan back with the phone</Text>
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
              <TouchableOpacity style={styles.primaryBtn} onPress={() => { reset(); onClose(); }}>
                <Text style={styles.primaryBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STEP: error */}
          {step === 'error' && (
            <View style={styles.center}>
              <Text style={styles.errorTitle}>Rejected</Text>
              <Text style={styles.errSmall}>{error}</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => { reset(); setStep('scan'); }}>
                <Text style={styles.primaryBtnText}>Scan Again</Text>
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

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#0C0A09', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%', minHeight: '70%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#292524' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#F5F5F4' },
  closeX: { fontSize: 20, color: '#A8A29E', padding: 4 },
  vaultBar: { paddingHorizontal: 18, paddingVertical: 8, backgroundColor: '#1C1917' },
  vaultAddr: { fontSize: 10, color: '#78716C', fontFamily: 'Courier' },
  verifyCode: { fontSize: 10, color: '#4ADE80', fontFamily: 'Courier', marginTop: 2 },
  center: { padding: 18, alignItems: 'center' },
  label: { fontSize: 12, fontWeight: '700', color: '#D6D3D1', marginBottom: 6, alignSelf: 'flex-start' },
  input: { width: '100%', backgroundColor: '#1C1917', borderWidth: 1, borderColor: '#44403C', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 13, fontFamily: 'Courier', color: '#F5F5F4', marginBottom: 8 },
  primaryBtn: { width: '100%', backgroundColor: '#F5C542', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 12 },
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
  errorTitle: { fontSize: 18, fontWeight: '900', color: '#EF4444', marginBottom: 6 },
  errSmall: { fontSize: 12, color: '#EF4444', marginTop: 4, textAlign: 'center' },
  confirmCard: { width: '100%', backgroundColor: '#1C1917', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#44403C' },
  confirmLabel: { fontSize: 10, color: '#A8A29E', marginTop: 10 },
  confirmValue: { fontSize: 12, color: '#F5F5F4', fontFamily: 'Courier' },
  confirmAmount: { fontSize: 24, fontWeight: '900', color: '#F5C542' },
  warnBox: { width: '100%', backgroundColor: '#292018', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#78350F', marginTop: 14 },
  warnText: { fontSize: 12, color: '#FCD34D', lineHeight: 18 },
});

export default VaultCosignScreen;
