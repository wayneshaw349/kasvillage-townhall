// ============================================================================
// KASVILLAGE EXPO - SEND KAS COMPONENT (WITH STEALTH)
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Dimensions,
  PixelRatio,
  Modal,
  Alert,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';
import { useKaspaPrice } from './useKaspaPrice';
import {
  X,
  Send,
  Clipboard as ClipboardIcon,
  Shield,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Wallet,
} from 'lucide-react-native';

import {
  sendKASWithHybridSig,

  formatKAS,
  isValidKaspaAddress as validateKaspaAddress,
  TransactionResult,
} from './kasvillage_cold_wallet';

import {
  createStealthPayment,
  StealthPaymentData,
} from './stealth_watcher';

// ============================================================================
// RESPONSIVE SCALER
// ============================================================================
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BASE_WIDTH = 393;
const scale = Math.min(SCREEN_WIDTH / BASE_WIDTH, 1.2);

const rs = {
  s: (size: number) => Math.round(size * scale),
  font: (size: number) => Math.round(size * scale * (PixelRatio.getFontScale() > 1 ? 0.9 : 1)),
};

// ============================================================================
// COLORS
// ============================================================================
const COLORS = {
  background: '#0a0a0a',
  cardBg: '#FFF8F0',
  white: '#FFFFFF',
  black: '#000000',
  
  stone50: '#fafaf9',
  stone100: '#f5f5f4',
  stone200: '#e7e5e4',
  stone300: '#d6d3d1',
  stone400: '#a8a29e',
  stone500: '#78716c',
  stone600: '#57534e',
  stone700: '#44403c',
  stone800: '#292524',
  stone900: '#1c1917',
  
  amber50: '#fffbeb',
  amber100: '#fef3c7',
  amber200: '#fde68a',
  amber500: '#f59e0b',
  amber600: '#d97706',
  amber700: '#b45309',
  amber800: '#92400e',
  amber900: '#78350f',
  
  green50: '#f0fdf4',
  green100: '#dcfce7',
  green500: '#22c55e',
  green600: '#16a34a',
  green700: '#15803d',
  
  red50: '#fef2f2',
  red100: '#fee2e2',
  red500: '#ef4444',
  red600: '#dc2626',
  red700: '#b91c1c',
  
  indigo50: '#eef2ff',
  indigo100: '#e0e7ff',
  indigo500: '#6366f1',
  indigo600: '#4f46e5',
  indigo700: '#4338ca',
  
  purple500: '#a855f7',
  purple600: '#9333ea',
};

// ============================================================================
// TYPES
// ============================================================================
export interface SendKASProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (txId: string) => void;
  onBalanceRefresh?: () => Promise<void>;
  initialAddress?: string;
  initialAmount?: number;
  myAddress: string;
}

type SendStep = 'input' | 'preview' | 'sending' | 'success' | 'error';
type RecipientType = 'address' | 'apt' | 'stealth';

interface ResolvedRecipient {
  type: RecipientType;
  address: string | null;
  aptAlias?: string;
  displayName?: string;
  scanPubkey?: string;
  spendPubkey?: string;
  stealthPayment?: StealthPaymentData;
}

interface TransactionPreview {
  toAddress: string;
  amountSompi: bigint;
  amountKas: number;
  estimatedFee: bigint;
  total: bigint;
  isStealthPayment?: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

function isValidKaspaAddress(input: string): boolean {
  return validateKaspaAddress(input);
}

function kasToSompi(kas: number): bigint {
  return BigInt(Math.floor(kas * 100_000_000));
}

function sompiToKas(sompi: bigint): number {
  return Number(sompi) / 100_000_000;
}

function isStealthInput(input: string): boolean {
  if (!input.startsWith('kaspa:')) return false;
  const parts = input.split(':');
  return parts.length === 3 && parts[1].length === 66 && parts[2].length === 66;
}

function parseStealthInput(input: string): { scanPubkey: string; spendPubkey: string } | null {
  if (!isStealthInput(input)) return null;
  const parts = input.split(':');
  return { scanPubkey: parts[1], spendPubkey: parts[2] };
}

function isAptInput(input: string): boolean {
  const trimmed = input.trim();
  return /^\d{1,6}$/.test(trimmed) || /^APT[- ]?\d{1,6}$/i.test(trimmed);
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export const SendKAS: React.FC<SendKASProps> = ({
  visible,
  onClose,
  onSuccess,
  onBalanceRefresh,
  initialAddress,
  initialAmount,
  myAddress,
}) => {
  const [recipientInput, setRecipientInput] = useState(initialAddress || '');
  const [vaultAddr, setVaultAddr] = useState<string | null>(null);
  const [hotAddr, setHotAddr] = useState<string | null>(null);
  const [frostAddr, setFrostAddr] = useState<string | null>(null);
  const [amountKas, setAmountKas] = useState(initialAmount ? String(initialAmount / 100000000) : '');
  const [memo, setMemo] = useState('');
  const [useStealthAddress, setUseStealthAddress] = useState(false);
  
  const [resolved, setResolved] = useState<ResolvedRecipient | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  
  const [step, setStep] = useState<SendStep>('input');
  const [isLoading, setIsLoading] = useState(false);
  const [showAmountInSompi, setShowAmountInSompi] = useState(false);
  const [balance, setBalance] = useState<bigint>(0n);
  const { usdPerKas } = useKaspaPrice();
  const [preview, setPreview] = useState<TransactionPreview | null>(null);
  const [txId, setTxId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stealthData, setstealthData] = useState<StealthPaymentData | null>(null);
  
  const inputIsAddress = isValidKaspaAddress(recipientInput);
  const inputIsStealth = isStealthInput(recipientInput);
  const inputValid = resolved !== null && resolved.address !== null;
  
  useEffect(() => {
    if (inputIsStealth) setUseStealthAddress(true);
  }, [inputIsStealth]);
  
  useEffect(() => {
    const loadBalance = async () => {
      if (myAddress) {
        try {
          // Load raw L1 balance
          const prefix = myAddress.startsWith('kaspatest:') ? 'api-tn10' : 'api';
          const resp = await fetch('https://' + prefix + '.kaspa.org/addresses/' + myAddress + '/balance');
          if (resp.ok) {
            const data = await resp.json();
            const total = BigInt(data.balance || '0');
            // Get spendable from ledger (excludes committed + IOU)
            try {
              const { syncLedger } = await import('./utxo_ledger');
              const ledger = await syncLedger(myAddress);
              setBalance(ledger.spendableBalance > 0n ? ledger.spendableBalance : total);
            } catch {
              setBalance(total); // fallback to raw
            }
          }
        } catch (e) {
          console.warn('Failed to load balance:', e);
        }
      }
    };
    loadBalance();
  }, [myAddress]);
  
  useEffect(() => {
    const resolveInput = async () => {
      if (!recipientInput.trim()) {
        setResolved(null);
        setstealthData(null);
        return;
      }
      
      setIsResolving(true);
      setError(null);
      
      if (isStealthInput(recipientInput)) {
        const stealthParts = parseStealthInput(recipientInput);
        if (stealthParts) {
          try {
            const payment = await createStealthPayment(stealthParts.scanPubkey, stealthParts.spendPubkey);
            setstealthData(payment);
            setResolved({
              type: 'stealth',
              address: payment.oneTimeAddress,
              scanPubkey: stealthParts.scanPubkey,
              spendPubkey: stealthParts.spendPubkey,
              stealthPayment: payment,
            });
          } catch {
            setError('Invalid PO Box address');
            setResolved(null);
          }
        }
        setIsResolving(false);
        return;
      }
      
      if (isValidKaspaAddress(recipientInput)) {
        setResolved({ type: 'address', address: recipientInput });
        setIsResolving(false);
        return;
      }
      
      // TODO: APT resolution via TownHall
      if (isAptInput(recipientInput)) {
        setError('APT resolution not yet implemented');
        setResolved(null);
      } else if (recipientInput.length > 2) {
        setError('Invalid address format');
        setResolved(null);
      }
      
      setIsResolving(false);
    };
    
    const timer = setTimeout(resolveInput, 300);
    return () => clearTimeout(timer);
  }, [recipientInput, useStealthAddress]);
  
  useEffect(() => {
    if (!visible) {
      setStep('input');
      setRecipientInput(initialAddress || '');
      setAmountKas(initialAmount ? String(initialAmount / 100000000) : '');
      setMemo('');
      setUseStealthAddress(false);
      setResolved(null);
      setstealthData(null);
      setPreview(null);
      setTxId(null);
      setError(null);
    }
  }, [visible, initialAddress, initialAmount]);
  
  useEffect(() => {
    (async () => {
      try {
        const [v, h, fr] = await Promise.all([
          SecureStore.getItemAsync('kv_vault_address'),
          SecureStore.getItemAsync('kv_kaspa_address'),
          SecureStore.getItemAsync('kv_frost_vault_address'),
        ]);
        setVaultAddr(v);
        setHotAddr(h);
        setFrostAddr(fr);
      } catch {}
    })();
  }, [visible]);

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) setRecipientInput(text.trim());
  };
  
  const amountSompi = kasToSompi(parseFloat(amountKas || '0'));
  const canProceed = inputValid && amountSompi > 0n && amountSompi <= balance && !isResolving;
  
  const handlePreview = async () => {
    if (!resolved?.address) return;
    
    setIsLoading(true);
    setError(null);
    
    const estimatedFee = 3000n; // ~0.00003 KAS typical fee
    const total = amountSompi + estimatedFee;
    
    if (total > balance) {
      setError(`Insufficient balance. Need ${formatKAS(total)} KAS (including fee)`);
      setIsLoading(false);
      return;
    }
    
    setPreview({
      toAddress: resolved.address,
      amountSompi,
      amountKas: sompiToKas(amountSompi),
      estimatedFee,
      total,
      isStealthPayment: resolved.type === 'stealth',
    });
    setStep('preview');
    setIsLoading(false);
  };
  
  const handleSend = async () => {
    if (!preview || !resolved?.address) return;
    
    setStep('sending');
    setIsLoading(true);
    
    try {
      const result: TransactionResult = await sendKASWithHybridSig(
        resolved.address,
        amountSompi,
        memo || undefined
      );
      
      if (result.success && result.kaspaTxId) {
        setTxId(result.kaspaTxId);
        setStep('success');
        if (onSuccess) onSuccess(result.kaspaTxId);
        // Refresh balance after successful send
        setTimeout(() => { onBalanceRefresh?.(); }, 2000);
      } else {
        setError(result.error || 'Transaction failed');
        setStep('error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setStep('error');
    }
    
    setIsLoading(false);
  };
  
  const displayBalance = formatKAS(balance);
  
  const getRecipientTypeLabel = (): string => {
    if (!resolved) return '';
    switch (resolved.type) {
      case 'stealth': return '🔒 PO Box';
      case 'apt': return '🏠 APT';
      case 'address': return '📍 Address';
    }
  };
  
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay} onStartShouldSetResponder={() => { Keyboard.dismiss(); return false; }}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Send size={rs.s(24)} color={COLORS.amber600} />
              <Text style={styles.headerTitle}>Send KASPA</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={rs.s(24)} color={COLORS.stone400} />
            </TouchableOpacity>
          </View>
          
          {/* Balance */}
          <View style={styles.balanceBar}>
            <Wallet size={rs.s(18)} color={COLORS.amber600} />
            <View>
              <Text style={styles.balanceAmount}>{displayBalance} KASPA</Text>
            <Text style={{ fontSize: 10, color: '#16a34a', fontWeight: 'bold' }}>Spendable</Text>
              {usdPerKas ? (
                <Text style={styles.balanceUsd}>
                  {String.fromCharCode(8776)} {'$' + (sompiToKas(balance) * usdPerKas).toFixed(2)} USD
                </Text>
              ) : null}
            </View>
          </View>
          
          {/* Step: Input */}
          {step === 'input' && (
            <View style={styles.content}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Send To</Text>
                <View style={styles.sendToChips}>
                  {[
                    { label: 'Vault', addr: vaultAddr },
                    { label: 'Hot/Shopping', addr: hotAddr },
                    { label: 'FROST Vault', addr: frostAddr },
                  ].map(({ label, addr }) => {
                    if (!addr) return null;
                    const isSelf = addr === myAddress;
                    return (
                      <TouchableOpacity
                        key={label}
                        style={[styles.sendToChip, isSelf && styles.sendToChipDisabled]}
                        disabled={isSelf}
                        onPress={() => setRecipientInput(addr)}
                      >
                        <Text style={[styles.sendToChipText, isSelf && styles.sendToChipTextDisabled]}>
                          {label}{isSelf ? ' (this wallet)' : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.addressInputRow}>
                  <TextInput
                    style={[
                      styles.addressInput,
                      inputValid && styles.inputValid,
                      inputValid && resolved?.type === 'stealth' && styles.inputValidStealth,
                      (recipientInput.length > 2 && !inputValid && !isResolving) && styles.inputInvalid,
                    ]}
                    value={recipientInput}
                    onChangeText={setRecipientInput}
                    placeholder="APT (303), kaspa:..."
                    placeholderTextColor={COLORS.stone400}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity style={styles.pasteBtn} onPress={handlePaste}>
                    <ClipboardIcon size={rs.s(20)} color={COLORS.amber600} />
                  </TouchableOpacity>
                </View>
                
                {isResolving && (
                  <View style={styles.resolvingRow}>
                    <ActivityIndicator size="small" color={COLORS.amber500} />
                    <Text style={styles.resolvingText}>Looking up recipient...</Text>
                  </View>
                )}
                
                {inputValid && resolved?.type === 'stealth' && (
                  <View style={styles.resolvedBoxStealth}>
                    <View style={styles.resolvedHeader}>
                      <Shield size={rs.s(16)} color={COLORS.purple600} />
                      <Text style={styles.resolvedStealth}>PO Box Payment</Text>
                    </View>
                    <Text style={styles.stealthExplainer}>
                      Funds sent to one-time address. Recipient scans to claim.
                    </Text>
                    <Text style={styles.resolvedAddress} numberOfLines={1}>
                      → {resolved.address}
                    </Text>
                  </View>
                )}
                
                {inputValid && resolved?.type === 'address' && (
                  <View style={styles.resolvedBox}>
                    <Text style={styles.resolvedDirect}>✓ Valid Kaspa address</Text>
                  </View>
                )}
                
                {!isResolving && recipientInput.length > 2 && !inputValid && error && (
                  <Text style={styles.errorText}>{error}</Text>
                )}
              </View>
              
              {/* Amount */}
              <View style={styles.inputGroup}>
                <View style={styles.amountHeader}>
                  <Text style={styles.inputLabel}>Amount</Text>
                  <TouchableOpacity onPress={() => setShowAmountInSompi(!showAmountInSompi)}>
                    <Text style={styles.toggleUnit}>{showAmountInSompi ? 'Show KASPA' : 'Show Sompi'}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.amountInputRow}>
                  <TextInput
                    style={styles.amountInput}
                    value={amountKas}
                    onChangeText={setAmountKas}
                    placeholder="0.00"
                    placeholderTextColor={COLORS.stone400}
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.amountUnit}>KASPA</Text>
                </View>
                {showAmountInSompi && amountSompi > 0n && (
                  <Text style={styles.sompiText}>{amountSompi.toString()} sompi</Text>
                )}
                {amountSompi > balance && (
                  <Text style={styles.errorText}>Insufficient balance</Text>
                )}
                
                <View style={styles.quickAmounts}>
                  {[0.25, 0.5, 0.75, 1].map(pct => (
                    <TouchableOpacity
                      key={pct}
                      style={styles.quickAmountBtn}
                      onPress={() => setAmountKas(sompiToKas(BigInt(Math.floor(Number(balance) * pct))).toString())}
                    >
                      <Text style={styles.quickAmountText}>{pct * 100}%</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              {/* Memo */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Memo (optional)</Text>
                <TextInput
                  style={styles.memoInput}
                  value={memo}
                  onChangeText={setMemo}
                  placeholder="Add a note..."
                  placeholderTextColor={COLORS.stone400}
                  maxLength={100}
                />
              </View>
              
              {inputIsStealth && (
                <View style={styles.stealthAutoEnabled}>
                  <Shield size={rs.s(16)} color={COLORS.purple600} />
                  <Text style={styles.stealthAutoText}>
                    {'PO Box mode auto-enabled for kaspa: addresses'}
                  </Text>
                </View>
              )}
              
              {/* Continue Button */}
              <TouchableOpacity
                style={[styles.primaryBtn, !canProceed && styles.primaryBtnDisabled]}
                onPress={handlePreview}
                disabled={!canProceed || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <>
                    <Text style={styles.primaryBtnText}>Preview Transaction</Text>
                    <ArrowRight size={rs.s(18)} color={COLORS.white} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
          
          {/* Step: Preview */}
          {step === 'preview' && preview && resolved && (
            <View style={styles.content}>
              <View style={styles.previewCard}>
                <Text style={styles.previewTitle}>Transaction Preview</Text>
                
                <View style={[styles.recipientTypeBadge, resolved.type === 'stealth' && styles.recipientTypeBadgeStealth]}>
                  <Text style={styles.recipientTypeText}>{getRecipientTypeLabel()}</Text>
                </View>
                
                {resolved.type === 'stealth' && (
                  <View style={styles.previewStealthBox}>
                    <Shield size={rs.s(20)} color={COLORS.purple600} />
                    <Text style={styles.previewStealthLabel}>PO Box Payment</Text>
                    <Text style={styles.previewstealthDesc}>One-time address generated</Text>
                  </View>
                )}
                
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>
                    {resolved.type === 'stealth' ? 'One-Time Address' : 'To'}
                  </Text>
                  <Text style={styles.previewAddress} numberOfLines={2}>
                    {preview.toAddress}
                  </Text>
                </View>
                
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Amount</Text>
                  <Text style={styles.previewAmount}>{preview.amountKas.toFixed(8)} KASPA</Text>
                </View>
                
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Network Fee</Text>
                  <Text style={styles.previewFee}>{formatKAS(preview.estimatedFee)} KAS</Text>
                </View>
                
                <View style={styles.previewDivider} />
                
                <View style={styles.previewRow}>
                  <Text style={styles.previewTotalLabel}>Total</Text>
                  <Text style={styles.previewTotal}>{formatKAS(preview.total)} KAS</Text>
                </View>
              </View>
              
              {memo && (
                <View style={styles.memoPreview}>
                  <Text style={styles.memoPreviewLabel}>Memo</Text>
                  <Text style={styles.memoPreviewText}>{memo}</Text>
                </View>
              )}
              
              <View style={styles.warningBox}>
                <AlertTriangle size={rs.s(16)} color={COLORS.amber600} />
                <Text style={styles.warningText}>
                  Review carefully. Transactions cannot be reversed.
                </Text>
              </View>
              
              <View style={styles.previewButtons}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setStep('input')}>
                  <Text style={styles.backBtnText}>Back</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.confirmBtn, resolved.type === 'stealth' && styles.confirmBtnStealth]}
                  onPress={handleSend}
                >
                  <Text style={styles.confirmBtnText}>Confirm & Send</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          {/* Step: Sending */}
          {step === 'sending' && (
            <View style={styles.statusContainer}>
              <ActivityIndicator size="large" color={COLORS.amber500} />
              <Text style={styles.statusTitle}>Sending...</Text>
              <Text style={styles.statusSubtitle}>
                {resolved?.type === 'stealth' 
                  ? 'Creating PO Box payment and broadcasting'
                  : 'Authenticating and broadcasting transaction'}
              </Text>
            </View>
          )}
          
          {/* Step: Success */}
          {step === 'success' && txId && (
            <View style={styles.statusContainer}>
              <View style={[styles.successIcon, resolved?.type === 'stealth' && styles.successIconStealth]}>
                {resolved?.type === 'stealth' ? (
                  <Shield size={rs.s(48)} color={COLORS.purple500} />
                ) : (
                  <CheckCircle size={rs.s(48)} color={COLORS.green500} />
                )}
              </View>
              <Text style={styles.successTitle}>
                {resolved?.type === 'stealth' ? 'PO Box Payment Sent!' : 'Transaction Sent!'}
              </Text>
              <Text style={styles.successAmount}>{preview?.amountKas.toFixed(8)} KASPA</Text>
              
              <View style={styles.txIdBox}>
                <Text style={styles.txIdLabel}>Transaction ID</Text>
                <Text style={styles.txIdValue} numberOfLines={1}>{txId}</Text>
                <TouchableOpacity
                  style={styles.copyTxBtn}
                  onPress={() => {
                    Clipboard.setStringAsync(txId);
                    Alert.alert('Copied', 'Transaction ID copied to clipboard');
                  }}
                >
                  <ClipboardIcon size={rs.s(14)} color={COLORS.amber600} />
                  <Text style={styles.copyTxText}>Copy</Text>
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {/* Step: Error */}
          {step === 'error' && (
            <View style={styles.statusContainer}>
              <View style={styles.errorIcon}>
                <AlertTriangle size={rs.s(48)} color={COLORS.red500} />
              </View>
              <Text style={styles.errorTitle}>Transaction Failed</Text>
              <Text style={styles.errorMessage}>{error}</Text>
              
              <View style={styles.errorButtons}>
                <TouchableOpacity style={styles.retryBtn} onPress={() => { setStep('input'); setError(null); }}>
                  <Text style={styles.retryBtnText}>Try Again</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modal: { backgroundColor: COLORS.cardBg, borderTopLeftRadius: rs.s(24), borderTopRightRadius: rs.s(24), maxHeight: '90%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: rs.s(20), borderBottomWidth: 1, borderBottomColor: COLORS.stone200 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: rs.s(10) },
  headerTitle: { fontSize: rs.font(20), fontWeight: '900', color: COLORS.stone900 },
  closeBtn: { padding: rs.s(4) },
  balanceBar: { flexDirection: 'row', alignItems: 'center', gap: rs.s(8), paddingHorizontal: rs.s(20), paddingVertical: rs.s(12), backgroundColor: COLORS.stone100 },
  balanceAmount: { fontSize: rs.font(18), fontWeight: 'bold', color: COLORS.stone800 },
  balanceUsd: { fontSize: rs.font(13), color: COLORS.stone500, marginTop: rs.s(2) },
  content: { padding: rs.s(20) },
  inputGroup: { marginBottom: rs.s(20) },
  inputLabel: { fontSize: rs.font(12), fontWeight: 'bold', color: COLORS.stone600, marginBottom: rs.s(8) },
  addressInputRow: { flexDirection: 'row', gap: rs.s(8) },
  addressInput: { flex: 1, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.stone200, borderRadius: rs.s(12), paddingHorizontal: rs.s(14), paddingVertical: rs.s(14), fontSize: rs.font(13), fontFamily: 'monospace', color: COLORS.stone800 },
  inputValid: { borderColor: COLORS.green500, backgroundColor: COLORS.green50 },
  inputValidStealth: { borderColor: COLORS.purple500, backgroundColor: COLORS.indigo50 },
  inputInvalid: { borderColor: COLORS.red500, backgroundColor: COLORS.red50 },
  pasteBtn: { width: rs.s(48), backgroundColor: COLORS.amber100, borderRadius: rs.s(12), justifyContent: 'center', alignItems: 'center' },
  amountHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleUnit: { fontSize: rs.font(11), color: COLORS.amber600 },
  amountInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.stone200, borderRadius: rs.s(12), paddingHorizontal: rs.s(14) },
  amountInput: { flex: 1, paddingVertical: rs.s(14), fontSize: rs.font(24), fontWeight: 'bold', color: COLORS.stone800 },
  amountUnit: { fontSize: rs.font(16), fontWeight: 'bold', color: COLORS.amber600 },
  sompiText: { fontSize: rs.font(11), color: COLORS.stone500, marginTop: rs.s(4), fontFamily: 'monospace' },
  resolvingRow: { flexDirection: 'row', alignItems: 'center', gap: rs.s(8), marginTop: rs.s(8) },
  resolvingText: { fontSize: rs.font(12), color: COLORS.stone500 },
  resolvedBox: { backgroundColor: COLORS.green50, borderRadius: rs.s(10), padding: rs.s(12), marginTop: rs.s(8), borderWidth: 1, borderColor: COLORS.green500 },
  resolvedBoxStealth: { backgroundColor: COLORS.indigo50, borderRadius: rs.s(10), padding: rs.s(12), marginTop: rs.s(8), borderWidth: 1, borderColor: COLORS.purple500 },
  resolvedHeader: { flexDirection: 'row', alignItems: 'center', gap: rs.s(8), marginBottom: rs.s(4) },
  resolvedStealth: { fontSize: rs.font(16), fontWeight: '900', color: COLORS.purple600 },
  stealthExplainer: { fontSize: rs.font(11), color: COLORS.stone500, marginBottom: rs.s(4) },
  resolvedAddress: { fontSize: rs.font(10), fontFamily: 'monospace', color: COLORS.stone500 },
  resolvedDirect: { fontSize: rs.font(12), fontWeight: 'bold', color: COLORS.green700 },
  errorText: { fontSize: rs.font(11), color: COLORS.red600, marginTop: rs.s(4) },
  quickAmounts: { flexDirection: 'row', gap: rs.s(8), marginTop: rs.s(12) },
  quickAmountBtn: { flex: 1, backgroundColor: COLORS.stone100, borderRadius: rs.s(8), paddingVertical: rs.s(8), alignItems: 'center' },
  quickAmountText: { fontSize: rs.font(11), fontWeight: 'bold', color: COLORS.stone600 },
  sendToChips: { flexDirection: 'row', gap: rs.s(8), marginBottom: rs.s(8) },
  sendToChip: { backgroundColor: COLORS.amber100, borderRadius: rs.s(8), paddingHorizontal: rs.s(12), paddingVertical: rs.s(6), borderWidth: 1, borderColor: COLORS.amber500 },
  sendToChipDisabled: { backgroundColor: COLORS.stone100, borderColor: COLORS.stone300 },
  sendToChipText: { fontSize: rs.font(12), fontWeight: 'bold', color: COLORS.amber700 },
  sendToChipTextDisabled: { color: COLORS.stone400 },
  memoInput: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.stone200, borderRadius: rs.s(12), paddingHorizontal: rs.s(14), paddingVertical: rs.s(12), fontSize: rs.font(14), color: COLORS.stone800 },
  stealthOption: { flexDirection: 'row', alignItems: 'center', gap: rs.s(12), backgroundColor: COLORS.stone50, borderRadius: rs.s(12), padding: rs.s(14), marginBottom: rs.s(20) },
  stealthAutoEnabled: { flexDirection: 'row', alignItems: 'center', gap: rs.s(8), backgroundColor: COLORS.indigo100, borderRadius: rs.s(12), padding: rs.s(14), marginBottom: rs.s(20) },
  stealthAutoText: { fontSize: rs.font(12), color: COLORS.purple600, fontWeight: '600' },
  checkbox: { width: rs.s(24), height: rs.s(24), borderRadius: rs.s(6), borderWidth: 2, borderColor: COLORS.stone300, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: COLORS.indigo500, borderColor: COLORS.indigo500 },
  stealthInfo: { flex: 1 },
  stealthTitle: { fontSize: rs.font(13), fontWeight: 'bold', color: COLORS.stone800 },
  stealthDesc: { fontSize: rs.font(11), color: COLORS.stone500, marginTop: rs.s(2) },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs.s(8), backgroundColor: COLORS.amber600, borderRadius: rs.s(14), paddingVertical: rs.s(16) },
  primaryBtnDisabled: { backgroundColor: COLORS.stone300 },
  primaryBtnText: { fontSize: rs.font(16), fontWeight: 'bold', color: COLORS.white },
  previewCard: { backgroundColor: COLORS.white, borderRadius: rs.s(16), padding: rs.s(20), marginBottom: rs.s(16) },
  previewTitle: { fontSize: rs.font(16), fontWeight: 'bold', color: COLORS.stone800, marginBottom: rs.s(16) },
  recipientTypeBadge: { alignSelf: 'flex-start', backgroundColor: COLORS.stone100, borderRadius: rs.s(8), paddingHorizontal: rs.s(10), paddingVertical: rs.s(4), marginBottom: rs.s(12) },
  recipientTypeBadgeStealth: { backgroundColor: COLORS.indigo100 },
  recipientTypeText: { fontSize: rs.font(11), fontWeight: 'bold', color: COLORS.stone700 },
  previewStealthBox: { backgroundColor: COLORS.indigo100, borderRadius: rs.s(12), padding: rs.s(14), marginBottom: rs.s(16), alignItems: 'center' },
  previewStealthLabel: { fontSize: rs.font(16), fontWeight: '900', color: COLORS.purple600, marginTop: rs.s(4) },
  previewstealthDesc: { fontSize: rs.font(11), color: COLORS.stone500, marginTop: rs.s(2) },
  previewRow: { marginBottom: rs.s(12) },
  previewLabel: { fontSize: rs.font(11), color: COLORS.stone500, marginBottom: rs.s(4) },
  previewAddress: { fontSize: rs.font(12), fontFamily: 'monospace', color: COLORS.stone800 },
  previewAmount: { fontSize: rs.font(24), fontWeight: '900', color: COLORS.amber600 },
  previewFee: { fontSize: rs.font(14), color: COLORS.stone600 },
  previewDivider: { height: 1, backgroundColor: COLORS.stone200, marginVertical: rs.s(12) },
  previewTotalLabel: { fontSize: rs.font(12), fontWeight: 'bold', color: COLORS.stone600, marginBottom: rs.s(4) },
  previewTotal: { fontSize: rs.font(20), fontWeight: '900', color: COLORS.stone900 },
  memoPreview: { backgroundColor: COLORS.stone100, borderRadius: rs.s(12), padding: rs.s(12), marginBottom: rs.s(16) },
  memoPreviewLabel: { fontSize: rs.font(10), color: COLORS.stone500, marginBottom: rs.s(4) },
  memoPreviewText: { fontSize: rs.font(13), color: COLORS.stone700 },
  warningBox: { flexDirection: 'row', alignItems: 'center', gap: rs.s(8), backgroundColor: COLORS.amber50, borderRadius: rs.s(12), padding: rs.s(12), marginBottom: rs.s(20) },
  warningText: { flex: 1, fontSize: rs.font(12), color: COLORS.amber700 },
  previewButtons: { flexDirection: 'row', gap: rs.s(12) },
  backBtn: { flex: 1, backgroundColor: COLORS.stone200, borderRadius: rs.s(14), paddingVertical: rs.s(14), alignItems: 'center' },
  backBtnText: { fontSize: rs.font(14), fontWeight: 'bold', color: COLORS.stone700 },
  confirmBtn: { flex: 2, backgroundColor: COLORS.green600, borderRadius: rs.s(14), paddingVertical: rs.s(14), alignItems: 'center' },
  confirmBtnStealth: { backgroundColor: COLORS.purple600 },
  confirmBtnText: { fontSize: rs.font(14), fontWeight: 'bold', color: COLORS.white },
  statusContainer: { padding: rs.s(40), alignItems: 'center' },
  statusTitle: { fontSize: rs.font(18), fontWeight: 'bold', color: COLORS.stone800, marginTop: rs.s(16) },
  statusSubtitle: { fontSize: rs.font(13), color: COLORS.stone500, marginTop: rs.s(8), textAlign: 'center' },
  successIcon: { width: rs.s(80), height: rs.s(80), backgroundColor: COLORS.green100, borderRadius: rs.s(40), justifyContent: 'center', alignItems: 'center' },
  successIconStealth: { backgroundColor: COLORS.indigo100 },
  successTitle: { fontSize: rs.font(22), fontWeight: '900', color: COLORS.green700, marginTop: rs.s(16) },
  successAmount: { fontSize: rs.font(28), fontWeight: '900', color: COLORS.amber600, marginTop: rs.s(8) },
  txIdBox: { backgroundColor: COLORS.stone100, borderRadius: rs.s(12), padding: rs.s(16), marginTop: rs.s(24), width: '100%', alignItems: 'center' },
  txIdLabel: { fontSize: rs.font(10), color: COLORS.stone500, marginBottom: rs.s(4) },
  txIdValue: { fontSize: rs.font(11), fontFamily: 'monospace', color: COLORS.stone700, marginBottom: rs.s(8) },
  copyTxBtn: { flexDirection: 'row', alignItems: 'center', gap: rs.s(4) },
  copyTxText: { fontSize: rs.font(12), color: COLORS.amber600, fontWeight: 'bold' },
  doneBtn: { backgroundColor: COLORS.amber600, borderRadius: rs.s(14), paddingVertical: rs.s(14), paddingHorizontal: rs.s(48), marginTop: rs.s(24) },
  doneBtnText: { fontSize: rs.font(16), fontWeight: 'bold', color: COLORS.white },
  errorIcon: { width: rs.s(80), height: rs.s(80), backgroundColor: COLORS.red100, borderRadius: rs.s(40), justifyContent: 'center', alignItems: 'center' },
  errorTitle: { fontSize: rs.font(22), fontWeight: '900', color: COLORS.red700, marginTop: rs.s(16) },
  errorMessage: { fontSize: rs.font(14), color: COLORS.stone600, marginTop: rs.s(8), textAlign: 'center' },
  errorButtons: { flexDirection: 'row', gap: rs.s(12), marginTop: rs.s(24) },
  retryBtn: { flex: 1, backgroundColor: COLORS.amber600, borderRadius: rs.s(14), paddingVertical: rs.s(14), alignItems: 'center' },
  retryBtnText: { fontSize: rs.font(14), fontWeight: 'bold', color: COLORS.white },
  cancelBtn: { flex: 1, backgroundColor: COLORS.stone200, borderRadius: rs.s(14), paddingVertical: rs.s(14), alignItems: 'center' },
  cancelBtnText: { fontSize: rs.font(14), fontWeight: 'bold', color: COLORS.stone700 },
});

export default SendKAS;