// ============================================================================
// KASVILLAGE - RECEIVE KAS SCREEN (WITH STEALTH)
// ============================================================================
// Shows:
// - Standard Kaspa address + QR
// - PO Box address for private payments
// - Incoming PO Box payment watcher
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  PixelRatio,
  Modal,
  Alert,
  ActivityIndicator,
  ScrollView,
  FlatList,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import * as SecureStore from 'expo-secure-store';
import {
  Copy,
  Share as ShareIcon,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  RefreshCw,
  Bell,
  BellOff,
  CheckCircle,
  X,
} from 'lucide-react-native';

import {
  startStealthWatcher,
  stopStealthWatcher,
  scanForStealthPayments,
  getStealthMetaAddress,
  loadStealthKeys,
  StealthPayment,
  getPendingStealthPayments,
  markStealthPaymentSpent,
} from './stealth_watcher';

import { getBalance, formatKAS } from './kaspa_unified';
import { useKaspaPrice } from './useKaspaPrice';

// ============================================================================
// CONSTANTS
// ============================================================================

const SECURESTORE_KEYS = {
  KASPA_ADDRESS: 'kv_kaspa_address',
  PUBLIC_KEY: 'kv_public_key',
};

// ============================================================================
// RESPONSIVE
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = Math.min(SCREEN_WIDTH / 393, 1.2);
const rs = {
  s: (size: number) => Math.round(size * scale),
  font: (size: number) => Math.round(size * scale * (PixelRatio.getFontScale() > 1 ? 0.9 : 1)),
};

const COLORS = {
  background: '#0a0a0a',
  cardBg: '#1a1a2e',
  primary: '#49d6aa',
  stealth: '#8b5cf6',
  text: '#ffffff',
  textMuted: '#888888',
  border: '#333333',
  success: '#2ecc71',
};

// ============================================================================
// TYPES
// ============================================================================

export interface ReceiveScreenProps {
  visible: boolean;
  onClose: () => void;
  myAddress?: string;
}

type AddressMode = 'standard' | 'stealth';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ReceiveScreen({ visible, onClose, myAddress }: ReceiveScreenProps) {
  const [mode, setMode] = useState<AddressMode>('standard');
  const [address, setAddress] = useState<string | null>(myAddress || null);
  const [stealthAddress, setStealthAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<bigint>(0n);
  const [watcherActive, setWatcherActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [stealthPayments, setStealthPayments] = useState<StealthPayment[]>([]);
  const [copied, setCopied] = useState(false);
  const { price: kasPrice } = useKaspaPrice();
  
  // Load addresses
  useEffect(() => {
    if (!visible) return;
    
    (async () => {
      // Standard address
      const addr = myAddress || await SecureStore.getItemAsync(SECURESTORE_KEYS.KASPA_ADDRESS);
      if (addr) {
        setAddress(addr);
        const bal = await getBalance(addr);
        setBalance(bal);
      }
      
      // PO Box address
      const stealthMeta = await getStealthMetaAddress();
      if (stealthMeta) {
        setStealthAddress(`stealth:${stealthMeta}`);
      }
      
      // Load pending PO Box payments
      const payments = await getPendingStealthPayments();
      setStealthPayments(payments);
    })();
  }, [visible, myAddress]);
  
  // Handle copy
  const handleCopy = async () => {
    const toCopy = mode === 'standard' ? address : stealthAddress;
    if (!toCopy) return;
    
    await Clipboard.setStringAsync(toCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  // Handle share
  const handleShare = async () => {
    const toShare = mode === 'standard' ? address : stealthAddress;
    if (!toShare) return;
    
    const message = mode === 'standard'
      ? `My Kaspa address: ${toShare}`
      : `My PO Box address (for private payments): ${toShare}`;
    
    await Share.share({ message });
  };
  
  // Toggle PO Box watcher
  const handleToggleWatcher = async () => {
    if (watcherActive) {
      await stopStealthWatcher();
      setWatcherActive(false);
    } else {
      const started = await startStealthWatcher((payment) => {
        setStealthPayments(prev => [payment, ...prev]);
        Alert.alert(
          'PO Box Payment Received!',
          `${formatKAS(payment.amountSompi)} KASPA`
        );
      });
      setWatcherActive(started);
    }
  };
  
  // Manual scan
  const handleScan = async () => {
    setScanning(true);
    try {
      const found = await scanForStealthPayments();
      if (found.length > 0) {
        setStealthPayments(prev => [...found, ...prev]);
        Alert.alert('Found Payments', `Discovered ${found.length} PO Box payment(s)`);
      } else {
        Alert.alert('No New Payments', 'No new PO Box payments found');
      }
    } catch (e: any) {
      Alert.alert('Scan Error', e.message);
    } finally {
      setScanning(false);
    }
  };
  
  // Get display address
  const displayAddress = mode === 'standard' ? address : stealthAddress;
  const shortAddress = displayAddress 
    ? displayAddress.slice(0, 20) + '...' + displayAddress.slice(-12)
    : '';
  
  if (!visible) return null;
  
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Receive KASPA</Text>
          <TouchableOpacity onPress={onClose}>
            <X size={rs.s(24)} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.content}>
          {/* Mode Toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'standard' && styles.modeBtnActive]}
              onPress={() => setMode('standard')}
            >
              <Unlock size={rs.s(16)} color={mode === 'standard' ? COLORS.primary : COLORS.textMuted} />
              <Text style={[styles.modeBtnText, mode === 'standard' && styles.modeBtnTextActive]}>
                Standard
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'stealth' && styles.modeBtnActiveStealth]}
              onPress={() => setMode('stealth')}
            >
              <Lock size={rs.s(16)} color={mode === 'stealth' ? COLORS.stealth : COLORS.textMuted} />
              <Text style={[styles.modeBtnText, mode === 'stealth' && styles.modeBtnTextActiveStealth]}>
                PO Box
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* QR Code */}
          {displayAddress && (
            <View style={styles.qrContainer}>
              <View style={[
                styles.qrWrapper,
                mode === 'stealth' && styles.qrWrapperStealth
              ]}>
                <QRCode
                  value={displayAddress}
                  size={rs.s(200)}
                  backgroundColor={COLORS.cardBg}
                  color={mode === 'stealth' ? COLORS.stealth : COLORS.primary}
                />
              </View>
              
              {mode === 'stealth' && (
                <View style={styles.stealthBadge}>
                  <Lock size={rs.s(12)} color={COLORS.stealth} />
                  <Text style={styles.stealthBadgeText}>PO Box Address</Text>
                </View>
              )}
            </View>
          )}
          
          {/* Address Display */}
          <View style={styles.addressBox}>
            <Text style={styles.addressLabel}>
              {mode === 'standard' ? 'Your Kaspa Address' : 'Your PO Box Code'}
            </Text>
            <Text style={styles.addressText} selectable>{shortAddress}</Text>
            
            <View style={styles.addressActions}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleCopy}>
                {copied ? (
                  <CheckCircle size={rs.s(20)} color={COLORS.success} />
                ) : (
                  <Copy size={rs.s(20)} color={COLORS.primary} />
                )}
                <Text style={styles.actionBtnText}>{copied ? 'Copied!' : 'Copy'}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
                <ShareIcon size={rs.s(20)} color={COLORS.primary} />
                <Text style={styles.actionBtnText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Balance */}
          <View style={styles.balanceBox}>
            <Text style={styles.balanceLabel}>Current Balance</Text>
            <Text style={styles.balanceAmount}>{formatKAS(balance)}</Text>
            {kasPrice?.price ? (
              <Text style={styles.balanceUsd}>
                {String.fromCharCode(8776)} {'$' + (Number(balance) / 1e8 * kasPrice.price).toFixed(2)} USD
              </Text>
            ) : null}
          </View>
          
          {/* PO Box Section */}
          {mode === 'stealth' && (
            <>
              {/* Watcher Controls */}
              <View style={styles.watcherBox}>
                <View style={styles.watcherHeader}>
                  <Text style={styles.watcherTitle}>PO Box Watcher</Text>
                  <View style={[styles.watcherStatus, watcherActive && styles.watcherStatusActive]}>
                    <Text style={styles.watcherStatusText}>
                      {watcherActive ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>
                
                <Text style={styles.watcherDesc}>
                  The watcher scans the blockchain for payments sent to your PO Box addresses.
                </Text>
                
                <View style={styles.watcherActions}>
                  <TouchableOpacity
                    style={[styles.watcherBtn, watcherActive && styles.watcherBtnActive]}
                    onPress={handleToggleWatcher}
                  >
                    {watcherActive ? (
                      <BellOff size={rs.s(18)} color={COLORS.text} />
                    ) : (
                      <Bell size={rs.s(18)} color={COLORS.stealth} />
                    )}
                    <Text style={[styles.watcherBtnText, watcherActive && styles.watcherBtnTextActive]}>
                      {watcherActive ? 'Stop' : 'Start'} Watcher
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.scanBtn}
                    onPress={handleScan}
                    disabled={scanning}
                  >
                    {scanning ? (
                      <ActivityIndicator size="small" color={COLORS.stealth} />
                    ) : (
                      <RefreshCw size={rs.s(18)} color={COLORS.stealth} />
                    )}
                    <Text style={styles.scanBtnText}>Scan Now</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* PO Box Payments List */}
              {stealthPayments.length > 0 && (
                <View style={styles.paymentsBox}>
                  <Text style={styles.paymentsTitle}>PO Box Payments ({stealthPayments.length})</Text>
                  {stealthPayments.slice(0, 5).map((p, i) => (
                    <View key={p.txId + ':' + p.outputIndex} style={styles.paymentItem}>
                      <View style={styles.paymentLeft}>
                        <Lock size={rs.s(14)} color={COLORS.stealth} />
                        <View>
                          <Text style={styles.paymentAmount}>{formatKAS(p.amountSompi)}</Text>
                          <Text style={styles.paymentTxId}>{p.txId.slice(0, 16)}...</Text>
                        </View>
                      </View>
                      <Text style={[styles.paymentStatus, p.spent && styles.paymentStatusSpent]}>
                        {p.spent ? 'Spent' : 'Available'}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              
              {/* PO Box Info */}
              <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>How PO Box Works</Text>
                <Text style={styles.infoText}>
                  {'\u2022'} Share your PO Box address with the sender{'\n'}
                  {'\u2022'} They create a one-time address just for you{'\n'}
                  {'\u2022'} Only you can detect and spend the payment{'\n'}
                  {'\u2022'} The sender's address is still visible on chain
                </Text>
              </View>
            </>
          )}
          
          {/* Standard Info */}
          {mode === 'standard' && (
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Standard Address</Text>
              <Text style={styles.infoText}>
                Your standard Kaspa address is public. Anyone can see your balance and transaction history.
                {'\n\n'}
                For private payments, switch to PO Box mode.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: rs.s(16), borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle: { fontSize: rs.font(20), fontWeight: 'bold', color: COLORS.text },
  content: { flex: 1, padding: rs.s(16) },
  
  modeToggle: { flexDirection: 'row', backgroundColor: COLORS.cardBg, borderRadius: rs.s(12), padding: rs.s(4), marginBottom: rs.s(20) },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs.s(6), padding: rs.s(12), borderRadius: rs.s(8) },
  modeBtnActive: { backgroundColor: '#49d6aa20' },
  modeBtnActiveStealth: { backgroundColor: '#8b5cf620' },
  modeBtnText: { color: COLORS.textMuted, fontSize: rs.font(14), fontWeight: '500' },
  modeBtnTextActive: { color: COLORS.primary },
  modeBtnTextActiveStealth: { color: COLORS.stealth },
  
  qrContainer: { alignItems: 'center', marginBottom: rs.s(20) },
  qrWrapper: { padding: rs.s(16), backgroundColor: COLORS.cardBg, borderRadius: rs.s(16), borderWidth: 2, borderColor: COLORS.primary },
  qrWrapperStealth: { borderColor: COLORS.stealth },
  stealthBadge: { flexDirection: 'row', alignItems: 'center', gap: rs.s(4), marginTop: rs.s(8), paddingHorizontal: rs.s(12), paddingVertical: rs.s(4), backgroundColor: '#8b5cf620', borderRadius: rs.s(12) },
  stealthBadgeText: { color: COLORS.stealth, fontSize: rs.font(11) },
  
  addressBox: { backgroundColor: COLORS.cardBg, borderRadius: rs.s(12), padding: rs.s(16), marginBottom: rs.s(16) },
  addressLabel: { color: COLORS.textMuted, fontSize: rs.font(12), marginBottom: rs.s(8) },
  addressText: { color: COLORS.text, fontSize: rs.font(14), fontFamily: 'monospace' },
  addressActions: { flexDirection: 'row', gap: rs.s(12), marginTop: rs.s(12) },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs.s(6), padding: rs.s(10), backgroundColor: '#49d6aa10', borderRadius: rs.s(8) },
  actionBtnText: { color: COLORS.primary, fontSize: rs.font(13), fontWeight: '500' },
  
  balanceBox: { backgroundColor: COLORS.cardBg, borderRadius: rs.s(12), padding: rs.s(16), marginBottom: rs.s(16), alignItems: 'center' },
  balanceLabel: { color: COLORS.textMuted, fontSize: rs.font(12) },
  balanceAmount: { color: COLORS.text, fontSize: rs.font(28), fontWeight: 'bold', marginTop: rs.s(4) },
  balanceUsd: { color: COLORS.textMuted, fontSize: rs.font(14), marginTop: rs.s(4) },
  
  watcherBox: { backgroundColor: COLORS.cardBg, borderRadius: rs.s(12), padding: rs.s(16), marginBottom: rs.s(16) },
  watcherHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs.s(8) },
  watcherTitle: { color: COLORS.text, fontSize: rs.font(14), fontWeight: '600' },
  watcherStatus: { paddingHorizontal: rs.s(8), paddingVertical: rs.s(2), backgroundColor: '#e74c3c40', borderRadius: rs.s(8) },
  watcherStatusActive: { backgroundColor: '#2ecc7140' },
  watcherStatusText: { color: COLORS.text, fontSize: rs.font(10) },
  watcherDesc: { color: COLORS.textMuted, fontSize: rs.font(12), marginBottom: rs.s(12) },
  watcherActions: { flexDirection: 'row', gap: rs.s(12) },
  watcherBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs.s(6), padding: rs.s(12), backgroundColor: '#8b5cf620', borderRadius: rs.s(8) },
  watcherBtnActive: { backgroundColor: '#e74c3c40' },
  watcherBtnText: { color: COLORS.stealth, fontSize: rs.font(13), fontWeight: '500' },
  watcherBtnTextActive: { color: '#e74c3c' },
  scanBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs.s(6), padding: rs.s(12), borderWidth: 1, borderColor: COLORS.stealth, borderRadius: rs.s(8) },
  scanBtnText: { color: COLORS.stealth, fontSize: rs.font(13), fontWeight: '500' },
  
  paymentsBox: { backgroundColor: COLORS.cardBg, borderRadius: rs.s(12), padding: rs.s(16), marginBottom: rs.s(16) },
  paymentsTitle: { color: COLORS.text, fontSize: rs.font(14), fontWeight: '600', marginBottom: rs.s(12) },
  paymentItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: rs.s(8), borderBottomWidth: 1, borderBottomColor: COLORS.border },
  paymentLeft: { flexDirection: 'row', alignItems: 'center', gap: rs.s(8) },
  paymentAmount: { color: COLORS.text, fontSize: rs.font(14), fontWeight: '600' },
  paymentTxId: { color: COLORS.textMuted, fontSize: rs.font(10) },
  paymentStatus: { color: COLORS.success, fontSize: rs.font(11) },
  paymentStatusSpent: { color: COLORS.textMuted },
  
  infoBox: { backgroundColor: COLORS.cardBg, borderRadius: rs.s(12), padding: rs.s(16), marginBottom: rs.s(24) },
  infoTitle: { color: COLORS.text, fontSize: rs.font(14), fontWeight: '600', marginBottom: rs.s(8) },
  infoText: { color: COLORS.textMuted, fontSize: rs.font(12), lineHeight: rs.font(18) },
});

export default ReceiveScreen;