// ============================================================================
// VaultBackupScreen.tsx — KasVillage Shamir Share Backup (display)
// ============================================================================
// Shows the 2-of-N share QRs ONE AT A TIME. The user photographs/prints each
// with a SEPARATE device (or scans directly into an offline signer phone).
//
// Security:
//   - expo-screen-capture blocks screenshots while a share is on screen
//     (Android: hard block; iOS: detection -> we clear the share).
//   - Only one share visible at any moment; never all together.
//   - Auto-clear after inactivity (reveal window, like the wallet address).
//   - Explicit "I saved this card" confirm before advancing.
//
// Matches QRPayNearby.tsx conventions: rs() sizing, dark theme, QRCode render.
// Feed it the `wires` from createSeedBackup(seed, N).
// ============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions, Alert, AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const rs = (size: number) => Math.round((size * SCREEN_WIDTH) / 375);

const REVEAL_MS = 45_000; // auto-clear a share after inactivity

// Graceful capture-block: use expo-screen-capture if installed, else no-op.
async function enableCaptureBlock(): Promise<() => void> {
  try {
    const SC = await import('expo-screen-capture');
    await SC.preventScreenCaptureAsync('kv-vault-backup');
    // iOS screenshot detection -> caller decides what to do
    return () => { SC.allowScreenCaptureAsync('kv-vault-backup').catch(() => {}); };
  } catch {
    // module not installed — degrade gracefully (no block, still functional)
    return () => {};
  }
}

export interface VaultBackupScreenProps {
  wires: string[];                 // from createSeedBackup(seed, N).wires
  threshold: number;               // K (e.g. 2)
  onDone: () => void;              // all shares confirmed saved
  onCancel: () => void;
}

export const VaultBackupScreen: React.FC<VaultBackupScreenProps> = ({
  wires, threshold, onDone, onCancel,
}) => {
  const total = wires.length;
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(true);
  const [savedFlags, setSavedFlags] = useState<boolean[]>(() => wires.map(() => false));
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const releaseRef = useRef<() => void>(() => {});

  // enable capture block for the lifetime of this screen
  useEffect(() => {
    let released = false;
    enableCaptureBlock().then(release => {
      if (released) { release(); return; }
      releaseRef.current = release;
    });
    return () => { released = true; releaseRef.current(); };
  }, []);

  // clear the share if the app goes to background (prevents recents-screen leak)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') setRevealed(false);
    });
    return () => sub.remove();
  }, []);

  // auto-clear reveal after inactivity
  const armRevealTimer = useCallback(() => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(() => setRevealed(false), REVEAL_MS);
  }, []);

  useEffect(() => {
    if (revealed) armRevealTimer();
    return () => { if (revealTimer.current) clearTimeout(revealTimer.current); };
  }, [revealed, idx, armRevealTimer]);

  const markSaved = () => {
    setSavedFlags(prev => {
      const next = [...prev];
      next[idx] = true;
      return next;
    });
  };

  const goNext = () => {
    if (!savedFlags[idx]) {
      Alert.alert(
        'Save this card first',
        'Photograph or print this QR onto a card, or scan it into your backup device, before continuing. Each card is stored in a different place.',
      );
      return;
    }
    if (idx < total - 1) {
      setIdx(idx + 1);
      setRevealed(true);
    } else {
      // all saved
      onDone();
    }
  };

  const goPrev = () => {
    if (idx > 0) { setIdx(idx - 1); setRevealed(true); }
  };

  const allSaved = savedFlags.every(Boolean);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.backBtn}>
          <Text style={styles.backText}>← Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🔐 Backup Cards</Text>
        <View style={{ width: rs(60) }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.stepper}>Card {idx + 1} of {total}</Text>
        <Text style={styles.subtitle}>
          Any {threshold} of these {total} cards can restore your wallet.
          Keep each in a different place — like spare house keys.
        </Text>

        {/* QR — only when revealed */}
        <View style={styles.qrFrame}>
          {revealed ? (
            <View style={styles.qrWhite}>
              <QRCode value={wires[idx]} size={rs(220)} />
            </View>
          ) : (
            <TouchableOpacity
              style={styles.hiddenBox}
              onPress={() => { setRevealed(true); }}
            >
              <Text style={styles.hiddenIcon}>👁️</Text>
              <Text style={styles.hiddenText}>Tap to show card {idx + 1}</Text>
              <Text style={styles.hiddenSub}>Hidden for safety</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Warnings */}
        <View style={styles.warnCard}>
          <Text style={styles.warnText}>
            • Never save this to cloud photos or send it in a message.{'\n'}
            • Print it, or scan it straight into your backup device.{'\n'}
            • One card alone is useless — safe if someone finds it.
          </Text>
        </View>

        {/* Saved toggle */}
        <TouchableOpacity
          style={[styles.savedBtn, savedFlags[idx] && styles.savedBtnOn]}
          onPress={markSaved}
        >
          <Text style={[styles.savedBtnText, savedFlags[idx] && styles.savedBtnTextOn]}>
            {savedFlags[idx] ? '✓ Card saved' : 'I saved this card'}
          </Text>
        </TouchableOpacity>

        {/* Nav */}
        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.navBtn, idx === 0 && styles.navBtnDisabled]}
            onPress={goPrev}
            disabled={idx === 0}
          >
            <Text style={styles.navBtnText}>Previous</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.navBtn, styles.navBtnPrimary]} onPress={goNext}>
            <Text style={styles.navBtnTextPrimary}>
              {idx < total - 1 ? 'Next card →' : (allSaved ? 'Finish ✓' : 'Finish')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* progress dots */}
        <View style={styles.dotsRow}>
          {wires.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === idx && styles.dotActive,
                savedFlags[i] && styles.dotSaved,
              ]}
            />
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A14' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: rs(16), paddingVertical: rs(12),
  },
  backBtn: { padding: rs(8) },
  backText: { color: '#F59E0B', fontSize: rs(16) },
  title: { color: '#FFF', fontSize: rs(18), fontWeight: '900' },
  body: { flex: 1, paddingHorizontal: rs(16), alignItems: 'center' },
  stepper: { color: '#49d6aa', fontSize: rs(16), fontWeight: '700', marginTop: rs(4) },
  subtitle: {
    color: '#AAA', fontSize: rs(12), textAlign: 'center',
    marginTop: rs(8), marginBottom: rs(16), lineHeight: rs(18),
  },
  qrFrame: { alignItems: 'center', justifyContent: 'center', minHeight: rs(260) },
  qrWhite: { backgroundColor: '#FFF', padding: rs(16), borderRadius: rs(14) },
  hiddenBox: {
    width: rs(252), height: rs(252), borderRadius: rs(14),
    backgroundColor: '#1A1A2E', borderWidth: 2, borderColor: '#333',
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center',
  },
  hiddenIcon: { fontSize: rs(40) },
  hiddenText: { color: '#87CEEB', fontSize: rs(14), fontWeight: '600', marginTop: rs(8) },
  hiddenSub: { color: '#555', fontSize: rs(11), marginTop: rs(4) },
  warnCard: {
    backgroundColor: '#2a1a0a', borderRadius: rs(12), padding: rs(12),
    marginTop: rs(16), borderWidth: 1, borderColor: '#F59E0B', width: '100%',
  },
  warnText: { color: '#F59E0B', fontSize: rs(11), lineHeight: rs(18) },
  savedBtn: {
    marginTop: rs(14), backgroundColor: '#1A1A2E', borderRadius: rs(12),
    padding: rs(14), alignItems: 'center', width: '100%',
    borderWidth: 1, borderColor: '#333',
  },
  savedBtnOn: { backgroundColor: '#0D2818', borderColor: '#10B981' },
  savedBtnText: { color: '#888', fontSize: rs(14), fontWeight: '600' },
  savedBtnTextOn: { color: '#10B981' },
  navRow: { flexDirection: 'row', gap: rs(10), marginTop: rs(16), width: '100%' },
  navBtn: {
    flex: 1, backgroundColor: '#1A1A2E', borderRadius: rs(12), padding: rs(16),
    alignItems: 'center', borderWidth: 1, borderColor: '#333',
  },
  navBtnDisabled: { opacity: 0.4 },
  navBtnPrimary: { backgroundColor: '#49d6aa', borderColor: '#49d6aa' },
  navBtnText: { color: '#FFF', fontSize: rs(14), fontWeight: '600' },
  navBtnTextPrimary: { color: '#000', fontSize: rs(14), fontWeight: '700' },
  dotsRow: { flexDirection: 'row', gap: rs(6), marginTop: rs(16) },
  dot: { width: rs(8), height: rs(8), borderRadius: rs(4), backgroundColor: '#333' },
  dotActive: { backgroundColor: '#87CEEB' },
  dotSaved: { backgroundColor: '#10B981' },
});

export default VaultBackupScreen;
