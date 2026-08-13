// ============================================================================
// KASVILLAGE EXPO - VILLAGE MAILBOX COMPONENT v3.0
// ============================================================================
// Merged: UI from VillageMailbox + API from mailbox_arweave_api
// Features:
// - Pixelated store background
// - 5 search sections (DApps, Storefronts, Coupons, Academics, Services)
// - Skeleton loading states
// - Offline indicator with auto-retry
// - Error states with retry buttons
// - Verified-only filtering
// - Pull to refresh
// - Pagination
// ============================================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import OnChainPageView from './OnChainPageView';
import SceneGameEngine from './SceneGameEngine';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  PixelRatio,
  TextInput,
  ActivityIndicator,
  Animated,
  Linking,
  FlatList,
  RefreshControl,
  Modal,
} from 'react-native';
import Svg, { Rect, Defs, Pattern, Line, G, Path, Text as SvgText } from 'react-native-svg';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import { Alert } from 'react-native';
import {
  Search,
  PlayCircle,
  Store,
  FileText,
  Briefcase,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Smartphone,
  Ticket,
  WifiOff,
} from 'lucide-react-native';

// Import API
import {
  DAppEntry, StorefrontEntry, CouponEntry, AcademicEntry, ServiceEntry,
  FetchResult, Board, ServiceCategory, MailboxError,
  fetchDApps, fetchStorefronts, fetchCoupons, fetchAcademics, fetchServices,
  initMailboxAPI, isOnline, subscribeToNetworkChanges,
} from './mailbox_kaspa_api';
import { GridGameEngine, validateGameDescriptor, KvGameDescriptor } from './game_schema';

// ============================================================================
// RESPONSIVE SCALER
// ============================================================================
const { width: SCREEN_WIDTH } = Dimensions.get('window');
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
  
  stone100: '#f5f5f4',
  stone200: '#e7e5e4',
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
  amber500: '#f59e0b',
  amber600: '#d97706',
  amber700: '#b45309',
  amber900: '#78350f',
  orange200: '#fed7aa',
  orange500: '#f97316',
  orange600: '#ea580c',
  
  purple100: '#f3e8ff',
  purple200: '#e9d5ff',
  purple500: '#a855f7',
  purple600: '#9333ea',
  purple700: '#7e22ce',
  purple900: '#581c87',
  
  indigo100: '#e0e7ff',
  indigo200: '#c7d2fe',
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
  
  red50: '#fef2f2',
  red200: '#fecaca',
  red500: '#ef4444',
  red700: '#b91c1c',
  
  blue50: '#eff6ff',
  blue200: '#bfdbfe',
  blue800: '#1e40af',
  
  yellow300: '#fde047',
};

// ============================================================================
// SECTION TYPES
// ============================================================================
type Section = 'dapps' | 'storefronts' | 'coupons' | 'academics' | 'services';

const SECTION_CONFIG: { key: Section; label: string; icon: string; color: string }[] = [
  { key: 'dapps', label: 'DApps', icon: '🎮', color: COLORS.purple600 },
  { key: 'storefronts', label: 'Stores', icon: '🏪', color: COLORS.orange600 },
  { key: 'coupons', label: 'Coupons', icon: '🎟️', color: COLORS.amber600 },
  { key: 'academics', label: 'Academics', icon: '🎓', color: COLORS.indigo600 },
  { key: 'services', label: 'Services', icon: '🔧', color: COLORS.green600 },
];

// ============================================================================
// PIXEL STORE BACKGROUND
// ============================================================================
const PixelStoreBackground: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <View style={bgStyles.container}>
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id="pixelGrid" width={8} height={8} patternUnits="userSpaceOnUse">
            <Rect width={8} height={8} fill="#87CEEB" />
            <Line x1={8} y1={0} x2={8} y2={8} stroke="#7EC8E3" strokeWidth={1} />
            <Line x1={0} y1={8} x2={8} y2={8} stroke="#7EC8E3" strokeWidth={1} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#pixelGrid)" />
      </Svg>
      
      <View style={bgStyles.buildingsRow}>
        {[COLORS.orange500, COLORS.purple500, COLORS.indigo500, COLORS.green500].map((color, i) => (
          <View key={i} style={bgStyles.store}>
            <View style={[bgStyles.awning, { backgroundColor: color }]} />
            <View style={bgStyles.storeBody}>
              <View style={bgStyles.window} />
              <View style={i % 2 === 0 ? bgStyles.door : bgStyles.window} />
            </View>
          </View>
        ))}
      </View>
      
      <View style={bgStyles.ground}>
        <Svg width="100%" height="100%">
          <Defs>
            <Pattern id="streetPattern" width={20} height={20} patternUnits="userSpaceOnUse">
              <Rect width={20} height={20} fill="#8B7355" />
              <Rect x={9} width={2} height={20} fill="#6B5A4A" />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#streetPattern)" />
        </Svg>
      </View>
      
      <View style={bgStyles.decorations}>
        <Text style={bgStyles.lampPost}>🏮</Text>
        <Text style={bgStyles.tree}>🌳</Text>
        <Text style={bgStyles.bench}>🪑</Text>
      </View>
      
      <View style={bgStyles.contentOverlay}>{children}</View>
    </View>
  );
};

const bgStyles = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  buildingsRow: {
    position: 'absolute', top: rs.s(40), left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-around',
    paddingHorizontal: rs.s(8), opacity: 0.3, zIndex: 0,
  },
  store: { width: rs.s(70), alignItems: 'center' },
  awning: { width: rs.s(60), height: rs.s(12), borderTopLeftRadius: rs.s(4), borderTopRightRadius: rs.s(4) },
  storeBody: {
    width: rs.s(50), height: rs.s(60), backgroundColor: '#E8DDD0',
    borderBottomLeftRadius: rs.s(4), borderBottomRightRadius: rs.s(4),
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    alignItems: 'center', gap: rs.s(4), padding: rs.s(4),
  },
  window: { width: rs.s(14), height: rs.s(14), backgroundColor: '#87CEEB', borderWidth: 2, borderColor: '#5D4E37' },
  door: { width: rs.s(12), height: rs.s(20), backgroundColor: '#8B4513', borderTopLeftRadius: rs.s(6), borderTopRightRadius: rs.s(6) },
  ground: { position: 'absolute', bottom: 0, left: 0, right: 0, height: rs.s(60), zIndex: 0 },
  decorations: {
    position: 'absolute', top: rs.s(110), left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-around', opacity: 0.4, zIndex: 0,
  },
  lampPost: { fontSize: rs.font(24) },
  tree: { fontSize: rs.font(28) },
  bench: { fontSize: rs.font(20) },
  contentOverlay: { flex: 1, zIndex: 10 },
});

// ============================================================================
// SKELETON COMPONENTS
// ============================================================================
function SkeletonPulse({ style }: { style?: object }) {
  const pulseAnim = React.useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.6, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  return <Animated.View style={[skeletonStyles.base, { opacity: pulseAnim }, style]} />;
}

function SkeletonCard() {
  return (
    <View style={skeletonStyles.card}>
      <View style={skeletonStyles.header}>
        <SkeletonPulse style={skeletonStyles.icon} />
        <View style={skeletonStyles.textGroup}>
          <SkeletonPulse style={skeletonStyles.title} />
          <SkeletonPulse style={skeletonStyles.subtitle} />
        </View>
      </View>
      <SkeletonPulse style={skeletonStyles.body} />
      <View style={skeletonStyles.footer}>
        <SkeletonPulse style={skeletonStyles.badge} />
        <SkeletonPulse style={skeletonStyles.badge} />
      </View>
    </View>
  );
}

function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <View style={skeletonStyles.list}>
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  base: { backgroundColor: COLORS.stone200, borderRadius: rs.s(8) },
  list: { padding: rs.s(16) },
  card: { backgroundColor: COLORS.cardBg, borderRadius: rs.s(12), padding: rs.s(16), marginBottom: rs.s(12), borderWidth: 1, borderColor: COLORS.stone200 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: rs.s(12) },
  icon: { width: rs.s(40), height: rs.s(40), borderRadius: rs.s(8), marginRight: rs.s(12) },
  textGroup: { flex: 1 },
  title: { height: rs.s(16), width: '60%', marginBottom: rs.s(8) },
  subtitle: { height: rs.s(12), width: '40%' },
  body: { height: rs.s(40), marginBottom: rs.s(12) },
  footer: { flexDirection: 'row' },
  badge: { height: rs.s(20), width: rs.s(60), marginRight: rs.s(8) },
});

// ============================================================================
// OFFLINE BANNER
// ============================================================================
function OfflineBanner() {
  return (
    <View style={offlineStyles.banner}>
      <WifiOff size={rs.s(14)} color={COLORS.black} />
      <Text style={offlineStyles.text}>Offline - Showing cached data</Text>
    </View>
  );
}

const offlineStyles = StyleSheet.create({
  banner: { backgroundColor: COLORS.amber500, paddingVertical: rs.s(8), flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: rs.s(6) },
  text: { color: COLORS.black, fontSize: rs.font(12), fontWeight: '600' },
});

// ============================================================================
// ERROR STATE
// ============================================================================
function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const isMailboxError = error.name === 'MailboxError';
  const message = error.message || 'Something went wrong';

  return (
    <View style={errorStyles.container}>
      <Text style={errorStyles.icon}>⚠️</Text>
      <Text style={errorStyles.title}>{message}</Text>
      <TouchableOpacity style={errorStyles.retryBtn} onPress={onRetry}>
        <RefreshCw size={rs.s(16)} color={COLORS.white} />
        <Text style={errorStyles.retryText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: rs.s(32) },
  icon: { fontSize: rs.font(48), marginBottom: rs.s(16) },
  title: { fontSize: rs.font(16), color: COLORS.red700, textAlign: 'center', marginBottom: rs.s(24) },
  retryBtn: { backgroundColor: COLORS.purple600, flexDirection: 'row', alignItems: 'center', gap: rs.s(8), paddingHorizontal: rs.s(24), paddingVertical: rs.s(12), borderRadius: rs.s(8) },
  retryText: { color: COLORS.white, fontWeight: '600' },
});

// ============================================================================
// EMPTY STATE
// ============================================================================
function EmptyState({ section }: { section: Section }) {
  const messages: Record<Section, { icon: string; title: string; subtitle: string }> = {
    dapps: { icon: '🎮', title: 'No DApps Yet', subtitle: 'Verified DApps will appear here' },
    storefronts: { icon: '🏪', title: 'No Stores Yet', subtitle: 'Verified storefronts will appear here' },
    coupons: { icon: '🎟️', title: 'No Coupons', subtitle: 'Active coupons will appear here' },
    academics: { icon: '🎓', title: 'No Academics', subtitle: 'DKIM-verified researchers will appear here' },
    services: { icon: '🔧', title: 'No Services', subtitle: 'Verified service providers will appear here' },
  };
  const msg = messages[section];

  return (
    <View style={emptyStyles.container}>
      <Text style={emptyStyles.icon}>{msg.icon}</Text>
      <Text style={emptyStyles.title}>{msg.title}</Text>
      <Text style={emptyStyles.subtitle}>{msg.subtitle}</Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: rs.s(32), minHeight: rs.s(200) },
  icon: { fontSize: rs.font(48), marginBottom: rs.s(16) },
  title: { fontSize: rs.font(20), fontWeight: '700', color: COLORS.stone800, marginBottom: rs.s(8) },
  subtitle: { fontSize: rs.font(14), color: COLORS.stone500, textAlign: 'center' },
});

// ============================================================================
// VERIFIED BADGE
// ============================================================================
function VerifiedBadge({ label = 'TownHall' }: { label?: string }) {
  return (
    <View style={badgeStyles.verified}>
      <ShieldCheck size={rs.s(10)} color={COLORS.green700} />
      <Text style={badgeStyles.verifiedText}>{label}</Text>
    </View>
  );
}

function UnverifiedBadge() {
  return (
    <View style={badgeStyles.unverified}>
      <AlertTriangle size={rs.s(10)} color={COLORS.amber700} />
      <Text style={badgeStyles.unverifiedText}>?</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  verified: { flexDirection: 'row', alignItems: 'center', gap: rs.s(4), backgroundColor: COLORS.green100, paddingHorizontal: rs.s(8), paddingVertical: rs.s(3), borderRadius: rs.s(10) },
  verifiedText: { fontSize: rs.font(9), fontWeight: '900', color: COLORS.green700 },
  unverified: { flexDirection: 'row', alignItems: 'center', gap: rs.s(4), backgroundColor: COLORS.amber100, paddingHorizontal: rs.s(8), paddingVertical: rs.s(3), borderRadius: rs.s(10) },
  unverifiedText: { fontSize: rs.font(9), fontWeight: '900', color: COLORS.amber700 },
});

// ============================================================================
// CARD COMPONENTS
// ============================================================================

// DApp Card
function DAppCard({ item, onPress }: { item: DAppEntry; onPress: () => void }) {
  const boardColors: Record<Board, string> = { Elite: COLORS.purple100, Main: COLORS.green100, Incubator: COLORS.amber100 };
  
  return (
    <TouchableOpacity style={cardStyles.dappCard} onPress={onPress} activeOpacity={0.8}>
      <View style={cardStyles.badgeContainer}>
        {item.townhall.verified ? <VerifiedBadge /> : <UnverifiedBadge />}
      </View>
      <View style={[cardStyles.boardTag, { backgroundColor: boardColors[item.board] }]}>
        <Text style={cardStyles.boardText}>{item.board}</Text>
      </View>
      <Text style={cardStyles.dappName} numberOfLines={1}>{item.name}</Text>
      <Text style={cardStyles.dappCategory}>{item.category}</Text>
      {item.templateVerified && (
        <View style={cardStyles.sdkBadge}>
          <Text style={cardStyles.sdkText}>SDK ✓</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// Storefront Card
function StorefrontCard({ item, onPress }: { item: StorefrontEntry; onPress: () => void }) {
  return (
    <TouchableOpacity style={cardStyles.storefrontCard} onPress={onPress} activeOpacity={0.8}>
      <View style={cardStyles.badgeContainer}>
        {item.townhall.verified ? <VerifiedBadge /> : <UnverifiedBadge />}
      </View>
      <Text style={cardStyles.storeIcon}>🏪</Text>
      <Text style={cardStyles.storeName} numberOfLines={1}>{item.storeName}</Text>
      <Text style={cardStyles.storeDesc} numberOfLines={2}>{item.description}</Text>
      <Text style={cardStyles.storeCategory}>{item.category}</Text>
    </TouchableOpacity>
  );
}

// Coupon Card
function CouponCard({ item, onPress }: { item: CouponEntry; onPress: () => void }) {
  const isExpired = item.expiresAt < Date.now();
  const daysLeft = Math.ceil((item.expiresAt - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <TouchableOpacity style={[cardStyles.couponCard, isExpired && cardStyles.expired]} onPress={onPress} activeOpacity={0.8}>
      <View style={cardStyles.couponLeft}>
        <Text style={cardStyles.couponDiscount}>{item.discount}</Text>
      </View>
      <View style={cardStyles.couponContent}>
        <Text style={cardStyles.couponTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={cardStyles.couponDesc} numberOfLines={1}>{item.description}</Text>
        {isExpired ? (
          <Text style={cardStyles.expiredText}>Expired</Text>
        ) : (
          <Text style={cardStyles.expiresText}>{daysLeft} days left</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// Academic Card
function AcademicCard({ item, onPress }: { item: AcademicEntry; onPress: () => void }) {
  return (
    <TouchableOpacity style={cardStyles.academicCard} onPress={onPress} activeOpacity={0.8}>
      <View style={cardStyles.badgeContainer}>
        {item.dkimVerified ? <VerifiedBadge label="DKIM" /> : <UnverifiedBadge />}
      </View>
      <Text style={cardStyles.academicIcon}>🎓</Text>
      <Text style={cardStyles.academicTitle} numberOfLines={1}>{item.title}</Text>
      <Text style={cardStyles.academicInstitution}>{item.institution}</Text>
      <Text style={cardStyles.academicField}>{item.field}</Text>
    </TouchableOpacity>
  );
}

// Service Card
function ServiceCard({ item, onPress }: { item: ServiceEntry; onPress: () => void }) {
  return (
    <TouchableOpacity style={cardStyles.serviceCard} onPress={onPress} activeOpacity={0.8}>
      <View style={cardStyles.badgeContainer}>
        {item.townhall.verified ? <VerifiedBadge /> : <UnverifiedBadge />}
      </View>
      <Text style={cardStyles.serviceCategory}>{item.category}</Text>
      <Text style={cardStyles.serviceTitle} numberOfLines={1}>{item.title}</Text>
      <Text style={cardStyles.serviceDesc} numberOfLines={2}>{item.description}</Text>
      <Text style={cardStyles.serviceArea}>📍 {item.serviceArea}</Text>
    </TouchableOpacity>
  );
}

const cardStyles = StyleSheet.create({
  // DApp
  dappCard: { width: '48%', backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.purple200, borderRadius: rs.s(12), padding: rs.s(12), marginBottom: rs.s(8), position: 'relative' },
  badgeContainer: { position: 'absolute', top: rs.s(8), right: rs.s(8), zIndex: 1 },
  boardTag: { alignSelf: 'flex-start', paddingHorizontal: rs.s(6), paddingVertical: rs.s(2), borderRadius: rs.s(4), marginBottom: rs.s(8) },
  boardText: { fontSize: rs.font(9), fontWeight: 'bold', textTransform: 'uppercase', color: COLORS.stone700 },
  dappName: { fontSize: rs.font(14), fontWeight: 'bold', color: COLORS.stone900 },
  dappCategory: { fontSize: rs.font(10), color: COLORS.stone500, marginTop: rs.s(2) },
  sdkBadge: { position: 'absolute', bottom: rs.s(8), right: rs.s(8), backgroundColor: COLORS.purple100, paddingHorizontal: rs.s(6), paddingVertical: rs.s(2), borderRadius: rs.s(4) },
  sdkText: { fontSize: rs.font(8), fontWeight: 'bold', color: COLORS.purple700 },

  // Storefront
  storefrontCard: { width: '48%', backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.orange200, borderRadius: rs.s(12), padding: rs.s(12), marginBottom: rs.s(8), position: 'relative' },
  storeIcon: { fontSize: rs.font(24), marginBottom: rs.s(4) },
  storeName: { fontSize: rs.font(14), fontWeight: 'bold', color: COLORS.stone900 },
  storeDesc: { fontSize: rs.font(10), color: COLORS.stone500, marginTop: rs.s(2) },
  storeCategory: { fontSize: rs.font(9), color: COLORS.orange600, marginTop: rs.s(4), fontWeight: 'bold' },

  // Coupon
  couponCard: { backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.yellow300, borderRadius: rs.s(12), padding: rs.s(14), flexDirection: 'row', alignItems: 'center', marginBottom: rs.s(8) },
  expired: { opacity: 0.5 },
  couponLeft: { marginRight: rs.s(12) },
  couponDiscount: { fontSize: rs.font(18), fontWeight: '900', color: COLORS.amber600 },
  couponContent: { flex: 1 },
  couponTitle: { fontSize: rs.font(14), fontWeight: 'bold', color: COLORS.stone900 },
  couponDesc: { fontSize: rs.font(11), color: COLORS.stone500, marginTop: rs.s(2) },
  expiredText: { fontSize: rs.font(10), color: COLORS.red500, marginTop: rs.s(4), fontWeight: 'bold' },
  expiresText: { fontSize: rs.font(10), color: COLORS.amber600, marginTop: rs.s(4) },

  // Academic
  academicCard: { width: '48%', backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.indigo200, borderRadius: rs.s(12), padding: rs.s(12), marginBottom: rs.s(8), position: 'relative' },
  academicIcon: { fontSize: rs.font(24), marginBottom: rs.s(4) },
  academicTitle: { fontSize: rs.font(14), fontWeight: 'bold', color: COLORS.stone900 },
  academicInstitution: { fontSize: rs.font(10), color: COLORS.indigo600, marginTop: rs.s(2) },
  academicField: { fontSize: rs.font(9), color: COLORS.stone500, marginTop: rs.s(2) },

  // Service
  serviceCard: { width: '48%', backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.green200, borderRadius: rs.s(12), padding: rs.s(12), marginBottom: rs.s(8), position: 'relative' },
  serviceCategory: { fontSize: rs.font(9), fontWeight: 'bold', color: COLORS.green700, textTransform: 'uppercase', marginBottom: rs.s(4) },
  serviceTitle: { fontSize: rs.font(14), fontWeight: 'bold', color: COLORS.stone900 },
  serviceDesc: { fontSize: rs.font(10), color: COLORS.stone500, marginTop: rs.s(2) },
  serviceArea: { fontSize: rs.font(10), color: COLORS.stone600, marginTop: rs.s(4) },
});

// ============================================================================
// MAILBOX ENTRY CONFIRMATION
// ============================================================================
function MailboxEntryConfirmation({ onEnter }: { onEnter: () => void }) {
  return (
    <View style={entryStyles.container}>
      <View style={entryStyles.card}>
        <Text style={entryStyles.icon}>📬</Text>
        <Text style={entryStyles.title}>Village Mailbox</Text>
        <Text style={entryStyles.subtitle}>Yellow Pages for Coupons, Stores, DApps & Academics</Text>
        
        <View style={entryStyles.infoBox}>
          <Text style={entryStyles.infoTitle}>📍 You are entering the Mailbox app.</Text>
          <Text style={entryStyles.infoText}>
            This is a <Text style={entryStyles.bold}>separate service</Text> that connects to your wallet. 
            It helps you discover coupons, storefronts, DApps, and academic services from other Village members.
          </Text>
          
          <View style={entryStyles.blueBox}>
            <Text style={entryStyles.blueText}>
              <Text style={entryStyles.bold}>🔒 Your wallet works without this.</Text> If the Mailbox service 
              goes offline, you can still send KAS and use Neighbor Agreements directly on Kaspa L1.
            </Text>
          </View>
        </View>
        
        <TouchableOpacity style={entryStyles.enterButton} onPress={onEnter}>
          <Text style={entryStyles.enterButtonText}>📬 Enter Mailbox</Text>
        </TouchableOpacity>
        
        <Text style={entryStyles.footer}>
          Only <Text style={entryStyles.bold}>TownHall verified</Text> listings are shown. 
          Unverified stores/DApps are hidden.
        </Text>
      </View>
    </View>
  );
}

const entryStyles = StyleSheet.create({
  container: { flex: 1, padding: rs.s(24), justifyContent: 'center' },
  card: { backgroundColor: COLORS.cardBg, borderRadius: rs.s(24), padding: rs.s(24), borderWidth: 2, borderColor: COLORS.amber300 },
  icon: { fontSize: rs.font(48), textAlign: 'center', marginBottom: rs.s(12) },
  title: { fontSize: rs.font(24), fontWeight: '900', color: COLORS.amber900, textAlign: 'center' },
  subtitle: { fontSize: rs.font(14), color: COLORS.amber700, textAlign: 'center', marginTop: rs.s(8) },
  infoBox: { backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: rs.s(12), padding: rs.s(14), marginTop: rs.s(20), borderWidth: 1, borderColor: COLORS.amber200 },
  infoTitle: { fontSize: rs.font(14), fontWeight: 'bold', color: COLORS.stone700, marginBottom: rs.s(8) },
  infoText: { fontSize: rs.font(12), color: COLORS.stone600, lineHeight: rs.font(18) },
  bold: { fontWeight: 'bold' },
  blueBox: { backgroundColor: COLORS.blue50, borderRadius: rs.s(8), padding: rs.s(12), marginTop: rs.s(12), borderWidth: 1, borderColor: COLORS.blue200 },
  blueText: { fontSize: rs.font(11), color: COLORS.blue800, lineHeight: rs.font(16) },
  enterButton: { backgroundColor: COLORS.amber600, borderRadius: rs.s(12), paddingVertical: rs.s(16), marginTop: rs.s(20) },
  enterButtonText: { fontSize: rs.font(18), fontWeight: 'bold', color: COLORS.white, textAlign: 'center' },
  footer: { fontSize: rs.font(10), color: COLORS.stone500, textAlign: 'center', marginTop: rs.s(16) },
});

// ============================================================================
// MAIN VILLAGE MAILBOX COMPONENT
// ============================================================================
export default function VillageMailbox() {
  // Entry state
  const [hasEntered, setHasEntered] = useState(false);
  
  // Network state
  const [online, setOnline] = useState(true);
  
  // UI state
  const [section, setSection] = useState<Section>('dapps');
  const [storeView, setStoreView] = useState<{ entry: StorefrontEntry; config: any | null; loading: boolean } | null>(null);
  const [gameView, setGameView] = useState<{ name: string; addr: string; hash: string; loading: boolean; game: KvGameDescriptor | null; error: string } | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Data
  const [dapps, setDapps] = useState<DAppEntry[]>([]);
  const [storefronts, setStorefronts] = useState<StorefrontEntry[]>([]);
  const [coupons, setCoupons] = useState<CouponEntry[]>([]);
  const [academics, setAcademics] = useState<AcademicEntry[]>([]);
  const [services, setServices] = useState<ServiceEntry[]>([]);
  
  // Pagination
  const [cursors, setCursors] = useState<Record<Section, string | undefined>>({
    dapps: undefined, storefronts: undefined, coupons: undefined, academics: undefined, services: undefined,
  });
  const [hasMore, setHasMore] = useState<Record<Section, boolean>>({
    dapps: false, storefronts: false, coupons: false, academics: false, services: false,
  });

  // Check if entered before
  useEffect(() => {
    SecureStore.getItemAsync('kv_mailbox_entered').then(val => {
      if (val === 'true') setHasEntered(true);
    });
  }, []);

  // Initialize API and network listener
  useEffect(() => {
    const cleanup = initMailboxAPI();
    setOnline(isOnline());
    
    const unsubscribe = subscribeToNetworkChanges((online) => {
      setOnline(online);
      if (online && error) fetchData(true);
    });

    return () => { cleanup(); unsubscribe(); };
  }, []);

  // Fetch data with verified-only filtering
  const fetchData = useCallback(async (isRefresh = false) => {
    if (loading && !isRefresh) return;
    
    setLoading(true);
    setError(null);

    try {
      let result: FetchResult<any>;
      const cursor = isRefresh ? undefined : cursors[section];

      switch (section) {
        case 'dapps':
          result = await fetchDApps(cursor);
          result.items = result.items.filter((d: DAppEntry) => d.townhall.verified);
          setDapps(isRefresh ? result.items : [...dapps, ...result.items]);
          break;
        case 'storefronts':
          result = await fetchStorefronts(cursor);
          result.items = result.items.filter((s: StorefrontEntry) => s.townhall.verified);
          setStorefronts(isRefresh ? result.items : [...storefronts, ...result.items]);
          break;
        case 'coupons':
          result = await fetchCoupons(cursor);
          setCoupons(isRefresh ? result.items : [...coupons, ...result.items]);
          break;
        case 'academics':
          result = await fetchAcademics(cursor);
          result.items = result.items.filter((a: AcademicEntry) => a.dkimVerified);
          setAcademics(isRefresh ? result.items : [...academics, ...result.items]);
          break;
        case 'services':
          result = await fetchServices(cursor);
          result.items = result.items.filter((s: ServiceEntry) => s.townhall.verified);
          setServices(isRefresh ? result.items : [...services, ...result.items]);
          break;
      }

      setCursors(prev => ({ ...prev, [section]: result.nextCursor }));
      setHasMore(prev => ({ ...prev, [section]: result.hasMore }));
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [section, cursors, dapps, storefronts, coupons, academics, services, loading]);

  // Initial fetch on section change
  useEffect(() => {
    if (hasEntered) {
      setCursors(prev => ({ ...prev, [section]: undefined }));
      fetchData(true);
    }
  }, [section, hasEntered]);

  // Get current data
  const getCurrentData = () => {
    switch (section) {
      case 'dapps': return dapps;
      case 'storefronts': return storefronts;
      case 'coupons': return coupons;
      case 'academics': return academics;
      case 'services': return services;
    }
  };

  // Filter by query
  const filteredData = useMemo(() => {
    const data = getCurrentData();
    if (!query.trim()) return []; // search-first: no auto-populated feed
    
    const q = query.toLowerCase();
    return data.filter((item: any) => {
      const searchable = [
        item.name, item.title, item.storeName, item.description, 
        item.category, item.institution, item.field
      ].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(q);
    });
  }, [section, dapps, storefronts, coupons, academics, services, query]);

  // Render item
  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const onPress = () => {
      // Route based on section type
      if (section === 'storefronts') {
        setStoreView({ entry: item, config: null, loading: true });
        (async () => {
          try {
            const cfgHash = (item as any).configHash || '';
            console.log('[Mailbox] modal open - cfgHash:', cfgHash ? cfgHash.slice(0, 16) : 'MISSING', 'addr:', item.arweaveTx.slice(0, 24));
            if (!cfgHash) { setStoreView(sv => sv ? { ...sv, loading: false } : sv); return; }
            const { fetchStoreConfig } = await import('./config_chunks');
            const { config, error: _cfgErr } = await fetchStoreConfig(item.arweaveTx, cfgHash, 'testnet-10');
            console.log('[Mailbox] cfg fetch result:', config ? 'OK brand=' + config.brandName : 'NULL err=' + _cfgErr);
            setStoreView(sv => sv && sv.entry.id === item.id ? { ...sv, config, loading: false } : sv);
          } catch (e) {
            console.log('[Mailbox] store config fetch failed:', e);
            setStoreView(sv => sv ? { ...sv, loading: false } : sv);
          }
        })();
      } else if (section === 'dapps') {
        if ((item as any).gameHash) {
          setGameView({ name: item.name, addr: item.arweaveTx, hash: (item as any).gameHash, loading: false, game: null, error: '' });
          return;
        }
        // DApps, games, websites — video demo + live URL
        const videoLink = item.videoUrl || '';
        const appLink = item.gameUrl || item.primaryLink || '';
        if (videoLink && appLink) {
          Alert.alert(item.name || 'App', 'Watch the demo or open the app?', [
            { text: 'Cancel', style: 'cancel' },
            { text: '🎬 Watch Demo', onPress: () => Linking.openURL(videoLink.startsWith('http') ? videoLink : 'https://' + videoLink) },
            { text: '🚀 Open App', onPress: () => Linking.openURL(appLink.startsWith('http') ? appLink : 'https://' + appLink) },
          ]);
        } else {
          const link = videoLink || appLink;
          if (link) Linking.openURL(link.startsWith('http') ? link : 'https://' + link);
          else Alert.alert('No Link', 'No demo or app URL set.');
        }
      } else if (section === 'academics') {
        const videoLink = item.videoUrl || '';
        const repoLink = item.repositoryUrl || '';
        if (videoLink && repoLink) {
          Alert.alert(item.title || 'Research', 'Watch the explainer or view the paper?', [
            { text: 'Cancel', style: 'cancel' },
            { text: '🎬 Video Explainer', onPress: () => Linking.openURL(videoLink.startsWith('http') ? videoLink : 'https://' + videoLink) },
            { text: '📄 View Paper', onPress: () => Linking.openURL(repoLink.startsWith('http') ? repoLink : 'https://' + repoLink) },
          ]);
        } else {
          const link = videoLink || repoLink;
          if (link) Linking.openURL(link.startsWith('http') ? link : 'https://' + link);
          else Alert.alert('Research', item.title || 'No link available');
        }
      } else if (section === 'coupons') {
        // Copy coupon code
        try { Clipboard.setString(item.code || item.title || ''); Alert.alert('Coupon Copied!', (item.code || item.title) + ' — use at checkout in a Neighbor Agreement'); } catch { Alert.alert('Coupon', item.title || item.code || 'No code'); }
      } else if (section === 'services') {
        const svcLink = item.contactChannel || item.primaryLink || '';
        if (svcLink) Linking.openURL(svcLink.startsWith('http') ? svcLink : 'https://' + svcLink);
        else Alert.alert('Service', item.title || 'No contact info');
      } else {
        Alert.alert('Details', item.name || item.storeName || item.title || 'No details');
      }
    };
    
    switch (section) {
      case 'dapps': return <DAppCard item={item} onPress={onPress} />;
      case 'storefronts': return <StorefrontCard item={item} onPress={onPress} />;
      case 'coupons': return <CouponCard item={item} onPress={onPress} />;
      case 'academics': return <AcademicCard item={item} onPress={onPress} />;
      case 'services': return <ServiceCard item={item} onPress={onPress} />;
    }
  };

  // Handlers
  const handleEnter = async () => {
    await SecureStore.setItemAsync('kv_mailbox_entered', 'true');
    setHasEntered(true);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData(true);
  };

  const handleLoadMore = () => {
    if (hasMore[section] && !loading) fetchData(false);
  };

  const handleRetry = () => {
    setError(null);
    fetchData(true);
  };

  // Show entry confirmation first
  if (!hasEntered) {
    return (
      <PixelStoreBackground>
        <MailboxEntryConfirmation onEnter={handleEnter} />
      </PixelStoreBackground>
    );
  }

  return (
    <PixelStoreBackground>
      <View style={mainStyles.container}>
        {/* Offline Banner */}
        {!online && <OfflineBanner />}

        {/* Header */}
        <View style={mainStyles.header}>
          <Text style={mainStyles.headerTitle}>📬 Village Mailbox</Text>
          <Text style={mainStyles.headerSubtitle}>Discover stores, DApps & research — tap to visit</Text>
        </View>

        {/* Section Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={mainStyles.tabs} contentContainerStyle={mainStyles.tabsContent}>
          {SECTION_CONFIG.map(({ key, label, icon, color }) => (
            <TouchableOpacity
              key={key}
              style={[mainStyles.tab, section === key && mainStyles.tabActive]}
              onPress={() => setSection(key)}
            >
              <Text style={mainStyles.tabIcon}>{icon}</Text>
              <Text style={[mainStyles.tabLabel, section === key && mainStyles.tabLabelActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Search */}
        <View style={mainStyles.searchContainer}>
          <TextInput
            style={mainStyles.searchInput}
            placeholder={`Search ${SECTION_CONFIG.find(s => s.key === section)?.label}...`}
            placeholderTextColor={COLORS.stone400}
            value={query}
            onChangeText={setQuery}
          />
          <TouchableOpacity style={mainStyles.searchButton}>
            <Search size={rs.s(20)} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        {error ? (
          <ErrorState error={error} onRetry={handleRetry} />
        ) : !query.trim() ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: rs.s(32) }}>
            <Search size={rs.s(48)} color={COLORS.amber500} />
            <Text style={{ fontSize: rs.font(18), fontWeight: '900', color: COLORS.amber900, marginTop: rs.s(16), textAlign: 'center' }}>
              Search the Village
            </Text>
            <Text style={{ fontSize: rs.font(12), color: COLORS.stone500, marginTop: rs.s(8), textAlign: 'center' }}>
              Type a store, app, coupon, or topic above. Results come straight from the Kaspa L1 registry.
            </Text>
          </View>
        ) : loading && filteredData.length === 0 ? (
          <SkeletonList count={4} />
        ) : filteredData.length === 0 ? (
          <EmptyState section={section} />
        ) : (
          <FlatList
            data={filteredData}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            numColumns={section === 'coupons' ? 1 : 2}
            key={section === 'coupons' ? 'list' : 'grid'}
            columnWrapperStyle={section !== 'coupons' ? mainStyles.gridRow : undefined}
            contentContainerStyle={mainStyles.list}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.purple600} />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              loading && filteredData.length > 0 ? (
                <ActivityIndicator size="small" color={COLORS.purple600} style={mainStyles.footerLoader} />
              ) : null
            }
          />
        )}
      </View>

      {/* Game generator - descriptor fetched from L1, hash verified, rendered on-device */}
      <Modal visible={!!gameView} animationType="slide" transparent onRequestClose={() => setGameView(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(28,25,23,0.85)', justifyContent: 'center', padding: rs.s(20) }}>
          <View style={{ backgroundColor: COLORS.cardBg, borderRadius: rs.s(20), padding: rs.s(18), maxHeight: '88%' }}>
            {gameView && (
              <View>
                <Text style={{ fontSize: rs.font(19), fontWeight: '900', color: COLORS.stone900, textAlign: 'center' }}>{gameView.name}</Text>
                <Text style={{ fontSize: rs.font(9), color: COLORS.stone400, textAlign: 'center', marginTop: 2, marginBottom: rs.s(12) }}>
                  descriptor {gameView.hash.slice(0, 16)}... on Kaspa L1
                </Text>
                {gameView.game ? (
                  gameView.game.engine === 'scene'
                        ? <SceneGameEngine game={gameView.game} />
                        : <GridGameEngine game={gameView.game} />
                ) : gameView.loading ? (
                  <ActivityIndicator color={COLORS.indigo600} style={{ paddingVertical: rs.s(30) }} />
                ) : (
                  <View style={{ alignItems: 'center' }}>
                    {gameView.error ? <Text style={{ fontSize: rs.font(11), color: COLORS.red500, textAlign: 'center', marginBottom: rs.s(10) }}>{gameView.error}</Text> : null}
                    <TouchableOpacity onPress={() => {
                      setGameView(g => g ? { ...g, loading: true, error: '' } : g);
                      (async () => {
                        try {
                          const { fetchStoreConfig } = await import('./config_chunks');
                          const { config, error } = await fetchStoreConfig(gameView.addr, gameView.hash, 'testnet-10');
                          if (!config) { setGameView(g => g ? { ...g, loading: false, error: error || 'fetch failed' } : g); return; }
                          const v = validateGameDescriptor(config);
                          if (!v.ok || !v.game) { setGameView(g => g ? { ...g, loading: false, error: v.error || 'invalid descriptor' } : g); return; }
                          console.log('[Game] generated:', v.game.name, v.game.board + 'x' + v.game.board);
                          setGameView(g => g ? { ...g, loading: false, game: v.game! } : g);
                        } catch (e: any) { setGameView(g => g ? { ...g, loading: false, error: String(e?.message || e) } : g); }
                      })();
                    }} style={{ backgroundColor: COLORS.indigo600, borderRadius: rs.s(12), paddingVertical: rs.s(14), paddingHorizontal: rs.s(36) }}>
                      <Text style={{ color: '#fff', fontWeight: '900', fontSize: rs.font(15) }}>Generate Game</Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: rs.font(9), color: COLORS.stone400, marginTop: rs.s(8), textAlign: 'center' }}>
                      Fetches the descriptor from Kaspa L1, verifies its hash, and renders it locally.
                    </Text>
                  </View>
                )}
                <TouchableOpacity onPress={() => setGameView(null)} style={{ marginTop: rs.s(12), alignItems: 'center', paddingVertical: rs.s(8) }}>
                  <Text style={{ fontSize: rs.font(13), fontWeight: 'bold', color: COLORS.stone500 }}>Close</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Procedural storefront view - rendered from on-chain config, zero hosted images */}
      <Modal visible={!!storeView} animationType="slide" transparent onRequestClose={() => setStoreView(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(28,25,23,0.85)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: COLORS.cardBg, borderTopLeftRadius: rs.s(24), borderTopRightRadius: rs.s(24), maxHeight: '88%', overflow: 'hidden' }}>
            {storeView && (() => {
              const cfg = storeView.config;
              const bn = cfg?.bannerStyle;
              const recipe = cfg?.bannerRecipe;
              const useGraffiti = cfg?.selectedFont?.id === 'graffiti' && recipe && recipe.text;
              const bg = bn && bn.bg && bn.bg !== 'crest' ? bn.bg : '#44403c';
              const fg = (bn && bn.text) || '#fff';
              const fontId = cfg?.selectedFont?.id || 'clean';
              const fontMap: any = {
                clean:   { weight: '400', spacing: 0, transform: 'none' },
                bold:    { weight: '900', spacing: 2, transform: 'uppercase' },
                elegant: { weight: '300', spacing: 4, transform: 'capitalize' },
                retro:   { weight: '800', spacing: 6, transform: 'uppercase' },
                graffiti:{ weight: '900', spacing: 0, transform: 'uppercase' },
              };
              const fstyle = fontMap[fontId] || fontMap.clean;
              const cols = Number(cfg?.selectedLayout?.id === 'grid-2' ? 2 : cfg?.selectedLayout?.id === 'grid-3' ? 3 : cfg?.selectedLayout?.id === 'masonry' ? 2 : 1);
              const swatch = (name: string) => {
                let h = 0;
                for (let i = 0; i < (name || '').length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
                return 'hsl(' + (Math.abs(h) % 360) + ', 55%, 62%)';
              };
              const items: any[] = cfg?.stash || [];
              const social: Record<string, string> = cfg?.socialLinks || {};
              const links = Object.entries(social).filter(([, v]) => v);
              const now = Date.now();
              const liveCoupons: any[] = (cfg?.coupons || []).filter((c: any) =>
                (c.createdAt || 0) + (c.expiryDays || 30) * 86400000 > now && (c.usedCount || 0) < (c.maxUses || 1));
              const logoRound = (cfg?.logoShape || 'round') === 'round';
              const brandInitial = (cfg?.brandName || storeView.entry.storeName || '?').charAt(0).toUpperCase();
              return (
                <View>
                  {/* Banner: graffiti SVG when selected, else styled text */}
                  {useGraffiti ? (
                    <View style={{ backgroundColor: recipe.bgColor || '#fafaf9', paddingVertical: rs.s(8) }}>
                      <Svg viewBox="0 0 360 120" style={{ width: '100%', height: rs.s(110) }}>
                        <Defs>
                          <Pattern id="mbBricks" patternUnits="userSpaceOnUse" width="20" height="10">
                            <Rect width="20" height="10" fill={recipe.bgColor || '#fafaf9'} />
                            <Line x1="0" y1="5" x2="20" y2="5" stroke="#d6d3d1" strokeWidth="0.5" />
                            <Line x1="10" y1="0" x2="10" y2="5" stroke="#d6d3d1" strokeWidth="0.5" />
                          </Pattern>
                        </Defs>
                        <Rect x="0" y="0" width="360" height="120" fill="url(#mbBricks)" />
                        {recipe.decoStyle === 'stars' && (
                          <G>
                            <Path d="M30 15 L33 25 L43 25 L35 31 L38 41 L30 35 L22 41 L25 31 L17 25 L27 25 Z" fill={recipe.fillColor} opacity="0.3" />
                            <Path d="M320 20 L322 26 L328 26 L323 30 L325 36 L320 32 L315 36 L317 30 L312 26 L318 26 Z" fill={recipe.fillColor} opacity="0.3" />
                          </G>
                        )}
                        {recipe.decoStyle === 'arrows' && (
                          <G>
                            <Path d="M15 60 L30 50 L30 55 L50 55 L50 65 L30 65 L30 70 Z" fill={recipe.fillColor} opacity="0.2" />
                            <Path d="M345 60 L330 50 L330 55 L310 55 L310 65 L330 65 L330 70 Z" fill={recipe.fillColor} opacity="0.2" />
                          </G>
                        )}
                        {String(recipe.text || '').split('').map((ch: string, i: number) => {
                          const total = String(recipe.text || '').length;
                          const charW = Math.min(320 / Math.max(total, 1), 50);
                          const startX = (360 - total * charW) / 2;
                          const x = startX + i * charW + charW / 2;
                          const y = recipe.style === 'wild' ? 75 + Math.sin(i * 0.8) * 8 : 78;
                          const rot = recipe.style === 'wild' ? Math.sin(i * 1.2) * 10 : recipe.style === 'block' ? (i % 2 === 0 ? -3 : 3) : 0;
                          const fsz = recipe.style === 'bubble' ? 48 : 44;
                          const sw = recipe.style === 'bubble' ? 8 : 5;
                          return (
                            <G key={i} transform={'rotate(' + rot + ' ' + x + ' ' + y + ')'}>
                              <SvgText x={x + 3} y={y + 3} fontSize={fsz} fontWeight="900" fill={recipe.shadowColor} opacity="0.5" textAnchor="middle">{ch}</SvgText>
                              <SvgText x={x} y={y} fontSize={fsz} fontWeight="900" fill="none" stroke={recipe.outlineColor} strokeWidth={sw} textAnchor="middle">{ch}</SvgText>
                              <SvgText x={x} y={y} fontSize={fsz} fontWeight="900" fill={recipe.fillColor} textAnchor="middle">{ch}</SvgText>
                            </G>
                          );
                        })}
                      </Svg>
                    </View>
                  ) : (
                    <View style={{ backgroundColor: bg, padding: rs.s(20), alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs.s(10) }}>
                        <View style={{ width: rs.s(38), height: rs.s(38), borderRadius: logoRound ? rs.s(19) : rs.s(9), backgroundColor: swatch(cfg?.brandName || storeView.entry.storeName), justifyContent: 'center', alignItems: 'center' }}>
                          <Text style={{ fontSize: rs.font(16), fontWeight: '900', color: '#fff' }}>{brandInitial}</Text>
                        </View>
                        <Text style={{ fontSize: rs.font(21), fontWeight: fstyle.weight as any, letterSpacing: fstyle.spacing, textTransform: fstyle.transform as any, color: fg }}>{cfg?.brandName || storeView.entry.storeName}</Text>
                      </View>
                      {cfg?.storeDescription ? <Text style={{ fontSize: rs.font(11), color: fg, opacity: 0.85, marginTop: rs.s(6), textAlign: 'center' }} numberOfLines={2}>{cfg.storeDescription}</Text> : null}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs.s(6), marginTop: rs.s(8) }}>
                        <ShieldCheck size={rs.s(13)} color={fg} />
                        <Text style={{ fontSize: rs.font(9), color: fg, opacity: 0.9 }}>Pledge-anchored on Kaspa L1</Text>
                      </View>
                    </View>
                  )}
                  <ScrollView style={{ maxHeight: rs.s(430) }} contentContainerStyle={{ padding: rs.s(14) }}>
                    {storeView.loading ? (
                      <ActivityIndicator color={COLORS.amber600} style={{ paddingVertical: rs.s(30) }} />
                    ) : !cfg ? (
                      <Text style={{ fontSize: rs.font(12), color: COLORS.stone500, textAlign: 'center', paddingVertical: rs.s(24) }}>
                        Config not yet on-chain for this store. Seller may need to republish.
                      </Text>
                    ) : (
                      <View>
                        {/* On-chain HTML page: hash-pinned, sandboxed, kv:// links only */}
                        {cfg.pageHash ? (
                          <View style={{ height: rs.s(360), marginBottom: rs.s(10), borderRadius: rs.s(8), overflow: 'hidden', borderWidth: 1, borderColor: COLORS.stone200 }}>
                            <OnChainPageView
                              storeAddress={storeView.entry.arweaveTx}
                              pageHash={cfg.pageHash}
                              network="testnet-10"
                              ownerPubkey={(storeView.entry as any).owner || (cfg as any).ownerPubkey || ''}
                              onDirectMessage={(pk: string) => {
                                setStoreView(null);
                                Alert.alert('Contact seller', 'Open a Neighbor Agreement with this seller to message them.');
                                console.log('[Mailbox] kv://dm -> owner', String(pk).slice(0, 16));
                              }}
                              onProduct={(id: string) => console.log('[Mailbox] kv://product', id)}
                            />
                          </View>
                        ) : null}
                        {/* Coupons */}
                        {liveCoupons.length > 0 && (
                          <View style={{ marginBottom: rs.s(10) }}>
                            {liveCoupons.map((c: any) => (
                              <TouchableOpacity key={c.id} onPress={() => { try { Clipboard.setStringAsync(c.code); Alert.alert('Coupon Copied!', c.code + ' - use at checkout'); } catch {} }}
                                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.amber100, borderRadius: rs.s(10), padding: rs.s(10), marginBottom: rs.s(6), borderWidth: 1, borderColor: COLORS.amber300, borderStyle: 'dashed' }}>
                                <Ticket size={rs.s(16)} color={COLORS.amber700} />
                                <Text style={{ flex: 1, fontSize: rs.font(13), fontWeight: '900', fontFamily: 'monospace', color: COLORS.amber900, marginLeft: rs.s(8) }}>{c.code}</Text>
                                <Text style={{ fontSize: rs.font(11), fontWeight: 'bold', color: COLORS.amber700 }}>
                                  {c.discountPercent > 0 ? c.discountPercent + '% off' : c.discountKas + ' KAS off'}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                        {/* Items - layout-aware grid */}
                        {items.length > 0 ? (
                          <View style={{ flexDirection: cols > 1 ? 'row' : 'column', flexWrap: 'wrap', gap: rs.s(8) }}>
                            {items.map((it: any) => (
                              <TouchableOpacity key={it.id} onPress={() => { if (it.socialUrl) Linking.openURL(it.socialUrl.startsWith('http') ? it.socialUrl : 'https://' + it.socialUrl); }}
                                style={{ width: cols === 3 ? '31%' : cols === 2 ? '48%' : '100%', flexDirection: cols > 1 ? 'column' : 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: rs.s(12), padding: rs.s(10), borderWidth: 1, borderColor: COLORS.stone200 }} activeOpacity={0.7}>
                                <View style={{ width: cols > 1 ? '100%' : rs.s(44), height: cols > 1 ? rs.s(64) : rs.s(44), borderRadius: rs.s(10), backgroundColor: swatch(it.name), justifyContent: 'center', alignItems: 'center', marginRight: cols > 1 ? 0 : rs.s(10), marginBottom: cols > 1 ? rs.s(6) : 0 }}>
                                  <Text style={{ fontSize: rs.font(cols > 1 ? 22 : 16), fontWeight: '900', color: '#fff' }}>{(it.name || '?').charAt(0).toUpperCase()}</Text>
                                </View>
                                <View style={{ flex: cols > 1 ? undefined : 1, alignItems: cols > 1 ? 'center' : 'flex-start' }}>
                                  <Text style={{ fontSize: rs.font(12), fontWeight: 'bold', color: COLORS.stone800, textAlign: cols > 1 ? 'center' : 'left' }} numberOfLines={1}>{it.name}</Text>
                                  {it.description && cols === 1 ? <Text style={{ fontSize: rs.font(10), color: COLORS.stone500 }} numberOfLines={1}>{it.description}</Text> : null}
                                  <Text style={{ fontSize: rs.font(11), color: COLORS.amber700, marginTop: 2 }}>
                                    {it.kaspaPrice > 0 ? it.kaspaPrice + ' KAS' : it.dollarPrice > 0 ? '$' + Number(it.dollarPrice).toFixed(2) : 'Price TBD'}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            ))}
                          </View>
                        ) : (
                          <Text style={{ fontSize: rs.font(12), color: COLORS.stone400, textAlign: 'center', paddingVertical: rs.s(16) }}>No items listed yet</Text>
                        )}
                        {/* Social links */}
                        {links.length > 0 && (
                          <View style={{ marginTop: rs.s(12) }}>
                            <Text style={{ fontSize: rs.font(10), fontWeight: 'bold', color: COLORS.stone500, textTransform: 'uppercase', marginBottom: rs.s(6) }}>Visit</Text>
                            {links.map(([k, v]) => (
                              <TouchableOpacity key={k} onPress={() => Linking.openURL(String(v).startsWith('http') ? String(v) : 'https://' + v)}
                                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.amber50, borderRadius: rs.s(10), padding: rs.s(10), marginBottom: rs.s(6) }}>
                                <Text style={{ flex: 1, fontSize: rs.font(12), fontWeight: 'bold', color: COLORS.amber900, textTransform: 'capitalize' }}>{k}</Text>
                                <ArrowRight size={rs.s(14)} color={COLORS.amber700} />
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    )}
                  </ScrollView>
                  <TouchableOpacity onPress={() => setStoreView(null)} style={{ padding: rs.s(14), alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.stone200 }}>
                    <Text style={{ fontSize: rs.font(13), fontWeight: 'bold', color: COLORS.stone600 }}>Close</Text>
                  </TouchableOpacity>
                </View>
              );
            })()}
          </View>
        </View>
      </Modal>
    </PixelStoreBackground>
  );
}

const mainStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: rs.s(16), paddingTop: rs.s(16), paddingBottom: rs.s(8) },
  headerTitle: { fontSize: rs.font(24), fontWeight: '900', color: COLORS.amber900 },
  headerSubtitle: { fontSize: rs.font(12), color: COLORS.amber700, marginTop: rs.s(4) },
  
  tabs: { maxHeight: rs.s(50), marginBottom: rs.s(8) },
  tabsContent: { paddingHorizontal: rs.s(12) },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: rs.s(14), paddingVertical: rs.s(8), marginRight: rs.s(8), borderRadius: rs.s(20), backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.stone200 },
  tabActive: { backgroundColor: COLORS.amber600, borderColor: COLORS.amber600 },
  tabIcon: { fontSize: rs.font(14), marginRight: rs.s(4) },
  tabLabel: { fontSize: rs.font(12), color: COLORS.stone600, fontWeight: 'bold' },
  tabLabelActive: { color: COLORS.white },
  
  searchContainer: { flexDirection: 'row', paddingHorizontal: rs.s(16), marginBottom: rs.s(12), gap: rs.s(8) },
  searchInput: { flex: 1, backgroundColor: COLORS.cardBg, borderRadius: rs.s(12), paddingHorizontal: rs.s(14), paddingVertical: rs.s(12), fontSize: rs.font(14), fontWeight: 'bold', color: COLORS.stone800, borderWidth: 1, borderColor: COLORS.stone200 },
  searchButton: { width: rs.s(48), height: rs.s(48), borderRadius: rs.s(12), backgroundColor: COLORS.amber600, justifyContent: 'center', alignItems: 'center' },
  
  list: { paddingHorizontal: rs.s(16), paddingBottom: rs.s(100) },
  gridRow: { justifyContent: 'space-between' },
  footerLoader: { paddingVertical: rs.s(20) },
});

export { VillageMailbox };
