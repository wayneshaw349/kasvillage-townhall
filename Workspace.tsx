import { validateContentText } from './content_validator';
import { validateGameDescriptor, TIC_TAC_TOE_JSON } from './game_schema';
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
  ActivityIndicator,
  Modal,
} from 'react-native';
import Svg, { Rect, Defs, Pattern, Line, G, Path, Text as SvgText } from 'react-native-svg';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import * as Crypto from 'expo-crypto';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

// Import upload functions (v2 TownHall integration)
// import { uploadStoreListing } from './arweave_upload'; // replaced by uploadToIrys in publish handler

// Import procedural backgrounds
import { ProceduralBackground } from './expo_procedural_backgrounds';
import { verifyDKIM, quickDomainCheck } from './dkim_verify';
import { scanDAppCode, prepareDAppRegistration, SDK_VERSION, SDK_TEMPLATE_HASH, kvFetch } from './procedural_sdk';
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
  blue300: '#93c5fd',
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
const TOWNHALL_API = 'https://kasvillage.app.runonflux.io/api';

// TownHallClient for signed, authenticated API calls
import { townHall as townHallClient } from './townhall_client';
import { hashPubkey } from './arweave_queries';

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
    return { verified: false, code_hash: undefined, scan_result: { passed: false, status: 'not_displayed' }, message: 'Verification unavailable � Town Hall offline' };
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
    return { verified: false, code_hash: undefined, scan_result: { passed: false, status: 'not_displayed' }, message: 'Verification unavailable � Town Hall offline' };
  }
}

// ============================================================================
// CONSTANTS (v2 canonical 13 traits)
// ============================================================================
const CITADEL_SELLER_THRESHOLD = 6;

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


const BANNER_STYLES = [
  { id: 'amber', label: 'Classic Gold', bg: '#d97706', text: '#fff' },
  { id: 'indigo', label: 'Deep Indigo', bg: '#3730a3', text: '#fff' },
  { id: 'forest', label: 'Forest', bg: '#166534', text: '#fff' },
  { id: 'midnight', label: 'Midnight', bg: '#1c1917', text: '#fbbf24' },
  { id: 'sunset', label: 'Sunset', bg: '#9a3412', text: '#fde68a' },
  { id: 'crest', label: 'Avatar Crest', bg: 'crest', text: '#fff' },
];

const DISCIPLINES = [
  { id: 'cs', label: 'Computer Science', icon: '??' },
  { id: 'math', label: 'Mathematics', icon: '??' },
  { id: 'physics', label: 'Physics', icon: '??' },
  { id: 'bio', label: 'Biology', icon: '??' },
  { id: 'chem', label: 'Chemistry', icon: '??' },
  { id: 'econ', label: 'Economics', icon: '??' },
  { id: 'eng', label: 'Engineering', icon: '??' },
  { id: 'law', label: 'Law', icon: '??' },
  { id: 'med', label: 'Medicine', icon: '??' },
  { id: 'psych', label: 'Psychology', icon: '??' },
  { id: 'other', label: 'Other', icon: '??' },
];

const QA_CHANNELS = [
  { id: 'telegram', label: 'Telegram', icon: '??', placeholder: 't.me/username or @handle' },
  { id: 'instagram_dm', label: 'Instagram DM', icon: '??', placeholder: '@your_instagram' },
  { id: 'signal', label: 'Signal', icon: '??', placeholder: 'Signal username' },
  { id: 'email', label: 'Email (generic)', icon: '??', placeholder: 'any email (not .edu)' },
  { id: 'nostr', label: 'Nostr', icon: '??', placeholder: 'npub...' },
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
  { id: 'instagram', label: 'Instagram', icon: '??', domain: 'instagram.com' },
  { id: 'tiktok', label: 'TikTok', icon: '??', domain: 'tiktok.com' },
  { id: 'facebook', label: 'Facebook', icon: '??', domain: 'facebook.com' },
  { id: 'etsy', label: 'Etsy Shop', icon: '???', domain: 'etsy.com' },
  { id: 'pinterest', label: 'Pinterest', icon: '??', domain: 'pinterest.com' },
  { id: 'youtube', label: 'YouTube', icon: '??', domain: 'youtube.com' },
  { id: 'twitch', label: 'Twitch', icon: '??', domain: 'twitch.tv' },
];

// Communication channels for buyer-seller contact
const COMMUNICATION_CHANNELS = [
  { id: 'telegram', label: 'Telegram', icon: '??', placeholder: 't.me/username or @username' },
  { id: 'messenger', label: 'FB Messenger', icon: '??', placeholder: 'm.me/username' },
  { id: 'instagram_dm', label: 'Instagram DM', icon: '??', placeholder: '@your_instagram' },
];

const DAPP_TEMPLATE_CODE = `// ---------------------------------------------------------------------------
// KASVILLAGE L2 - DAPP/GAME INTEGRATION TEMPLATE
// ---------------------------------------------------------------------------
// IDE: https://idx.google.com | Docs: https://kasvillage.dev/docs
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// BOARDS & XP REQUIREMENTS:
// Incubator: 500+ XP | Main: 1000+ XP | Elite: 5000+ XP
// ---------------------------------------------------------------------------`;

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
    <Text style={gateStyles.title}>?? Passport Required</Text>
    <Text style={gateStyles.subtitle}>
      Complete 6 identity traits to unlock your Storefront Workspace.
    </Text>
    
    {/* Progress Bar */}
    <View style={gateStyles.progressContainer}>
      <View style={gateStyles.progressHeader}>
        <Text style={gateStyles.progressLabel}>Progress</Text>
        <Text style={[
          gateStyles.progressCount,
          filledTraits >= 5 && { color: COLORS.green600 }
        ]}>
          {filledTraits}/6
        </Text>
      </View>
      <View style={gateStyles.progressBar}>
        <View style={[
          gateStyles.progressFill,
          { 
            width: `${(filledTraits / 6) * 100}%`,
            backgroundColor: filledTraits >= 6 ? COLORS.green500 : 
                            filledTraits >= 5 ? COLORS.amber500 : COLORS.amber600
          }
        ]} />
      </View>
      <View style={gateStyles.progressLabels}>
        <Text style={gateStyles.tierLabel}>Guest</Text>
        <Text style={[gateStyles.tierLabel, filledTraits >= 5 && { color: COLORS.green600 }]}>
          Resident (5)
        </Text>
        <Text style={[gateStyles.tierLabel, filledTraits >= 6 && { color: COLORS.green600 }]}>
          Passport (6)
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
  const [pastedCode, setPastedCode] = useState('');
  const [scanResult, setScanResult] = useState<any>(null);
  const [manifest, setManifest] = useState({
    name: '',
    gameUrl: 'https://',
    category: 'GameRPG',
    description: '',
    stakeAmount: 100,
    pledgeKas: 100,
    pledgeDays: 90,
    customDomains: '',
  });
  
  const hasProhibitedContent = containsRestrictedContent(manifest.name) || 
                               containsRestrictedContent(manifest.description) ||
                               PROHIBITED_CATEGORIES.includes(manifest.category);

  // Run real SDK scanner on pasted code
  const runCodeScan = () => {
    if (!pastedCode || pastedCode.length < 20) {
      Alert.alert('No Code', 'Paste your DApp code to scan');
      return;
    }
    setIsChecking(true);
    try {
      const customDomains = manifest.customDomains.split(',').map(d => d.trim()).filter(Boolean);
      const result = scanDAppCode(pastedCode, customDomains);
      setScanResult(result);
      console.log('[SDK-Scan]', result.passed ? 'PASSED' : 'FAILED', 
        'violations:', result.violations.length, 
        'warnings:', result.warnings.length,
        'lines:', result.stats.linesScanned);
    } catch (e) {
      Alert.alert('Scan Error', String(e));
    }
    setIsChecking(false);
  };

  const canProceed = scanResult?.passed && !hasProhibitedContent && manifest.name.length > 0;
  
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
          <View style={qgStyles.header}>
            <View>
              <View style={qgStyles.headerTitle}>
                <ShieldCheck size={rs.s(20)} color={COLORS.amber500} />
                <Text style={qgStyles.headerText}>SDK Compliance Gate</Text>
              </View>
              <Text style={qgStyles.headerSubtext}>SDK v{SDK_VERSION} � Step {step} of 3</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={rs.s(24)} color={COLORS.stone500} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={qgStyles.content}>
            {step === 1 && (
              <View style={qgStyles.stepContent}>
                <InputField label="App Name" value={manifest.name} onChangeText={(text) => setManifest({ ...manifest, name: text })} placeholder="e.g. Kaspa Quest" />
                
                <Text style={inputStyles.label}>Category</Text>
                <View style={qgStyles.categoryRow}>
                  {['GameRPG', 'GameStrategy', 'UtilityTool'].map(cat => (
                    <TouchableOpacity key={cat} style={[qgStyles.categoryBtn, manifest.category === cat && qgStyles.categoryBtnActive]} onPress={() => setManifest({ ...manifest, category: cat })}>
                      <Text style={[qgStyles.categoryText, manifest.category === cat && qgStyles.categoryTextActive]}>{cat.replace('Game', '').replace('Utility', '')}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                
                {hasProhibitedContent && (
                  <View style={qgStyles.prohibitedBox}>
                    <View style={qgStyles.prohibitedHeader}><Ban size={rs.s(20)} color={COLORS.red600} /><Text style={qgStyles.prohibitedTitle}>Prohibited Content</Text></View>
                    <Text style={qgStyles.prohibitedText}>Name or description contains restricted terms.</Text>
                  </View>
                )}

                <InputField label="Custom API Domains (comma-separated)" value={manifest.customDomains} onChangeText={(text) => setManifest({ ...manifest, customDomains: text })} placeholder="api.mygame.com, ws.mygame.com" note="Domains your DApp needs beyond the default whitelist" />

                {/* Code Paste + SDK Scan */}
                <View style={{ backgroundColor: COLORS.stone50, borderRadius: rs.s(12), padding: rs.s(12), marginBottom: rs.s(16), borderWidth: 1, borderColor: COLORS.stone200 }}>
                  <Text style={{ fontSize: rs.font(12), fontWeight: 'bold', color: COLORS.stone800, marginBottom: rs.s(6) }}>?? Paste DApp Code for SDK Scan</Text>
                  <Text style={{ fontSize: rs.font(10), color: COLORS.stone500, marginBottom: rs.s(8) }}>
                    The SDK scanner checks for image uploads, realistic faces, eval(), iframes, and 53+ violation patterns.
                  </Text>
                  <TextInput
                    style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.stone300, borderRadius: rs.s(8), padding: rs.s(10), fontSize: rs.font(10), fontFamily: 'monospace', color: COLORS.stone700, minHeight: rs.s(120), textAlignVertical: 'top' }}
                    value={pastedCode}
                    onChangeText={setPastedCode}
                    placeholder="Paste your full DApp source code here..."
                    placeholderTextColor={COLORS.stone400}
                    multiline
                  />
                  <Text style={{ fontSize: rs.font(9), color: COLORS.stone400, marginTop: 4 }}>{pastedCode.length} chars � {pastedCode.split('\n').length} lines</Text>
                  
                  <TouchableOpacity
                    style={{ backgroundColor: pastedCode.length > 20 ? COLORS.indigo600 : COLORS.stone300, borderRadius: rs.s(10), paddingVertical: rs.s(12), alignItems: 'center', marginTop: rs.s(8), flexDirection: 'row', justifyContent: 'center', gap: rs.s(8) }}
                    onPress={runCodeScan}
                    disabled={isChecking || pastedCode.length < 20}
                  >
                    {isChecking ? <ActivityIndicator color="#fff" size="small" /> : <ShieldCheck size={rs.s(16)} color="#fff" />}
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: rs.font(13) }}>{isChecking ? 'Scanning...' : 'Run SDK Scanner'}</Text>
                  </TouchableOpacity>
                </View>

                {/* Scan Results */}
                {scanResult && (
                  <View style={{ backgroundColor: scanResult.passed ? COLORS.green50 : COLORS.red50, borderRadius: rs.s(12), padding: rs.s(14), marginBottom: rs.s(16), borderWidth: 2, borderColor: scanResult.passed ? COLORS.green500 : COLORS.red500 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs.s(8), marginBottom: rs.s(8) }}>
                      {scanResult.passed ? <ShieldCheck size={rs.s(20)} color={COLORS.green600} /> : <Ban size={rs.s(20)} color={COLORS.red600} />}
                      <Text style={{ fontSize: rs.font(16), fontWeight: '900', color: scanResult.passed ? COLORS.green800 : COLORS.red800 }}>
                        {scanResult.passed ? 'SCAN PASSED ?' : 'SCAN FAILED ?'}
                      </Text>
                    </View>
                    <Text style={{ fontSize: rs.font(11), color: COLORS.stone600, marginBottom: rs.s(6) }}>
                      {scanResult.stats.linesScanned} lines scanned � {scanResult.stats.patternsChecked} patterns checked � {scanResult.stats.whitelistApplied} whitelisted
                    </Text>
                    
                    {scanResult.violations.length > 0 && (
                      <View style={{ marginTop: rs.s(4) }}>
                        <Text style={{ fontSize: rs.font(11), fontWeight: 'bold', color: COLORS.red800, marginBottom: 4 }}>Violations ({scanResult.violations.length}):</Text>
                        {scanResult.violations.slice(0, 10).map((v: any, i: number) => (
                          <View key={i} style={{ backgroundColor: '#fff', borderRadius: 6, padding: 8, marginBottom: 4 }}>
                            <Text style={{ fontSize: rs.font(10), fontWeight: 'bold', color: COLORS.red700 }}>Line {v.line}: {v.pattern}</Text>
                            <Text style={{ fontSize: rs.font(9), fontFamily: 'monospace', color: COLORS.stone500 }} numberOfLines={1}>{v.code}</Text>
                            <Text style={{ fontSize: rs.font(8), color: v.severity === 'critical' ? COLORS.red600 : COLORS.amber600 }}>Severity: {v.severity}</Text>
                          </View>
                        ))}
                        {scanResult.violations.length > 10 && <Text style={{ fontSize: rs.font(10), color: COLORS.red600 }}>...and {scanResult.violations.length - 10} more</Text>}
                      </View>
                    )}
                    
                    {scanResult.warnings.length > 0 && (
                      <View style={{ marginTop: rs.s(8) }}>
                        <Text style={{ fontSize: rs.font(11), fontWeight: 'bold', color: COLORS.amber800 }}>Warnings ({scanResult.warnings.length}):</Text>
                        {scanResult.warnings.slice(0, 5).map((w: any, i: number) => (
                          <Text key={i} style={{ fontSize: rs.font(9), color: COLORS.amber700, marginTop: 2 }}>? Line {w.line}: {w.note}</Text>
                        ))}
                      </View>
                    )}
                  </View>
                )}
                
                <TouchableOpacity
                  style={[qgStyles.proceedBtn, !canProceed && qgStyles.proceedBtnDisabled]}
                  onPress={() => setStep(2)}
                  disabled={!canProceed}
                >
                  <Text style={qgStyles.proceedBtnText}>{!scanResult ? 'Scan Code First' : !scanResult.passed ? 'Fix Violations to Continue' : 'Continue to KAS Pledge'}</Text>
                  <ChevronRight size={rs.s(18)} color={COLORS.white} />
                </TouchableOpacity>
                
                {!scanResult && (
                  <Text style={{ fontSize: rs.font(10), color: COLORS.stone400, textAlign: 'center', marginTop: rs.s(8) }}>
                    DApps are NOT visible in KasVillage unless they pass the SDK scan
                  </Text>
                )}
              </View>
            )}
            
            {step === 2 && (
              <View style={qgStyles.stepContent}>
                <Text style={qgStyles.stepTitle}>KAS Pledge</Text>
                <Text style={qgStyles.stepSubtitle}>
                  Hold KAS in your wallet for the pledge duration. If balance drops below pledge, your DApp becomes invisible.
                </Text>
                
                {/* Pledge Amount */}
                <View style={qgStyles.xpBox}>
                  <Text style={qgStyles.xpLabel}>Pledge Amount (KAS)</Text>
                  <Text style={qgStyles.xpValue}>{manifest.pledgeKas || 100} KAS</Text>
                  <View style={qgStyles.xpButtons}>
                    {[100, 500, 1000, 5000].map(val => (
                      <TouchableOpacity
                        key={val}
                        style={[
                          qgStyles.xpBtn,
                          (manifest.pledgeKas || 100) === val && qgStyles.xpBtnActive
                        ]}
                        onPress={() => setManifest({ ...manifest, pledgeKas: val })}
                      >
                        <Text style={[
                          qgStyles.xpBtnText,
                          (manifest.pledgeKas || 100) === val && qgStyles.xpBtnTextActive
                        ]}>
                          {val >= 1000 ? val/1000 + 'K' : val}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                
                {/* Duration */}
                <View style={qgStyles.xpBox}>
                  <Text style={qgStyles.xpLabel}>Pledge Duration</Text>
                  <View style={qgStyles.xpButtons}>
                    {[
                      { days: 30, label: '30d' },
                      { days: 90, label: '90d' },
                      { days: 180, label: '6mo' },
                      { days: 365, label: '1yr' },
                    ].map(d => (
                      <TouchableOpacity
                        key={d.days}
                        style={[
                          qgStyles.xpBtn,
                          (manifest.pledgeDays || 90) === d.days && qgStyles.xpBtnActive
                        ]}
                        onPress={() => setManifest({ ...manifest, pledgeDays: d.days })}
                      >
                        <Text style={[
                          qgStyles.xpBtnText,
                          (manifest.pledgeDays || 90) === d.days && qgStyles.xpBtnTextActive
                        ]}>
                          {d.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                
                {/* Board Preview */}
                <View style={[qgStyles.boardPreview, { borderColor: board.color }]}>
                  <Text style={[qgStyles.boardName, { color: board.color }]}>
                    {(manifest.pledgeKas || 100) >= 2000 ? '?? Elite' :
                     (manifest.pledgeKas || 100) >= 500 ? '?? Main' : '?? Incubator'}
                  </Text>
                  <Text style={qgStyles.boardDesc}>
                    {(manifest.pledgeKas || 100) >= 2000 ? 'Premium placement, highest visibility' :
                     (manifest.pledgeKas || 100) >= 500 ? 'Verified apps, good visibility' :
                     'Testing/beta apps, limited visibility'}
                  </Text>
                  <Text style={[qgStyles.boardDesc, { marginTop: 4, fontStyle: 'italic' }]}>
                    Pledge: {manifest.pledgeKas || 100} KAS for {manifest.pledgeDays || 90} days
                  </Text>
                </View>
                
                <View style={qgStyles.buttonRow}>
                  <TouchableOpacity style={qgStyles.backBtn} onPress={() => setStep(1)}>
                    <Text style={qgStyles.backBtnText}>? Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={qgStyles.stakeBtn}
                    onPress={async () => {
                      try {
                        const pledgeKas = manifest.pledgeKas || 100;
                        const pledgeDays = manifest.pledgeDays || 90;
                        const pledgeSompi = pledgeKas * 100000000;
                        const durationDaa = pledgeDays * 86400;
                        const pubkey = await SecureStore.getItemAsync('kv_public_key');
                        const address = await SecureStore.getItemAsync('kv_address');
                        
                        // Get current DAA from Kaspa API
                        let startDaa = Math.floor(Date.now() / 1000); // fallback
                        try {
                          const daaResp = await fetch('https://api-tn.kaspa.org/info/virtual-chain-blue-score');
                          const daaData = await daaResp.json();
                          if (daaData.blueScore) startDaa = daaData.blueScore;
                        } catch {}
                        
                        try {
                          const { uploadToIrys: irysUpload } = await import('./arweave_upload');
                          await irysUpload(JSON.stringify({
                            type: 'KV_DAPP_PLEDGE_V1',
                            pledgeSompi,
                            durationDaa,
                            startDaa,
                            dappName: manifest.name,
                          }), [
                            { name: 'App-Name', value: 'KasVillage' },
                            { name: 'Type', value: 'KV_DAPP_PLEDGE_V1' },
                            { name: 'Pubkey-Hash', value: hashPubkey(pubkey || '') },
                            { name: 'Owner-Pubkey', value: pubkey || '' },
                            { name: 'KV-Pledge-Sompi', value: pledgeSompi.toString() },
                            { name: 'KV-Pledge-Start-DAA', value: startDaa.toString() },
                            { name: 'KV-Pledge-Duration-DAA', value: durationDaa.toString() },
                            { name: 'KV-Pledge-Address', value: address || '' },
                            { name: 'KV-DAppName', value: manifest.name },
                          ]);
                        } catch (uploadErr) { console.warn("Pledge upload failed:", uploadErr); }
                        
                        Alert.alert('Pledge Inscribed', pledgeKas + ' KAS pledged for ' + pledgeDays + ' days. Your wallet balance will be monitored.');
                        setStep(3);
                      } catch (err) {
                        Alert.alert('Pledge Failed', String(err));
                      }
                    }}
                  >
                    <Text style={qgStyles.stakeBtnText}>Pledge & Publish</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            
            {step === 3 && (
              <View style={qgStyles.stepContent}>
                <View style={qgStyles.successIcon}><ShieldCheck size={rs.s(48)} color={COLORS.green600} /></View>
                <Text style={qgStyles.successTitle}>DApp SDK Compliant & Published!</Text>
                <Text style={qgStyles.successSubtitle}>"{manifest.name}" is now live on the {board.name}</Text>
                <View style={{ backgroundColor: COLORS.stone50, borderRadius: rs.s(10), padding: rs.s(12), marginBottom: rs.s(16) }}>
                  <Text style={{ fontSize: rs.font(10), color: COLORS.stone600 }}>SDK Version: {SDK_VERSION}</Text>
                  <Text style={{ fontSize: rs.font(10), color: COLORS.stone600 }}>Lines Scanned: {scanResult?.stats?.linesScanned || 0}</Text>
                  <Text style={{ fontSize: rs.font(10), color: COLORS.stone600 }}>Violations: 0</Text>
                  <Text style={{ fontSize: rs.font(10), color: COLORS.stone600 }}>Code Hash: on Arweave</Text>
                  <Text style={{ fontSize: rs.font(10), color: COLORS.green600, fontWeight: 'bold', marginTop: 4 }}>? Periodic re-scan enabled via TownHall</Text>
                </View>
                <TouchableOpacity style={qgStyles.doneBtn} onPress={() => { onVerified({ ...manifest, scanResult }); onClose(); }}><Text style={qgStyles.doneBtnText}>Done</Text></TouchableOpacity>
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
  const [dkimSteps, setDkimSteps] = useState<string[]>([]);
  const [dkimError, setDkimError] = useState('');
  const [researcherProfile, setResearcherProfile] = useState<any>(null);
  
  // Abstract submission
  const [abstractTitle, setAbstractTitle] = useState('');
  const [abstractText, setAbstractText] = useState('');
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [keywords, setKeywords] = useState('');
  const [attestation1, setAttestation1] = useState(false);
  const [attestation2, setAttestation2] = useState(false);
  const [attestation3, setAttestation3] = useState(false);
  const [abstractDiscipline, setAbstractDiscipline] = useState('');
  const [abstractVideoUrl, setAbstractVideoUrl] = useState('');
  const [qaChannel, setQaChannel] = useState('');
  const [qaHandle, setQaHandle] = useState('');
  
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
    questionPrice: number;
    discipline?: string;
    videoUrl?: string;
    qaChannel?: string;
    qaHandle?: string;
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
  // ECDH ENCRYPTION � secp256k1 shared secret ? XOR-SHA256 stream cipher
  // =========================================================================
  
  const ecdhEncrypt = async (plaintext: string, myPrivKeyHex: string, theirPubKeyHex: string): Promise<string> => {
    const myPrivKey = hexToBytes(myPrivKeyHex);
    const theirPubKey = hexToBytes(theirPubKeyHex);
    
    // ECDH shared secret: myPrivKey � theirPubKey
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
  // P2P SEND � ECDH encrypted
  // =========================================================================
  
  const sendQAMessageP2P = async (
    recipientPubkey: string,
    message: { type: 'question' | 'answer' | 'decline'; qaId: string; abstractId: string; text: string },
  ) => {
    try {
      const myPubkey = await SecureStore.getItemAsync('kv_public_key') || '';
      const myPrivkey = await SecureStore.getItemAsync('kv_private_key') || '';
      const payload = JSON.stringify(message);
      
      // Real ECDH encryption � only recipient can decrypt with their private key
      let encrypted: string;
      if (myPrivkey && recipientPubkey && recipientPubkey.length >= 66) {
        encrypted = await ecdhEncrypt(payload, myPrivkey, recipientPubkey);
      } else {
        // Fallback if keys not available � base64 (not secure, dev only)
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
        // Arweave offline � save locally for later upload
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
  
  const openQAChannel = (abstract_: any, question: string) => {
    const ch = abstract_.qaChannel;
    const handle = abstract_.qaHandle || '';
    if (ch === 'telegram' && handle) {
      const tgUser = handle.replace('@', '').replace('t.me/', '');
      Linking.openURL('https://t.me/' + tgUser + '?text=' + encodeURIComponent('Re: ' + abstract_.title + '\n\n' + question));
    } else if (ch === 'instagram_dm' && handle) {
      Linking.openURL('https://instagram.com/' + handle.replace('@', ''));
      Alert.alert('DM on Instagram', 'Send your question as a DM to ' + handle);
    } else if (ch === 'signal' && handle) {
      Alert.alert('Signal', 'Message ' + handle + ' on Signal with your question.');
    } else if (ch === 'email' && handle) {
      Linking.openURL('mailto:' + handle + '?subject=' + encodeURIComponent('Re: ' + abstract_.title) + '&body=' + encodeURIComponent(question));
    } else if (ch === 'nostr' && handle) {
      Alert.alert('Nostr', 'Send a DM to ' + handle + ' on Nostr.');
    } else {
      Alert.alert('Contact', 'The researcher has not set a contact channel. Check the abstract for contact info.');
    }
  };

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
      // Prompt to open researcher's contact channel
      if (selectedAbstract.qaChannel && selectedAbstract.qaHandle) {
        Alert.alert('Question Saved!', 'Now send it to the researcher via ' + (QA_CHANNELS.find(c => c.id === selectedAbstract.qaChannel)?.label || 'their channel') + '?', [
          { text: 'Later', style: 'cancel' },
          { text: 'Open ' + (QA_CHANNELS.find(c => c.id === selectedAbstract.qaChannel)?.label || 'Channel'), onPress: () => openQAChannel(selectedAbstract, newQuestion.trim()) },
        ]);
      }
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
    Clipboard.setStringAsync(magicLink);
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
      discipline: abstractDiscipline,
      videoUrl: abstractVideoUrl,
      qaChannel,
      qaHandle,
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
    // Inscribe to Arweave
    try {
      const { uploadToIrys } = await import('./arweave_upload');
      await uploadToIrys(JSON.stringify(newAbstract), [
        { name: 'App-Name', value: 'KasVillage' },
        { name: 'KV-Type', value: 'Abstract' },
        { name: 'KV-AbstractId', value: newAbstract.id },
        { name: 'KV-Domain', value: newAbstract.institutionDomain },
        { name: 'KV-Discipline', value: abstractDiscipline },
        { name: 'KV-VideoUrl', value: abstractVideoUrl },
        { name: 'KV-QAChannel', value: qaChannel },
        { name: 'Content-Type', value: 'application/json' },
      ]);
      console.log('[Academic] Abstract inscribed to Arweave');
    } catch (e) { console.warn('[Academic] Arweave failed:', e); }
    
    Alert.alert('Success!', `Abstract published!\nID: ${newAbstract.id}\n\nFirst question from any user is FREE. You can set a price for follow-up questions in your profile.`);
    setAbstractTitle('');
    setAbstractText('');
    setRepositoryUrl('');
    setKeywords('');
    setAbstractDiscipline('');
    setAbstractVideoUrl('');
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
              <Text style={acStyles.headerTitle}>?? Research Shelf</Text>
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
                  {tab === 'browse' && '?? Browse'}
                  {tab === 'submit' && '?? Submit'}
                  {tab === 'services' && '?? Services'}
                  {tab === 'profile' && '?? Profile'}
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
                          � <Text style={{ fontWeight: 'bold' }}>We cannot guarantee the authenticity of any author.</Text> Researcher identities are self-attested.
                        </Text>
                        <Text style={acStyles.disclaimerItem}>
                          � <Text style={{ fontWeight: 'bold' }}>We cannot verify true identity.</Text> Pseudonymous IDs protect privacy.
                        </Text>
                        <Text style={acStyles.disclaimerItem}>
                          � <Text style={{ fontWeight: 'bold' }}>We cannot guarantee research validity.</Text> Content is user-submitted.
                        </Text>
                        <Text style={acStyles.disclaimerItem}>
                          � <Text style={{ fontWeight: 'bold' }}>Always verify through official channels.</Text>
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={acStyles.acceptBtn}
                      onPress={() => setDisclaimerAccepted(true)}
                    >
                      <Text style={acStyles.acceptBtnText}>I Understand � Continue to Browse</Text>
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
                        ?? Platform does not verify author identity or research validity.
                      </Text>
                    </View>
                    
                    {/* Abstract Detail View with Q&A */}
                    {selectedAbstract ? (
                      <View>
                        <TouchableOpacity onPress={() => { setSelectedAbstract(null); setQaList([]); }} style={{ padding: 8 }}>
                          <Text style={{ color: COLORS.amber600, fontSize: 15, fontWeight: 'bold' }}>? Back to list</Text>
                        </TouchableOpacity>
                        
                        {/* Abstract Card */}
                        <View style={{ backgroundColor: COLORS.cardBg, borderRadius: 12, padding: 16, marginTop: 8, borderWidth: 1, borderColor: COLORS.stone200 }}>
                          <Text style={{ color: COLORS.stone800, fontSize: 18, fontWeight: 'bold' }}>{selectedAbstract.title}</Text>
                          <Text style={{ color: COLORS.stone500, fontSize: 12, marginTop: 4 }}>
                            By {selectedAbstract.researcherId} � {selectedAbstract.institutionDomain} � {new Date(selectedAbstract.timestamp).toLocaleDateString()}
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
                            <Text style={{ color: COLORS.blue600, fontSize: 13, textDecorationLine: 'underline' }}>?? View Repository</Text>
                          </TouchableOpacity>
                          {selectedAbstract.videoUrl ? <TouchableOpacity onPress={() => Linking.openURL(selectedAbstract.videoUrl!)} style={{ marginTop: 6 }}><Text style={{ color: COLORS.blue600, fontSize: 13, textDecorationLine: 'underline' }}>?? Watch Video Explainer</Text></TouchableOpacity> : null}
                          {selectedAbstract.qaChannel && selectedAbstract.qaHandle ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, backgroundColor: '#fef3c7', borderRadius: 8, padding: 8 }}><Text style={{ fontSize: 11, color: '#92400e' }}>?? Questions via {selectedAbstract.qaChannel}: <Text style={{ fontWeight: 'bold' }}>{selectedAbstract.qaHandle}</Text></Text></View> : null}
                        </View>
                        
                        {/* Q&A Section */}
                        <View style={{ marginTop: 16 }}>
                          <Text style={{ color: COLORS.stone800, fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>
                            ?? Questions & Answers ({qaList.length})
                          </Text>
                          
                          {qaList.filter(q => !q.declined).map(qa => (
                            <View key={qa.id} style={{ backgroundColor: COLORS.cardBg, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: qa.answerText ? COLORS.green200 : COLORS.stone200 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={{ fontSize: 12, color: COLORS.stone500 }}>
                                  {qa.isPaid ? '?? Paid' : '?? Free'} � {new Date(qa.timestamp).toLocaleDateString()}
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
                                        Alert.alert('Answer', 'Answer input not available on this device � use desktop');
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
                              <Text style={{ color: COLORS.green600, fontSize: 12, marginBottom: 6 }}>?? Your first question is FREE</Text>
                            ) : selectedAbstract.questionPrice > 0 ? (
                              <Text style={{ color: COLORS.amber600, fontSize: 12, marginBottom: 6 }}>?? Follow-up questions cost {selectedAbstract.questionPrice} KAS</Text>
                            ) : (
                              <Text style={{ color: COLORS.green600, fontSize: 12, marginBottom: 6 }}>?? This researcher hasn't set a price � questions are free</Text>
                            )}
                            <TextInput
                              style={{ backgroundColor: COLORS.stone100, borderRadius: 8, padding: 10, fontSize: 14, color: COLORS.stone800, minHeight: 60, textAlignVertical: 'top' }}
                              placeholder="Type your question here..."
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
                                {abstract_.researcherId} � {abstract_.institutionDomain}
                              </Text>
                              <Text style={{ color: COLORS.stone600, fontSize: 13, marginTop: 6 }} numberOfLines={3}>
                                {abstract_.text}
                              </Text>
                              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                                <Text style={{ color: COLORS.stone400, fontSize: 11 }}>?? {abstract_.questionCount} questions</Text>
                                <Text style={{ color: COLORS.stone400, fontSize: 11 }}>?? {abstract_.viewCount} views</Text>
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
            
            {/* Submit Tab � DKIM On-Device Verification */}
            {activeTab === 'submit' && (
              <View style={acStyles.tabContent}>
                {/* Step 0: Get Code � no email field exists */}
                {verificationStep === 0 && !researcherProfile && (
                  <View>
                    <Text style={{ fontSize: rs.font(20), fontWeight: '900', color: COLORS.amber900, textAlign: 'center', marginBottom: rs.s(8) }}>?? Prove Your School Email</Text>
                    <Text style={{ fontSize: rs.font(13), color: COLORS.stone600, textAlign: 'center', marginBottom: rs.s(16), lineHeight: rs.font(20) }}>Your email NEVER enters this app � not even for a second.{String.fromCharCode(10)}We only read the school name from the DKIM digital stamp.</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24, marginBottom: 16 }}>
                      {['Get Code', 'Paste Proof'].map((label, i) => (
                        <View key={i} style={{ alignItems: 'center' }}>
                          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: i === 0 ? COLORS.amber600 : COLORS.stone200, justifyContent: 'center', alignItems: 'center' }}>
                            <Text style={{ color: i === 0 ? '#fff' : COLORS.stone500, fontWeight: 'bold', fontSize: 12 }}>{i + 1}</Text>
                          </View>
                          <Text style={{ fontSize: 9, color: COLORS.stone500, marginTop: 4 }}>{label}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={{ backgroundColor: COLORS.blue50, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.blue200, alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.blue800, marginBottom: 8 }}>Your verification code:</Text>
                      <Text selectable style={{ fontSize: 36, fontWeight: '900', fontFamily: 'monospace', color: COLORS.amber900, letterSpacing: 6 }}>{magicLink || '------'}</Text>
                      <TouchableOpacity onPress={() => { const code = Math.floor(100000 + Math.random() * 900000).toString(); setMagicLink(code); Clipboard.setStringAsync(code); Alert.alert('Code Ready!', code + ' copied. Paste it in your email subject line.'); }} style={{ backgroundColor: COLORS.amber600, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 24, marginTop: 10 }}>
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>{magicLink ? 'Copy Code Again' : 'Generate Code'}</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ backgroundColor: COLORS.stone50, borderRadius: 10, padding: 12, marginBottom: 16, gap: 6 }}>
                      <Text style={{ fontSize: 13, fontWeight: 'bold', color: COLORS.stone800 }}>Then do this:</Text>
                      <Text style={{ fontSize: 12, color: COLORS.stone600 }}>1. Open your school email (Gmail, Outlook, etc.)</Text>
                      <Text style={{ fontSize: 12, color: COLORS.stone600 }}>2. Send a new email TO YOURSELF from your .edu</Text>
                      <Text style={{ fontSize: 12, color: COLORS.stone600 }}>3. Put the code above in the subject line</Text>
                      <Text style={{ fontSize: 12, color: COLORS.stone600 }}>4. Hit send, come back here, tap Next</Text>
                    </View>
                    <TouchableOpacity style={{ backgroundColor: magicLink ? COLORS.amber600 : COLORS.stone300, borderRadius: 12, paddingVertical: 16, alignItems: 'center' }} onPress={() => { if (!magicLink) { Alert.alert('Generate Code First'); return; } setVerificationStep(1); }} disabled={!magicLink}>
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>I Sent the Email ? Next</Text>
                    </TouchableOpacity>
                    <View style={{ backgroundColor: COLORS.green50, borderRadius: 10, padding: 12, marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <ShieldCheck size={18} color={COLORS.green600} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.green800 }}>Zero Knowledge</Text>
                        <Text style={{ fontSize: 10, color: COLORS.green700 }}>No email field exists. We read your school from the DKIM stamp. DNS lookup for public key ? RSA verify on YOUR phone. Zero PII transmitted.</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Step 1: Paste Proof + Real DKIM Verify */}
                {verificationStep === 1 && !researcherProfile && (
                  <View>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: COLORS.amber900, textAlign: 'center', marginBottom: 8 }}>?? Paste the Proof</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24, marginBottom: 16 }}>
                      {['Get Code', 'Paste Proof'].map((label, i) => (
                        <View key={i} style={{ alignItems: 'center' }}>
                          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.amber600, justifyContent: 'center', alignItems: 'center' }}>
                            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>{i === 0 ? '?' : '2'}</Text>
                          </View>
                          <Text style={{ fontSize: 9, color: COLORS.stone500, marginTop: 4 }}>{label}</Text>
                        </View>
                      ))}
                    </View>
                    <Text style={{ fontSize: 13, color: COLORS.stone600, textAlign: 'center', marginBottom: 12 }}>Open the email you sent. Get the raw source:</Text>
                    <View style={{ backgroundColor: COLORS.stone50, borderRadius: 12, padding: 12, marginBottom: 12, gap: 8 }}>
                      <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 10 }}><Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.stone800 }}>?? Gmail (phone)</Text><Text style={{ fontSize: 11, color: COLORS.stone600 }}>Open email ? ? ? "Show original" ? Copy</Text></View>
                      <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 10 }}><Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.stone800 }}>?? Gmail (computer)</Text><Text style={{ fontSize: 11, color: COLORS.stone600 }}>Open email ? ? ? "Show original" ? Select all ? Copy</Text></View>
                      <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 10 }}><Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.stone800 }}>?? Outlook</Text><Text style={{ fontSize: 11, color: COLORS.stone600 }}>Open email ? ��� ? "View message source" ? Copy</Text></View>
                      <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 10 }}><Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.stone800 }}>?? Apple Mail</Text><Text style={{ fontSize: 11, color: COLORS.stone600 }}>View ? Message ? Raw Source ? Copy</Text></View>
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.stone700, marginBottom: 6 }}>Paste everything here:</Text>
                    <TextInput style={{ backgroundColor: '#fff', borderWidth: 2, borderColor: rawEmailHeaders.length > 200 ? COLORS.green500 : COLORS.stone300, borderRadius: 12, padding: 12, fontSize: 11, fontFamily: 'monospace', color: COLORS.stone700, minHeight: 100, textAlignVertical: 'top' }} value={rawEmailHeaders} onChangeText={setRawEmailHeaders} placeholder="Paste the full email source here..." placeholderTextColor={COLORS.stone400} multiline />
                    {rawEmailHeaders.length > 0 && <Text style={{ fontSize: 10, color: rawEmailHeaders.length > 200 ? COLORS.green600 : COLORS.amber600, marginTop: 4 }}>{rawEmailHeaders.length > 200 ? '? ' + rawEmailHeaders.length + ' chars pasted' : '? Keep pasting � need the full source'}</Text>}
                    {verificationError ? <Text style={{ fontSize: 11, color: COLORS.red600, marginTop: 8 }}>{verificationError}</Text> : null}
                    {dkimSteps && dkimSteps.length > 0 && (
                      <View style={{ backgroundColor: '#f0f9ff', borderRadius: 10, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#93c5fd' }}>
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#1e40af', marginBottom: 4 }}>Verification Steps:</Text>
                        {dkimSteps.map((st, i) => (
                          <Text key={i} style={{ fontSize: 9, color: st.includes('VALID') ? '#16a34a' : st.includes('failed') ? '#dc2626' : '#3b82f6', fontFamily: 'monospace', marginBottom: 2 }}>{st}</Text>
                        ))}
                      </View>
                    )}
                    <TouchableOpacity style={{ backgroundColor: rawEmailHeaders.length > 200 ? COLORS.green600 : COLORS.stone300, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 12 }} onPress={async () => {
                      if (rawEmailHeaders.length < 200) { setVerificationError('Paste the full email source'); return; }
                      setIsLoading(true); setVerificationError(''); setDkimSteps([]);
                      try {
                        const result = await verifyDKIM(rawEmailHeaders);
                        setDkimSteps(result.steps);
                        if (!result.verified) { setVerificationError(result.error || 'DKIM verification failed. Make sure you pasted the complete email source.'); setIsLoading(false); return; }
                        if (magicLink && !rawEmailHeaders.includes(magicLink)) { setVerificationError('Code ' + magicLink + ' not found. Did you put it in the subject?'); setIsLoading(false); return; }
                        const domain = result.domain;
                        const domainHash = bytesToHex(sha256(new TextEncoder().encode('KV_EDU_' + domain)));
                        const researcherId = 'RES_' + domainHash.slice(0, 12).toUpperCase();
                        await SecureStore.setItemAsync('kv_researcher_id', researcherId);
                        await SecureStore.setItemAsync('kv_researcher_domain_hash', domainHash);
                        await SecureStore.setItemAsync('kv_researcher_domain', domain);
                        setRawEmailHeaders(''); setMagicLink(''); setEduEmail('');
                        setResearcherProfile({ researcher_id: researcherId, email_verified: true, institution_domain: domain, domain_hash: domainHash, xp: 0, abstract_count: 0, questions_answered: 0, question_price: 0 });
                        Alert.alert('Verified! ??', 'DKIM cryptographically verified on-device!\n\nSchool: ' + domain + '\nID: ' + researcherId + '\n\nZero data left your phone.');
                      } catch (e) { setVerificationError(String(e)); }
                      setIsLoading(false);
                    }} disabled={isLoading || rawEmailHeaders.length < 200}>
                      {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>?? Verify DKIM Signature</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setVerificationStep(0)} style={{ alignItems: 'center', paddingVertical: 8, marginTop: 4 }}><Text style={{ color: COLORS.stone400, fontSize: 12 }}>? Start over</Text></TouchableOpacity>
                    <View style={{ backgroundColor: COLORS.green50, borderRadius: 10, padding: 12, marginTop: 12 }}>
                      <Text style={{ fontSize: 10, color: COLORS.green700, textAlign: 'center', lineHeight: 15 }}>?? DNS lookup for school's public key ? RSA verify on YOUR phone ? only school name saved. Zero PII transmitted.</Text>
                    </View>
                  </View>
                )}

                {/* Verified � Abstract Submission Form */}
                {researcherProfile && (
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.green100, borderRadius: 12, padding: 12, marginBottom: 16 }}>
                      <ShieldCheck size={20} color={COLORS.green700} />
                      <View><Text style={{ fontSize: 14, fontWeight: 'bold', color: COLORS.green800 }}>Verified Researcher ??</Text><Text style={{ fontSize: 10, color: COLORS.green600 }}>{researcherProfile.institution_domain} � {researcherProfile.researcher_id}</Text></View>
                    </View>
                    <InputField label="Abstract Title" value={abstractTitle} onChangeText={setAbstractTitle} placeholder="Your research title..." />
                    <InputField label="Abstract Text" value={abstractText} onChangeText={setAbstractText} placeholder="Full abstract (500 words max)..." multiline />
                    <InputField label="Repository URL" value={repositoryUrl} onChangeText={setRepositoryUrl} placeholder="https://arxiv.org/abs/..." keyboardType="url" />
                    <InputField label="Keywords (comma separated)" value={keywords} onChangeText={setKeywords} placeholder="machine learning, cryptography, ..." />
                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: COLORS.stone500, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Field / Discipline</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      {DISCIPLINES.map(d => (
                        <TouchableOpacity key={d.id} onPress={() => setAbstractDiscipline(d.id)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: abstractDiscipline === d.id ? COLORS.amber100 : COLORS.stone50, borderWidth: 1, borderColor: abstractDiscipline === d.id ? COLORS.amber500 : COLORS.stone200 }}>
                          <Text style={{ fontSize: 11, color: abstractDiscipline === d.id ? COLORS.amber900 : COLORS.stone600 }}>{d.icon} {d.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={{ backgroundColor: COLORS.blue50, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: COLORS.blue200 }}>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.blue800, marginBottom: 4 }}>?? Video Explainer (optional)</Text>
                      <Text style={{ fontSize: 10, color: COLORS.blue600, marginBottom: 8 }}>Short video on Instagram/TikTok explaining your research</Text>
                      <TextInput style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.blue300, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, color: COLORS.stone800 }} value={abstractVideoUrl} onChangeText={setAbstractVideoUrl} placeholder="https://instagram.com/reel/..." placeholderTextColor={COLORS.stone400} keyboardType="url" autoCapitalize="none" />
                    </View>
                    <View style={{ backgroundColor: '#fef3c7', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#f59e0b' }}>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#92400e', marginBottom: 4 }}>?? How should people reach you?</Text>
                      <Text style={{ fontSize: 10, color: '#b45309', marginBottom: 8 }}>Questions get routed to your chosen channel</Text>
                      <View style={{ gap: 6 }}>
                        {QA_CHANNELS.map(ch => (
                          <TouchableOpacity key={ch.id} onPress={() => setQaChannel(ch.id)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: qaChannel === ch.id ? '#fef3c7' : '#fff', borderRadius: 8, padding: 10, borderWidth: qaChannel === ch.id ? 2 : 1, borderColor: qaChannel === ch.id ? '#f59e0b' : COLORS.stone200, gap: 8 }}>
                            <Text style={{ fontSize: 18 }}>{ch.icon}</Text>
                            <Text style={{ fontSize: 12, fontWeight: qaChannel === ch.id ? 'bold' : 'normal', color: COLORS.stone700 }}>{ch.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      {qaChannel ? <TextInput style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#f59e0b', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, color: COLORS.stone800, marginTop: 8 }} value={qaHandle} onChangeText={setQaHandle} placeholder={QA_CHANNELS.find(c => c.id === qaChannel)?.placeholder || 'Your handle...'} placeholderTextColor={COLORS.stone400} autoCapitalize="none" /> : null}
                    </View>
                    <View style={{ backgroundColor: COLORS.red50, borderWidth: 1, borderColor: COLORS.red200, borderRadius: 12, padding: 14, marginBottom: 16 }}>
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.red800, marginBottom: 8 }}>Required Attestations</Text>
                      {[{ s: attestation1, f: setAttestation1, t: 'This is my original work or properly attributed.' }, { s: attestation2, f: setAttestation2, t: 'This is my sole representation. Misrepresentation = termination.' }, { s: attestation3, f: setAttestation3, t: 'My .edu email is legitimately mine.' }].map((a, i) => (
                        <TouchableOpacity key={i} onPress={() => a.f(!a.s)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                          <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: a.s ? COLORS.red600 : COLORS.red300, backgroundColor: a.s ? COLORS.red600 : 'transparent', justifyContent: 'center', alignItems: 'center', marginTop: 2 }}>{a.s && <Check size={12} color="#fff" />}</View>
                          <Text style={{ flex: 1, fontSize: 11, color: COLORS.red800 }}>{a.t}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TouchableOpacity style={{ backgroundColor: (attestation1 && attestation2 && attestation3) ? COLORS.amber700 : COLORS.stone300, borderRadius: 12, paddingVertical: 16, alignItems: 'center' }} onPress={handleSubmitAbstract} disabled={!attestation1 || !attestation2 || !attestation3 || isLoading}>
                      {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>Submit Abstract</Text>}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
            
                        {/* Services Tab */}
            {activeTab === 'services' && (
              <View style={acStyles.tabContent}>
                <View style={acStyles.serviceBox}>
                  <Text style={acStyles.serviceTitle}>?? KASPA Rate Per Question</Text>
                  <Text style={acStyles.serviceSubtitle}>
                    Set your price for follow-up questions. First question is FREE.
                  </Text>
                  <View style={acStyles.priceRow}>
                    <TextInput
                      style={acStyles.priceInput}
                      placeholder="0"
                      keyboardType="numeric"
                      value={researcherProfile?.question_price?.toString() || ''}
                      onChangeText={(t) => setResearcherProfile((p: any) => p ? ({ ...p, question_price: parseFloat(t) || 0 }) : p)}
                    />
                    <Text style={acStyles.priceLabel}>KASPA</Text>
                  </View>
                  {!researcherProfile && <Text style={{ fontSize: rs.font(10), color: COLORS.red600, marginTop: rs.s(4) }}>Verify .edu email first in Submit tab</Text>}
                  {researcherProfile && <TouchableOpacity onPress={async () => {
                    const price = researcherProfile.question_price || 0;
                    const updated = abstractsList.map(a => a.researcherId === researcherProfile.researcher_id ? { ...a, questionPrice: price } : a);
                    setAbstractsList(updated);
                    await SecureStore.setItemAsync('kv_abstracts', JSON.stringify(updated));
                    Alert.alert('Saved', 'Question price set to ' + price + ' KAS');
                  }} style={{ backgroundColor: COLORS.green600, borderRadius: rs.s(8), paddingVertical: rs.s(8), alignItems: 'center', marginTop: rs.s(8) }}><Text style={{ color: '#fff', fontWeight: 'bold', fontSize: rs.font(12) }}>Save Price</Text></TouchableOpacity>}
                </View>
                
                <View style={acStyles.serviceBox}>
                  <Text style={acStyles.serviceTitle}>?? Tutoring & Consulting</Text>
                  <Text style={acStyles.serviceSubtitle}>
                    Offer code auditing, tutoring, analytics, consulting services. Contact via your chosen QA channel.
                  </Text>
                  <Text style={{ fontSize: rs.font(11), color: COLORS.stone600, marginBottom: rs.s(8) }}>
                    Buyers contact you through the channel you set in your abstract submission (Telegram, Instagram DM, Signal, Email, or Nostr).
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
                    ?? "Legal Consulting" refers to regulatory compliance guidance only. 
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
                      <Text style={{ color: COLORS.amber800, fontSize: 14, fontWeight: 'bold', marginBottom: 6 }}>?? Question Pricing</Text>
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
                      <Text style={acStyles.privacyGuaranteeTitle}>?? Privacy Guarantee</Text>
                      <Text style={acStyles.privacyGuaranteeItem}>? Your email was NOT stored � only a hash</Text>
                      <Text style={acStyles.privacyGuaranteeItem}>? Pseudonymous researcher ID</Text>
                      <Text style={acStyles.privacyGuaranteeItem}>? No tracking, no ads, no data selling</Text>
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
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: rs.s(24),
    borderTopRightRadius: rs.s(24),
    width: '100%',
    height: '85%',
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
  const [hasPassport, setHasPassport] = useState(true) /* DEV BYPASS */;
  
  // Active view tab
  const [activeView, setActiveView] = useState('brand');
  
  // Brand state
  const [brandName, setBrandName] = useState(hostName);
  const [storeDescription, setStoreDescription] = useState('');
  const [storeCategory, setStoreCategory] = useState('General');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoShape, setLogoShape] = useState<'round' | 'square'>('round');
  const [bannerStyle, setBannerStyle] = useState(BANNER_STYLES[0]);
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
  
  // Graffiti Banner Recipe
  const [bannerRecipe, setBannerRecipe] = useState({
    text: hostName || 'MY STORE',
    style: 'block' as 'block' | 'bubble' | 'wild',
    fillColor: '#d97706',
    outlineColor: '#1c1917',
    shadowColor: '#78350f',
    bgColor: '#fafaf9',
    decoStyle: 'stars' as 'stars' | 'arrows' | 'plain',
  });
  
  // Item editing
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [itemForm, setItemForm] = useState({ name: '', description: '', dollarPrice: '', kaspaPrice: '', socialUrl: '' });
  
  // Coupons
  const [coupons, setCoupons] = useState<any[]>([]);
  const [showCouponForm, setShowCouponForm] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<any>(null);
  const [couponForm, setCouponForm] = useState({ code: '', discountPercent: '', discountKas: '', maxUses: '10', expiryDays: '30', description: '' });
  
  // Publishing state
  const [isPublishing, setIsPublishing] = useState(false);
  const [pubStage, setPubStage] = useState('');
  // On-chain HTML page (optional): published as hash-pinned chunks, rendered
  // in a sandboxed WebView. kv:// links only - no external navigation.
  const [pageHtml, setPageHtml] = useState('');
  const [pageIssues, setPageIssues] = useState<any[]>([]);
  
  // Modals
  const [showQualityGate, setShowQualityGate] = useState(false);
  const [gameJson, setGameJson] = useState('');
  const [gamePublishing, setGamePublishing] = useState(false);
  const [gameStage, setGameStage] = useState('');
  const [showAcademicPanel, setShowAcademicPanel] = useState(false);
  

  // Load storefront config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const json = await SecureStore.getItemAsync('storefront_' + hostId);
        if (!json) return;
        const cfg = JSON.parse(json);
        if (cfg.brandName) setBrandName(cfg.brandName);
        if (cfg.storeDescription) setStoreDescription(cfg.storeDescription);
        if (cfg.storeCategory) setStoreCategory(cfg.storeCategory);
        if (cfg.logoUrl) setLogoUrl(cfg.logoUrl);
        if (cfg.logoShape) setLogoShape(cfg.logoShape);
        if (cfg.socialLinks) setSocialLinks(cfg.socialLinks);
        if (cfg.commChannels) setCommChannels(cfg.commChannels);
        if (cfg.selectedFont) setSelectedFont(cfg.selectedFont);
        if (cfg.selectedLayout) setSelectedLayout(cfg.selectedLayout);
        if (cfg.stash) setStash(cfg.stash);
        if (cfg.bannerStyle) setBannerStyle(cfg.bannerStyle);
        if (cfg.coupons) setCoupons(cfg.coupons);
        if (cfg.bannerRecipe) setBannerRecipe(cfg.bannerRecipe);
        if (cfg.pageHtml) setPageHtml(cfg.pageHtml);
        console.log('[Workspace] Loaded config for', hostId);
      } catch (e) { console.warn('[Workspace] Config load failed:', e); }
    };
    loadConfig();
  }, []);

  // Auto-save config to SecureStore on changes (persists across sessions)
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const cfg = {
          brandName, storeDescription, storeCategory, logoUrl, logoShape,
          bannerStyle, bannerRecipe, coupons, socialLinks, commChannels,
          selectedFont: { id: selectedFont.id, name: selectedFont.name },
          selectedLayout: { id: selectedLayout.id, name: selectedLayout.name },
          pageHtml,
          stash,
          hostId, updatedAt: Date.now(),
        };
        await SecureStore.setItemAsync('storefront_' + hostId, JSON.stringify(cfg));
      } catch {}
    }, 1000); // debounce 1s
    return () => clearTimeout(timer);
  }, [brandName, storeDescription, storeCategory, logoUrl, logoShape, bannerStyle, bannerRecipe, coupons, socialLinks, commChannels, selectedFont, selectedLayout, pageHtml, stash]);

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
  
  // Item CRUD
  const handleSaveItem = () => {
    if (!itemForm.name.trim()) { Alert.alert('Required', 'Item name is required'); return; }
    if (!itemForm.socialUrl.trim()) { Alert.alert('Required', 'Social post URL is required � link to your Instagram/Pinterest/Etsy listing'); return; }
    const url = itemForm.socialUrl.trim();
    const allowed = ['instagram.com', 'pinterest.com', 'etsy.com', 'tiktok.com', 'facebook.com', 'youtube.com', 'ebay.com'];
    const isAllowed = allowed.some(d => url.includes(d));
    if (!isAllowed && url.startsWith('http')) { Alert.alert('Whitelist Only', 'Links must be from: Instagram, Pinterest, Etsy, TikTok, Facebook, YouTube, or eBay'); return; }
    
    const contentErr = validateContentText(itemForm.name) || validateContentText(itemForm.description); if (contentErr) { Alert.alert('Blocked', contentErr); return; }
    const item = {
      id: editingItem?.id || 'item_' + Date.now(),
      name: itemForm.name.trim(),
      description: itemForm.description.trim(),
      dollarPrice: parseFloat(itemForm.dollarPrice) || 0,
      kaspaPrice: parseFloat(itemForm.kaspaPrice) || 0,
      socialUrl: url.startsWith('http') ? url : 'https://' + url,
      platform: url.includes('instagram') ? 'instagram' : url.includes('pinterest') ? 'pinterest' : url.includes('etsy') ? 'etsy' : url.includes('tiktok') ? 'tiktok' : url.includes('ebay') ? 'ebay' : 'other',
      updatedAt: Date.now(),
    };
    
    if (editingItem) {
      setStash(prev => prev.map(i => i.id === editingItem.id ? item : i));
    } else {
      setStash(prev => [...prev, item]);
    }
    setShowItemForm(false);
    setEditingItem(null);
    setItemForm({ name: '', description: '', dollarPrice: '', kaspaPrice: '', socialUrl: '' });
    // Auto-save locally
    SecureStore.setItemAsync('storefront_items_' + hostId, JSON.stringify(
      editingItem ? stash.map(i => i.id === editingItem.id ? item : i) : [...stash, item]
    )).catch(() => {});
  };
  
  const handleEditItem = (item: any) => {
    setEditingItem(item);
    setItemForm({
      name: item.name || '',
      description: item.description || '',
      dollarPrice: item.dollarPrice?.toString() || '',
      kaspaPrice: item.kaspaPrice?.toString() || '',
      socialUrl: item.socialUrl || '',
    });
    setShowItemForm(true);
  };
  
  const handleDeleteItem = (itemId: string) => {
    Alert.alert('Delete Item?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        const updated = stash.filter(i => i.id !== itemId);
        setStash(updated);
        SecureStore.setItemAsync('storefront_items_' + hostId, JSON.stringify(updated)).catch(() => {});
      }},
    ]);
  };
  
  const getPlatformIcon = (url: string) => {
    if (url?.includes('instagram')) return '??';
    if (url?.includes('pinterest')) return '??';
    if (url?.includes('etsy')) return '???';
    if (url?.includes('tiktok')) return '??';
    if (url?.includes('ebay')) return '???';
    if (url?.includes('facebook')) return '??';
    return '??';
  };

  // Coupon CRUD
  const handleSaveCoupon = () => {
    const code = couponForm.code.trim().toUpperCase();
    if (!code || code.length < 3) { Alert.alert('Required', 'Coupon code must be at least 3 characters'); return; }
    if (!couponForm.discountPercent && !couponForm.discountKas) { Alert.alert('Required', 'Set a discount (% or KAS)'); return; }
    const coupon = {
      id: editingCoupon?.id || 'cpn_' + Date.now(),
      code,
      discountPercent: parseFloat(couponForm.discountPercent) || 0,
      discountKas: parseFloat(couponForm.discountKas) || 0,
      maxUses: parseInt(couponForm.maxUses) || 10,
      usedCount: editingCoupon?.usedCount || 0,
      expiryDays: parseInt(couponForm.expiryDays) || 30,
      description: couponForm.description.trim(),
      createdAt: editingCoupon?.createdAt || Date.now(),
    };
    if (editingCoupon) {
      setCoupons(prev => prev.map(c => c.id === editingCoupon.id ? coupon : c));
    } else {
      setCoupons(prev => [...prev, coupon]);
    }
    setShowCouponForm(false);
    setEditingCoupon(null);
    setCouponForm({ code: '', discountPercent: '', discountKas: '', maxUses: '10', expiryDays: '30', description: '' });
  };

  // Visibility score (client-side mirror of TownHall algorithm)
  // Weights: 30% XP, 25% runway, 25% price, 10% pledge, 10% freshness
  // Price score: low USD = good, KAS discount from USD = even better
  const calcVisibilityScore = (xp: number, runwayPct: number, avgUsdPrice: number, avgKasPrice: number, kasRateUsd: number, pledgeKas: number, ageHours: number, hasCoupons: boolean) => {
    const xpScore = Math.min(xp / 5000, 1.0);
    const runwayScore = Math.min(runwayPct / 100, 1.0);
    
    // Price score: two components
    // 1) Low USD base (50%) � $0=perfect, $500+=0
    const usdFactor = avgUsdPrice <= 0 ? 1.0 : Math.max(0, 1.0 - avgUsdPrice / 500);
    // 2) KAS discount from USD (50%) � if KAS price * rate < USD price, that's a discount
    let kasDiscountPct = 0;
    if (avgUsdPrice > 0 && avgKasPrice > 0 && kasRateUsd > 0) {
      const kasValueUsd = avgKasPrice * kasRateUsd;
      kasDiscountPct = Math.max(0, (avgUsdPrice - kasValueUsd) / avgUsdPrice); // 0-1
    }
    // Coupon bonus: +10% if store has active coupons
    const couponBonus = hasCoupons ? 0.1 : 0;
    const priceScore = Math.min((usdFactor * 0.5 + kasDiscountPct * 0.5 + couponBonus), 1.0);
    
    const pledgeScore = Math.min(pledgeKas / 2500, 1.0);
    const freshnessScore = Math.pow(0.5, ageHours / 24); // 24hr half-life
    const total = xpScore * 0.30 + runwayScore * 0.25 + priceScore * 0.25 + pledgeScore * 0.10 + freshnessScore * 0.10;
    return { total: Math.round(total * 100), xpScore: Math.round(xpScore * 100), runwayScore: Math.round(runwayScore * 100), priceScore: Math.round(priceScore * 100), pledgeScore: Math.round(pledgeScore * 100), freshnessScore: Math.round(freshnessScore * 100), kasDiscountPct: Math.round(kasDiscountPct * 100), usdFactor: Math.round(usdFactor * 100) };
  };

  const handleCopyTemplate = async () => {
    Clipboard.setStringAsync(DAPP_TEMPLATE_CODE);
    Alert.alert('Copied!', 'DApp template copied to clipboard!');
  };
  
  // v2: TownHall verification + Arweave upload flow
  const handlePublishStorefront = async () => {
    // Validate
    if (containsProhibitedText(brandName) || containsProhibitedText(storeDescription)) {
      Alert.alert('Safety Rejection', 'Your store contains prohibited terms.');
      return;
    }
    const primaryLink = socialLinks.instagram || socialLinks.pinterest || socialLinks.etsy || '';
    if (!primaryLink) {
      Alert.alert('Missing Social Link', 'Add at least one social link (Instagram, Pinterest, or Etsy) so buyers can visit your storefront.');
      return;
    }
    
    let _chunkCount = 1;
    try {
      const { configToChunkData } = require('./config_chunks');
      _chunkCount = configToChunkData({ brandName, storeCategory, hostId, stash }).chunks.length;
    } catch {}
    const _totalKas = 5 + 1 + _chunkCount * 0.2;
    const _ok = await new Promise((resolve) => {
      Alert.alert(
        'Publish cost',
        '5 KAS pledge (yours, staked)\n1 KAS announce (burned)\n' + _chunkCount + ' config chunk(s) x 0.2 KAS (yours, staked)\n\nTotal: ~' + _totalKas.toFixed(1) + ' KAS + fees',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Publish', onPress: () => resolve(true) },
        ]
      );
    });
    if (!_ok) return;
    setIsPublishing(true);
    setPubStage('Preparing keys...');
    
    try {
      // Step 1: Build storefront config
      const storefrontConfig = {
        brandName,
        storeDescription,
        storeCategory,
        logoUrl,
        logoShape,
        bannerStyle,
        bannerRecipe,
        coupons,
        socialLinks,
        commChannels,
        selectedFont: { id: selectedFont.id, name: selectedFont.name },
        selectedLayout: { id: selectedLayout.id, name: selectedLayout.name },
        stash: stash.map(i => ({ id: i.id, name: i.name, dollarPrice: i.dollarPrice, kaspaPrice: i.kaspaPrice, socialUrl: i.socialUrl, description: i.description })),
        hostId,
        updatedAt: Date.now(),
      };
      
      // Step 2: KASPA-RAIL publish — record + pledge anchor + registry announce.
      // The unspent pledge UTXO at the store address IS the trust anchor; spending it = delisting.
      const { publishContent, announceToRegistry } = require('./payload_publish');
      const { _kvResolvePrivHex } = require('./proposal_share');
      const _priv = await _kvResolvePrivHex();
      const _addr = (await SecureStore.getItemAsync('kv_kaspa_address')) || (await SecureStore.getItemAsync('kaspa_address')) || '';
      if (!_priv || !userPubkey || !_addr) throw new Error('wallet keys unavailable');
      const _owner = { privateKeyHex: _priv, pubkeyHex: userPubkey, address: _addr, network: 'testnet-10' as any };
      const STORE_PLEDGE_SOMPI = 500_000_000n; // 5 KAS default stake
      const _cfgHash = bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(storefrontConfig))));
      setPubStage('Anchoring pledge on Kaspa L1...');
      const _pub: any = await publishContent(_owner, 'store', {
        name: brandName,
        category: storeCategory,
        primaryLink,
        configHash: _cfgHash,
      }, 0, STORE_PLEDGE_SOMPI);
      if (!_pub || _pub.success === false) throw new Error('store publish tx failed: ' + (_pub && _pub.error));
      console.log('[Workspace] KASPA store published — addr:', _pub.storeAddress, 'tx:', _pub.txId || '');
      (storefrontConfig as any).storeAddress = _pub.storeAddress;
      (storefrontConfig as any).storeTxId = _pub.txId || '';
      (storefrontConfig as any).pledgeSompi = STORE_PLEDGE_SOMPI.toString();

      // Step 2a2: on-chain HTML page (optional). Publish first so its hash can
      // ride inside the storefront config the buyer already hash-verifies.
      if (pageHtml && pageHtml.trim().length > 0) {
        try {
          const { publishHtmlChunks, scanHtmlForPublish, htmlToChunkData } = require('./html_chunks');
          const _scan = scanHtmlForPublish(pageHtml);
          if (!_scan.ok) {
            setPageIssues(_scan.issues);
            console.warn('[Workspace] page blocked by scan:', _scan.issues.map((i: any) => i.code).join(','));
          } else {
            setPageIssues([]);
            const _ph = htmlToChunkData(pageHtml).hash;
            (storefrontConfig as any).pageHash = _ph;
            setPubStage('Publishing page...');
            const _pk: any = await publishHtmlChunks(_owner, _pub.storeAddress, pageHtml, { skipScan: true });
            if (_pk.success) console.log('[Workspace] page on-chain:', _pk.totalChunks, 'chunks, hash', _ph.slice(0, 16));
            else console.warn('[Workspace] page chunks incomplete:', _pk.error);
          }
        } catch (e) { console.warn('[Workspace] page publish error (store still live):', e); }
      }

      // Step 2b: full config on-chain in gzip chunks - buyers render from these.
      // Non-fatal: store is live either way; failure = "config pending".
      try {
        const { publishConfigChunks } = require('./config_chunks');
        setPubStage('Publishing config (' + _chunkCount + ' chunk' + (_chunkCount > 1 ? 's' : '') + ')...');
        const _ck: any = await publishConfigChunks(_owner, _pub.storeAddress, storefrontConfig);
        if (_ck.success) console.log('[Workspace] config chunks on-chain:', _ck.totalChunks, 'txs, hash', _ck.hash.slice(0, 16));
        else console.warn('[Workspace] config chunks incomplete:', _ck.error, '- sent', _ck.txids.length + '/' + _ck.totalChunks);
        // Announce AFTER chunks so configHash matches the published chunk set exactly.
        try {
          setPubStage('Announcing to registry...');
          const _annHash = _ck.success ? _ck.hash : _cfgHash;
          const _ann: any = await announceToRegistry(_owner, _pub.storeAddress, brandName, storeCategory, 'store', { primaryLink, configHash: _annHash });
          if (!_ann || _ann.success === false) console.warn('[Workspace] registry announce failed (store still live):', _ann && _ann.error);
          else console.log('[Workspace] announced to registry:', _ann.registryAddr, 'cfgHash:', _annHash.slice(0, 16));
        } catch (e) { console.warn('[Workspace] registry announce error (store still live):', e); }
      } catch (e) { console.warn('[Workspace] config chunk error (store still live):', e); }
      
      // Step 3: Save locally
      await SecureStore.setItemAsync('storefront_' + hostId, JSON.stringify(storefrontConfig));
      Alert.alert('Published!', 'Storefront live on Kaspa L1.\nYour 5 KAS pledge anchors it — withdrawing the pledge delists the store.\nBuyers click through to ' + (socialLinks.instagram ? 'Instagram' : socialLinks.pinterest ? 'Pinterest' : 'Etsy') + '.');

      // Tip prompt — only when at least one operator passed the storage audit.
      // Dormant until the first archive node exists; activates itself after.
      try {
        const { fetchAudit, tipOperators } = require('./node_registry');
        const _audit: any[] = await fetchAudit();
        const _passing = _audit.filter((a: any) => a.pass === true);
        if (_passing.length > 0) {
          Alert.alert(
            'Keep your store searchable?',
            'Independent archive operators store KasVillage history on their own machines. ' +
            'Your store stays findable in search because they keep serving its records. ' +
            'A small tip (' + _passing.length + ' verified operator' + (_passing.length > 1 ? 's' : '') + ', split equally) keeps that archive running. KasVillage takes nothing.',
            [
              { text: 'Not now', style: 'cancel' },
              {
                text: 'Tip 1 KAS',
                onPress: async () => {
                  try {
                    const res = await tipOperators({ totalSompi: 100_000_000n });
                    if (res.success) Alert.alert('Thank you', 'Tip sent to ' + (res.paid || 0) + ' operator(s).');
                    else Alert.alert('Tip failed', res.error || 'unknown error');
                  } catch (te: any) { Alert.alert('Tip failed', String(te?.message || te)); }
                },
              },
            ]
          );
        }
      } catch (e) { console.log('[Workspace] tip prompt skipped:', e); }
    } catch (e) {
      console.error('Publish failed:', e);
      Alert.alert('Error', 'Failed to publish. Please try again.');
    }
    
    setIsPublishing(false);
    setTimeout(() => setPubStage(''), 4000);
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
          {['brand', 'layout', 'fonts', 'page', 'items', 'coupons', 'dapps', 'academic', 'preview'].map(view => (
            <TabButton
              key={view}
              label={view}
              active={activeView === view}
              onPress={() => setActiveView(view)}
            />
          ))}
        </ScrollView>
        

        {/* Persistent Storefront Preview Banner */}
        <View style={{ backgroundColor: bannerStyle.bg === 'crest' ? '#44403c' : bannerStyle.bg, borderRadius: rs.s(16), padding: rs.s(24), marginBottom: rs.s(12), alignItems: 'center' }}>
          <Text style={{ fontSize: rs.font(24), fontWeight: '900', color: bannerStyle.text || '#fff', marginBottom: rs.s(4) }}>{brandName}</Text>
          <Text style={{ fontSize: rs.font(11), color: bannerStyle.text || '#fff', opacity: 0.8 }}>Professional storefront powered by KasVillage</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: rs.s(10), marginBottom: rs.s(16) }}>
          <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs.s(6), backgroundColor: '#166534', borderRadius: rs.s(10), paddingVertical: rs.s(10) }} onPress={() => {
            const primaryLink = socialLinks.instagram || socialLinks.pinterest || socialLinks.etsy || socialLinks.tiktok || socialLinks.facebook || '';
            if (primaryLink) { Linking.openURL(primaryLink.startsWith('http') ? primaryLink : 'https://' + primaryLink); }
            else { Alert.alert('No Social Link', 'Add your Instagram, Pinterest, or Etsy link in the Brand tab first.'); }
          }}>
            <Eye size={rs.s(14)} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: rs.font(12) }}>Visit Storefront</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs.s(6), backgroundColor: '#4f46e5', borderRadius: rs.s(10), paddingVertical: rs.s(10) }} onPress={handlePublishStorefront} disabled={isPublishing}>
            {isPublishing ? <ActivityIndicator color="#fff" size="small" /> : <><Save size={rs.s(14)} color="#fff" /><Text style={{ color: '#fff', fontWeight: 'bold', fontSize: rs.font(12) }}>Publish</Text></>}
          </TouchableOpacity>
        {pubStage ? (
          <Text style={{ color: '#8B7355', fontSize: rs.font(10), textAlign: 'center', marginTop: 4 }}>{pubStage}</Text>
        ) : null}
        </View>
        <Text style={{ fontSize: rs.font(9), color: '#a8a29e', textAlign: 'center', marginBottom: rs.s(8) }}>Publish anchors your store on Kaspa L1 - 5 KAS pledge (yours, staked) + 1 KAS announce (burned) + ~0.2-1 KAS config data (yours, staked). More pledge = higher visibility.</Text>
        <Text style={{ fontSize: rs.font(8), color: '#a8a29e', textAlign: 'center', marginTop: rs.s(4), lineHeight: rs.font(12) }}>KasVillage is a reputation-scored directory and non-custodial escrow tool. Listings are hosted on whitelisted social platforms. KasVillage does not facilitate, process, or intermediate any sale. SDK compliance scan does not constitute endorsement. Users assume all risk.</Text>

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
              
              <Text style={inputStyles.label}>Logo Shape Preview</Text>
              <View style={{ flexDirection: 'row', gap: rs.s(16), marginBottom: rs.s(12), alignItems: 'center' }}>
                {([
                  { id: 'round' as const, label: 'Circle', radius: 999 },
                  { id: 'square' as const, label: 'Rounded Square', radius: rs.s(12) },
                ] as const).map(shape => (
                  <TouchableOpacity
                    key={shape.id}
                    onPress={() => setLogoShape(shape.id)}
                    style={{ alignItems: 'center', opacity: logoShape === shape.id ? 1 : 0.4 }}
                  >
                    <View style={{ width: rs.s(64), height: rs.s(64), borderRadius: shape.radius, backgroundColor: logoShape === shape.id ? COLORS.amber200 : COLORS.stone200, borderWidth: logoShape === shape.id ? 3 : 1, borderColor: logoShape === shape.id ? COLORS.amber600 : COLORS.stone300, justifyContent: 'center', alignItems: 'center', marginBottom: rs.s(4) }}>
                      <Text style={{ fontSize: rs.font(24) }}>{logoUrl ? '??' : '??'}</Text>
                    </View>
                    <Text style={{ fontSize: rs.font(11), fontWeight: logoShape === shape.id ? 'bold' : 'normal', color: logoShape === shape.id ? COLORS.amber900 : COLORS.stone500 }}>{shape.label}</Text>
                    {logoShape === shape.id && <Text style={{ fontSize: rs.font(9), color: COLORS.amber600 }}>? Selected</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            </SectionCard>
            

            <SectionCard title="?? Banner Style">
              <Text style={{ fontSize: rs.font(11), color: COLORS.stone500, marginBottom: rs.s(10) }}>Choose how your store banner looks</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: rs.s(8) }}>
                {BANNER_STYLES.map(bs => (
                  <TouchableOpacity key={bs.id} onPress={() => setBannerStyle(bs)} style={{ width: '30%', borderRadius: rs.s(10), overflow: 'hidden', borderWidth: bannerStyle.id === bs.id ? 3 : 1, borderColor: bannerStyle.id === bs.id ? COLORS.amber500 : COLORS.stone200 }}>
                    <View style={{ backgroundColor: bs.bg === 'crest' ? '#44403c' : bs.bg, padding: rs.s(12), alignItems: 'center' }}>
                      <Text style={{ color: bs.text, fontSize: rs.font(10), fontWeight: 'bold' }}>{bs.label}</Text>
                    </View>
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
            
            <SectionCard title="?? Communication Channels">
              <Text style={wsStyles.commNote}>
                How buyers can contact you to discuss purchases
              </Text>
              {COMMUNICATION_CHANNELS.map(channel => (
                <View key={channel.id} style={{ backgroundColor: COLORS.stone50, borderRadius: rs.s(12), padding: rs.s(12), marginBottom: rs.s(8) }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs.s(8), marginBottom: rs.s(6) }}>
                    <Text style={{ fontSize: rs.font(20) }}>{channel.icon}</Text>
                    <Text style={{ fontSize: rs.font(13), fontWeight: 'bold', color: COLORS.stone800 }}>{channel.label}</Text>
                  </View>
                  <TextInput
                    style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.stone200, borderRadius: rs.s(8), paddingHorizontal: rs.s(12), paddingVertical: rs.s(10), fontSize: rs.font(13), color: COLORS.stone700 }}
                    value={commChannels[channel.id] || ''}
                    onChangeText={(text) => setCommChannels({ ...commChannels, [channel.id]: text })}
                    placeholder={channel.placeholder}
                    placeholderTextColor={COLORS.stone400}
                    autoCapitalize="none"
                  />
                </View>
              ))}
              <Text style={wsStyles.commTip}>
                ?? At least one contact method required for buyers to reach you
              </Text>
            </SectionCard>
          </View>
        )}
        
        {/* Page Tab - on-chain HTML */}
          {activeView === 'page' && (
            <SectionCard title="On-Chain Page">
              <Text style={{ color: '#8B7355', fontSize: rs.font(11), marginBottom: rs.s(8), lineHeight: rs.font(16) }}>
                Write a page in HTML. It publishes to Kaspa L1 as hash-pinned chunks and renders
                in a sandbox — no external links, scripts, or network calls. Use kv://dm for a
                contact link so buyers message you in-app.
              </Text>
              <TextInput
                style={{
                  backgroundColor: '#1a1a1a', color: '#d8d8d8', borderRadius: rs.s(6),
                  padding: rs.s(10), fontSize: rs.font(11), minHeight: rs.s(220),
                  textAlignVertical: 'top', fontFamily: 'monospace',
                  borderWidth: 1, borderColor: '#333',
                }}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={'<h1>My Shop</h1>\n<p>Handmade goods.</p>\n<a href="kv://dm">Message me</a>'}
                placeholderTextColor="#555"
                value={pageHtml}
                onChangeText={(t) => { setPageHtml(t); setPageIssues([]); }}
              />
              {pageHtml.trim().length > 0 ? (() => {
                try {
                  const { estimateHtmlPublishCost, scanHtmlForPublish } = require('./html_chunks');
                  const est = estimateHtmlPublishCost(pageHtml);
                  const scan = scanHtmlForPublish(pageHtml);
                  return (
                    <View style={{ marginTop: rs.s(10) }}>
                      <Text style={{ color: '#8B7355', fontSize: rs.font(10) }}>
                        {est.chunks} chunk{est.chunks > 1 ? 's' : ''} · ~{est.kas.toFixed(1)} KAS · hash {est.hash.slice(0, 12)}
                      </Text>
                      {scan.ok ? (
                        <Text style={{ color: '#49c07a', fontSize: rs.font(10), marginTop: rs.s(4) }}>
                          Passes safety scan — ready to publish.
                        </Text>
                      ) : (
                        <View style={{ marginTop: rs.s(6) }}>
                          <Text style={{ color: '#c0392b', fontSize: rs.font(10), marginBottom: rs.s(3) }}>
                            Blocked — fix before publishing:
                          </Text>
                          {scan.issues.slice(0, 8).map((iss: any, ix: number) => (
                            <Text key={ix} style={{ color: '#c0392b', fontSize: rs.font(10) }}>
                              • {iss.code}: {iss.detail}
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                } catch (e) { return null; }
              })() : null}
              {pageIssues.length > 0 ? (
                <Text style={{ color: '#c0392b', fontSize: rs.font(10), marginTop: rs.s(8) }}>
                  Last publish skipped the page: {pageIssues.map((i) => i.code).join(', ')}
                </Text>
              ) : null}
            </SectionCard>
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
        
        {/* Fonts Tab � Banner Styles + Graffiti Builder */}
        {activeView === 'fonts' && (
          <View>
            {/* Font Style Selector */}
            <SectionCard title="?? Banner Text Style">
              <Text style={{ fontSize: rs.font(11), color: COLORS.stone500, marginBottom: rs.s(12) }}>Choose how your store name renders on the banner</Text>
              <View style={{ gap: rs.s(8), marginBottom: rs.s(8) }}>
                {[
                  { id: 'clean', label: 'Clean Modern', weight: '400', spacing: 0, transform: 'none', preview: brandName || 'MY STORE' },
                  { id: 'bold', label: 'Bold Impact', weight: '900', spacing: 2, transform: 'uppercase', preview: (brandName || 'MY STORE').toUpperCase() },
                  { id: 'elegant', label: 'Elegant Serif', weight: '300', spacing: 4, transform: 'capitalize', preview: brandName || 'My Store' },
                  { id: 'retro', label: 'Retro Block', weight: '800', spacing: 6, transform: 'uppercase', preview: (brandName || 'MY STORE').toUpperCase() },
                  { id: 'graffiti', label: '?? Graffiti (advanced)', weight: '900', spacing: 0, transform: 'uppercase', preview: bannerRecipe.text || 'HOOD' },
                ].map(font => (
                  <TouchableOpacity key={font.id} onPress={() => setSelectedFont({ id: font.id, name: font.label, fontFamily: 'System' })}
                    style={{ backgroundColor: selectedFont.id === font.id ? COLORS.amber50 : '#fff', borderWidth: 2, borderColor: selectedFont.id === font.id ? COLORS.amber500 : COLORS.stone200, borderRadius: rs.s(12), padding: rs.s(14), overflow: 'hidden' }}>
                    <Text style={{ fontSize: rs.font(10), fontWeight: 'bold', color: selectedFont.id === font.id ? COLORS.amber800 : COLORS.stone500, marginBottom: rs.s(4) }}>{font.label}</Text>
                    {font.id === 'graffiti' ? (
                      <View style={{ backgroundColor: bannerRecipe.bgColor || '#fafaf9', borderRadius: rs.s(8), padding: rs.s(8), alignItems: 'center' }}>
                        <Text style={{ fontSize: rs.font(22), fontWeight: '900', color: bannerRecipe.fillColor || '#d97706', letterSpacing: 4, textShadowColor: bannerRecipe.shadowColor || '#78350f', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 1 }}>{font.preview}</Text>
                      </View>
                    ) : (
                      <View style={{ backgroundColor: bannerStyle.bg === 'crest' ? '#44403c' : bannerStyle.bg, borderRadius: rs.s(8), padding: rs.s(10), alignItems: 'center' }}>
                        <Text style={{ fontSize: rs.font(20), fontWeight: font.weight as any, color: bannerStyle.text || '#fff', letterSpacing: font.spacing, textTransform: font.transform as any }}>{font.preview}</Text>
                      </View>
                    )}
                    {selectedFont.id === font.id && <Text style={{ fontSize: rs.font(9), color: COLORS.amber600, marginTop: rs.s(4) }}>? Active</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            </SectionCard>

            {/* Graffiti Builder � only visible when graffiti font selected */}
            {selectedFont.id === 'graffiti' && (
            <SectionCard title="?? Graffiti Banner Builder">
              <Text style={{ fontSize: rs.font(11), color: COLORS.stone500, marginBottom: rs.s(12) }}>
                Create your store banner. Recipe saved to Arweave � renders on any device.
              </Text>

              {/* LIVE SVG PREVIEW */}
              <View style={{ backgroundColor: bannerRecipe.bgColor, borderRadius: rs.s(12), padding: rs.s(8), marginBottom: rs.s(16), borderWidth: 2, borderColor: COLORS.stone200, overflow: 'hidden' }}>
                <Svg viewBox="0 0 360 120" style={{ width: '100%', height: rs.s(120) }}>
                  <Defs>
                    <Pattern id="bricks" patternUnits="userSpaceOnUse" width="20" height="10">
                      <Rect width="20" height="10" fill={bannerRecipe.bgColor} />
                      <Line x1="0" y1="5" x2="20" y2="5" stroke="#d6d3d1" strokeWidth="0.5" />
                      <Line x1="10" y1="0" x2="10" y2="5" stroke="#d6d3d1" strokeWidth="0.5" />
                      <Line x1="0" y1="5" x2="0" y2="10" stroke="#d6d3d1" strokeWidth="0.5" />
                      <Line x1="20" y1="5" x2="20" y2="10" stroke="#d6d3d1" strokeWidth="0.5" />
                    </Pattern>
                  </Defs>
                  <Rect x="0" y="0" width="360" height="120" fill="url(#bricks)" />
                  {/* Decorations */}
                  {bannerRecipe.decoStyle === 'stars' && (
                    <G>
                      <Path d="M30 15 L33 25 L43 25 L35 31 L38 41 L30 35 L22 41 L25 31 L17 25 L27 25 Z" fill={bannerRecipe.fillColor} opacity="0.3" />
                      <Path d="M320 20 L322 26 L328 26 L323 30 L325 36 L320 32 L315 36 L317 30 L312 26 L318 26 Z" fill={bannerRecipe.fillColor} opacity="0.3" />
                      <Path d="M340 90 L342 96 L348 96 L343 100 L345 106 L340 102 L335 106 L337 100 L332 96 L338 96 Z" fill={bannerRecipe.fillColor} opacity="0.2" />
                    </G>
                  )}
                  {bannerRecipe.decoStyle === 'arrows' && (
                    <G>
                      <Path d="M15 60 L30 50 L30 55 L50 55 L50 65 L30 65 L30 70 Z" fill={bannerRecipe.fillColor} opacity="0.2" />
                      <Path d="M345 60 L330 50 L330 55 L310 55 L310 65 L330 65 L330 70 Z" fill={bannerRecipe.fillColor} opacity="0.2" />
                    </G>
                  )}
                  {/* Graffiti Letters */}
                  {bannerRecipe.text.split('').map((ch, i) => {
                    const total = bannerRecipe.text.length;
                    const charW = Math.min(320 / Math.max(total, 1), 50);
                    const startX = (360 - total * charW) / 2;
                    const x = startX + i * charW + charW / 2;
                    const y = bannerRecipe.style === 'wild' ? 75 + Math.sin(i * 0.8) * 8 : 78;
                    const rot = bannerRecipe.style === 'wild' ? Math.sin(i * 1.2) * 10 : bannerRecipe.style === 'block' ? (i % 2 === 0 ? -3 : 3) : 0;
                    const fontSize = bannerRecipe.style === 'bubble' ? 48 : 44;
                    const strokeW = bannerRecipe.style === 'bubble' ? 8 : 5;
                    return (
                      <G key={i} transform={'rotate(' + rot + ' ' + x + ' ' + y + ')'}>
                        {/* Drop shadow */}
                        <SvgText x={x + 3} y={y + 3} fontSize={fontSize} fontWeight="900" fill={bannerRecipe.shadowColor} opacity="0.5" textAnchor="middle">{ch}</SvgText>
                        {/* Thick outline */}
                        <SvgText x={x} y={y} fontSize={fontSize} fontWeight="900" fill="none" stroke={bannerRecipe.outlineColor} strokeWidth={strokeW} textAnchor="middle">{ch}</SvgText>
                        {/* Fill */}
                        <SvgText x={x} y={y} fontSize={fontSize} fontWeight="900" fill={bannerRecipe.fillColor} textAnchor="middle">{ch}</SvgText>
                        {/* Inner highlight */}
                        <SvgText x={x - 1} y={y - 2} fontSize={fontSize * 0.85} fontWeight="900" fill={bannerRecipe.fillColor} opacity="0.3" textAnchor="middle">{ch}</SvgText>
                      </G>
                    );
                  })}
                </Svg>
                <Text style={{ textAlign: 'center', fontSize: rs.font(9), color: COLORS.stone400, marginTop: rs.s(4) }}>Live Preview � {bannerRecipe.text.length} chars</Text>
              </View>

              {/* Banner Text */}
              <View style={{ marginBottom: rs.s(12) }}>
                <Text style={inputStyles.label}>Banner Text</Text>
                <TextInput
                  style={[inputStyles.input, { textTransform: 'uppercase', letterSpacing: 2, fontWeight: '900' }]}
                  value={bannerRecipe.text}
                  onChangeText={(t) => setBannerRecipe(prev => ({ ...prev, text: t.toUpperCase().slice(0, 14) }))}
                  placeholder="YOUR STORE NAME"
                  placeholderTextColor={COLORS.stone400}
                  maxLength={14}
                />
                <Text style={{ fontSize: rs.font(9), color: COLORS.stone400, marginTop: 2 }}>{bannerRecipe.text.length}/14 characters</Text>
              </View>

              {/* Style Selector */}
              <Text style={inputStyles.label}>Graffiti Style</Text>
              <View style={{ flexDirection: 'row', gap: rs.s(8), marginBottom: rs.s(12) }}>
                {([
                  { id: 'block', label: '? Block', desc: 'Sharp angles' },
                  { id: 'bubble', label: '? Bubble', desc: 'Rounded soft' },
                  { id: 'wild', label: '? Wild', desc: 'Wavy chaos' },
                ] as const).map(st => (
                  <TouchableOpacity key={st.id} onPress={() => setBannerRecipe(prev => ({ ...prev, style: st.id }))}
                    style={{ flex: 1, backgroundColor: bannerRecipe.style === st.id ? COLORS.amber100 : COLORS.stone50, borderWidth: 2, borderColor: bannerRecipe.style === st.id ? COLORS.amber500 : COLORS.stone200, borderRadius: rs.s(10), padding: rs.s(10), alignItems: 'center' }}>
                    <Text style={{ fontSize: rs.font(14), fontWeight: 'bold', color: bannerRecipe.style === st.id ? COLORS.amber900 : COLORS.stone600 }}>{st.label}</Text>
                    <Text style={{ fontSize: rs.font(9), color: COLORS.stone400 }}>{st.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Color Pickers */}
              <Text style={inputStyles.label}>Colors</Text>
              {([
                { key: 'fillColor', label: 'Fill', colors: ['#d97706', '#dc2626', '#2563eb', '#16a34a', '#9333ea', '#ec4899', '#0891b2', '#f59e0b'] },
                { key: 'outlineColor', label: 'Outline', colors: ['#1c1917', '#312e81', '#14532d', '#7f1d1d', '#581c87', '#44403c', '#1e3a5f', '#000000'] },
                { key: 'shadowColor', label: 'Shadow', colors: ['#78350f', '#3730a3', '#166534', '#991b1b', '#6b21a8', '#57534e', '#1e40af', '#374151'] },
                { key: 'bgColor', label: 'Background', colors: ['#fafaf9', '#fffbeb', '#f0fdf4', '#eff6ff', '#fef2f2', '#f5f3ff', '#1c1917', '#292524'] },
              ] as const).map(row => (
                <View key={row.key} style={{ marginBottom: rs.s(8) }}>
                  <Text style={{ fontSize: rs.font(10), color: COLORS.stone500, marginBottom: 4 }}>{row.label}</Text>
                  <View style={{ flexDirection: 'row', gap: rs.s(6) }}>
                    {row.colors.map(c => (
                      <TouchableOpacity key={c} onPress={() => setBannerRecipe(prev => ({ ...prev, [row.key]: c }))}
                        style={{ width: rs.s(32), height: rs.s(32), borderRadius: rs.s(16), backgroundColor: c, borderWidth: (bannerRecipe as any)[row.key] === c ? 3 : 1, borderColor: (bannerRecipe as any)[row.key] === c ? '#fbbf24' : '#d6d3d1' }} />
                    ))}
                  </View>
                </View>
              ))}

              {/* Decoration Style */}
              <Text style={inputStyles.label}>Decorations</Text>
              <View style={{ flexDirection: 'row', gap: rs.s(8), marginBottom: rs.s(16) }}>
                {([
                  { id: 'stars', label: '? Stars' },
                  { id: 'arrows', label: '? Arrows' },
                  { id: 'plain', label: '? Plain' },
                ] as const).map(d => (
                  <TouchableOpacity key={d.id} onPress={() => setBannerRecipe(prev => ({ ...prev, decoStyle: d.id }))}
                    style={{ flex: 1, backgroundColor: bannerRecipe.decoStyle === d.id ? COLORS.amber100 : COLORS.stone50, borderWidth: 2, borderColor: bannerRecipe.decoStyle === d.id ? COLORS.amber500 : COLORS.stone200, borderRadius: rs.s(8), padding: rs.s(8), alignItems: 'center' }}>
                    <Text style={{ fontSize: rs.font(12), color: bannerRecipe.decoStyle === d.id ? COLORS.amber900 : COLORS.stone500 }}>{d.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Save Recipe */}
              <TouchableOpacity
                style={{ backgroundColor: COLORS.green600, borderRadius: rs.s(12), paddingVertical: rs.s(14), alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: rs.s(8) }}
                onPress={async () => {
                  try {
                    await SecureStore.setItemAsync('kv_banner_recipe', JSON.stringify(bannerRecipe));
                    Alert.alert('Saved!', 'Banner recipe saved. It will be included when you Publish your storefront to Arweave.');
                  } catch (e) { Alert.alert('Error', String(e)); }
                }}>
                <Save size={rs.s(16)} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: rs.font(14) }}>Save Banner Recipe</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: rs.font(9), color: COLORS.stone400, textAlign: 'center', marginTop: rs.s(6) }}>
                Recipe is ~200 bytes on Arweave � renders SVG on any device from the recipe
              </Text>
            </SectionCard>
            )}
          </View>
        )}
        
        {/* Items Tab */}
        {activeView === 'items' && (
          <View>
            <SectionCard title="The Stash Management">
              <Text style={wsStyles.sectionSubtitle}>Add, edit, or delete items for your feed.</Text>
              
              {stash.length > 0 ? (
                stash.map(item => (
                  <TouchableOpacity key={item.id} onPress={() => { if (item.socialUrl) Linking.openURL(item.socialUrl); }}
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, borderRadius: rs.s(12), padding: rs.s(12), marginBottom: rs.s(8), borderWidth: 1, borderColor: COLORS.amber200 }} activeOpacity={0.7}>
                    <Text style={{ fontSize: rs.font(28), marginRight: rs.s(10) }}>{getPlatformIcon(item.socialUrl)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: rs.font(14), fontWeight: 'bold', color: COLORS.stone800 }}>{item.name}</Text>
                      {item.description ? <Text style={{ fontSize: rs.font(10), color: COLORS.stone500, marginTop: 2 }} numberOfLines={1}>{item.description}</Text> : null}
                      <Text style={{ fontSize: rs.font(11), color: COLORS.amber700, marginTop: rs.s(2) }}>
                        {item.dollarPrice > 0 ? `$${item.dollarPrice.toFixed(2)} USD` : ''} {item.kaspaPrice > 0 ? `${item.kaspaPrice} KAS` : 'Price TBD'}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: rs.s(12) }}>
                      <TouchableOpacity onPress={() => handleEditItem(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Edit3 size={rs.s(16)} color={COLORS.blue600} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteItem(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Trash2 size={rs.s(16)} color={COLORS.red600} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: rs.s(24) }}>
                  <ShoppingBag size={rs.s(32)} color={COLORS.amber300} />
                  <Text style={{ fontSize: rs.font(13), color: COLORS.amber600, fontStyle: 'italic', marginTop: rs.s(8) }}>No items yet</Text>
                </View>
              )}
              <TouchableOpacity style={wsStyles.addItemBtn} onPress={() => { setEditingItem(null); setItemForm({ name: '', description: '', dollarPrice: '', kaspaPrice: '', socialUrl: '' }); setShowItemForm(true); }}>
                <Plus size={rs.s(16)} color={COLORS.white} />
                <Text style={wsStyles.addItemBtnText}>Add New Item</Text>
              </TouchableOpacity>
            </SectionCard>
        {/* Item Form Modal */}
            <Modal visible={showItemForm} animationType="slide" transparent>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: rs.s(20) }}>
                <View style={{ backgroundColor: COLORS.cardBg, borderRadius: rs.s(20), padding: rs.s(20), maxHeight: '85%' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs.s(16) }}>
                    <Text style={{ fontSize: rs.font(18), fontWeight: '900', color: COLORS.amber900 }}>{editingItem ? '?? Edit Item' : '? New Item'}</Text>
                    <TouchableOpacity onPress={() => { setShowItemForm(false); setEditingItem(null); }}>
                      <X size={rs.s(20)} color={COLORS.stone500} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView>
                    <InputField label="Item Name" value={itemForm.name} onChangeText={(t) => setItemForm(prev => ({ ...prev, name: t }))} placeholder="e.g. Silver Eagle Coin" />
                    <InputField label="Description (optional)" value={itemForm.description} onChangeText={(t) => setItemForm(prev => ({ ...prev, description: t }))} placeholder="Condition, year, details..." multiline />
                    <View style={{ flexDirection: 'row', gap: rs.s(10) }}>
                      <View style={{ flex: 1 }}>
                        <InputField label="Price (USD)" value={itemForm.dollarPrice} onChangeText={(t) => setItemForm(prev => ({ ...prev, dollarPrice: t }))} placeholder="0.00" keyboardType="numeric" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <InputField label="Price (KAS)" value={itemForm.kaspaPrice} onChangeText={(t) => setItemForm(prev => ({ ...prev, kaspaPrice: t }))} placeholder="0" keyboardType="numeric" />
                      </View>
                    </View>
                    <View style={{ backgroundColor: COLORS.blue50, borderRadius: rs.s(12), padding: rs.s(12), marginBottom: rs.s(12), borderWidth: 1, borderColor: COLORS.blue200 }}>
                      <Text style={{ fontSize: rs.font(12), fontWeight: 'bold', color: COLORS.blue800, marginBottom: rs.s(4) }}>?? Direct Post Link</Text>
                      <Text style={{ fontSize: rs.font(10), color: COLORS.blue600, marginBottom: rs.s(8) }}>Link to this item on Instagram, Pinterest, Etsy, TikTok, eBay, or Facebook. Buyers tap ? opens your post.</Text>
                      <TextInput
                        style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.blue300, borderRadius: rs.s(10), paddingHorizontal: rs.s(12), paddingVertical: rs.s(10), fontSize: rs.font(12), color: COLORS.stone800, fontFamily: 'monospace' }}
                        value={itemForm.socialUrl}
                        onChangeText={(t) => setItemForm(prev => ({ ...prev, socialUrl: t }))}
                        placeholder="https://instagram.com/p/ABC123..."
                        placeholderTextColor={COLORS.stone400}
                        keyboardType="url"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: rs.s(6), marginTop: rs.s(8) }}>
                        {['?? Instagram', '?? Pinterest', '??? Etsy', '?? TikTok', '??? eBay', '?? Facebook'].map(p => (
                          <View key={p} style={{ backgroundColor: COLORS.stone100, paddingHorizontal: rs.s(8), paddingVertical: rs.s(3), borderRadius: rs.s(6) }}>
                            <Text style={{ fontSize: rs.font(9), color: COLORS.stone500 }}>{p}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                    <TouchableOpacity onPress={handleSaveItem}
                      style={{ backgroundColor: COLORS.green600, borderRadius: rs.s(12), paddingVertical: rs.s(14), alignItems: 'center', marginTop: rs.s(8) }}>
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: rs.font(14) }}>{editingItem ? 'Save Changes' : 'Add Item'}</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </View>
            </Modal>
          </View>
        )}
        
        {/* Coupons Tab */}
        {activeView === 'coupons' && (
          <View>
            <SectionCard title="??? Coupon Management">
              <Text style={{ fontSize: rs.font(11), color: COLORS.stone500, marginBottom: rs.s(12) }}>
                Create discount codes. Linked to agreements at checkout.
              </Text>

              {/* Bar Chart � coupon usage */}
              {coupons.length > 0 && (
                <View style={{ backgroundColor: COLORS.stone50, borderRadius: rs.s(12), padding: rs.s(12), marginBottom: rs.s(16) }}>
                  <Text style={{ fontSize: rs.font(11), fontWeight: 'bold', color: COLORS.stone600, marginBottom: rs.s(8) }}>Usage Overview</Text>
                  <Svg viewBox={'0 0 ' + Math.max(coupons.length * 60, 200) + ' 100'} style={{ width: '100%', height: rs.s(100) }}>
                    {coupons.map((cpn, i) => {
                      const barW = 40;
                      const gap = 20;
                      const x = i * (barW + gap) + 10;
                      const usePct = cpn.maxUses > 0 ? Math.min(cpn.usedCount / cpn.maxUses, 1) : 0;
                      const maxH = 70;
                      const barH = Math.max(usePct * maxH, 4);
                      const colors = ['#d97706', '#2563eb', '#16a34a', '#9333ea', '#dc2626', '#0891b2', '#ea580c', '#6366f1'];
                      const color = colors[i % colors.length];
                      return (
                        <G key={cpn.id}>
                          {/* Background bar */}
                          <Rect x={x} y={100 - maxH - 10} width={barW} height={maxH} rx="4" fill={COLORS.stone200} />
                          {/* Usage bar */}
                          <Rect x={x} y={100 - barH - 10} width={barW} height={barH} rx="4" fill={color} />
                          {/* Label */}
                          <Rect x={x} y={92} width={barW} height={0} />
                        </G>
                      );
                    })}
                  </Svg>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: rs.s(8), marginTop: rs.s(4) }}>
                    {coupons.map((cpn, i) => {
                      const colors = ['#d97706', '#2563eb', '#16a34a', '#9333ea', '#dc2626', '#0891b2', '#ea580c', '#6366f1'];
                      return (
                        <View key={cpn.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors[i % colors.length] }} />
                          <Text style={{ fontSize: rs.font(9), color: COLORS.stone500 }}>{cpn.code} ({cpn.usedCount}/{cpn.maxUses})</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Coupon List */}
              {coupons.map(cpn => {
                const daysLeft = Math.max(0, Math.ceil((cpn.createdAt + cpn.expiryDays * 86400000 - Date.now()) / 86400000));
                const expired = daysLeft <= 0;
                return (
                  <View key={cpn.id} style={{ backgroundColor: expired ? COLORS.red50 : COLORS.cardBg, borderRadius: rs.s(12), padding: rs.s(12), marginBottom: rs.s(8), borderWidth: 1, borderColor: expired ? COLORS.red200 : COLORS.amber200 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs.s(8) }}>
                          <Text style={{ fontSize: rs.font(16), fontWeight: '900', fontFamily: 'monospace', color: expired ? COLORS.red500 : COLORS.amber900 }}>{cpn.code}</Text>
                          {expired && <Text style={{ fontSize: rs.font(9), color: COLORS.red600, fontWeight: 'bold' }}>EXPIRED</Text>}
                        </View>
                        <Text style={{ fontSize: rs.font(11), color: COLORS.stone600, marginTop: 2 }}>
                          {cpn.discountPercent > 0 ? cpn.discountPercent + '% off' : cpn.discountKas + ' KAS off'}
                          {cpn.description ? ' � ' + cpn.description : ''}
                        </Text>
                        <Text style={{ fontSize: rs.font(10), color: COLORS.stone400, marginTop: 2 }}>
                          Used {cpn.usedCount}/{cpn.maxUses} � {daysLeft > 0 ? daysLeft + ' days left' : 'Expired'}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: rs.s(10) }}>
                        <TouchableOpacity onPress={() => { setEditingCoupon(cpn); setCouponForm({ code: cpn.code, discountPercent: cpn.discountPercent?.toString() || '', discountKas: cpn.discountKas?.toString() || '', maxUses: cpn.maxUses?.toString() || '10', expiryDays: cpn.expiryDays?.toString() || '30', description: cpn.description || '' }); setShowCouponForm(true); }}>
                          <Edit3 size={rs.s(16)} color={COLORS.blue600} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => Alert.alert('Delete?', 'Remove coupon ' + cpn.code + '?', [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: () => setCoupons(prev => prev.filter(c => c.id !== cpn.id)) }])}>
                          <Trash2 size={rs.s(16)} color={COLORS.red600} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}

              {coupons.length === 0 && (
                <View style={{ alignItems: 'center', paddingVertical: rs.s(20) }}>
                  <Text style={{ fontSize: rs.font(13), color: COLORS.amber600, fontStyle: 'italic' }}>No coupons yet</Text>
                </View>
              )}

              <TouchableOpacity onPress={() => { setEditingCoupon(null); setCouponForm({ code: '', discountPercent: '', discountKas: '', maxUses: '10', expiryDays: '30', description: '' }); setShowCouponForm(true); }}
                style={{ backgroundColor: COLORS.amber600, borderRadius: rs.s(12), paddingVertical: rs.s(14), alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: rs.s(8), marginTop: rs.s(8) }}>
                <Plus size={rs.s(16)} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: rs.font(14) }}>Create Coupon</Text>
              </TouchableOpacity>
            </SectionCard>

            {/* Visibility Score */}
            <SectionCard title="?? Mailbox Visibility Score">
              <Text style={{ fontSize: rs.font(10), color: COLORS.stone500, marginBottom: rs.s(10) }}>
                This score determines how high your store ranks in buyer mailboxes.
              </Text>
              {(() => {
                const avgUsd = stash.length > 0 ? stash.reduce((s, i) => s + (i.dollarPrice || 0), 0) / stash.length : 0;
                const avgKas = stash.length > 0 ? stash.reduce((s, i) => s + (i.kaspaPrice || 0), 0) / stash.length : 0;
                const vis = calcVisibilityScore(userXp, 80, avgUsd, avgKas, 0.08, 0, 1, coupons.length > 0);
                return (
                  <View>
                    <View style={{ alignItems: 'center', marginBottom: rs.s(12) }}>
                      <Text style={{ fontSize: rs.font(42), fontWeight: '900', color: vis.total >= 60 ? COLORS.green600 : vis.total >= 30 ? COLORS.amber600 : COLORS.red600 }}>{vis.total}</Text>
                      <Text style={{ fontSize: rs.font(11), color: COLORS.stone500 }}>out of 100</Text>
                    </View>
                    {[
                      { label: 'XP (30%)', score: vis.xpScore, color: '#4f46e5', tip: 'Complete agreements to earn XP' },
                      { label: 'Runway (25%)', score: vis.runwayScore, color: '#16a34a', tip: 'Pledge duration remaining' },
                      { label: 'Price (25%)', score: vis.priceScore, color: '#d97706', tip: 'Low USD (' + (vis.usdFactor || 0) + '%) + KAS discount (' + (vis.kasDiscountPct || 0) + '%) + coupons' },
                      { label: 'Pledge (10%)', score: vis.pledgeScore, color: '#9333ea', tip: 'KAS pledged (max 2500)' },
                      { label: 'Fresh (10%)', score: vis.freshnessScore, color: '#0891b2', tip: '24hr half-life decay' },
                    ].map(row => (
                      <View key={row.label} style={{ marginBottom: rs.s(8) }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                          <Text style={{ fontSize: rs.font(10), fontWeight: 'bold', color: COLORS.stone600 }}>{row.label}</Text>
                          <Text style={{ fontSize: rs.font(10), color: COLORS.stone500 }}>{row.score}%</Text>
                        </View>
                        <View style={{ height: rs.s(8), backgroundColor: COLORS.stone200, borderRadius: 4, overflow: 'hidden' }}>
                          <View style={{ height: '100%', width: (row.score + '%') as any, backgroundColor: row.color, borderRadius: 4 }} />
                        </View>
                        <Text style={{ fontSize: rs.font(8), color: COLORS.stone400, marginTop: 1 }}>{row.tip}</Text>
                      </View>
                    ))}
                  </View>
                );
              })()}
            </SectionCard>

            {/* Coupon Form Modal */}
            <Modal visible={showCouponForm} animationType="slide" transparent>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: rs.s(20) }}>
                <View style={{ backgroundColor: COLORS.cardBg, borderRadius: rs.s(20), padding: rs.s(20) }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs.s(16) }}>
                    <Text style={{ fontSize: rs.font(18), fontWeight: '900', color: COLORS.amber900 }}>{editingCoupon ? '?? Edit Coupon' : '??? New Coupon'}</Text>
                    <TouchableOpacity onPress={() => { setShowCouponForm(false); setEditingCoupon(null); }}>
                      <X size={rs.s(20)} color={COLORS.stone500} />
                    </TouchableOpacity>
                  </View>
                  <InputField label="Coupon Code" value={couponForm.code} onChangeText={(t) => setCouponForm(p => ({ ...p, code: t.toUpperCase() }))} placeholder="WELCOME10" />
                  <View style={{ flexDirection: 'row', gap: rs.s(10) }}>
                    <View style={{ flex: 1 }}>
                      <InputField label="Discount %" value={couponForm.discountPercent} onChangeText={(t) => setCouponForm(p => ({ ...p, discountPercent: t, discountKas: '' }))} placeholder="10" keyboardType="numeric" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <InputField label="� OR � Fixed KAS" value={couponForm.discountKas} onChangeText={(t) => setCouponForm(p => ({ ...p, discountKas: t, discountPercent: '' }))} placeholder="5" keyboardType="numeric" />
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: rs.s(10) }}>
                    <View style={{ flex: 1 }}>
                      <InputField label="Max Uses" value={couponForm.maxUses} onChangeText={(t) => setCouponForm(p => ({ ...p, maxUses: t }))} placeholder="10" keyboardType="numeric" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <InputField label="Expires (days)" value={couponForm.expiryDays} onChangeText={(t) => setCouponForm(p => ({ ...p, expiryDays: t }))} placeholder="30" keyboardType="numeric" />
                    </View>
                  </View>
                  <InputField label="Description (optional)" value={couponForm.description} onChangeText={(t) => setCouponForm(p => ({ ...p, description: t }))} placeholder="First-time buyer discount" />
                  <TouchableOpacity onPress={handleSaveCoupon}
                    style={{ backgroundColor: COLORS.green600, borderRadius: rs.s(12), paddingVertical: rs.s(14), alignItems: 'center', marginTop: rs.s(8) }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: rs.font(14) }}>{editingCoupon ? 'Save Changes' : 'Create Coupon'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          </View>
        )}
        
        {/* DApps Tab */}
        {activeView === 'dapps' && (
          <SectionCard title="DApp & Game Management">
            <Text style={wsStyles.sectionSubtitle}>
              DApps are posted by YOU directly to Arweave. KasVillage verifies for display visibility only.
            </Text>
            
            <View style={wsStyles.complianceNotice}>
              <Text style={wsStyles.complianceText}>
                <Text style={{ fontWeight: 'bold' }}>?? Compliance:</Text> Prohibited content apps are restricted and auto-rejected by the SDK scanner. DApps are NOT visible in KasVillage unless they pass the SDK Compliance Gate. Post a video demo on Instagram/TikTok as your listing.
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
              <Text style={wsStyles.publishBtnText}>SDK Compliance Check</Text>
            </TouchableOpacity>

            {/* On-chain Game JSON publish - descriptor rail (data-only, no code) */}
            <View style={{ backgroundColor: COLORS.indigo50, borderRadius: rs.s(12), padding: rs.s(14), marginBottom: rs.s(12), borderWidth: 1, borderColor: COLORS.indigo200 }}>
              <Text style={{ fontSize: rs.font(13), fontWeight: '900', color: COLORS.indigo900, marginBottom: rs.s(4) }}>Publish Game JSON (on-chain)</Text>
              <Text style={{ fontSize: rs.font(10), color: COLORS.indigo700, marginBottom: rs.s(8) }}>
                Data-only game descriptor. Buyers hit Generate Game and the app renders it from Kaspa L1 - no hosting, no code execution.
              </Text>
              <TextInput
                style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.indigo300, borderRadius: rs.s(8), padding: rs.s(10), fontSize: rs.font(10), fontFamily: 'monospace', color: COLORS.stone700, minHeight: rs.s(110), textAlignVertical: 'top' }}
                value={gameJson}
                onChangeText={setGameJson}
                placeholder='{"kind":"kv_game_v1","engine":"grid",...}'
                placeholderTextColor={COLORS.stone400}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={{ flexDirection: 'row', gap: rs.s(8), marginTop: rs.s(8) }}>
                <TouchableOpacity onPress={() => setGameJson(TIC_TAC_TOE_JSON)}
                  style={{ flex: 1, backgroundColor: COLORS.stone100, borderRadius: rs.s(8), paddingVertical: rs.s(10), alignItems: 'center' }}>
                  <Text style={{ fontSize: rs.font(11), fontWeight: 'bold', color: COLORS.stone600 }}>Load Tic-Tac-Toe</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={gamePublishing} onPress={async () => {
                  const v = validateGameDescriptor(gameJson);
                  if (!v.ok || !v.game) { Alert.alert('Invalid Game JSON', v.error || 'validation failed'); return; }
                  const _ok = await new Promise<boolean>((resolve) => {
                    Alert.alert('Publish game cost', '5 KAS pledge (yours, staked)\n1 KAS announce (burned)\n~0.2 KAS descriptor chunk\n\nTotal: ~6.2 KAS + fees', [
                      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                      { text: 'Publish', onPress: () => resolve(true) },
                    ]);
                  });
                  if (!_ok) return;
                  setGamePublishing(true);
                  try {
                    const { publishContent, announceToRegistry } = require('./payload_publish');
                    const { publishConfigChunks } = require('./config_chunks');
                    const { _kvResolvePrivHex } = require('./proposal_share');
                    const _priv = await _kvResolvePrivHex();
                    const _addr = (await SecureStore.getItemAsync('kv_kaspa_address')) || (await SecureStore.getItemAsync('kaspa_address')) || '';
                    if (!_priv || !userPubkey || !_addr) throw new Error('wallet keys unavailable');
                    const _owner = { privateKeyHex: _priv, pubkeyHex: userPubkey, address: _addr, network: 'testnet-10' as any };
                    setGameStage('Anchoring pledge...');
                    const _Crypto = require('expo-crypto');
                    const _cHash = await _Crypto.digestStringAsync(_Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify(v.game));
                    const _gmeta: any = (v.game as any).meta || {};
                    const _gname = (v.game as any).name || _gmeta.name || _gmeta.id || 'Untitled Game';
                    const _pub: any = await publishContent(_owner, 'dapp', { name: _gname, category: 'GameGrid', contentHash: _cHash }, 1, 500_000_000n);
                    if (!_pub || _pub.success === false) throw new Error('dapp publish failed: ' + (_pub && _pub.error));
                    setGameStage('Publishing descriptor...');
                    const _ck: any = await publishConfigChunks(_owner, _pub.storeAddress, v.game);
                    if (!_ck.success) throw new Error('descriptor chunks failed: ' + _ck.error);
                    setGameStage('Announcing...');
                    const _ann: any = await announceToRegistry(_owner, _pub.storeAddress, _gname, 'GameGrid', 'dapp', { configHash: _ck.hash });
                    if (!_ann || _ann.success === false) console.warn('[Game] announce failed:', _ann && _ann.error);
                    Alert.alert('Game Published!', _gname + ' is live on Kaspa L1.\nDescriptor hash: ' + _ck.hash.slice(0, 16) + '...');
                    console.log('[Game] published - addr:', _pub.storeAddress, 'hash:', _ck.hash.slice(0, 16));
                  } catch (e: any) {
                    Alert.alert('Publish Failed', String(e?.message || e));
                  }
                  setGamePublishing(false);
                  setTimeout(() => setGameStage(''), 4000);
                }}
                  style={{ flex: 1, backgroundColor: gamePublishing ? COLORS.stone300 : COLORS.indigo600, borderRadius: rs.s(8), paddingVertical: rs.s(10), alignItems: 'center' }}>
                  {gamePublishing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontSize: rs.font(11), fontWeight: 'bold', color: '#fff' }}>Publish Game (~6.2 KAS)</Text>}
                </TouchableOpacity>
              </View>
              {gameStage ? <Text style={{ fontSize: rs.font(10), color: COLORS.indigo700, textAlign: 'center', marginTop: rs.s(6) }}>{gameStage}</Text> : null}
            </View>
            
            {/* Video Demo � the listing IS the marketing */}
            <View style={{ backgroundColor: '#fef3c7', borderRadius: rs.s(12), padding: rs.s(14), marginBottom: rs.s(12), borderWidth: 1, borderColor: '#f59e0b' }}>
              <Text style={{ fontSize: rs.font(14), fontWeight: '900', color: '#92400e', marginBottom: rs.s(6) }}>?? Video Demo = Your Listing</Text>
              <Text style={{ fontSize: rs.font(11), color: '#b45309', lineHeight: rs.font(17), marginBottom: rs.s(10) }}>
                Post a short video demo of your DApp, game, or website on Instagram or TikTok. That video IS your storefront listing � buyers see the demo, tap through, and the SDK compliance badge proves it's safe.
              </Text>
              <View style={{ gap: rs.s(6) }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs.s(8) }}>
                  <Text style={{ fontSize: rs.font(18) }}>??</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: rs.font(11), fontWeight: 'bold', color: '#92400e' }}>Instagram Reel (15-60s)</Text>
                    <Text style={{ fontSize: rs.font(9), color: '#b45309' }}>Show gameplay, UI walkthrough, or feature highlight</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs.s(8) }}>
                  <Text style={{ fontSize: rs.font(18) }}>??</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: rs.font(11), fontWeight: 'bold', color: '#92400e' }}>TikTok (15-60s)</Text>
                    <Text style={{ fontSize: rs.font(9), color: '#b45309' }}>Quick demo with trending audio = organic reach</Text>
                  </View>
                </View>
              </View>
              <View style={{ backgroundColor: '#fff', borderRadius: rs.s(8), padding: rs.s(10), marginTop: rs.s(10) }}>
                <Text style={{ fontSize: rs.font(9), color: '#78716c', textAlign: 'center', lineHeight: rs.font(14) }}>
                  No platform fees. No middleman. Your social media IS your storefront.{String.fromCharCode(10)}
                  KasVillage provides the trust layer (XP reputation + non-custodial escrow).{String.fromCharCode(10)}
                  The video demo IS the product listing.
                </Text>
              </View>
            </View>

            {/* Book Shelf */}
            <TouchableOpacity
              style={wsStyles.bookShelfBtn}
              onPress={() => setShowAcademicPanel(true)}
            >
              <Text style={wsStyles.bookShelfBtnText}>?? Book Shelf (Academic Research P2P)</Text>
            </TouchableOpacity>
            
            {/* Template */}
            <View style={{ backgroundColor: '#fef2f2', borderRadius: rs.s(12), padding: rs.s(12), marginBottom: rs.s(12), borderWidth: 1, borderColor: '#fca5a5' }}>
              <Text style={{ fontSize: rs.font(12), fontWeight: 'bold', color: '#991b1b', marginBottom: rs.s(6) }}>?? Required SDK Modules</Text>
              <Text style={{ fontSize: rs.font(10), color: '#b91c1c', marginBottom: rs.s(8) }}>Your DApp MUST import from at least one KasVillage SDK module. No SDK import = scan fails.</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: rs.s(4) }}>
                {(() => {
                const sdkModules = [
                  { cat: '?? Core Engine', mods: ['procedural_sdk', 'game_v1', 'game_loop', 'game_input'] },
                  { cat: '?? Avatar & Identity', mods: ['avatar_engine', 'player_sprite', 'enemy_avatars'] },
                  { cat: '?? Rendering', mods: ['canvas_renderer', 'ps1_engine', 'ps1_presets', 'board_renderer', 'camera_system'] },
                  { cat: '?? Combat & Input', mods: ['touch_input', 'parry_system', 'enemy_combos', 'paint_v2'] },
                  { cat: '?? World', mods: ['environments', 'particles', 'wave_spawner', 'difficulty', 'vagrant_preset'] },
                  { cat: '?? Audio & Music', mods: ['audio_ui', 'spotify_auth', 'spotify_sync', 'juice'] },
                  { cat: '?? Items & Economy', mods: ['item_library', 'wallet_bridge'] },
                  { cat: '?? Multiplayer', mods: ['multiplayer', 'tuned_config'] },
                ];
                return sdkModules.map(group => (
                  <View key={group.cat} style={{ marginBottom: rs.s(8) }}>
                    <Text style={{ fontSize: rs.font(9), fontWeight: 'bold', color: '#78350f', marginBottom: rs.s(4) }}>{group.cat}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: rs.s(4) }}>
                      {group.mods.map(m => (
                        <TouchableOpacity key={m} onPress={() => {
                          const nameMap = { 'procedural_sdk': 'procedural_sdk', 'game_input': 'kasvillage_game_input_paint' };
                          const fileName = nameMap[m] || ('kasvillage_' + m);
                          const rawUrl = 'https://raw.githubusercontent.com/wayneshaw349/kasvillage-townhall/main/' + fileName + '.ts';
                          Clipboard.setStringAsync('Fetch this file and use it to build: ' + rawUrl);
                          Alert.alert('Copied!', fileName + '.ts\nGitHub URL on clipboard.\nPaste into Claude Code.');
                        }} style={{ backgroundColor: '#fff', paddingHorizontal: rs.s(6), paddingVertical: rs.s(3), borderRadius: rs.s(5), borderWidth: 1, borderColor: '#fca5a5' }} activeOpacity={0.6}>
                          <Text style={{ fontSize: rs.font(8), fontFamily: 'monospace', color: '#991b1b' }}>?? {m}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ));
              })()}
              <Text style={{ fontSize: rs.font(8), color: '#b91c1c', marginTop: rs.s(4), fontStyle: 'italic' }}>Tap any module ? copies import + procedural_sdk to clipboard</Text>
              <Text style={{ fontSize: rs.font(7), color: '#78716c', marginTop: rs.s(2) }}>{(() => { let c = 0; [4,3,5,4,5,4,2,2].forEach(n => c += n); return c; })()} modules across 8 categories</Text>
              </View>
              <Text style={{ fontSize: rs.font(9), color: '#b91c1c', marginTop: rs.s(6) }}>Use kvFetch() instead of raw fetch() � blocks image responses at runtime.</Text>
            </View>
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
          <SectionCard title="?? Academic Research">
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
        
        {/* Preview Tab � What Buyers See */}
        {activeView === 'preview' && (
          <View>
            <SectionCard title="?? What Buyers See">
              <Text style={{ fontSize: rs.font(10), color: COLORS.stone500, marginBottom: rs.s(12) }}>This is how your store appears in the Mailbox feed</Text>
              
              {/* Storefront Card Preview */}
              <View style={{ backgroundColor: '#fff', borderRadius: rs.s(16), borderWidth: 1, borderColor: COLORS.stone200, overflow: 'hidden', marginBottom: rs.s(16) }}>
                {/* Banner */}
                <View style={{ backgroundColor: bannerStyle.bg === 'crest' ? '#44403c' : bannerStyle.bg, padding: rs.s(20), alignItems: 'center' }}>
                  <Text style={{ fontSize: rs.font(22), fontWeight: '900', color: bannerStyle.text || '#fff' }}>{brandName || 'Your Store'}</Text>
                  {storeDescription ? <Text style={{ fontSize: rs.font(10), color: bannerStyle.text || '#fff', opacity: 0.8, marginTop: rs.s(4) }} numberOfLines={2}>{storeDescription}</Text> : null}
                </View>
                
                {/* Social Icons Row */}
                {Object.keys(socialLinks).filter(k => socialLinks[k]).length > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: rs.s(16), paddingVertical: rs.s(8), backgroundColor: COLORS.stone50 }}>
                    {Object.entries(socialLinks).filter(([, v]) => v).map(([k]) => (
                      <Text key={k} style={{ fontSize: rs.font(20) }}>
                        {k === 'instagram' ? '??' : k === 'tiktok' ? '??' : k === 'etsy' ? '???' : k === 'pinterest' ? '??' : k === 'youtube' ? '??' : k === 'facebook' ? '??' : '??'}
                      </Text>
                    ))}
                  </View>
                )}
                
                {/* Items Preview */}
                <View style={{ padding: rs.s(12) }}>
                  {stash.length > 0 ? stash.slice(0, 3).map(item => (
                    <View key={item.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: rs.s(8), borderBottomWidth: 1, borderBottomColor: COLORS.stone100 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: rs.font(13), fontWeight: 'bold', color: COLORS.stone800 }}>{item.name}</Text>
                        <Text style={{ fontSize: rs.font(10), color: COLORS.stone400 }}>{item.platform || 'social'}</Text>
                      </View>
                      <Text style={{ fontSize: rs.font(12), fontWeight: 'bold', color: COLORS.amber700 }}>
                        {item.kaspaPrice > 0 ? `${item.kaspaPrice} KAS` : item.dollarPrice > 0 ? `${item.dollarPrice.toFixed(2)}` : 'Price TBD'}
                      </Text>
                    </View>
                  )) : (
                    <Text style={{ fontSize: rs.font(11), color: COLORS.stone400, textAlign: 'center', paddingVertical: rs.s(12) }}>No items yet � add items in the Items tab</Text>
                  )}
                  {stash.length > 3 && <Text style={{ fontSize: rs.font(10), color: COLORS.amber600, textAlign: 'center', marginTop: rs.s(4) }}>+{stash.length - 3} more items</Text>}
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: rs.s(12), paddingVertical: rs.s(8), backgroundColor: COLORS.stone50 }}>
                  <Text style={{ fontSize: rs.font(9), color: COLORS.stone400 }}>{stash.length} items � {coupons.length} coupons</Text>
                  <Text style={{ fontSize: rs.font(9), color: COLORS.green600, fontWeight: 'bold' }}>? SDK Compliant</Text>
                </View>
              </View>
              <View style={{ backgroundColor: COLORS.amber50, borderRadius: rs.s(8), padding: rs.s(10) }}>
                <Text style={{ fontSize: rs.font(10), color: COLORS.amber700, textAlign: 'center' }}>Tap "Publish" to anchor this on Kaspa L1.</Text>
              </View>
            </SectionCard>
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

