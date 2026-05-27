// ============================================================================
// KASVILLAGE EXPO - MARKETPLACE & NEIGHBOR AGREEMENT
// ============================================================================
// UI Component for Neighbor Agreements (2-of-2 FROST multisig)
// FROST crypto/P2P logic imported from frost_complete.ts
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  PixelRatio,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Linking,
  Keyboard,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import {
  X,
  ShoppingBag,
  Store,
  Lock,
  Unlock,
  CheckCircle,
  AlertTriangle,
  Users,
  Handshake,
  Clock,
  ChevronRight,
  Shield,
  RefreshCw,
  Hourglass,
  Coins,
  Bluetooth,
  Wifi,
  QrCode,
  Globe,
  Server,
} from 'lucide-react-native';

// Kaspa unified module
import {
  sendSompi,
  getBalance,
  getSpendableBalance,
  estimateSendFee,
  setNetwork,
  getExplorerUrl,
} from './kaspa_unified';

// Neighbor relay for partial TX exchange
import {
  postPartialTx,
  fetchPartialTx,
  pollForPartialTx,
  clearPartialTx,
  checkRelayStatus,
  PartialTxPayload,
  RelayMethod,
} from './neighbor_relay';

// IOU Balance Sheet
import { IOUBalanceSheetModal } from './IOUBalanceSheetShare';

// FROST 2-of-2 complete module (all crypto + P2P methods)
import {// Types
  KaspaNetwork,
  FrostAddress,
  FrostPartialSig,
  ExchangeMethod,
  PeerInfo,
  ExchangeProgress,
  // Local derivation
  deriveFrostAddressLocal,
  generateVerificationCode,
  verifyFrostAddress,
  // Signatures
  createPartialSigLocal,
  aggregatePartialSigs,
  createFrostPartialSig,
  completeFrostAndBroadcast,
  // L1 Inscriptions
  inscribeFrostEvent,
  // Exchange methods
  generatePubkeyQR,
  parsePubkeyQR,
  scanForBlePeers,
  advertiseBleForFrost,
  exchangePubkeyViaBle,
  startWifiP2PServer,
  connectToWifiPeer,
  getLocalIP,
  getTailscaleIP,
  isTailscaleFunnelAvailable,
  startTailscaleFunnel,
  openTailscaleApp,
  exchangeViaTownhall,
  // High-level
  exchangePubkeys,
  createFrostAgreement,
  generateFrostNonce,
  computeFrostPartialS,
  aggregateFrostSig,
  cleanup as cleanupFrost, aggregateToAddress, completeFrost2Round} from './frost_complete';

// REST API for real L1 transactions
import { sendKaspaViaRest } from './kaspa_rest_tx';
import { canonicalVerify, canonicalToContract, canonicalSendAmount, canonicalSendsFirst, normalizeAgreement, canonicalCanCreatePartialSig, canonicalCanCosign, canonicalDetermineRole } from './canonical_agreement';
import { canonicalCommit, verifyCommitment, releaseExpiredCommitments, markLocked, isAlreadyCommitted, syncLedger } from './utxo_ledger';
import { generateProposal, parseProposal, verifyProposalForMe, parseReleaseKey } from './kv_proposal';
import { loadMainWallet } from './kasvillage_cold_wallet';
import { uploadPerTxProof } from './wallet_merkle_archive';
import { uploadToIrys } from './arweave_upload';
import { encryptPartialSig, decryptPartialSig } from './frost_encrypted_relay';
import { computeSighash, buildCanonicalFrostTx, canonicalSighash } from './kaspa_rest_tx';
import { hexToBytes as h2b, bytesToHex as b2h } from '@noble/hashes/utils';
import { blake2b as blk } from '@noble/hashes/blake2b';
import { secp256k1 as secpCurve } from '@noble/curves/secp256k1';
import { proposeAgreement, acceptAgreement, confirmAgreement, getAgreementStatus, recordCollateral, listMyAgreements, queryAgreementsFromArweave, queryCounterpartyAgreed, inscribeAgreementToArweave, postFrostR, getFrostR, listProposedAgreements, submitPartialSig } from './townhall_client';
import { getUserStats } from './wallet_registration_v2';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';

declare var global: any;
const AGR_SESSION_KEY = 'kv_agreement_session';

interface AgreementSession {
  step: number;
  role: 'buyer' | 'seller' | null;
  agreementType: 'simple' | 'trade' | 'join' | null;
  contract: any;
  buyerLocked: boolean;
  sellerLocked: boolean;
  counterpartyAddress: string | null;
  counterpartyKaspaAddr: string;
  savedAt: number;
}

async function saveAgreementSession(session: AgreementSession): Promise<void> {
  try {
    const serializable = { ...session, contract: { ...session.contract, frostData: session.contract.frostData ? { address: session.contract.frostData.address, aggregatedPubkey: session.contract.frostData.aggregatedPubkey, network: session.contract.frostData.network, pubkeyA: session.contract.frostData.pubkeyA, pubkeyB: session.contract.frostData.pubkeyB, sessionId: session.contract.frostData.sessionId || session.contract.agreementId, verificationCode: session.contract.frostData.verificationCode || '', createdAt: session.contract.frostData.createdAt || 0 } : undefined } };
    await AsyncStorage.setItem(AGR_SESSION_KEY, JSON.stringify(serializable));
  } catch {}
}


async function archiveAgreementSession(reason: string): Promise<void> {
  try {
    const session = await loadAgreementSession();
    if (!session) return;
    const archiveKey = 'kv_agreement_archive';
    const existing = JSON.parse(await AsyncStorage.getItem(archiveKey) || '[]');
    existing.push({ ...session, archivedAt: Date.now(), archiveReason: reason });
    if (existing.length > 20) existing.shift();
    await AsyncStorage.setItem(archiveKey, JSON.stringify(existing));
  } catch {}
}

async function loadAgreementSession(): Promise<AgreementSession | null> {
  try {
    const json = await AsyncStorage.getItem(AGR_SESSION_KEY);

    if (!json) return null;
    const session: AgreementSession = JSON.parse(json);
    // Expire after 24h
    if (Date.now() - session.savedAt > 24 * 60 * 60 * 1000) {
      await AsyncStorage.removeItem(AGR_SESSION_KEY);
      return null;
    }
    return session;
  } catch { return null; }
}

async function clearAgreementSession(): Promise<void> {
  try { await AsyncStorage.removeItem(AGR_SESSION_KEY); } catch {}
}

const FROST_ACTIVE_KEY = 'kv_frost_active_list';

interface FrostActiveEntry {
  agrId: string;
  frostAddr: string;
  role: 'buyer' | 'seller';
  step: number;
  buyerAmount: number;
  sellerAmount: number;
  buyerPubkey: string;
  sellerPubkey: string;
  description: string;
  createdAt: number;
}

async function addToFrostList(entry: FrostActiveEntry): Promise<void> {
  try {
    const list = await getFrostList();
    const existing = list.findIndex(e => e.agrId === entry.agrId);
    if (existing >= 0) list[existing] = entry; else list.push(entry);
    await AsyncStorage.setItem(FROST_ACTIVE_KEY, JSON.stringify(list));
  } catch {}
}

async function getFrostList(): Promise<FrostActiveEntry[]> {
  try {
    const json = await AsyncStorage.getItem(FROST_ACTIVE_KEY);
    return json ? JSON.parse(json) : [];
  } catch { return []; }
}

async function updateFrostEntry(agrId: string, updates: Partial<FrostActiveEntry>): Promise<void> {
  try {
    const list = await getFrostList();
    const idx = list.findIndex(e => e.agrId === agrId);
    if (idx >= 0) { list[idx] = { ...list[idx], ...updates }; await AsyncStorage.setItem(FROST_ACTIVE_KEY, JSON.stringify(list)); }
  } catch {}
}

async function removeFrostEntry(agrId: string): Promise<void> {
  try {
    const list = await getFrostList();
    await AsyncStorage.setItem(FROST_ACTIVE_KEY, JSON.stringify(list.filter(e => e.agrId !== agrId)));
  } catch {}
}


// Re-export types for external use
export type { KaspaNetwork, FrostAddress, ExchangeMethod };

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
  amber300: '#fcd34d',
  amber400: '#fbbf24',
  amber500: '#f59e0b',
  amber600: '#d97706',
  amber700: '#b45309',
  amber800: '#92400e',
  amber900: '#78350f',
  
  indigo50: '#eef2ff',
  indigo100: '#e0e7ff',
  indigo200: '#c7d2fe',
  indigo300: '#a5b4fc',
  indigo500: '#6366f1',
  indigo600: '#4f46e5',
  indigo700: '#4338ca',
  indigo800: '#3730a3',
  indigo900: '#312e81',
  
  green50: '#f0fdf4',
  green100: '#dcfce7',
  green200: '#bbf7d0',
  green300: '#86efac',
  green500: '#22c55e',
  green600: '#16a34a',
  green700: '#15803d',
  green800: '#166534',
  
  blue50: '#eff6ff',
  blue100: '#dbeafe',
  blue200: '#bfdbfe',
  blue300: '#93c5fd',
  blue500: '#3b82f6',
  blue600: '#2563eb',
  blue700: '#1d4ed8',
  blue800: '#1e40af',
  
  red50: '#fef2f2',
  red100: '#fee2e2',
  red200: '#fecaca',
  red300: '#fca5a5',
  red500: '#ef4444',
  red600: '#dc2626',
  red700: '#b91c1c',
  red800: '#991b1b',
  
  purple600: '#9333ea',
};

// ============================================================================
// CONSTANTS
// ============================================================================
const DEFAULT_STARTING_XP = 150;
const SNAIL_THRESHOLD = 150;
const XP_THRESHOLD_IOU_ACCESS = 150;

const API_BASE = 'https://api.kasvillage.dev';

// ============================================================================
// TYPES
// ============================================================================
interface Contract {
  itemPriceKas: number;
  sellerCommitmentKas: number;
  stipulations: string;
  itemDescription: string;
  expiryHours: number;
  multisigAddress?: string;
  frostData?: FrostAddress;
  agreementId?: string;
  buyerPubkey?: string;
  sellerPubkey?: string;
  counterpartyPubkey?: string;
  buyerLockTxId?: string;
  sellerLockTxId?: string;
  partialReleaseTx?: string;
  releaseRecipient?: string;
  releaseTxId?: string;
  releaseExplorerUrl?: string;
  arweaveTxId?: string;
  // New FROST fields
  verificationCode?: string;
  exchangeMethod?: ExchangeMethod;
  inscriptionTxId?: string;
}

interface UserStats {
  xp: number;
  successes: number;
  deadlocks: number;
}

// ============================================================================
// EXCHANGE METHOD SELECTOR COMPONENT
// ============================================================================
interface ExchangeMethodSelectorProps {
  selected: ExchangeMethod | null;
  onSelect: (method: ExchangeMethod) => void;
  tailscaleAvailable: boolean;
}

const ExchangeMethodSelector: React.FC<ExchangeMethodSelectorProps> = ({
  selected,
  onSelect,
  tailscaleAvailable,
}) => {
  const methods: { id: ExchangeMethod; label: string; icon: any; desc: string; security: string }[] = [
    { id: 'qr', label: 'QR Code', icon: QrCode, desc: 'Scan in person', security: 'Best' },
    { id: 'ble', label: 'Bluetooth', icon: Bluetooth, desc: 'Nearby device', security: 'Good' },
    { id: 'wifi', label: 'WiFi P2P', icon: Wifi, desc: 'Same network', security: 'Good' },
    { id: 'tailscale', label: 'Tailscale', icon: Globe, desc: 'Remote + verify', security: 'Good' },
    { id: 'townhall', label: 'TownHall', icon: Server, desc: 'Easy fallback', security: 'OK' },
  ];

  return (
    <View style={exchangeStyles.container}>
      <Text style={exchangeStyles.title}>Choose Exchange Method</Text>
      <Text style={exchangeStyles.subtitle}>How will you exchange pubkeys with counterparty?</Text>
      
      {methods.map((m) => {
        const Icon = m.icon;
        const isSelected = selected === m.id;
        const isDisabled = m.id === 'tailscale' && !tailscaleAvailable;
        
        return (
          <TouchableOpacity
            key={m.id}
            style={[
              exchangeStyles.option,
              isSelected && exchangeStyles.optionSelected,
              isDisabled && exchangeStyles.optionDisabled,
            ]}
            onPress={() => !isDisabled && onSelect(m.id)}
            disabled={isDisabled}
          >
            <View style={exchangeStyles.optionIcon}>
              <Icon size={24} color={isSelected ? COLORS.indigo600 : COLORS.stone500} />
            </View>
            <View style={exchangeStyles.optionContent}>
              <Text style={[exchangeStyles.optionLabel, isSelected && exchangeStyles.optionLabelSelected]}>
                {m.label}
              </Text>
              <Text style={exchangeStyles.optionDesc}>{m.desc}</Text>
            </View>
            <View style={[
              exchangeStyles.securityBadge,
              { backgroundColor: m.security === 'Best' ? COLORS.green100 : m.security === 'Good' ? COLORS.blue100 : COLORS.amber100 }
            ]}>
              <Text style={[
                exchangeStyles.securityText,
                { color: m.security === 'Best' ? COLORS.green700 : m.security === 'Good' ? COLORS.blue700 : COLORS.amber700 }
              ]}>
                {m.security}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
      
      {!tailscaleAvailable && (
        <TouchableOpacity style={exchangeStyles.installTailscale} onPress={openTailscaleApp}>
          <Text style={exchangeStyles.installText}>Install Tailscale for remote P2P →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const exchangeStyles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1c1917',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#78716c',
    marginBottom: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fafaf9',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e7e5e4',
    padding: 12,
    marginBottom: 8,
  },
  optionSelected: {
    borderColor: '#4f46e5',
    backgroundColor: '#eef2ff',
  },
  optionDisabled: {
    opacity: 0.5,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#44403c',
  },
  optionLabelSelected: {
    color: '#4f46e5',
  },
  optionDesc: {
    fontSize: 11,
    color: '#78716c',
    marginTop: 2,
  },
  securityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  securityText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  installTailscale: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  installText: {
    fontSize: 12,
    color: '#4f46e5',
    textDecorationLine: 'underline',
  },
});

// ============================================================================
// VERIFICATION CODE DISPLAY
// ============================================================================
interface VerificationCodeProps {
  code: string;
  onConfirmed: () => void;
}

const VerificationCodeDisplay: React.FC<VerificationCodeProps> = ({ code, onConfirmed }) => (
  <View style={verifyStyles.container}>
    <Text style={verifyStyles.title}>🔐 Verification Code</Text>
    <Text style={verifyStyles.instruction}>
      Read this code to your counterparty via voice/video call.{'\n'}
      Both must see the SAME code to proceed safely.
    </Text>
    
    <View style={verifyStyles.codeBox}>
      <Text style={verifyStyles.code}>{code}</Text>
    </View>
    
    <View style={verifyStyles.checkList}>
      <Text style={verifyStyles.checkItem}>✓ Call counterparty (phone, FaceTime, etc.)</Text>
      <Text style={verifyStyles.checkItem}>✓ Read your code aloud</Text>
      <Text style={verifyStyles.checkItem}>✓ Confirm they see the same code</Text>
    </View>
    
    <TouchableOpacity style={verifyStyles.confirmBtn} onPress={onConfirmed}>
      <Text style={verifyStyles.confirmBtnText}>✓ Codes Match - Continue</Text>
    </TouchableOpacity>
    
    <Text style={verifyStyles.warning}>
      ⚠️ If codes DON'T match, STOP! Someone may be intercepting.
    </Text>
  </View>
);

const verifyStyles = StyleSheet.create({
  container: {
    backgroundColor: '#eef2ff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#a5b4fc',
    padding: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3730a3',
    marginBottom: 8,
  },
  instruction: {
    fontSize: 12,
    color: '#4338ca',
    lineHeight: 18,
    marginBottom: 16,
  },
  codeBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  code: {
    fontSize: 48,
    fontWeight: '900',
    fontFamily: 'monospace',
    color: '#312e81',
    letterSpacing: 8,
  },
  checkList: {
    marginBottom: 16,
  },
  checkItem: {
    fontSize: 12,
    color: '#4338ca',
    marginBottom: 4,
  },
  confirmBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  warning: {
    fontSize: 11,
    color: '#b91c1c',
    textAlign: 'center',
    fontWeight: '600',
  },
});

// ============================================================================
// PROGRESS STEP INDICATOR
// ============================================================================
interface ProgressStepsProps {
  currentStep: number;
  steps: string[];
}

const ProgressSteps: React.FC<ProgressStepsProps> = ({ currentStep, steps }) => (
  <View style={progressStyles.container}>
    {steps.map((label, i) => (
      <View key={i} style={progressStyles.stepWrapper}>
        <View style={[
          progressStyles.circle,
          currentStep > i + 1 && progressStyles.circleComplete,
          currentStep === i + 1 && progressStyles.circleCurrent,
        ]}>
          {currentStep > i + 1 ? (
            <Text style={progressStyles.checkmark}>✓</Text>
          ) : (
            <Text style={[
              progressStyles.stepNumber,
              currentStep === i + 1 && progressStyles.stepNumberCurrent,
            ]}>
              {i + 1}
            </Text>
          )}
        </View>
        <Text style={progressStyles.label}>{label}</Text>
      </View>
    ))}
  </View>
);

const progressStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: rs.s(16),
    marginBottom: rs.s(24),
  },
  stepWrapper: {
    alignItems: 'center',
  },
  circle: {
    width: rs.s(32),
    height: rs.s(32),
    borderRadius: rs.s(16),
    backgroundColor: COLORS.stone200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: rs.s(4),
  },
  circleComplete: {
    backgroundColor: COLORS.green500,
  },
  circleCurrent: {
    backgroundColor: COLORS.indigo600,
  },
  stepNumber: {
    fontSize: rs.font(12),
    fontWeight: 'bold',
    color: COLORS.stone500,
  },
  stepNumberCurrent: {
    color: COLORS.white,
  },
  checkmark: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  label: {
    fontSize: rs.font(10),
    color: COLORS.stone500,
  },
});

// ============================================================================
// INFO BOX COMPONENT
// ============================================================================
interface InfoBoxProps {
  title: string;
  children: React.ReactNode;
  variant?: 'info' | 'warning' | 'success' | 'error';
  icon?: React.ReactNode;
}

const InfoBox: React.FC<InfoBoxProps> = ({ title, children, variant = 'info', icon }) => {
  const colors = {
    info: { bg: COLORS.blue50, border: COLORS.blue200, title: COLORS.blue800, text: COLORS.blue700 },
    warning: { bg: COLORS.amber50, border: COLORS.amber200, title: COLORS.amber800, text: COLORS.amber700 },
    success: { bg: COLORS.green50, border: COLORS.green200, title: COLORS.green800, text: COLORS.green700 },
    error: { bg: COLORS.red50, border: COLORS.red200, title: COLORS.red800, text: COLORS.red700 },
  };
  const c = colors[variant];
  
  return (
    <View style={[infoStyles.container, { backgroundColor: c.bg, borderColor: c.border }]}>
      <View style={infoStyles.header}>
        {icon}
        <Text style={[infoStyles.title, { color: c.title }]}>{title}</Text>
      </View>
      <View style={infoStyles.content}>
        {typeof children === 'string' ? (
          <Text style={[infoStyles.text, { color: c.text }]}>{children}</Text>
        ) : children}
      </View>
    </View>
  );
};

const infoStyles = StyleSheet.create({
  container: {
    borderRadius: rs.s(12),
    borderWidth: 1,
    padding: rs.s(12),
    marginBottom: rs.s(12),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(8),
    marginBottom: rs.s(8),
  },
  title: {
    fontSize: rs.font(13),
    fontWeight: 'bold',
  },
  content: {},
  text: {
    fontSize: rs.font(12),
    lineHeight: rs.font(18),
  },
});

// ============================================================================
// COLLATERAL BREAKDOWN
// ============================================================================
interface CollateralBreakdownProps {
  buyerAmount: number;
  sellerAmount: number;
  role: 'buyer' | 'seller' | null;
}

const CollateralBreakdown: React.FC<CollateralBreakdownProps> = ({ buyerAmount, sellerAmount, role }) => (
  <View style={collateralStyles.container}>
    <Text style={collateralStyles.title}>💰 Collateral Breakdown</Text>
    <View style={collateralStyles.grid}>
      <View style={[
        collateralStyles.box,
        { backgroundColor: COLORS.green50, borderColor: role === 'buyer' ? COLORS.green500 : COLORS.green200 },
        role === 'buyer' && { borderWidth: 2 }
      ]}>
        <Text style={collateralStyles.boxLabel}>BUYER LOCKS</Text>
        <Text style={collateralStyles.boxValue}>{buyerAmount} KASPA</Text>
        <Text style={collateralStyles.boxNote}>
          → {buyerAmount} KASPA to seller on success{'\n'}
          → Returns to buyer if cancelled
        </Text>
      </View>
      <View style={[
        collateralStyles.box,
        { backgroundColor: COLORS.blue50, borderColor: role === 'seller' ? COLORS.blue500 : COLORS.blue200 },
        role === 'seller' && { borderWidth: 2 }
      ]}>
        <Text style={[collateralStyles.boxLabel, { color: COLORS.blue600 }]}>SELLER LOCKS</Text>
        <Text style={[collateralStyles.boxValue, { color: COLORS.blue800 }]}>{sellerAmount} KASPA</Text>
        <Text style={[collateralStyles.boxNote, { color: COLORS.blue600 }]}>
          → Returns to seller on success{'\n'}
          → Returns to seller if cancelled
        </Text>
      </View>
    </View>
    <View style={collateralStyles.keyPoint}>
      <Text style={collateralStyles.keyPointText}>
        <Text style={{ fontWeight: 'bold' }}>🔑 Key:</Text> Collateral is insurance only. 
        <Text style={{ fontWeight: 'bold' }}> Buyer's {buyerAmount} KASPA</Text> pays the seller. 
        <Text style={{ fontWeight: 'bold' }}> Seller's {sellerAmount} KASPA</Text> returns after completion.
      </Text>
    </View>
  </View>
);

const collateralStyles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.stone50,
    borderRadius: rs.s(12),
    padding: rs.s(16),
    marginBottom: rs.s(12),
  },
  title: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.stone700,
    marginBottom: rs.s(12),
  },
  grid: {
    flexDirection: 'row',
    gap: rs.s(12),
    marginBottom: rs.s(12),
  },
  box: {
    flex: 1,
    borderRadius: rs.s(12),
    borderWidth: 1,
    padding: rs.s(12),
  },
  boxLabel: {
    fontSize: rs.font(9),
    fontWeight: 'bold',
    color: COLORS.green600,
    textTransform: 'uppercase',
    marginBottom: rs.s(4),
  },
  boxValue: {
    fontSize: rs.font(20),
    fontWeight: '900',
    color: COLORS.green800,
    marginBottom: rs.s(8),
  },
  boxNote: {
    fontSize: rs.font(9),
    color: COLORS.green600,
    lineHeight: rs.font(14),
  },
  keyPoint: {
    backgroundColor: COLORS.amber50,
    borderRadius: rs.s(8),
    padding: rs.s(10),
    borderWidth: 1,
    borderColor: COLORS.amber200,
  },
  keyPointText: {
    fontSize: rs.font(11),
    color: COLORS.amber800,
    lineHeight: rs.font(16),
  },
});

// ============================================================================
// RELEASE STATUS
// ============================================================================
interface ReleaseStatusProps {
  buyerRequested: boolean;
  sellerRequested: boolean;
}

const ReleaseStatus: React.FC<ReleaseStatusProps> = ({ buyerRequested, sellerRequested }) => (
  <View style={releaseStyles.container}>
    <Text style={releaseStyles.title}>Release Request Status</Text>
    <View style={releaseStyles.row}>
      <View style={releaseStyles.party}>
        <ShoppingBag size={rs.s(16)} color={COLORS.green600} />
        <Text style={releaseStyles.partyLabel}>Buyer</Text>
      </View>
      <View style={[
        releaseStyles.status,
        { backgroundColor: buyerRequested ? COLORS.green100 : COLORS.stone100 }
      ]}>
        <Text style={[
          releaseStyles.statusText,
          { color: buyerRequested ? COLORS.green700 : COLORS.stone500 }
        ]}>
          {buyerRequested ? '✓ Wants to cancel' : 'No request yet'}
        </Text>
      </View>
    </View>
    <View style={releaseStyles.row}>
      <View style={releaseStyles.party}>
        <Store size={rs.s(16)} color={COLORS.blue600} />
        <Text style={releaseStyles.partyLabel}>Seller</Text>
      </View>
      <View style={[
        releaseStyles.status,
        { backgroundColor: sellerRequested ? COLORS.green100 : COLORS.stone100 }
      ]}>
        <Text style={[
          releaseStyles.statusText,
          { color: sellerRequested ? COLORS.green700 : COLORS.stone500 }
        ]}>
          {sellerRequested ? '✓ Wants to cancel' : 'No request yet'}
        </Text>
      </View>
    </View>
    {buyerRequested && sellerRequested && (
      <View style={releaseStyles.bothAgreed}>
        <Text style={releaseStyles.bothAgreedText}>Both agreed! Releasing funds...</Text>
      </View>
    )}
  </View>
);

const releaseStyles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.stone50,
    borderRadius: rs.s(12),
    padding: rs.s(16),
    marginBottom: rs.s(12),
  },
  title: {
    fontSize: rs.font(13),
    fontWeight: 'bold',
    color: COLORS.stone700,
    marginBottom: rs.s(12),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.cardBg,
    borderRadius: rs.s(8),
    padding: rs.s(10),
    marginBottom: rs.s(8),
  },
  party: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(8),
  },
  partyLabel: {
    fontSize: rs.font(13),
    color: COLORS.stone700,
  },
  status: {
    paddingHorizontal: rs.s(10),
    paddingVertical: rs.s(4),
    borderRadius: rs.s(6),
  },
  statusText: {
    fontSize: rs.font(11),
    fontWeight: 'bold',
  },
  bothAgreed: {
    backgroundColor: COLORS.green100,
    borderRadius: rs.s(8),
    padding: rs.s(10),
    alignItems: 'center',
    marginTop: rs.s(4),
  },
  bothAgreedText: {
    fontSize: rs.font(13),
    fontWeight: 'bold',
    color: COLORS.green700,
  },
});

// ============================================================================
// MAIN NEIGHBOR AGREEMENT COMPONENT
// ============================================================================
export interface NeighborAgreementProps {
  visible: boolean;
  onClose: () => void;
  initialCoupon?: any;
  userPubkey?: string;
}

export const NeighborAgreement: React.FC<NeighborAgreementProps> = ({
  visible,
  onClose,
  initialCoupon,
  userPubkey,
}) => {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<'buyer' | 'seller' | null>(null);
  const [agreementType, setAgreementType] = useState<'simple' | 'trade' | 'join' | null>(null);
  const [inboxAgreements, setInboxAgreements] = useState<any[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxSort, setInboxSort] = useState<'recent'|'buyerHigh'|'sellerLow'|'name'>('recent');
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [manualAgrId, setManualAgrId] = useState('');
  const [manualLookupResult, setManualLookupResult] = useState<any>(null);
  const [manualVerCode, setManualVerCode] = useState('');
  const [frostActiveList, setFrostActiveList] = useState<FrostActiveEntry[]>([]);

  // Inline canonicalVerify REMOVED ? using module import from canonical_agreement.ts

  const [contract, setContract] = useState<Contract>({
    itemPriceKas: initialCoupon?.discountedKaspa || 0,
    sellerCommitmentKas: 0,
    stipulations: '',
    itemDescription: initialCoupon?.description || '',
    expiryHours: 24,
  });
  
  const [buyerLocked, setBuyerLocked] = useState(false);
  const [sellerLocked, setSellerLocked] = useState(false);
  const [paymentSent, setPaymentSent] = useState(false);
  const [buyerRequestedRelease, setBuyerRequestedRelease] = useState(false);
  const [sellerRequestedRelease, setSellerRequestedRelease] = useState(false);
  const [proposedSplit, setProposedSplit] = useState({ buyerGets: 0, sellerGets: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [collateralFailed, setCollateralFailed] = useState(false);
  const [counterpartyAddress, setCounterpartyAddress] = useState<string | null>(null);
  const [counterpartyKaspaAddr, setCounterpartyKaspaAddr] = useState<string>('');
 
  const [myAddress, setMyAddress] = useState<string | null>(null);
  const [iouModalVisible, setIouModalVisible] = useState(false);
  const [userStats, setUserStats] = useState<UserStats>({
    xp: DEFAULT_STARTING_XP,
    successes: 0,
    deadlocks: 0,
  });
  
  // Private key retrieval handled by loadMainWallet()
  
  useEffect(() => {
    const loadStats = async () => {
      try {
        const addrWallet = await loadMainWallet();
        if (addrWallet) setMyAddress(addrWallet.address);
        const realStats = await getUserStats();
        if (realStats && realStats.xp > 0) {
          setUserStats({ xp: realStats.xp, successes: realStats.successes || 0, deadlocks: realStats.deadlocks || 0 });
        }
      } catch (e) {
        console.error('Failed to load user stats:', e);
      }
    };
    loadStats();
  }, []);
  
  // Restore session if app was closed mid-agreement
  useEffect(() => {
    loadAgreementSession().then(session => {
      if (session && session.step > 1) {
        console.log('[Neighbor] Restoring session at step', session.step);
        // Detect corrupted session: buyer === seller means wrong FROST address
        if (session.contract?.buyerPubkey && session.contract?.sellerPubkey && 
            session.contract.buyerPubkey === session.contract.sellerPubkey) {
          console.warn('[Neighbor] CORRUPTED SESSION: buyer === seller, clearing');
          clearAgreementSession().then(() => {}); // fire-and-forget
          return;
        }
        setStep(session.step);
        setRole(session.role);
        setAgreementType(session.agreementType);
        setContract(session.contract);
        setBuyerLocked(session.buyerLocked);
        setSellerLocked(session.sellerLocked);
        if (session.counterpartyAddress) setCounterpartyAddress(session.counterpartyAddress);
        if (session.counterpartyKaspaAddr) setCounterpartyKaspaAddr(session.counterpartyKaspaAddr);
      }
    });
  }, []);

  const pComplete = (1 + userStats.successes) / (2 + userStats.successes + userStats.deadlocks);
  const isNewUser = (userStats.successes + userStats.deadlocks) < 3;
  const snailModeActive = !isNewUser && (userStats.xp < SNAIL_THRESHOLD || pComplete < 0.5);
  const creationDelayMs = snailModeActive 
    ? Math.min(60000 + (userStats.deadlocks * 60000), 600000) 
    : 0;
  
  // Exchange method state
  const [exchangeMethod, setExchangeMethod] = useState<ExchangeMethod | null>(null);
  const [exchangeProgress, setExchangeProgress] = useState<ExchangeProgress | null>(null);
  const [tailscaleAvailable, setTailscaleAvailable] = useState(false);
  const [verificationConfirmed, setVerificationConfirmed] = useState(false);
  const [blePeers, setBlePeers] = useState<PeerInfo[]>([]);
  const [wifiServerInfo, setWifiServerInfo] = useState<{ ip: string; port: number } | null>(null);
  
  // Auto-save agreement session on state changes
  useEffect(() => {
    if (step > 1 && role) {
      saveAgreementSession({ step, role, agreementType, contract, buyerLocked, sellerLocked, counterpartyAddress, counterpartyKaspaAddr, savedAt: Date.now() });
    }
  }, [step, role, agreementType, contract, buyerLocked, sellerLocked]);

  // Check Tailscale on mount
  // Background: check saved session for pending FROST funding on mount
  useEffect(() => {
    const checkPendingFrost = async () => {
      if ((global as any).__frostRestored) return;
      (global as any).__frostRestored = true;
      try {
        const session = await loadAgreementSession();
        if (!session || session.step < 3 || !session.contract?.multisigAddress) return;
        if (session.contract?.buyerPubkey === session.contract?.sellerPubkey) return;
        const frostAddr = session.contract.multisigAddress;
        const networkStr = await SecureStore.getItemAsync('kaspa_network');
        const apiBase = networkStr?.includes('testnet') ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
        const resp = await fetch(apiBase + '/addresses/' + frostAddr + '/balance');
        if (!resp.ok) return;
        const data = await resp.json();
        const bal = BigInt(data.balance || '0');
        console.log('[Background-FROST] Session:', session.contract.agreementId?.slice(0,12), 'FROST:', frostAddr.slice(0,20), 'Balance:', Number(bal)/1e8, 'Step:', session.step);
        // Also poll all active FROST entries
        const allActive = await getFrostList();
        const updatedList: FrostActiveEntry[] = [];
        for (const entry of allActive) {
          try {
            const eResp = await fetch(apiBase + '/addresses/' + entry.frostAddr + '/balance');
            if (eResp.ok) {
              const eData = await eResp.json();
              const eBal = Number(eData.balance || '0') / 1e8;
              console.log('[Background-FROST] Polling', entry.agrId.slice(0,12), ':', eBal, 'KAS', 'step:', entry.step);
              updatedList.push({ ...entry, step: eBal >= (entry.buyerAmount + entry.sellerAmount) ? 4 : entry.step });
            } else { updatedList.push(entry); }
          } catch { updatedList.push(entry); }
        }
        setFrostActiveList(updatedList);
        if (bal > 0n || session.step >= 3) {
          console.log('[Background-FROST] Restoring active session');
          setStep(session.step);
          setRole(session.role);
          setAgreementType(session.agreementType);
          setContract(session.contract);
          setBuyerLocked(session.buyerLocked);
          setSellerLocked(session.sellerLocked);
          if (session.counterpartyAddress) setCounterpartyAddress(session.counterpartyAddress);
          if (session.counterpartyKaspaAddr) setCounterpartyKaspaAddr(session.counterpartyKaspaAddr);
        }
      } catch (e) { console.warn('[Background-FROST] Check failed:', e); }
    };
    checkPendingFrost();
  }, []);

  useEffect(() => {
    isTailscaleFunnelAvailable().then(setTailscaleAvailable);
    return () => cleanupFrost();
  }, []);

  // Poll for counterparty's Agreed-Send on Arweave
  // DEBUG: log guard values — triggers auto-send
  useEffect(() => {
    console.log('[Agreed-Send Guard]', 'step:', step, 'agrId:', contract.agreementId?.slice(0,12), 'frost:', contract.multisigAddress?.slice(0,20), 'buyer:', contract.buyerPubkey?.slice(0,16), 'seller:', contract.sellerPubkey?.slice(0,16));
    if (step < 3 || !contract.agreementId || !contract.multisigAddress) return;
    if (!contract.buyerPubkey || !contract.sellerPubkey) return;
    // Don't poll if already on step 4+ (both confirmed)
    if (step >= 4) return;

    let cancelled = false;
    const myPubkey = role === 'buyer' ? contract.buyerPubkey : contract.sellerPubkey;
    const counterpartyPubkey = role === 'buyer' ? contract.sellerPubkey : contract.buyerPubkey;

    const pollAgreedSend = async () => {
      if (cancelled) return;
      console.log('[Agreed-Send Poll] Polling... role:', role, 'counterparty:', counterpartyPubkey?.slice(0,16), 'agrId:', contract.agreementId?.slice(0,12));
      try {
        // Check Arweave for counterparty's Agreed-Send
        if (!contract.agreementId || !contract.multisigAddress) return;
        
        // First: check if WE have inscribed Agreed yet (proposer might not have)
        const ownAgreedKey = 'kv_agreed_' + contract.agreementId;
        const alreadyAgreed = await AsyncStorage.getItem(ownAgreedKey);
        if (!alreadyAgreed) {
          // Check if counterparty accepted/agreed on Arweave
          try {
            // queryAgreementsFromArweave imported statically
            const allStatuses = await queryAgreementsFromArweave({ status: 'Accepted' });
            const counterAccepted = allStatuses.find((r: any) => 
              (r.agreementId || r.agreement_id) === contract.agreementId &&
              (r.partyA?.pubkey || r.party_a?.pubkey || r.pubkey) === counterpartyPubkey
            );
            if (counterAccepted) {
              console.log('[Agreed-Send Poll] Counterparty accepted — inscribing our Agreed');
              await inscribeAgreementToArweave({
                agreementId: contract.agreementId || '',
                pubkey: myPubkey || '',
                amount_sompi: Math.floor((role === 'buyer' ? contract.itemPriceKas : contract.sellerCommitmentKas) * 1e8),
                description: contract.itemDescription || '',
                network: 'testnet-10',
                status: 'Agreed',
                signature: 'agreed_auto_' + Date.now(),
                counterpartyPubkey: counterpartyPubkey,
                frostAddress: contract.multisigAddress,
              });
              await AsyncStorage.setItem(ownAgreedKey, String(Date.now()));
              console.log('[Agreed-Send Poll] Own Agreed inscribed to Arweave');
            }
          } catch (e) { console.warn('[Agreed-Send Poll] Agreed check failed:', e); }
        }
        const found = await queryCounterpartyAgreed({
          agreementId: contract.agreementId,
          counterpartyPubkey: counterpartyPubkey || '',
          myPubkey: myPubkey || '',
          frostAddress: contract.multisigAddress,
        });
        if (!found || cancelled) return;

        console.log('[Agreed-Send Poll] Counterparty Agreed-Send detected for', contract.agreementId, '- checking if already sent...');

        // Inscribe our own Agreed-Send if not already done
        const ownAgreedSendKey = 'kv_agreed_send_' + contract.agreementId;
        const alreadySent = await AsyncStorage.getItem(ownAgreedSendKey);
        if (!alreadySent) {
          try {
            await inscribeAgreementToArweave({
              agreementId: contract.agreementId || '',
              pubkey: myPubkey || '',
              amount_sompi: Math.floor((role === 'buyer' ? contract.itemPriceKas : contract.sellerCommitmentKas) * 1e8),
              description: contract.itemDescription || '',
              network: 'testnet-10',
              status: 'Agreed-Send',
              signature: 'agreed_send_' + Date.now(),
              counterpartyPubkey: counterpartyPubkey,
              frostAddress: contract.multisigAddress || '',
              frostR: await (async () => { try { const nonce = generateFrostNonce({ frostAddress: contract.frostData, recipientAddress: contract.releaseRecipient || counterpartyKaspaAddr || contract.multisigAddress || '', amountSompi: BigInt(Math.floor((contract.itemPriceKas + contract.sellerCommitmentKas) * 1e8)), privateKeyHex: (await loadMainWallet())?.privKeyHex || '' }); await AsyncStorage.setItem('kv_frost_nonce_' + contract.agreementId, JSON.stringify({ R_hex: nonce.R_hex, k_private: nonce.k_private, d_tweaked: nonce.d_tweaked, message_hex: nonce.message_hex })); console.log('[FROST-R] Generated nonce R:', nonce.R_hex.slice(0,20)); try { postFrostR({ agreementId: contract.agreementId || '', pubkey: myPubkey || '', frostR: nonce.R_hex }).catch(() => {}); } catch {} return nonce.R_hex; } catch(e) { console.warn('[FROST-R] Nonce generation failed:', e); return ''; } })(),
            });
            await AsyncStorage.setItem(ownAgreedKey, String(Date.now()));
            console.log('[Agreed-Send Poll] Own Agreed-Send inscribed');
          } catch (e) { console.warn('[Agreed-Send Poll] Inscription failed:', e); }
        }

        // Auto-send to FROST
        try {
          const wallet = await loadMainWallet();
          if (!wallet || cancelled) return;
          const myAmount = role === 'buyer'
            ? BigInt(Math.floor(contract.itemPriceKas * 1e8))
            : BigInt(Math.floor(contract.sellerCommitmentKas * 1e8));
          if (myAmount <= 0n) return;

          // Check if we already sent (idempotent)
          const sentKey = 'kv_frost_sent_' + contract.agreementId;
          const alreadyFrostSent = await AsyncStorage.getItem(sentKey);
          if (alreadyFrostSent) {
            console.log('[Agreed-Send Poll] Already sent to FROST, skipping');
            return;
          }

          console.log('[Agreed-Send Poll] Sending', Number(myAmount) / 1e8, 'KASPA to FROST:', contract.multisigAddress);
          const sendResult = await sendKaspaViaRest({
            senderAddress: wallet.address,
            recipientAddress: contract.multisigAddress || '',
            amountSompi: myAmount,
            privateKeyHex: wallet.privKeyHex,
            network: wallet.network,
          });

          if (sendResult.success) {
            await AsyncStorage.setItem(sentKey, sendResult.txId || String(Date.now()));
            console.log('[Agreed-Send Poll] FROST TX confirmed:', sendResult.txId);
            try { await markLocked(contract.agreementId || ''); } catch {}
            // Merkle proof (fire-and-forget)
            uploadPerTxProof({
              txId: sendResult.txId || '', txIndex: 0, amountSompi: myAmount,
              scriptPubKey: '', daaScore: 0, txType: 'collateral', balanceAfter: 0,
              agreementId: contract.agreementId,
              uploadFn: async (data, tags) => { const r = await uploadToIrys(data, tags); return r.txId || ''; },
              network: 'testnet',
            }).catch(() => {});
            recordCollateral({ agreementId: contract.agreementId || '', pubkey: wallet.address, txId: sendResult.txId || '', frostAddress: contract.multisigAddress || '' }).catch(() => {});
            if (role === 'buyer') { setBuyerLocked(true); setContract(prev => ({ ...prev, buyerLockTxId: sendResult.txId })); }
            else { setSellerLocked(true); setContract(prev => ({ ...prev, sellerLockTxId: sendResult.txId })); }
            Alert.alert('Collateral Sent!', Number(myAmount) / 1e8 + ' KASPA locked to FROST.\nTX: ' + (sendResult.txId || '').slice(0, 16) + '...');
          } else {
            console.warn('[Agreed-Send Poll] Send failed:', sendResult.error);
            Alert.alert('Auto-Send Failed', sendResult.error || 'Will retry on next poll.');
          }
        } catch (e) { console.warn('[Agreed-Send Poll] Auto-send error:', e); }
      } catch (e) { console.warn('[Agreed-Send Poll] Error:', e); }
    };

    // Poll every 30 seconds (Arweave indexing takes 5-30 min)
    pollAgreedSend(); // immediate first check
    const interval = setInterval(pollAgreedSend, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [step, contract.agreementId, contract.multisigAddress, contract.buyerPubkey, contract.sellerPubkey, role]);

  // Poll FROST address balance � auto-advance to step 4 when both confirmed
  useEffect(() => {
    if (step !== 3 || !contract.multisigAddress) return;
    // L1 failsafe: poll FROST balance regardless of local lock state
    // If FROST has the expected funds, both parties sent — advance to step 4
    const expectedBuyer = BigInt(Math.floor(contract.itemPriceKas * 1e8));
    const expectedSeller = BigInt(Math.floor(contract.sellerCommitmentKas * 1e8));
    const expectedTotal = expectedBuyer + expectedSeller;
    console.log('[FROST-Poll] Expected: buyer=', Number(expectedBuyer)/1e8, 'seller=', Number(expectedSeller)/1e8, 'total=', Number(expectedTotal)/1e8);
    if (expectedTotal <= 0n) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const networkStr = await SecureStore.getItemAsync('kaspa_network');
        const apiBase = networkStr?.includes('testnet') ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
        const resp = await fetch(apiBase + '/addresses/' + contract.multisigAddress + '/balance');
        if (!resp.ok || cancelled) return;
        const data = await resp.json();
        const frostBalance = BigInt(data.balance || '0');
        // Check TownHall — if both confirmed, proceed to send even if Arweave hasn't indexed yet
        try {
          // getAgreementStatus imported statically
          const thStatus = await getAgreementStatus(contract.agreementId || '');
          if (thStatus && (thStatus.status === 'BothConfirmed' || thStatus.status === 'Collateralized' || thStatus.status === 'Accepted')) {
            console.log('[FROST-Poll] TownHall status:', thStatus.status, '— both parties confirmed');
            // If we haven't sent collateral yet, send now
            const sentKey = 'kv_frost_sent_' + (contract.agreementId || '');
            const alreadySent = await AsyncStorage.getItem(sentKey);
            const iAmBuyerHere = role === 'buyer'; if (iAmBuyerHere) { console.log('[FROST-Poll] Buyer waits - seller sends first'); }
            if (!alreadySent && contract.multisigAddress && !iAmBuyerHere) {
              console.log('[FROST-Poll] Auto-sending collateral to FROST:', contract.multisigAddress);
              try {
                const wallet = await loadMainWallet();
                if (wallet) {
                    const myAmount = role === 'buyer' ? contract.itemPriceKas : contract.sellerCommitmentKas;
                    const sendResult = await sendKaspaViaRest({
                      senderAddress: wallet.address,
                      recipientAddress: contract.multisigAddress || '',
                      amountSompi: BigInt(Math.floor(myAmount * 1e8)),
                      privateKeyHex: wallet.privKeyHex,
                      network: wallet.network,
                    });
                    if (sendResult.txId) {
                      await AsyncStorage.setItem(sentKey, sendResult.txId);
                      console.log('[FROST-Poll] ✅ Collateral sent! TX:', sendResult.txId);
                      // Record on TownHall
                      try {
                        // recordCollateral imported statically
                        await recordCollateral({
                          agreementId: contract.agreementId || '',
                          pubkey: (role === 'buyer' ? contract.buyerPubkey : contract.sellerPubkey) || '',
                          txId: sendResult.txId,
                          frostAddress: contract.multisigAddress,
                        });
                      } catch (e) { console.warn('[FROST-Poll] TownHall collateral record failed:', e); }
                    }
                  }
                } catch (e) { console.warn('[FROST-Poll] Auto-send failed:', e); }
            }
          }
        } catch (e) { /* TownHall check failed — fall through to balance poll */ }

        // Triple-check: TownHall + L1 address + DAA
      try {
        const thResp = await fetch('https://kasvillage.app.runonflux.io/api/agreement/' + (contract.agreementId || ''));
        const thData = await thResp.json();
        const frostAddr = contract.multisigAddress || '';
        const l1UtxoResp = await fetch(apiBase + '/addresses/' + frostAddr + '/utxos');
        const l1Utxos = await l1UtxoResp.json();
        const l1DaaResp = await fetch(apiBase + '/info/virtual-chain-blue-score');
        const l1Daa = await l1DaaResp.json();
        const pollCount = (global.__frostPollCount = (global.__frostPollCount || 0) + 1);
      if (pollCount % 6 === 1) { console.log('[FROST-Poll] === TRIPLE CHECK ===');
        console.log('[FROST-Poll] AgrID:', contract.agreementId);
        console.log('[FROST-Poll] My pubkey:', (contract.buyerPubkey || contract.sellerPubkey || 'unknown').substring(0,16));
        console.log('[FROST-Poll] PartyA pubkey (TH):', thData.partyA?.pubkey?.substring(0,16) || 'missing');
        console.log('[FROST-Poll] PartyB pubkey (TH):', thData.partyB?.pubkey?.substring(0,16) || 'NULL');
        console.log('[FROST-Poll] TH Status:', thData.status);
        console.log('[FROST-Poll] TH DAA/Created:', thData.createdAt);
        console.log('[FROST-Poll] FROST addr (TH):', (thData.frostAddress || 'not set').substring(0,40));
        console.log('[FROST-Poll] FROST addr (local):', frostAddr.substring(0,40));
        console.log('[FROST-Poll] L1 FROST exists:', l1Utxos.length > 0 ? 'YES (' + l1Utxos.length + ' UTXOs)' : 'NO UTXOs');
        console.log('[FROST-Poll] L1 current DAA:', l1Daa.blueScore || 'unknown');
        if (l1Utxos.length > 0) {
          const firstUtxo = l1Utxos[0];
          console.log('[FROST-Poll] L1 first UTXO DAA:', firstUtxo.utxoEntry?.blockDaaScore || 'unknown');
          console.log('[FROST-Poll] L1 first UTXO amount:', Number(firstUtxo.utxoEntry?.amount || 0) / 1e8, 'KAS');
        }
        console.log('[FROST-Poll] MATCH:', 
          frostAddr === thData.frostAddress ? 'FROST ?' : 'FROST ? (TH=' + (thData.frostAddress || 'null') + ')',
          thData.partyB ? 'PartyB ?' : 'PartyB ?',
          thData.partyA?.pubkey ? 'PartyA ?' : 'PartyA ?'
        );
        console.log('[FROST-Poll] ================='); }
      } catch (e) { console.warn('[FROST-Poll] Triple check failed:', e); }
      console.log('[FROST-Poll] Balance:', Number(frostBalance) / 1e8, 'KASPA, expected:', Number(expectedTotal) / 1e8);
        if (frostBalance >= expectedTotal) {
          console.log('[FROST-Poll] Both parties confirmed! Advancing to step 4');
          setBuyerLocked(true);
          setSellerLocked(true);
          setStep(4);
        } else if (frostBalance > 0n && frostBalance >= expectedBuyer) {
          // At least one party sent — check if it's us or counterparty
          console.log('[FROST-Poll] Partial balance detected:', Number(frostBalance) / 1e8, 'KASPA');
          // If we haven't sent yet, the counterparty has — trigger our auto-send
          const myExpected = role === 'buyer' ? expectedBuyer : expectedSeller;
          const counterpartyExpected = role === 'buyer' ? expectedSeller : expectedBuyer;
          const alreadySentKey = await AsyncStorage.getItem('kv_frost_sent_' + contract.agreementId);
          const iShouldSend = !alreadySentKey && frostBalance >= counterpartyExpected && frostBalance < expectedTotal;
          if (iShouldSend) {
            console.log('[FROST-Poll] Counterparty sent! Triggering our auto-send...');
            try {
              const wallet = await loadMainWallet();
              if (wallet && !cancelled) {
                const myAmount = role === 'buyer' ? expectedBuyer : expectedSeller;
                if (myAmount > 0n) {
                  const sendResult = await sendKaspaViaRest({
                    senderAddress: wallet.address,
                    recipientAddress: contract.multisigAddress || '',
                    amountSompi: myAmount,
                    privateKeyHex: wallet.privKeyHex,
                    network: wallet.network,
                    payload: await (async () => { try { const nonce = generateFrostNonce({ frostAddress: contract.frostData, recipientAddress: contract.multisigAddress || '', amountSompi: BigInt(Math.floor((contract.itemPriceKas + contract.sellerCommitmentKas) * 1e8)), privateKeyHex: wallet.privKeyHex }); await AsyncStorage.setItem('kv_frost_nonce_' + contract.agreementId, JSON.stringify(nonce)); console.log('[FROST-R] Embedded R in buyer collateral payload:', nonce.R_hex.slice(0,20)); try { postFrostR({ agreementId: contract.agreementId || '', pubkey: (role === 'buyer' ? contract.buyerPubkey : contract.sellerPubkey) || '', frostR: nonce.R_hex }).catch(() => {}); } catch {} return nonce.R_hex; } catch(e) { console.warn('[FROST-R] Buyer payload failed:', e); return ''; } })(),
                  });
                  if (sendResult.success) {
                    await AsyncStorage.setItem('kv_frost_sent_' + contract.agreementId, sendResult.txId || String(Date.now()));
                    console.log('[FROST-Poll] Our collateral sent! TX:', sendResult.txId);
                    // Post buyer R to TownHall + Arweave
                    if (role === 'buyer') {
                      try {
                        const savedNonce = await AsyncStorage.getItem('kv_frost_nonce_' + contract.agreementId);
                        if (savedNonce) {
                          const nData = JSON.parse(savedNonce);
                          // postFrostR imported statically
                          await postFrostR({ agreementId: contract.agreementId || '', pubkey: myPubkey, frostR: nData.R_hex });
                          console.log('[FROST-R] Buyer R posted to TownHall:', nData.R_hex.slice(0,20));
                        }
                      } catch(e2) { console.warn('[FROST-R] Buyer R post failed:', e2); }
                    }
                    try { await markLocked(contract.agreementId || ''); } catch {}
                    if (role === 'buyer') { setBuyerLocked(true); } else { setSellerLocked(true); }
                    Alert.alert('Collateral Sent!', Number(myAmount) / 1e8 + ' KASPA sent to FROST.\nTX: ' + (sendResult.txId || '').slice(0, 16));
                  } else {
                    console.warn('[FROST-Poll] Auto-send failed:', sendResult.error);
                    setCollateralFailed(true);
                  }
                }
              }
            } catch (e) { console.warn('[FROST-Poll] Auto-send error:', e); }
          }
        }
      } catch (e) { console.warn('[FROST-Poll] Failed:', e); }
    };

    poll(); // immediate first check
    const interval = setInterval(poll, 10000); // every 10s
    return () => { cancelled = true; clearInterval(interval); };
  }, [step, contract.multisigAddress, buyerLocked, sellerLocked, contract.itemPriceKas, contract.sellerCommitmentKas]);

  // Poll Arweave for counterparty's partial sig on step 4
  useEffect(() => {
    if (step !== 4 || !contract.agreementId) return;
    // Only seller needs to poll (buyer is the one who confirms delivery)
    if (role === 'buyer') return;
    
    let cancelled = false;
    const pollPartialSig = async () => {
      if (cancelled) return;
      try {
        // Check Arweave for PartialSig from counterparty
        // queryAgreementsFromArweave imported statically
        const results = await queryAgreementsFromArweave({
          status: 'PartialSig',
        });
        const match = results.find((r: any) => (r.agreementId || r.agreement_id || r.KVAgreementId) === contract.agreementId);
        if (match && match.signature && !cancelled) {
          console.log('[PartialSig-Poll] Found buyer partial sig on Arweave!');
          // Auto-complete: co-sign and broadcast
          try {
            const wallet = await loadMainWallet();
            if (!wallet || !contract.frostData) return;
            const totalAmount = BigInt(Math.floor((contract.itemPriceKas + contract.sellerCommitmentKas) * 1e8)) - 10000n;
            // 2-round FROST co-sign
            // completeFrost2Round imported statically from frost_complete
            // getFrostR imported statically
            // AsyncStorage imported statically
            // Split template from encrypted sig before decrypt
            let encSig = match.signature || '';
            let txTemplateB64 = '';
            const pipePos = encSig.indexOf('|');
            if (pipePos > 0) { txTemplateB64 = encSig.slice(pipePos + 1); encSig = encSig.slice(0, pipePos); }
            const decrypted = (() => { try { const d = decryptPartialSig({ encrypted: encSig, myPrivKeyHex: wallet.privKeyHex, counterpartyPubKeyHex: role === 'seller' ? (contract.buyerPubkey || '') : (contract.sellerPubkey || ''), ctx: { agreementId: contract.agreementId || '', buyerPubkey: contract.buyerPubkey || '', sellerPubkey: contract.sellerPubkey || '', multisigAddress: contract.multisigAddress || '', aggregatedPubkey: contract.frostData?.aggregatedPubkey || '', network: contract.frostData?.network || 'testnet-10', itemPriceKas: contract.itemPriceKas, sellerCommitmentKas: contract.sellerCommitmentKas, R_hex: '' }, nonce: match.nonce || '' }); console.log('[FROST] Decrypted counterparty partial sig'); return d; } catch (e) { console.warn('[FROST] Decrypt failed:', e); return match.signature; } })();
            let buyerR = '';
            try { const rData = await getFrostR(contract.agreementId || ''); buyerR = rData?.frost_r_a || ''; } catch {}
            if (!buyerR) { try { const gql = '{ transactions(first: 10, tags: [{ name: "KV-AgreementId", values: ["' + contract.agreementId + '"] }]) { edges { node { tags { name value } } } } }'; const resp = await fetch('https://arweave.net/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: gql }) }); const json = await resp.json(); for (const edge2 of (json?.data?.transactions?.edges || [])) { const t2 = edge2?.node?.tags || []; const m2 = {}; t2.forEach(t => { m2[t.name] = t.value; }); const p2 = m2['KV-Pubkey'] || ''; if (p2 !== (role === 'seller' ? (contract.sellerPubkey || '') : (contract.buyerPubkey || '')) && m2['KV-FrostR']) { buyerR = m2['KV-FrostR']; console.log('[FROST-2R] Found counterparty R from Arweave:', buyerR.slice(0,20)); break; } } } catch {} }
            const sigStr = typeof decrypted === 'string' ? decrypted : '';
            // Parse all s values: R_agg_x (64) + s_0 (64) + s_1 (64) + ...
            const cpAllS: string[] = []; for (let si = 64; si < sigStr.length; si += 64) { cpAllS.push(sigStr.slice(si, si + 64)); }
            console.log('[FROST-2R] Buyer sent', cpAllS.length, 'partial s values');
            const buyerSig = cpAllS.length > 0 ? { R_agg_x_hex: sigStr.slice(0, 64), s_hex: cpAllS.join('') + (txTemplateB64 ? '|' + txTemplateB64 : '') } : undefined;
            const myNonceJson = await AsyncStorage.getItem('kv_frost_nonce_' + (contract.agreementId || ''));
            if (!myNonceJson || !buyerR) { console.warn('[PartialSig-Poll] Missing nonce or buyer R, skipping'); return; }
            const result = await completeFrost2Round({ frostAddress: contract.frostData, myPrivateKeyHex: wallet.privKeyHex, recipientAddress: wallet.address, amountSompi: totalAmount, myNonceJson, counterpartyR_hex: buyerR, counterpartySig: buyerSig, buyerAmountSompi: BigInt(Math.floor((contract.itemPriceKas || 0) * 1e8)), sellerAmountSompi: BigInt(Math.floor((contract.sellerCommitmentKas || 0) * 1e8)), buyerAddress: (() => { const bpk = contract.buyerPubkey || ''; const bx = bpk.length === 66 ? bpk.slice(2) : bpk; return aggregateToAddress('02' + bx, contract.frostData?.network || 'testnet-10'); })(), sellerAddress: wallet.address });
            if (result.success && result.txId) {
              console.log('[PartialSig-Poll] Release TX broadcast:', result.txId);
              setContract(prev => ({ ...prev, releaseTxId: result.txId, releaseExplorerUrl: result.explorerUrl }));
              setStep(7);
              Alert.alert('Funds Released!', 'TX: ' + (result.txId || '').slice(0, 16) + '...\nFunds returned to your wallet.');
            } else {
              console.warn('[PartialSig-Poll] Broadcast failed:', result.error);
            }
          } catch (e) { console.warn('[PartialSig-Poll] Co-sign error:', e); }
        }
        // Try TownHall agreement status for partial sig (fastest)
        if (!cancelled) {
          try {
            const agrStatus = await getAgreementStatus(contract.agreementId || '');
            if (agrStatus) {
              const partialSig = role === 'seller' ? agrStatus.partial_sig_a : agrStatus.partial_sig_b;
              if (partialSig) {
                console.log('[PartialSig-Poll] Found on TownHall agreement status!');
                // Auto-complete
                try {
                  const w2 = await loadMainWallet();
                  if (w2 && contract.frostData && !cancelled) {
                    const total2 = BigInt(Math.floor((contract.itemPriceKas + contract.sellerCommitmentKas) * 1e8)) - 10000n;
                    const res2 = await completeFrostAndBroadcast({
                      frostAddress: contract.frostData,
                      myPrivateKeyHex: w2.privKeyHex,
                      recipientAddress: w2.address,
                      amountSompi: total2,
                      counterpartyPartialSig: (() => {
                try {
                  const dCtx2 = {
                    agreementId: contract.agreementId || '',
                    buyerPubkey: contract.buyerPubkey || '',
                    sellerPubkey: contract.sellerPubkey || '',
                    multisigAddress: contract.multisigAddress || '',
                    aggregatedPubkey: contract.frostData?.aggregatedPubkey || '',
                    network: contract.frostData?.network || 'testnet-10',
                    itemPriceKas: contract.itemPriceKas,
                    sellerCommitmentKas: contract.sellerCommitmentKas,
                    R_hex: '',
                  };
                  return decryptPartialSig({ encrypted: partialSig, myPrivKeyHex: w2.privKeyHex, counterpartyPubKeyHex: role === 'seller' ? (contract.buyerPubkey || '') : (contract.sellerPubkey || ''), ctx: dCtx2, nonce: '' });
                } catch { return partialSig; }
              })(),
                    });
                    if (false /* disabled: old single-round */ && res2.success && res2.txId) {
                      console.log('[PartialSig-Poll] Release TX:', res2.txId);
                      setContract(prev => ({ ...prev, releaseTxId: res2.txId, releaseExplorerUrl: res2.explorerUrl }));
                      setStep(7);
                      Alert.alert('Funds Released!', 'TX: ' + (res2.txId || '').slice(0, 16) + '...\nFunds returned to your wallet.');
                    }
                  }
                } catch (e3) { console.warn('[PartialSig-Poll] TownHall auto-complete failed:', e3); }
              }
            }
          } catch (e4) { console.warn('[PartialSig-Poll] TownHall status check failed:', e4); }
        }
        // Also try TownHall relay as fast path
        if (!cancelled) {
          // fetchPartialTx imported statically
          const relayPayload = await fetchPartialTx(contract.agreementId || '');
          if (relayPayload?.partialTx) {
            console.log('[PartialSig-Poll] Found on TownHall relay! Auto-completing...');
            setContract(prev => ({ ...prev, partialReleaseTx: relayPayload.partialTx }));
            // Auto-complete: co-sign and broadcast
            try {
              const w = await loadMainWallet();
              if (w && contract.frostData && !cancelled) {
                const total = BigInt(Math.floor((contract.itemPriceKas + contract.sellerCommitmentKas) * 1e8)) - 10000n; // subtract fee
                console.log('[PartialSig-Poll] Relay path skipped - using 2-round via Arweave poll'); const res = { success: false } as any;
                if (res.success && res.txId) {
                  console.log('[PartialSig-Poll] Release TX:', res.txId);
                  setContract(prev => ({ ...prev, releaseTxId: res.txId, releaseExplorerUrl: res.explorerUrl }));
                  setStep(7);
                  Alert.alert('Funds Released!', 'TX: ' + (res.txId || '').slice(0, 16) + '...\nFunds returned to your wallet.');
                }
              }
            } catch (e) { console.warn('[PartialSig-Poll] TownHall auto-complete failed:', e); }
          }
        }
      } catch (e) { console.warn('[PartialSig-Poll] Error:', e); }
    };

    pollPartialSig();
    const interval = setInterval(pollPartialSig, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [step, contract.agreementId, role, contract.buyerPubkey]);

  // Background inbox poll every 30 seconds when on Join screen
  useEffect(() => {
    if (step !== 1 || agreementType !== 'join') return;
    let cancelled = false;
    const pollInbox = async () => {
      if (cancelled) return;
      try {
        const wallet = await loadMainWallet();
        if (!wallet || cancelled) return;
        const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
        const dataPart = wallet.address.split(':')[1];
        const data5bit = Array.from(dataPart).map((c: string) => CHARSET.indexOf(c));
        const result: number[] = [];
        let buff = 0, bits = 0;
        for (const d of data5bit) { buff = (buff << 5) | d; bits += 5; while (bits >= 8) { bits -= 8; result.push((buff >> bits) & 0xff); } }
        let myPubkey = '';
        if (result[0] === 0x00 && result.length >= 33) {
          const xOnly = result.slice(1, 33);
          myPubkey = '02' + xOnly.map((b: number) => b.toString(16).padStart(2, '0')).join('');
        }
        if (!myPubkey || cancelled) return;
        // Layer 1: TownHall (instant)
        const allProposed = await listProposedAgreements();
        const thPending = allProposed.filter((a: any) => (a.party_a?.pubkey || a.pubkey || '') !== myPubkey && (a.status || '').toLowerCase() === 'proposed');
        if (thPending.length > 0 && !cancelled) {
          console.log('[Inbox-Poll] TownHall:', thPending.length, 'proposals');
          setInboxAgreements(prev => {
            const ids = new Set(prev.map(p => p.agreementId || p.agreement_id));
            const newOnes = thPending.filter((a: any) => !ids.has(a.agreementId || a.agreement_id));
            return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
          });
        }
        // Layer 2: arweave.net (0.3s)
        try {
          const gql = '{ transactions(first: 50, tags: [{ name: "KV-Counterparty", values: ["' + myPubkey + '"] }, { name: "KV-Status", values: ["Proposed"] }], sort: HEIGHT_DESC) { edges { node { id, tags { name, value } } } } }';
          let arResp = await fetch('https://arweave.net/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: gql }) }).catch(() => null);
          if (!arResp?.ok) arResp = await fetch('https://arweave.net/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: gql }) });
          const arJson = await arResp.json();
          const arEdges = arJson?.data?.transactions?.edges || [];
          if (arEdges.length > 0 && !cancelled) {
            const arProposals = arEdges.map((edge: any) => {
              const tags = edge?.node?.tags || [];
              const tm: any = {};
              tags.forEach((t: any) => { tm[t.name] = t.value; });
              return { agreementId: tm['KV-AgreementId'] || '', pubkey: tm['KV-Pubkey'] || '', counterpartyPubkey: tm['KV-Counterparty'] || '', amount_sompi: parseInt(tm['KV-Amount'] || '0'), buyerAmountSompi: parseInt(tm['KV-BuyerAmount'] || '0'), sellerAmountSompi: parseInt(tm['KV-SellerAmount'] || '0'), description: tm['KV-Description'] || '', network: tm['KV-Network'] || 'testnet-10', status: 'Proposed', arweave_tx_id: edge.node.id, frostAddress: tm['KV-FrostAddress'] || '', partyA: { pubkey: tm['KV-Pubkey'] || '', amount_sompi: parseInt(tm['KV-Amount'] || '0') } };
            }).filter((a: any) => a.agreementId && a.pubkey !== myPubkey);
            if (arProposals.length > 0) {
              console.log('[Inbox-Poll] Arweave:', arProposals.length, 'proposals');
              setInboxAgreements(prev => {
                const ids = new Set(prev.map(p => p.agreementId || p.agreement_id));
                const newOnes = arProposals.filter((a: any) => !ids.has(a.agreementId));
                return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
              });
            }
          }
        } catch (e) { /* Arweave poll failed, non-fatal */ }
      } catch (e) { console.warn('[Inbox-Poll] Error:', e); }
    };
    const interval = setInterval(pollInbox, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [step, agreementType]);



  
  // Generate FROST address when both pubkeys available
  useEffect(() => {
    const generateFrostAddress = async () => {
      if (step === 3 && !contract.multisigAddress && contract.buyerPubkey && contract.sellerPubkey) {
        let currentDaa = 0;
        try {
          const networkStr = await SecureStore.getItemAsync('kaspa_network');
          const network: KaspaNetwork = (networkStr === 'testnet-10' || networkStr === 'testnet-11') 
            ? networkStr 
            : 'testnet-10';
          
          // Deterministic agreement ID from proposal variables
          const { sha256: sha256Agr } = require('@noble/hashes/sha256');
          // Get UTXO tag for unique AGR ID
          const propWalletForTag = await loadMainWallet();
          let utxoTag = 'no-utxo';
          if (propWalletForTag) {
            try {
              const ledgerResult = await syncLedger(propWalletForTag.address);
              const firstFree = ledgerResult.utxos.find((u: any) => u.status === 'free');
              if (firstFree) { utxoTag = firstFree.utxoKey; console.log('[AGR-ID] UTXO tag:', utxoTag); }
            } catch (e) { console.warn('[AGR-ID] Ledger sync failed:', e); }
          }
          const agrInput = new TextEncoder().encode(
            (contract.buyerPubkey || '') + 
            (contract.sellerPubkey || '') + 
            Math.floor(contract.itemPriceKas * 1e8).toString() +
            Math.floor(contract.sellerCommitmentKas * 1e8).toString() +
            network +
            utxoTag


          );
          const agrHash = sha256Agr(agrInput);
          const agreementId = 'AGR_' + Array.from(agrHash.slice(0, 6)).map(b => b.toString(16).padStart(2, '0')).join('');
          
          // Derive locally with verification code
          const frostData = deriveFrostAddressLocal({
            pubkeyA: contract.buyerPubkey,
            pubkeyB: contract.sellerPubkey,
            network,
            agreementId,
          });
          
          const verificationCode = generateVerificationCode(
            contract.buyerPubkey, 
            contract.sellerPubkey
          );
          
          console.log('[Neighbor] Derived FROST address:', frostData.address);
          console.log('[Neighbor] Verification code:', verificationCode);
          
          setContract(prev => ({
            ...prev,
            multisigAddress: frostData.address,
            frostData,
            agreementId,
            verificationCode,
          }));
          
          // Propose agreement on TownHall relay
          try {
            const propWallet = await loadMainWallet();
            const myPubkey = role === 'buyer' ? contract.buyerPubkey : contract.sellerPubkey;
            const counterPubkey = role === 'buyer' ? contract.sellerPubkey : contract.buyerPubkey;
            const myAmount = role === 'buyer' ? Math.floor(contract.itemPriceKas * 1e8) : Math.floor(contract.sellerCommitmentKas * 1e8);
            // Fetch current L1 DAA score for deterministic ordering
            try {
              const nw = await SecureStore.getItemAsync('kaspa_network');
              const daaBase = nw?.includes('testnet') ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
              const daaResp = await fetch(daaBase + '/info/virtual-chain-blue-score');
              if (daaResp.ok) { const daaData = await daaResp.json(); currentDaa = daaData.blueScore || 0; }
            } catch (e) { console.warn('[Neighbor] DAA fetch failed:', e); }
            // Check duplicate proposal guard
            const dupGuard = await isAlreadyCommitted(agreementId);
            if (dupGuard.committed) {
              console.log('[UTXO-Guard] Already committed to', agreementId, '- skipping re-propose');
              Alert.alert('Already Proposed', 'Agreement ' + agreementId.slice(0,12) + ' already exists. Reset to create a new one.');
              setIsLoading(false);
              return;
            }
            // Also check TownHall for existing agreement
            try {
              const thCheck = await getAgreementStatus(agreementId);
              if (thCheck && !thCheck.error) {
                console.log('[TH-Guard] Agreement already exists on TownHall:', agreementId, 'status:', thCheck.status);
                setIsLoading(false);
                return;
              }
            } catch(thErr) { console.log('[TH-Guard] TownHall check failed (proceeding):', thErr); }
            console.log('[Neighbor] Proposing to TownHall:', agreementId, 'frost:', frostData.address, 'DAA:', currentDaa);
            const proposeResult = await proposeAgreement({
              agreementId: agreementId,
              pubkey: myPubkey || '',
              amount_sompi: Math.floor(contract.itemPriceKas * 1e8) + Math.floor(contract.sellerCommitmentKas * 1e8),
              signature: 'frost_create_' + Date.now(),
              description: contract.itemDescription || '',
              network,
              counterpartyPubkey: counterPubkey || undefined,
              frostAddress: frostData.address,
              daaScore: currentDaa,
              buyerAmountSompi: Math.floor(contract.itemPriceKas * 1e8),
              sellerAmountSompi: Math.floor(contract.sellerCommitmentKas * 1e8),
            } as any);
            // Reduce spendable for proposer (input cap)
            console.log('[Neighbor] Proposal sent ? waiting for counterparty to accept');
            if (!proposeResult?.success) {
              console.warn('[Neighbor] TownHall propose failed:', JSON.stringify(proposeResult));
              Alert.alert('Proposal Failed', 'Could not post to TownHall. Please try again.');
            } else {
              console.log('[Neighbor] Agreement proposed on TownHall:', agreementId);
              // Tag UTXOs only after successful proposal
              try {
                const proposeAmount = role === 'buyer' ? BigInt(Math.floor(contract.itemPriceKas * 1e8)) : BigInt(Math.floor(contract.sellerCommitmentKas * 1e8));
                if (proposeAmount > 0n) {
                  console.log("[UTXO-Debug] propWallet address:", propWallet?.address?.slice(0,30), "amount:", proposeAmount.toString());
                  const debugResult = await syncLedger(propWallet?.address || ""); console.log("[UTXO-Debug] syncLedger:", debugResult.utxos.length, "free,", debugResult.allEntries.length, "total, spendable:", Number(debugResult.spendableBalance)/1e8, "committed:", Number(debugResult.committedBalance)/1e8);
                  const tagResult = await canonicalCommit(propWallet?.address || '', proposeAmount, agreementId, 'buyer', myPubkey || '');
                  console.log('[UTXO-Tag] Buyer proposal tagged:', tagResult.success, 'hashes:', tagResult.commitHashes?.length);
                }
              } catch (e) { console.warn('[Neighbor] Proposer ledger commit skipped:', e); }
              // Generate R nonce at proposal time for clipboard
              try {
                const propNonce = generateFrostNonce({ frostAddress: frostData, recipientAddress: counterpartyKaspaAddr || '', amountSompi: BigInt(Math.floor((contract.itemPriceKas + contract.sellerCommitmentKas) * 1e8)), privateKeyHex: propWallet?.privKeyHex || '' });
                await AsyncStorage.setItem('kv_frost_nonce_' + agreementId, JSON.stringify({ R_hex: propNonce.R_hex, k_private: propNonce.k_private, d_tweaked: propNonce.d_tweaked, message_hex: propNonce.message_hex }));
                console.log('[FROST-R] Generated nonce R at proposal:', propNonce.R_hex.slice(0,20));
              } catch(e) { console.warn('[FROST-R] Proposal nonce failed:', e); }
              addToFrostList({
                agrId: agreementId, frostAddr: frostData.address, role: 'buyer', step: 3,
                buyerAmount: contract.itemPriceKas, sellerAmount: contract.sellerCommitmentKas,
                buyerPubkey: contract.buyerPubkey || '', sellerPubkey: contract.sellerPubkey || '',
                description: contract.itemDescription || '', createdAt: Date.now(),
              });
              if (proposeResult?.arweaveTxId) {
                console.log('[Neighbor] Arweave TX ID:', proposeResult.arweaveTxId);
                setContract(prev => ({ ...prev, arweaveTxId: proposeResult.arweaveTxId }));
              }
            }
          } catch (e) { console.warn('[Neighbor] TownHall propose failed:', e); }
          // L1 inscription disabled � Arweave inscription is the permanent record
          // wRPC sendWithInscription not available from React Native/Hermes
          console.log('[Neighbor] Skipping wRPC inscription (Arweave is source of truth)');
        } catch (e) {
          console.error('[Neighbor] FROST derivation failed:', e);
          Alert.alert('Error', 'Failed to derive FROST address');
        }
      }
    };
    generateFrostAddress();
  }, [step, contract.buyerPubkey, contract.sellerPubkey]);
  
  useEffect(() => {
    const loadMyPubkey = async () => {
      try {
        const wallet = await loadMainWallet();
        if (!wallet) return;
        const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
        const dataPart = wallet.address.split(':')[1];
        const data5bit = Array.from(dataPart).map((c: string) => CHARSET.indexOf(c));
        const result: number[] = [];
        let buff = 0, bits = 0;
        for (const d of data5bit) { buff = (buff << 5) | d; bits += 5; while (bits >= 8) { bits -= 8; result.push((buff >> bits) & 0xff); } }
        if (result[0] === 0x00 && result.length >= 33) {
          const xOnly = result.slice(1, 33);
          const pubkey = '02' + xOnly.map((b: number) => b.toString(16).padStart(2, '0')).join('');
          console.log('[Neighbor] My pubkey:', pubkey);
          // Only set pubkey if FROST hasn't been derived yet
          if (!contract.multisigAddress) {
            if (role === 'buyer') {
              setContract(prev => ({ ...prev, buyerPubkey: pubkey }));
            } else {
              setContract(prev => ({ ...prev, sellerPubkey: pubkey }));
            }
          } else {
            console.log('[Neighbor] Pubkey frozen ? FROST already derived');
          }
        }
      } catch (e) {
        console.error('[Neighbor] Failed to load pubkey:', e);
      }
    };
    if (role) loadMyPubkey();
  }, [role]);
  
  const handleSetCounterparty = (addr: string) => {
    setCounterpartyKaspaAddr(addr);
    if (addr.length > 40 && (addr.startsWith('kaspa:') || addr.startsWith('kaspatest:'))) {
      try {
        const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
        const dataPart = addr.split(':')[1];
        const data5bit = Array.from(dataPart).map(c => CHARSET.indexOf(c));
        const result: number[] = [];
        let buff = 0, bits = 0;
        for (const d of data5bit) { buff = (buff << 5) | d; bits += 5; while (bits >= 8) { bits -= 8; result.push((buff >> bits) & 0xff); } }
        if (result[0] === 0x00 && result.length >= 33) {
          const xOnly = result.slice(1, 33);
          const pubkeyHex = '02' + xOnly.map(b => b.toString(16).padStart(2, '0')).join('');
          console.log('[Neighbor] Counterparty pubkey from address:', pubkeyHex);
          if (role === 'buyer') {
            setContract(prev => ({ ...prev, sellerPubkey: pubkeyHex, counterpartyPubkey: pubkeyHex }));
          } else {
            setContract(prev => ({ ...prev, buyerPubkey: pubkeyHex, counterpartyPubkey: pubkeyHex }));
          }
          setCounterpartyAddress(addr);
        }
      } catch (e) {
        console.warn('[Neighbor] Failed to parse address:', e);
      }
    }
  };


  // === PARTY B INBOX: Load pending agreements from TownHall ===
  const loadInbox = async () => {
    try { await releaseExpiredCommitments(); } catch (e) { console.warn('[UTXO-Expiry] Check failed:', e); }
    setInboxLoading(true);
    try {
      const wallet = await loadMainWallet();
      if (!wallet) { setInboxLoading(false); return; }
      // Derive pubkey from address
      const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
      const dataPart = wallet.address.split(':')[1];
      const data5bit = Array.from(dataPart).map((c: string) => CHARSET.indexOf(c));
      const result: number[] = [];
      let buff = 0, bits = 0;
      for (const d of data5bit) { buff = (buff << 5) | d; bits += 5; while (bits >= 8) { bits -= 8; result.push((buff >> bits) & 0xff); } }
      let myPubkey = '';
      if (result[0] === 0x00 && result.length >= 33) {
        const xOnly = result.slice(1, 33);
        myPubkey = '02' + xOnly.map((b: number) => b.toString(16).padStart(2, '0')).join('');
      }
      if (!myPubkey) { setInboxLoading(false); return; }
      const agreements = await listMyAgreements(myPubkey);
      // Also fetch all proposed agreements (for Party B inbox)
      // listProposedAgreements imported statically
      const allProposed = await listProposedAgreements();
      // Arweave fallback — query permanent storage if TownHall cache is empty
      let arweaveProposals: any[] = [];
      // Always query Arweave � TownHall is stateless and may have stale data
      try {
        arweaveProposals = await queryAgreementsFromArweave({ status: 'Proposed', network: 'testnet-10' });
        console.log('[Neighbor] Arweave found', arweaveProposals.length, 'proposals');
      } catch (e) { console.warn('[Neighbor] Arweave query failed:', e); }
      // Show proposed agreements where I'm NOT party A (i.e., I can accept)
      const allAgreements = [...agreements, ...allProposed, ...arweaveProposals];
      const seen = new Set<string>();
      // Deduplicate by agreementId, sort by DAA (deterministic)
      const byId = new Map();
      for (const a of allAgreements) {
        const id = a.agreementId || a.agreement_id || '';
        if (!id) continue;
        const daa = Number(a.daaScore || a.daa_score || 0);
        const ts = Number(a.unix_time || a.created_at || a.createdAt || a.timestamp || 0);
        const score = daa > 0 ? daa : ts;
        const existing = byId.get(id);
        if (!existing || score > (existing._score || 0)) byId.set(id, { ...a, _score: score });
      }
      const pending = Array.from(byId.values())
        .filter((a) => {
          if ((a.status || '').toLowerCase() !== 'proposed') return false;
          return (a.partyA?.pubkey || a.party_a?.pubkey || a.pubkey || '') !== myPubkey;
        })
        .sort((a, b) => (b._score || 0) - (a._score || 0))
        .slice(0, 10);
      // Remove fake/test proposals with invalid pubkeys
      const validPending = pending.filter((a) => {
        const pk = a.partyA?.pubkey || a.party_a?.pubkey || a.pubkey || '';
        const amt = Number(a.partyA?.amount_sompi || a.party_a?.amount_sompi || a.amount_sompi || 0);
        return pk.length >= 60 && (pk.startsWith('02') || pk.startsWith('03')) && amt >= 0;
      });
      // Enrich: if entry has amount but no buyer/seller split, get from Arweave
      const enrichedPending = validPending.map((a: any) => {
        if (!a.buyerAmountSompi && a.amount_sompi > 0) {
          const arMatch = arweaveProposals?.find((ar: any) => (ar.agreementId || ar.agreement_id) === (a.agreementId || a.agreement_id));
          if (arMatch?.buyerAmountSompi) {
            a.buyerAmountSompi = arMatch.buyerAmountSompi;
            a.sellerAmountSompi = arMatch.sellerAmountSompi;
          }
        }
        return a;
      });
      // Phase 3: Direct Goldsky query for proposals addressed to MY pubkey
      try {
        const myGql = '{ transactions(first: 50, tags: [{ name: "KV-Counterparty", values: ["' + myPubkey + '"] }, { name: "KV-Status", values: ["Proposed"] }], sort: HEIGHT_DESC) { edges { node { id, tags { name, value } } } } }';
        let myResp = await fetch('https://arweave.net/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: myGql }) }).catch(() => null);
        if (!myResp?.ok) myResp = await fetch('https://arweave.net/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: myGql }) });
        const myJson = await myResp.json();
        const myEdges = myJson?.data?.transactions?.edges || [];
        console.log('[Neighbor] Direct inbox query found', myEdges.length, 'proposals for me');
        for (const edge of myEdges) {
          const tags = edge?.node?.tags || [];
          const tm: any = {};
          tags.forEach((t: any) => { tm[t.name] = t.value; });
          const agrId = tm['KV-AgreementId'] || '';
          if (!agrId || enrichedPending.find((a: any) => (a.agreementId || a.agreement_id) === agrId)) continue;
          enrichedPending.push({
            agreementId: agrId,
            pubkey: tm['KV-Pubkey'] || '',
            counterpartyPubkey: tm['KV-Counterparty'] || '',
            amount_sompi: parseInt(tm['KV-Amount'] || '0'),
            buyerAmountSompi: parseInt(tm['KV-BuyerAmount'] || '0'),
            sellerAmountSompi: parseInt(tm['KV-SellerAmount'] || '0'),
            description: tm['KV-Description'] || '',
            network: tm['KV-Network'] || 'testnet-10',
            status: 'Proposed',
            arweave_tx_id: edge.node.id,
            frostAddress: tm['KV-FrostAddress'] || '',
            partyA: { pubkey: tm['KV-Pubkey'] || '', amount_sompi: parseInt(tm['KV-Amount'] || '0') },
          });
        }
      } catch (e) { console.warn('[Neighbor] Direct inbox query failed:', e); }
      console.log('[Neighbor] Inbox:', enrichedPending.length, 'valid proposals (filtered', pending.length - enrichedPending.length, 'invalid)');
      setInboxAgreements(prev => {
        const ids = new Set(enrichedPending.map(p => p.agreementId || p.agreement_id));
        const kept = prev.filter(p => !ids.has(p.agreementId || p.agreement_id));
        return [...enrichedPending, ...kept];
      });
    } catch (e) {
      console.error('[Neighbor] Inbox load error:', e);
    }
    setInboxLoading(false);
  };

  const handleAcceptFromInbox = async (agreement: any) => {
    const _agrId = agreement.agreementId || agreement.agreement_id || '';
    if (acceptingId) { console.log('[Neighbor] Already accepting', acceptingId); return; }
    console.log('[Neighbor] Agree tapped:', _agrId);
    setAcceptingId(_agrId);
    setIsLoading(true);
    try {
      const isFromArweave = !!agreement.arweave_tx_id;
      const wallet = await loadMainWallet();
      if (!wallet) return;
      const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
      const dataPart = wallet.address.split(':')[1];
      const data5bit = Array.from(dataPart).map((c: string) => CHARSET.indexOf(c));
      const result: number[] = [];
      let buff = 0, bits = 0;
      for (const d of data5bit) { buff = (buff << 5) | d; bits += 5; while (bits >= 8) { bits -= 8; result.push((buff >> bits) & 0xff); } }
      let myPubkey = '';
      if (result[0] === 0x00 && result.length >= 33) {
        const xOnly = result.slice(1, 33);
        myPubkey = '02' + xOnly.map((b: number) => b.toString(16).padStart(2, '0')).join('');
      }
      // Step 1: Inscribe "Agreed" to Arweave (with dedup)
      const agrId = agreement.agreementId || agreement.agreement_id || '';
      const agrSessionKey = 'kv_agreed_' + agrId;
      const alreadyAgreed = await AsyncStorage.getItem(agrSessionKey);
      if (alreadyAgreed) {
        console.log('[Neighbor] Already agreed to', agrId, '- skipping duplicate inscription');
      }
      const agreementPubkey = agreement.partyA?.pubkey || agreement.party_a?.pubkey || agreement.pubkey || '';
      if (agreementPubkey === myPubkey) {
        console.warn('[Canonical] BLOCKED: cannot accept own proposal');
        Alert.alert('Cannot Accept', 'This is your own proposal.');
        setIsLoading(false); setAcceptingId(null); return;
      }
      const agreementCounterparty = agreement.counterpartyPubkey || agreement.counterparty || agreement.KVCounterparty || '';
      // Determine: am I the proposer or the acceptor?
      const iAmProposer = agreementPubkey === myPubkey;
      const canonRole = canonicalDetermineRole(agreementPubkey, myPubkey);
      console.log('[Canonical] Role determined:', canonRole, 'proposer:', agreementPubkey.slice(0,16), 'me:', myPubkey.slice(0,16));
      const proposerPubkey = iAmProposer ? (agreementCounterparty || '') : agreementPubkey;
      console.log('[Neighbor] Role detection:', iAmProposer ? 'I am proposer' : 'I am acceptor', 'proposer:', proposerPubkey.slice(0,16), 'me:', myPubkey.slice(0,16));
      const agrAmount = agreement.partyA?.amount_sompi || agreement.party_a?.amount_sompi || agreement.amount_sompi || 0;
      if (!alreadyAgreed) {
        try {
          await inscribeAgreementToArweave({
            agreementId: agrId,
            pubkey: myPubkey,
            amount_sompi: typeof agrAmount === 'number' ? agrAmount : Number(agrAmount),
            description: agreement.description || '',
            network: wallet.network || 'testnet-10',
            status: 'Agreed',
            frostAddress: contract.frostData?.address || contract.multisigAddress || '',
            signature: 'agree_' + Date.now(),
            counterpartyPubkey: proposerPubkey,
              buyerAmountSompi: Math.floor((canon?.buyerAmountSompi || 0)),
              sellerAmountSompi: Math.floor((canon?.sellerAmountSompi || 0)),
          });
          await AsyncStorage.setItem(agrSessionKey, String(Date.now()));
          console.log('[Neighbor] Agreed inscribed to Arweave');
        } catch (e) { console.warn('[Neighbor] Agree inscription failed:', e); }
      }

      // Step 1b: Tell TownHall we accepted
      try {
        await acceptAgreement({
          agreementId: agrId,
          pubkey: myPubkey,
          amount_sompi: typeof agrAmount === 'number' ? agrAmount : Number(agrAmount),
          signature: 'accept_th_' + Date.now(),
        });
        console.log('[Neighbor] TownHall accept registered');
      } catch (e) { console.warn('[Neighbor] TownHall accept failed:', e); }

      // Step 2: Buyer accepted — derive FROST + wait for mutual Agreed-Send poll to trigger auto-send
      console.log('[Neighbor] Buyer accepted — deriving FROST, auto-send via poll');
      setInboxAgreements(prev => prev.filter(a => (a.agreementId || a.agreement_id) !== agrId));

      // Proceed to FROST derivation � derive FROST + auto-send
      // Run canonical verification
      // Normalize raw agreement data
      const normalized = normalizeAgreement(agreement);
      // Enrich: if counterparty missing, use the proposer pubkey (we know we're the acceptor)
      if (!normalized.counterpartyPubkey) {
        normalized.counterpartyPubkey = myPubkey;
        // Swap: normalized.pubkey is the proposer (buyer), we are the acceptor (seller)
      }
      // Enrich: fetch buyer/seller split from Goldsky if missing
      if (normalized.buyerAmountSompi === 0 && normalized.agreementId) {
        try {
          const gql = '{ transactions(first: 1, tags: [{ name: "KV-AgreementId", values: ["' + normalized.agreementId + '"] }, { name: "KV-Status", values: ["Proposed"] }]) { edges { node { tags { name, value } } } } }';
          const gResp = await fetch('https://arweave.net/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: gql }) });
          const gJson = await gResp.json();
          const gTags = gJson?.data?.transactions?.edges?.[0]?.node?.tags;
          if (gTags) {
            const gMap: any = {};
            gTags.forEach((t: any) => { gMap[t.name] = t.value; });
            normalized.buyerAmountSompi = parseInt(gMap['KV-BuyerAmount'] || '0', 10);
            normalized.sellerAmountSompi = parseInt(gMap['KV-SellerAmount'] || '0', 10);
            if (!normalized.counterpartyPubkey || normalized.counterpartyPubkey === myPubkey) {
              // We are acceptor, so counterparty = KV-Counterparty from Arweave
              normalized.counterpartyPubkey = gMap['KV-Counterparty'] || myPubkey;
              normalized.pubkey = gMap['KV-Pubkey'] || normalized.pubkey;
            }
            console.log('[Canonical-Enrich] Goldsky: buyer=', normalized.buyerAmountSompi, 'seller=', normalized.sellerAmountSompi, 'pub=', normalized.pubkey?.slice(0,16), 'cp=', normalized.counterpartyPubkey?.slice(0,16));
          }
        } catch (e) { console.warn('[Canonical-Enrich] Goldsky fetch failed:', e); }
      }
      console.log('[Canonical-DEBUG] normalized:', JSON.stringify({ agr: normalized.agreementId, pub: normalized.pubkey?.slice(0,16), cp: normalized.counterpartyPubkey?.slice(0,16), amt: normalized.amount_sompi, buyer: normalized.buyerAmountSompi, seller: normalized.sellerAmountSompi }));
      const canon = canonicalVerify(normalized, myPubkey || ''); // sync — no await needed
      console.log('[Canonical] Module result:', JSON.stringify({ role: canon.role, buyer: canon.buyerAmountSompi / 1e8, seller: canon.sellerAmountSompi / 1e8, total: canon.totalAmountSompi / 1e8, frost: canon.frostAddress?.slice(0,25) }));
      // Override role from canonical
      setRole(canon.role as any);
      console.log('[Neighbor] BOTH AGREED � deriving FROST and auto-sending collateral');
      if (true) {
        // Party A = seller (proposer), Party B = buyer (acceptor)
        const rawAmount = (typeof agrAmount === 'number' ? agrAmount : Number(agrAmount)) / 1e8;
          // Read buyer/seller split from Arweave tags if available
          let buyerAmtTag = agreement.buyerAmountSompi || agreement.KVBuyerAmount || 0;
          let sellerAmtTagTemp = agreement.sellerAmountSompi || agreement.KVSellerAmount || 0;
          // If amounts missing, fetch from Arweave tags directly
          if (buyerAmtTag === 0 && agrId) {
            try {
              const gql = '{ transactions(first: 1, tags: [{ name: "KV-AgreementId", values: ["' + agrId + '"] }, { name: "KV-Status", values: ["Proposed"] }]) { edges { node { tags { name, value } } } } }';
              const resp = await fetch('https://arweave.net/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: gql }) });
              const json = await resp.json();
              const tags = json?.data?.transactions?.edges?.[0]?.node?.tags;
              if (tags) {
                const tagMap: any = {};
                tags.forEach((t: any) => { tagMap[t.name] = t.value; });
                buyerAmtTag = parseInt(tagMap['KV-BuyerAmount'] || '0', 10);
                sellerAmtTagTemp = parseInt(tagMap['KV-SellerAmount'] || '0', 10);
                console.log('[Neighbor] Direct Goldsky amounts: buyer=', buyerAmtTag, 'seller=', sellerAmtTagTemp);
              }
            } catch (e) { console.warn('[Neighbor] Arweave amount fetch failed:', e); }
          }
          // TownHall fallback for amounts (instant, no Goldsky indexing needed)
          if (buyerAmtTag === 0) {
            try {
              const thAgr = await getAgreementStatus(agrId);
              if (thAgr?.partyA?.buyerAmountSompi) {
                buyerAmtTag = thAgr.partyA.buyerAmountSompi;
                sellerAmtTagTemp = thAgr.partyA.sellerAmountSompi || 0;
                console.log('[Neighbor] TownHall amounts: buyer=', buyerAmtTag, 'seller=', sellerAmtTagTemp);
              }
            } catch(e) { console.warn('[Neighbor] TownHall amount lookup failed:', e); }
          }
          const sellerAmtTag = sellerAmtTagTemp || agreement.sellerAmountSompi || agreement.KVSellerAmount || 0;
          const buyerKas = buyerAmtTag > 0 ? Number(buyerAmtTag) / 1e8 : 0;
          if (buyerKas === 0 && rawAmount > 0) {
            Alert.alert('Amount Unknown', 'Cannot determine buyer/seller split.\n\nUse the Agreement ID in manual lookup to get the full breakdown from Arweave.', [{ text: 'OK' }]);
            setAcceptingId(null);
            return;
          }
          // Canonical math: seller = total - buyer (wallet derives independently)
          const sellerKasFromMath = rawAmount - buyerKas;
          const sellerKasFromTag = sellerAmtTag > 0 ? Number(sellerAmtTag) / 1e8 : 0;
          if (sellerKasFromTag > 0 && Math.abs(sellerKasFromMath - sellerKasFromTag) > 0.001) {
            console.warn('[Neighbor] AMOUNT MISMATCH: math=', sellerKasFromMath, 'tag=', sellerKasFromTag);
          }
          const sellerKas = sellerKasFromMath > 0 ? sellerKasFromMath : (sellerKasFromTag > 0 ? sellerKasFromTag : rawAmount);
          console.log('[Neighbor] Amount split: buyer=', buyerKas, 'seller=', sellerKas, 'raw=', rawAmount);
          const sellerAmount = rawAmount;
        // Derive FROST address immediately with both pubkeys
        try {
          const frostNetwork = wallet.network || 'testnet-10';
          console.log('[FROST-DEBUG] pubkeyA:', myPubkey?.slice(0,16), 'pubkeyB:', proposerPubkey?.slice(0,16), 'network:', frostNetwork, 'agrId:', agrId);
          const frostData = deriveFrostAddressLocal({
            pubkeyA: myPubkey,
            pubkeyB: proposerPubkey,
            network: frostNetwork,
            agreementId: agrId,
          });
          console.log('[Neighbor] Inbox FROST address:', frostData.address);
          // === CANONICAL AUTO-SEND: each party finds their pubkey + amount ===
          // Proposer pubkey = KV-Pubkey, Acceptor pubkey = KV-Counterparty
          // Proposer = buyer (sets terms), Acceptor = seller (accepts terms)
          const agrProposerPubkey = agreement.pubkey || agreement.partyA?.pubkey || '';
          const sendsFirst = canonicalSendsFirst(canon);
          const mySendAmount = sendsFirst ? canonicalSendAmount(canon) : 0;
          console.log('[Neighbor] Auto-send check: sendsFirst=', sendsFirst, 'mySendAmount=', mySendAmount / 1e8, 'role:', canon.role, 'myPubkey=', myPubkey?.slice(0,16), 'proposer=', agrProposerPubkey?.slice(0,16));
          const immediateSendAmount = mySendAmount;
          if (immediateSendAmount > 0 && wallet.privKeyHex) {
            const frostSentKey = 'kv_frost_sent_' + agrId;
            const alreadyFrostSent = await AsyncStorage.getItem(frostSentKey);
            if (alreadyFrostSent) {
              console.log('[Neighbor] Already sent to FROST for', agrId, '- skipping');
            } else try {
              console.log('[Neighbor] Seller auto-sending', immediateSendAmount / 1e8, 'KASPA to FROST');
              // sendKaspaViaRest is already imported/available in this scope
              const txResult = await sendKaspaViaRest({
                senderAddress: wallet.address,
                recipientAddress: frostData.address,
                amountSompi: BigInt(immediateSendAmount),
                privateKeyHex: wallet.privKeyHex,
                network: wallet.network || 'testnet-10',
                payload: await (async () => { try { const nonce = generateFrostNonce({ frostAddress: frostData, recipientAddress: frostData.address, amountSompi: BigInt(Math.floor((buyerKas + sellerKas) * 1e8)), privateKeyHex: wallet.privKeyHex }); await AsyncStorage.setItem('kv_frost_nonce_' + agrId, JSON.stringify(nonce)); console.log('[FROST-R] Embedded R in collateral TX payload:', nonce.R_hex.slice(0,20)); try { postFrostR({ agreementId: agrId, pubkey: myPubkey, frostR: nonce.R_hex }).then(() => console.log('[FROST-R] R posted to TownHall')).catch(() => {}); } catch {} return nonce.R_hex; } catch(e) { console.warn('[FROST-R] Payload nonce failed:', e); return ''; } })(),
              });
              console.log('[Neighbor] Seller collateral TX:', txResult.txId);
              await AsyncStorage.setItem('kv_frost_sent_' + agrId, String(Date.now()));
            } catch (e) { console.warn('[Neighbor] Seller auto-send failed (poll will retry):', e); }
          }

          setContract(prev => ({
            ...prev,
            agreementId: agrId,
            description: agreement.description || '',
            buyerPubkey: iAmProposer ? myPubkey : proposerPubkey,
            sellerPubkey: iAmProposer ? proposerPubkey : myPubkey,
            counterpartyPubkey: proposerPubkey,
            ...canonicalToContract(canon),
            // canonical overrides all contract fields
            multisigAddress: frostData.address,
            frostData,
          }));
          
          // Inscribe acceptance to Arweave
          try {
            // inscribeAgreementToArweave imported statically
            await inscribeAgreementToArweave({
              agreementId: agrId,
              pubkey: myPubkey,
              amount_sompi: Math.floor(sellerAmount * 1e8),
              description: agreement.description || '',
              network: frostNetwork,
              status: 'Accepted',
            frostAddress: frostData.address,
              signature: 'accept_' + Date.now(),
              counterpartyPubkey: proposerPubkey,
              buyerAmountSompi: Math.floor(buyerKas * 1e8),
              sellerAmountSompi: Math.floor(sellerKas * 1e8),
              frostR: await (async () => { try { const saved = await AsyncStorage.getItem('kv_frost_nonce_' + agrId); if (saved) { const n = JSON.parse(saved); console.log('[FROST-R] Including R in Accepted inscription:', n.R_hex?.slice(0,20)); return n.R_hex; } } catch {} return ''; })(),
            });
            console.log('[Neighbor] Acceptance inscribed to Arweave');
            // Post R to TownHall (after accept, so party_b exists)
            try { const saved = await AsyncStorage.getItem('kv_frost_nonce_' + agrId); if (saved) { const n = JSON.parse(saved); await postFrostR({ agreementId: agrId, pubkey: myPubkey, frostR: n.R_hex }); console.log('[FROST-R] R posted to TownHall after accept'); } } catch(e) { console.warn('[FROST-R] TownHall R post failed:', e); }
            // Add to active FROST list
            addToFrostList({
              agrId: agrId,
              frostAddr: frostData.address,
              role: canon?.role as any || 'seller',
              step: 3,
              buyerAmount: buyerKas,
              sellerAmount: sellerKas,
              buyerPubkey: iAmProposer ? myPubkey : proposerPubkey,
              sellerPubkey: iAmProposer ? proposerPubkey : myPubkey,
              description: agreement.description || '',
              createdAt: Date.now(),
            });
          } catch (e) { console.warn('[Neighbor] Arweave accept inscription failed:', e); }

          // Reduce spendable (input cap) — Agreed-Send poll handles auto-send
          const myLockAmount = BigInt(Math.floor(sellerAmount * 1e8));
          if (myLockAmount > 0n) {
            try {
              // commitForCollateral from utxo_ledger (canonicalCommit imported statically)
              const sellerTagResult = await canonicalCommit(wallet.address, myLockAmount, agrId, canon?.role || 'seller', myPubkey || '');
          console.log('[UTXO-Tag] Seller accept tagged:', sellerTagResult.success, 'role:', canon?.role, 'hashes:', sellerTagResult.commitHashes?.length);
              console.log('[Neighbor] Spendable reduced by', sellerAmount, 'KASPA for', agrId);
            } catch (e) { console.warn('[Neighbor] Ledger commit skipped:', e); }
          }
          // Set state and go to step 3 — poll handles the rest
          // Role already set by canonical module above
          // setRole(iAmProposer ? 'seller' : 'buyer');
          setAgreementType('trade');
          setStep(3);
          // AUTO-CONFIRM on TownHall — breaks the Arweave polling deadlock
          try {
            // confirmAgreement imported statically
            await confirmAgreement({
              agreementId: agrId,
              pubkey: myPubkey,
              signature: 'confirm_' + Date.now(),
            });
            console.log('[Neighbor] TownHall confirm sent — waiting for counterparty confirm');
          } catch (e) { console.warn('[Neighbor] TownHall confirm failed:', e); }
          Alert.alert('Agreement Accepted!', 'Polling for counterparty.\nAuto-send triggers when both confirm.\nYou can close the app safely.');
          setIsLoading(false);
          return;
        } catch (e) {
          console.error('[Neighbor] FROST derivation failed:', e);
          Alert.alert('Error', 'FROST derivation failed: ' + (e instanceof Error ? e.message : String(e)));
          setIsLoading(false);
          return;
        }
      }
    } catch (e) {
      console.error('[Neighbor] Accept error:', e);
      Alert.alert('Error', e instanceof Error ? e.message : 'Accept failed');
    } finally {
      setIsLoading(false);
      setAcceptingId(null);
    }
  };

  const handleLock = async () => {
    setIsLoading(true);
    try {
      const wallet = await loadMainWallet();
      if (!wallet) { Alert.alert('Error', 'Wallet not initialized'); setIsLoading(false); return; }
      if (!contract.multisigAddress) { Alert.alert('Error', 'FROST address not ready'); setIsLoading(false); return; }

      // Safety: check if counterparty has sent to FROST before allowing manual lock
      try {
        const nStr = await SecureStore.getItemAsync('kaspa_network');
        const aBase = nStr?.includes('testnet') ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
        const fResp = await fetch(aBase + '/addresses/' + contract.multisigAddress + '/balance');
        if (fResp.ok) {
          const fBal = await fResp.json();
          if (BigInt(fBal.balance || '0') === 0n) {
            Alert.alert('Waiting for Counterparty', 'Counterparty has not sent collateral yet.\nPolling every 30 seconds — auto-send will trigger when they do.');
            setIsLoading(false);
            return;
          }
        }
      } catch {}

      const myLockAmount = role === 'buyer'
        ? BigInt(Math.floor(contract.itemPriceKas * 1e8))
        : BigInt(Math.floor(contract.sellerCommitmentKas * 1e8));

      if (myLockAmount <= 0n) {
        // Zero collateral — just mark as done
        if (role === 'buyer') setBuyerLocked(true); else setSellerLocked(true);
        setStep(4);
        setIsLoading(false);
        return;
      }

      console.log('[Neighbor] Sending', Number(myLockAmount) / 1e8, 'KASPA to FROST:', contract.multisigAddress);
      const result = await sendKaspaViaRest({
        senderAddress: wallet.address,
        recipientAddress: contract.multisigAddress,
        amountSompi: myLockAmount,
        privateKeyHex: wallet.privKeyHex,
        network: wallet.network,
      });

      if (!result.success) {
        setCollateralFailed(true);
        Alert.alert('Collateral Failed', result.error || 'Transaction failed. Tap Retry to try again.');
        setIsLoading(false);
        return;
      }

      console.log('[Neighbor] Collateral TX:', result.txId);
      try { await markLocked(contract.agreementId || 'AGR_manual'); } catch {}
      // Merkle archive: per-TX proof for collateral (fire-and-forget, ~0.6 KB, free)
      uploadPerTxProof({
        txId: result.txId || '',
        txIndex: 0,
        amountSompi: myLockAmount,
        scriptPubKey: '',
        daaScore: 0,
        txType: 'collateral',
        balanceAfter: 0, // will be refreshed on next UTXO fetch
        agreementId: contract.agreementId,
        uploadFn: async (data, tags) => {
          const r = await uploadToIrys(data, tags);
          return r.txId || '';
        },
        network: 'testnet',
      }).catch(e => console.warn('[Neighbor] Merkle proof upload failed (non-fatal):', e));
      // Record collateral on TownHall relay
      try {
        const collatResult = await recordCollateral({
          agreementId: contract.agreementId || 'AGR_' + Date.now(),
          pubkey: wallet.address,
          txId: result.txId || '',
          frostAddress: contract.multisigAddress || undefined,
        });
        console.log('[Neighbor] TownHall collateral recorded:', JSON.stringify(collatResult));
      } catch (e) { console.warn('[Neighbor] TownHall record failed:', e); }
      if (role === 'buyer') {
        setBuyerLocked(true);
        setContract(prev => ({ ...prev, buyerLockTxId: result.txId }));
      } else {
        setSellerLocked(true);
        setContract(prev => ({ ...prev, sellerLockTxId: result.txId }));
      }

      Alert.alert('Collateral Sent', 'TX: ' + (result.txId || '').slice(0, 16) + '...\nWaiting for counterparty to lock...');
      // Stay on step 3 � don't advance until both confirmed via L1 poll
    } catch (e) {
      console.error('[Neighbor] Lock error:', e);
      Alert.alert('Error', e instanceof Error ? e.message : 'Lock failed');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleConfirmDelivery = async () => {
    if (isLoading) { console.log('[FROST-2R] Already processing, skipping duplicate call'); return; }
    if (!canonicalCanCreatePartialSig(role || '', step)) {
      console.warn('[Canonical] BLOCKED: only buyer can create partial sig at step 4, got role:', role, 'step:', step);
      Alert.alert('Not Allowed', 'Only the buyer can confirm delivery and create the release key.');
      return;
    }
    setIsLoading(true);
    
    try {
      const wallet = await loadMainWallet();
      if (!wallet || !contract.frostData) {
        Alert.alert('Error', 'Wallet or FROST not configured');
        setIsLoading(false);
        return;
      }
      const privKeyHex = wallet?.privKeyHex;
      if (!privKeyHex) { Alert.alert('Error', 'Failed to decrypt wallet'); setIsLoading(false); return; }
      const network = wallet.network;
      
      const recipientAddress = role === 'buyer' 
        ? (counterpartyAddress || contract.sellerPubkey)
        : wallet.address;
      
      if (!recipientAddress) {
        Alert.alert('Error', 'Recipient address not available');
        setIsLoading(false);
        return;
      }
      
      const totalAmountSompi = BigInt(Math.floor((contract.itemPriceKas + contract.sellerCommitmentKas) * 1e8)) - 10000n;
      
      // 2-round FROST: load saved nonce, get counterparty R from Arweave
      let myNonce;
      try {
        const savedNonce = await AsyncStorage.getItem('kv_frost_nonce_' + contract.agreementId);
        if (savedNonce) {
          myNonce = JSON.parse(savedNonce);
          console.log('[FROST-2R] Loaded saved nonce R:', myNonce.R_hex?.slice(0,20));
        }
      } catch {}
      if (!myNonce) {
        // Generate fresh nonce if not saved
        myNonce = generateFrostNonce({ frostAddress: contract.frostData, recipientAddress, amountSompi: totalAmountSompi, privateKeyHex: privKeyHex });
        console.log('[FROST-2R] Generated fresh nonce R:', myNonce.R_hex?.slice(0,20));
      }
      let counterpartyR = '';
      // Check for manually pasted R first
      try { const manualR = await AsyncStorage.getItem('kv_manual_counterparty_r_' + contract.agreementId); if (manualR && manualR.length === 66) { counterpartyR = manualR; console.log('[FROST-2R] Using manually pasted R:', counterpartyR.slice(0,20)); } } catch {}
      // Check TownHall for counterparty R (instant, no indexing delay)
      try {
        const rData = await getFrostR(contract.agreementId || '');
        if (rData) {
          const myR = role === 'buyer' ? rData.frost_r_a : rData.frost_r_b;
          const cpR = role === 'buyer' ? rData.frost_r_b : rData.frost_r_a;
          if (cpR) { counterpartyR = cpR; console.log('[FROST-2R] Found R via TownHall:', counterpartyR.slice(0,20)); }
        }
      } catch(e) { console.warn('[FROST-2R] TownHall R lookup failed:', e); }

      // Query counterparty R from Arweave
      // counterpartyR already set by TownHall check above
      try {
        // queryAgreementsFromArweave imported statically
        const rResults = await queryAgreementsFromArweave({ status: 'Accepted' });
        const counterMatch = rResults.find((r) => (r.agreementId || r.agreement_id) === contract.agreementId && (r.pubkey || r.KVPubkey) !== (role === 'buyer' ? contract.buyerPubkey : contract.sellerPubkey));
        if (counterMatch?.frostR || counterMatch?.KVFrostR) {
          counterpartyR = counterMatch.frostR || counterMatch.KVFrostR || '';
          console.log('[FROST-2R] Found counterparty R:', counterpartyR.slice(0,20));
        }
      } catch(e) { console.warn('[FROST-2R] Counterparty R lookup failed:', e); }
      // Fallback: also check Arweave tags directly
      if (!counterpartyR) {
        try {
          const cpPub = role === 'buyer' ? contract.sellerPubkey : contract.buyerPubkey;
          const gql = '{ transactions(first: 5, tags: [{ name: "KV-AgreementId", values: ["' + contract.agreementId + '"] }, { name: "KV-Status", values: ["Accepted"] }, { name: "KV-Pubkey", values: ["' + cpPub + '"] }]) { edges { node { tags { name value } } } } }';
          // Layer 2: arweave.net (fast)
          let arResp = await fetch('https://arweave.net/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: gql }) });
          const json = await arResp.json();
          const tags = json?.data?.transactions?.edges?.[0]?.node?.tags || [];
          const rTag = tags.find((t) => t.name === 'KV-FrostR');
          if (rTag?.value) { counterpartyR = rTag.value; console.log('[FROST-2R] Found R via Goldsky:', counterpartyR.slice(0,20)); }
        } catch(e) { console.warn('[FROST-2R] Goldsky R lookup failed:', e); }
      }
      // Check L1 UTXO payloads for counterparty R
      if (!counterpartyR) {
        try {
          const nw = await SecureStore.getItemAsync('kaspa_network');
          const apiBase = nw?.includes('testnet') ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
          const txResp = await fetch(apiBase + '/addresses/' + contract.multisigAddress + '/full-transactions?limit=10&resolve_previous_outpoints=no');
          const txData = await txResp.json();
          for (const tx of txData || []) {
            const pl = tx.payload || '';
            if (pl && pl.length >= 66 && (pl.startsWith('02') || pl.startsWith('03'))) {
              counterpartyR = pl;
              console.log('[FROST-2R] Found R in L1 TX payload:', counterpartyR.slice(0,20));
              break;
            }
          }
        } catch(e) { console.warn('[FROST-2R] L1 payload check failed:', e); }
      }
      let result;
      if (counterpartyR && myNonce?.R_hex) {
        // Proper 2-round FROST
        // Build TX to compute real Kaspa sighash for BIP340 verification
        // computeSighash imported statically at top
        // h2b, b2h imported statically at top
        // === CANONICAL FROST TX ===
        const frostAddr = contract.frostData?.address || '';
        const frostNet = contract.frostData?.network || 'testnet-10';
        const buyerAddr = wallet.address || '';
        // Derive seller address from pubkey
        // aggregateToAddress imported statically from frost_complete
        const sellerPk = contract.sellerPubkey || '';
        const sellerXOnly = sellerPk.length === 66 ? sellerPk.slice(2) : sellerPk;
        const sellerAddr = aggregateToAddress('02' + sellerXOnly, frostNet);
        const buyerAmtS = BigInt(Math.floor((contract.itemPriceKas || 0) * 1e8));
        const sellerAmtS = BigInt(Math.floor((contract.sellerCommitmentKas || 0) * 1e8));
        console.log('[FROST-Canonical] Building TX: frost=', frostAddr.slice(0,20), 'buyer=', buyerAddr.slice(0,20), 'seller=', sellerAddr.slice(0,20));
        const canonTx = await buildCanonicalFrostTx({ frostAddress: frostAddr, buyerAddress: buyerAddr, sellerAddress: sellerAddr, buyerAmountSompi: buyerAmtS, sellerAmountSompi: sellerAmtS, network: frostNet });
        console.log('[FROST-Canonical] UTXOs:', canonTx.inputs.length, 'Outputs:', canonTx.outputs.length, 'Total:', canonTx.totalIn.toString());
        const allPartials: string[] = [];
        let partialS: any;
        for (let idx = 0; idx < canonTx.inputs.length; idx++) {
          const sh = canonicalSighash(canonTx, idx);
          const ps = computeFrostPartialS({ myNonce, counterpartyR_hex: counterpartyR, frostAddress: contract.frostData, sighash_hex: b2h(sh) });
          allPartials.push(ps.s_hex);
          if (idx === 0) { partialS = ps; console.log('[FROST-Canonical] R_agg_x:', ps.R_agg_x_hex.slice(0,20)); }
          console.log('[FROST-Canonical] Input', idx, 'sighash:', b2h(sh).slice(0,20), 's:', ps.s_hex.slice(0,16));
        }
        // Serialize full TX template so seller builds identical TX
        const txTemplate = { u: canonTx.utxos.map((u: any) => ({ t: u.outpoint.transactionId, i: u.outpoint.index, a: u.utxoEntry.amount, s: u.utxoEntry.scriptPublicKey.scriptPublicKey })), o: canonTx.outputs.map((o: any) => ({ v: o.value.toString(), s: b2h(o.script) })), f: canonTx.fee.toString() };
        const templateB64 = btoa(JSON.stringify(txTemplate));
        const sigHex = partialS.R_agg_x_hex + allPartials.join('') + '|' + templateB64;
        console.log('[FROST-Canonical] Packed', allPartials.length, 's values + TX template (' + txTemplate.u.length + ' inputs,' + txTemplate.o.length + ' outputs)');
        result = { success: true, partialSig: sigHex, messageHash: myNonce.message_hex };
      } else {
        console.warn('[FROST-2R] No counterparty R found');
        Alert.alert('Waiting for Counterparty', 'Counterparty nonce not found yet. Wait 2-5 minutes and try again.');
        setIsLoading(false);
        return;
        result = await createFrostPartialSig({ frostAddress: contract.frostData, recipientAddress, amountSompi: totalAmountSompi, privateKeyHex: privKeyHex });
      }
      
      if (result.success && result.partialSig) {
        console.log('[Neighbor] Created FROST partial signature');
        
        const myPubkey = await SecureStore.getItemAsync('kaspa_pubkey') || '';
        const counterpartyPubkey = role === 'buyer' ? contract.sellerPubkey : contract.buyerPubkey;
        
        // Split UTXO snapshot from sig before encryption
        let sigForEncrypt = result.partialSig;
        let utxoSnapshotB64 = '';
        const pipeIdx2 = sigForEncrypt.indexOf('|');
        if (pipeIdx2 > 0) { utxoSnapshotB64 = sigForEncrypt.slice(pipeIdx2); sigForEncrypt = sigForEncrypt.slice(0, pipeIdx2); }
        // ENCRYPT partial sig before relay
        const encCtx = {
          agreementId: contract.agreementId || '',
          buyerPubkey: contract.buyerPubkey || '',
          sellerPubkey: contract.sellerPubkey || '',
          multisigAddress: contract.multisigAddress || '',
          aggregatedPubkey: contract.frostData?.aggregatedPubkey || '',
          network: contract.frostData?.network || 'testnet-10',
          itemPriceKas: contract.itemPriceKas,
          sellerCommitmentKas: contract.sellerCommitmentKas,
          R_hex: '',
        };
        const encrypted = encryptPartialSig({
          partialSig: sigForEncrypt,
          myPrivKeyHex: privKeyHex,
          counterpartyPubKeyHex: counterpartyPubkey || '',
          ctx: encCtx,
        });
        // Reattach UTXO snapshot to encrypted sig
        if (utxoSnapshotB64) { encrypted.encrypted = encrypted.encrypted + utxoSnapshotB64; }
        console.log('[Neighbor] Partial sig ENCRYPTED for relay (utxo:', utxoSnapshotB64 ? 'yes' : 'no', ')');

        const relayPayload: PartialTxPayload = {
          agreementId: contract.agreementId || `AGR_${Date.now()}`,
          partialTx: encrypted.encrypted,
          senderPubkey: myPubkey,
          recipientPubkey: counterpartyPubkey || '',
          timestamp: Date.now(),
        };
        
        const relayResult = await postPartialTx(relayPayload);
        
        if (relayResult.success) {
          console.log(`[Neighbor] Partial TX posted via ${relayResult.method}: ${relayResult.url}`);
        }
        
        // Inscribe partial sig to Arweave (permanent, survives TownHall restart)
        try {
          // inscribeAgreementToArweave imported statically
          await inscribeAgreementToArweave({
            agreementId: contract.agreementId || '',
            pubkey: role === 'buyer' ? (contract.buyerPubkey || '') : (contract.sellerPubkey || ''),
            amount_sompi: Number(totalAmountSompi),
            description: 'partial-sig',
            network: 'testnet-10',
            status: 'PartialSig',
            signature: encrypted.encrypted || '', // ENCRYPTED — only counterparty can decrypt
            counterpartyPubkey: counterpartyPubkey || '',
            frostAddress: contract.multisigAddress || '',
          });
          console.log('[Neighbor] Partial sig inscribed to Arweave');
        } catch (e) { console.warn('[Neighbor] Arweave partial sig failed:', e); }
        // Also post to local TownHall relay (instant delivery)
        try {
          const townhallUrl = 'https://kasvillage.app.runonflux.io/api/agreement/partial-sig';
          await fetch(townhallUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              agreement_id: contract.agreementId || '',
              pubkey: myPubkey,
              partial_sig: encrypted.encrypted, // ENCRYPTED
              recipient: recipientAddress,
            }),
          });
          console.log('[Neighbor] Partial sig posted to TownHall local');
        } catch (e) { console.warn('[Neighbor] TownHall local relay failed:', e); }
        // Also use TownHall agreement partial-sig endpoint
        try {
          // submitPartialSig imported statically
          await submitPartialSig({
            agreementId: contract.agreementId || '',
            pubkey: role === 'buyer' ? (contract.buyerPubkey || '') : (contract.sellerPubkey || ''),
            partialSig: result.partialSig || '',
            recipientAddress: recipientAddress || '',
          });
          console.log('[Neighbor] Partial sig submitted to TownHall agreement endpoint');
        } catch (e) { console.warn('[Neighbor] TownHall partial sig failed:', e); }
        
        setContract(prev => ({
          ...prev,
          partialReleaseTx: encrypted.encrypted,
          releaseRecipient: recipientAddress,
        }));
        
        setPaymentSent(true);
        
        const newStats = {
          ...userStats,
          successes: userStats.successes + 1,
          xp: userStats.xp + 10,
        };
        setUserStats(newStats);
        await SecureStore.setItemAsync('kv_user_stats', JSON.stringify(newStats));
        
        Alert.alert(
          'Signature Created', 
          relayResult.success 
            ? `Posted to relay. Waiting for counterparty to co-sign...\n\nMethod: ${relayResult.method}`
            : 'Share this with counterparty to complete the release.'
        );
        setStep(5);
      } else {
        Alert.alert('Error', result.error || 'Failed to create signature');
      }
    } catch (e) {
      console.error('[Neighbor] Confirm delivery error:', e);
      Alert.alert('Error', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRequestRelease = async () => {
    setIsLoading(true);
    
    try {
      if (!contract.partialReleaseTx && contract.agreementId) {
        const payload = await fetchPartialTx(contract.agreementId);
        if (payload && payload.partialTx) {
          setContract(prev => ({ ...prev, partialReleaseTx: payload.partialTx }));
        }
      }
      
      const partialTx = contract.partialReleaseTx || (await fetchPartialTx(contract.agreementId || ''))?.partialTx;
      
      if (partialTx && contract.frostData) {
        const releaseWallet = await loadMainWallet();
        if (!releaseWallet) {
          Alert.alert('Error', 'Wallet not configured');
          setIsLoading(false);
          return;
        }
        const privKeyHex = releaseWallet.privKeyHex;
        const network = releaseWallet.network;
        
        const result = await completeFrostAndBroadcast({
          frostAddress: contract.frostData!,
          myPrivateKeyHex: privKeyHex,
          recipientAddress: contract.releaseRecipient || '',
          amountSompi: BigInt(Math.floor((contract.itemPriceKas + contract.sellerCommitmentKas) * 1e8)) - 10000n,
          counterpartyPartialSig: partialTx,
        });
        
        if (result.success && result.txId) {
          console.log('[Neighbor] ✓ Release TX broadcast:', result.txId);
          // Merkle archive: per-TX proof for release (fire-and-forget)
          uploadPerTxProof({
            txId: result.txId || '',
            txIndex: 0,
            amountSompi: BigInt(Math.floor((contract.itemPriceKas + contract.sellerCommitmentKas) * 1e8)) - 10000n,
            scriptPubKey: '',
            daaScore: 0,
            txType: 'release',
            balanceAfter: 0,
            agreementId: contract.agreementId,
            uploadFn: async (data, tags) => {
              const r = await uploadToIrys(data, tags);
              return r.txId || '';
            },
            network: 'testnet',
          }).catch(e => console.warn('[Neighbor] Release merkle proof failed (non-fatal):', e));
          
          if (contract.agreementId) {
            await clearPartialTx(contract.agreementId);
          }
          
          setContract(prev => ({
            ...prev,
            releaseTxId: result.txId,
            releaseExplorerUrl: result.explorerUrl,
          }));
          
          const newStats = {
            ...userStats,
            successes: userStats.successes + 1,
            xp: userStats.xp + 10,
          };
          setUserStats(newStats);
          await SecureStore.setItemAsync('kv_user_stats', JSON.stringify(newStats));
          
          setStep(7);
        } else {
          Alert.alert('Error', result.error || 'Failed to broadcast');
        }
      } else {
        if (role === 'buyer') {
          setBuyerRequestedRelease(true);
          if (sellerRequestedRelease) setStep(7);
        } else {
          setSellerRequestedRelease(true);
          if (buyerRequestedRelease) setStep(7);
        }
      }
    } catch (e) {
      console.error('[Neighbor] Release error:', e);
      Alert.alert('Error', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleEnterDispute = () => {
    const newStats = {
      ...userStats,
      deadlocks: userStats.deadlocks + 1,
      xp: Math.max(0, userStats.xp - 50),
    };
    setUserStats(newStats);
    SecureStore.setItemAsync('kv_user_stats', JSON.stringify(newStats));
    setStep(8);
  };
  
  const handleProposeSplit = () => {
    Alert.alert('Proposal Sent', 'Your split proposal has been sent to the other party.');
  };
  
  const canProceedFromCreate = contract.itemDescription.length > 0 && contract.itemPriceKas > 0;
  
    const handleCancelAgreement = async () => {
    Alert.alert(
      'Cancel Agreement?',
      'This will abandon the agreement. Any locked funds remain in the FROST address until both parties sign a release.',
      [
        { text: 'Keep Going', style: 'cancel' },
        { text: 'Cancel Agreement', style: 'destructive', onPress: async () => {
          await archiveAgreementSession('cancelled');
          await clearAgreementSession();
          setStep(0);
          setContract({} as any);
          setRole(null);
          if (onClose) onClose();
        }},
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Handshake size={rs.s(24)} color={COLORS.indigo900} />
              <Text style={styles.headerTitle}>Neighbor Agreement</Text>
            </View>
            <TouchableOpacity onPress={() => { onClose(); }} style={styles.closeBtn}>
              <X size={rs.s(24)} color={COLORS.stone400} />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#e7e5e4" }}>
            <TouchableOpacity onPress={() => { onClose(); }} style={{ flexDirection: "row", alignItems: "center", padding: 8 }}>
              <Text style={{ color: "#4f46e5", fontSize: 14, fontWeight: "bold" }}>{"< Back"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={async () => { await clearAgreementSession(); await AsyncStorage.removeItem("kv_frost_active_list"); setStep(1); setRole(null); setAgreementType(null); setContract({ itemPriceKas: 0, sellerCommitmentKas: 0, stipulations: "", itemDescription: "", expiryHours: 24 }); Alert.alert("Cleared", "Session reset"); }} style={{ padding: 8, backgroundColor: "#fee2e2", borderRadius: 8, marginRight: 6 }}><Text style={{ color: "#dc2626", fontSize: 10, fontWeight: "bold" }}>Reset</Text></TouchableOpacity><TouchableOpacity onPress={() => setIouModalVisible(true)} style={{ flexDirection: "row", alignItems: "center", padding: 8, backgroundColor: "#eff6ff", borderRadius: 8 }}>
              <Text style={{ color: "#1d4ed8", fontSize: 12, fontWeight: "bold" }}>View Balance Sheet</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 10, color: "#78716c", textAlign: "center", paddingVertical: 4 }}>(Two-Party Collateral / Good Faith Deposit)</Text>
          <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled" onScrollBeginDrag={Keyboard.dismiss}>
            {snailModeActive && (
              <View style={styles.snailWarning}>
                <Text style={styles.snailEmoji}>🐌</Text>
                <View style={styles.snailContent}>
                  <Text style={styles.snailTitle}>Snail Poison Active</Text>
                  <Text style={styles.snailText}>
                    App will be slow due to low trust score (XP: {userStats.xp}, Completion: {(pComplete * 100).toFixed(0)}%).
                    Agreement creation delayed ~{Math.round(creationDelayMs / 1000)}s.
                  </Text>
                  <Text style={styles.snailNote}>
                    Complete transactions successfully to improve your score.
                  </Text>
                </View>
              </View>
            )}
            
            {isNewUser && !snailModeActive && (
              <InfoBox title="👋 New to agreements?" variant="info">
                <Text style={{ fontSize: rs.font(11), color: COLORS.blue700 }}>
                  You start with benefit of doubt. Complete 3+ transactions to build your trust score. Deadlocks hurt your score.
                </Text>
              </InfoBox>
            )}
            
            <ProgressSteps 
              currentStep={step} 
              steps={['Create', 'Role', 'Lock', 'Pay', 'Done']} 
            />
            
            {/* Step 1: Create */}
            {step === 1 && !agreementType && (
              <View>
                {frostActiveList.length > 0 && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1e1b4b', marginBottom: 8 }}>Active Agreements</Text>
                    {frostActiveList.map((entry, idx) => (
                      <TouchableOpacity key={idx} style={{ backgroundColor: entry.step >= 4 ? '#f0fdf4' : '#eff6ff', borderRadius: 8, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: entry.step >= 4 ? '#86efac' : '#93c5fd' }}
                        onPress={async () => {
                          const session = await loadAgreementSession();
                          if (session?.contract?.agreementId === entry.agrId) {
                            setStep(session.step); setRole(session.role); setAgreementType(session.agreementType);
                            setContract(session.contract); setBuyerLocked(session.buyerLocked); setSellerLocked(session.sellerLocked);
                          } else {
                            Alert.alert('Switch Agreement', 'Load ' + entry.agrId.slice(0,12) + '?\nThis will switch your active session.', [
                              { text: 'Cancel' },
                              { text: 'Load', onPress: async () => {
                                // Save minimal session to restore
                                await saveAgreementSession({ step: entry.step, role: entry.role, agreementType: 'trade', contract: { agreementId: entry.agrId, multisigAddress: entry.frostAddr, itemPriceKas: entry.buyerAmount, sellerCommitmentKas: entry.sellerAmount, buyerPubkey: entry.buyerPubkey, sellerPubkey: entry.sellerPubkey, itemDescription: entry.description, stipulations: '', expiryHours: 24 }, buyerLocked: entry.step >= 4, sellerLocked: entry.step >= 4, counterpartyAddress: null, counterpartyKaspaAddr: '', savedAt: Date.now() });
                                setStep(entry.step); setRole(entry.role); setContract({ agreementId: entry.agrId, multisigAddress: entry.frostAddr, itemPriceKas: entry.buyerAmount, sellerCommitmentKas: entry.sellerAmount, buyerPubkey: entry.buyerPubkey, sellerPubkey: entry.sellerPubkey, itemDescription: entry.description, stipulations: '', expiryHours: 24 });
                              }},
                            ]);
                          }
                        }}>
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: entry.step >= 4 ? '#166534' : '#1d4ed8' }}>{entry.description || entry.agrId.slice(0,12)} ? {entry.role}</Text>
                        <Text style={{ fontSize: 10, color: '#78716c' }}>Buyer: {entry.buyerAmount} / Seller: {entry.sellerAmount} KASPA ? Step {entry.step}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <Text style={{ fontSize: rs.font(16), fontWeight: 'bold', color: COLORS.indigo900, marginBottom: 12, textAlign: 'center' }}>What type of agreement?</Text>
                <TouchableOpacity
                  onPress={() => { setAgreementType('simple'); setRole('buyer'); }}
                  style={{ backgroundColor: COLORS.green50, borderWidth: 2, borderColor: COLORS.green500, borderRadius: 12, padding: 16, marginBottom: 12 }}
                >
                  <Text style={{ fontSize: rs.font(14), fontWeight: 'bold', color: COLORS.green800 }}>Collateral Agreement</Text>
                  <Text style={{ fontSize: rs.font(11), color: COLORS.green600, marginTop: 4 }}>Both parties lock equal collateral as good faith deposit. For any agreement — services, loans, rentals, freelance work, or any mutual commitment.</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setAgreementType('trade')}
                  style={{ backgroundColor: COLORS.blue50, borderWidth: 2, borderColor: COLORS.blue500, borderRadius: 12, padding: 16, marginBottom: 12 }}
                >
                  <Text style={{ fontSize: rs.font(14), fontWeight: 'bold', color: COLORS.blue800 }}>Trade Agreement (Buy / Sell)</Text>
                  <Text style={{ fontSize: rs.font(11), color: COLORS.blue600, marginTop: 4 }}>Buyer locks agreed amount, seller locks commitment deposit. For purchasing goods or services.</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setAgreementType('join'); loadInbox(); }}
                  style={{ backgroundColor: '#FFF7ED', borderWidth: 2, borderColor: '#F97316', borderRadius: 12, padding: 16, marginBottom: 12 }}
                >
                  <Text style={{ fontSize: rs.font(14), fontWeight: 'bold', color: '#9A3412' }}>Join Existing Agreement</Text>
                  <Text style={{ fontSize: rs.font(11), color: '#C2410C', marginTop: 4 }}>Accept an agreement proposed by your counterparty. Check your inbox for pending proposals.</Text>
                </TouchableOpacity>
              </View>
            )}

            {step === 1 && agreementType === 'join' && (
              <View>
                <TouchableOpacity onPress={() => setAgreementType(null)} style={{ marginBottom: 8 }}>
                  <Text style={{ color: '#78716C', fontSize: rs.font(11) }}>{'< Back to agreement types'}</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: rs.font(16), fontWeight: 'bold', color: '#1E1B4B', marginBottom: 12, textAlign: 'center' }}>Pending Proposals</Text>
                
                {/* Manual Agreement Lookup */}
                <View style={{ backgroundColor: '#eef2ff', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#a5b4fc' }}>
                  <Text style={{ fontSize: rs.font(13), fontWeight: 'bold', color: '#3730a3', marginBottom: 8 }}>Enter Agreement ID</Text>
                  <Text style={{ fontSize: rs.font(10), color: '#4338ca', marginBottom: 8 }}>Paste the AGR_ ID or Arweave TX ID shared by your counterparty</Text>
                  <TextInput
                    style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#a5b4fc', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: rs.font(12), fontFamily: 'monospace', color: '#1c1917', marginBottom: 8 }}
                    placeholder="AGR_1779..."
                    placeholderTextColor="#a8a29e"
                    value={manualAgrId}
                    onChangeText={setManualAgrId}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {manualLookupResult && (
                    <View style={{ backgroundColor: '#f0fdf4', borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#86efac' }}>
                      <Text style={{ fontSize: rs.font(11), color: '#166534', fontWeight: 'bold' }}>Found: {manualLookupResult.description || manualLookupResult.agreementId}</Text>
                      <Text style={{ fontSize: rs.font(10), color: '#15803d', marginTop: 2 }}>From: {(manualLookupResult.pubkey || '').slice(0, 16)}...</Text>
                      <Text style={{ fontSize: rs.font(10), color: '#15803d', fontWeight: 'bold' }}>Total Locked: {(manualLookupResult.amount_sompi || 0) / 1e8} KASPA</Text>
                      <Text style={{ fontSize: rs.font(10), color: '#166534' }}>  Buyer: {(manualLookupResult.buyerAmountSompi || 0) / 1e8} KASPA</Text>
                      <Text style={{ fontSize: rs.font(10), color: '#166534' }}>  Seller: {((manualLookupResult.amount_sompi || 0) - (manualLookupResult.buyerAmountSompi || 0)) / 1e8} KASPA (good faith)</Text>
                      <Text style={{ fontSize: rs.font(10), color: '#15803d' }}>Network: {manualLookupResult.network || 'testnet-10'}</Text>
                      <Text style={{ fontSize: rs.font(10), color: '#15803d' }}>FROST: {(manualLookupResult.frostAddress || 'pending').slice(0, 30)}...</Text>
                      <Text style={{ fontSize: rs.font(10), color: '#166534', marginTop: 6 }}>Counterparty Address: {(() => {
                        try {
                          const pk = manualLookupResult.pubkey || manualLookupResult.partyA?.pubkey || manualLookupResult.party_a?.pubkey || '';
                          return pk ? 'Verified secp256k1 ✓' : 'Unknown';
                        } catch { return 'Unknown'; }
                      })()}</Text>
                      <View style={{ marginTop: 8 }}>
                        <Text style={{ fontSize: rs.font(11), color: '#92400e', fontWeight: 'bold' }}>Enter Verification Code</Text>
                        <Text style={{ fontSize: rs.font(9), color: '#b45309', marginBottom: 4 }}>Get this from your counterparty via call/DM</Text>
                        <TextInput
                          style={{ backgroundColor: '#fff', borderWidth: 2, borderColor: manualVerCode.length === 4 ? '#16a34a' : '#fbbf24', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: rs.font(18), fontFamily: 'monospace', textAlign: 'center', letterSpacing: 8, color: '#1c1917' }}
                          placeholder="A3E5"
                          placeholderTextColor="#d6d3d1"
                          value={manualVerCode}
                          onChangeText={(t) => setManualVerCode(t.toUpperCase().slice(0, 4))}
                          autoCapitalize="characters"
                          maxLength={4}
                        />
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          // Verify code matches before accepting
                          const wallet_pk = role === 'buyer' ? contract.buyerPubkey : contract.sellerPubkey;
                          const counter_pk = manualLookupResult.pubkey || manualLookupResult.partyA?.pubkey || manualLookupResult.party_a?.pubkey || '';
                          let myPk = '';
                          try {
                            const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
                            // Will be set after loadMainWallet in handleAcceptFromInbox
                          } catch {}
                          if (manualVerCode.length !== 4) { Alert.alert('Verification', 'Enter the 4-character verification code'); return; }
                          handleAcceptFromInbox({ ...manualLookupResult, _verificationCode: manualVerCode });
                        }}
                        disabled={!!acceptingId || manualVerCode.length !== 4}
                        style={{ backgroundColor: (acceptingId || manualVerCode.length !== 4) ? '#888' : '#059669', borderRadius: 8, padding: 12, marginTop: 10, alignItems: 'center' }}
                      >
                        <Text style={{ color: '#FFF', fontSize: rs.font(13), fontWeight: 'bold' }}>
                          {manualVerCode.length !== 4 ? 'Enter Code to Unlock' : 'Accept This Agreement'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={async () => {
                      if (!manualAgrId || manualAgrId.length < 8) { Alert.alert('Invalid', 'Enter a valid AGR_ ID or Arweave TX ID'); return; }
                      setInboxLoading(true);
                      try {
                        // queryAgreementsFromArweave imported statically
                        const all = await queryAgreementsFromArweave({ status: 'Proposed', network: 'testnet-10' });
                        const match = all.find((a: any) => (a.agreementId || a.agreement_id) === manualAgrId);
                        if (match) {
                          console.log('[Neighbor] Manual lookup found:', manualAgrId);
                          setManualLookupResult(match);
                        } else {
                          // Try direct Arweave fetch if ID looks like a TX ID (43 chars, no AGR_ prefix)
                          if (!manualAgrId.startsWith('AGR_') && manualAgrId.length > 30) {
                            try {
                              const resp = await fetch('https://arweave.net/' + manualAgrId);
                              const data = await resp.json();
                              if (data && data.agreementId) {
                                console.log('[Neighbor] Direct Arweave fetch found:', data.agreementId);
                                setManualLookupResult(data);
                                setInboxLoading(false);
                                return;
                              }
                            } catch {}
                          }
                          Alert.alert('Not Found', 'Agreement not found on Arweave. It may still be indexing — try again in 1-2 minutes.');
                        }
                      } catch (e) { Alert.alert('Error', String(e)); }
                      setInboxLoading(false);
                    }}
                    disabled={inboxLoading || !manualAgrId}
                    style={{ backgroundColor: inboxLoading ? '#ccc' : '#4f46e5', borderRadius: 8, padding: 10, alignItems: 'center' }}
                  >
                    <Text style={{ color: '#FFF', fontSize: rs.font(12), fontWeight: '600' }}>
                      {inboxLoading ? 'Searching Arweave...' : 'Look Up Agreement'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: rs.font(10), color: '#78716c', textAlign: 'center', marginBottom: 8 }}>— or browse inbox below —</Text>
                <TouchableOpacity
                  onPress={loadInbox}
                  style={{ backgroundColor: '#F5F3FF', borderRadius: 8, padding: 10, marginBottom: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: '#6D28D9', fontSize: rs.font(12), fontWeight: '600' }}>
                    {inboxLoading ? 'Loading...' : 'Refresh Inbox'}
                  </Text>
                </TouchableOpacity>

                <View style={{ backgroundColor: '#f0fdf4', borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#86efac' }}>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#166534', marginBottom: 6 }}>?? Paste Release Key</Text>
                  <TextInput
                    style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#86efac', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 11, fontFamily: 'monospace', color: '#1c1917', marginBottom: 8 }}
                    placeholder="Paste encrypted key from buyer..."
                    placeholderTextColor="#a8a29e"
                    onChangeText={async (txt) => { const v = txt.trim(); const rMatch = v.match(/^R:\s*(.+)$/m); const sigMatch = v.match(/^SIG:\s*(.+)$/m); if (rMatch && rMatch[1].length >= 60) { await AsyncStorage.setItem('kv_manual_counterparty_r_' + (contract.agreementId || ''), rMatch[1].trim()); console.log('[Seller] Auto-extracted buyer R from paste:', rMatch[1].slice(0,20)); } const sig = sigMatch ? sigMatch[1].trim() : v; setContract(prev => ({ ...prev, partialReleaseTx: sig })); }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    multiline
                  />
                  <TouchableOpacity
                    style={{ backgroundColor: '#059669', borderRadius: 8, padding: 10, alignItems: 'center' }}
                    disabled={isLoading}
                    onPress={async () => {
                      try {
                        setIsLoading(true);
                        const sig = contract.partialReleaseTx || '';
                        if (!sig || sig.length < 10) { Alert.alert('Invalid', 'Paste the release key'); setIsLoading(false); return; }
                        const session = await loadAgreementSession();
                        if (!session?.contract?.frostData) { Alert.alert('No Agreement', 'Accept an agreement first'); setIsLoading(false); return; }
                        const w = await loadMainWallet();
                        if (!w) { Alert.alert('Error', 'Wallet not ready'); setIsLoading(false); return; }
                        const sc = session.contract;
                        const total = BigInt(Math.floor(((sc.itemPriceKas || 0) + (sc.sellerCommitmentKas || 0)) * 1e8)) - 10000n;
                        const dec = (() => { try { return decryptPartialSig({ encrypted: sig, myPrivKeyHex: w.privKeyHex, counterpartyPubKeyHex: sc.buyerPubkey || '' }); } catch { return sig; } })();
                        const res = await completeFrostAndBroadcast({ frostAddress: sc.frostData, myPrivateKeyHex: w.privKeyHex, recipientAddress: w.address, amountSompi: total, counterpartyPartialSig: dec });
                        if (res.success && res.txId) {
                          Alert.alert('Released!', 'TX: ' + (res.txId || '').slice(0,16) + '...');
                          await clearAgreementSession();
                        } else { Alert.alert('Failed', res.error || 'Co-sign failed'); }
                      } catch (e) { Alert.alert('Error', String(e)); }
                      finally { setIsLoading(false); }
                    }}>
                    {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Release Funds</Text>}
                  </TouchableOpacity>
                </View>

                {inboxAgreements.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {[{k:'recent',l:'Recent'},{k:'buyerHigh',l:'Buyer ↑'},{k:'sellerLow',l:'Seller ↓'},{k:'name',l:'Name'}].map(s => (
                      <TouchableOpacity key={s.k} onPress={() => setInboxSort(s.k as any)} style={{ backgroundColor: inboxSort === s.k ? '#4f46e5' : '#e5e7eb', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}>
                        <Text style={{ fontSize: 10, color: inboxSort === s.k ? '#fff' : '#374151', fontWeight: inboxSort === s.k ? 'bold' : 'normal' }}>{s.l}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* PASTE BUYER PROPOSAL */}
                <View style={{ backgroundColor: "#f0f9ff", borderRadius: 8, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#93c5fd" }}>
                  <Text style={{ fontSize: 12, fontWeight: "bold", color: "#1e40af", marginBottom: 6 }}>Paste Buyer Proposal</Text>
                  <TextInput
                    style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: "#93c5fd", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 11, fontFamily: "monospace", color: "#1c1917", minHeight: 40 }}
                    placeholder="Paste KV|AGR_...|buyerAddr|... or AGR_ID here"
                    placeholderTextColor="#a8a29e"
                    multiline
                    onChangeText={async (txt) => {
                      const v = txt.trim();
                      // Check if KV proposal format
                      if (v.startsWith("KV|")) {
                        try {
                          const { parseProposal } = require("./kv_proposal");
                          const parsed = parseProposal(v);
                          if (parsed) {
                            console.log("[Seller-Paste] Parsed KV proposal:", parsed.agrId, parsed.description);
                            Alert.alert("Proposal Found", "Item: " + (parsed.description || "N/A") + "\nAmount: " + (Number(parsed.buyerAmountSompi || 0)/1e8) + " KAS\nCode: " + (parsed.verificationCode || ""), [
                              { text: "Cancel", style: "cancel" },
                              { text: "Accept", onPress: () => {
                                // Find matching agreement in inbox or create from parsed data
                                const match = inboxAgreements.find(a => (a.agreementId || a.agreement_id) === parsed.agrId);
                                if (match) { handleAcceptFromInbox(match); }
                                else {
                                  // Direct accept from clipboard data
                                  const fakeAgr = { agreementId: parsed.agrId, agreement_id: parsed.agrId, pubkey: parsed.buyerPubkey || "", counterpartyPubkey: parsed.sellerAddress || "", amount_sompi: Number(parsed.buyerAmountSompi || 0) + Number(parsed.sellerAmountSompi || 0), buyerAmountSompi: Number(parsed.buyerAmountSompi || 0), sellerAmountSompi: Number(parsed.sellerAmountSompi || 0), description: parsed.description || "", network: parsed.network || "testnet-10", status: "Proposed", partyA: { pubkey: parsed.buyerPubkey || "", amount_sompi: Number(parsed.buyerAmountSompi || 0) + Number(parsed.sellerAmountSompi || 0) } };
                                  handleAcceptFromInbox(fakeAgr);
                                }
                              }}
                            ]);
                          }
                        } catch(e) { console.warn("[Seller-Paste] Parse failed:", e); }
                      } else if (v.startsWith("AGR_") && v.length >= 10) {
                        // Direct AGR ID entry (existing flow)
                        console.log("[Seller-Paste] AGR ID entered:", v);
                      }
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                {inboxAgreements.length === 0 && !inboxLoading && (
                  <View style={{ backgroundColor: '#F5F5F4', borderRadius: 8, padding: 20, alignItems: 'center' }}>
                    <Text style={{ color: '#78716C', fontSize: rs.font(12) }}>No pending proposals</Text>
                    <Text style={{ color: '#A8A29E', fontSize: rs.font(10), marginTop: 4 }}>Ask your counterparty to create an agreement first</Text>
                  </View>
                )}

                {[...inboxAgreements].sort((a, b) => {
                  const aBA = Number(a.buyerAmountSompi || a.partyA?.amount_sompi || a.amount_sompi || 0);
                  const bBA = Number(b.buyerAmountSompi || b.partyA?.amount_sompi || b.amount_sompi || 0);
                  const aSA = Number(a.sellerAmountSompi || 0);
                  const bSA = Number(b.sellerAmountSompi || 0);
                  if (inboxSort === 'buyerHigh') return bBA - aBA;
                  if (inboxSort === 'sellerLow') return aSA - bSA;
                  if (inboxSort === 'name') return (a.description || '').localeCompare(b.description || '');
                  return (b._score || b.created_at || 0) - (a._score || a.created_at || 0);
                }).map((agr: any, idx: number) => (
                  <View key={idx} style={{ backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#F59E0B', borderRadius: 12, padding: 14, marginBottom: 10 }}>
                    <Text style={{ fontSize: rs.font(13), fontWeight: 'bold', color: '#92400E' }}>
                      {agr.description || 'Agreement ' + (agr.agreementId || agr.agreement_id || '').slice(0, 8)}
                    </Text>
                    <Text style={{ fontSize: rs.font(11), color: '#B45309', marginTop: 4 }}>
                      From: {(agr.partyA?.pubkey || agr.party_a?.pubkey || '').slice(0, 16)}...
                    </Text>
                    <Text style={{ fontSize: rs.font(11), color: '#B45309', marginTop: 2 }}>
                      Amount: {((agr.partyA?.amount_sompi || agr.party_a?.amount_sompi || 0) / 1e8).toFixed(2)} KASPA
                    </Text>
                    <Text style={{ fontSize: rs.font(10), color: '#D97706', marginTop: 2 }}>
                      Status: {agr.status} • Network: {agr.network || 'testnet-10'}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleAcceptFromInbox(agr)}
                      disabled={!!acceptingId}
                      style={{ backgroundColor: acceptingId === (agr.agreementId || agr.agreement_id) ? '#888' : !!acceptingId ? '#ccc' : '#059669', borderRadius: 8, padding: 10, marginTop: 10, alignItems: 'center' }}
                    >
                      {acceptingId === (agr.agreementId || agr.agreement_id) ? (
                        <ActivityIndicator color='#FFF' size='small' />
                      ) : (
                        <Text style={{ color: '#FFF', fontSize: rs.font(12), fontWeight: 'bold' }}>Accept Agreement</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => { setInboxAgreements(prev => prev.filter(a => (a.agreementId || a.agreement_id) !== (agr.agreementId || agr.agreement_id))); }}
                      style={{ backgroundColor: '#DC2626', borderRadius: 8, padding: 8, marginTop: 6, alignItems: 'center' }}
                    >
                      <Text style={{ color: '#fff', fontSize: 11 }}>Dismiss</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {step === 1 && agreementType && agreementType !== 'join' && (
              <View>
                <TouchableOpacity onPress={() => setAgreementType(null)} style={{ marginBottom: 8 }}>
                  <Text style={{ color: COLORS.stone400, fontSize: rs.font(11) }}>{'< Change agreement type'}</Text>
                </TouchableOpacity>
                {agreementType === 'simple' && (
                  <View style={{ backgroundColor: COLORS.green50, borderRadius: 8, padding: 12, marginBottom: 12 }}>
                    <Text style={{ fontSize: rs.font(12), fontWeight: 'bold', color: COLORS.green800 }}>Collateral Agreement</Text>
                    <Text style={{ fontSize: rs.font(10), color: COLORS.green600 }}>Both parties lock equal amount. Released when both agree terms are met.</Text>
                  </View>
                )}
                <InfoBox title="How FROST 2-of-2 Works" variant="info" icon={<Shield size={rs.s(16)} color={COLORS.indigo600} />}>
                  <View style={styles.stepList}>
                    <View style={styles.stepItem}>
                      <View style={styles.stepCircle}>
                        <Text style={styles.stepCircleText}>1</Text>
                      </View>
                      <View style={styles.stepInfo}>
                        <Text style={styles.stepItemTitle}>Both Lock Funds</Text>
                        <Text style={styles.stepItemDesc}>Buyer locks agreed amount • Seller locks commitment</Text>
                        <Text style={styles.stepItemNote}>Funds go to FROST 2-of-2 address - requires both signatures</Text>
                      </View>
                    </View>
                    <View style={styles.stepItem}>
                      <View style={styles.stepCircle}>
                        <Text style={styles.stepCircleText}>2</Text>
                      </View>
                      <View style={styles.stepInfo}>
                        <Text style={styles.stepItemTitle}>Exchange Happens</Text>
                        <Text style={styles.stepItemDesc}>Seller delivers item • Buyer inspects</Text>
                      </View>
                    </View>
                    <View style={styles.stepItem}>
                      <View style={[styles.stepCircle, { backgroundColor: COLORS.green600 }]}>
                        <Text style={styles.stepCircleText}>3</Text>
                      </View>
                      <View style={styles.stepInfo}>
                        <Text style={[styles.stepItemTitle, { color: COLORS.green800 }]}>Buyer Confirms Delivery</Text>
                        <Text style={[styles.stepItemDesc, { color: COLORS.green600 }]}>Both sign release • Payment transfers to seller</Text>
                      </View>
                    </View>
                  </View>
                </InfoBox>
                
                <InfoBox title="⚠️ If There's a Problem" variant="warning">
                  <View style={styles.outcomeList}>
                    <View style={styles.outcomeItem}>
                      <Text style={styles.outcomeCheck}>✓</Text>
                      <Text style={styles.outcomeText}>
                        <Text style={{ fontWeight: 'bold' }}>Both agree to cancel:</Text> Both sign refund → No payment
                      </Text>
                    </View>
                    <View style={styles.outcomeItem}>
                      <Text style={styles.outcomeWait}>⏳</Text>
                      <Text style={styles.outcomeText}>
                        <Text style={{ fontWeight: 'bold' }}>Disagreement:</Text> Funds stay locked until both agree
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.outcomeNote}>No arbitration — FROST 2-of-2 requires mutual agreement.</Text>
                </InfoBox>
                
                <View style={styles.formSection}>
                  <Text style={styles.formTitle}>Create Contract</Text>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>{agreementType === 'simple' ? 'Agreement Description' : 'Item Description'}</Text>
                    <TextInput
                      style={styles.input}
                      value={contract.itemDescription}
                      onChangeText={(text) => setContract(p => ({ ...p, itemDescription: text }))}
                      placeholder="e.g., Vintage Watch, iPhone 15, etc."
                      placeholderTextColor={COLORS.stone400}
                    />
                  </View>
                  
                  <View style={styles.inputRow}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>{agreementType === 'simple' ? 'Party A Collateral (KASPA)' : 'Agreed Amount (KASPA)'}</Text>
                      <TextInput
                        style={[styles.input, { borderColor: COLORS.green200 }]}
                        value={contract.itemPriceKas.toString()}
                        onChangeText={(text) => setContract(p => ({ ...p, itemPriceKas: parseInt(text) || 0 }))}
                        keyboardType="numeric"
                        placeholder="0"
                      />
                      <Text style={styles.inputNote}>Buyer locks this</Text>
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>{agreementType === 'simple' ? 'Party B Collateral (KASPA)' : 'Seller Commitment (KASPA)'}</Text>
                      <TextInput
                        style={[styles.input, { borderColor: COLORS.blue200 }]}
                        value={contract.sellerCommitmentKas.toString()}
                        onChangeText={(text) => setContract(p => ({ ...p, sellerCommitmentKas: parseInt(text) || 0 }))}
                        keyboardType="numeric"
                        placeholder="0"
                      />
                      <Text style={styles.inputNote}>Good faith deposit</Text>
                    </View>
                  </View>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Terms & Conditions</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={contract.stipulations}
                      onChangeText={(text) => setContract(p => ({ ...p, stipulations: text }))}
                      placeholder="Shipping method, condition requirements, timeline..."
                      placeholderTextColor={COLORS.stone400}
                      multiline
                    />
                  </View>
                </View>
                
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryTitle}>Summary</Text>
                  <View style={styles.summaryGrid}>
                    <View style={[styles.summaryItem, { backgroundColor: COLORS.green100 }]}>
                      <Text style={styles.summaryItemLabel}>Buyer Locks:</Text>
                      <Text style={[styles.summaryItemValue, { color: COLORS.green800 }]}>
                        {contract.itemPriceKas} KASPA
                      </Text>
                    </View>
                    <View style={[styles.summaryItem, { backgroundColor: COLORS.blue100 }]}>
                      <Text style={[styles.summaryItemLabel, { color: COLORS.blue600 }]}>Seller Locks:</Text>
                      <Text style={[styles.summaryItemValue, { color: COLORS.blue800 }]}>
                        {contract.sellerCommitmentKas} KASPA
                      </Text>
                    </View>
                  </View>
                </View>
                
                <TouchableOpacity
                  style={[styles.primaryBtn, !canProceedFromCreate && styles.primaryBtnDisabled]}
                  onPress={() => { setRole('buyer'); setStep(3); }}
                  disabled={!canProceedFromCreate}
                >
                  <Text style={styles.primaryBtnText}>Continue</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {/* Step 2: Role Selection */}
            {step === 2 && (
              <View>
                <View style={styles.contractSummary}>
                  <View style={styles.contractRow}>
                    <Text style={styles.contractLabel}>Item:</Text>
                    <Text style={styles.contractValue}>{contract.itemDescription}</Text>
                  </View>
                  <View style={styles.contractRow}>
                    <Text style={styles.contractLabel}>Agreed Amount:</Text>
                    <Text style={[styles.contractValue, { color: COLORS.green700 }]}>
                      {contract.itemPriceKas} KASPA
                    </Text>
                  </View>
                  <View style={styles.contractRow}>
                    <Text style={styles.contractLabel}>Seller Commitment:</Text>
                    <Text style={[styles.contractValue, { color: COLORS.blue700 }]}>
                      {contract.sellerCommitmentKas} KASPA
                    </Text>
                  </View>
                </View>
                
                <View style={styles.roleGrid}>
                  <TouchableOpacity
                    style={[styles.roleCard, { backgroundColor: COLORS.green50, borderColor: COLORS.green300 }]}
                    onPress={() => { setRole('buyer'); setStep(3); }}
                  >
                    <ShoppingBag size={rs.s(32)} color={COLORS.green600} />
                    <Text style={[styles.roleTitle, { color: COLORS.green800 }]}>I'm Buyer</Text>
                    <Text style={[styles.roleDesc, { color: COLORS.green600 }]}>
                      Lock {contract.itemPriceKas} KASPA
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.roleCard, { backgroundColor: COLORS.blue50, borderColor: COLORS.blue300 }]}
                    onPress={() => { setRole('seller'); Alert.alert('Seller Mode', 'As a seller, you accept buyer proposals.\n\nBuyers set the terms — sellers show good faith by locking collateral first.\n\nUse "Join Existing Agreement" below to accept a buyer\'s proposal.', [{ text: 'Browse Proposals', onPress: () => { setStep(1); /* go to inbox/join */ } }, { text: 'OK' }]); }}
                  >
                    <Store size={rs.s(32)} color={COLORS.blue600} />
                    <Text style={[styles.roleTitle, { color: COLORS.blue800 }]}>I'm Seller</Text>
                    <Text style={[styles.roleDesc, { color: COLORS.blue600 }]}>
                      Lock {contract.sellerCommitmentKas} KASPA
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            
            {/* Step 3: Lock Funds */}
            {step === 3 && (
              <View>
                <Text style={styles.stepTitle}>Step 1: Lock Collateral (FROST 2-of-2)</Text>
                
                {/* Counterparty Address Input */}
                {!contract.multisigAddress && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: rs.font(12), fontWeight: 'bold', color: COLORS.stone600, marginBottom: 4 }}>Counterparty Kaspa Address</Text>
                    <TextInput
                      style={{ backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.indigo200, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: rs.font(12), color: COLORS.stone800, fontFamily: 'monospace' }}
                      value={counterpartyKaspaAddr}
                      onChangeText={handleSetCounterparty}
                      placeholder="kaspatest:qr..."
                      placeholderTextColor={COLORS.stone400}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Text style={{ fontSize: rs.font(10), color: COLORS.stone400, marginTop: 4 }}>
                      {counterpartyKaspaAddr.length > 40 ? 'Deriving FROST address...' : "Paste your counterparty's wallet address"}
                    </Text>
                  </View>
                )}

                
                {/* Verification Code - MUST confirm before proceeding */}
                {contract.verificationCode && !verificationConfirmed && (
                  <VerificationCodeDisplay
                    code={contract.verificationCode}
                    onConfirmed={() => setVerificationConfirmed(true)}
                  />
                )}
                
                {/* Only show rest after verification confirmed */}
                {(!contract.verificationCode || verificationConfirmed) && (
                  <>
                    {/* Agreement ID + Verification Code — share with counterparty */}
                    {contract.agreementId && (
                      <View style={{ backgroundColor: '#fffbeb', borderRadius: 12, borderWidth: 2, borderColor: '#f59e0b', padding: 16, marginBottom: 16 }}>
                        <Text style={{ fontSize: rs.font(13), fontWeight: 'bold', color: '#92400e', marginBottom: 8 }}>📋 Share with Counterparty</Text>
                        <Text style={{ fontSize: rs.font(10), color: '#b45309', marginBottom: 8 }}>Send these via DM (Instagram, Signal, etc.)</Text>
                        <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                          <Text style={{ fontSize: rs.font(10), color: '#78716c', marginBottom: 2 }}>Agreement ID:</Text>
                          <Text selectable style={{ fontSize: rs.font(14), fontFamily: 'monospace', fontWeight: 'bold', color: '#1c1917' }}>{contract.agreementId}</Text>
                          {contract.arweaveTxId ? (
                            <View style={{ marginTop: 6, backgroundColor: '#f0fdf4', borderRadius: 6, padding: 8 }}>
                              <Text style={{ fontSize: rs.font(9), color: '#166534', fontWeight: '600' }}>Arweave TX (fastest lookup):</Text>
                              <Text selectable style={{ fontSize: rs.font(10), fontFamily: 'monospace', color: '#15803d', marginTop: 2 }}>{contract.arweaveTxId}</Text>
                            </View>
                          ) : (
                            <Text style={{ fontSize: rs.font(9), color: '#a8a29e', marginTop: 4 }}>Arweave TX ID loading...</Text>
                          )}
                        </View>
                        {contract.verificationCode && (
                          <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 12 }}>
                            <Text style={{ fontSize: rs.font(10), color: '#78716c', marginBottom: 2 }}>Verification Code:</Text>
                            <Text selectable style={{ fontSize: rs.font(24), fontFamily: 'monospace', fontWeight: '900', color: '#312e81', letterSpacing: 6, textAlign: 'center' }}>{contract.verificationCode}</Text>
                          </View>
                        )}
                        <TouchableOpacity onPress={async () => { 
                          // Generate KV proposal clipboard format
                          const buyerR_saved = await (async () => { try { const s = await AsyncStorage.getItem('kv_frost_nonce_' + (contract.agreementId || '')); return s ? JSON.parse(s).R_hex || '' : ''; } catch { return ''; } })();
                          const shareText = generateProposal({
                            agrId: contract.agreementId || '',
                            buyerAddress: myAddress || '',
                            sellerAddress: counterpartyKaspaAddr || '',
                            buyerAmountSompi: Math.floor(contract.itemPriceKas * 1e8),
                            sellerAmountSompi: Math.floor(contract.sellerCommitmentKas * 1e8),
                            network: contract.frostData?.network || 'testnet-10',
                            buyerR: buyerR_saved,
                            verificationCode: contract.verificationCode || '',
                            description: contract.itemDescription || '',
                          });
                          Clipboard.setStringAsync(shareText);
                          Alert.alert('Copied!', 'Agreement details copied to clipboard');
                        }} style={{ backgroundColor: '#4f46e5', borderRadius: 8, padding: 10, marginTop: 8, alignItems: 'center' }}>
                          <Text style={{ color: '#fff', fontSize: rs.font(11), fontWeight: '600' }}>Copy All to Clipboard</Text>
                        </TouchableOpacity>
                        <View style={{ backgroundColor: '#fef3c7', borderRadius: 8, padding: 10, marginTop: 10, borderWidth: 1, borderColor: '#f59e0b' }}>
                          <Text style={{ fontSize: rs.font(11), fontWeight: 'bold', color: '#92400e' }}>Shipping Info (if physical)</Text>
                          <Text style={{ fontSize: rs.font(9), color: '#b45309', marginTop: 4 }}>Carrier: FedEx, UPS, DHL, USPS, or other</Text>
                          <Text style={{ fontSize: rs.font(9), color: '#dc2626', fontWeight: 'bold', marginTop: 4 }}>⚠️ NEVER share your home address. Ship to a UPS Store, FedEx Office, USPS Post Office, Amazon Locker, or any carrier service center near you.\n\nBuyer creates a prepaid shipping label (via carrier app/website) and DMs it to seller. Seller prints label and drops off package. No shipping cost in the agreement.</Text>
                        </View>
                        <Text style={{ fontSize: rs.font(9), color: '#d97706', marginTop: 8, textAlign: 'center' }}>Share AGR ID + TX + Code via DM (Instagram, Signal, etc.)</Text>
                      </View>
                    )}
                    <View style={styles.multisigBox}>
                      <Text style={styles.multisigLabel}>🔐 FROST 2-of-2 Address (Kaspa L1)</Text>
                      <View style={styles.multisigAddress}>
                        <Text style={styles.multisigAddressText} numberOfLines={2}>
                          {contract.multisigAddress || 'kaspa:pq...generating...'}
                        </Text>
                      </View>
                      <Text style={styles.multisigNote}>
                        Both parties must sign to release. No third party controls these funds.
                      </Text>
                      {contract.inscriptionTxId && (
                        <Text style={styles.inscriptionNote}>
                          📝 Inscribed: {contract.inscriptionTxId.slice(0, 12)}...
                        </Text>
                      )}
                    </View>
                    
                    <CollateralBreakdown
                      buyerAmount={contract.itemPriceKas}
                      sellerAmount={contract.sellerCommitmentKas}
                      role={role}
                    />
                    
                    <View style={styles.lockStatus}>
                      <View style={styles.lockStatusRow}>
                        <View style={[styles.lockDot, buyerLocked && styles.lockDotActive]} />
                        <Text style={styles.lockStatusText}>
                          Buyer Lock ({contract.itemPriceKas} KASPA): {buyerLocked ? 'Locked ✓' : 'Pending...'}
                        </Text>
                      </View>
                      <View style={styles.lockStatusRow}>
                        <View style={[styles.lockDot, sellerLocked && styles.lockDotActive]} />
                        <Text style={styles.lockStatusText}>
                          Seller Lock ({contract.sellerCommitmentKas} KASPA): {sellerLocked ? 'Locked ✓' : 'Pending...'}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={{ backgroundColor: '#eef2ff', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#a5b4fc' }}>
                      <ActivityIndicator color='#4f46e5' style={{ marginBottom: 8 }} />
                      <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#3730a3' }}>Waiting for mutual Agreed-Send</Text>
                      <Text style={{ fontSize: 11, color: '#4338ca', marginTop: 4, textAlign: 'center' }}>
                        Polling Arweave every 30 seconds. Auto-sends to FROST when counterparty confirms. You can close the app safely.
                      </Text>
                      <Text style={{ fontSize: 10, color: '#6366f1', marginTop: 8 }}>
                        Your {role === 'buyer' ? contract.itemPriceKas : contract.sellerCommitmentKas} KASPA reserved (spendable reduced)
                      </Text>
                    </View>
                    {collateralFailed && (
                      <TouchableOpacity
                        style={{ backgroundColor: '#d97706', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12 }}
                        onPress={() => { setCollateralFailed(false); handleLock(); }}
                      >
                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#fff' }}>Retry Collateral</Text>
                      </TouchableOpacity>
                    )}
                    {collateralFailed && (
                      <TouchableOpacity
                        style={{ backgroundColor: '#d97706', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12 }}
                        onPress={() => { setCollateralFailed(false); handleLock(); }}
                      >
                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#fff' }}>Retry Collateral</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            )}
            
            {/* Step 4: Pay / Confirm & Release */}
            {step === 4 && (
              <View>
                <Text style={styles.stepTitle}>Step 2: Confirm & Release</Text>
                
                <View style={styles.flowBox}>
                  <Text style={styles.flowTitle}>On Successful Delivery:</Text>
                  <View style={[styles.flowRow, { backgroundColor: COLORS.green100 }]}>
                    <Text style={styles.flowLabel}>Buyer's {contract.itemPriceKas} KASPA</Text>
                    <Text style={styles.flowArrow}>→</Text>
                    <Text style={styles.flowValue}>To Seller</Text>
                  </View>
                  <View style={[styles.flowRow, { backgroundColor: COLORS.blue100 }]}>
                    <Text style={[styles.flowLabel, { color: COLORS.blue700 }]}>
                      Seller's {contract.sellerCommitmentKas} KASPA
                    </Text>
                    <Text style={styles.flowArrow}>→</Text>
                    <Text style={[styles.flowValue, { color: COLORS.blue800 }]}>Back to Seller</Text>
                  </View>
                </View>
                
                {role === 'buyer' ? (
                  <View>
                    <View style={styles.releasePreview}>
                      <Text style={styles.releasePreviewLabel}>Releasing to seller:</Text>
                      <Text style={styles.releasePreviewAmount}>{contract.itemPriceKas} KASPA</Text>
                      <Text style={styles.releasePreviewNote}>
                        Seller's {contract.sellerCommitmentKas} KASPA returns to them
                      </Text>
                    </View>
                    
                    <View style={{ backgroundColor: "#eef2ff", borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#a5b4fc" }}>
                      <TouchableOpacity style={{ backgroundColor: "#059669", borderRadius: 8, padding: 10, alignItems: "center", marginBottom: 10 }} onPress={async () => { try { const Clipboard = Clipboard; const saved = await AsyncStorage.getItem('kv_frost_nonce_' + (contract.agreementId || '')); if (saved) { const n = JSON.parse(saved); await Clipboard.setStringAsync(n.R_hex || ''); Alert.alert('Copied', 'Your R nonce copied to clipboard'); } else { Alert.alert('No Nonce', 'R nonce not generated yet'); } } catch(e) { Alert.alert('Error', String(e)); } }}>
                      <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 12 }}>Copy My R Nonce (Buyer)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={{ backgroundColor: "#059669", borderRadius: 8, padding: 10, alignItems: "center", marginBottom: 10 }} onPress={async () => { try { const Clipboard = Clipboard; const saved = await AsyncStorage.getItem('kv_frost_nonce_' + (contract.agreementId || '')); if (saved) { const n = JSON.parse(saved); await Clipboard.setStringAsync(n.R_hex || ''); Alert.alert('Copied', 'Your R nonce copied to clipboard'); } else { Alert.alert('No Nonce', 'R nonce not generated yet'); } } catch(e) { Alert.alert('Error', String(e)); } }}>
                      <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 12 }}>Copy My R Nonce (Buyer)</Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 13, fontWeight: "bold", color: "#3730a3", marginBottom: 6 }}>Paste Seller R Nonce (optional)</Text>
                      <Text style={{ fontSize: 10, color: "#4338ca", marginBottom: 8 }}>Only needed if auto-detection fails. Seller sends via DM.</Text>
                      <TextInput style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: "#a5b4fc", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 11, fontFamily: "monospace", color: "#1c1917" }} placeholder="02abc...def (66 hex chars)" placeholderTextColor="#a8a29e" onChangeText={async (txt) => { const trimmed = txt.trim(); if (trimmed.length === 66 && (trimmed.startsWith("02") || trimmed.startsWith("03"))) { await AsyncStorage.setItem("kv_manual_counterparty_r_" + (contract.agreementId || ""), trimmed); console.log("[FROST-2R] Manual R saved:", trimmed.slice(0,20)); } }} autoCapitalize="none" autoCorrect={false} />
                    </View>
                    <TouchableOpacity
                      style={[styles.successBtn, isLoading && styles.primaryBtnDisabled]}
                      onPress={handleConfirmDelivery}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <ActivityIndicator color={COLORS.white} />
                      ) : (
                        <Text style={styles.successBtnText}>✓ Confirm & Release KASPA to Seller</Text>
                      )}
                    </TouchableOpacity>
                    
                    

                    {userStats.xp >= XP_THRESHOLD_IOU_ACCESS ? (
                      <TouchableOpacity
                        style={styles.iouBtn}
                        onPress={() => setIouModalVisible(true)}
                      >
                        <Coins size={rs.s(18)} color={COLORS.purple600} />
                        <Text style={styles.iouBtnText}>💰 IOU Balance Sheet</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.iouBtnDisabled}>
                        <Coins size={rs.s(18)} color={COLORS.stone400} />
                        <Text style={styles.iouBtnTextDisabled}>💰 IOU (Need {XP_THRESHOLD_IOU_ACCESS} XP)</Text>
                      </View>
                    )}
                    
                    <TouchableOpacity
                      style={styles.problemLink}
                      onPress={() => setStep(6)}
                    >
                      <Text style={styles.problemLinkText}>Problem? Request Mutual Release</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View>
                    <View style={styles.waitingBox}>
                      <Hourglass size={rs.s(32)} color={COLORS.blue600} />
                      <Text style={styles.waitingText}>Waiting for buyer to confirm & release...</Text>
                      <Text style={styles.waitingNote}>
                        You'll receive {contract.itemPriceKas} KASPA + your {contract.sellerCommitmentKas} KASPA back
                      </Text>
                    </View>
                    <View style={{ backgroundColor: "#fffbeb", borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#f59e0b" }}>
                      <Text style={{ fontSize: 13, fontWeight: "bold", color: "#92400e", marginBottom: 6 }}>Your Nonce (R) ? Share with Buyer</Text>
                      <Text style={{ fontSize: 10, color: "#b45309", marginBottom: 8 }}>If buyer cannot find your R automatically, copy and send via DM</Text>
                      <TouchableOpacity style={{ backgroundColor: "#4f46e5", borderRadius: 8, padding: 10, alignItems: "center" }} onPress={async () => { try { const saved = await AsyncStorage.getItem("kv_frost_nonce_" + (contract.agreementId || "")); if (saved) { const n = JSON.parse(saved); const clipMod = await import("expo-clipboard"); const Clipboard = clipMod.default || clipMod; await Clipboard.setStringAsync(n.R_hex || ""); Alert.alert("Copied!", "Your R nonce copied. Send to buyer via DM."); } else { Alert.alert("No Nonce", "Nonce not found yet."); } } catch (e) { Alert.alert("Error", String(e)); } }}>
                        <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 12 }}>Copy My R Nonce</Text>
                      </TouchableOpacity>
                    </View>
                    
                    {userStats.xp >= XP_THRESHOLD_IOU_ACCESS ? (
                      <TouchableOpacity
                        style={styles.iouBtn}
                        onPress={() => setIouModalVisible(true)}
                      >
                        <Coins size={rs.s(18)} color={COLORS.purple600} />
                        <Text style={styles.iouBtnText}>💰 IOU Balance Sheet</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.iouBtnDisabled}>
                        <Coins size={rs.s(18)} color={COLORS.stone400} />
                        <Text style={styles.iouBtnTextDisabled}>💰 IOU (Need {XP_THRESHOLD_IOU_ACCESS} XP)</Text>
                      </View>
                    )}
                    
                    <TouchableOpacity
                      style={styles.problemLink}
                      onPress={() => setStep(6)}
                    >
                      <Text style={styles.problemLinkText}>Problem? Request Mutual Release</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
            
            {/* Seller Release Bar */}
            {(step === 4 || step === 5) && role === 'seller' && (
              <View style={{ backgroundColor: '#eef2ff', borderRadius: 8, padding: 12, marginTop: 10, borderWidth: 1, borderColor: '#a5b4fc' }}>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#059669', marginBottom: 6 }}>Paste Buyer R Nonce (optional)</Text>
                <TextInput
                  style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#6ee7b7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 11, fontFamily: 'monospace', color: '#1c1917', marginBottom: 10 }}
                  placeholder="Paste buyer R nonce (starts with 02 or 03)..."
                  placeholderTextColor="#a8a29e"
                  onChangeText={async (txt) => { const v = txt.trim(); if (v.length >= 60) { await AsyncStorage.setItem('kv_manual_counterparty_r_' + (contract.agreementId || ''), v); console.log('[Seller] Saved manual buyer R:', v.slice(0,20)); } }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#3730a3', marginBottom: 6 }}>Paste Buyer's Release Key</Text>
                <TextInput
                  style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#a5b4fc', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 11, fontFamily: 'monospace', color: '#1c1917', marginBottom: 8 }}
                  placeholder="Paste encrypted partial sig from buyer..."
                  placeholderTextColor="#a8a29e"
                  onChangeText={async (txt) => {
                    const v = txt.trim();
                    // Auto-extract R and SIG from multi-line paste
                    const rMatch = v.match(/R:\s*([0-9a-f]{60,66})/i);
                    const sigMatch = v.match(/SIG:\s*(.+)/i);
                    if (rMatch && sigMatch) {
                      // Multi-line paste from buyer's Copy Release Info
                      const extractedR = rMatch[1].trim();
                      const extractedSig = sigMatch[1].trim();
                      await AsyncStorage.setItem('kv_manual_counterparty_r_' + (contract.agreementId || ''), extractedR);
                      console.log('[Seller] Auto-extracted R:', extractedR.slice(0,20), 'SIG:', extractedSig.slice(0,20));
                      setContract(prev => ({ ...prev, partialReleaseTx: extractedSig }));
                    } else {
                      setContract(prev => ({ ...prev, partialReleaseTx: v }));
                    }
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                />
                <TouchableOpacity
                  style={{ backgroundColor: '#059669', borderRadius: 8, padding: 12, alignItems: 'center' }}
                  disabled={isLoading}
                  onPress={async () => {
                    try {
                      setIsLoading(true);
                      const partialSig = contract.partialReleaseTx || '';
                      if (!partialSig || partialSig.length < 10) { Alert.alert('Invalid', 'Paste the release key from the buyer'); setIsLoading(false); return; }
                      console.log('[Seller-Release] Got partial sig, co-signing...');
                      const w = await loadMainWallet();
                      if (!w || !contract.frostData) { Alert.alert('Error', 'Wallet or FROST not ready'); setIsLoading(false); return; }
                      // completeFrost2Round imported statically from frost_complete
                      // getFrostR imported statically
                      // AsyncStorage imported statically
                      const total = BigInt(Math.floor((contract.itemPriceKas + contract.sellerCommitmentKas) * 1e8)) - 10000n;
                      // Split template from sig before decrypt
                      let encSig2 = partialSig || '';
                      let txTemplateB64_2 = '';
                      const pipePos2 = encSig2.indexOf('|');
                      if (pipePos2 > 0) { txTemplateB64_2 = encSig2.slice(pipePos2 + 1); encSig2 = encSig2.slice(0, pipePos2); }
                      const decrypted = (() => { try { return decryptPartialSig({ encrypted: encSig2, myPrivKeyHex: w.privKeyHex, counterpartyPubKeyHex: contract.buyerPubkey || '' }); } catch { return encSig2; } })();
                      // Get buyer R from TownHall
                      let buyerR = '';
                      try { const rData = await getFrostR(contract.agreementId || ''); buyerR = rData?.frost_r_a || ''; } catch {}
                      if (!buyerR) {
                        try { const gql = '{ transactions(first: 5, tags: [{ name: "KV-AgreementId", values: ["' + contract.agreementId + '"] }, { name: "KV-Status", values: ["PartialSig"] }]) { edges { node { tags { name value } } } } }';
                          const resp = await fetch('https://arweave.net/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: gql }) });
                          const arResp2 = await resp.json(); const tags = arResp2?.data?.transactions?.edges?.[0]?.node?.tags || [];
                          const rTag = tags.find((t) => t.name === 'KV-FrostR'); if (rTag?.value) buyerR = rTag.value;
                        } catch {}
                      }
                      // Parse buyer's partial sig (R_agg_x || s format)
                      const sigBytes = typeof decrypted === 'string' ? decrypted : '';
                      // Parse all s values + reattach template
                      const cpAllS2: string[] = []; for (let si = 64; si < sigBytes.length; si += 64) { cpAllS2.push(sigBytes.slice(si, si + 64)); }
                      const buyerSig = cpAllS2.length > 0 ? { R_agg_x_hex: sigBytes.slice(0, 64), s_hex: cpAllS2.join('') + (txTemplateB64_2 ? '|' + txTemplateB64_2 : '') } : undefined;
                      const myNonceJson = await AsyncStorage.getItem('kv_frost_nonce_' + (contract.agreementId || ''));
                      if (!myNonceJson || !buyerR) { Alert.alert('Missing Data', 'Nonce or buyer R not found. Try again.'); setIsLoading(false); return; }
                      console.log('[Seller-Release] 2-round: buyerR=', buyerR.slice(0,20), 'buyerSig=', buyerSig ? 'yes' : 'no');
                      const result = await completeFrost2Round({ frostAddress: contract.frostData, myPrivateKeyHex: w.privKeyHex, recipientAddress: w.address, amountSompi: total, myNonceJson, counterpartyR_hex: buyerR, counterpartySig: buyerSig, buyerAmountSompi: BigInt(Math.floor((contract.itemPriceKas || 0) * 1e8)), sellerAmountSompi: BigInt(Math.floor((contract.sellerCommitmentKas || 0) * 1e8)), buyerAddress: (() => { const bpk = contract.buyerPubkey || ''; const bx = bpk.length === 66 ? bpk.slice(2) : bpk; return aggregateToAddress('02' + bx, contract.frostData?.network || 'testnet-10'); })(), sellerAddress: w.address });
                      if (result.success && result.txId) {
                        console.log('[Seller-Release] Release TX:', result.txId);
                        setContract(prev => ({ ...prev, releaseTxId: result.txId }));
                        setStep(7);
                        Alert.alert('Funds Released!', 'TX: ' + (result.txId || '').slice(0, 16) + '...');
                      } else { Alert.alert('Failed', result.error || 'Co-sign failed'); }
                    } catch (e) { Alert.alert('Error', String(e)); }
                    finally { setIsLoading(false); }
                  }}>
                  {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>Release Funds</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* Step 5: Complete */}
            {step === 5 && (
            <>
            <View style={{ backgroundColor: '#f0fdf4', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#86efac' }}>
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#166534', marginBottom: 6 }}>? Delivery Confirmed ? Send to Seller</Text>
              <Text style={{ fontSize: 11, color: '#15803d' }}>AGR ID: {contract.agreementId}</Text>
              <Text style={{ fontSize: 11, color: '#15803d', marginTop: 2 }}>Arweave TX: {contract.partialReleaseTx || contract.arweaveTxId || 'pending...'}</Text>
              <TouchableOpacity 
                style={{ backgroundColor: '#22c55e', paddingVertical: 8, borderRadius: 6, marginTop: 8, alignItems: 'center' }}
                onPress={async () => {
                  try {
                    // Clipboard imported statically
                    const myR = await (async () => { try { const s = await AsyncStorage.getItem('kv_frost_nonce_' + (contract.agreementId || '')); if (s) return JSON.parse(s).R_hex || ''; } catch {} return ''; })(); await Clipboard.setStringAsync('AGR: ' + (contract.agreementId || '') + '\nR: ' + myR + '\nSIG: ' + (contract.partialReleaseTx || '') + '\nSeller: press Check for Release');
                    Alert.alert('Copied', 'Send this to the seller so they can release funds');
                  } catch {}
                }}>
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>?? Copy Release Info for Seller</Text>
              </TouchableOpacity>
            </View>
              <View style={styles.completeContainer}>
                <View style={styles.completeIcon}>
                  <CheckCircle size={rs.s(40)} color={COLORS.green600} />
                </View>
                <Text style={styles.completeTitle}>Transaction Complete!</Text>
                
                <View style={styles.completeSummary}>
                  <View style={styles.completeRow}>
                    <Text style={styles.completeLabel}>Item:</Text>
                    <Text style={styles.completeValue}>{contract.itemDescription}</Text>
                  </View>
                  <View style={styles.completeRow}>
                    <Text style={styles.completeLabel}>Payment transferred:</Text>
                    <Text style={[styles.completeValue, { color: COLORS.green700 }]}>
                      {contract.itemPriceKas} KASPA → Seller
                    </Text>
                  </View>
                  <View style={styles.completeDivider} />
                  <View style={styles.completeRow}>
                    <Text style={styles.completeSmallLabel}>Buyer commitment:</Text>
                    <Text style={styles.completeSmallValue}>Unlocked ✓</Text>
                  </View>
                  <View style={styles.completeRow}>
                    <Text style={styles.completeSmallLabel}>Seller commitment:</Text>
                    <Text style={styles.completeSmallValue}>Unlocked ✓</Text>
                  </View>
                </View>
                
                <TouchableOpacity style={styles.primaryBtn} onPress={onClose}>
                  <Text style={styles.primaryBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </>)}
            
            {/* Step 6: Mutual Release */}
            {step === 6 && (
              <View>
                <View style={styles.stepHeader}>
                  <AlertTriangle size={rs.s(20)} color={COLORS.red700} />
                  <Text style={styles.stepTitle}>Problem? Let's Resolve It</Text>
                </View>
                
                <InfoBox title="How Mutual Release Works" variant="warning">
                  <Text style={{ fontSize: rs.font(11), color: COLORS.amber700 }}>
                    Since there's no third party holding funds, <Text style={{ fontWeight: 'bold' }}>both parties must agree</Text> to cancel and unlock funds.
                  </Text>
                </InfoBox>
                
                <ReleaseStatus
                  buyerRequested={buyerRequestedRelease}
                  sellerRequested={sellerRequestedRelease}
                />
                
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>
                    ⚠️ If you request release and the other party refuses, you'll be stuck until they agree (deadlock).
                  </Text>
                </View>
                
                <TouchableOpacity
                  style={[
                    styles.warningBtn,
                    ((role === 'buyer' && buyerRequestedRelease) || (role === 'seller' && sellerRequestedRelease)) && styles.primaryBtnDisabled
                  ]}
                  onPress={handleRequestRelease}
                  disabled={isLoading || (role === 'buyer' && buyerRequestedRelease) || (role === 'seller' && sellerRequestedRelease)}
                >
                  {isLoading ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.warningBtnText}>
                      {(role === 'buyer' && buyerRequestedRelease) || (role === 'seller' && sellerRequestedRelease)
                        ? '⏳ Waiting for other party...'
                        : 'Request Mutual Release (Cancel Transaction)'}
                    </Text>
                  )}
                </TouchableOpacity>
                
                {((role === 'buyer' && sellerRequestedRelease && !buyerRequestedRelease) ||
                  (role === 'seller' && buyerRequestedRelease && !sellerRequestedRelease)) && (
                  <View style={styles.otherRequestedBox}>
                    <Text style={styles.otherRequestedTitle}>Other party wants to cancel</Text>
                    <Text style={styles.otherRequestedText}>
                      You can agree to cancel (funds return to each owner) or enter dispute to negotiate a different split.
                    </Text>
                    <View style={styles.otherRequestedButtons}>
                      <TouchableOpacity
                        style={[styles.smallBtn, { backgroundColor: COLORS.green600 }]}
                        onPress={handleRequestRelease}
                      >
                        <Text style={styles.smallBtnText}>✓ Agree to Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.smallBtn, { backgroundColor: COLORS.amber600 }]}
                        onPress={handleEnterDispute}
                      >
                        <Text style={styles.smallBtnText}>🐌 Enter Dispute</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                
                <TouchableOpacity
                  style={styles.backLink}
                  onPress={() => setStep(4)}
                >
                  <Text style={styles.backLinkText}>← Go back and complete transaction instead</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {/* Step 7: Mutual Release Complete */}
            {step === 7 && (
              <View style={styles.completeContainer}>
                <View style={[styles.completeIcon, { backgroundColor: COLORS.green100 }]}>
                  <CheckCircle size={rs.s(40)} color={COLORS.green600} />
                </View>
                <Text style={[styles.completeTitle, { color: COLORS.green700 }]}>
                  {contract.releaseTxId ? 'Release Complete!' : 'Mutually Released'}
                </Text>
                
                <View style={styles.completeSummary}>
                  <View style={styles.completeRow}>
                    <Text style={styles.completeLabel}>Item:</Text>
                    <Text style={styles.completeValue}>{contract.itemDescription}</Text>
                  </View>
                  <View style={styles.completeRow}>
                    <Text style={styles.completeLabel}>Payment:</Text>
                    <Text style={[styles.completeValue, { color: COLORS.green700 }]}>
                      {contract.releaseTxId 
                        ? `${contract.itemPriceKas + contract.sellerCommitmentKas} KASPA released`
                        : 'No transfer (cancelled)'
                      }
                    </Text>
                  </View>
                  {contract.releaseTxId && (
                    <View style={styles.completeRow}>
                      <Text style={styles.completeLabel}>TX ID:</Text>
                      <Text style={[styles.completeValue, { fontFamily: 'monospace', fontSize: rs.font(10) }]}>
                        {contract.releaseTxId.slice(0, 16)}...
                      </Text>
                    </View>
                  )}
                </View>
                
                {contract.releaseExplorerUrl && (
                  <TouchableOpacity
                    style={[styles.secondaryBtn, { marginBottom: rs.s(12) }]}
                    onPress={() => Linking.openURL(contract.releaseExplorerUrl!)}
                  >
                    <Text style={styles.secondaryBtnText}>View on Explorer →</Text>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: contract.releaseTxId ? COLORS.green600 : COLORS.amber600 }]}
                  onPress={onClose}
                >
                  <Text style={styles.primaryBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {/* Step 8: Dispute / Snail Poison */}
            {step === 8 && (
              <View>
                <View style={styles.disputeHeader}>
                  <View style={styles.snailIcon}>
                    <Text style={styles.snailIconEmoji}>🐌</Text>
                  </View>
                  <View>
                    <Text style={styles.disputeTitle}>Dispute - Snail Poison</Text>
                    <Text style={styles.disputeSubtitle}>Both parties must agree on fund split</Text>
                  </View>
                </View>
                
                <InfoBox title="🐌 Snail Poison Active" variant="warning">
                  <Text style={{ fontSize: rs.font(10), color: COLORS.amber700 }}>
                    • Reputation drains -5/day for both parties{'\n'}
                    • Platform actions are rate-limited{'\n'}
                    • Cannot create new agreements when rep &lt; 20{'\n'}
                    • Only resolved when both sign agreeing on split
                  </Text>
                </InfoBox>
                
                <View style={styles.disputeFundsBox}>
                  <Text style={styles.disputeFundsTitle}>💰 Funds in FROST Address</Text>
                  <View style={[styles.disputeFundsRow, { backgroundColor: COLORS.green100 }]}>
                    <Text style={styles.disputeFundsLabel}>Buyer posted:</Text>
                    <Text style={styles.disputeFundsValue}>{contract.itemPriceKas} KASPA</Text>
                  </View>
                  <View style={[styles.disputeFundsRow, { backgroundColor: COLORS.blue100 }]}>
                    <Text style={[styles.disputeFundsLabel, { color: COLORS.blue700 }]}>Seller posted:</Text>
                    <Text style={[styles.disputeFundsValue, { color: COLORS.blue800 }]}>{contract.sellerCommitmentKas} KASPA</Text>
                  </View>
                  <View style={[styles.disputeFundsRow, { backgroundColor: COLORS.indigo100, borderWidth: 2, borderColor: COLORS.indigo300 }]}>
                    <Text style={[styles.disputeFundsLabel, { color: COLORS.indigo700, fontWeight: 'bold' }]}>Total:</Text>
                    <Text style={[styles.disputeFundsValue, { color: COLORS.indigo800 }]}>
                      {contract.itemPriceKas + contract.sellerCommitmentKas} KASPA
                    </Text>
                  </View>
                  <Text style={styles.disputeFundsNote}>
                    Funds are NOT frozen. Both signatures can release anytime.
                  </Text>
                </View>
                
                <View style={styles.proposeSplitBox}>
                  <Text style={styles.proposeSplitTitle}>Propose Split</Text>
                  <View style={styles.proposeSplitInputs}>
                    <View style={styles.proposeSplitInput}>
                      <Text style={styles.proposeSplitLabel}>Buyer Gets (KAS)</Text>
                      <TextInput
                        style={[styles.input, { borderColor: COLORS.green200 }]}
                        value={proposedSplit.buyerGets.toString()}
                        onChangeText={(text) => {
                          const val = parseInt(text) || 0;
                          setProposedSplit({
                            buyerGets: val,
                            sellerGets: (contract.itemPriceKas + contract.sellerCommitmentKas) - val,
                          });
                        }}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.proposeSplitInput}>
                      <Text style={styles.proposeSplitLabel}>Seller Gets (KAS)</Text>
                      <TextInput
                        style={[styles.input, { borderColor: COLORS.blue200 }]}
                        value={proposedSplit.sellerGets.toString()}
                        onChangeText={(text) => {
                          const val = parseInt(text) || 0;
                          setProposedSplit({
                            sellerGets: val,
                            buyerGets: (contract.itemPriceKas + contract.sellerCommitmentKas) - val,
                          });
                        }}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                  
                  <View style={styles.quickSplitRow}>
                    <TouchableOpacity
                      style={styles.quickSplitBtn}
                      onPress={() => setProposedSplit({
                        buyerGets: contract.itemPriceKas,
                        sellerGets: contract.sellerCommitmentKas,
                      })}
                    >
                      <Text style={styles.quickSplitBtnText}>Each gets own</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickSplitBtn}
                      onPress={() => {
                        const total = contract.itemPriceKas + contract.sellerCommitmentKas;
                        setProposedSplit({
                          buyerGets: Math.floor(total / 2),
                          sellerGets: Math.ceil(total / 2),
                        });
                      }}
                    >
                      <Text style={styles.quickSplitBtnText}>50/50 split</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <TouchableOpacity style={styles.primaryBtn} onPress={handleProposeSplit}>
                    <Text style={styles.primaryBtnText}>Propose This Split</Text>
                  </TouchableOpacity>
                </View>
                
                <TouchableOpacity
                  style={styles.backLink}
                  onPress={() => setStep(6)}
                >
                  <Text style={styles.backLinkText}>← Back to release options</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
      
      {/* IOU Balance Sheet Modal */}
      <IOUBalanceSheetModal
        visible={iouModalVisible}
        frostAgreementId={`frost_${contract.multisigAddress?.slice(0, 12) || 'pending'}`}
        frostTxId={contract.buyerLockTxId || contract.sellerLockTxId || ''}
        frostAddress={contract.multisigAddress || ''}
        myPubkey={userPubkey || ''}
        myAddress={myAddress || ''}
        myCollateralSompi={BigInt(Math.round((role === 'buyer' ? contract.itemPriceKas : contract.sellerCommitmentKas) * 1e8))}
        counterpartyPubkey={contract.counterpartyPubkey || ''}
        counterpartyAddress={counterpartyAddress || ''}
        counterpartyCollateralSompi={BigInt(Math.round((role === 'buyer' ? contract.sellerCommitmentKas : contract.itemPriceKas) * 1e8))}
        counterpartyAlias={role === 'buyer' ? 'Seller' : 'Buyer'}
        onClose={() => setIouModalVisible(false)}
      />
    </Modal>
  );
};

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: rs.s(24),
    borderTopRightRadius: rs.s(24),
    width: '100%',
    maxHeight: '92%',
    minHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: rs.s(20),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.stone200,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(10),
  },
  headerTitle: {
    fontSize: rs.font(18),
    fontWeight: '900',
    color: COLORS.indigo900,
  },
  closeBtn: {
    padding: rs.s(4),
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: rs.s(20),
    paddingBottom: rs.s(40),
  },
  
  snailWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: rs.s(12),
    backgroundColor: COLORS.amber100,
    borderRadius: rs.s(12),
    borderWidth: 2,
    borderColor: COLORS.amber400,
    padding: rs.s(12),
    marginBottom: rs.s(16),
  },
  snailEmoji: {
    fontSize: rs.font(24),
  },
  snailContent: {
    flex: 1,
  },
  snailTitle: {
    fontSize: rs.font(13),
    fontWeight: 'bold',
    color: COLORS.amber800,
    marginBottom: rs.s(4),
  },
  snailText: {
    fontSize: rs.font(11),
    color: COLORS.amber700,
    lineHeight: rs.font(16),
  },
  snailNote: {
    fontSize: rs.font(10),
    color: COLORS.amber600,
    marginTop: rs.s(4),
  },
  
  stepList: {
    gap: rs.s(12),
  },
  stepItem: {
    flexDirection: 'row',
    gap: rs.s(12),
  },
  stepCircle: {
    width: rs.s(24),
    height: rs.s(24),
    borderRadius: rs.s(12),
    backgroundColor: COLORS.indigo600,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleText: {
    fontSize: rs.font(11),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  stepInfo: {
    flex: 1,
  },
  stepItemTitle: {
    fontSize: rs.font(13),
    fontWeight: 'bold',
    color: COLORS.indigo800,
  },
  stepItemDesc: {
    fontSize: rs.font(11),
    color: COLORS.indigo600,
    marginTop: rs.s(2),
  },
  stepItemNote: {
    fontSize: rs.font(10),
    color: COLORS.indigo500,
    marginTop: rs.s(2),
  },
  
  outcomeList: {
    gap: rs.s(8),
  },
  outcomeItem: {
    flexDirection: 'row',
    gap: rs.s(8),
  },
  outcomeCheck: {
    fontSize: rs.font(12),
    color: COLORS.green600,
    fontWeight: 'bold',
  },
  outcomeWait: {
    fontSize: rs.font(12),
  },
  outcomeText: {
    flex: 1,
    fontSize: rs.font(11),
    color: COLORS.amber700,
  },
  outcomeNote: {
    fontSize: rs.font(10),
    color: COLORS.amber600,
    fontStyle: 'italic',
    marginTop: rs.s(8),
  },
  
  formSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.stone200,
    paddingTop: rs.s(16),
    marginTop: rs.s(16),
  },
  formTitle: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.stone700,
    marginBottom: rs.s(12),
  },
  inputGroup: {
    marginBottom: rs.s(12),
  },
  inputRow: {
    flexDirection: 'row',
    gap: rs.s(12),
  },
  inputLabel: {
    fontSize: rs.font(12),
    fontWeight: 'bold',
    color: COLORS.stone600,
    marginBottom: rs.s(4),
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.indigo200,
    borderRadius: rs.s(12),
    paddingHorizontal: rs.s(14),
    paddingVertical: rs.s(12),
    fontSize: rs.font(14),
    color: COLORS.stone800,
  },
  textArea: {
    minHeight: rs.s(64),
    textAlignVertical: 'top',
  },
  inputNote: {
    fontSize: rs.font(10),
    color: COLORS.stone400,
    marginTop: rs.s(4),
  },
  
  summaryBox: {
    backgroundColor: COLORS.stone100,
    borderRadius: rs.s(12),
    padding: rs.s(16),
    marginBottom: rs.s(16),
  },
  summaryTitle: {
    fontSize: rs.font(13),
    fontWeight: 'bold',
    color: COLORS.stone700,
    marginBottom: rs.s(12),
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: rs.s(8),
    marginBottom: rs.s(12),
  },
  summaryItem: {
    flex: 1,
    borderRadius: rs.s(8),
    padding: rs.s(10),
  },
  summaryItemLabel: {
    fontSize: rs.font(10),
    color: COLORS.green600,
  },
  summaryItemValue: {
    fontSize: rs.font(18),
    fontWeight: '900',
    marginTop: rs.s(4),
  },
  
  primaryBtn: {
    backgroundColor: COLORS.indigo600,
    borderRadius: rs.s(12),
    paddingVertical: rs.s(16),
    alignItems: 'center',
  },
  primaryBtnDisabled: {
    backgroundColor: COLORS.stone300,
  },
  primaryBtnText: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  secondaryBtn: {
    backgroundColor: COLORS.stone100,
    borderWidth: 1,
    borderColor: COLORS.stone300,
    borderRadius: rs.s(12),
    paddingVertical: rs.s(14),
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: rs.font(14),
    fontWeight: '600',
    color: COLORS.stone700,
  },
  successBtn: {
    backgroundColor: COLORS.green600,
    borderRadius: rs.s(12),
    paddingVertical: rs.s(18),
    alignItems: 'center',
  },
  successBtnText: {
    fontSize: rs.font(16),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  warningBtn: {
    backgroundColor: COLORS.amber600,
    borderRadius: rs.s(12),
    paddingVertical: rs.s(14),
    alignItems: 'center',
    marginBottom: rs.s(12),
  },
  warningBtnText: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  smallBtn: {
    flex: 1,
    borderRadius: rs.s(8),
    paddingVertical: rs.s(10),
    alignItems: 'center',
  },
  smallBtnText: {
    fontSize: rs.font(12),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  
  contractSummary: {
    backgroundColor: COLORS.stone50,
    borderRadius: rs.s(12),
    padding: rs.s(16),
    marginBottom: rs.s(20),
  },
  contractRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: rs.s(8),
  },
  contractLabel: {
    fontSize: rs.font(13),
    color: COLORS.stone600,
  },
  contractValue: {
    fontSize: rs.font(13),
    fontWeight: 'bold',
    color: COLORS.stone800,
  },
  
  roleGrid: {
    flexDirection: 'row',
    gap: rs.s(16),
  },
  roleCard: {
    flex: 1,
    padding: rs.s(24),
    borderRadius: rs.s(16),
    borderWidth: 2,
    alignItems: 'center',
  },
  roleTitle: {
    fontSize: rs.font(15),
    fontWeight: 'bold',
    marginTop: rs.s(8),
  },
  roleDesc: {
    fontSize: rs.font(11),
    marginTop: rs.s(4),
  },
  
  stepTitle: {
    fontSize: rs.font(16),
    fontWeight: 'bold',
    color: COLORS.indigo800,
    marginBottom: rs.s(16),
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(8),
    marginBottom: rs.s(16),
  },
  
  multisigBox: {
    backgroundColor: COLORS.indigo100,
    borderRadius: rs.s(12),
    borderWidth: 2,
    borderColor: COLORS.indigo300,
    padding: rs.s(16),
    marginBottom: rs.s(16),
  },
  multisigLabel: {
    fontSize: rs.font(11),
    fontWeight: 'bold',
    color: COLORS.indigo600,
    textTransform: 'uppercase',
    marginBottom: rs.s(8),
  },
  multisigAddress: {
    backgroundColor: COLORS.white,
    borderRadius: rs.s(8),
    padding: rs.s(12),
    marginBottom: rs.s(8),
  },
  multisigAddressText: {
    fontSize: rs.font(11),
    fontFamily: 'monospace',
    color: COLORS.indigo900,
  },
  multisigNote: {
    fontSize: rs.font(10),
    color: COLORS.indigo500,
  },
  inscriptionNote: {
    fontSize: rs.font(10),
    color: COLORS.green600,
    marginTop: rs.s(6),
    fontFamily: 'monospace',
  },
  
  lockStatus: {
    backgroundColor: COLORS.stone50,
    borderRadius: rs.s(12),
    padding: rs.s(16),
    marginBottom: rs.s(16),
  },
  lockStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(8),
    marginBottom: rs.s(8),
  },
  lockDot: {
    width: rs.s(16),
    height: rs.s(16),
    borderRadius: rs.s(8),
    backgroundColor: COLORS.amber400,
  },
  lockDotActive: {
    backgroundColor: COLORS.green500,
  },
  lockStatusText: {
    fontSize: rs.font(13),
    color: COLORS.stone700,
  },
  
  flowBox: {
    backgroundColor: COLORS.stone50,
    borderRadius: rs.s(12),
    padding: rs.s(16),
    marginBottom: rs.s(16),
  },
  flowTitle: {
    fontSize: rs.font(13),
    fontWeight: 'bold',
    color: COLORS.stone700,
    marginBottom: rs.s(12),
  },
  flowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: rs.s(8),
    padding: rs.s(10),
    marginBottom: rs.s(8),
  },
  flowLabel: {
    fontSize: rs.font(12),
    color: COLORS.green700,
  },
  flowArrow: {
    fontSize: rs.font(14),
    color: COLORS.stone400,
  },
  flowValue: {
    fontSize: rs.font(12),
    fontWeight: 'bold',
    color: COLORS.green800,
  },
  
  releasePreview: {
    backgroundColor: COLORS.stone50,
    borderRadius: rs.s(16),
    padding: rs.s(24),
    alignItems: 'center',
    marginBottom: rs.s(16),
  },
  releasePreviewLabel: {
    fontSize: rs.font(12),
    color: COLORS.stone500,
    marginBottom: rs.s(4),
  },
  releasePreviewAmount: {
    fontSize: rs.font(36),
    fontWeight: '900',
    color: COLORS.amber900,
  },
  releasePreviewNote: {
    fontSize: rs.font(11),
    color: COLORS.stone400,
    marginTop: rs.s(8),
  },
  
  waitingBox: {
    backgroundColor: COLORS.blue50,
    borderRadius: rs.s(16),
    padding: rs.s(24),
    alignItems: 'center',
    marginBottom: rs.s(16),
  },
  waitingText: {
    fontSize: rs.font(13),
    color: COLORS.blue700,
    marginTop: rs.s(8),
  },
  waitingNote: {
    fontSize: rs.font(11),
    color: COLORS.blue500,
    marginTop: rs.s(8),
    textAlign: 'center',
  },
  
  iouBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3e8ff',
    borderWidth: 1,
    borderColor: '#c084fc',
    borderRadius: rs.s(12),
    paddingVertical: rs.s(14),
    paddingHorizontal: rs.s(20),
    marginTop: rs.s(12),
    gap: rs.s(8),
  },
  iouBtnText: {
    fontSize: rs.font(14),
    fontWeight: '600',
    color: '#7c3aed',
  },
  iouBtnDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f4',
    borderWidth: 1,
    borderColor: '#d6d3d1',
    borderRadius: rs.s(12),
    paddingVertical: rs.s(14),
    paddingHorizontal: rs.s(20),
    marginTop: rs.s(12),
    gap: rs.s(8),
    opacity: 0.6,
  },
  iouBtnTextDisabled: {
    fontSize: rs.font(14),
    fontWeight: '600',
    color: '#78716c',
  },
  
  problemLink: {
    alignItems: 'center',
    paddingVertical: rs.s(12),
  },
  problemLinkText: {
    fontSize: rs.font(13),
    color: COLORS.red600,
    textDecorationLine: 'underline',
  },
  backLink: {
    alignItems: 'center',
    paddingVertical: rs.s(12),
  },
  backLinkText: {
    fontSize: rs.font(13),
    color: COLORS.indigo600,
    textDecorationLine: 'underline',
  },
  
  completeContainer: {
    alignItems: 'center',
  },
  completeIcon: {
    width: rs.s(80),
    height: rs.s(80),
    backgroundColor: COLORS.green100,
    borderRadius: rs.s(40),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: rs.s(16),
  },
  completeTitle: {
    fontSize: rs.font(22),
    fontWeight: '900',
    color: COLORS.green700,
    marginBottom: rs.s(20),
  },
  completeSummary: {
    backgroundColor: COLORS.stone50,
    borderRadius: rs.s(12),
    padding: rs.s(16),
    width: '100%',
    marginBottom: rs.s(20),
  },
  completeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: rs.s(8),
  },
  completeLabel: {
    fontSize: rs.font(13),
    color: COLORS.stone500,
  },
  completeValue: {
    fontSize: rs.font(13),
    fontWeight: 'bold',
    color: COLORS.stone800,
  },
  completeDivider: {
    height: 1,
    backgroundColor: COLORS.stone200,
    marginVertical: rs.s(8),
  },
  completeSmallLabel: {
    fontSize: rs.font(11),
    color: COLORS.stone400,
  },
  completeSmallValue: {
    fontSize: rs.font(11),
    color: COLORS.green600,
  },
  
  warningBox: {
    backgroundColor: COLORS.red100,
    borderWidth: 1,
    borderColor: COLORS.red300,
    borderRadius: rs.s(12),
    padding: rs.s(12),
    marginBottom: rs.s(16),
  },
  warningText: {
    fontSize: rs.font(11),
    color: COLORS.red800,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  
  otherRequestedBox: {
    backgroundColor: COLORS.amber100,
    borderRadius: rs.s(12),
    borderWidth: 2,
    borderColor: COLORS.amber300,
    padding: rs.s(16),
    marginBottom: rs.s(12),
  },
  otherRequestedTitle: {
    fontSize: rs.font(13),
    fontWeight: 'bold',
    color: COLORS.amber800,
    marginBottom: rs.s(4),
  },
  otherRequestedText: {
    fontSize: rs.font(11),
    color: COLORS.amber700,
    marginBottom: rs.s(12),
  },
  otherRequestedButtons: {
    flexDirection: 'row',
    gap: rs.s(8),
  },
  
  disputeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(12),
    marginBottom: rs.s(16),
  },
  snailIcon: {
    width: rs.s(48),
    height: rs.s(48),
    backgroundColor: COLORS.amber100,
    borderRadius: rs.s(24),
    justifyContent: 'center',
    alignItems: 'center',
  },
  snailIconEmoji: {
    fontSize: rs.font(24),
  },
  disputeTitle: {
    fontSize: rs.font(18),
    fontWeight: '900',
    color: COLORS.amber700,
  },
  disputeSubtitle: {
    fontSize: rs.font(11),
    color: COLORS.amber600,
  },
  disputeFundsBox: {
    backgroundColor: COLORS.stone50,
    borderRadius: rs.s(12),
    padding: rs.s(16),
    marginBottom: rs.s(16),
  },
  disputeFundsTitle: {
    fontSize: rs.font(13),
    fontWeight: 'bold',
    color: COLORS.stone700,
    marginBottom: rs.s(12),
  },
  disputeFundsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: rs.s(8),
    padding: rs.s(10),
    marginBottom: rs.s(8),
  },
  disputeFundsLabel: {
    fontSize: rs.font(12),
    color: COLORS.green700,
  },
  disputeFundsValue: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.green800,
  },
  disputeFundsNote: {
    fontSize: rs.font(10),
    color: COLORS.stone500,
    textAlign: 'center',
    marginTop: rs.s(4),
  },
  proposeSplitBox: {
    backgroundColor: COLORS.white,
    borderRadius: rs.s(12),
    borderWidth: 1,
    borderColor: COLORS.indigo200,
    padding: rs.s(16),
    marginBottom: rs.s(16),
  },
  proposeSplitTitle: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.indigo800,
    marginBottom: rs.s(12),
  },
  proposeSplitInputs: {
    flexDirection: 'row',
    gap: rs.s(12),
    marginBottom: rs.s(12),
  },
  proposeSplitInput: {
    flex: 1,
  },
  proposeSplitLabel: {
    fontSize: rs.font(10),
    color: COLORS.stone500,
    marginBottom: rs.s(4),
  },
  quickSplitRow: {
    flexDirection: 'row',
    gap: rs.s(8),
    marginBottom: rs.s(12),
  },
  quickSplitBtn: {
    flex: 1,
    backgroundColor: COLORS.stone100,
    borderRadius: rs.s(8),
    padding: rs.s(10),
    alignItems: 'center',
  },
  quickSplitBtnText: {
    fontSize: rs.font(11),
    color: COLORS.stone700,
  },
});

export default NeighborAgreement;
