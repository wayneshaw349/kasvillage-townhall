// ============================================================================
// VaultRecoveryScreen.tsx — KasVillage Shamir Share Recovery (scan)
// ============================================================================
// Scans backup-card QRs one at a time. After `threshold` distinct, same-
// generation shares are scanned, reconstructs the mnemonic and hands it
// back via onRecovered(mnemonic) — the caller feeds it into wallet derivation
// (deriveKaspaHDKey) to restore the identical address.
//
// Camera pattern cloned from QRPayNearby.tsx (CameraView + useCameraPermissions,
// barcodeTypes:['qr'], onBarcodeScanned). Validation via decodeShare so a
// misread QR (checksum fail) is rejected, and stale/duplicate shares are caught.
// ============================================================================

import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { decodeShare } from './shamir_wire';
import { recoverAndVerify } from './vault_generator';
import type { ShamirShare } from './shamir';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const rs = (size: number) => Math.round((size * SCREEN_WIDTH) / 375);

export interface VaultRecoveryScreenProps {
  onRecovered: (mnemonic: string) => void;  // caller restores wallet from mnemonic
  onCancel: () => void;
}

export const VaultRecoveryScreen: React.FC<VaultRecoveryScreenProps> = ({
  onRecovered, onCancel,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [collected, setCollected] = useState<{ wire: string; share: ShamirShare }[]>([]);
  const [needed, setNeeded] = useState<number | null>(null);   // threshold, learned from first share
  const [gen, setGen] = useState<number | null>(null);
  const lastScanRef = useRef<number>(0);

  const reset = () => { setCollected([]); setNeeded(null); setGen(null); };

  const handleScan = useCallback(({ data }: { data: string }) => {
    // debounce repeated frames of the same code
    const now = Date.now();
    if (now - lastScanRef.current < 1200) return;
    lastScanRef.current = now;

    let share: ShamirShare;
    try {
      share = decodeShare(data);
    } catch (e: any) {
      Alert.alert('Not a backup card', e?.message || 'This QR is not a KasVillage backup card, or was misread. Try again.');
      return;
    }

    // first share sets the expected threshold + generation
    const curNeeded = needed ?? share.threshold;
    const curGen = gen ?? share.gen;

    if (share.gen !== curGen) {
      Alert.alert('Wrong card set', `This card is from a different backup (generation ${share.gen}, expected ${curGen}). Use cards from the same set.`);
      return;
    }

    // duplicate?
    if (collected.some(c => c.share.index === share.index)) {
      Alert.alert('Already scanned', `Card #${share.index} is already added. Scan a different card.`);
      return;
    }

    const next = [...collected, { wire: data, share }];
    setCollected(next);
    setNeeded(curNeeded);
    setGen(curGen);

    if (next.length >= curNeeded) {
      setScanning(false);
      (async () => {
        try {
          const restored = await recoverAndVerify(next.map(c => c.wire));
          const mnemonic = restored.mnemonic;
          Alert.alert(
            'Wallet restored ✓',
            `Recovered from ${next.length} cards. Your wallet address will be the same as before.`,
            [{ text: 'Continue', onPress: () => onRecovered(mnemonic) }],
          );
        } catch (e: any) {
          Alert.alert('Recovery failed', e?.message || 'Could not rebuild the wallet. Re-scan the cards.');
          reset();
        }
      })();
    }
  }, [collected, needed, gen, onRecovered]);

  // permission gate — same pattern as QRPayNearby
  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><Text style={styles.dim}>Checking camera…</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.backBtn}>
          <Text style={styles.backText}>← Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Restore Wallet</Text>
        <View style={{ width: rs(60) }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.subtitle}>
          Scan your backup cards. {needed
            ? `${collected.length} of ${needed} scanned.`
            : 'Scan the first card to begin.'}
        </Text>

        {/* collected chips */}
        {collected.length > 0 && (
          <View style={styles.chipsRow}>
            {collected.map(c => (
              <View key={c.share.index} style={styles.chip}>
                <Text style={styles.chipText}>Card #{c.share.index} ✓</Text>
              </View>
            ))}
          </View>
        )}

        {/* camera */}
        <View style={styles.cameraFrame}>
          {scanning && permission.granted ? (
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleScan}
            />
          ) : (
            <View style={styles.cameraOff}>
              <Text style={styles.cameraOffIcon}>📷</Text>
              <Text style={styles.dim}>
                {permission.granted ? 'Camera paused' : 'Camera permission needed'}
              </Text>
            </View>
          )}
          {/* scan reticle */}
          {scanning && <View style={styles.reticle} pointerEvents="none" />}
        </View>

        {/* controls */}
        {!permission.granted ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
            <Text style={styles.primaryBtnText}>Allow Camera</Text>
          </TouchableOpacity>
        ) : !scanning ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setScanning(true)}>
            <Text style={styles.primaryBtnText}>
              {collected.length ? 'Scan next card' : 'Start scanning'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setScanning(false)}>
            <Text style={styles.secondaryBtnText}>Pause</Text>
          </TouchableOpacity>
        )}

        {collected.length > 0 && (
          <TouchableOpacity style={styles.resetBtn} onPress={reset}>
            <Text style={styles.resetText}>Start over</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A14' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dim: { color: '#888', fontSize: rs(13) },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: rs(16), paddingVertical: rs(12),
  },
  backBtn: { padding: rs(8) },
  backText: { color: '#F59E0B', fontSize: rs(16) },
  title: { color: '#FFF', fontSize: rs(18), fontWeight: '900' },
  body: { flex: 1, paddingHorizontal: rs(16), alignItems: 'center' },
  subtitle: {
    color: '#AAA', fontSize: rs(13), textAlign: 'center',
    marginVertical: rs(12), lineHeight: rs(19),
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rs(8), marginBottom: rs(12), justifyContent: 'center' },
  chip: {
    backgroundColor: '#0D2818', borderRadius: rs(20), paddingHorizontal: rs(12),
    paddingVertical: rs(6), borderWidth: 1, borderColor: '#10B981',
  },
  chipText: { color: '#10B981', fontSize: rs(12), fontWeight: '600' },
  cameraFrame: {
    width: rs(280), height: rs(280), borderRadius: rs(16), overflow: 'hidden',
    backgroundColor: '#000', marginVertical: rs(12),
  },
  cameraOff: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cameraOffIcon: { fontSize: rs(44), marginBottom: rs(8) },
  reticle: {
    position: 'absolute', top: '15%', left: '15%', right: '15%', bottom: '15%',
    borderWidth: 2, borderColor: '#49d6aa', borderRadius: rs(12),
  },
  primaryBtn: {
    backgroundColor: '#49d6aa', borderRadius: rs(12), padding: rs(16),
    alignItems: 'center', width: '100%', marginTop: rs(8),
  },
  primaryBtnText: { color: '#000', fontSize: rs(15), fontWeight: '700' },
  secondaryBtn: {
    backgroundColor: '#1A1A2E', borderRadius: rs(12), padding: rs(16),
    alignItems: 'center', width: '100%', marginTop: rs(8),
    borderWidth: 1, borderColor: '#333',
  },
  secondaryBtnText: { color: '#FFF', fontSize: rs(15), fontWeight: '600' },
  resetBtn: { marginTop: rs(12), padding: rs(8) },
  resetText: { color: '#888', fontSize: rs(13), textDecorationLine: 'underline' },
});

export default VaultRecoveryScreen;
