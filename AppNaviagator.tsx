// ============================================================================
// KASVILLAGE EXPO - APP NAVIGATOR (Root)
// ============================================================================
// Return Auth Flow: Biometric → 1 Quiz Question → Dashboard
// New User Flow: IdentityRitual (includes 5-question quiz at end)
// ============================================================================

import { onUtxoRefresh } from './wallet_merkle_archive';
import { uploadToIrys } from './arweave_upload';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

import { IdentityRitual, getReturnAuthQuestion, verifyReturnAuth } from './expo_identity_ritual';
import type { AvatarRecipe, QuizQuestion, ColorMix } from './expo_identity_ritual';
import { Dashboard } from './Dashboard';
import { SendKAS } from './SendKAS';
import { ReceiveScreen } from './ReceiveScreen';
import { SnailModeScreen } from './SnailModeScreen';
import { TownHallScreen } from './TownHallScreen';
import { TransactionHistory } from './TransactionHistory';
import { POBoxScreen } from './POBoxScreen';
import VillageMailbox from './VillageMailbox';
import { Workspace } from './Workspace';
import { useBluetoothPay, PayablePeer } from './bluetooth_p2p';
import { sendKASWithHybridSig } from './kasvillage_cold_wallet';
import { EntertainmentCenter } from './EntertainmentCenter';
import { ProfileScreen } from './ProfileScreen';
import TradeFiScreen from './TradeFiScreen';
import { NeighborAgreement } from './NeighborAgreement';
import {
  getUserStats,
  isInSnailMode,
  getCreationDelayMs,
} from './wallet_registration_v2';
import { startPriceFeed, subscribeToPriceUpdates, getKasPrice } from './kas_price_feed';
import { getBalance as getKaspaBalance, setNetwork } from './kaspa_unified';
import { getDeviceHash, getSerialHash } from './device_attestation';

// ============================================================================
// TYPES
// ============================================================================

type AppScreen =
  | 'booting'
  | 'onboarding'
  | 'biometric_gate'
  | 'quiz_gate'
  | 'dashboard'
  | 'send_kas'
  | 'receive_kas'
  | 'snail_mode'
  | 'kaspa_test'
  | 'town_hall'
  | 'mailbox'
  | 'workspace'
  | 'entertainment'
  | 'profile'
  | 'neighbor_agreement'
  | 'tx_history'
  | 'po_box'
  | 'bathroom'
  | 'pay_nearby';

interface SessionUser {
  apartment: string;
  xp: number;
  pubkey?: string;
  publicKey?: string;
  name?: string;
}

// ============================================================================
// STORE KEYS
// ============================================================================

const STORE_KEYS = {
  PRIVATE_KEY: 'kasvillage_private_key',
  PUBLIC_KEY:  'public_key',
  APT_ALIAS:   'apt_alias',
  IDENTITY:    'kv_citadel_identity',
  AVATAR_RECIPE: 'kv_avatar_recipe',
  COLOR_MIX_HISTORY: 'kv_color_mix_history',
};

// ============================================================================
// STYLES
// ============================================================================

const { width: W, height: H } = Dimensions.get('window');

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogo: {
    fontSize: W * 0.18,
  },
  loadingTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#49EACB',
    letterSpacing: 2,
    marginTop: 12,
  },
  // Quiz Gate styles
  quizGateContainer: {
    flex: 1,
    backgroundColor: '#1A1512',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  quizGateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#D4AF37',
    textAlign: 'center',
    marginBottom: 8,
  },
  quizGateSubtitle: {
    fontSize: 14,
    color: '#A89070',
    textAlign: 'center',
    marginBottom: 24,
  },
  quizCard: {
    backgroundColor: '#2A2520',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 2,
    borderColor: '#D4AF37',
  },
  quizQuestion: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 26,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    backgroundColor: '#3D3530',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#4A4035',
  },
  optionButtonSelected: {
    borderColor: '#D4AF37',
    backgroundColor: '#4A4035',
  },
  optionText: {
    fontSize: 16,
    color: '#FFF',
    textAlign: 'center',
  },
  colorOptionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  colorSwatch: {
    width: 50,
    height: 50,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorSwatchSelected: {
    borderColor: '#D4AF37',
  },
  submitButton: {
    backgroundColor: '#D4AF37',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#4A4035',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1512',
    textAlign: 'center',
  },
  feedbackCorrect: {
    backgroundColor: '#1B4332',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  feedbackWrong: {
    backgroundColor: '#4A1515',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  feedbackText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
  },
  lockoutContainer: {
    flex: 1,
    backgroundColor: '#1A1512',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  lockoutTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF4444',
    marginBottom: 16,
  },
  lockoutText: {
    fontSize: 16,
    color: '#A89070',
    textAlign: 'center',
    lineHeight: 24,
  },
});

// ============================================================================
// LOADING SCREEN
// ============================================================================

const LoadingScreen: React.FC = () => (
  <View style={styles.loading}>
    <Text style={styles.loadingLogo}>🏘️</Text>
    <Text style={styles.loadingTitle}>Da Village</Text>
    <ActivityIndicator size="large" color="#49EACB" style={{ marginTop: 24 }} />
  </View>
);

// ============================================================================
// BIOMETRIC GATE
// ============================================================================

const BiometricGate: React.FC<{ onSuccess: () => void; onFail: () => void }> = ({
  onSuccess,
  onFail,
}) => {
  useEffect(() => {
    (async () => {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled  = await LocalAuthentication.isEnrolledAsync();

        if (!hasHardware || !isEnrolled) { onSuccess(); return; }

        const result = await LocalAuthentication.authenticateAsync({
          promptMessage:         'Verify your identity to enter Da Village',
          fallbackLabel:         'Use Passcode',
          cancelLabel:           'Cancel',
          disableDeviceFallback: false,
        });

        result.success ? onSuccess() : onFail();
      } catch {
        onSuccess();
      }
    })();
  }, [onSuccess, onFail]);

  return <LoadingScreen />;
};

// ============================================================================
// QUIZ GATE - 1 Question from 50-Question Bank
// ============================================================================

interface QuizGateProps {
  onSuccess: () => void;
  onFail: () => void;
}

const QuizGate: React.FC<QuizGateProps> = ({ onSuccess, onFail }) => {
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lockout, setLockout] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  
  const MAX_ATTEMPTS = 3;
  const LOCKOUT_KEY = 'kv_quiz_lockout';
  const FAIL_COUNT_KEY = 'kv_quiz_fail_count';
  
  // Check for active lockout on mount
  useEffect(() => {
    checkLockout();
  }, []);
  
  const checkLockout = async () => {
    try {
      const lockoutUntilStr = await SecureStore.getItemAsync(LOCKOUT_KEY);
      const failCountStr = await SecureStore.getItemAsync(FAIL_COUNT_KEY);
      
      if (lockoutUntilStr) {
        const lockoutUntil = parseInt(lockoutUntilStr, 10);
        const now = Date.now();
        if (now < lockoutUntil) {
          // Still locked out
          setLockout(true);
          setLoading(false);
          const remaining = Math.ceil((lockoutUntil - now) / 1000);
          setLockoutRemaining(remaining);
          
          // Countdown timer
          const interval = setInterval(() => {
            const left = Math.ceil((lockoutUntil - Date.now()) / 1000);
            if (left <= 0) {
              clearInterval(interval);
              setLockout(false);
              setLockoutRemaining(0);
              setAttempts(0);
              loadQuestion();
            } else {
              setLockoutRemaining(left);
            }
          }, 1000);
          return;
        }
        // Lockout expired, clear it
        await SecureStore.deleteItemAsync(LOCKOUT_KEY);
      }
      
      loadQuestion();
    } catch {
      loadQuestion();
    }
  };
  
  // Exponential backoff: 30s, 2min, 10min, 1hr, 24hr
  const getLockoutDurationMs = async (): Promise<number> => {
    const failCountStr = await SecureStore.getItemAsync(FAIL_COUNT_KEY);
    const failCount = failCountStr ? parseInt(failCountStr, 10) : 0;
    const durations = [30_000, 120_000, 600_000, 3600_000, 86400_000];
    return durations[Math.min(failCount, durations.length - 1)];
  };
  
  const recordFailedSession = async () => {
    const failCountStr = await SecureStore.getItemAsync(FAIL_COUNT_KEY);
    const failCount = (failCountStr ? parseInt(failCountStr, 10) : 0) + 1;
    await SecureStore.setItemAsync(FAIL_COUNT_KEY, failCount.toString());
    
    const lockoutMs = await getLockoutDurationMs();
    const lockoutUntil = Date.now() + lockoutMs;
    await SecureStore.setItemAsync(LOCKOUT_KEY, lockoutUntil.toString());
    
    return lockoutMs;
  };
  
  const clearFailCount = async () => {
    await SecureStore.deleteItemAsync(FAIL_COUNT_KEY);
    await SecureStore.deleteItemAsync(LOCKOUT_KEY);
  };
  
  const loadQuestion = async () => {
    try {
      // Load stored avatar recipe and color mix history
      const recipeStr = await SecureStore.getItemAsync(STORE_KEYS.AVATAR_RECIPE);
      const mixHistoryStr = await SecureStore.getItemAsync(STORE_KEYS.COLOR_MIX_HISTORY);
      
      if (!recipeStr) {
        // No stored recipe, skip quiz
        onSuccess();
        return;
      }
      
      const recipe: AvatarRecipe = JSON.parse(recipeStr);
      const colorMixHistory: ColorMix[] = mixHistoryStr ? JSON.parse(mixHistoryStr) : [];
      
      // Get a random question from the 50-question bank
      const q = getReturnAuthQuestion(recipe, colorMixHistory);
      
      if (!q) {
        // No questions available, skip quiz
        onSuccess();
        return;
      }
      
      setQuestion(q);
      setLoading(false);
      
    } catch (err) {
      console.error('[QuizGate] Failed to load question:', err);
      onSuccess(); // Fail open if we can't load
    }
  };
  
  const handleSubmit = async () => {
    if (!question || !selectedAnswer) return;
    
    const isCorrect = verifyReturnAuth(question, selectedAnswer);
    
    if (isCorrect) {
      setFeedback('correct');
      await clearFailCount(); // Reset fail counter on success
      setTimeout(() => {
        onSuccess();
      }, 1000);
    } else {
      setFeedback('wrong');
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      
      if (newAttempts >= MAX_ATTEMPTS) {
        const lockoutMs = await recordFailedSession();
        const lockoutSecs = Math.ceil(lockoutMs / 1000);
        setLockoutRemaining(lockoutSecs);
        setTimeout(() => {
          setLockout(true);
        }, 1500);
      } else {
        setTimeout(() => {
          setFeedback(null);
          setSelectedAnswer(null);
          // Load a new question for retry
          loadQuestion();
        }, 1500);
      }
    }
  };
  
  if (lockout) {
    const formatTime = (secs: number): string => {
      if (secs >= 3600) return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
      if (secs >= 60) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
      return `${secs}s`;
    };
    
    return (
      <View style={styles.lockoutContainer}>
        <Text style={styles.lockoutTitle}>⚔️ Access Denied</Text>
        <Text style={styles.lockoutText}>
          Too many failed attempts.{'\n\n'}
          {lockoutRemaining > 0 
            ? `Try again in ${formatTime(lockoutRemaining)}`
            : 'Loading...'
          }
          {'\n\n'}
          If you've forgotten your avatar details,{'\n'}
          you may need to recover using your{'\n'}
          12-word recovery phrase.
        </Text>
        <TouchableOpacity 
          style={[styles.submitButton, { marginTop: 24 }]}
          onPress={onFail}
        >
          <Text style={styles.submitButtonText}>Go to Recovery</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  if (loading || !question) {
    return <LoadingScreen />;
  }
  
  const isColorQuestion = question.isVisual;
  
  return (
    <ScrollView 
      contentContainerStyle={styles.quizGateContainer}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.quizGateTitle}>⚔️ Sentry Checkpoint</Text>
      <Text style={styles.quizGateSubtitle}>
        The Sentry demands proof of identity.{'\n'}Answer correctly to enter the village.
      </Text>
      
      <View style={styles.quizCard}>
        <Text style={styles.quizQuestion}>{question.question}</Text>
        
        {isColorQuestion ? (
          // Color swatch grid
          <View style={styles.colorOptionRow}>
            {question.options.map((color, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: color },
                  selectedAnswer === color && styles.colorSwatchSelected,
                ]}
                onPress={() => setSelectedAnswer(color)}
              />
            ))}
          </View>
        ) : (
          // Text options - scrollable grid for 20 options
          <ScrollView style={{ maxHeight: 350 }} nestedScrollEnabled showsVerticalScrollIndicator>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, padding: 4 }}>
              {question.options.map((option, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    { backgroundColor: "#1A1A1A", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 2, borderColor: "#333", minWidth: "45%" as any, maxWidth: "100%" as any, flexShrink: 1 },
                    selectedAnswer === option && { borderColor: "#D4AF37", backgroundColor: "#2A2A1A" },
                  ]}
                  onPress={() => setSelectedAnswer(option)}
                >
                  <Text style={{ color: selectedAnswer === option ? "#D4AF37" : "#FFF", fontSize: 12 }} numberOfLines={3}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}
        
        <TouchableOpacity
          style={[
            styles.submitButton,
            !selectedAnswer && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!selectedAnswer || feedback !== null}
        >
          <Text style={styles.submitButtonText}>
            {feedback === null ? 'Confirm' : 'Verifying...'}
          </Text>
        </TouchableOpacity>
        
        {feedback === 'correct' && (
          <View style={styles.feedbackCorrect}>
            <Text style={styles.feedbackText}>✓ Correct! Entering village...</Text>
          </View>
        )}
        
        {feedback === 'wrong' && (
          <View style={styles.feedbackWrong}>
            <Text style={styles.feedbackText}>
              ✗ Incorrect ({MAX_ATTEMPTS - attempts} attempts left)
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

// ============================================================================
// ROOT APP NAVIGATOR
// ============================================================================

export const AppNavigator: React.FC = () => {
  const [screen, setScreen] = useState<AppScreen>('booting');
  const [user, setUser] = useState<SessionUser>({ apartment: '', xp: 0 });
  const [balance, setBalance] = useState(0);
  const [balanceSompi, setBalanceSompi] = useState(0n);
  const [inAgreementsSompi, setInAgreementsSompi] = useState(0n);
  const [iousOwedSompi, setIousOwedSompi] = useState(0n);
  const [iousOwedToYouSompi, setIousOwedToYouSompi] = useState(0n);
  const [agreementReturnsSompi, setAgreementReturnsSompi] = useState(0n);
  const [snailMode, setSnailMode] = useState(false);
  const [snailDelayMs, setSnailDelayMs] = useState(0);
  const [snailReason, setSnailReason] = useState('');
  const [snailPComplete, setSnailPComplete] = useState(0);
  const [snailDeadlocks, setSnailDeadlocks] = useState(0);

  // ------------------------------------------------------------------
  // Load stats helper
  // ------------------------------------------------------------------
  const loadUserStats = useCallback(async (aptAlias: string, publicKey: string) => {
    try {
      const [stats, snail] = await Promise.all([getUserStats(), isInSnailMode()]);
      setUser((prev) => ({ ...prev, xp: stats.xp }));
      setSnailMode(snail);
      
      if (snail) {
        const delayMs = await getCreationDelayMs();
        setSnailDelayMs(delayMs);
        const pComplete = (1 + stats.successes) / (2 + stats.successes + stats.deadlocks);
        setSnailPComplete(pComplete);
        setSnailDeadlocks(stats.deadlocks);
        setSnailReason(
          stats.xp < 150 
            ? `Low XP (${stats.xp} < 150)` 
            : `Low completion rate (${(pComplete * 100).toFixed(0)}% < 50%)`
        );
      }
    } catch { /* non-fatal */ }

    try {
      // Load active mode
        const savedMode = await SecureStore.getItemAsync('kaspa_active_mode');
        const mode = (savedMode === 'real') ? 'real' : 'tutorial';
        setActiveMode(mode);
        
        // Load address for current mode
        const tutorialAddr = await SecureStore.getItemAsync('kaspa_address_tutorial') || await SecureStore.getItemAsync('kaspa_address') || '';
        const realAddr = await SecureStore.getItemAsync('kaspa_address_real') || '';
        const kaspaAddr = mode === 'real' ? realAddr : tutorialAddr;
        
        // Save tutorial addr if migrating from old key
        if (tutorialAddr && !(await SecureStore.getItemAsync('kaspa_address_tutorial'))) {
          await SecureStore.setItemAsync('kaspa_address_tutorial', tutorialAddr);
        }
      if (kaspaAddr) {
        // Auto-detect network from address prefix
        const net = kaspaAddr.startsWith('kaspatest:') ? 'testnet-10' : 'mainnet';
        setNetwork(net);
        console.log('[AppNav] Network:', net, 'Address:', kaspaAddr.slice(0, 20) + '...');
        // Use REST API directly (wRPC fails in Expo Go)
        const apiBase = kaspaAddr.startsWith('kaspatest:') ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
        const balResp = await fetch(`${apiBase}/addresses/${kaspaAddr}/balance`);
        if (balResp.ok) {
          const balData = await balResp.json();
          const sompi = BigInt(balData.balance);
          console.log('[AppNav] Balance loaded:', sompi.toString(), 'sompi');
          // Fetch agreement data for financial summary
          try {
            const pubkey = await SecureStore.getItemAsync('kv_l1_pubkey');
            if (pubkey) {
              const agResp = await fetch('https://kasvillage.app.runonflux.io/api/agreements/proposed');
              if (agResp.ok) {
                const agreements = await agResp.json();
                let inAg = 0n;
                for (const a of (agreements.proposals || [])) {
                  if (a.amount_sompi) inAg += BigInt(a.amount_sompi);
                }
                setInAgreementsSompi(inAg);
              }
            }
          } catch (e) { /* TownHall unreachable */ }
          // Sync UTXO ledger � tags new receives as 'free' + update financial summary
          try {
            const { syncLedger } = await import('./utxo_ledger');
            const ledgerResult = await syncLedger(kaspaAddress);
            const committed = ledgerResult.committedBalance;
            const iouAlloc = ledgerResult.iouAllocated;
            if (committed > 0n) setInAgreementsSompi(committed);
            if (iouAlloc > 0n) setIousOwedSompi(iouAlloc);
          } catch {}
          // Merkle archive: snapshot only when balance CHANGES (new receive)
          if (sompi !== balanceSompi) {
            try {
              const utxoResp = await fetch(balUrl.replace('/balance', '/utxos'));
              if (utxoResp.ok) {
                const utxos = await utxoResp.json();
                onUtxoRefresh(utxos, 'testnet', async (data, tags) => {
                  const r = await uploadToIrys(data, tags);
                  return r.txId || '';
                }).catch(e => console.warn('[AppNav] UTXO snapshot failed:', e));
              }
            } catch (e) { /* non-fatal */ }
          }
          setBalanceSompi(sompi);
        }
        const price = getKasPrice();
        if (price) {
          const kas = Number(sompi) / 100_000_000;
          setBalance(parseFloat((kas * price.usdPerKas).toFixed(2)));
        }
      }
    } catch { /* L1 unreachable */ }
  }, []);

  // ------------------------------------------------------------------
  // BOOT: check if wallet / identity exists
  // ------------------------------------------------------------------
  useEffect(() => {
    const stopPriceFeed = startPriceFeed();

    (async () => {
      try {
        const privateKey: string = (await SecureStore.getItemAsync(STORE_KEYS.PRIVATE_KEY)) || '';
        const aptAlias: string = (await SecureStore.getItemAsync(STORE_KEYS.APT_ALIAS)) || '';
        const kvVerified: string = (await SecureStore.getItemAsync('kv_verified')) || '';
        const isReturning = !!(privateKey && aptAlias) || kvVerified === 'true';

        if (!isReturning) {
          setScreen('onboarding');
          return;
        }
        const publicKey: string = (await SecureStore.getItemAsync(STORE_KEYS.PUBLIC_KEY)) || (await SecureStore.getItemAsync('kaspa_pubkey')) || ''; console.log('[AppNav] Your PubKey:', publicKey);
        // pubkey logged above
        const identityRaw: string = (await SecureStore.getItemAsync(STORE_KEYS.IDENTITY)) || '';
        const identity = identityRaw ? JSON.parse(identityRaw) : null;

        const resolvedAlias: string = aptAlias 
          || (identity?.identityHash
              ? `KV-${identity.identityHash.slice(0, 8).toUpperCase()}`
              : 'Villager');

        const avatarName: string = identity ? `${identity.race} ${identity.class}` : '';

        setUser({ apartment: resolvedAlias, xp: 0, pubkey: publicKey, publicKey, name: avatarName });
        setScreen('biometric_gate');
        loadUserStats(resolvedAlias, publicKey);
      } catch {
        setScreen('onboarding');
      }
    })();

    return stopPriceFeed;
  }, [loadUserStats]);

  // ------------------------------------------------------------------
  // Price feed → USD balance
  // ------------------------------------------------------------------
  useEffect(() => {
    const unsub = subscribeToPriceUpdates((price: { usdPerKas: number }) => {
      if (balanceSompi > 0n) {
        const kas = Number(balanceSompi) / 100_000_000;
        setBalance(parseFloat((kas * price.usdPerKas).toFixed(2)));
      }
    });
    return unsub;
  }, [balanceSompi]);

  // After biometric succeeds, go to quiz gate (not directly to dashboard)
  const handleBiometricSuccess = useCallback(() => {
    // Device attestation check (non-blocking)
    (async () => {
      try {
        const deviceHash = await getDeviceHash();
        const serialHash = await getSerialHash();
        console.log('[DeviceAttestation] deviceHash:', deviceHash?.slice(0, 16) || 'none');
        console.log('[DeviceAttestation] serialHash:', serialHash?.slice(0, 16) || 'none');
        if (deviceHash) await SecureStore.setItemAsync('kv_last_device_hash', deviceHash);
      } catch (attErr) {
        console.warn('[DeviceAttestation] Check failed (non-fatal):', attErr);
      }
    })();
    setScreen('quiz_gate');
  }, []);

  const handleBiometricFail = useCallback(() => setScreen('onboarding'), []);

  // After quiz succeeds, check snail poison then go to dashboard
  const handleQuizSuccess = useCallback(() => {
    if (snailMode && snailDelayMs > 0) {
      setScreen('snail_mode');
    } else {
      setScreen('dashboard');
    }
  }, [snailMode, snailDelayMs]);

  const handleQuizFail = useCallback(() => setScreen('onboarding'), []);

  const handleSnailModeComplete = useCallback(() => {
    setSnailMode(false);
    setScreen('dashboard');
  }, []);

  const navigation = {
    navigate: (screenName: string) => {
      if (snailMode && (screenName === 'SendKAS')) {
        setScreen('snail_mode');
        return;
      }
      if (screenName === 'SendKAS') setScreen('send_kas');
      if (screenName === 'ReceiveKAS') setScreen('receive_kas');
      if (screenName === 'KaspaTest') setScreen('kaspa_test');
      if (screenName === 'TownHall') setScreen('town_hall');
      if (screenName === 'PayNearby') setScreen('pay_nearby');
    },
  };

  // Get current kaspa address for ReceiveScreen and SendKAS
  const [kaspaAddress, setKaspaAddress] = useState<string>('');

  // Refresh balance on demand (called after send/receive)
  const refreshBalance = useCallback(async () => {
    if (!kaspaAddress) return;
    try {
      const prefix = kaspaAddress.startsWith('kaspatest:') ? 'api-tn10' : 'api';
      const resp = await fetch('https://' + prefix + '.kaspa.org/addresses/' + kaspaAddress + '/balance');
      if (resp.ok) {
        const data = await resp.json();
        setBalanceSompi(BigInt(data.balance || '0'));
      }
    } catch {}
  }, [kaspaAddress]);

  // Auto-refresh balance every 30 seconds (detects incoming payments)
  useEffect(() => {
    if (!kaspaAddress) return;
    const interval = setInterval(refreshBalance, 30000);
    return () => clearInterval(interval);
  }, [kaspaAddress, refreshBalance]);
  const [activeMode, setActiveMode] = useState<'tutorial' | 'real'>('tutorial');

  const switchMode = useCallback(async (newMode: 'tutorial' | 'real') => {
    if (newMode === 'real') {
      const addr = await SecureStore.getItemAsync('kaspa_address_real') || '';
      if (!addr) {
        // Derive mainnet address from same key
        const privKey = await SecureStore.getItemAsync('kv_private_key');
        if (!privKey) return;
        const { secp256k1 } = require('@noble/curves/secp256k1');
        const pub = secp256k1.getPublicKey(privKey, true);
        const xOnly = pub.slice(1);
        const { kaspaAddressFromXOnly } = require('./wallet_registration_v2');
        const mainAddr = kaspaAddressFromXOnly(xOnly, 'kaspa');
        await SecureStore.setItemAsync('kaspa_address_real', mainAddr);
        setKaspaAddress(mainAddr);
      } else {
        setKaspaAddress(addr);
      }
      setActiveMode('real');
      await SecureStore.setItemAsync('kaspa_active_mode', 'real');
      try {
        const a = await SecureStore.getItemAsync('kaspa_address_real') || '';
        const r = await fetch('https://api.kaspa.org/addresses/' + a + '/balance');
        if (r.ok) { const d = await r.json(); setBalanceSompi(BigInt(d.balance)); }
      } catch {}
      // Auto-inscribe on mainnet if funded and not yet inscribed
      const mainInscribed = await SecureStore.getItemAsync('kv_mainnet_inscribed');
      const mainAddr2 = await SecureStore.getItemAsync('kaspa_address_real') || '';
      if (!mainInscribed && mainAddr2) {
        const privKey = await SecureStore.getItemAsync('kv_private_key');
        const recipeStr = await SecureStore.getItemAsync('kv_avatar_recipe');
        if (privKey && recipeStr) {
          const recipe = JSON.parse(recipeStr);
          const { inscribeIdentityViaRest } = require('./kaspa_rest_tx');
          Alert.alert(
            'Inscribe on Mainnet?',
            'Permanently inscribe your identity on Kaspa mainnet. Costs ~0.00001 KAS.',
            [
              { text: 'Later', style: 'cancel' },
              { text: 'Inscribe Now', onPress: async () => {
                try {
                  const result = await inscribeIdentityViaRest({
                    identityHash: recipe.recipeHash || '',
                    address: mainAddr2,
                    privateKeyHex: privKey,
                    network: 'mainnet',
                  });
                  if (result.success) {
                    await SecureStore.setItemAsync('kv_mainnet_inscribed', 'true');
                    await SecureStore.setItemAsync('kv_mainnet_txid', result.txId || '');
                    Alert.alert('Success', 'Identity inscribed on Kaspa mainnet!');
                  } else {
                    Alert.alert('Failed', result.error || 'Try again later.');
                  }
                } catch (e: any) {
                  Alert.alert('Error', e.message);
                }
              }},
            ]
          );
        }
      }
    } else {
      const addr = await SecureStore.getItemAsync('kaspa_address_tutorial') || await SecureStore.getItemAsync('kaspa_address') || '';
      setKaspaAddress(addr);
      setActiveMode('tutorial');
      await SecureStore.setItemAsync('kaspa_active_mode', 'tutorial');
      try {
        const r = await fetch('https://api-tn10.kaspa.org/addresses/' + addr + '/balance');
        if (r.ok) { const d = await r.json(); setBalanceSompi(BigInt(d.balance)); }
      } catch {}
    }
  }, []);
  useEffect(() => {
    SecureStore.getItemAsync('kaspa_address').then(addr => {
      if (addr) setKaspaAddress(addr);
    });
  }, []);

  // ------------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------------
  switch (screen) {
    case 'booting':
      return <LoadingScreen />;

    case 'onboarding':
      return <IdentityRitual onComplete={() => {
        // Ritual finished — reload user data and go to dashboard
        (async () => {
          try {
            const publicKey = (await SecureStore.getItemAsync(STORE_KEYS.PUBLIC_KEY)) || (await SecureStore.getItemAsync('kaspa_pubkey')) || '';
            const identityRaw = (await SecureStore.getItemAsync(STORE_KEYS.IDENTITY)) || '';
            const avatarRaw = (await SecureStore.getItemAsync('kv_avatar_recipe')) || '';
            const identity = identityRaw ? JSON.parse(identityRaw) : null;
            const avatar = avatarRaw ? JSON.parse(avatarRaw) : null;
            const aptAlias = (await SecureStore.getItemAsync(STORE_KEYS.APT_ALIAS)) || 
              (identity?.identityHash ? `KV-${identity.identityHash.slice(0, 8).toUpperCase()}` : 'Villager');
            const avatarName = avatar ? `${avatar.race || ''} ${avatar.class || ''}`.trim() : '';
            
            setUser({ apartment: aptAlias, xp: 0, pubkey: publicKey, publicKey, name: avatarName });
            setScreen('dashboard');
          } catch {
            setScreen('dashboard');
          }
        })();
      }} />;

    case 'biometric_gate':
      return <BiometricGate onSuccess={handleBiometricSuccess} onFail={handleBiometricFail} />;

    case 'quiz_gate':
      return <QuizGate onSuccess={handleQuizSuccess} onFail={handleQuizFail} />;

    case 'dashboard':
      return (
        <Dashboard
          user={user}
          balance={balance}
          balanceSompi={balanceSompi}
          isSnailMode={snailMode}
          isEliteMode={user.xp >= 10000}
          onNavigateSendKas={() => setScreen('send_kas')}
          onNavigateTownHall={() => setScreen('town_hall')}
          onNavigatePayNearby={() => setScreen('pay_nearby')}
          onNavigateBathroom={() => setScreen('bathroom')}
          onNavigateReceive={() => setScreen('receive_kas')}
          onNavigateTxHistory={() => setScreen('tx_history')}
          onNavigatePOBox={() => setScreen('po_box')}
          activeMode={activeMode}
          onSwitchMode={switchMode}
          onNavigateMailbox={() => setScreen('mailbox')}
          onNavigateWorkspace={() => setScreen('workspace')}
          onNavigateEntertainment={() => setScreen('entertainment')}
          onNavigateProfile={() => setScreen('profile')}
          onNavigateNeighbor={() => setScreen('neighbor_agreement')}
        />
      );

    case 'send_kas':
      return (
        <SendKAS
          visible={true}
          onClose={() => setScreen('dashboard')}
          onSuccess={(txId: string) => {
            console.log('[AppNavigator] SendKAS success:', txId);
            console.log('[AppNavigator] SendKAS success:', txId); setTimeout(() => refreshBalance(), 2000);
          }}
          initialAddress=""
          myAddress={kaspaAddress}
        />
      );

    case 'receive_kas':
      return (
        <ReceiveScreen
          visible={true}
          onClose={() => setScreen('dashboard')}
          myAddress={kaspaAddress}
        />
      );

    case 'snail_mode':
      return (
        <SnailModeScreen
          reason={snailReason}
          delayMs={snailDelayMs}
          xp={user.xp}
            inAgreementsSompi={inAgreementsSompi}
            iousOwedSompi={iousOwedSompi}
            iousOwedToYouSompi={iousOwedToYouSompi}
            agreementReturnsSompi={agreementReturnsSompi}
          pComplete={snailPComplete}
          deadlocks={snailDeadlocks}
          onDelayComplete={handleSnailModeComplete}
        />
      );

    case 'kaspa_test':
      return <View style={{flex:1,backgroundColor:'#0A0A0A',justifyContent:'center',alignItems:'center'}}><Text style={{color:'#FFF'}}>Kaspa Test (disabled)</Text></View>;

    case 'town_hall':
      return <TownHallScreen onClose={() => setScreen('dashboard')} />;

    case 'mailbox':
      return (
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingHorizontal: 16, paddingBottom: 8, backgroundColor: '#1A1A1A' }}>
            <TouchableOpacity onPress={() => setScreen('dashboard')} style={{ padding: 8 }}>
              <Text style={{ color: '#D4AF37', fontSize: 18 }}>← Back</Text>
            </TouchableOpacity>
            <Text style={{ color: '#FFF', fontSize: 16, fontWeight: 'bold', marginLeft: 12 }}>Village Mailbox</Text>
          </View>
          <VillageMailbox />
        </View>
      );

    case 'workspace':
      return (
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingHorizontal: 16, paddingBottom: 8, backgroundColor: '#1A1A1A' }}>
            <TouchableOpacity onPress={() => setScreen('dashboard')} style={{ padding: 8 }}>
              <Text style={{ color: '#D4AF37', fontSize: 18 }}>← Back</Text>
            </TouchableOpacity>
            <Text style={{ color: '#FFF', fontSize: 16, fontWeight: 'bold', marginLeft: 12 }}>Workspace</Text>
          </View>
          <Workspace
            userPubkey={user.pubkey || ''}
            userXp={user.xp}
          />
        </View>
      );

    case 'entertainment':
      return <EntertainmentCenter
        onClose={() => setScreen('dashboard')}
      />;

    case 'profile':
      return <ProfileScreen
        navigation={{ goBack: () => setScreen('dashboard') }}
        onNavigateEntertainment={() => setScreen('entertainment')}
        onNavigateTownHall={() => setScreen('town_hall')}
        onNavigateBookshelf={() => setScreen('entertainment')}
      />;

    case 'neighbor_agreement':
      return <NeighborAgreement
        visible={true}
        userPubkey={user.pubkey || ''}
        onClose={() => setScreen('dashboard')}
      />;

    case 'po_box':
      return <POBoxScreen onClose={() => setScreen('dashboard')} />;
    case 'tx_history':
      return <TransactionHistory onClose={() => setScreen('dashboard')} />;
    case 'bathroom':
      return (
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingHorizontal: 16, paddingBottom: 8, backgroundColor: '#1A1A1A' }}>
            <TouchableOpacity onPress={() => setScreen('dashboard')} style={{ padding: 8 }}>
              <Text style={{ color: '#D4AF37', fontSize: 18 }}>{'<'} Back</Text>
            </TouchableOpacity>
            <Text style={{ color: '#FFF', fontSize: 18, fontWeight: 'bold', marginLeft: 12 }}>Bathroom Mirror</Text>
          </View>
          <TradeFiScreen />
        </View>
      );
    case 'pay_nearby':
      return <PayNearbyScreen
        userAddress={kaspaAddress}
        userName={user.apartment}
        onBack={() => setScreen('dashboard')}
      />;

    default:
      return <LoadingScreen />;
  }
};

export default AppNavigator;

// =============================================================================
// PAY NEARBY SCREEN — Bluetooth Direct Pay
// =============================================================================

function PayNearbyScreen({ userAddress, userName, onBack }: {
  userAddress: string;
  userName: string;
  onBack: () => void;
}) {
  const { scanning, advertising, payees, startReceiving, stopReceiving, startScanning, stopScanning } = useBluetoothPay();
  const [mode, setMode] = useState<'choose' | 'scan' | 'receive'>('choose');
  const [selectedPayee, setSelectedPayee] = useState<PayablePeer | null>(null);
  const [amountKAS, setAmountKAS] = useState('');
  const [receiveAmountKAS, setReceiveAmountKAS] = useState('');

  // Network guard — prevent sending testnet to mainnet or vice versa
  const getNetworkFromAddress = (addr: string): 'mainnet' | 'testnet' => {
    return addr.startsWith('kaspa:') ? 'mainnet' : 'testnet';
  };

  const handleSelectPayee = (payee: PayablePeer) => {
    // Check network compatibility
    const myNetwork = getNetworkFromAddress(userAddress);
    const theirNetwork = getNetworkFromAddress(payee.kaspaAddress);
    
    if (myNetwork !== theirNetwork) {
      Alert.alert(
        '⚠️ Network Mismatch',
        `You are on ${myNetwork === 'mainnet' ? '🌐 Mainnet (real KAS)' : '🧪 Testnet (tKAS)'}.\n\n${payee.displayName} is on ${theirNetwork === 'mainnet' ? '🌐 Mainnet (real KAS)' : '🧪 Testnet (tKAS)'}.\n\nYou cannot send ${myNetwork === 'mainnet' ? 'KAS' : 'tKAS'} to a ${theirNetwork === 'mainnet' ? 'kaspa:' : 'kaspatest:'} address.`,
        [{ text: 'OK' }]
      );
      return;
    }
    
    setSelectedPayee(payee);
    if (payee.requestedAmount) {
      setAmountKAS(payee.requestedAmount.toString());
    }
  };

  const [sending, setSending] = useState(false);

  const handleConfirmPay = () => {
    if (!selectedPayee || !amountKAS || sending) return;
    
    const myNetwork = getNetworkFromAddress(userAddress);
    const theirNetwork = getNetworkFromAddress(selectedPayee.kaspaAddress);
    const currencyLabel = myNetwork === 'mainnet' ? 'KAS' : 'tKAS';
    
    // Double-check network guard
    if (myNetwork !== theirNetwork) {
      Alert.alert('⚠️ Network Mismatch', 'Cannot send across networks.');
      return;
    }
    
    Alert.alert(
      'Confirm Payment',
      `Send ${amountKAS} ${currencyLabel} to ${selectedPayee.displayName}?\n\nNetwork: ${myNetwork === 'mainnet' ? '🌐 Mainnet' : '🧪 Testnet'}\nAddress: ${selectedPayee.kaspaAddress.slice(0, 25)}...`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Send ${currencyLabel}`,
          onPress: async () => {
            setSending(true);
            try {
              const amountSompi = BigInt(Math.round(parseFloat(amountKAS) * 1e8));
              const result = await sendKASWithHybridSig(
                selectedPayee.kaspaAddress,
                amountSompi,
                `BLE pay to ${selectedPayee.displayName}`
              );
              if (result.success) {
                Alert.alert(
                  '✅ Sent!',
                  `${amountKAS} ${currencyLabel} sent to ${selectedPayee.displayName}\n\nTX: ${result.kaspaTxId?.slice(0, 16)}...`
                );
                setSelectedPayee(null);
                setAmountKAS('');
                stopScanning();
                setMode('choose');
              } else {
                Alert.alert('❌ Failed', result.error || 'Transaction failed');
              }
            } catch (e: any) {
              Alert.alert('❌ Error', e.message || 'Send failed');
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16 }}>
        <TouchableOpacity onPress={() => { stopScanning(); stopReceiving(); onBack(); }}>
          <Text style={{ color: '#4CAF50', fontSize: 16 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ color: '#FFF', fontSize: 20, fontWeight: 'bold', marginLeft: 16 }}>📡 Pay Nearby</Text>
      </View>

      {/* Mode selector */}
      {mode === 'choose' && (
        <View style={{ padding: 20 }}>
          <TouchableOpacity
            style={{ backgroundColor: '#1A2A1A', borderWidth: 2, borderColor: '#4CAF50', borderRadius: 16, padding: 24, marginBottom: 16, alignItems: 'center' }}
            onPress={() => { setMode('scan'); startScanning(20000); }}
          >
            <Text style={{ fontSize: 40 }}>📤</Text>
            <Text style={{ color: '#4CAF50', fontSize: 20, fontWeight: 'bold', marginTop: 12 }}>Send KAS</Text>
            <Text style={{ color: '#8BC34A', fontSize: 13, marginTop: 6 }}>Scan for nearby people to pay</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ backgroundColor: '#1A1A2A', borderWidth: 2, borderColor: '#4169E1', borderRadius: 16, padding: 24, alignItems: 'center' }}
            onPress={() => { setMode('receive'); startReceiving(userAddress, userName, receiveAmountKAS ? parseFloat(receiveAmountKAS) : undefined); }}
          >
            <Text style={{ fontSize: 40 }}>📥</Text>
            <Text style={{ color: '#4169E1', fontSize: 20, fontWeight: 'bold', marginTop: 12 }}>Receive KAS</Text>
            <Text style={{ color: '#87CEEB', fontSize: 13, marginTop: 6 }}>Broadcast your address to nearby senders</Text>
          </TouchableOpacity>

          <View style={{ marginTop: 20 }}>
            <Text style={{ color: '#888', fontSize: 12, marginBottom: 6 }}>Optional: Request specific amount</Text>
            <TextInput
              style={{ backgroundColor: '#1A1A1A', borderRadius: 10, padding: 14, color: '#FFF', fontSize: 16, borderWidth: 1, borderColor: '#333' }}
              placeholder="Amount (KAS) — leave blank for any"
              placeholderTextColor="#555"
              value={receiveAmountKAS}
              onChangeText={setReceiveAmountKAS}
              keyboardType="decimal-pad"
            />
          </View>
        </View>
      )}

      {/* Scanning mode — find payees */}
      {mode === 'scan' && (
        <ScrollView style={{ padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            {scanning && <ActivityIndicator color="#4CAF50" style={{ marginRight: 10 }} />}
            <Text style={{ color: '#4CAF50', fontSize: 16, fontWeight: 'bold' }}>
              {scanning ? `Scanning... (${payees.length} found)` : `Found ${payees.length} nearby`}
            </Text>
            <TouchableOpacity onPress={() => { setMode('choose'); stopScanning(); }} style={{ marginLeft: 'auto' }}>
              <Text style={{ color: '#FF6B6B', fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {payees.length === 0 && scanning && (
            <Text style={{ color: '#666', textAlign: 'center', marginTop: 40, fontSize: 14 }}>
              Looking for nearby KasVillage users...{'\n'}Make sure the receiver has Bluetooth on
            </Text>
          )}

          {payees.map(payee => (
            <TouchableOpacity
              key={payee.id}
              style={{
                backgroundColor: selectedPayee?.id === payee.id ? '#1A3A1A' : '#1A1A1A',
                borderWidth: 1, borderColor: selectedPayee?.id === payee.id ? '#4CAF50' : '#333',
                borderRadius: 12, padding: 16, marginBottom: 10,
              }}
              onPress={() => handleSelectPayee(payee)}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ color: '#FFF', fontSize: 16, fontWeight: 'bold' }}>{payee.displayName}</Text>
                  <Text style={{ color: '#888', fontSize: 11, marginTop: 4 }}>{payee.kaspaAddress.slice(0, 25)}...</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {payee.requestedAmount && (
                    <Text style={{ color: '#D4AF37', fontSize: 14, fontWeight: 'bold' }}>{payee.requestedAmount} KAS</Text>
                  )}
                  <Text style={{ color: '#666', fontSize: 10 }}>Signal: {payee.rssi}dB</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {/* Amount input + send button when payee selected */}
          {selectedPayee && (
            <View style={{ marginTop: 16, backgroundColor: '#1A2A1A', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#4CAF50' }}>
              <Text style={{ color: '#4CAF50', fontSize: 14, fontWeight: 'bold', marginBottom: 10 }}>
                Sending to: {selectedPayee.displayName}
              </Text>
              <TextInput
                style={{ backgroundColor: '#0A0A0A', borderRadius: 10, padding: 14, color: '#FFF', fontSize: 20, fontWeight: 'bold', textAlign: 'center', borderWidth: 1, borderColor: '#333', marginBottom: 12 }}
                placeholder="0.00"
                placeholderTextColor="#555"
                value={amountKAS}
                onChangeText={setAmountKAS}
                keyboardType="decimal-pad"
              />
              <TouchableOpacity
                style={{ backgroundColor: amountKAS && !sending ? '#4CAF50' : '#333', borderRadius: 10, padding: 16, alignItems: 'center' }}
                onPress={handleConfirmPay}
                disabled={!amountKAS || sending}
              >
                {sending ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={{ color: amountKAS ? '#000' : '#666', fontSize: 16, fontWeight: 'bold' }}>
                    Send {amountKAS || '0'} {getNetworkFromAddress(userAddress) === 'mainnet' ? 'KAS' : 'tKAS'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* Receiving mode — waiting for payment */}
      {mode === 'receive' && (
        <View style={{ padding: 20, alignItems: 'center' }}>
          <View style={{ backgroundColor: '#1A1A2A', borderWidth: 2, borderColor: '#4169E1', borderRadius: 16, padding: 24, alignItems: 'center', width: '100%' }}>
            {advertising && <ActivityIndicator color="#4169E1" size="large" style={{ marginBottom: 16 }} />}
            <Text style={{ color: '#4169E1', fontSize: 18, fontWeight: 'bold' }}>
              {advertising ? 'Broadcasting...' : 'Ready'}
            </Text>
            <Text style={{ color: '#87CEEB', fontSize: 13, marginTop: 8, textAlign: 'center' }}>
              Your address is visible to nearby senders via Bluetooth
            </Text>
            {receiveAmountKAS ? (
              <Text style={{ color: '#D4AF37', fontSize: 20, fontWeight: 'bold', marginTop: 16 }}>
                Requesting: {receiveAmountKAS} KAS
              </Text>
            ) : null}
            <Text style={{ color: '#666', fontSize: 11, marginTop: 12, textAlign: 'center' }} numberOfLines={2}>
              {userAddress}
            </Text>
          </View>

          <TouchableOpacity
            style={{ marginTop: 24, backgroundColor: '#333', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 30 }}
            onPress={() => { stopReceiving(); setMode('choose'); }}
          >
            <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>Stop Receiving</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}