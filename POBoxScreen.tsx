// ============================================================================
// KASVILLAGE - P.O. BOX WALLET
// ============================================================================
// Secondary stealth address wallet for private receiving
// Users share their PO Box code — senders pay to one-time addresses
// Nobody can link PO Box payments to the main wallet
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import {
  initializeStealthFromSeed,
  getStealthPaymentCode,
  getStealthBalance,
  getUnspentStealthPayments,
  scanForStealthPaymentsREST,
  loadStealthKeys,
  StealthPayment,
} from './stealth_watcher';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================================
// COLORS
// ============================================================================
const COLORS = {
  bg: '#0A0A0A',
  card: '#1A1A1A',
  cardBorder: '#333',
  text: '#FFF',
  textMuted: '#888',
  textDim: '#555',
  green: '#10B981',
  red: '#EF4444',
  amber: '#D4AF37',
  blue: '#3B82F6',
  purple: '#8B5CF6',
};

// ============================================================================
// P.O. BOX SCREEN
// ============================================================================
interface POBoxProps {
  onClose: () => void;
}

export const POBoxScreen: React.FC<POBoxProps> = ({ onClose }) => {
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [paymentCode, setPaymentCode] = useState<string | null>(null);
  const [balance, setBalance] = useState<bigint>(BigInt(0));
  const [payments, setPayments] = useState<StealthPayment[]>([]);
  const [network, setNetwork] = useState('testnet-10');

  // Initialize PO Box
  const initialize = useCallback(async () => {
    setLoading(true);
    try {
      // Check if already initialized
      const existingKeys = await loadStealthKeys();
      if (existingKeys) {
        setInitialized(true);
        const code = await getStealthPaymentCode();
        setPaymentCode(code);
        await refreshBalance();
      }

      // Detect network
      const addr = await SecureStore.getItemAsync('kaspa_address');
      if (addr) {
        setNetwork(addr.startsWith('kaspatest:') ? 'testnet-10' : 'mainnet');
      }
    } catch (err) {
      console.error('[POBox] Init error:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { initialize(); }, [initialize]);

  // Setup PO Box (first time)
  const handleSetup = useCallback(async () => {
    try {
      setLoading(true);
      const seedHex = await SecureStore.getItemAsync('kv_wallet_seed');
      if (!seedHex) {
        Alert.alert('No Wallet', 'Create a wallet first before setting up PO Box');
        setLoading(false);
        return;
      }
      // Convert hex seed to Uint8Array
      const seed = new Uint8Array(seedHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
      await initializeStealthFromSeed(seed);
      setInitialized(true);
      const code = await getStealthPaymentCode();
      setPaymentCode(code);
      Alert.alert('PO Box Created', 'Your private PO Box address is ready. Share the code to receive payments privately.');
    } catch (err: any) {
      Alert.alert('Setup Failed', err.message || 'Could not create PO Box');
    }
    setLoading(false);
  }, []);

  // Refresh balance
  const refreshBalance = useCallback(async () => {
    try {
      const bal = await getStealthBalance();
      setBalance(bal);
      const unspent = await getUnspentStealthPayments();
      setPayments(unspent);
    } catch (err) {
      console.error('[POBox] Balance error:', err);
    }
  }, []);

  // Scan for new payments
  const handleScan = useCallback(async () => {
    setScanning(true);
    try {
      const keys = await loadStealthKeys();
      if (!keys) {
        Alert.alert('Not Initialized', 'Set up your PO Box first');
        setScanning(false);
        return;
      }
      const addr = await SecureStore.getItemAsync('kaspa_address');
      const apiBase = addr?.startsWith('kaspatest:')
        ? 'https://api-tn10.kaspa.org'
        : 'https://api.kaspa.org';

      await scanForStealthPaymentsREST(apiBase);
      await refreshBalance();
      Alert.alert('Scan Complete', `Found ${payments.length} payment(s) in PO Box`);
    } catch (err: any) {
      Alert.alert('Scan Failed', err.message || 'Could not scan for payments');
    }
    setScanning(false);
  }, [payments.length, refreshBalance]);

  // Copy payment code
  const handleCopyCode = useCallback(async () => {
    if (paymentCode) {
      await Clipboard.setStringAsync(paymentCode);
      Alert.alert('Copied', 'PO Box code copied to clipboard. Share it with anyone to receive private payments.');
    }
  }, [paymentCode]);

  // Withdraw to main wallet
  const handleWithdraw = useCallback(async () => {
    if (balance <= BigInt(0)) {
      Alert.alert('No Funds', 'Your PO Box is empty');
      return;
    }
    Alert.alert(
      'Withdraw to Main Wallet',
      `Transfer ${Number(balance) / 1e8} KASPA from PO Box to your main wallet?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          onPress: async () => {
            // TODO: Build transaction from stealth UTXOs to main wallet
            Alert.alert('Coming Soon', 'Withdrawal requires dev build with wRPC support. Your funds are safe in your PO Box.');
          },
        },
      ]
    );
  }, [balance]);

  // Format balance
  const balanceKAS = Number(balance) / 1e8;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
          <Text style={styles.backText}>{"< Back"}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>PO Box Wallet</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.amber} />
            <Text style={styles.loadingText}>Loading PO Box...</Text>
          </View>
        ) : !initialized ? (
          /* Setup Screen */
          <View style={styles.setupContainer}>
            <View style={styles.setupIcon}>
              <Text style={{ fontSize: 48 }}>P</Text>
            </View>
            <Text style={styles.setupTitle}>Set Up Your PO Box</Text>
            <Text style={styles.setupDesc}>
              A PO Box is a private address for receiving payments.
              Nobody can link payments to your main wallet.
            </Text>

            <View style={styles.featureList}>
              <View style={styles.featureItem}>
                <Text style={styles.featureBullet}>1</Text>
                <Text style={styles.featureText}>Get a private PO Box code</Text>
              </View>
              <View style={styles.featureItem}>
                <Text style={styles.featureBullet}>2</Text>
                <Text style={styles.featureText}>Share code with anyone to receive KASPA</Text>
              </View>
              <View style={styles.featureItem}>
                <Text style={styles.featureBullet}>3</Text>
                <Text style={styles.featureText}>Withdraw to your main wallet anytime</Text>
              </View>
              <View style={styles.featureItem}>
                <Text style={styles.featureBullet}>4</Text>
                <Text style={styles.featureText}>Nobody can trace payments back to you</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.setupBtn} onPress={handleSetup}>
              <Text style={styles.setupBtnText}>Create PO Box</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Main PO Box View */
          <>
            {/* Balance Card */}
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>PO Box Balance</Text>
              <Text style={styles.balanceAmount}>{balanceKAS.toFixed(4)}</Text>
              <Text style={styles.balanceCurrency}>KASPA</Text>
              <View style={styles.networkBadge}>
                <Text style={styles.networkText}>{network === 'mainnet' ? 'MAINNET' : 'TESTNET'}</Text>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleScan}>
                {scanning ? (
                  <ActivityIndicator size="small" color={COLORS.amber} />
                ) : (
                  <Text style={styles.actionIcon}>S</Text>
                )}
                <Text style={styles.actionLabel}>Scan</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionBtn} onPress={handleWithdraw}>
                <Text style={styles.actionIcon}>W</Text>
                <Text style={styles.actionLabel}>Withdraw</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionBtn} onPress={handleCopyCode}>
                <Text style={styles.actionIcon}>C</Text>
                <Text style={styles.actionLabel}>Copy Code</Text>
              </TouchableOpacity>
            </View>

            {/* PO Box Code */}
            <View style={styles.codeCard}>
              <Text style={styles.codeTitle}>Your PO Box Code</Text>
              <Text style={styles.codeDesc}>Share this with anyone to receive private payments</Text>
              <TouchableOpacity onPress={handleCopyCode} style={styles.codeBox}>
                <Text style={styles.codeText} numberOfLines={3}>
                  {paymentCode || 'Loading...'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.codeTap}>Tap to copy</Text>
            </View>

            {/* How It Works */}
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>How PO Box Works</Text>
              <Text style={styles.infoText}>
                When someone sends to your PO Box code, a unique one-time address is generated just for that payment. Only you can see and spend these funds. Your main wallet address is never revealed.
              </Text>
            </View>

            {/* Payments List */}
            <View style={styles.paymentsCard}>
              <Text style={styles.paymentsTitle}>
                PO Box Payments ({payments.length})
              </Text>
              {payments.length === 0 ? (
                <Text style={styles.emptyText}>No payments received yet</Text>
              ) : (
                payments.map((p, i) => (
                  <View key={`${p.txId}-${p.outputIndex}`} style={styles.paymentRow}>
                    <View>
                      <Text style={styles.paymentAmount}>
                        +{(Number(p.amountSompi) / 1e8).toFixed(4)} KASPA
                      </Text>
                      <Text style={styles.paymentDate}>
                        {new Date(p.timestamp).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={[styles.paymentStatus, { backgroundColor: p.spent ? '#EF444420' : '#10B98120' }]}>
                      <Text style={{ color: p.spent ? COLORS.red : COLORS.green, fontSize: 11, fontWeight: 'bold' }}>
                        {p.spent ? 'Spent' : 'Available'}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Disclaimer */}
            <View style={styles.disclaimer}>
              <Text style={styles.disclaimerText}>
                PO Box uses cryptographic one-time addresses. Withdrawal to main wallet requires a dev build with wRPC support.
              </Text>
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 50, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#111', borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder,
  },
  backBtn: { padding: 8 },
  backText: { color: COLORS.amber, fontSize: 14, fontWeight: 'bold' },
  title: { color: COLORS.text, fontSize: 16, fontWeight: 'bold' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },
  loadingContainer: { alignItems: 'center', paddingVertical: 60 },
  loadingText: { color: COLORS.textMuted, marginTop: 12 },

  // Setup
  setupContainer: { alignItems: 'center', paddingVertical: 40 },
  setupIcon: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.amber + '20',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  setupTitle: { color: COLORS.text, fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  setupDesc: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center', paddingHorizontal: 20, marginBottom: 24 },
  featureList: { width: '100%', paddingHorizontal: 20, marginBottom: 30 },
  featureItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  featureBullet: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.amber + '30',
    justifyContent: 'center', alignItems: 'center', color: COLORS.amber, fontSize: 14,
    fontWeight: 'bold', textAlign: 'center', lineHeight: 28, marginRight: 12,
  },
  featureText: { color: COLORS.text, fontSize: 14, flex: 1 },
  setupBtn: {
    backgroundColor: COLORS.amber, paddingVertical: 14, paddingHorizontal: 40,
    borderRadius: 12,
  },
  setupBtnText: { color: '#000', fontSize: 16, fontWeight: 'bold' },

  // Balance
  balanceCard: {
    backgroundColor: COLORS.card, borderRadius: 16, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.amber + '40', marginBottom: 16,
  },
  balanceLabel: { color: COLORS.textMuted, fontSize: 12, marginBottom: 4 },
  balanceAmount: { color: COLORS.text, fontSize: 36, fontWeight: 'bold' },
  balanceCurrency: { color: COLORS.amber, fontSize: 14, fontWeight: 'bold', marginTop: 4 },
  networkBadge: {
    backgroundColor: COLORS.amber + '30', paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 4, marginTop: 8,
  },
  networkText: { color: COLORS.amber, fontSize: 10, fontWeight: 'bold' },

  // Actions
  actionsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  actionBtn: {
    backgroundColor: COLORS.card, borderRadius: 12, padding: 16,
    alignItems: 'center', width: SCREEN_WIDTH * 0.28, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  actionIcon: { color: COLORS.amber, fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  actionLabel: { color: COLORS.textMuted, fontSize: 11 },

  // Code
  codeCard: {
    backgroundColor: COLORS.card, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: COLORS.cardBorder, marginBottom: 16, alignItems: 'center',
  },
  codeTitle: { color: COLORS.text, fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  codeDesc: { color: COLORS.textMuted, fontSize: 11, marginBottom: 12 },
  codeBox: {
    backgroundColor: '#0D0D0D', borderRadius: 8, padding: 12, width: '100%',
  },
  codeText: { color: COLORS.purple, fontSize: 12, fontFamily: 'monospace' },
  codeTap: { color: COLORS.textDim, fontSize: 10, marginTop: 8 },

  // Info
  infoCard: {
    backgroundColor: COLORS.blue + '10', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: COLORS.blue + '30', marginBottom: 16,
  },
  infoTitle: { color: COLORS.blue, fontSize: 13, fontWeight: 'bold', marginBottom: 8 },
  infoText: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18 },

  // Payments
  paymentsCard: {
    backgroundColor: COLORS.card, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: COLORS.cardBorder, marginBottom: 16,
  },
  paymentsTitle: { color: COLORS.text, fontSize: 14, fontWeight: 'bold', marginBottom: 12 },
  emptyText: { color: COLORS.textDim, fontSize: 12, textAlign: 'center', paddingVertical: 20 },
  paymentRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder,
  },
  paymentAmount: { color: COLORS.green, fontSize: 14, fontWeight: 'bold' },
  paymentDate: { color: COLORS.textDim, fontSize: 11, marginTop: 2 },
  paymentStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },

  // Disclaimer
  disclaimer: { paddingVertical: 12 },
  disclaimerText: { color: COLORS.textDim, fontSize: 10, fontStyle: 'italic', textAlign: 'center' },
});

export default POBoxScreen;