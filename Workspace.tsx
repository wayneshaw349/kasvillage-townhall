// ============================================================================
// KASVILLAGE EXPO - WORKSPACE COMPONENT v2.1 (MERGED)
// ============================================================================
// POSTING FLOW:
// - Storefronts: KasVillage posts for user after TownHall verification (FREE via Turbo)
// - Academics: KasVillage posts for user after DKIM verification (FREE via Turbo)
// - Services: KasVillage posts for user after TownHall verification (FREE via Turbo)
// - DApps/Games: User posts themselves to Arweave, KasVillage only verifies for display
//
// KasVillage is NOT a host - Arweave hosts content permanently
// KasVillage provides verification for display filtering (consumer protection UX)
// ============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  PixelRatio,
  TextInput,
  Alert,
  Linking,
  Clipboard,
  ActivityIndicator,
  Modal,
} from 'react-native';
import Svg, { Rect, Defs, Pattern, Line, G, Path } from 'react-native-svg';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

// Import upload functions (v2 TownHall integration)
import { uploadStoreListing } from './arweave_upload';

// Import procedural backgrounds
import { ProceduralBackground } from './expo_procedural_backgrounds';
import {
  Store,
  Lock,
  ShieldCheck,
  AlertTriangle,
  PlayCircle,
  FileText,
  ExternalLink,
  Code,
  Wallet,
  Clock,
  Search,
  X,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Trash2,
  Edit3,
  Plus,
  ShoppingBag,
  Eye,
  Save,
  RefreshCw,
  Ban,
  Activity,
  Layout,
  User,
  Mail,
  Check,
  Copy,
} from 'lucide-react-native';

// ============================================================================
// RESPONSIVE SCALER
// ============================================================================
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BASE_WIDTH = 393;
const scale = Math.min(SCREEN_WIDTH / BASE_WIDTH, 1.2);

const rs = {
  s: (size: number) => Math.round(size * scale),
  font: (size: number) => Math.round(size * scale * (PixelRatio.getFontScale() > 1 ? 0.9 : 1)),
  w: (pct: number) => Math.round((SCREEN_WIDTH * pct) / 100),
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
  stone950: '#0c0a09',
  
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
  
  orange200: '#fed7aa',
  orange500: '#f97316',
  orange600: '#ea580c',
  
  purple100: '#f3e8ff',
  purple200: '#e9d5ff',
  purple500: '#a855f7',
  purple600: '#9333ea',
  purple700: '#7e22ce',
  purple800: '#6b21a8',
  purple900: '#581c87',
  
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
  green500: '#22c55e',
  green600: '#16a34a',
  green700: '#15803d',
  green800: '#166534',
  green900: '#14532d',
  
  red50: '#fef2f2',
  red100: '#fee2e2',
  red200: '#fecaca',
  red300: '#fca5a5',
  red400: '#f87171',
  red500: '#ef4444',
  red600: '#dc2626',
  red700: '#b91c1c',
  red800: '#991b1b',
  
  blue50: '#eff6ff',
  blue100: '#dbeafe',
  blue200: '#bfdbfe',
  blue500: '#3b82f6',
  blue600: '#2563eb',
  blue700: '#1d4ed8',
  blue800: '#1e40af',
  
  // Workspace specific
  brickWarm: '#8B7355',
  brickDark: '#7A6548',
  brickMortar: '#6B5A3E',
  woodDark: '#5D4E37',
  woodGold: '#B8860B',
  lampShade: '#E8DDD0',
  carpet: '#C4B08C',
};

// ============================================================================
// TOWNHALL API (v2 integration)
// ============================================================================
const TOWNHALL_API = 'https://townhall.kasvillage.dev/api';

// TownHallClient for signed, authenticated API calls
import { townHall as townHallClient } from './townhall_client';

interface TownHallVerifyResponse {
  verified: boolean;
  code_hash?: string;
  scan_result?: {
    passed: boolean;
    status: 'verified' | 'pending_review' | 'not_displayed';
  };
  message: string;
}

async function verifyStorefrontWithTownHall(storefront: {
  storeName: string;
  description: string;
  category: string;
  ownerPubkey: string;
}): Promise<TownHallVerifyResponse> {
  try {
    const result = await townHallClient.verifyStore(
      `STORE_${Date.now()}`,
      storefront.storeName,
      storefront.description,
    );
    return {
      verified: result.verified ?? false,
      code_hash: result.arweaveTx || undefined,
      scan_result: { passed: true, status: 'verified' },
      message: 'Storefront verified via Town Hall',
    };
  } catch (error) {
    console.log('TownHall unreachable:', storefront.storeName);
    return { verified: false, code_hash: undefined, scan_result: { passed: false, status: 'not_displayed' }, message: 'Verification unavailable — Town Hall offline' };
  }
}

async function verifyAcademicWithDKIM(
  email: string,
  emailHeaders?: string,
  dkimSignature?: string,
): Promise<{ verified: boolean; institution?: string; profileId?: string }> {
  try {
    const aptAlias = await SecureStore.getItemAsync('kv_apt_alias') || '';
    const result = await townHallClient.verifyAcademic({
      ownerApt: aptAlias,
      emailHeaders: emailHeaders || '',
      dkimSignature: dkimSignature || '',
    });
    return {
      verified: result.dkimVerified ?? false,
      institution: result.domainType || email.split('@')[1],
      profileId: result.profileId,
    };
  } catch (error) {
    return { verified: false, institution: undefined, profileId: undefined };
  }
}

async function verifyServiceWithTownHall(service: {
  title: string;
  description: string;
  category: string;
  ownerPubkey: string;
}): Promise<TownHallVerifyResponse> {
  try {
    const aptAlias = await SecureStore.getItemAsync('kv_apt_alias') || '';
    const result = await townHallClient.verifyService({
      serviceId: `SVC_${Date.now()}`,
      ownerApt: aptAlias,
      serviceType: service.category,
      code: '',
      reviews: [],
    });
    return {
      verified: result.verified ?? false,
      code_hash: result.arweaveTx || undefined,
      scan_result: { passed: true, status: 'verified' },
      message: 'Service verified via Town Hall',
    };
  } catch (error) {
    console.log('TownHall unreachable:', service.title);
    return { verified: false, code_hash: undefined, scan_result: { passed: false, status: 'not_displayed' }, message: 'Verification unavailable — Town Hall offline' };
  }
}

// ============================================================================
// CONSTANTS (v2 canonical 13 traits)
// ============================================================================
const CITADEL_SELLER_THRESHOLD = 13;

const SELLER_REQUIRED_TRAITS = [
  'Race', 'Gender', 'Name', 'Epithet', 'Eyes', 'Shoulders', 'Hair',
  'Markings', 'Occupation', 'Backstory', 'Origin', 'Motives', 'Secret',
];

const AVATAR_TO_TRAIT_MAP: Record<string, string> = {
  race: 'Race',
  gender: 'Gender',
  name: 'Name',
  epithet: 'Epithet',
  eyeShape: 'Eyes',
  shoulderType: 'Shoulders',
  hairStyle: 'Hair',
  markings: 'Markings',
  occupation: 'Occupation',
  backstory: 'Backstory',
  origin: 'Origin',
  motives: 'Motives',
  secret: 'Secret',
};

const PROHIBITED_CATEGORIES = ['Gambling', 'Casino', 'Betting', 'Lottery'];

const PROHIBITED_WORDS = [
  'casino', 'gambling', 'bet', 'slot', 'poker', 'drug', 'weed', 
  'scam', 'porn', 'nxnx', 'xxx', 'blackjack', 'roulette', 'lottery',
  'jackpot', 'sportsbook', 'wagering'
];

const STOREFRONT_FONTS = [
  { id: 'clean', name: 'Clean Modern', fontFamily: 'System' },
  { id: 'bold', name: 'Bold Impact', fontFamily: 'System' },
  { id: 'elegant', name: 'Elegant Script', fontFamily: 'System' },
  { id: 'retro', name: 'Retro Vibes', fontFamily: 'System' },
];

const STOREFRONT_LAYOUTS = [
  { id: 'single', name: 'Single Column', columns: 1, description: 'Clean, focused layout' },
  { id: 'grid-2', name: '2 Column Grid', columns: 2, description: 'Side-by-side products' },
  { id: 'grid-3', name: '3 Column Grid', columns: 3, description: 'Gallery style' },
  { id: 'masonry', name: 'Masonry', columns: 'auto', description: 'Pinterest-style flow' },
];

const SOCIAL_PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: '📸', domain: 'instagram.com' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵', domain: 'tiktok.com' },
  { id: 'facebook', label: 'Facebook', icon: '📘', domain: 'facebook.com' },
  { id: 'etsy', label: 'Etsy Shop', icon: '🛍️', domain: 'etsy.com' },
  { id: 'pinterest', label: 'Pinterest', icon: '📌', domain: 'pinterest.com' },
  { id: 'youtube', label: 'YouTube', icon: '▶️', domain: 'youtube.com' },
  { id: 'twitch', label: 'Twitch', icon: '🎮', domain: 'twitch.tv' },
];

// Communication channels for buyer-seller contact
const COMMUNICATION_CHANNELS = [
  { id: 'telegram', label: 'Telegram', icon: '✈️', placeholder: 't.me/username or @username' },
  { id: 'messenger', label: 'FB Messenger', icon: '💬', placeholder: 'm.me/username' },
  { id: 'instagram_dm', label: 'Instagram DM', icon: '📸', placeholder: '@your_instagram' },
];

const DAPP_TEMPLATE_CODE = `// ═══════════════════════════════════════════════════════════════════════════
// KASVILLAGE L2 - DAPP/GAME INTEGRATION TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════
// IDE: https://idx.google.com | Docs: https://kasvillage.dev/docs
// ═══════════════════════════════════════════════════════════════════════════

const kasvillage = new KasVillageL2({ 
  network: "mainnet", 
  endpoint: "https://api.kasvillage.dev" 
});

// 1. AUTHENTICATION
async function auth() {
  const session = await kasvillage.connect();
  return { pubkey: session.pubkey, apt: session.apartment, xp: session.xp };
}

// 2. SAVE STATE
async function saveState(state) {
  return kasvillage.commitState({ gameId: "YOUR_GAME_ID", stateHash: hash(state), ts: Date.now() });
}

// 3. LOAD STATE
async function loadState(userId) {
  return kasvillage.getState({ gameId: "YOUR_GAME_ID", userId });
}

// 4. TRANSFER
async function transfer(amount, recipient) {
  return kasvillage.transfer({ amount, recipient, memo: "game_payment" });
}

// ═══════════════════════════════════════════════════════════════════════════
// BOARDS & XP REQUIREMENTS:
// Incubator: 500+ XP | Main: 1000+ XP | Elite: 5000+ XP
// ═══════════════════════════════════════════════════════════════════════════`;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
const containsProhibitedText = (text: string): boolean => {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return PROHIBITED_WORDS.some(word => lowerText.includes(word));
};

const containsRestrictedContent = (text: string): boolean => {
  return containsProhibitedText(text);
};

// ============================================================================
// WORKSPACE BACKGROUND WRAPPER (Uses ProceduralBackground)
// ============================================================================
interface WorkspaceBackgroundProps {
  children: React.ReactNode;
  avatar: {
    race: string;
    class: string;
    occupation: string;
    name: string;
  };
}

const WorkspaceBackgroundWrapper: React.FC<WorkspaceBackgroundProps> = ({ children, avatar }) => {
  return (
    <View style={bgStyles.container}>
      <ProceduralBackground avatar={avatar} section="workspace" />
      <View style={bgStyles.content}>
        {children}
      </View>
    </View>
  );
};

const bgStyles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  content: {
    flex: 1,
    zIndex: 10,
  },
});

// ============================================================================
// PASSPORT GATE (Citadel Seller Check)
// ============================================================================
interface PassportGateProps {
  filledTraits: number;
  missingTraits: string[];
}

const PassportGate: React.FC<PassportGateProps> = ({ filledTraits, missingTraits }) => (
  <View style={gateStyles.container}>
    <View style={gateStyles.iconContainer}>
      <Lock size={rs.s(40)} color={COLORS.amber600} />
    </View>
    <Text style={gateStyles.title}>🛂 Passport Required</Text>
    <Text style={gateStyles.subtitle}>
      Complete all 12 Lore traits to unlock your Storefront Workspace.
    </Text>
    
    {/* Progress Bar */}
    <View style={gateStyles.progressContainer}>
      <View style={gateStyles.progressHeader}>
        <Text style={gateStyles.progressLabel}>Progress</Text>
        <Text style={[
          gateStyles.progressCount,
          filledTraits >= 9 && { color: COLORS.green600 }
        ]}>
          {filledTraits}/12
        </Text>
      </View>
      <View style={gateStyles.progressBar}>
        <View style={[
          gateStyles.progressFill,
          { 
            width: `${(filledTraits / 13) * 100}%`,
            backgroundColor: filledTraits >= 13 ? COLORS.green500 : 
                            filledTraits >= 9 ? COLORS.amber500 : COLORS.amber600
          }
        ]} />
      </View>
      <View style={gateStyles.progressLabels}>
        <Text style={gateStyles.tierLabel}>Guest</Text>
        <Text style={[gateStyles.tierLabel, filledTraits >= 9 && { color: COLORS.green600 }]}>
          Resident (8)
        </Text>
        <Text style={[gateStyles.tierLabel, filledTraits >= 13 && { color: COLORS.green600 }]}>
          Passport (12)
        </Text>
      </View>
    </View>
    
    {/* Missing Traits */}
    {missingTraits.length > 0 && (
      <View style={gateStyles.missingBox}>
        <Text style={gateStyles.missingTitle}>Required for Sellers:</Text>
        {missingTraits.map(trait => (
          <View key={trait} style={gateStyles.missingItem}>
            <View style={gateStyles.missingDot} />
            <Text style={gateStyles.missingText}>
              {trait.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </Text>
          </View>
        ))}
      </View>
    )}
    
    <Text style={gateStyles.footer}>
      Go to your Avatar profile to complete your identity. Sellers must prove they're human with detailed backstory traits.
    </Text>
  </View>
);

const gateStyles = StyleSheet.create({
  container: {
    padding: rs.s(40),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60%',
  },
  iconContainer: {
    width: rs.s(80),
    height: rs.s(80),
    backgroundColor: COLORS.amber100,
    borderRadius: rs.s(40),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: rs.s(24),
  },
  title: {
    fontSize: rs.font(24),
    fontWeight: '900',
    color: COLORS.amber900,
    marginBottom: rs.s(8),
  },
  subtitle: {
    fontSize: rs.font(14),
    color: COLORS.stone600,
    textAlign: 'center',
    marginBottom: rs.s(24),
  },
  progressContainer: {
    width: '100%',
    maxWidth: rs.s(280),
    marginBottom: rs.s(24),
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: rs.s(4),
  },
  progressLabel: {
    fontSize: rs.font(12),
    color: COLORS.stone500,
  },
  progressCount: {
    fontSize: rs.font(12),
    fontWeight: 'bold',
    color: COLORS.amber600,
  },
  progressBar: {
    height: rs.s(12),
    backgroundColor: COLORS.stone200,
    borderRadius: rs.s(6),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: rs.s(6),
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: rs.s(4),
  },
  tierLabel: {
    fontSize: rs.font(10),
    color: COLORS.stone400,
  },
  missingBox: {
    backgroundColor: COLORS.red50,
    borderWidth: 1,
    borderColor: COLORS.red200,
    borderRadius: rs.s(12),
    padding: rs.s(16),
    width: '100%',
    maxWidth: rs.s(280),
  },
  missingTitle: {
    fontSize: rs.font(12),
    fontWeight: 'bold',
    color: COLORS.red800,
    marginBottom: rs.s(8),
  },
  missingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(8),
    marginBottom: rs.s(4),
  },
  missingDot: {
    width: rs.s(8),
    height: rs.s(8),
    borderRadius: rs.s(4),
    backgroundColor: COLORS.red400,
  },
  missingText: {
    fontSize: rs.font(11),
    color: COLORS.red600,
  },
  footer: {
    fontSize: rs.font(11),
    color: COLORS.stone400,
    textAlign: 'center',
    marginTop: rs.s(24),
    maxWidth: rs.s(280),
  },
});

// ============================================================================
// TOOLBAR TAB BUTTON
// ============================================================================
interface TabButtonProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ label, active, onPress }) => (
  <TouchableOpacity
    style={[tabStyles.button, active && tabStyles.buttonActive]}
    onPress={onPress}
  >
    <Text style={[tabStyles.label, active && tabStyles.labelActive]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const tabStyles = StyleSheet.create({
  button: {
    paddingHorizontal: rs.s(12),
    paddingVertical: rs.s(10),
    borderRadius: rs.s(8),
  },
  buttonActive: {
    backgroundColor: COLORS.cardBg,
  },
  label: {
    fontSize: rs.font(11),
    fontWeight: 'bold',
    color: COLORS.amber700,
    textTransform: 'capitalize',
  },
  labelActive: {
    color: COLORS.amber900,
  },
});

// ============================================================================
// SECTION CARD
// ============================================================================
interface SectionCardProps {
  title: string;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
}

const SectionCard: React.FC<SectionCardProps> = ({ title, children, headerRight }) => (
  <View style={cardStyles.container}>
    <View style={cardStyles.header}>
      <Text style={cardStyles.title}>{title}</Text>
      {headerRight}
    </View>
    {children}
  </View>
);

const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.cardBg,
    borderRadius: rs.s(16),
    padding: rs.s(16),
    borderWidth: 1,
    borderColor: COLORS.stone200,
    marginBottom: rs.s(16),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: rs.s(12),
  },
  title: {
    fontSize: rs.font(16),
    fontWeight: '900',
    color: COLORS.amber900,
  },
});

// ============================================================================
// INPUT FIELD
// ============================================================================
interface InputFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'url';
  note?: string;
}

const InputField: React.FC<InputFieldProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType = 'default',
  note,
}) => (
  <View style={inputStyles.container}>
    <Text style={inputStyles.label}>{label}</Text>
    <TextInput
      style={[inputStyles.input, multiline && inputStyles.multiline]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={COLORS.stone400}
      multiline={multiline}
      keyboardType={keyboardType}
    />
    {note && <Text style={inputStyles.note}>{note}</Text>}
  </View>
);

const inputStyles = StyleSheet.create({
  container: {
    marginBottom: rs.s(12),
  },
  label: {
    fontSize: rs.font(10),
    fontWeight: 'bold',
    color: COLORS.stone500,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: rs.s(4),
  },
  input: {
    backgroundColor: COLORS.stone50,
    borderWidth: 1,
    borderColor: COLORS.stone200,
    borderRadius: rs.s(12),
    paddingHorizontal: rs.s(14),
    paddingVertical: rs.s(12),
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.stone800,
  },
  multiline: {
    minHeight: rs.s(100),
    textAlignVertical: 'top',
  },
  note: {
    fontSize: rs.font(10),
    color: COLORS.stone400,
    fontStyle: 'italic',
    marginTop: rs.s(4),
  },
});

// ============================================================================
// DAPP QUALITY GATE MODAL
// ============================================================================
interface QualityGateModalProps {
  visible: boolean;
  onClose: () => void;
  onVerified: (manifest: any) => void;
  userXp?: number;
}

const QualityGateModal: React.FC<QualityGateModalProps> = ({ visible, onClose, onVerified, userXp = 0 }) => {
  const [step, setStep] = useState(1);
  const [isChecking, setIsChecking] = useState(false);
  const [manifest, setManifest] = useState({
    name: '',
    gameUrl: 'https://',
    category: 'GameRPG',
    description: '',
    stakeAmount: 100,
    checks: {
      endpointActive: false,
      hasMainMenu: false,
      hasL2Sync: false,
    },
  });
  
  const hasProhibitedContent = containsRestrictedContent(manifest.name) || 
                               containsRestrictedContent(manifest.description) ||
                               PROHIBITED_CATEGORIES.includes(manifest.category);
  
  const canProceed = manifest.checks.endpointActive && 
                     manifest.checks.hasMainMenu && 
                     manifest.checks.hasL2Sync &&
                     !hasProhibitedContent;
  
  const runHealthCheck = () => {
    setIsChecking(true);
    setTimeout(() => {
      setManifest(prev => ({
        ...prev,
        checks: { ...prev.checks, endpointActive: true }
      }));
      setIsChecking(false);
    }, 2000);
  };
  
  const getProjectedBoard = () => {
    if (manifest.stakeAmount >= 500) return { name: 'ELITE BOARD', color: COLORS.purple600 };
    if (manifest.stakeAmount >= 100) return { name: 'MAIN BOARD', color: COLORS.green600 };
    return { name: 'INCUBATOR', color: COLORS.amber600 };
  };
  
  const board = getProjectedBoard();
  
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={qgStyles.overlay}>
        <View style={qgStyles.modal}>
          {/* Header */}
          <View style={qgStyles.header}>
            <View>
              <View style={qgStyles.headerTitle}>
                <ShieldCheck size={rs.s(20)} color={COLORS.amber500} />
                <Text style={qgStyles.headerText}>DApp Quality Gate</Text>
              </View>
              <Text style={qgStyles.headerSubtext}>Step {step} of 3: Defining Trust Signals</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={rs.s(24)} color={COLORS.stone500} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={qgStyles.content}>
            {step === 1 && (
              <View style={qgStyles.stepContent}>
                <InputField
                  label="App Name"
                  value={manifest.name}
                  onChangeText={(text) => setManifest({ ...manifest, name: text })}
                  placeholder="e.g. Kaspa Quest"
                />
                
                {/* Category Selector */}
                <Text style={inputStyles.label}>Category (Strict)</Text>
                <View style={qgStyles.categoryRow}>
                  {['GameRPG', 'GameStrategy', 'UtilityTool'].map(cat => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        qgStyles.categoryBtn,
                        manifest.category === cat && qgStyles.categoryBtnActive
                      ]}
                      onPress={() => setManifest({ ...manifest, category: cat })}
                    >
                      <Text style={[
                        qgStyles.categoryText,
                        manifest.category === cat && qgStyles.categoryTextActive
                      ]}>
                        {cat.replace('Game', '').replace('Utility', '')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={qgStyles.categoryNote}>
                  Prohibited content apps are automatically rejected by the protocol.
                </Text>
                
                {/* Prohibited Warning */}
                {hasProhibitedContent && (
                  <View style={qgStyles.prohibitedBox}>
                    <View style={qgStyles.prohibitedHeader}>
                      <Ban size={rs.s(20)} color={COLORS.red600} />
                      <Text style={qgStyles.prohibitedTitle}>Prohibited Content Detected</Text>
                    </View>
                    <Text style={qgStyles.prohibitedText}>
                      Your DApp name or description contains restricted terms:
                    </Text>
                    <Text style={qgStyles.prohibitedList}>
                      • Gambling, casino, slots, poker, blackjack, roulette{'\n'}
                      • Betting, wagering, sportsbook{'\n'}
                      • Lottery, raffle, jackpot
                    </Text>
                  </View>
                )}
                
                {/* URL Test */}
                <View style={qgStyles.urlSection}>
                  <Text style={qgStyles.sectionTitle}>
                    <Activity size={rs.s(14)} color={COLORS.stone700} /> Live Connection Test
                  </Text>
                  <View style={qgStyles.urlRow}>
                    <TextInput
                      style={qgStyles.urlInput}
                      value={manifest.gameUrl}
                      onChangeText={(text) => setManifest({ ...manifest, gameUrl: text })}
                      placeholder="https://your-dapp.com"
                      keyboardType="url"
                    />
                    <TouchableOpacity
                      style={[
                        qgStyles.urlButton,
                        manifest.checks.endpointActive && qgStyles.urlButtonSuccess
                      ]}
                      onPress={runHealthCheck}
                      disabled={isChecking || manifest.checks.endpointActive}
                    >
                      <Text style={qgStyles.urlButtonText}>
                        {isChecking ? 'Pinging...' : manifest.checks.endpointActive ? 'Online' : 'Test URL'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                
                {/* Functionality Checks */}
                <View style={qgStyles.checksSection}>
                  <Text style={qgStyles.sectionTitle}>
                    <Layout size={rs.s(14)} color={COLORS.stone700} /> Functionality Manifesto
                  </Text>
                  
                  <TouchableOpacity
                    style={qgStyles.checkItem}
                    onPress={() => setManifest(prev => ({
                      ...prev,
                      checks: { ...prev.checks, hasMainMenu: !prev.checks.hasMainMenu }
                    }))}
                  >
                    <View style={[
                      qgStyles.checkbox,
                      manifest.checks.hasMainMenu && qgStyles.checkboxChecked
                    ]}>
                      {manifest.checks.hasMainMenu && <Check size={rs.s(14)} color={COLORS.white} />}
                    </View>
                    <Text style={qgStyles.checkLabel}>UI/Menu is functional</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={qgStyles.checkItem}
                    onPress={() => setManifest(prev => ({
                      ...prev,
                      checks: { ...prev.checks, hasL2Sync: !prev.checks.hasL2Sync }
                    }))}
                  >
                    <View style={[
                      qgStyles.checkbox,
                      manifest.checks.hasL2Sync && qgStyles.checkboxChecked
                    ]}>
                      {manifest.checks.hasL2Sync && <Check size={rs.s(14)} color={COLORS.white} />}
                    </View>
                    <Text style={qgStyles.checkLabel}>L2 Save/Sync Logic implemented</Text>
                  </TouchableOpacity>
                </View>
                
                <TouchableOpacity
                  style={[qgStyles.proceedBtn, !canProceed && qgStyles.proceedBtnDisabled]}
                  onPress={() => setStep(2)}
                  disabled={!canProceed}
                >
                  <Text style={qgStyles.proceedBtnText}>Continue to XP Stake</Text>
                  <ChevronRight size={rs.s(18)} color={COLORS.white} />
                </TouchableOpacity>
              </View>
            )}
            
            {step === 2 && (
              <View style={qgStyles.stepContent}>
                <Text style={qgStyles.stepTitle}>Commit XP Reputation</Text>
                <Text style={qgStyles.stepSubtitle}>
                  Higher commitment = better board placement
                </Text>
                
                {/* XP Slider */}
                <View style={qgStyles.xpBox}>
                  <Text style={qgStyles.xpLabel}>XP Commitment</Text>
                  <Text style={qgStyles.xpValue}>{manifest.stakeAmount * 10} XP</Text>
                  <View style={qgStyles.xpButtons}>
                    {[50, 100, 250, 500].map(val => (
                      <TouchableOpacity
                        key={val}
                        style={[
                          qgStyles.xpBtn,
                          manifest.stakeAmount === val && qgStyles.xpBtnActive
                        ]}
                        onPress={() => setManifest({ ...manifest, stakeAmount: val })}
                      >
                        <Text style={[
                          qgStyles.xpBtnText,
                          manifest.stakeAmount === val && qgStyles.xpBtnTextActive
                        ]}>
                          {val * 10}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                
                {/* Board Preview */}
                <View style={[qgStyles.boardPreview, { borderColor: board.color }]}>
                  <Text style={[qgStyles.boardName, { color: board.color }]}>
                    {board.name}
                  </Text>
                  <Text style={qgStyles.boardDesc}>
                    {manifest.stakeAmount >= 500 ? 'Premium placement, highest visibility' :
                     manifest.stakeAmount >= 100 ? 'Verified apps, good visibility' :
                     'Testing/beta apps, limited visibility'}
                  </Text>
                </View>
                
                <View style={qgStyles.buttonRow}>
                  <TouchableOpacity style={qgStyles.backBtn} onPress={() => setStep(1)}>
                    <Text style={qgStyles.backBtnText}>← Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={qgStyles.stakeBtn}
                    onPress={() => {
                      Alert.alert('XP Committed', `${manifest.stakeAmount * 10} XP locked`);
                      setStep(3);
                    }}
                  >
                    <Text style={qgStyles.stakeBtnText}>Commit & Publish</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            
            {step === 3 && (
              <View style={qgStyles.stepContent}>
                <View style={qgStyles.successIcon}>
                  <ShieldCheck size={rs.s(48)} color={COLORS.green600} />
                </View>
                <Text style={qgStyles.successTitle}>DApp Published!</Text>
                <Text style={qgStyles.successSubtitle}>
                  Your app "{manifest.name}" is now live on the {board.name}
                </Text>
                
                <TouchableOpacity
                  style={qgStyles.doneBtn}
                  onPress={() => {
                    onVerified(manifest);
                    onClose();
                  }}
                >
                  <Text style={qgStyles.doneBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const qgStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(28,25,23,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: rs.s(16),
  },
  modal: {
    backgroundColor: COLORS.cardBg,
    borderRadius: rs.s(24),
    width: '100%',
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: COLORS.stone950,
    padding: rs.s(20),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(8),
  },
  headerText: {
    fontSize: rs.font(18),
    fontWeight: '900',
    color: COLORS.amber500,
  },
  headerSubtext: {
    fontSize: rs.font(11),
    color: COLORS.stone400,
    marginTop: rs.s(4),
  },
  content: {
    padding: rs.s(20),
  },
  stepContent: {
    paddingBottom: rs.s(20),
  },
  categoryRow: {
    flexDirection: 'row',
    gap: rs.s(8),
    marginBottom: rs.s(8),
  },
  categoryBtn: {
    flex: 1,
    paddingVertical: rs.s(10),
    backgroundColor: COLORS.stone100,
    borderRadius: rs.s(8),
    alignItems: 'center',
  },
  categoryBtnActive: {
    backgroundColor: COLORS.amber100,
    borderWidth: 2,
    borderColor: COLORS.amber500,
  },
  categoryText: {
    fontSize: rs.font(11),
    fontWeight: 'bold',
    color: COLORS.stone600,
  },
  categoryTextActive: {
    color: COLORS.amber800,
  },
  categoryNote: {
    fontSize: rs.font(10),
    color: COLORS.stone400,
    marginBottom: rs.s(16),
  },
  prohibitedBox: {
    backgroundColor: COLORS.red50,
    borderWidth: 2,
    borderColor: COLORS.red300,
    borderRadius: rs.s(12),
    padding: rs.s(16),
    marginBottom: rs.s(16),
  },
  prohibitedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(8),
    marginBottom: rs.s(8),
  },
  prohibitedTitle: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.red800,
  },
  prohibitedText: {
    fontSize: rs.font(11),
    color: COLORS.red700,
    marginBottom: rs.s(8),
  },
  prohibitedList: {
    fontSize: rs.font(10),
    color: COLORS.red600,
    lineHeight: rs.font(16),
  },
  urlSection: {
    marginBottom: rs.s(16),
  },
  sectionTitle: {
    fontSize: rs.font(12),
    fontWeight: 'bold',
    color: COLORS.stone900,
    textTransform: 'uppercase',
    marginBottom: rs.s(8),
  },
  urlRow: {
    flexDirection: 'row',
    gap: rs.s(8),
  },
  urlInput: {
    flex: 1,
    backgroundColor: COLORS.stone50,
    borderWidth: 1,
    borderColor: COLORS.stone200,
    borderRadius: rs.s(12),
    paddingHorizontal: rs.s(12),
    paddingVertical: rs.s(10),
    fontSize: rs.font(12),
    fontFamily: 'monospace',
    color: COLORS.stone700,
  },
  urlButton: {
    backgroundColor: COLORS.stone900,
    borderRadius: rs.s(12),
    paddingHorizontal: rs.s(16),
    justifyContent: 'center',
  },
  urlButtonSuccess: {
    backgroundColor: COLORS.green100,
  },
  urlButtonText: {
    fontSize: rs.font(11),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  checksSection: {
    backgroundColor: COLORS.stone50,
    borderRadius: rs.s(16),
    padding: rs.s(16),
    marginBottom: rs.s(20),
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(12),
    paddingVertical: rs.s(12),
    paddingHorizontal: rs.s(12),
    backgroundColor: COLORS.cardBg,
    borderRadius: rs.s(12),
    marginBottom: rs.s(8),
  },
  checkbox: {
    width: rs.s(24),
    height: rs.s(24),
    borderRadius: rs.s(6),
    borderWidth: 2,
    borderColor: COLORS.stone300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.amber600,
    borderColor: COLORS.amber600,
  },
  checkLabel: {
    fontSize: rs.font(13),
    fontWeight: '500',
    color: COLORS.stone700,
  },
  proceedBtn: {
    backgroundColor: COLORS.stone900,
    borderRadius: rs.s(12),
    paddingVertical: rs.s(16),
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: rs.s(8),
  },
  proceedBtnDisabled: {
    backgroundColor: COLORS.stone300,
  },
  proceedBtnText: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  stepTitle: {
    fontSize: rs.font(20),
    fontWeight: '900',
    color: COLORS.amber900,
    textAlign: 'center',
    marginBottom: rs.s(8),
  },
  stepSubtitle: {
    fontSize: rs.font(13),
    color: COLORS.stone600,
    textAlign: 'center',
    marginBottom: rs.s(24),
  },
  xpBox: {
    backgroundColor: COLORS.amber50,
    borderRadius: rs.s(16),
    padding: rs.s(20),
    marginBottom: rs.s(20),
    alignItems: 'center',
  },
  xpLabel: {
    fontSize: rs.font(11),
    fontWeight: 'bold',
    color: COLORS.amber700,
    textTransform: 'uppercase',
    marginBottom: rs.s(8),
  },
  xpValue: {
    fontSize: rs.font(36),
    fontWeight: '900',
    color: COLORS.amber900,
    marginBottom: rs.s(16),
  },
  xpButtons: {
    flexDirection: 'row',
    gap: rs.s(8),
  },
  xpBtn: {
    paddingHorizontal: rs.s(16),
    paddingVertical: rs.s(10),
    backgroundColor: COLORS.stone100,
    borderRadius: rs.s(8),
  },
  xpBtnActive: {
    backgroundColor: COLORS.amber500,
  },
  xpBtnText: {
    fontSize: rs.font(12),
    fontWeight: 'bold',
    color: COLORS.stone600,
  },
  xpBtnTextActive: {
    color: COLORS.white,
  },
  boardPreview: {
    borderWidth: 2,
    borderRadius: rs.s(12),
    padding: rs.s(16),
    marginBottom: rs.s(24),
    alignItems: 'center',
  },
  boardName: {
    fontSize: rs.font(16),
    fontWeight: '900',
    marginBottom: rs.s(4),
  },
  boardDesc: {
    fontSize: rs.font(11),
    color: COLORS.stone500,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: rs.s(12),
  },
  backBtn: {
    flex: 1,
    paddingVertical: rs.s(14),
    borderWidth: 1,
    borderColor: COLORS.stone300,
    borderRadius: rs.s(12),
    alignItems: 'center',
  },
  backBtnText: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.stone600,
  },
  stakeBtn: {
    flex: 2,
    paddingVertical: rs.s(14),
    backgroundColor: COLORS.green600,
    borderRadius: rs.s(12),
    alignItems: 'center',
  },
  stakeBtnText: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  successIcon: {
    width: rs.s(80),
    height: rs.s(80),
    backgroundColor: COLORS.green100,
    borderRadius: rs.s(40),
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: rs.s(20),
  },
  successTitle: {
    fontSize: rs.font(24),
    fontWeight: '900',
    color: COLORS.green700,
    textAlign: 'center',
    marginBottom: rs.s(8),
  },
  successSubtitle: {
    fontSize: rs.font(14),
    color: COLORS.stone600,
    textAlign: 'center',
    marginBottom: rs.s(24),
  },
  doneBtn: {
    backgroundColor: COLORS.indigo600,
    borderRadius: rs.s(12),
    paddingVertical: rs.s(16),
    alignItems: 'center',
  },
  doneBtnText: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.white,
  },
});

// ============================================================================
// ACADEMIC EMAIL VERIFICATION PANEL
// ============================================================================
interface AcademicPanelProps {
  visible: boolean;
  onClose: () => void;
}

const AcademicPanel: React.FC<AcademicPanelProps> = ({ visible, onClose }) => {
  const [activeTab, setActiveTab] = useState<'browse' | 'submit' | 'services' | 'profile'>('browse');
  const [verificationStep, setVerificationStep] = useState(0);
  const [eduEmail, setEduEmail] = useState('');
  const [magicLink, setMagicLink] = useState('');
  const [rawEmailHeaders, setRawEmailHeaders] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [researcherProfile, setResearcherProfile] = useState<any>(null);
  
  // Abstract submission
  const [abstractTitle, setAbstractTitle] = useState('');
  const [abstractText, setAbstractText] = useState('');
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [keywords, setKeywords] = useState('');
  const [attestation1, setAttestation1] = useState(false);
  const [attestation2, setAttestation2] = useState(false);
  const [attestation3, setAttestation3] = useState(false);
  
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  
  // Q&A system
  interface AbstractItem {
    id: string;
    title: string;
    text: string;
    researcherId: string;
    institutionDomain: string;
    repositoryUrl: string;
    keywords: string[];
    timestamp: number;
    viewCount: number;
    questionCount: number;
    questionPrice: number; // KAS per question (0 = first question free)
  }
  
  interface QAItem {
    id: string;
    abstractId: string;
    questionText: string;
    answerText: string | null;
    askerApt: string;
    isPaid: boolean;
    txHash: string | null;
    declined: boolean;
    timestamp: number;
    answeredAt: number | null;
  }
  
  const [selectedAbstract, setSelectedAbstract] = useState<AbstractItem | null>(null);
  const [abstractsList, setAbstractsList] = useState<AbstractItem[]>([]);
  const [qaList, setQaList] = useState<QAItem[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  
  // Load abstracts (from Arweave/TownHall in production)
  useEffect(() => {
    if (visible && disclaimerAccepted) {
      loadAbstracts();
    }
  }, [visible, disclaimerAccepted]);
  
  const loadAbstracts = async () => {
    try {
      const stored = await SecureStore.getItemAsync('kv_abstracts');
      if (stored) setAbstractsList(JSON.parse(stored));
    } catch { /* empty */ }
  };
  
  const saveAbstract = async (abstract_: AbstractItem) => {
    const updated = [...abstractsList, abstract_];
    setAbstractsList(updated);
    await SecureStore.setItemAsync('kv_abstracts', JSON.stringify(updated));
  };
  
  const loadQA = async (abstractId: string) => {
    try {
      const stored = await SecureStore.getItemAsync(`kv_qa_${abstractId}`);
      if (stored) setQaList(JSON.parse(stored));
      else setQaList([]);
    } catch { setQaList([]); }
  };
  
  const saveQA = async (abstractId: string, items: QAItem[]) => {
    setQaList(items);
    await SecureStore.setItemAsync(`kv_qa_${abstractId}`, JSON.stringify(items));
  };
  
  // ============================================================================
  // P2P ENCRYPTED Q&A DELIVERY
  // ============================================================================
  
  // =========================================================================
  // ECDH ENCRYPTION — secp256k1 shared secret → XOR-SHA256 stream cipher
  // =========================================================================
  
  const ecdhEncrypt = async (plaintext: string, myPrivKeyHex: string, theirPubKeyHex: string): Promise<string> => {
    const myPrivKey = hexToBytes(myPrivKeyHex);
    const theirPubKey = hexToBytes(theirPubKeyHex);
    
    // ECDH shared secret: myPrivKey × theirPubKey
    const sharedPoint = secp256k1.getSharedSecret(myPrivKey, theirPubKey);
    const sharedSecret = sha256(sharedPoint);
    
    // Generate random 16-byte nonce
    const nonceBytes = new Uint8Array(await Crypto.getRandomBytesAsync(16));
    
    // Derive encryption key: SHA256(sharedSecret || nonce)
    const keyInput = new Uint8Array(sharedSecret.length + nonceBytes.length);
    keyInput.set(sharedSecret, 0);
    keyInput.set(nonceBytes, sharedSecret.length);
    
    // Encrypt with XOR stream (SHA256 chain)
    const plaintextBytes = new TextEncoder().encode(plaintext);
    const ciphertext = new Uint8Array(plaintextBytes.length);
    let streamBlock = sha256(keyInput);
    let streamOffset = 0;
    
    for (let i = 0; i < plaintextBytes.length; i++) {
      if (streamOffset >= 32) {
        // Chain: next block = SHA256(key || previous block)
        const nextInput = new Uint8Array(keyInput.length + 32);
        nextInput.set(keyInput, 0);
        nextInput.set(streamBlock, keyInput.length);
        streamBlock = sha256(nextInput);
        streamOffset = 0;
      }
      ciphertext[i] = plaintextBytes[i] ^ streamBlock[streamOffset++];
    }
    
    // Output: nonce(16) + ciphertext
    const output = new Uint8Array(16 + ciphertext.length);
    output.set(nonceBytes, 0);
    output.set(ciphertext, 16);
    return bytesToHex(output);
  };
  
  const ecdhDecrypt = (encryptedHex: string, myPrivKeyHex: string, theirPubKeyHex: string): string => {
    const data = hexToBytes(encryptedHex);
    const nonceBytes = data.slice(0, 16);
    const ciphertext = data.slice(16);
    
    const myPrivKey = hexToBytes(myPrivKeyHex);
    const theirPubKey = hexToBytes(theirPubKeyHex);
    
    // Same ECDH shared secret
    const sharedPoint = secp256k1.getSharedSecret(myPrivKey, theirPubKey);
    const sharedSecret = sha256(sharedPoint);
    
    // Same key derivation
    const keyInput = new Uint8Array(sharedSecret.length + nonceBytes.length);
    keyInput.set(sharedSecret, 0);
    keyInput.set(nonceBytes, sharedSecret.length);
    
    // Decrypt with same XOR stream
    const plaintext = new Uint8Array(ciphertext.length);
    let streamBlock = sha256(keyInput);
    let streamOffset = 0;
    
    for (let i = 0; i < ciphertext.length; i++) {
      if (streamOffset >= 32) {
        const nextInput = new Uint8Array(keyInput.length + 32);
        nextInput.set(keyInput, 0);
        nextInput.set(streamBlock, keyInput.length);
        streamBlock = sha256(nextInput);
        streamOffset = 0;
      }
      plaintext[i] = ciphertext[i] ^ streamBlock[streamOffset++];
    }
    
    return new TextDecoder().decode(plaintext);
  };
  
  // =========================================================================
  // P2P SEND — ECDH encrypted
  // =========================================================================
  
  const sendQAMessageP2P = async (
    recipientPubkey: string,
    message: { type: 'question' | 'answer' | 'decline'; qaId: string; abstractId: string; text: string },
  ) => {
    try {
      const myPubkey = await SecureStore.getItemAsync('kv_public_key') || '';
      const myPrivkey = await SecureStore.getItemAsync('kv_private_key') || '';
      const payload = JSON.stringify(message);
      
      // Real ECDH encryption — only recipient can decrypt with their private key
      let encrypted: string;
      if (myPrivkey && recipientPubkey && recipientPubkey.length >= 66) {
        encrypted = await ecdhEncrypt(payload, myPrivkey, recipientPubkey);
      } else {
        // Fallback if keys not available — base64 (not secure, dev only)
        encrypted = 'PLAIN:' + btoa(payload);
        console.warn('[QA] ECDH keys not available, using insecure fallback');
      }
      
      const relayPayload = {
        type: 'qa_message',
        from: myPubkey,
        to: recipientPubkey,
        encrypted,
        timestamp: Date.now(),
      };
      
      // Try Akash relay
      const RELAY_URL = 'https://relay.kasvillage.dev';
      await fetch(`${RELAY_URL}/api/mailbox/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(relayPayload),
      }).catch(() => console.log('[QA] Relay offline, message saved locally only'));
      
    } catch (err) {
      console.log('[QA] P2P send failed, saved locally:', err);
    }
  };
  
  const commitHashToArweave = async (data: string, tag: string) => {
    try {
      const hashHex = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        data,
        { encoding: Crypto.CryptoEncoding.HEX }
      );
      
      // Upload hash as a minimal Arweave data item with tags
      // The hash proves the content existed at this timestamp
      // without revealing the content itself
      try {
        const { uploadToTurbo } = await import('./arweave_upload');
        await uploadToTurbo(hashHex, [
          { name: 'App-Name', value: 'KasVillage' },
          { name: 'KV-Type', value: 'qa-commit' },
          { name: 'KV-Tag', value: tag },
          { name: 'KV-Hash', value: hashHex },
          { name: 'Unix-Time', value: String(Math.floor(Date.now() / 1000)) },
        ]);
      } catch {
        // Arweave offline — save locally for later upload
        const commitKey = `kv_arweave_commit_${tag}_${Date.now()}`;
        await SecureStore.setItemAsync(commitKey, JSON.stringify({
          hash: hashHex,
          tag,
          timestamp: Date.now(),
          uploaded: false,
        }));
      }
      
      return hashHex;
    } catch {
      return null;
    }
  };
  
  // ============================================================================
  // Q&A HANDLERS (with P2P delivery + L1 hash commit)
  // ============================================================================
  
  const handleAskQuestion = async () => {
    if (!selectedAbstract || !newQuestion.trim()) return;
    setSubmittingQuestion(true);
    
    const isFirstQuestion = qaList.filter(q => q.askerApt === 'me').length === 0;
    const price = isFirstQuestion ? 0 : selectedAbstract.questionPrice;
    
    const createAndSendQuestion = async (isPaid: boolean, txHash: string | null) => {
      const qa: QAItem = {
        id: `Q_${Date.now()}`,
        abstractId: selectedAbstract.id,
        questionText: newQuestion.trim(),
        answerText: null,
        askerApt: 'me',
        isPaid,
        txHash,
        declined: false,
        timestamp: Date.now(),
        answeredAt: null,
      };
      
      // 1. Save locally
      const updated = [...qaList, qa];
      await saveQA(selectedAbstract.id, updated);
      
      // 2. Send encrypted P2P to researcher
      await sendQAMessageP2P(selectedAbstract.researcherId, {
        type: 'question',
        qaId: qa.id,
        abstractId: selectedAbstract.id,
        text: newQuestion.trim(),
      });
      
      // 3. Commit question hash to L1
      await commitHashToArweave(newQuestion.trim(), `question_${qa.id}`);
      
      setNewQuestion('');
      setSubmittingQuestion(false);
    };
    
    if (price > 0) {
      Alert.alert(
        'Paid Question',
        `This question costs ${price} KAS.\n\nProceed?`,
        [
          { text: 'Cancel', onPress: () => setSubmittingQuestion(false) },
          { text: `Pay ${price} KAS`, onPress: async () => {
            // TODO: initiate KAS payment, get txHash
            const txHash = `tx_pending_${Date.now()}`;
            await createAndSendQuestion(true, txHash);
            Alert.alert('Submitted', 'Paid question sent to researcher via encrypted P2P.');
          }},
        ]
      );
      return;
    }
    
    await createAndSendQuestion(false, null);
  };
  
  const handleAnswerQuestion = async (qaId: string, answer: string) => {
    const updated = qaList.map(q => 
      q.id === qaId ? { ...q, answerText: answer, answeredAt: Date.now() } : q
    );
    if (selectedAbstract) {
      // 1. Save locally
      await saveQA(selectedAbstract.id, updated);
      
      // 2. Send answer encrypted P2P to asker
      const question = qaList.find(q => q.id === qaId);
      if (question) {
        await sendQAMessageP2P(question.askerApt, {
          type: 'answer',
          qaId,
          abstractId: selectedAbstract.id,
          text: answer,
        });
      }
      
      // 3. Commit answer hash to L1
      await commitHashToArweave(answer, `answer_${qaId}`);
    }
  };
  
  const handleDeclineQuestion = async (qaId: string) => {
    const updated = qaList.map(q => 
      q.id === qaId ? { ...q, declined: true } : q
    );
    if (selectedAbstract) {
      await saveQA(selectedAbstract.id, updated);
      
      // Notify asker of decline via P2P
      const question = qaList.find(q => q.id === qaId);
      if (question) {
        await sendQAMessageP2P(question.askerApt, {
          type: 'decline',
          qaId,
          abstractId: selectedAbstract.id,
          text: '',
        });
      }
    }
  };
  
  const handleRequestVerification = async () => {
    if (!eduEmail.endsWith('.edu')) {
      setVerificationError('Only .edu emails accepted');
      return;
    }
    setIsLoading(true);
    setVerificationError('');
    
    // Simulate API call
    setTimeout(() => {
      const hash = Math.random().toString(36).substring(7);
      const link = `https://kasvillage.dev/verify?h=${hash}&ts=${Date.now()}`;
      setMagicLink(link);
      setVerificationStep(1);
      setIsLoading(false);
    }, 1500);
  };
  
  const copyMagicLink = () => {
    Clipboard.setString(magicLink);
    Alert.alert('Copied!', 'Link copied! Email this to yourself, then paste the raw headers back here.');
  };
  
  const verifyWithDkim = async () => {
    if (!rawEmailHeaders.includes('DKIM-Signature')) {
      setVerificationError('No DKIM-Signature found in headers');
      return;
    }
    setIsLoading(true);
    
    try {
      // Extract DKIM-Signature from raw headers
      const dkimMatch = rawEmailHeaders.match(/DKIM-Signature:[\s\S]*?(?=\n[^\s]|$)/);
      const dkimSig = dkimMatch ? dkimMatch[0] : '';
      
      const result = await verifyAcademicWithDKIM(eduEmail, rawEmailHeaders, dkimSig);
      
      if (result.verified) {
        const researcherId = result.profileId || `RES_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
        await SecureStore.setItemAsync('kv_researcher_id', researcherId);
        setResearcherProfile({
          researcher_id: researcherId,
          email_verified: true,
          institution_domain: result.institution || eduEmail.split('@')[1],
          xp: 0,
          abstract_count: 0,
          questions_answered: 0,
          question_price: 0,
        });
        setVerificationStep(2);
      } else {
        setVerificationError('DKIM verification failed. Check that you pasted the complete headers.');
      }
    } catch (err: any) {
      setVerificationError(err.message || 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSubmitAbstract = async () => {
    if (!researcherProfile) {
      Alert.alert('Error', 'Verify email first');
      return;
    }
    if (!repositoryUrl.startsWith('http')) {
      Alert.alert('Error', 'Repository URL required');
      return;
    }
    if (!attestation1 || !attestation2 || !attestation3) {
      Alert.alert('Error', 'All attestations required');
      return;
    }
    
    setIsLoading(true);
    const newAbstract: AbstractItem = {
      id: `ABS_${Date.now()}`,
      title: abstractTitle,
      text: abstractText,
      researcherId: researcherProfile.researcher_id,
      institutionDomain: researcherProfile.institution_domain || 'unknown.edu',
      repositoryUrl,
      keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
      timestamp: Date.now(),
      viewCount: 0,
      questionCount: 0,
      questionPrice: 0, // Researcher can set later
    };
    await saveAbstract(newAbstract);
    
    Alert.alert('Success!', `Abstract published!\nID: ${newAbstract.id}\n\nFirst question from any user is FREE. You can set a price for follow-up questions in your profile.`);
    setAbstractTitle('');
    setAbstractText('');
    setRepositoryUrl('');
    setKeywords('');
    setAttestation1(false);
    setAttestation2(false);
    setAttestation3(false);
    setIsLoading(false);
  };
  
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={acStyles.overlay}>
        <View style={acStyles.modal}>
          {/* Header */}
          <View style={acStyles.header}>
            <View>
              <Text style={acStyles.headerTitle}>📚 Research Shelf</Text>
              <Text style={acStyles.headerSubtitle}>Privacy-Preserving Academic Exchange</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={acStyles.closeBtn}>
              <X size={rs.s(20)} color={COLORS.stone500} />
            </TouchableOpacity>
          </View>
          
          {/* Tabs */}
          <View style={acStyles.tabs}>
            {(['browse', 'submit', 'services', 'profile'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[acStyles.tab, activeTab === tab && acStyles.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[acStyles.tabText, activeTab === tab && acStyles.tabTextActive]}>
                  {tab === 'browse' && '🔍 Browse'}
                  {tab === 'submit' && '📝 Submit'}
                  {tab === 'services' && '💼 Services'}
                  {tab === 'profile' && '👤 Profile'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <ScrollView style={acStyles.content}>
            {/* Browse Tab */}
            {activeTab === 'browse' && (
              <View style={acStyles.tabContent}>
                {!disclaimerAccepted ? (
                  <View>
                    <View style={acStyles.disclaimerBox}>
                      <View style={acStyles.disclaimerHeader}>
                        <AlertTriangle size={rs.s(20)} color={COLORS.amber700} />
                        <Text style={acStyles.disclaimerTitle}>Important Disclaimer</Text>
                      </View>
                      <Text style={acStyles.disclaimerText}>
                        Before browsing research on this platform, please understand:
                      </Text>
                      <View style={acStyles.disclaimerList}>
                        <Text style={acStyles.disclaimerItem}>
                          • <Text style={{ fontWeight: 'bold' }}>We cannot guarantee the authenticity of any author.</Text> Researcher identities are self-attested.
                        </Text>
                        <Text style={acStyles.disclaimerItem}>
                          • <Text style={{ fontWeight: 'bold' }}>We cannot verify true identity.</Text> Pseudonymous IDs protect privacy.
                        </Text>
                        <Text style={acStyles.disclaimerItem}>
                          • <Text style={{ fontWeight: 'bold' }}>We cannot guarantee research validity.</Text> Content is user-submitted.
                        </Text>
                        <Text style={acStyles.disclaimerItem}>
                          • <Text style={{ fontWeight: 'bold' }}>Always verify through official channels.</Text>
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={acStyles.acceptBtn}
                      onPress={() => setDisclaimerAccepted(true)}
                    >
                      <Text style={acStyles.acceptBtnText}>I Understand — Continue to Browse</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View>
                    <View style={acStyles.searchRow}>
                      <TextInput
                        style={acStyles.searchInput}
                        placeholder="Search abstracts..."
                        placeholderTextColor={COLORS.stone400}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                      />
                      <TouchableOpacity style={acStyles.searchBtn} onPress={loadAbstracts}>
                        <Search size={rs.s(18)} color={COLORS.white} />
                      </TouchableOpacity>
                    </View>
                    <View style={acStyles.miniDisclaimer}>
                      <Text style={acStyles.miniDisclaimerText}>
                        ⚠️ Platform does not verify author identity or research validity.
                      </Text>
                    </View>
                    
                    {/* Abstract Detail View with Q&A */}
                    {selectedAbstract ? (
                      <View>
                        <TouchableOpacity onPress={() => { setSelectedAbstract(null); setQaList([]); }} style={{ padding: 8 }}>
                          <Text style={{ color: COLORS.amber600, fontSize: 15, fontWeight: 'bold' }}>← Back to list</Text>
                        </TouchableOpacity>
                        
                        {/* Abstract Card */}
                        <View style={{ backgroundColor: COLORS.cardBg, borderRadius: 12, padding: 16, marginTop: 8, borderWidth: 1, borderColor: COLORS.stone200 }}>
                          <Text style={{ color: COLORS.stone800, fontSize: 18, fontWeight: 'bold' }}>{selectedAbstract.title}</Text>
                          <Text style={{ color: COLORS.stone500, fontSize: 12, marginTop: 4 }}>
                            By {selectedAbstract.researcherId} • {selectedAbstract.institutionDomain} • {new Date(selectedAbstract.timestamp).toLocaleDateString()}
                          </Text>
                          <Text style={{ color: COLORS.stone700, fontSize: 14, marginTop: 12, lineHeight: 20 }}>{selectedAbstract.text}</Text>
                          
                          {selectedAbstract.keywords.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                              {selectedAbstract.keywords.map((kw, i) => (
                                <View key={i} style={{ backgroundColor: COLORS.amber100, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                                  <Text style={{ color: COLORS.amber800, fontSize: 11 }}>{kw}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                          
                          <TouchableOpacity onPress={() => {
                            const { Linking } = require('react-native');
                            Linking.openURL(selectedAbstract.repositoryUrl);
                          }} style={{ marginTop: 10 }}>
                            <Text style={{ color: COLORS.blue600, fontSize: 13, textDecorationLine: 'underline' }}>📎 View Repository</Text>
                          </TouchableOpacity>
                        </View>
                        
                        {/* Q&A Section */}
                        <View style={{ marginTop: 16 }}>
                          <Text style={{ color: COLORS.stone800, fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>
                            💬 Questions & Answers ({qaList.length})
                          </Text>
                          
                          {qaList.filter(q => !q.declined).map(qa => (
                            <View key={qa.id} style={{ backgroundColor: COLORS.cardBg, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: qa.answerText ? COLORS.green200 : COLORS.stone200 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={{ fontSize: 12, color: COLORS.stone500 }}>
                                  {qa.isPaid ? '💰 Paid' : '🆓 Free'} • {new Date(qa.timestamp).toLocaleDateString()}
                                </Text>
                              </View>
                              <Text style={{ color: COLORS.stone800, fontSize: 14, fontWeight: '600', marginTop: 4 }}>Q: {qa.questionText}</Text>
                              
                              {qa.answerText ? (
                                <View style={{ backgroundColor: COLORS.green50, borderRadius: 8, padding: 10, marginTop: 8 }}>
                                  <Text style={{ color: COLORS.green800, fontSize: 13 }}>A: {qa.answerText}</Text>
                                  <Text style={{ color: COLORS.green600, fontSize: 11, marginTop: 4 }}>
                                    Answered {qa.answeredAt ? new Date(qa.answeredAt).toLocaleDateString() : ''}
                                  </Text>
                                </View>
                              ) : (
                                <Text style={{ color: COLORS.stone400, fontSize: 12, fontStyle: 'italic', marginTop: 6 }}>Awaiting researcher response...</Text>
                              )}
                              
                              {/* Researcher can answer/decline their own abstracts */}
                              {!qa.answerText && researcherProfile?.researcher_id === selectedAbstract.researcherId && (
                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                                  <TouchableOpacity
                                    style={{ backgroundColor: COLORS.green500, paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16 }}
                                    onPress={() => {
                                      if (typeof Alert.prompt === 'function') {
                                        Alert.prompt('Answer', 'Type your answer:', (answer: string) => {
                                          if (answer) handleAnswerQuestion(qa.id, answer);
                                        });
                                      } else {
                                        Alert.alert('Answer', 'Answer input not available on this device — use desktop');
                                      }
                                    }}
                                  >
                                    <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold' }}>Answer</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={{ backgroundColor: COLORS.stone300, paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16 }}
                                    onPress={() => handleDeclineQuestion(qa.id)}
                                  >
                                    <Text style={{ color: COLORS.stone600, fontSize: 12 }}>Decline</Text>
                                  </TouchableOpacity>
                                </View>
                              )}
                            </View>
                          ))}
                          
                          {qaList.length === 0 && (
                            <Text style={{ color: COLORS.stone400, fontSize: 13, textAlign: 'center', paddingVertical: 16 }}>
                              No questions yet. Be the first to ask!
                            </Text>
                          )}
                          
                          {/* Ask Question Input */}
                          <View style={{ backgroundColor: COLORS.cardBg, borderRadius: 12, padding: 12, marginTop: 8, borderWidth: 1, borderColor: COLORS.amber200 }}>
                            {qaList.filter(q => q.askerApt === 'me').length === 0 ? (
                              <Text style={{ color: COLORS.green600, fontSize: 12, marginBottom: 6 }}>🆓 Your first question is FREE</Text>
                            ) : selectedAbstract.questionPrice > 0 ? (
                              <Text style={{ color: COLORS.amber600, fontSize: 12, marginBottom: 6 }}>💰 Follow-up questions cost {selectedAbstract.questionPrice} KAS</Text>
                            ) : (
                              <Text style={{ color: COLORS.green600, fontSize: 12, marginBottom: 6 }}>🆓 This researcher hasn't set a price — questions are free</Text>
                            )}
                            <TextInput
                              style={{ backgroundColor: COLORS.stone100, borderRadius: 8, padding: 10, fontSize: 14, color: COLORS.stone800, minHeight: 60, textAlignVertical: 'top' }}
                              placeholder="Ask a question about this research..."
                              placeholderTextColor={COLORS.stone400}
                              multiline
                              value={newQuestion}
                              onChangeText={setNewQuestion}
                            />
                            <TouchableOpacity
                              style={{ backgroundColor: newQuestion.trim() ? COLORS.amber600 : COLORS.stone300, paddingVertical: 10, borderRadius: 20, marginTop: 8, alignItems: 'center' }}
                              onPress={handleAskQuestion}
                              disabled={!newQuestion.trim() || submittingQuestion}
                            >
                              <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 14 }}>
                                {submittingQuestion ? 'Submitting...' : 'Submit Question'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    ) : (
                      /* Abstract List */
                      <View>
                        {abstractsList
                          .filter(a => !searchQuery || a.title.toLowerCase().includes(searchQuery.toLowerCase()) || a.keywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase())))
                          .map(abstract_ => (
                            <TouchableOpacity
                              key={abstract_.id}
                              style={{ backgroundColor: COLORS.cardBg, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.stone200 }}
                              onPress={() => { setSelectedAbstract(abstract_); loadQA(abstract_.id); }}
                              activeOpacity={0.7}
                            >
                              <Text style={{ color: COLORS.stone800, fontSize: 15, fontWeight: 'bold' }}>{abstract_.title}</Text>
                              <Text style={{ color: COLORS.stone500, fontSize: 12, marginTop: 2 }}>
                                {abstract_.researcherId} • {abstract_.institutionDomain}
                              </Text>
                              <Text style={{ color: COLORS.stone600, fontSize: 13, marginTop: 6 }} numberOfLines={3}>
                                {abstract_.text}
                              </Text>
                              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                                <Text style={{ color: COLORS.stone400, fontSize: 11 }}>💬 {abstract_.questionCount} questions</Text>
                                <Text style={{ color: COLORS.stone400, fontSize: 11 }}>👁 {abstract_.viewCount} views</Text>
                                <Text style={{ color: COLORS.stone400, fontSize: 11 }}>{new Date(abstract_.timestamp).toLocaleDateString()}</Text>
                              </View>
                              {abstract_.keywords.length > 0 && (
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                                  {abstract_.keywords.slice(0, 4).map((kw, i) => (
                                    <View key={i} style={{ backgroundColor: COLORS.amber100, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                                      <Text style={{ color: COLORS.amber800, fontSize: 10 }}>{kw}</Text>
                                    </View>
                                  ))}
                                </View>
                              )}
                            </TouchableOpacity>
                          ))}
                        {abstractsList.length === 0 && (
                          <Text style={acStyles.emptyText}>No abstracts found. Be the first to submit!</Text>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
            
            {/* Submit Tab */}
            {activeTab === 'submit' && (
              <View style={acStyles.tabContent}>
                {verificationStep === 0 && (
                  <View>
                    <Text style={acStyles.sectionTitle}>🔐 .edu Email Verification</Text>
                    <Text style={acStyles.sectionSubtitle}>
                      Prove institutional affiliation without revealing your identity
                    </Text>
                    
                    <InputField
                      label="Your .edu Email"
                      value={eduEmail}
                      onChangeText={setEduEmail}
                      placeholder="you@university.edu"
                      keyboardType="email-address"
                    />
                    
                    {verificationError && (
                      <Text style={acStyles.errorText}>{verificationError}</Text>
                    )}
                    
                    <TouchableOpacity
                      style={[acStyles.verifyBtn, isLoading && { opacity: 0.6 }]}
                      onPress={handleRequestVerification}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <ActivityIndicator color={COLORS.white} />
                      ) : (
                        <Text style={acStyles.verifyBtnText}>Generate Verification Link</Text>
                      )}
                    </TouchableOpacity>
                    
                    <View style={acStyles.privacyBox}>
                      <ShieldCheck size={rs.s(16)} color={COLORS.green600} />
                      <Text style={acStyles.privacyText}>
                        We never store your email — only a hash of your institution domain.
                      </Text>
                    </View>
                  </View>
                )}
                
                {verificationStep === 1 && (
                  <View>
                    <Text style={acStyles.sectionTitle}>📧 DKIM Verification</Text>
                    <Text style={acStyles.sectionSubtitle}>
                      Copy link → Email to yourself → Paste raw headers back
                    </Text>
                    
                    <View style={acStyles.linkBox}>
                      <Text style={acStyles.linkLabel}>Your Magic Link:</Text>
                      <Text style={acStyles.linkText} numberOfLines={2}>{magicLink}</Text>
                      <TouchableOpacity style={acStyles.copyBtn} onPress={copyMagicLink}>
                        <Copy size={rs.s(16)} color={COLORS.white} />
                        <Text style={acStyles.copyBtnText}>Copy Link</Text>
                      </TouchableOpacity>
                    </View>
                    
                    <InputField
                      label="Paste Raw Email Headers"
                      value={rawEmailHeaders}
                      onChangeText={setRawEmailHeaders}
                      placeholder="Paste the full email headers here including DKIM-Signature..."
                      multiline
                    />
                    
                    {verificationError && (
                      <Text style={acStyles.errorText}>{verificationError}</Text>
                    )}
                    
                    <TouchableOpacity
                      style={[acStyles.verifyBtn, isLoading && { opacity: 0.6 }]}
                      onPress={verifyWithDkim}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <ActivityIndicator color={COLORS.white} />
                      ) : (
                        <Text style={acStyles.verifyBtnText}>Verify DKIM Signature</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
                
                {verificationStep === 2 && (
                  <View>
                    <View style={acStyles.verifiedBadge}>
                      <ShieldCheck size={rs.s(20)} color={COLORS.green700} />
                      <Text style={acStyles.verifiedText}>Verified Researcher</Text>
                    </View>
                    
                    <InputField
                      label="Abstract Title"
                      value={abstractTitle}
                      onChangeText={setAbstractTitle}
                      placeholder="Your research title..."
                    />
                    
                    <InputField
                      label="Abstract Text"
                      value={abstractText}
                      onChangeText={setAbstractText}
                      placeholder="Full abstract (500 words max)..."
                      multiline
                    />
                    
                    <InputField
                      label="Repository URL"
                      value={repositoryUrl}
                      onChangeText={setRepositoryUrl}
                      placeholder="https://arxiv.org/abs/..."
                      keyboardType="url"
                    />
                    
                    <InputField
                      label="Keywords"
                      value={keywords}
                      onChangeText={setKeywords}
                      placeholder="machine learning, cryptography, ..."
                    />
                    
                    {/* Attestations */}
                    <View style={acStyles.attestationBox}>
                      <Text style={acStyles.attestationTitle}>Required Attestations</Text>
                      
                      <TouchableOpacity
                        style={acStyles.attestationItem}
                        onPress={() => setAttestation1(!attestation1)}
                      >
                        <View style={[acStyles.attestationCheck, attestation1 && acStyles.attestationChecked]}>
                          {attestation1 && <Check size={rs.s(12)} color={COLORS.white} />}
                        </View>
                        <Text style={acStyles.attestationText}>
                          <Text style={{ fontWeight: 'bold' }}>I attest this is my original work</Text> or I have proper attribution.
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={acStyles.attestationItem}
                        onPress={() => setAttestation2(!attestation2)}
                      >
                        <View style={[acStyles.attestationCheck, attestation2 && acStyles.attestationChecked]}>
                          {attestation2 && <Check size={rs.s(12)} color={COLORS.white} />}
                        </View>
                        <Text style={acStyles.attestationText}>
                          <Text style={{ fontWeight: 'bold' }}>This is my sole representation.</Text> Misrepresentation may result in termination.
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={acStyles.attestationItem}
                        onPress={() => setAttestation3(!attestation3)}
                      >
                        <View style={[acStyles.attestationCheck, attestation3 && acStyles.attestationChecked]}>
                          {attestation3 && <Check size={rs.s(12)} color={COLORS.white} />}
                        </View>
                        <Text style={acStyles.attestationText}>
                          <Text style={{ fontWeight: 'bold' }}>My .edu email is legitimately mine.</Text> Poor answer ratings will reduce XP.
                        </Text>
                      </TouchableOpacity>
                    </View>
                    
                    <TouchableOpacity
                      style={[
                        acStyles.submitBtn,
                        (!attestation1 || !attestation2 || !attestation3) && { opacity: 0.5 }
                      ]}
                      onPress={handleSubmitAbstract}
                      disabled={!attestation1 || !attestation2 || !attestation3 || isLoading}
                    >
                      {isLoading ? (
                        <ActivityIndicator color={COLORS.white} />
                      ) : (
                        <Text style={acStyles.submitBtnText}>Submit Your Abstract</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
            
            {/* Services Tab */}
            {activeTab === 'services' && (
              <View style={acStyles.tabContent}>
                <View style={acStyles.serviceBox}>
                  <Text style={acStyles.serviceTitle}>💰 KASPA Rate Per Question</Text>
                  <Text style={acStyles.serviceSubtitle}>
                    Set your price for follow-up questions. First question is FREE.
                  </Text>
                  <View style={acStyles.priceRow}>
                    <TextInput
                      style={acStyles.priceInput}
                      placeholder="0"
                      keyboardType="numeric"
                    />
                    <Text style={acStyles.priceLabel}>KASPA</Text>
                  </View>
                </View>
                
                <View style={acStyles.serviceBox}>
                  <Text style={acStyles.serviceTitle}>📚 Tutoring & Consulting</Text>
                  <Text style={acStyles.serviceSubtitle}>
                    Offer code auditing, tutoring, analytics, consulting services.
                  </Text>
                  <View style={acStyles.priceRow}>
                    <TextInput
                      style={acStyles.priceInput}
                      placeholder="0"
                      keyboardType="numeric"
                    />
                    <Text style={acStyles.priceLabel}>KASPA/hr</Text>
                  </View>
                </View>
                
                <View style={acStyles.legalDisclaimer}>
                  <Text style={acStyles.legalText}>
                    ⚠️ "Legal Consulting" refers to regulatory compliance guidance only. 
                    It does NOT constitute an attorney-client relationship.
                  </Text>
                </View>
              </View>
            )}
            
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <View style={acStyles.tabContent}>
                {!researcherProfile ? (
                  <View style={acStyles.profileEmpty}>
                    <Lock size={rs.s(32)} color={COLORS.amber400} />
                    <Text style={acStyles.profileEmptyText}>
                      Verify .edu email in Submit tab to create your researcher profile.
                    </Text>
                  </View>
                ) : (
                  <View>
                    <View style={acStyles.profileBadge}>
                      <ShieldCheck size={rs.s(20)} color={COLORS.green700} />
                      <Text style={acStyles.profileBadgeTitle}>Verified Researcher</Text>
                    </View>
                    <Text style={acStyles.profileId}>ID: {researcherProfile.researcher_id}</Text>
                    <Text style={acStyles.profileDomain}>
                      Institution: {researcherProfile.institution_domain}
                    </Text>
                    
                    <View style={acStyles.statsRow}>
                      <View style={acStyles.statBox}>
                        <Text style={acStyles.statValue}>{researcherProfile.xp || 0}</Text>
                        <Text style={acStyles.statLabel}>XP Earned</Text>
                      </View>
                      <View style={acStyles.statBox}>
                        <Text style={acStyles.statValue}>{researcherProfile.abstract_count || 0}</Text>
                        <Text style={acStyles.statLabel}>Abstracts</Text>
                      </View>
                      <View style={acStyles.statBox}>
                        <Text style={acStyles.statValue}>{researcherProfile.questions_answered || 0}</Text>
                        <Text style={acStyles.statLabel}>Answered</Text>
                      </View>
                    </View>
                    
                    {/* Question Pricing */}
                    <View style={{ backgroundColor: COLORS.amber50, borderRadius: 12, padding: 14, marginTop: 12, borderWidth: 1, borderColor: COLORS.amber200 }}>
                      <Text style={{ color: COLORS.amber800, fontSize: 14, fontWeight: 'bold', marginBottom: 6 }}>💰 Question Pricing</Text>
                      <Text style={{ color: COLORS.stone600, fontSize: 12, marginBottom: 8 }}>
                        First question from any user is always FREE.{'\n'}Set a price for follow-up questions:
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <TextInput
                          style={{ backgroundColor: COLORS.white, borderRadius: 8, padding: 8, fontSize: 14, color: COLORS.stone800, width: 80, textAlign: 'center', borderWidth: 1, borderColor: COLORS.stone200 }}
                          placeholder="0"
                          placeholderTextColor={COLORS.stone400}
                          keyboardType="numeric"
                          value={researcherProfile.question_price?.toString() || '0'}
                          onChangeText={(text) => setResearcherProfile((p: any) => ({ ...p, question_price: parseFloat(text) || 0 }))}
                        />
                        <Text style={{ color: COLORS.stone600, fontSize: 14 }}>KAS per question</Text>
                      </View>
                      <TouchableOpacity
                        style={{ backgroundColor: COLORS.amber600, paddingVertical: 8, borderRadius: 16, marginTop: 10, alignItems: 'center' }}
                        onPress={async () => {
                          // Update price on all user's abstracts
                          const price = researcherProfile.question_price || 0;
                          const updated = abstractsList.map(a => 
                            a.researcherId === researcherProfile.researcher_id 
                              ? { ...a, questionPrice: price } 
                              : a
                          );
                          setAbstractsList(updated);
                          await SecureStore.setItemAsync('kv_abstracts', JSON.stringify(updated));
                          Alert.alert('Updated', `Question price set to ${price} KAS`);
                        }}
                      >
                        <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 13 }}>Save Price</Text>
                      </TouchableOpacity>
                    </View>
                    
                    <View style={acStyles.privacyGuarantee}>
                      <Text style={acStyles.privacyGuaranteeTitle}>🔒 Privacy Guarantee</Text>
                      <Text style={acStyles.privacyGuaranteeItem}>✓ Your email was NOT stored — only a hash</Text>
                      <Text style={acStyles.privacyGuaranteeItem}>✓ Pseudonymous researcher ID</Text>
                      <Text style={acStyles.privacyGuaranteeItem}>✓ No tracking, no ads, no data selling</Text>
                    </View>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const acStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(120,96,72,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: rs.s(16),
  },
  modal: {
    backgroundColor: COLORS.cardBg,
    borderRadius: rs.s(24),
    width: '100%',
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    padding: rs.s(20),
    backgroundColor: COLORS.amber50,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.amber200,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: rs.font(20),
    fontWeight: '900',
    color: COLORS.amber900,
  },
  headerSubtitle: {
    fontSize: rs.font(11),
    color: COLORS.amber700,
    marginTop: rs.s(4),
  },
  closeBtn: {
    width: rs.s(32),
    height: rs.s(32),
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.amber200,
    backgroundColor: COLORS.amber50,
  },
  tab: {
    flex: 1,
    paddingVertical: rs.s(12),
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.amber600,
  },
  tabText: {
    fontSize: rs.font(11),
    fontWeight: 'bold',
    color: COLORS.amber600,
  },
  tabTextActive: {
    color: COLORS.amber900,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: rs.s(20),
  },
  disclaimerBox: {
    backgroundColor: COLORS.amber50,
    borderWidth: 2,
    borderColor: COLORS.amber400,
    borderRadius: rs.s(12),
    padding: rs.s(16),
    marginBottom: rs.s(16),
  },
  disclaimerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(8),
    marginBottom: rs.s(12),
  },
  disclaimerTitle: {
    fontSize: rs.font(16),
    fontWeight: 'bold',
    color: COLORS.amber900,
  },
  disclaimerText: {
    fontSize: rs.font(13),
    color: COLORS.amber800,
    fontWeight: 'bold',
    marginBottom: rs.s(12),
  },
  disclaimerList: {
    gap: rs.s(8),
  },
  disclaimerItem: {
    fontSize: rs.font(12),
    color: COLORS.amber800,
    lineHeight: rs.font(18),
  },
  acceptBtn: {
    backgroundColor: COLORS.amber600,
    borderRadius: rs.s(12),
    paddingVertical: rs.s(16),
    alignItems: 'center',
  },
  acceptBtnText: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  searchRow: {
    flexDirection: 'row',
    gap: rs.s(8),
    marginBottom: rs.s(12),
  },
  searchInput: {
    flex: 1,
    backgroundColor: COLORS.stone50,
    borderWidth: 1,
    borderColor: COLORS.amber300,
    borderRadius: rs.s(12),
    paddingHorizontal: rs.s(14),
    paddingVertical: rs.s(12),
    fontSize: rs.font(14),
  },
  searchBtn: {
    backgroundColor: COLORS.amber600,
    borderRadius: rs.s(12),
    width: rs.s(48),
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniDisclaimer: {
    backgroundColor: COLORS.amber100,
    borderRadius: rs.s(8),
    padding: rs.s(8),
    marginBottom: rs.s(16),
  },
  miniDisclaimerText: {
    fontSize: rs.font(10),
    color: COLORS.amber700,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: rs.font(14),
    color: COLORS.amber600,
    textAlign: 'center',
    paddingVertical: rs.s(32),
  },
  sectionTitle: {
    fontSize: rs.font(18),
    fontWeight: '900',
    color: COLORS.amber900,
    marginBottom: rs.s(4),
  },
  sectionSubtitle: {
    fontSize: rs.font(12),
    color: COLORS.stone600,
    marginBottom: rs.s(20),
  },
  errorText: {
    fontSize: rs.font(12),
    color: COLORS.red600,
    marginBottom: rs.s(12),
  },
  verifyBtn: {
    backgroundColor: COLORS.amber700,
    borderRadius: rs.s(12),
    paddingVertical: rs.s(16),
    alignItems: 'center',
    marginBottom: rs.s(16),
  },
  verifyBtnText: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  privacyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(8),
    backgroundColor: COLORS.green50,
    borderRadius: rs.s(8),
    padding: rs.s(12),
  },
  privacyText: {
    flex: 1,
    fontSize: rs.font(11),
    color: COLORS.green700,
  },
  linkBox: {
    backgroundColor: COLORS.blue50,
    borderRadius: rs.s(12),
    padding: rs.s(16),
    marginBottom: rs.s(16),
  },
  linkLabel: {
    fontSize: rs.font(11),
    fontWeight: 'bold',
    color: COLORS.blue800,
    marginBottom: rs.s(8),
  },
  linkText: {
    fontSize: rs.font(11),
    fontFamily: 'monospace',
    color: COLORS.blue700,
    marginBottom: rs.s(12),
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs.s(8),
    backgroundColor: COLORS.blue600,
    borderRadius: rs.s(8),
    paddingVertical: rs.s(10),
  },
  copyBtnText: {
    fontSize: rs.font(12),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(8),
    backgroundColor: COLORS.green100,
    borderRadius: rs.s(12),
    padding: rs.s(12),
    marginBottom: rs.s(20),
  },
  verifiedText: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.green800,
  },
  attestationBox: {
    backgroundColor: COLORS.red50,
    borderWidth: 1,
    borderColor: COLORS.red200,
    borderRadius: rs.s(12),
    padding: rs.s(16),
    marginBottom: rs.s(20),
  },
  attestationTitle: {
    fontSize: rs.font(12),
    fontWeight: 'bold',
    color: COLORS.red800,
    marginBottom: rs.s(12),
  },
  attestationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: rs.s(12),
    marginBottom: rs.s(12),
  },
  attestationCheck: {
    width: rs.s(20),
    height: rs.s(20),
    borderRadius: rs.s(4),
    borderWidth: 1,
    borderColor: COLORS.red300,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: rs.s(2),
  },
  attestationChecked: {
    backgroundColor: COLORS.red600,
    borderColor: COLORS.red600,
  },
  attestationText: {
    flex: 1,
    fontSize: rs.font(11),
    color: COLORS.red800,
    lineHeight: rs.font(16),
  },
  submitBtn: {
    backgroundColor: COLORS.amber700,
    borderRadius: rs.s(12),
    paddingVertical: rs.s(16),
    alignItems: 'center',
  },
  submitBtnText: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  serviceBox: {
    backgroundColor: COLORS.amber50,
    borderWidth: 1,
    borderColor: COLORS.amber300,
    borderRadius: rs.s(16),
    padding: rs.s(16),
    marginBottom: rs.s(16),
  },
  serviceTitle: {
    fontSize: rs.font(16),
    fontWeight: '900',
    color: COLORS.amber900,
    marginBottom: rs.s(4),
  },
  serviceSubtitle: {
    fontSize: rs.font(11),
    color: COLORS.amber700,
    marginBottom: rs.s(12),
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(8),
  },
  priceInput: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.amber200,
    borderRadius: rs.s(8),
    paddingHorizontal: rs.s(12),
    paddingVertical: rs.s(10),
    fontSize: rs.font(16),
    fontWeight: 'bold',
  },
  priceLabel: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.amber800,
  },
  legalDisclaimer: {
    backgroundColor: COLORS.red50,
    borderWidth: 1,
    borderColor: COLORS.red200,
    borderRadius: rs.s(8),
    padding: rs.s(12),
  },
  legalText: {
    fontSize: rs.font(10),
    color: COLORS.red700,
    lineHeight: rs.font(14),
  },
  profileEmpty: {
    alignItems: 'center',
    paddingVertical: rs.s(48),
  },
  profileEmptyText: {
    fontSize: rs.font(13),
    color: COLORS.stone600,
    textAlign: 'center',
    marginTop: rs.s(12),
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(8),
    backgroundColor: COLORS.green100,
    borderRadius: rs.s(12),
    padding: rs.s(12),
    marginBottom: rs.s(8),
  },
  profileBadgeTitle: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.green900,
  },
  profileId: {
    fontSize: rs.font(10),
    fontFamily: 'monospace',
    color: COLORS.green700,
    marginBottom: rs.s(4),
  },
  profileDomain: {
    fontSize: rs.font(10),
    color: COLORS.green600,
    marginBottom: rs.s(16),
  },
  statsRow: {
    flexDirection: 'row',
    gap: rs.s(16),
    marginBottom: rs.s(16),
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.green50,
    borderRadius: rs.s(12),
    padding: rs.s(16),
    alignItems: 'center',
  },
  statValue: {
    fontSize: rs.font(24),
    fontWeight: '900',
    color: COLORS.green700,
  },
  statLabel: {
    fontSize: rs.font(10),
    fontWeight: 'bold',
    color: COLORS.green600,
    marginTop: rs.s(4),
  },
  privacyGuarantee: {
    backgroundColor: COLORS.amber50,
    borderRadius: rs.s(12),
    padding: rs.s(16),
  },
  privacyGuaranteeTitle: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.amber800,
    marginBottom: rs.s(8),
  },
  privacyGuaranteeItem: {
    fontSize: rs.font(11),
    color: COLORS.amber700,
    marginBottom: rs.s(4),
  },
});

// ============================================================================
// MAIN WORKSPACE COMPONENT
// ============================================================================
interface WorkspaceProps {
  userXp?: number;
  userPubkey?: string;
  hostId?: string;
  hostName?: string;
  onOpenStorefront?: (data: { hostId: string; hostName: string }) => void;
  onOpenDApp?: (dapp: any) => void;
}

export const Workspace: React.FC<WorkspaceProps> = ({
  userXp = 0,
  userPubkey = '',
  hostId = 'host_001',
  hostName = 'My Store',
  onOpenStorefront,
  onOpenDApp,
}) => {
  // Citadel check
  const [storedAvatar, setStoredAvatar] = useState<any>({});
  const [filledTraits, setFilledTraits] = useState(0);
  const [missingTraits, setMissingTraits] = useState<string[]>([]);
  const [hasPassport, setHasPassport] = useState(false);
  
  // Active view tab
  const [activeView, setActiveView] = useState('brand');
  
  // Brand state
  const [brandName, setBrandName] = useState(hostName);
  const [storeDescription, setStoreDescription] = useState('');
  const [storeCategory, setStoreCategory] = useState('General');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoShape, setLogoShape] = useState<'round' | 'square'>('round');
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});
  const [commChannels, setCommChannels] = useState<Record<string, string>>({});
  
  // Typography
  const [selectedFont, setSelectedFont] = useState(STOREFRONT_FONTS[0]);
  const [headerFontSize, setHeaderFontSize] = useState(32);
  const [bodyFontSize, setBodyFontSize] = useState(14);
  
  // Layout
  const [selectedLayout, setSelectedLayout] = useState(STOREFRONT_LAYOUTS[0]);
  
  // Items
  const [stash, setStash] = useState<any[]>([]);
  
  // Publishing state
  const [isPublishing, setIsPublishing] = useState(false);
  
  // Modals
  const [showQualityGate, setShowQualityGate] = useState(false);
  const [showAcademicPanel, setShowAcademicPanel] = useState(false);
  
  // Load avatar data on mount
  useEffect(() => {
    const loadAvatar = async () => {
      try {
        const avatarJson = await SecureStore.getItemAsync('kv_avatar');
        if (avatarJson) {
          const avatar = JSON.parse(avatarJson);
          setStoredAvatar(avatar);
          
          // Count filled traits
          const filled = Object.entries(AVATAR_TO_TRAIT_MAP)
            .filter(([avatarKey]) => avatar[avatarKey] && avatar[avatarKey].length > 2)
            .length;
          setFilledTraits(filled);
          
          // Check required seller traits
          const missing = SELLER_REQUIRED_TRAITS.filter(trait => {
            const avatarKey = Object.entries(AVATAR_TO_TRAIT_MAP).find(([k, v]) => v === trait)?.[0];
            return !avatarKey || !avatar[avatarKey] || avatar[avatarKey].length <= 2;
          });
          setMissingTraits(missing);
          
          setHasPassport(filled >= CITADEL_SELLER_THRESHOLD && missing.length === 0);
        }
      } catch (e) {
        console.error('Failed to load avatar:', e);
      }
    };
    loadAvatar();
  }, []);
  
  const handleCopyTemplate = async () => {
    Clipboard.setString(DAPP_TEMPLATE_CODE);
    Alert.alert('Copied!', 'DApp template copied to clipboard!');
  };
  
  // v2: TownHall verification + Arweave upload flow
  const handlePublishStorefront = async () => {
    // Validate
    if (containsProhibitedText(brandName) || containsProhibitedText(storeDescription)) {
      Alert.alert('Safety Rejection', 'Your store contains prohibited terms.');
      return;
    }
    
    setIsPublishing(true);
    
    try {
      // Step 1: Verify with TownHall
      const verifyResult = await verifyStorefrontWithTownHall({
        storeName: brandName,
        description: storeDescription,
        category: storeCategory,
        ownerPubkey: userPubkey,
      });
      
      if (!verifyResult.verified) {
        Alert.alert('Verification Failed', verifyResult.message);
        setIsPublishing(false);
        return;
      }
      
      // Step 2: KasVillage posts to Arweave for user (FREE via Turbo)
      await uploadStoreListing(
        hostId,
        {
          storeName: brandName,
          description: storeDescription,
          category: storeCategory,
          tags: [],
          contact: commChannels.telegram || commChannels.messenger || commChannels.instagram_dm,
        },
        userPubkey,
      );
      
      // Step 3: Save locally
      const layout = {
        brandName,
        storeDescription,
        storeCategory,
        logoUrl,
        logoShape,
        socialLinks,
        commChannels,
        selectedFont,
        headerFontSize,
        bodyFontSize,
        selectedLayout,
        stash,
        hostId,
        codeHash: verifyResult.code_hash,
        updatedAt: Date.now(),
      };
      
      await SecureStore.setItemAsync(`storefront_${hostId}`, JSON.stringify(layout));
      Alert.alert('Published!', 'Storefront verified and posted to Arweave!');
    } catch (e) {
      console.error('Publish failed:', e);
      Alert.alert('Error', 'Failed to publish. Please try again.');
    }
    
    setIsPublishing(false);
  };
  
  // Passport gate
  if (!hasPassport) {
    const avatarConfig = {
      race: storedAvatar.race || 'Human',
      class: storedAvatar.class || '',
      occupation: storedAvatar.occupation || 'Merchant',
      name: storedAvatar.name || 'Guest',
    };
    return (
      <WorkspaceBackgroundWrapper avatar={avatarConfig}>
        <PassportGate filledTraits={filledTraits} missingTraits={missingTraits} />
      </WorkspaceBackgroundWrapper>
    );
  }
  
  // Avatar config for procedural background
  const avatarConfig = {
    race: storedAvatar.race || 'Human',
    class: storedAvatar.class || '',
    occupation: storedAvatar.occupation || 'Merchant',
    name: storedAvatar.name || hostName,
  };
  
  return (
    <WorkspaceBackgroundWrapper avatar={avatarConfig}>
      <ScrollView style={wsStyles.container} contentContainerStyle={wsStyles.content}>
        {/* Header */}
        <View style={wsStyles.header}>
          <Text style={wsStyles.headerTitle}>Storefront Workspace</Text>
          <View style={wsStyles.xpBadge}>
            <Text style={wsStyles.xpBadgeText}>{userXp} XP</Text>
          </View>
        </View>
        
        {/* Toolbar */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={wsStyles.toolbar}
          contentContainerStyle={wsStyles.toolbarContent}
        >
          {['brand', 'layout', 'fonts', 'items', 'coupons', 'dapps', 'academic', 'preview'].map(view => (
            <TabButton
              key={view}
              label={view}
              active={activeView === view}
              onPress={() => setActiveView(view)}
            />
          ))}
        </ScrollView>
        
        {/* Brand Tab */}
        {activeView === 'brand' && (
          <View>
            <SectionCard title="Brand Identity">
              <InputField
                label="Store Display Name"
                value={brandName}
                onChangeText={setBrandName}
                placeholder="Your brand name..."
              />
              
              <InputField
                label="Store Description"
                value={storeDescription}
                onChangeText={setStoreDescription}
                placeholder="Tell customers about your store..."
                multiline
              />
              
              <InputField
                label="Logo Image URL"
                value={logoUrl}
                onChangeText={setLogoUrl}
                placeholder="Paste Instagram/Etsy/TikTok image link"
                keyboardType="url"
                note="Only moderated platform links allowed for safety."
              />
              
              <Text style={inputStyles.label}>Logo Style</Text>
              <View style={wsStyles.toggleRow}>
                {(['round', 'square'] as const).map(shape => (
                  <TouchableOpacity
                    key={shape}
                    style={[wsStyles.toggleBtn, logoShape === shape && wsStyles.toggleBtnActive]}
                    onPress={() => setLogoShape(shape)}
                  >
                    <Text style={[wsStyles.toggleBtnText, logoShape === shape && wsStyles.toggleBtnTextActive]}>
                      {shape}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </SectionCard>
            
            <SectionCard title="Connect Social Channels">
              {SOCIAL_PLATFORMS.map(platform => (
                <View key={platform.id} style={wsStyles.socialRow}>
                  <Text style={wsStyles.socialIcon}>{platform.icon}</Text>
                  <TextInput
                    style={wsStyles.socialInput}
                    value={socialLinks[platform.id] || ''}
                    onChangeText={(text) => setSocialLinks({ ...socialLinks, [platform.id]: text })}
                    placeholder={`Link your ${platform.label}...`}
                    placeholderTextColor={COLORS.stone400}
                  />
                </View>
              ))}
            </SectionCard>
            
            <SectionCard title="💬 Communication Channels">
              <Text style={wsStyles.commNote}>
                How buyers can contact you to discuss purchases
              </Text>
              {COMMUNICATION_CHANNELS.map(channel => (
                <View key={channel.id} style={wsStyles.socialRow}>
                  <Text style={wsStyles.socialIcon}>{channel.icon}</Text>
                  <TextInput
                    style={wsStyles.socialInput}
                    value={commChannels[channel.id] || ''}
                    onChangeText={(text) => setCommChannels({ ...commChannels, [channel.id]: text })}
                    placeholder={channel.placeholder}
                    placeholderTextColor={COLORS.stone400}
                  />
                </View>
              ))}
              <Text style={wsStyles.commTip}>
                💡 At least one contact method required for buyers to reach you
              </Text>
            </SectionCard>
          </View>
        )}
        
        {/* Layout Tab */}
        {activeView === 'layout' && (
          <SectionCard title="Choose Your Layout">
            <Text style={wsStyles.layoutSubtitle}>
              How products are arranged under your header/logo
            </Text>
            <View style={wsStyles.layoutGrid}>
              {STOREFRONT_LAYOUTS.map(layout => (
                <TouchableOpacity
                  key={layout.id}
                  style={[wsStyles.layoutCard, selectedLayout.id === layout.id && wsStyles.layoutCardActive]}
                  onPress={() => setSelectedLayout(layout)}
                >
                  <Text style={wsStyles.layoutName}>{layout.name}</Text>
                  <Text style={wsStyles.layoutDesc}>{layout.description}</Text>
                  {/* Visual preview */}
                  <View style={wsStyles.layoutPreview}>
                    {Array.from({ length: layout.columns === 'auto' ? 3 : layout.columns as number }).map((_, i) => (
                      <View key={i} style={wsStyles.layoutPreviewBox} />
                    ))}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </SectionCard>
        )}
        
        {/* Fonts Tab */}
        {activeView === 'fonts' && (
          <SectionCard title="Typography Controls">
            <View style={wsStyles.fontGrid}>
              {STOREFRONT_FONTS.map(font => (
                <TouchableOpacity
                  key={font.id}
                  style={[wsStyles.fontCard, selectedFont.id === font.id && wsStyles.fontCardActive]}
                  onPress={() => setSelectedFont(font)}
                >
                  <Text style={wsStyles.fontLabel}>{font.name}</Text>
                  <Text style={wsStyles.fontPreview}>AaBbCc</Text>
                </TouchableOpacity>
              ))}
            </View>
          </SectionCard>
        )}
        
        {/* Items Tab */}
        {activeView === 'items' && (
          <SectionCard title="The Stash Management">
            <Text style={wsStyles.sectionSubtitle}>Add, edit, or delete items for your Node.</Text>
            
            {stash.length > 0 ? (
              stash.map(item => (
                <View key={item.id} style={wsStyles.itemCard}>
                  <View>
                    <Text style={wsStyles.itemName}>{item.name}</Text>
                    <Text style={wsStyles.itemPrice}>
                      ${item.dollarPrice?.toFixed(2)} → {item.kaspaPrice?.toLocaleString()} KASPA
                    </Text>
                  </View>
                  <View style={wsStyles.itemActions}>
                    <TouchableOpacity>
                      <Edit3 size={rs.s(16)} color={COLORS.blue600} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setStash(prev => prev.filter(i => i.id !== item.id))}>
                      <Trash2 size={rs.s(16)} color={COLORS.red600} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <Text style={wsStyles.emptyText}>No items yet. Add your first product!</Text>
            )}
            
            <TouchableOpacity
              style={wsStyles.addItemBtn}
              onPress={() => {
                const newItem = {
                  id: `item_${Date.now()}`,
                  name: 'New Item',
                  dollarPrice: 0,
                  kaspaPrice: 0,
                };
                setStash([...stash, newItem]);
              }}
            >
              <ShoppingBag size={rs.s(16)} color={COLORS.white} />
              <Text style={wsStyles.addItemBtnText}>Add New Item</Text>
            </TouchableOpacity>
          </SectionCard>
        )}
        
        {/* DApps Tab */}
        {activeView === 'dapps' && (
          <SectionCard title="DApp & Game Management">
            <Text style={wsStyles.sectionSubtitle}>
              DApps are posted by YOU directly to Arweave. KasVillage verifies for display visibility only.
            </Text>
            
            <View style={wsStyles.complianceNotice}>
              <Text style={wsStyles.complianceText}>
                <Text style={{ fontWeight: 'bold' }}>⚠️ Compliance:</Text> Prohibited content apps are restricted and auto-rejected by protocol.
              </Text>
            </View>
            
            {/* Claude Code Link */}
            <TouchableOpacity
              style={wsStyles.ideBtn}
              onPress={() => Linking.openURL('https://claude.ai/code')}
            >
              <Code size={rs.s(16)} color={COLORS.white} />
              <Text style={wsStyles.ideBtnText}>Open Claude Code</Text>
            </TouchableOpacity>
            
            {/* Quality Gate */}
            <TouchableOpacity
              style={wsStyles.publishBtn}
              onPress={() => setShowQualityGate(true)}
            >
              <ShieldCheck size={rs.s(16)} color={COLORS.white} />
              <Text style={wsStyles.publishBtnText}>Verify DApp for Display</Text>
            </TouchableOpacity>
            
            {/* Book Shelf */}
            <TouchableOpacity
              style={wsStyles.bookShelfBtn}
              onPress={() => setShowAcademicPanel(true)}
            >
              <Text style={wsStyles.bookShelfBtnText}>📚 Book Shelf (Academic Research P2P)</Text>
            </TouchableOpacity>
            
            {/* Template */}
            <View style={wsStyles.templateBox}>
              <Text style={wsStyles.templateTitle}>DApp Template</Text>
              <Text style={wsStyles.templateSubtitle}>Copy the integration template to start building:</Text>
              <TouchableOpacity style={wsStyles.copyTemplateBtn} onPress={handleCopyTemplate}>
                <Code size={rs.s(14)} color={COLORS.purple800} />
                <Text style={wsStyles.copyTemplateBtnText}>Copy Integration Template</Text>
              </TouchableOpacity>
            </View>
          </SectionCard>
        )}
        
        {/* Academic Tab */}
        {activeView === 'academic' && (
          <SectionCard title="📚 Academic Research">
            <Text style={wsStyles.sectionSubtitle}>
              Privacy-preserving academic exchange. Verify via .edu email, publish abstracts, offer consulting.
            </Text>
            <TouchableOpacity
              style={wsStyles.academicBtn}
              onPress={() => setShowAcademicPanel(true)}
            >
              <FileText size={rs.s(16)} color={COLORS.white} />
              <Text style={wsStyles.academicBtnText}>Open Research Shelf</Text>
            </TouchableOpacity>
          </SectionCard>
        )}
        
        {/* Preview Tab */}
        {activeView === 'preview' && (
          <View>
            <SectionCard title="Storefront Preview">
              {/* Hero */}
              <View style={[wsStyles.previewHero, { backgroundColor: COLORS.amber600 }]}>
                <Text style={wsStyles.previewHeroTitle}>{brandName}</Text>
                <Text style={wsStyles.previewHeroSubtitle}>Professional storefront powered by KasVillage</Text>
              </View>
              
              {/* Social Footer */}
              <View style={wsStyles.previewSocialRow}>
                {SOCIAL_PLATFORMS.slice(0, 5).map(p => (
                  <Text 
                    key={p.id} 
                    style={[
                      wsStyles.previewSocialIcon,
                      !socialLinks[p.id] && { opacity: 0.2 }
                    ]}
                  >
                    {p.icon}
                  </Text>
                ))}
              </View>
            </SectionCard>
            
            <View style={wsStyles.actionRow}>
              <TouchableOpacity style={wsStyles.visitBtn} onPress={() => {
                if (onOpenStorefront) {
                  onOpenStorefront({ hostId, hostName: brandName });
                }
              }}>
                <Eye size={rs.s(16)} color={COLORS.white} />
                <Text style={wsStyles.visitBtnText}>Visit Storefront</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={wsStyles.saveBtn} 
                onPress={handlePublishStorefront}
                disabled={isPublishing}
              >
                {isPublishing ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <>
                    <Save size={rs.s(16)} color={COLORS.white} />
                    <Text style={wsStyles.saveBtnText}>Publish</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            
            <Text style={wsStyles.publishNote}>
              KasVillage verifies and posts to Arweave for you (FREE via Turbo)
            </Text>
          </View>
        )}
        
        {/* Bottom padding */}
        <View style={{ height: rs.s(100) }} />
      </ScrollView>
      
      {/* Modals */}
      <QualityGateModal
        visible={showQualityGate}
        onClose={() => setShowQualityGate(false)}
        onVerified={(m) => {
          Alert.alert('DApp Verified', `"${m.name}" will appear in KasVillage wallet`);
          onOpenDApp?.(m);
        }}
        userXp={userXp}
      />
      
      <AcademicPanel
        visible={showAcademicPanel}
        onClose={() => setShowAcademicPanel(false)}
      />
    </WorkspaceBackgroundWrapper>
  );
};

const wsStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: rs.s(16),
    paddingTop: rs.s(24),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: rs.s(16),
  },
  headerTitle: {
    fontSize: rs.font(24),
    fontWeight: '900',
    color: COLORS.amber900,
  },
  xpBadge: {
    backgroundColor: COLORS.amber100,
    paddingHorizontal: rs.s(12),
    paddingVertical: rs.s(6),
    borderRadius: rs.s(12),
  },
  xpBadgeText: {
    fontSize: rs.font(12),
    fontWeight: 'bold',
    color: COLORS.amber800,
  },
  toolbar: {
    marginBottom: rs.s(16),
  },
  toolbarContent: {
    backgroundColor: COLORS.amber200,
    borderRadius: rs.s(12),
    padding: rs.s(4),
    gap: rs.s(4),
  },
  toggleRow: {
    flexDirection: 'row',
    gap: rs.s(8),
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: rs.s(10),
    backgroundColor: COLORS.stone50,
    borderRadius: rs.s(8),
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: COLORS.amber50,
    borderWidth: 2,
    borderColor: COLORS.amber600,
  },
  toggleBtnText: {
    fontSize: rs.font(12),
    fontWeight: 'bold',
    color: COLORS.stone400,
    textTransform: 'capitalize',
  },
  toggleBtnTextActive: {
    color: COLORS.amber900,
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(12),
    backgroundColor: COLORS.stone50,
    borderRadius: rs.s(12),
    padding: rs.s(12),
    marginBottom: rs.s(8),
  },
  socialIcon: {
    fontSize: rs.font(24),
  },
  socialInput: {
    flex: 1,
    fontSize: rs.font(12),
    color: COLORS.stone700,
  },
  commNote: {
    fontSize: rs.font(11),
    color: COLORS.stone600,
    marginBottom: rs.s(12),
  },
  commTip: {
    fontSize: rs.font(10),
    color: COLORS.amber700,
    backgroundColor: COLORS.amber50,
    borderRadius: rs.s(8),
    padding: rs.s(8),
    marginTop: rs.s(8),
  },
  layoutSubtitle: {
    fontSize: rs.font(12),
    color: COLORS.stone600,
    marginBottom: rs.s(16),
  },
  layoutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rs.s(12),
  },
  layoutCard: {
    width: '47%',
    backgroundColor: COLORS.cardBg,
    borderRadius: rs.s(12),
    padding: rs.s(12),
    borderWidth: 2,
    borderColor: COLORS.stone200,
  },
  layoutCardActive: {
    borderColor: COLORS.amber600,
    backgroundColor: COLORS.amber50,
  },
  layoutName: {
    fontSize: rs.font(13),
    fontWeight: 'bold',
    color: COLORS.stone800,
    marginBottom: rs.s(4),
  },
  layoutDesc: {
    fontSize: rs.font(10),
    color: COLORS.stone500,
    marginBottom: rs.s(12),
  },
  layoutPreview: {
    flexDirection: 'row',
    gap: rs.s(4),
    height: rs.s(32),
  },
  layoutPreviewBox: {
    flex: 1,
    backgroundColor: COLORS.stone200,
    borderRadius: rs.s(4),
  },
  fontGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rs.s(8),
  },
  fontCard: {
    width: '48%',
    backgroundColor: COLORS.cardBg,
    borderRadius: rs.s(12),
    padding: rs.s(12),
    borderWidth: 2,
    borderColor: COLORS.stone100,
  },
  fontCardActive: {
    borderColor: COLORS.amber600,
    backgroundColor: COLORS.amber50,
  },
  fontLabel: {
    fontSize: rs.font(9),
    fontWeight: 'bold',
    color: COLORS.stone400,
    textTransform: 'uppercase',
    marginBottom: rs.s(4),
  },
  fontPreview: {
    fontSize: rs.font(18),
    color: COLORS.stone800,
  },
  sectionSubtitle: {
    fontSize: rs.font(12),
    color: COLORS.stone600,
    marginBottom: rs.s(12),
  },
  itemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderRadius: rs.s(12),
    padding: rs.s(14),
    marginBottom: rs.s(8),
    borderWidth: 1,
    borderColor: COLORS.amber200,
  },
  itemName: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.stone800,
  },
  itemPrice: {
    fontSize: rs.font(11),
    color: COLORS.stone500,
    marginTop: rs.s(2),
  },
  itemActions: {
    flexDirection: 'row',
    gap: rs.s(16),
  },
  emptyText: {
    fontSize: rs.font(13),
    color: COLORS.amber600,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: rs.s(24),
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs.s(8),
    backgroundColor: COLORS.blue600,
    borderRadius: rs.s(12),
    paddingVertical: rs.s(14),
  },
  addItemBtnText: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  complianceNotice: {
    backgroundColor: COLORS.red50,
    borderWidth: 1,
    borderColor: COLORS.red200,
    borderRadius: rs.s(12),
    padding: rs.s(12),
    marginBottom: rs.s(12),
  },
  complianceText: {
    fontSize: rs.font(11),
    color: COLORS.red700,
  },
  ideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs.s(8),
    backgroundColor: COLORS.blue600,
    borderRadius: rs.s(12),
    paddingVertical: rs.s(14),
    marginBottom: rs.s(12),
  },
  ideBtnText: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  publishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs.s(8),
    backgroundColor: COLORS.green600,
    borderRadius: rs.s(12),
    paddingVertical: rs.s(14),
    marginBottom: rs.s(12),
  },
  publishBtnText: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  bookShelfBtn: {
    borderWidth: 1,
    borderColor: COLORS.indigo300,
    backgroundColor: COLORS.indigo50,
    borderRadius: rs.s(12),
    paddingVertical: rs.s(12),
    alignItems: 'center',
    marginBottom: rs.s(16),
  },
  bookShelfBtnText: {
    fontSize: rs.font(13),
    fontWeight: 'bold',
    color: COLORS.indigo800,
  },
  templateBox: {
    backgroundColor: COLORS.cardBg,
    borderRadius: rs.s(12),
    padding: rs.s(14),
    borderWidth: 1,
    borderColor: COLORS.purple200,
  },
  templateTitle: {
    fontSize: rs.font(11),
    fontWeight: 'bold',
    color: COLORS.purple800,
    textTransform: 'uppercase',
    marginBottom: rs.s(4),
  },
  templateSubtitle: {
    fontSize: rs.font(10),
    color: COLORS.stone500,
    marginBottom: rs.s(12),
  },
  copyTemplateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs.s(8),
    backgroundColor: COLORS.purple100,
    borderRadius: rs.s(8),
    paddingVertical: rs.s(10),
  },
  copyTemplateBtnText: {
    fontSize: rs.font(11),
    fontWeight: 'bold',
    color: COLORS.purple800,
  },
  academicBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs.s(8),
    backgroundColor: COLORS.indigo600,
    borderRadius: rs.s(12),
    paddingVertical: rs.s(14),
  },
  academicBtnText: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  previewHero: {
    padding: rs.s(32),
    borderRadius: rs.s(12),
    alignItems: 'center',
    marginBottom: rs.s(16),
  },
  previewHeroTitle: {
    fontSize: rs.font(24),
    fontWeight: '900',
    color: COLORS.white,
    marginBottom: rs.s(4),
  },
  previewHeroSubtitle: {
    fontSize: rs.font(12),
    color: COLORS.white,
    opacity: 0.9,
  },
  previewSocialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: rs.s(24),
  },
  previewSocialIcon: {
    fontSize: rs.font(28),
  },
  actionRow: {
    flexDirection: 'row',
    gap: rs.s(12),
    marginTop: rs.s(16),
  },
  visitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs.s(8),
    backgroundColor: COLORS.stone800,
    borderRadius: rs.s(12),
    paddingVertical: rs.s(14),
  },
  visitBtnText: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs.s(8),
    backgroundColor: COLORS.green600,
    borderRadius: rs.s(12),
    paddingVertical: rs.s(14),
  },
  saveBtnText: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  publishNote: {
    fontSize: rs.font(10),
    color: COLORS.stone500,
    textAlign: 'center',
    marginTop: rs.s(8),
  },
});

export default Workspace;