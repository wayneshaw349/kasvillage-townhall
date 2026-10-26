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
type Section = 'dapps' | 'storefronts' | 'coupons' | 'academics' | 'services' | 'games';

const SECTION_CONFIG: { key: Section; label: string; icon: string; color: string }[] = [
  { key: 'dapps', label: 'DApps', icon: '🎮', color: COLORS.purple600 },
  { key: 'storefronts', label: 'Stores', icon: '🏪', color: COLORS.orange600 },
  { key: 'coupons', label: 'Coupons', icon: '🎟️', color: COLORS.amber600 },
  { key: 'academics', label: 'Academics', icon: '🎓', color: COLORS.indigo600 },
  { key: 'services', label: 'Services', icon: '🔧', color: COLORS.green600 },
  { key: 'games', label: 'Games', icon: '🕹️', color: COLORS.purple600 },
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

// KV_ENVELOPE_CARDS v2: every Mailbox listing is the front of a business envelope -
// return address (logo + name), address window (what it is), a color block in the
// listing's header colors (facts + action), stamp + postmark. Full-width, one per row.
const KV_BANNER_PALETTE = [
  { bg: '#d97706', text: '#ffffff' }, { bg: '#3730a3', text: '#ffffff' }, { bg: '#166534', text: '#ffffff' },
  { bg: '#1c1917', text: '#fbbf24' }, { bg: '#9a3412', text: '#fde68a' },
];
function kvMix(hex: string, a: number): string {
  const h = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#d97706';
  const n = parseInt(h.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const m = (x: number) => Math.round(x + (255 - x) * a);
  return 'rgb(' + m(r) + ',' + m(g) + ',' + m(b) + ')';
}
function kvEnvColors(item: any, seed: string): { bg: string; text: string } {
  const c = (item && ((item.coords && item.coords.colors) || item.colors || (item.quad && item.quad.colors))) || null;
  if (c && /^#[0-9a-f]{6}$/i.test(String(c.bg)) && /^#[0-9a-f]{6}$/i.test(String(c.text || '#ffffff'))) return { bg: String(c.bg), text: String(c.text || '#ffffff') };
  let h = 0; const sd = String(seed || 'kv'); for (let i = 0; i < sd.length; i++) h = (h * 31 + sd.charCodeAt(i)) >>> 0;
  return KV_BANNER_PALETTE[h % KV_BANNER_PALETTE.length];
}
function kvAgo(t: number): string {
  if (!t) return '';
  const h = Math.max(0, Math.round((Date.now() - t) / 3600000));
  return h < 1 ? 'NOW' : h < 48 ? h + 'H AGO' : Math.round(h / 24) + 'D AGO';
}
function KvBizEnvelope({ name, cat, stamp, colors, verified, verifiedLabel, postedAt, lines, info, action, onPress, children }: any) {
  const paper = kvMix(colors.bg, 0.9), acc = kvMix(colors.bg, 0.45);
  const Wrap: any = onPress ? TouchableOpacity : View;
  return (
    <Wrap onPress={onPress} activeOpacity={0.85} style={{ marginBottom: rs.s(12), borderRadius: 8, overflow: 'hidden', backgroundColor: paper, borderWidth: 1, borderColor: kvMix(colors.bg, 0.7), shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3 }}>
      <View style={{ minHeight: 172, position: 'relative', overflow: 'hidden' }}>
        {/* color block (header colors), slanted like the reference envelope */}
        <View pointerEvents="none" style={{ position: 'absolute', right: -40, top: 62, width: '58%', height: 260, backgroundColor: colors.bg, transform: [{ rotate: '-7deg' }] }} />
        <View pointerEvents="none" style={{ position: 'absolute', right: -30, top: 40, width: '22%', height: 280, backgroundColor: acc, transform: [{ rotate: '12deg' }] }} />
        {/* return address */}
        <View style={{ position: 'absolute', left: 12, top: 12, right: 110, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
            <Text style={{ color: colors.text, fontWeight: '900', fontSize: 18 }}>{String(name || '?').trim().charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.bg, fontWeight: '900', fontSize: rs.font(15) }} numberOfLines={1}>{name}</Text>
            <Text style={{ color: acc, fontSize: 9, fontWeight: '800', letterSpacing: 2 }} numberOfLines={1}>{String(cat || '').toUpperCase()}</Text>
          </View>
        </View>
        {verified !== undefined ? (
          <View style={{ position: 'absolute', left: 12, top: 52, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 9, backgroundColor: verified ? '#dcfce7' : '#fef3c7' }}>
            <Text style={{ fontSize: 9, fontWeight: '900', color: verified ? '#15803d' : '#b45309' }}>{verified ? '✓ ' + (verifiedLabel || 'VERIFIED') : '⚠ UNVERIFIED'}</Text>
          </View>
        ) : null}
        {/* stamp + postmark */}
        <View pointerEvents="none" style={{ position: 'absolute', right: 10, top: 8, width: 30, height: 36, backgroundColor: '#fffaf0', borderWidth: 2, borderStyle: 'dashed', borderColor: '#7a5c34', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '4deg' }] }}>
          <Text style={{ fontSize: 15 }}>{stamp}</Text>
        </View>
        <View pointerEvents="none" style={{ position: 'absolute', right: 46, top: 10, width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: 'rgba(60,50,40,0.35)', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-12deg' }] }}>
          <Text style={{ color: 'rgba(60,50,40,0.5)', fontSize: 6, fontWeight: '800', textAlign: 'center' }}>{'KASVILLAGE\nPOST' + (postedAt ? '\n' + kvAgo(postedAt) : '')}</Text>
        </View>
        {/* address window */}
        <View style={{ position: 'absolute', left: 12, bottom: 12, width: '50%', paddingHorizontal: 9, paddingVertical: 7, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' }}>
          {(lines || []).filter(Boolean).slice(0, 3).map((l: any, i: number) => (
            <Text key={i} style={{ color: '#3a3530', fontSize: 11, fontWeight: i === 0 ? '800' : '400' }} numberOfLines={1}>{l}</Text>
          ))}
        </View>
        {/* facts + action on the color block */}
        <View style={{ position: 'absolute', right: 10, bottom: 10, width: '38%' }}>
          {(info || []).filter(Boolean).slice(0, 3).map((l: any, i: number) => (
            <Text key={i} style={{ color: colors.text, fontSize: 10.5, lineHeight: 17 }} numberOfLines={1}>{l}</Text>
          ))}
          {action ? (
            <TouchableOpacity onPress={action.onPress} disabled={!!action.disabled} style={{ marginTop: 4, borderRadius: 6, paddingVertical: 5, alignItems: 'center', backgroundColor: action.bg || colors.text, opacity: action.disabled ? 0.6 : 1 }}>
              <Text style={{ color: action.fg || colors.bg, fontWeight: '900', fontSize: 11 }}>{action.label}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {children ? <View style={{ paddingHorizontal: 12, paddingBottom: 10, paddingTop: 2, borderTopWidth: 1, borderTopColor: kvMix(colors.bg, 0.75), borderStyle: 'dashed' }}>{children}</View> : null}
    </Wrap>
  );
}

// KV_PARCEL_ENVELOPE: academics arrive as brown legal clasp envelopes (kraft shades vary per listing)
const KV_KRAFT = ['#c8a26b', '#b5874f', '#d9bf7a', '#a8865a', '#c9a27e'];
function KvParcelEnvelope({ title, lines, stampText, verified, postedAt, seed, action, onPress }: any) {
  let h = 0; const sd = String(seed || title || 'kv'); for (let i = 0; i < sd.length; i++) h = (h * 31 + sd.charCodeAt(i)) >>> 0;
  const kraft = KV_KRAFT[h % KV_KRAFT.length];
  const flap = 'rgba(0,0,0,0.10)', seam = 'rgba(70,45,15,0.25)';
  const Wrap: any = onPress ? TouchableOpacity : View;
  return (
    <Wrap onPress={onPress} activeOpacity={0.85} style={{ marginBottom: rs.s(12), borderRadius: 4, overflow: 'hidden', backgroundColor: kraft, borderWidth: 1, borderColor: seam, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3, minHeight: 176 }}>
      {/* clasp flap */}
      <View pointerEvents="none" style={{ position: 'absolute', left: '12%', right: '12%', top: 0, height: 34, backgroundColor: flap, borderBottomLeftRadius: 26, borderBottomRightRadius: 26, borderWidth: 1, borderTopWidth: 0, borderColor: seam }} />
      {/* brass clasp */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 24, alignSelf: 'center', left: 0, right: 0, alignItems: 'center' }}>
        <View style={{ width: 14, height: 14, backgroundColor: '#c9a227', borderWidth: 1, borderColor: '#8a6d12', transform: [{ rotate: '45deg' }] }} />
        <View style={{ flexDirection: 'row', marginTop: -2 }}>
          <View style={{ width: 9, height: 3, backgroundColor: '#b8921f', borderRadius: 2, transform: [{ rotate: '-25deg' }], marginRight: 2 }} />
          <View style={{ width: 9, height: 3, backgroundColor: '#b8921f', borderRadius: 2, transform: [{ rotate: '25deg' }] }} />
        </View>
      </View>
      {/* side seams */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 8, top: 40, bottom: 8, width: 1, backgroundColor: seam }} />
      <View pointerEvents="none" style={{ position: 'absolute', right: 8, top: 40, bottom: 8, width: 1, backgroundColor: seam }} />
      {/* white label */}
      <View style={{ marginTop: 50, marginHorizontal: 20, backgroundColor: '#fbf8f1', borderRadius: 3, padding: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)', transform: [{ rotate: '-1deg' }] }}>
        <Text style={{ fontWeight: '900', fontSize: rs.font(14), color: '#2f2418' }} numberOfLines={1}>{title}</Text>
        {(lines || []).filter(Boolean).slice(0, 3).map((l: any, i: number) => (
          <Text key={i} style={{ fontSize: 11, color: '#5b4a36', marginTop: 1 }} numberOfLines={1}>{l}</Text>
        ))}
        <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.08)', marginTop: 6 }} />
      </View>
      {/* ink stamp + verification */}
      <View pointerEvents="none" style={{ position: 'absolute', right: 16, top: 8, borderWidth: 2, borderColor: 'rgba(160,30,30,0.55)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, transform: [{ rotate: '8deg' }] }}>
        <Text style={{ color: 'rgba(160,30,30,0.7)', fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>{stampText || 'RESEARCH'}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, marginTop: 10, marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 9, backgroundColor: verified ? '#dcfce7' : '#fef3c7', marginRight: 8 }}>
            <Text style={{ fontSize: 9, fontWeight: '900', color: verified ? '#15803d' : '#b45309' }}>{verified ? '✓ DKIM VERIFIED' : '⚠ UNVERIFIED'}</Text>
          </View>
          {postedAt ? <Text style={{ fontSize: 9, color: 'rgba(60,40,20,0.6)', fontWeight: '800' }}>{'KASVILLAGE POST · ' + kvAgo(postedAt)}</Text> : null}
        </View>
        {action ? (
          <TouchableOpacity onPress={action.onPress} style={{ backgroundColor: '#5a3d1c', borderRadius: 6, paddingHorizontal: 14, paddingVertical: 5 }}>
            <Text style={{ color: '#f6e7c8', fontWeight: '900', fontSize: 11 }}>{action.label}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Wrap>
  );
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
function GameRegistryCard({ item, onInstall, installing, onTip, onRepost, reposting, repostProg, onTipKeeper }: any) {
  const R = require('react');
  const [xp, setXp] = R.useState(null as number | null);
  const [tr, setTr] = R.useState(null as any);
  R.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const tc = require('./townhall_client');
        const f = tc.getUserStats || tc.fetchUserStats || tc.getStats;
        if (!f || !item.o) return;
        const _C: any = (globalThis as any).__kvStatsCache || ((globalThis as any).__kvStatsCache = new Map());
        const _h = _C.get(item.o);
        let st: any;
        if (_h && Date.now() - _h.at < 600000) st = await _h.p;
        else { const _p = f(item.o).catch(() => null); _C.set(item.o, { at: Date.now(), p: _p }); st = await _p; }
        if (alive && st) {
          if (typeof st.xp === 'number') setXp(st.xp);
          // Bayesian trust, same formula as TownHall (main.rs):
          // p_complete = (1+S)/(2+S+D), confidence = min(samples/10, 1)
          const S = Number(st.successes || 0), D = Number(st.deadlocks || 0);
          const N = Number(st.total_samples || (S + D));
          setTr({ p: (1 + S) / (2 + S + D), c: Math.min(N / 10, 1) });
        }
      } catch {}
    })();
    return () => { alive = false; };
  }, [item.o]);
  const pledge = item.quad && typeof item.quad.pledge_kas === 'number' ? item.quad.pledge_kas : null;
  const [infoOpen, setInfoOpen] = R.useState(false); // KV_ENVELOPE_INFO_SHEET: details live in a sheet, the envelope stays clean
  return (
    <>
    <KvBizEnvelope name={item.name} cat={(item.category || 'Game') + ' \u00B7 on-chain'} stamp={'\u{1F3AE}'} colors={kvEnvColors(item, item.name || (item.quad && item.quad.head) || '')}
      postedAt={Math.max(Number(item.t || 0), Number(item.keptAt || 0))}
      lines={[(item.quad && item.quad.game) || item.name, 'verified by hash \u00B7 sandboxed', item.quad && item.quad.price ? item.quad.price + ' KAS / board' : 'first board free']}
      info={[pledge != null ? '\u26D3 ' + pledge + ' KAS pledged' : '', 'dev XP ' + (xp != null ? xp : '\u2026'), Array.isArray(item.keepers) && item.keepers.length ? '\u{1F465} kept by ' + item.keepers.length : '']}
      action={{ label: installing ? 'DOWNLOADING\u2026' : 'DOWNLOAD', onPress: () => onInstall(item), disabled: !!installing, ...(item.warn ? { bg: '#b91c1c', fg: '#fff' } : {}) }}
      onPress={() => setInfoOpen(true)} />
    <Modal visible={!!infoOpen} transparent animationType="slide" onRequestClose={() => setInfoOpen(false)}>
      <TouchableOpacity activeOpacity={1} onPress={() => setInfoOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ backgroundColor: '#fffaf0', borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '80%' }}>
          <View style={{ alignItems: 'center', paddingTop: 8 }}><View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#d6c8a8' }} /></View>
          <Text style={{ fontWeight: '900', fontSize: rs.font(16), textAlign: 'center', marginTop: 8, color: '#2f2418' }} numberOfLines={1}>{'\u{1F3AE} ' + (item.name || 'Game')}</Text>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}>
      {(() => { const tg = item.quad && Array.isArray(item.quad.tags) ? item.quad.tags.map(String).filter((t: string) => { try { const cf = require('./content_filter'); const sc = cf.scanTextStrict || cf.scanText; return sc(t).ok !== false; } catch { return true; } }).slice(0, 4) : []; return tg.length ? <Text style={{ color: '#a16207', fontSize: 10, marginTop: 1 }} numberOfLines={1}>{tg.map((t: string) => '#' + t).join(' ')}</Text> : null; })()}
      <Text style={{ color: '#7c3aed', fontSize: 11, marginTop: 2 }} numberOfLines={1}>
        {'⛓ ' + (pledge != null ? pledge + ' KAS pledged' : 'pledge n/a') + ' · dev XP ' + (xp != null ? xp : '…')}
      </Text>
      {tr ? (
        <Text style={{ color: tr.p >= 0.5 ? '#059669' : '#dc2626', fontSize: 11, marginTop: 2 }} numberOfLines={1}>
          {'✔ trust ' + Math.round(tr.p * 100) + '% · conf ' + Math.round(tr.c * 100) + '%' + (tr.p < 0.5 ? ' · ⚠ low' : '')}
        </Text>
      ) : null}
      {item.warn ? (
        <Text style={{ color: '#dc2626', fontSize: 10, fontWeight: '700', marginTop: 2 }}>⚠ DIFFERENT PUBLISHER than first seen</Text>
      ) : null}
      {/* KV_GAME_REPOST: keeper button + freshness */}
      {onRepost && item.quad ? (() => {
        const ageH = Math.max(0, Math.round((Date.now() - Math.max(Number(item.t || 0), Number(item.keptAt || 0))) / 3600000));
        const col = ageH < 18 ? '#059669' : ageH < 26 ? '#d97706' : '#dc2626';
        return (
          <View style={{ marginTop: 6 }}>
            <Text style={{ color: col, fontSize: 10, textAlign: 'center' }}>{'⏱ posted ~' + ageH + 'h ago' + (ageH < 18 ? ' · fresh' : ageH < 26 ? ' · renew soon' : ' · expiring - repost to keep it') + (item.keptBy ? ' · kept by a player' : '')}</Text>
            <TouchableOpacity onPress={() => onRepost(item)} disabled={!!reposting}
              style={{ marginTop: 4, borderColor: '#4f46e5', borderWidth: 1, borderRadius: 8, paddingVertical: 5, alignItems: 'center', opacity: reposting ? 0.6 : 1 }}>
              <Text style={{ color: '#4f46e5', fontWeight: '700', fontSize: 11 }}>{reposting ? 'REPOSTING ' + (repostProg || '') + '…' : 'Repost — keep this game alive'}</Text>
            </TouchableOpacity>
            {onTipKeeper && Array.isArray(item.keepers) && item.keepers.length ? (
              <View style={{ marginTop: 6 }}>
                <Text style={{ color: '#d97706', fontSize: 10, fontWeight: '700', textAlign: 'center' }}>{'Kept alive by ' + item.keepers.length + ' keeper' + (item.keepers.length === 1 ? '' : 's')}</Text>
                {item.keepers.slice(0, 3).map((ka: string, ki: number) => (
                  <TouchableOpacity key={ki} onPress={() => onTipKeeper(item, ka)} style={{ marginTop: 4, borderWidth: 1, borderColor: '#d97706', borderRadius: 8, paddingVertical: 5, alignItems: 'center' }}>
                    <Text style={{ color: '#d97706', fontSize: 10, fontWeight: '700' }}>{ka.slice(10, 26) + '… — Tip this keeper'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>
        );
      })() : null}
      {/* KV_GAME_CARD_FLAG */}
      {(() => { const _fi = item.quad ? ((globalThis as any).__kvFlagInfo || new Map()).get(String(item.quad.head)) : null; return _fi && _fi.n ? (
        <Text style={{ marginTop: 6, color: '#92400e', backgroundColor: '#fef3c7', fontSize: 10, fontWeight: '700', borderRadius: 6, padding: 4, textAlign: 'center' }}>{'\u2691 Flagged ' + _fi.n + '/3 \u2014 ' + _fi.reasons.join(', ')}</Text>
      ) : null; })()}
      {item.quad ? (
        <TouchableOpacity onPress={() => { const f = (globalThis as any).__kvRunFlag; if (f) f({ arweaveTx: String(item.quad.head), id: String(item.quad.head), ownerPubkey: item.o || '', name: item.name || '' }, 'game'); }}
          style={{ marginTop: 6, borderColor: '#d97706', borderWidth: 1, borderRadius: 8, paddingVertical: 5, alignItems: 'center' }}>
          <Text style={{ color: '#d97706', fontWeight: '700', fontSize: 11 }}>Flag (0.2 KAS)</Text>
        </TouchableOpacity>
      ) : null}
      {item.quad && item.quad.contact ? (
        <TouchableOpacity onPress={async () => { // KV_DEV_CONTACT
          try {
            const g: any = globalThis as any; let me = g.__kvMyPub || '';
            if (!me) { try { const ps = require('./proposal_share'); const pk = await ps._kvResolvePrivHex(); const { bytesToHex, hexToBytes } = require('@noble/hashes/utils'); const { secp256k1 } = require('@noble/curves/secp256k1'); me = bytesToHex(secp256k1.getPublicKey(hexToBytes(pk), true)); g.__kvMyPub = me; } catch {} }
            const _p = Number(item.quad.price || 0), _fa = Number(item.quad.frostAbove || 20);
            const msg = 'Hi! I play ' + (item.name || item.quad.game) + ' on KasVillage and would like the next board' + (_p ? ' (' + _p + ' KAS)' : '') + '. ' + (_p && _p >= _fa ? 'It is ' + _fa + '+ KAS, so let\'s use a FROST agreement. ' : (_p ? 'I will send to the address on the game card and give you the txid. ' : '')) + 'My pubkey: ' + me;
            try { await require('expo-clipboard').setStringAsync(msg); } catch { try { require('react-native').Clipboard.setStringAsync(msg); } catch {} }
            const c = String(item.quad.contact).trim(); const RN = require('react-native');
            let url = c;
            if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(c)) url = 'mailto:' + c + '?subject=' + encodeURIComponent('KasVillage board') + '&body=' + encodeURIComponent(msg);
            else if (/^@?[A-Za-z0-9_]{3,}$/.test(c)) url = 'https://t.me/' + c.replace(/^@/, '');
            else if (!/^https?:\/\//i.test(c)) url = 'https://' + c;
            RN.Alert.alert('Contact developer', 'Your message with your pubkey is copied - paste it in the chat.\n\nPay ONLY the address on this game card' + (item.quad.tip_addr ? ' (' + String(item.quad.tip_addr).slice(0, 20) + '\u2026)' : '') + '. Never pay an address sent to you in a DM.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open chat', onPress: () => { RN.Linking.openURL(url).catch(() => {}); } },
            ]);
          } catch {}
        }} style={{ marginTop: 6, borderColor: '#0891b2', borderWidth: 1, borderRadius: 8, paddingVertical: 5, alignItems: 'center' }}>
          <Text style={{ color: '#0891b2', fontWeight: '700', fontSize: 11 }}>Contact developer</Text>
        </TouchableOpacity>
      ) : null}
      {item.quad && item.quad.tip_addr && onTip ? (
        <TouchableOpacity onPress={() => onTip(item)}
          style={{ marginTop: 6, borderColor: '#7c3aed', borderWidth: 1, borderRadius: 8, paddingVertical: 5, alignItems: 'center' }}>
          <Text style={{ color: '#b9a6ff', fontWeight: '700', fontSize: 12 }}>{'💜 TIP THE DEV'}</Text>
        </TouchableOpacity>
      ) : null}
          </ScrollView>
          <TouchableOpacity onPress={() => setInfoOpen(false)} style={{ borderTopWidth: 1, borderTopColor: '#eadfc6', paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ fontWeight: '800', color: '#57534e' }}>Close</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
    </>
  );
}

function EmptyState({ section }: { section: Section }) {
  const messages: Record<Section, { icon: string; title: string; subtitle: string }> = {
    dapps: { icon: '🎮', title: 'No DApps Yet', subtitle: 'Verified DApps will appear here' },
    storefronts: { icon: '🏪', title: 'No Stores Yet', subtitle: 'Verified storefronts will appear here' },
    coupons: { icon: '🎟️', title: 'No Coupons', subtitle: 'Active coupons will appear here' },
    academics: { icon: '🎓', title: 'No Academics', subtitle: 'DKIM-verified researchers will appear here' },
    services: { icon: '🔧', title: 'No Services', subtitle: 'Verified service providers will appear here' },
    games: { icon: '🕹️', title: 'No Games Found', subtitle: 'Search a game name — on-chain games appear here' },
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
  
  const col = kvEnvColors(item, item.name || item.id);
  return (
    <KvBizEnvelope name={item.name} cat={'DApp · ' + (item.category || item.board)} stamp={'\u{1F9E9}'} colors={col}
      verified={!!(item.townhall && item.townhall.verified)} postedAt={item.createdAt}
      lines={[item.description || item.name, (item.templateVerified ? 'SDK ✓ · ' : '') + 'sandboxed', item.board + ' board']}
      info={[((item as any).publisherXp != null ? '⭐ ' + (item as any).publisherXp + ' XP' : ''), (item.xpCommitment ? '⛓ pledge in place' : ''), '\u{1F552} ' + (kvAgo(item.createdAt) || 'new').toLowerCase()]}
      action={{ label: 'OPEN', onPress }} onPress={onPress} />
  );
}

// KV_STORE_TIP_SHEET: same tip flow as the old card button, callable from the store sheet
function kvTipStore(item: any) {
  const tipAddr = item && item.coords && item.coords.tip_addr;
  if (!tipAddr) return;
  Alert.alert(
    'Tip ' + (item.storeName || 'this store'),
    'Send 1 KAS straight to the address this store declared in its announce?\n\n' + String(tipAddr)
      + '\n\nNever send KAS to an address typed inside a page \u2014 only through prompts like this.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send 1 KAS', onPress: async () => {
          try {
            const ps = require('./proposal_share');
            const SS = require('expo-secure-store');
            const sender = await SS.getItemAsync('kaspa_address');
            const priv = await ps._kvResolvePrivHex();
            if (!sender || !priv) throw new Error('wallet identity unavailable');
            const { sendKaspaViaRest } = require('./kaspa_rest_tx');
            const r: any = await sendKaspaViaRest({ senderAddress: sender, recipientAddress: String(tipAddr), amountSompi: 100000000n, privateKeyHex: priv, network: 'testnet-10' as any });
            if (r && r.success) Alert.alert('Tip sent \u2713'); else Alert.alert('Tip failed', String((r && r.error) || 'unknown'));
          } catch (e: any) { Alert.alert('Tip failed', String(e?.message || e)); }
        } },
    ],
  );
}

// Storefront Card
function StorefrontCard({ item, onPress, onRepost, reposting, onFlag, onTipKeeper }: { item: StorefrontEntry; onPress: () => void; onRepost?: (e: any) => void; reposting?: boolean; onFlag?: (e: any) => void; onTipKeeper?: (e: any, a: string) => void }) {
  const tipAddr = (item as any)?.coords?.tip_addr;
  const doTip = () => {
    if (!tipAddr) return;
    Alert.alert(
      'Tip ' + (item.storeName || 'this store'),
      'Send 1 KAS straight to the address this store declared in its announce?\n\n' + String(tipAddr)
        + '\n\nNever send KAS to an address typed inside a page \u2014 only through prompts like this.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send 1 KAS', onPress: async () => {
            try {
              const ps = require('./proposal_share');
              const SS = require('expo-secure-store');
              const sender = await SS.getItemAsync('kaspa_address');
              const priv = await ps._kvResolvePrivHex();
              if (!sender || !priv) throw new Error('wallet identity unavailable');
              const { sendKaspaViaRest } = require('./kaspa_rest_tx');
              const r: any = await sendKaspaViaRest({
                senderAddress: sender, recipientAddress: String(tipAddr),
                amountSompi: 100000000n, privateKeyHex: priv, network: 'testnet-10' as any,
              });
              if (r && r.success) Alert.alert('Tip sent \u2713');
              else Alert.alert('Tip failed', String((r && r.error) || 'unknown'));
            } catch (e: any) { Alert.alert('Tip failed', String(e?.message || e)); }
          } },
      ],
    );
  };
  const col = kvEnvColors(item, item.storeName || item.id);
  const pl = (item as any)?.coords?.pledge_kas;
  return (
    <KvBizEnvelope name={item.storeName} cat={item.category} stamp={'\u{1F3EA}'} colors={col}
      verified={!!(item.townhall && item.townhall.verified)} postedAt={item.createdAt}
      lines={[item.description || item.storeName, item.productCount ? item.productCount + ' items' : 'escrow · wallet-to-wallet', item.rating ? '★ ' + item.rating : '']}
      info={[pl != null ? '\u{1F4B0} Pledge ' + pl + ' KAS' : '\u{1F4B0} pledge-anchored', '\u{1F552} ' + (kvAgo(item.createdAt) || 'new').toLowerCase()]}
      action={{ label: 'OPEN STORE', onPress }} onPress={onPress} />
  );
}

// Coupon Card
function CouponCard({ item, onPress }: { item: CouponEntry; onPress: () => void }) {
  const isExpired = item.expiresAt < Date.now();
  const daysLeft = Math.ceil((item.expiresAt - Date.now()) / (1000 * 60 * 60 * 24));

  const col = kvEnvColors(item, item.storeName || item.title);
  return (
    <KvBizEnvelope name={item.title} cat={'Coupon · ' + (item.storeName || '')} stamp={'\u{1F39F}️'} colors={col}
      verified={!!(item.townhall && item.townhall.verified)} postedAt={item.createdAt}
      lines={[item.discount + (item.storeName ? ' at ' + item.storeName : ''), item.description, 'Use in a Neighbor Agreement']}
      info={[isExpired ? '↩ RETURN TO SENDER' : '\u{1F5D3} ' + daysLeft + ' days left', item.storeName ? '\u{1F3EA} ' + item.storeName : '']}
      action={isExpired ? undefined : { label: 'GET CODE', onPress }} onPress={onPress} />
  );
}

// Academic Card
function AcademicCard({ item, onPress }: { item: AcademicEntry; onPress: () => void }) {
  return (
    <KvParcelEnvelope title={item.title} seed={item.id || item.title}
      lines={[item.institution, item.field, item.description]}
      stampText={'RESEARCH \u00B7 ' + String(item.field || '').toUpperCase().slice(0, 14)}
      verified={!!item.dkimVerified} postedAt={item.createdAt}
      action={{ label: 'OPEN', onPress }} onPress={onPress} />
  );
}

// Service Card
function ServiceCard({ item, onPress }: { item: ServiceEntry; onPress: () => void }) {
  const col = kvEnvColors(item, item.title || item.id);
  return (
    <KvBizEnvelope name={item.title} cat={'Service · ' + item.category} stamp={'\u{1F6E0}️'} colors={col}
      verified={!!(item.townhall && item.townhall.verified)} postedAt={item.createdAt}
      lines={[item.description || item.title, '\u{1F4CD} ' + item.serviceArea, item.priceLabel || '']}
      info={[item.priceLabel ? '\u{1F4B0} ' + item.priceLabel : '', '\u{1F552} ' + (kvAgo(item.createdAt) || 'new').toLowerCase()]}
      action={{ label: 'OPEN', onPress }} onPress={onPress} />
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
  const [coldScan, setColdScan] = useState<{ onKey: (t: string) => void } | null>(null); // KV_COLD_SCAN
  const [gameView, setGameView] = useState<{ name: string; addr: string; hash: string; loading: boolean; game: KvGameDescriptor | null; error: string } | null>(null);
  const [query, setQuery] = useState('');
  // KV_VOLUME: debounced search + paged rendering
  const [dq, setDq] = useState('');
  useEffect(() => { const h = setTimeout(() => setDq(query), 200); return () => clearTimeout(h); }, [query]);
  const [shown, setShown] = useState(60);
  useEffect(() => { setShown(60); }, [dq, section]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Data
  const [dapps, setDapps] = useState<DAppEntry[]>([]);
  const [storefronts, setStorefronts] = useState<StorefrontEntry[]>([]);
  const [coupons, setCoupons] = useState<CouponEntry[]>([]);
  const [academics, setAcademics] = useState<AcademicEntry[]>([]);
  const [services, setServices] = useState<ServiceEntry[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [installingGame, setInstallingGame] = useState<string>('');
  
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
          // KV_HONEST_LANE dapps: unattested dapps show with their Unverified
          // badge instead of being hidden. Attest still sets badge + board;
          // installs stay hash-pinned; directory rules gate entry.
          setDapps(isRefresh ? result.items : [...dapps, ...result.items]);
          break;
        case 'storefronts':
          result = await fetchStorefronts(cursor);
          // KV_HONEST_LANE: stores are pledge-anchored (verified:false by design) -
          // the old verified filter blanked the whole lane. Directory rules
          // (sig, live pledge, delists, content scan) already gate entry.
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
        case 'games': {
          // 1) relay records  2) DEVICE QUAD CACHE  3) CLIENT CHAIN SCAN.
          // The phone is the light indexer: quads seen once are cached on the
          // device until storage is wiped, and when the relay's ephemeral
          // records come back empty (Flux recycle) the phone walks blocks
          // itself from its own rolling checkpoint. Read-only, hash-pinned
          // installs unchanged - the scan adds zero trust surface.
          const pp = require('./payload_publish');
          const kp = require('./kaspa_payload');
          const AS = require('@react-native-async-storage/async-storage').default;
          const regAddr = pp.registryAddress('game', 'testnet-10');
          const RELAY = 'https://kasvillage.app.runonflux.io';
          const h2s = (hx: string) => { let o = ''; for (let i = 0; i < hx.length; i += 2) o += String.fromCharCode(parseInt(hx.substr(i, 2), 16)); try { return decodeURIComponent(escape(o)); } catch { return o; } };
          const parseAnn = (input: any): any | null => {
            let r: any = (input && input.record) ? input.record : input;
            if (r && !r.k && typeof r.payload === 'string') { try { const raw = h2s(r.payload); r = JSON.parse(raw.startsWith('KVP1') ? raw.slice(4) : raw); } catch { return null; } }
            // KV_GAME_FLAGS: delists + flags must carry a valid signature (no forged owner/mod keys)
            if (r && r.k === 'undelist' && r.d && r.d.head) { try { if (typeof kp.verifyRecord === 'function' && !kp.verifyRecord(r)) return null; } catch { return null; } return { undelist: true, head: String(r.d.head), t: r.t || 0, o: r.o || '' }; } // KV_MOD_STICKY_GAMES
            if (r && (r.k === 'delist' || r.k === 'flag') && typeof kp.verifyRecord === 'function') { try { if (!kp.verifyRecord(r)) return null; } catch { return null; } }
            if (r && r.k === 'grant' && r.d && r.d.game && r.d.to) { try { if (typeof kp.verifyRecord === 'function' && !kp.verifyRecord(r)) return null; } catch { return null; } return { grant: true, rec: r }; } // KV_GRANTS_LANE
            if (r && r.k === 'flag' && r.d && r.d.head) return { flag: true, head: String(r.d.head), reason: String(r.d.reason || ''), t: r.t || 0, o: r.o || '' };
            if (r && r.k === 'delist' && r.d && r.d.head) return { delist: true, head: String(r.d.head), t: r.t || 0, o: r.o || '' }; // KV_DELIST_FILTER
            if (r && r.k === 'keep' && r.d && r.d.head) { try { if (typeof kp.verifyRecord === 'function' && !kp.verifyRecord(r)) return null; } catch { return null; } return { keep: true, head: String(r.d.head), d: r.d, t: r.t || 0, o: r.o || '' }; } // KV_GAME_KEEP
            if (!r || r.k !== 'registry' || !r.d) return null;
            try { if (typeof kp.verifyRecord === 'function' && !kp.verifyRecord(r)) return null; } catch { return null; } // KV_ANN_SIGNED
            let quad: any = null; try { quad = r.d.primaryLink ? JSON.parse(r.d.primaryLink) : null; } catch {}
            if (!quad || !quad.head || !quad.manifestAddress || !quad.manifestHash) return null;
            if (String(r.d.category || '').toLowerCase() !== 'game') return null;
            return { name: r.d.name || quad.game, category: r.d.category || 'Game', t: r.t || 0, o: r.o || '', quad, rec: r };
          };
          const byHead = new Map<string, any>();
          // KV_MOD_PUBKEY: moderation key - its delists apply to any head. Rotate to a dedicated key before mainnet.
          const KV_MOD_PUBKEY = '0357e12aa00272e78f0f10b95b877a7cdb7c39280ba6f2a3b3f39855b8cafaf1a4';
          const delistByHead = new Map<string, any>();
          const _kvDl = (h: string, o: string) => { let best: any = null; for (const v of delistByHead.values()) if (v.head === h && (v.o === o || v.o === KV_MOD_PUBKEY) && (!best || v.t > best.t)) best = v; return best; }; // KV_DELIST_PERSIGNER
          const flagsByHead = new Map<string, Map<string, string>>(); // head -> flagger -> reason
          const grantRecs: any[] = [];
          const keepByHead = new Map<string, any>(); // KV_GAME_KEEP
          const keepersByHead = new Map<string, string[]>(); // KV_GAME_KEEPER_TIP
          const modHeadsG = new Map<string, number>(); const modLiftG = new Map<string, number>();
          const take = (it: any) => {
            if (!it) return;
            if (it.keep) { try { const ka = String((it.d && it.d.tip_addr) || ''); const own = require('./canonical_agreement_steps').deriveAddress(String(it.o).slice(2), 'testnet-10'); if (ka && ka === own) { let L = keepersByHead.get(it.head); if (!L) { L = []; keepersByHead.set(it.head, L); } if (L.indexOf(ka) < 0) L.push(ka); } } catch {} }
            if (it.keep) { const pk = keepByHead.get(it.head); if (!pk || Number(it.d.daa_to || 0) > Number(pk.d.daa_to || 0)) keepByHead.set(it.head, it); return; }
            if (it.grant) { grantRecs.push(it.rec); return; }
            if (it.flag) { let m = flagsByHead.get(it.head); if (!m) { m = new Map(); flagsByHead.set(it.head, m); } if (!m.has(String(it.o)) && m.size >= 500) return; m.set(String(it.o), it.reason); return; } // KV_FLAG_CAP2: sanity cap; qualification checks are capped below
            if (it.undelist) { if (it.o === KV_MOD_PUBKEY) modLiftG.set(it.head, Math.max(modLiftG.get(it.head) || 0, it.t)); return; }
            if (it.delist && it.o === KV_MOD_PUBKEY) modHeadsG.set(it.head, Math.max(modHeadsG.get(it.head) || 0, it.t));
            if (it.delist) { const _k = it.head + '|' + it.o; const p = delistByHead.get(_k); if (!p || it.t > p.t) delistByHead.set(_k, it); return; }
            const prev = byHead.get(it.quad.head); if (!prev || (prev.o === it.o && it.t > prev.t)) byHead.set(it.quad.head, it); // KV_ANN_OWNER: first signer seen (device cache first) owns the card
          };
          // 2) device quad cache first - survives relay recycles until wipe
          try { const cRaw = await AS.getItem('kv_game_registry_cache'); (cRaw ? JSON.parse(cRaw) : []).forEach(take); } catch {}
          try { const dRaw = await AS.getItem('kv_game_delist_cache'); (dRaw ? JSON.parse(dRaw) : []).forEach(take); } catch {}
          try { console.log('[GamesLane] run: cachedQuads=' + byHead.size + ' cachedDelists=' + delistByHead.size); } catch {}
          // PAINT NOW. Those quads are already on this device, but the lane
          // waited for the relay AND up to 240 block-scan round trips before
          // its single setGames - minutes of blank cards over data we had all
          // along. Render what we know, then let the network refine it.
          // KV_PAINT_FILTER: the instant paint honors delists too
          if (byHead.size) { try { setGames(Array.from(byHead.values()).filter((it: any) => { const d = _kvDl(it.quad.head, it.o); if (!d || !(d.t > it.t)) return true; if (d.o === KV_MOD_PUBKEY) return false; return !!(d.o && it.o && d.o !== it.o); }) as any); } catch {} }
          // 1) relay records
          let rowsCount = 0;
          try {
            const fetchR = kp.fetchRecords || kp.fetchPayloadRecords || kp.fetchAddressRecords;
            const rows: any[] = (await fetchR(regAddr, 'testnet-10')) || [];
            rowsCount = rows.length;
            // KV_ANN_OWNER: fetchRecords is newest-first - feed CHAIN order (oldest first) so the
            // first signer really is the first publisher (block-scan below already walks forward)
            rows.slice().reverse().forEach((row: any) => take(parseAnn(row)));
          } catch {}
          // 3) client scan from the rolling checkpoint when records are empty
          try {
            const ckRaw = await AS.getItem('kv_reg_checkpoint');
            const ck = ckRaw ? JSON.parse(ckRaw) : null;
            const sink = await (await fetch(RELAY + '/api/kaspa/sink')).json();
            if (rowsCount === 0 && ck && ck.sink) {
              let low = ck.sink;
              for (let p = 0; p < 240; p++) {
                const page = await (await fetch(RELAY + '/api/kaspa/blocks?low_hash=' + low + '&txs=1')).json();
                for (const b of page.blocks || []) for (const tx of b.txs || []) {
                  try { const raw = h2s(tx.payload_hex); const rec = JSON.parse(raw.startsWith('KVP1') ? raw.slice(4) : raw); take(parseAnn(rec)); } catch {}
                }
                if (page.done || !page.next_low_hash) break;
                low = page.next_low_hash;
              }
            }
            if (sink && sink.sink) await AS.setItem('kv_reg_checkpoint', JSON.stringify({ sink: sink.sink, at: Date.now() }));
          } catch {}
          // KV_GRANTS: board grants for THIS wallet, only if signed by that game's publisher
          try {
            const _g: any = globalThis as any;
            if (!_g.__kvMyPub) { try { const ps = require('./proposal_share'); const pk = await ps._kvResolvePrivHex(); const { bytesToHex, hexToBytes } = require('@noble/hashes/utils'); const { secp256k1 } = require('@noble/curves/secp256k1'); if (pk) _g.__kvMyPub = bytesToHex(secp256k1.getPublicKey(hexToBytes(pk), true)); } catch {} }
            const me = _g.__kvMyPub;
            if (me && grantRecs.length) {
              const pubOf = new Map<string, string>(); const payTo = new Map<string, string>();
              for (const it of byHead.values()) { if (it.quad && it.quad.game) { pubOf.set(String(it.quad.game), String(it.o)); if (it.quad.tip_addr) payTo.set(String(it.quad.game), String(it.quad.tip_addr)); } }
              const all: any = _g.__kvGrantsAll || {};
              const proofs: any[] = JSON.parse((await AS.getItem('kv_purchase_proofs')) || '[]');
              let changed = false;
              for (const r of grantRecs) {
                const d = r.d || {}; const game = String(d.game || ''); const item = String(d.item || '');
                if (String(d.to) !== me || !game || !item || pubOf.get(game) !== String(r.o)) continue;
                const list = all[game] || (all[game] = []);
                if (list.indexOf(item) < 0) { list.push(item); changed = true; }
                const _old = proofs.find((p: any) => p.game === game && p.item === item && p.txid === String(d.txid || '')); // KV_GRANT_AGR
                if (!_old || !_old.verified) {
                  let v: any = { ok: false, amountKas: 0 };
                  try {
                    const _ref = String(d.txid || '');
                    if (/^AGR_/.test(_ref)) {
                      const sr = require('./stat_records'); const chain: any[] = await sr.loadChain();
                      const xo = (k: string) => String(k || '').replace(/^0[23]/, '').toLowerCase();
                      const rec = (chain || []).find((c: any) => c.agrId === _ref);
                      if (rec && rec.outcome === 'complete' && xo(rec.cpPubkey) === xo(String(r.o))) v = { ok: true, amountKas: Number(rec.buyerAmountSompi || 0) / 1e8, agr: true, releaseTxId: (rec.anchor && rec.anchor.releaseTxId) || '' };
                    } else v = await kp.kvVerifyPayment(_ref, payTo.get(game) || '', 'testnet-10');
                  } catch {}
                  if (_old) { if (!v.ok) continue; proofs.splice(proofs.indexOf(_old), 1); }
                  proofs.push({ game, item, txid: String(d.txid || ''), dev: String(r.o), verified: !!v.ok, amountKas: v.amountKas || 0, agr: !!v.agr, releaseTxId: v.releaseTxId || '', grant: r, savedAt: Date.now() });
                  changed = true;
                  console.log('[Grants] ' + game + '/' + item + ' granted' + (v.ok ? ' - payment VERIFIED ' + v.amountKas + ' KAS' : ' - payment not verified'));
                }
              }
              if (changed) { _g.__kvGrantsAll = all; await AS.setItem('kv_grants', JSON.stringify(all)); await AS.setItem('kv_purchase_proofs', JSON.stringify(proofs)); }
            }
          } catch (e) { console.warn('[Grants]', e); }
          // KV_RECEIVED_BOARDS: private boards sent to THIS wallet's own address
          try {
            const _g: any = globalThis as any; const me = _g.__kvMyPub;
            const _SS = require('expo-secure-store');
            const myAddr = (await _SS.getItemAsync('kv_kaspa_address')) || (await _SS.getItemAsync('kaspa_address'));
            const recv: any[] = JSON.parse((await AS.getItem('kv_received_boards')) || '[]');
            if (me && myAddr) {
              const fetchR2 = kp.fetchRecords || kp.fetchPayloadRecords || kp.fetchAddressRecords;
              const mine: any[] = (await fetchR2(myAddr, 'testnet-10', 50, 2)) || [];
              let ch = false;
              for (const row of mine) {
                const pa: any = parseAnn(row); if (!pa || !pa.grant) continue;
                const r: any = pa.rec; const d: any = r.d || {};
                if (String(d.to) !== me || !d.quad || !d.quad.head || !d.quad.manifestAddress) continue;
                let impostor = false;
                for (const it of byHead.values()) if (it.quad && String(it.quad.game) === String(d.game) && String(it.o) !== String(r.o)) impostor = true;
                if (impostor) { console.warn('[Received] ignored - ' + d.game + ' is published by a different key'); continue; }
                const item = String(d.item || d.game);
                if (recv.some((x: any) => x.quad.head === d.quad.head && x.item === item)) continue;
                // KV_RECEIVED_ACCEPT: known sender = publishes a public game here, or completed a FROST agreement with you
                let known = false;
                for (const it of byHead.values()) if (it.quad && !it.received && String(it.o) === String(r.o)) known = true;
                if (!known) { try { const _sr = require('./stat_records'); const _ch: any[] = await _sr.loadChain(); const _xo = (k: string) => String(k || '').replace(/^0[23]/, '').toLowerCase(); known = (_ch || []).some((c: any) => c.outcome === 'complete' && _xo(c.cpPubkey) === _xo(String(r.o))); } catch {} }
                recv.push({ game: String(d.game), item, quad: d.quad, dev: String(r.o), proof: String(d.txid || ''), t: r.t || Date.now(), status: known ? 'accepted' : 'pending' });
                if (known) { const all: any = _g.__kvGrantsAll || (_g.__kvGrantsAll = {}); const l = all[d.game] || (all[d.game] = []); if (l.indexOf(item) < 0) l.push(item); }
                ch = true;
                console.log('[Received] board ' + d.game + '/' + item + ' from ' + String(r.o).slice(0, 12));
              }
              if (ch) { await AS.setItem('kv_received_boards', JSON.stringify(recv)); await AS.setItem('kv_grants', JSON.stringify(_g.__kvGrantsAll || {})); }
            }
            const pend: any = recv.find((x: any) => x.status === 'pending');
            if (pend && _g.__kvPendingShown !== pend.quad.head) {
              _g.__kvPendingShown = pend.quad.head;
              const _save = async () => { try { await AS.setItem('kv_received_boards', JSON.stringify(recv)); } catch {} };
              setTimeout(() => require('./kv_prompt').kvChoose('Board received', String(pend.dev).slice(0, 12) + '\u2026 sent you "' + pend.item + '" for ' + pend.game + '. You have not traded with this sender. Show it?', [
                { text: 'Accept', onPress: async () => { pend.status = 'accepted'; const all: any = _g.__kvGrantsAll || (_g.__kvGrantsAll = {}); const l = all[pend.game] || (all[pend.game] = []); if (l.indexOf(pend.item) < 0) l.push(pend.item); await _save(); try { await AS.setItem('kv_grants', JSON.stringify(all)); } catch {} _g.__kvPendingShown = null; Alert.alert('Accepted', 'Pull to refresh Games to see it.'); } },
                { text: 'Ignore', style: 'cancel', onPress: async () => { pend.status = 'ignored'; await _save(); _g.__kvPendingShown = null; } },
                { text: 'Report', style: 'destructive', onPress: async () => { pend.status = 'ignored'; await _save(); _g.__kvPendingShown = null; const f = _g.__kvRunFlag; if (f) f({ arweaveTx: String(pend.quad.head), id: String(pend.quad.head), ownerPubkey: pend.dev, name: pend.game + ' ' + pend.item }, 'game'); } },
              ]), 800);
            }
            for (const rb of recv) { if (rb.status === 'pending' || rb.status === 'ignored') continue; const h = String(rb.quad.head); if (!byHead.has(h)) byHead.set(h, { name: rb.game + ' \u00b7 ' + rb.item + ' (received)', category: 'Game', t: rb.t, o: rb.dev, quad: rb.quad, received: true }); }
          } catch (e) { console.warn('[Received]', e); }
          // KV_GAME_FLAGS tally: 3 qualified flaggers (pledge or settled trade, not the owner) = hidden
          try {
            const _g: any = globalThis as any; if (!_g.__kvFlagInfo) _g.__kvFlagInfo = new Map();
            // KV_FLAG_BUDGET: overall time budget for the network checks; kvFlaggerQualifies caches per flagger for the session
            const _flagDeadline = Date.now() + 20000;
            for (const [h, m] of flagsByHead) {
              const it = byHead.get(h); if (!it) continue;
              m.delete(String(it.o));
              const ok: string[] = [];
              let _checks = 0; for (const [fk, why] of Array.from(m)) { if (ok.length >= 3) break; const _cached = !!(_g.__kvQualCache && _g.__kvQualCache.has(fk)); if (!_cached) { if (_checks >= 40 || Date.now() > _flagDeadline) continue; _checks++; } try { if (await kp.kvFlaggerQualifies(fk, 'testnet-10')) ok.push(why); } catch {} } // KV_FLAG_CAP2: cap network checks, stop at 3 qualified
              const info = { n: ok.length, reasons: Array.from(new Set(ok)), owner: String(it.o), name: String(it.name || '') };
              if (ok.length >= 3) { _g.__kvFlagInfo.set(h, { ...info, hidden: true }); byHead.delete(h); console.warn('[GamesLane] hidden by', ok.length, 'flags:', h.slice(0, 8), info.reasons.join(',')); }
              else if (ok.length) { _g.__kvFlagInfo.set(h, info); console.log('[GamesLane] flags', ok.length + '/3', h.slice(0, 8)); }
              else _g.__kvFlagInfo.delete(h);
            }
          } catch (e) { console.warn('[GamesLane] flag tally error', e); }
          // KV_MOD_STICKY games: cold-key delists stick to the head; only a cold-key undelist lifts
          try {
            const _ga: any = JSON.parse((await AS.getItem('kv_game_mod_actions')) || '{}');
            for (const [h, t] of modHeadsG) if (!_ga[h] || t > _ga[h].t) _ga[h] = { t, del: true };
            for (const [h, t] of modLiftG) if (!_ga[h] || t > _ga[h].t) _ga[h] = { t, del: false };
            await AS.setItem('kv_game_mod_actions', JSON.stringify(_ga));
            for (const h of Object.keys(_ga)) if (_ga[h].del && byHead.has(h)) { byHead.delete(h); console.log('[GamesLane] mod-removed (sticky) ' + h.slice(0, 8)); }
          } catch {}
          // KV_GAME_KEEP: a keeper's fresh walk coordinates replace stale ones (hash-pinned, so coords can only help or fail)
          for (const [kh, kr] of keepByHead) { const it0 = byHead.get(kh); if (!it0) continue; const kd = kr.d || {}; if (kd.manifestHash && kd.manifestHash !== it0.quad.manifestHash) continue; if (/^[0-9a-f]{64}$/.test(String(kd.anchor_hash || '')) && Number(kd.daa_to || 0) > Number(it0.quad.daa_to || 0)) byHead.set(kh, { ...it0, quad: { ...it0.quad, anchor_hash: kd.anchor_hash, daa_from: kd.daa_from, daa_to: kd.daa_to }, keptBy: kr.o, keptAt: kr.t }); }
          for (const [kh2, L2] of keepersByHead) { const it2 = byHead.get(kh2); if (it2) byHead.set(kh2, { ...it2, keepers: L2 }); }
          const items = Array.from(byHead.values()).filter((it: any) => {
            const d = _kvDl(it.quad.head, it.o);
            if (!d) return true;
            if (!(d.t > it.t)) { try { console.log('[GamesLane] delist OUTRANKED for ' + it.quad.head.slice(0, 8) + ' delist.t=' + d.t + ' announce.t=' + it.t); } catch {} return true; }
            const keep = d.o === KV_MOD_PUBKEY ? false : !!(d.o && it.o && d.o !== it.o); // mod delist hides any head
            try { console.log('[GamesLane] ' + (keep ? 'KEPT(signer mismatch) ' : 'HIDDEN ') + it.quad.head.slice(0, 8) + ' d.o=' + String(d.o).slice(0, 10) + ' it.o=' + String(it.o).slice(0, 10)); } catch {}
            return keep;
          }).sort((a, b) => b.t - a.t);
          try { console.log('[GamesLane] done: shown=' + items.length + ' delists=' + delistByHead.size + ' delistHeads=' + Array.from(delistByHead.keys()).map((h: string) => h.slice(0, 8)).join(',') + ' | allHeads=' + Array.from(byHead.keys()).map((h: string) => h.slice(0, 8)).join(',') + ' | shownHeads=' + items.map((i: any) => String(i.quad.head).slice(0, 8) + '(t=' + i.t + ',o=' + String(i.o).slice(0, 8) + ')').join(',')); } catch {}
          try { if (delistByHead.size) await AS.setItem('kv_game_delist_cache', JSON.stringify(Array.from(delistByHead.values()))); } catch {}
          // TOFU publisher pinning: the FIRST signer seen for a name is
          // pinned on-device; a later announce under the same name from a
          // different key gets a loud warning on its card.
          try {
            const tofuRaw = await AS.getItem('kv_pub_tofu');
            const tofu = tofuRaw ? JSON.parse(tofuRaw) : {};
            let dirty = false;
            for (const it of items) {
              const nm = String(it.name || '').toLowerCase();
              if (!nm || !it.o) continue;
              if (tofu[nm] && tofu[nm] !== it.o) (it as any).warn = true;
              else if (!tofu[nm]) { tofu[nm] = it.o; dirty = true; }
            }
            if (dirty) await AS.setItem('kv_pub_tofu', JSON.stringify(tofu));
          } catch {}
          try { await AS.setItem('kv_game_registry_cache', JSON.stringify(items.slice(0, 200))); } catch {}
          result = { items, nextCursor: undefined, hasMore: false } as any;
          setGames(items);
          break;
        }
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
      case 'games': return games;
    }
  };

  const [tipT, setTipT] = useState<any>(null);
  const [tipAmt, setTipAmt] = useState('');
  const [tipBusy, setTipBusy] = useState(false);
  // KV_REPOST_UI: keeper actions - replay a listing's signed record, tip a keeper
  const [repostBusy, setRepostBusy] = useState(false);
  const runRepost = async (entry: any, kind: string) => {
    const rec = entry && entry.record && ((entry.record as any)._parent || entry.record); // KV_BATCH_REPOST: replay the original signed batch
    if (!rec) { Alert.alert('Repost', 'Original record not loaded - refresh the lane and try again.'); return; }
    if (repostBusy) return;
    setRepostBusy(true);
    try {
      const ps = require('./proposal_share');
      const SS = require('expo-secure-store');
      const sender = (await SS.getItemAsync('kv_kaspa_address')) || (await SS.getItemAsync('kaspa_address'));
      const priv = await ps._kvResolvePrivHex();
      if (!sender || !priv) throw new Error('wallet identity unavailable');
      const { bytesToHex, hexToBytes } = require('@noble/hashes/utils');
      const { secp256k1 } = require('@noble/curves/secp256k1');
      const pub = bytesToHex(secp256k1.getPublicKey(hexToBytes(priv), true));
      const { repostRecord, repostStrip } = require('./payload_publish');
      const _keeper = { privateKeyHex: priv, pubkeyHex: pub, address: sender, network: 'testnet-10' as any };
      // KV_REPOST_V3: replay the CONTENT first (store record + cfg chunks) so
      // the body survives pruning, not just the announce. fetchRecords falls
      // back to the device cache, so this also revives content the chain has
      // already pruned - the phone puts it back.
      let _stripN = 0;
      try {
        const { fetchRecords } = require('./kaspa_payload');
        const _addr = String(entry.arweaveTx || entry.id || '');
        const _wrapped: any[] = _addr ? await fetchRecords(_addr, 'testnet-10', 100) : [];
        const _seen: any = {};
        const _strip: any[] = [];
        for (const _w of _wrapped) {
          const _r0: any = _w && _w.record;
          if (!_r0 || !_r0.sig) continue;
          if (['store', 'cfg', 'dapp', 'page', 'game'].indexOf(String(_r0.k)) < 0) continue;
          if (entry.ownerPubkey && String(_r0.o) !== String(entry.ownerPubkey)) continue;
          const _id0 = String(_r0.k) + '|' + String(_r0.t) + '|' + String((_r0.d && _r0.d.seq !== undefined ? _r0.d.seq : '')) + '|' + String((_r0.d && _r0.d.h) || '');
          if (_seen[_id0]) continue;
          _seen[_id0] = 1;
          _strip.push(_r0);
        }
        if (_strip.length) { const _txs: string[] = await repostStrip(_keeper, _addr, _strip); _stripN = _txs.length; }
        console.log('[Repost] strip:', _strip.length, 'record(s), replayed:', _stripN);
      } catch (_e) { console.warn('[Repost] strip replay failed (announce continues):', _e); }
      const r: any = await repostRecord(_keeper, rec, kind);
      if (r && r.success === false) throw new Error(String(r.error || 'send failed'));
      Alert.alert('Reposted \u2713', 'Re-announced to the chain' + (_stripN ? ' + ' + _stripN + ' content record(s) replayed' : '') + ' (' + ((1 + _stripN) * 0.2).toFixed(1) + ' KAS total). Your wallet is now its keeper - tips come to you.');
    } catch (e: any) { Alert.alert('Repost failed', String((e && e.message) || e)); }
    setRepostBusy(false);
  };
  // KV_KEEPER_TIP: dedicated popup (own Modal, renders above the store view)
  const [keeperTip, setKeeperTip] = useState<any>(null);
  const [keeperAmt, setKeeperAmt] = useState('');
  const [keeperBusy, setKeeperBusy] = useState(false);
  // KV_QA_DM: ask-the-researcher via their chosen DM channel
  const [qaText, setQaText] = useState('');
  const [qaBusy, setQaBusy] = useState(false);
  const askQuestion = async (entry: any, cfg: any) => {
    const q = String(qaText || '').trim();
    if (q.length < 5) { Alert.alert('Question', 'Type your question first.'); return; }
    if (qaBusy) return;
    setQaBusy(true);
    try {
      const AS = require('@react-native-async-storage/async-storage').default;
      const { sha256 } = require('@noble/hashes/sha256');
      const { bytesToHex, utf8ToBytes } = require('@noble/hashes/utils');
      const absKey = String(entry.arweaveTx || entry.id || '');
      const chainKey = 'kv_qa_chain_' + absKey.slice(-24);
      const chain: any[] = JSON.parse((await AS.getItem(chainKey)) || '[]');
      const n = chain.length + 1;
      const price = Number((cfg && cfg.questionPrice) || 0);
      const title = String((cfg && cfg.title) || entry.title || 'your abstract');
      let payTx = '';
      if (n >= 2 && price > 0) {
        const go = await new Promise<boolean>((res) => Alert.alert('Follow-up question #' + n, 'Your first question was free. This researcher charges ' + price + ' KAS per follow-up, paid straight to their wallet.', [
          { text: 'Cancel', style: 'cancel', onPress: () => res(false) },
          { text: 'Pay ' + price + ' KAS', onPress: () => res(true) },
        ]));
        if (!go) { setQaBusy(false); return; }
        const ps = require('./proposal_share');
        const SS = require('expo-secure-store');
        const sender = (await SS.getItemAsync('kv_kaspa_address')) || (await SS.getItemAsync('kaspa_address'));
        const priv = await ps._kvResolvePrivHex();
        if (!sender || !priv) throw new Error('wallet identity unavailable');
        const { deriveAddress } = require('./canonical_agreement_steps');
        const _o = String(entry.ownerPubkey || '');
        const authorAddr = deriveAddress(_o.length === 66 ? _o.slice(2) : _o, 'testnet-10' as any);
        const { sendKaspaViaRest } = require('./kaspa_rest_tx');
        const r: any = await sendKaspaViaRest({ senderAddress: sender, recipientAddress: authorAddr, amountSompi: BigInt(Math.round(price * 1e8)), privateKeyHex: priv, network: 'testnet-10' as any });
        if (r && r.success === false) throw new Error(String(r.error || 'payment failed'));
        payTx = String((r && (r.txid || r.transactionId || r.txId)) || '');
        console.log('[QA] paid', price, 'KAS ->', authorAddr.slice(0, 24), payTx.slice(0, 16));
      }
      const prev = chain.length ? String(chain[chain.length - 1].h) : '0'.repeat(64);
      const h = bytesToHex(sha256(utf8ToBytes(prev + '|' + absKey + '|' + q + '|' + Date.now())));
      chain.push({ h, prev, n, t: Date.now(), paid: payTx || undefined });
      await AS.setItem(chainKey, JSON.stringify(chain));
      const msg = n === 1
        ? 'Hi! I saw your abstract "' + title + '" on KasVillage and have a question (my first - free):\n\n' + q + '\n\nRef: ' + h.slice(0, 16)
        : 'Hi! A follow-up on your abstract "' + title + '" - question #' + n + (payTx ? ', paid ' + price + ' KAS (tx ' + payTx + ')' : '') + ':\n\n' + q + '\n\nChain ref: ' + h.slice(0, 16) + ' (prev ' + prev.slice(0, 16) + ')';
      const rawHandle = String((cfg && cfg.qaHandle) || '').trim();
      const ch = String((cfg && cfg.qaChannel) || '').toLowerCase();
      const hd = rawHandle.replace(/^@/, '');
      let url = '';
      if (/^https?:\/\//i.test(rawHandle)) url = rawHandle;
      else if (ch.indexOf('mail') >= 0 || (rawHandle.indexOf('@') > 0 && rawHandle.indexOf('.') > 0)) url = 'mailto:' + rawHandle + '?subject=' + encodeURIComponent('Question about "' + title + '"') + '&body=' + encodeURIComponent(msg);
      else if (ch.indexOf('insta') >= 0) url = 'https://ig.me/m/' + hd;
      else if (ch.indexOf('telegram') >= 0) url = 'https://t.me/' + hd;
      else if (ch.indexOf('whatsapp') >= 0) url = 'https://wa.me/' + hd.replace(/\D/g, '') + '?text=' + encodeURIComponent(msg);
      else if (ch.indexOf('twitter') >= 0 || ch === 'x' || ch.indexOf('x ') === 0) url = 'https://x.com/' + hd;
      if (!url && !rawHandle && cfg && cfg.repositoryUrl) url = String(cfg.repositoryUrl); // KV_QA_ALWAYS: no DM listed -> repo page
      try { Clipboard.setStringAsync(msg); } catch {}
      setQaText('');
      console.log('[QA] question #' + n, 'ref', h.slice(0, 16), '->', url || '(copy only)');
      Alert.alert(n === 1 ? 'Question ready (free)' : 'Follow-up #' + n + ' ready', 'Message copied. ' + (url ? 'Opening ' + (cfg.qaChannel || 'their channel') + ' - paste it into the DM.' : (rawHandle ? 'Paste it into ' + (cfg.qaChannel || 'their channel') + ': ' + rawHandle : 'This researcher has not listed a DM channel yet - keep the copied message for when they do.')), [
        { text: 'OK', onPress: () => { if (url) { try { Linking.openURL(url); } catch {} } } },
      ]);
    } catch (e: any) { Alert.alert('Question failed', String((e && e.message) || e)); }
    setQaBusy(false);
  };
  // KV_DELIST_OWNER: publisher-key soft delist from the modal
  // KV_FLAGS_UI: community flag (+ mod clear)
  const runFlag = async (entry: any, kind: string) => {
    try {
      const ps = require('./proposal_share');
      const SS = require('expo-secure-store');
      const sender = (await SS.getItemAsync('kv_kaspa_address')) || (await SS.getItemAsync('kaspa_address'));
      const priv = await ps._kvResolvePrivHex();
      if (!sender || !priv) throw new Error('wallet identity unavailable');
      const { bytesToHex, hexToBytes } = require('@noble/hashes/utils');
      const { secp256k1 } = require('@noble/curves/secp256k1');
      const pub = bytesToHex(secp256k1.getPublicKey(hexToBytes(priv), true));
      const head = String(entry.arweaveTx || entry.id);
      if (entry.ownerPubkey && String(entry.ownerPubkey) === pub) { Alert.alert('Your listing', 'You cannot flag your own listing.'); return; }
      const keys = { privateKeyHex: priv, pubkeyHex: pub, address: sender, network: 'testnet-10' as any };
      const send = async (reason: string) => {
        try {
          const { flagListing } = require('./payload_publish');
          const r: any = await flagListing(keys, head, reason, kind);
          if (r && r.success === false) throw new Error(String(r.error || 'send failed'));
          Alert.alert('Flag posted', 'Your flag counts if you have a listing of your own. 3 flags from different publishers hide this listing in every wallet.');
        } catch (e: any) { Alert.alert('Flag failed', String((e && e.message) || e)); }
      };
      const btns: any[] = [
        { text: 'Scam / fraud', onPress: () => send('fraud') },
        { text: 'Prohibited / illegal', onPress: () => send('prohibited') },
        { text: 'Spam / fake', onPress: () => send('spam') },
        { text: 'Stolen / copied', onPress: () => send('stolen') },
      ];
      // KV_NO_FLAG_CLEAR: no clear option - 3 flags delist automatically, nobody arbitrates
      if (false) btns.push({ text: 'Mod: clear all flags', onPress: async () => {
        try {
          const { clearFlags } = require('./payload_publish');
          const r: any = await clearFlags(keys, head, kind);
          if (r && r.success === false) throw new Error(String(r.error || 'send failed'));
          Alert.alert('Flags cleared', 'Older flags on this listing no longer count.');
        } catch (e: any) { Alert.alert('Clear failed', String((e && e.message) || e)); }
      } });
      btns.push({ text: 'Cancel', style: 'cancel' });
      require('./kv_prompt').kvChoose('Flag this listing? (0.2 KAS)', 'Flags are public, signed by your key, and counted by every wallet.', btns);
    } catch (e: any) { Alert.alert('Flag failed', String((e && e.message) || e)); }
  };
  (globalThis as any).__kvRunFlag = runFlag; // KV_GAME_CARD_FLAG: game cards (separate component) reach runFlag
  const runDelistOwner = async (entry: any, kind: string) => {
    try {
      const ps = require('./proposal_share');
      const SS = require('expo-secure-store');
      const sender = (await SS.getItemAsync('kv_kaspa_address')) || (await SS.getItemAsync('kaspa_address'));
      const priv = await ps._kvResolvePrivHex();
      if (!sender || !priv) throw new Error('wallet identity unavailable');
      const { bytesToHex, hexToBytes } = require('@noble/hashes/utils');
      const { secp256k1 } = require('@noble/curves/secp256k1');
      const pub = bytesToHex(secp256k1.getPublicKey(hexToBytes(priv), true));
      // KV_MOD_REASON: moderator path (mod key, not the owner) - reason + evidence hash on chain
      const _KV_MOD = '0357e12aa00272e78f0f10b95b877a7cdb7c39280ba6f2a3b3f39855b8cafaf1a4';
      const _modFlow = (_mPriv: string, _mPub: string) => { // KV_COLD_MOD
        const _head = String(entry.arweaveTx || entry.id);
        const _fin = (reason: string, note: string) => { // KV_MOD_CONFIRM: type DELIST before the cold key signs
          setTimeout(() => require('./kv_prompt').kvPrompt('Confirm moderator delist',
            'Store: ' + String(entry.title || entry.name || '(untitled)') + '\nAddress: ' + _head + '\nOwner: ' + String(entry.ownerPubkey || '?').slice(0, 20) + '\u2026\nReason: ' + reason + '\n\nFINAL for this address - it cannot be undone. Type DELIST to confirm.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Confirm', style: 'destructive', onPress: (t: string) => { if (String(t || '').trim().toUpperCase() !== 'DELIST') { Alert.alert('Not confirmed', 'Nothing was posted.'); return; } setTimeout(() => _finGo(reason, note), 400); } },
          ], 'plain-text'), 450);
        };
        const _finGo = async (reason: string, note: string) => {
          try {
            const { utf8ToBytes } = require('@noble/hashes/utils');
            let _sha: any; try { _sha = require('@noble/hashes/sha256').sha256; } catch (_) { _sha = require('@noble/hashes/sha2').sha256; }
            const pre = JSON.stringify({ head: _head, reason, note: note || '', title: String(entry.title || entry.name || ''), owner: String(entry.ownerPubkey || ''), t: Date.now() });
            const evidenceHash = bytesToHex(_sha(utf8ToBytes(pre)));
            const { delistFromRegistry } = require('./payload_publish');
            const r: any = await delistFromRegistry({ privateKeyHex: priv, pubkeyHex: pub, address: sender, network: 'testnet-10' as any }, _head, kind, { reason, evidenceHash, mod: 1, owner: String(entry.ownerPubkey || '') }, { privateKeyHex: _mPriv, pubkeyHex: _mPub });
            if (r && r.success === false) throw new Error(String(r.error || 'send failed'));
            try {
              const AS = require('@react-native-async-storage/async-storage').default;
              const old = JSON.parse((await AS.getItem('kv_mod_log')) || '[]');
              old.push({ pre, evidenceHash, kind, txid: (r && (r.txid || r.transactionId)) || null });
              await AS.setItem('kv_mod_log', JSON.stringify(old));
            } catch (_) {}
            console.log('[ModDelist]', _head.slice(0, 24), reason, evidenceHash, 'preimage:', pre);
            setStoreView(null);
            Alert.alert('Moderator delist posted', 'Reason: ' + reason + '\nEvidence hash: ' + evidenceHash.slice(0, 16) + '...\nPreimage saved on this phone (kv_mod_log). The owner can see the reason on chain.');
          } catch (e: any) { Alert.alert('Mod delist failed', String((e && e.message) || e)); }
        };
        const _note = (reason: string) => setTimeout(() => {
          const RN = require('react-native');
          if (true) {
            require('./kv_prompt').kvPrompt(reason === 'legal' ? 'Legal request reference (private)' : 'Evidence note (private)', reason === 'legal' ? 'Agency + case or subpoena number. Only its hash goes on chain; keep the original document.' : 'Describe the evidence or file reference. Only its hash goes on chain.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delist', style: 'destructive', onPress: (t: string) => _fin(reason, t || '') },
            ], 'plain-text');
          } else { _fin(reason, ''); }
        }, 350);
        require('./kv_prompt').kvChoose('Moderator delist', 'Not your listing - acting as moderator. Pick a reason; it is recorded on chain with an evidence hash (~1 KAS).', [
          { text: 'Prohibited category', onPress: () => _note('prohibited') },
          { text: 'Scam / fraud', onPress: () => _note('fraud') },
          { text: 'Illegal content', onPress: () => _note('illegal') },
          { text: 'Legal request', onPress: () => _note('legal') }, // KV_MOD_LEGAL
          { text: 'Cancel', style: 'cancel' },
        ]);
      };
      if (entry.ownerPubkey && String(entry.ownerPubkey) !== pub && pub === _KV_MOD) { _modFlow(priv, pub); return; }
      if (entry.ownerPubkey && String(entry.ownerPubkey) !== pub) {
        // cold-key moderation: key pasted at use, verified against _KV_MOD, never stored
        const RN = require('react-native');
        const _useKey = (t: string) => {
          try {
            const k = String(t || '').replace(/[^0-9a-fA-F]/g, '').toLowerCase();
            const mp = bytesToHex(secp256k1.getPublicKey(hexToBytes(k), true));
            if (mp !== _KV_MOD) { Alert.alert('Wrong key', 'That key does not match the moderation public key.'); return; }
            _modFlow(k, mp);
          } catch (e: any) { Alert.alert('Bad key', String((e && e.message) || e)); }
        };
        const _scanCold = async () => {
          try {
            const ec = require('expo-camera');
            const reqP = (ec.Camera && ec.Camera.requestCameraPermissionsAsync) || ec.requestCameraPermissionsAsync;
            const p: any = reqP ? await reqP() : { granted: true };
            if (!p || !p.granted) { Alert.alert('Camera needed', 'Allow camera access to scan the cold key QR.'); return; }
            setStoreView(null); // iOS can't stack a Modal on an open Modal
            (globalThis as any).__kvScanLock = false;
            setTimeout(() => setColdScan({ onKey: _useKey }), 600);
          } catch (e: any) { Alert.alert('Scanner error', String((e && e.message) || e)); }
        };
        const _askCold = () => {
          if (true) {
            require('./kv_prompt').kvPrompt('Cold mod key', 'Paste the moderator private key (64 hex). Used once to sign, never stored.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Unlock', onPress: (t: string) => _useKey(t) },
            ], 'secure-text');
          } else { Alert.alert('iOS only', 'Cold-key moderation uses the iOS secure prompt for now.'); }
        };
        Alert.alert('Not your listing', 'Only the publisher key can delist - or the moderator, with the cold key.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Scan cold key (QR)', onPress: _scanCold },
          { text: 'Type cold key\u2026', onPress: _askCold },
        ]);
        return;
      }
      Alert.alert('Delist this listing?', 'It disappears from every Mailbox directory (a newer announce restores it). Chain data, installs and your pledge are untouched. ~1 KAS.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delist', style: 'destructive', onPress: async () => {
          try {
            const { delistFromRegistry } = require('./payload_publish');
            const r: any = await delistFromRegistry({ privateKeyHex: priv, pubkeyHex: pub, address: sender, network: 'testnet-10' as any }, String(entry.arweaveTx || entry.id), kind);
            if (r && r.success === false) throw new Error(String(r.error || 'send failed'));
            console.log('[DelistOwner]', String(entry.arweaveTx || entry.id).slice(0, 24), kind);
            setStoreView(null);
            Alert.alert('Delisted', 'Posted to the registry. Lanes drop it on the next refresh.');
          } catch (e: any) { Alert.alert('Delist failed', String((e && e.message) || e)); }
        } },
      ]);
    } catch (e: any) { Alert.alert('Delist failed', String((e && e.message) || e)); }
  };
  const tipKeeper = (entry: any, addrOverride?: string) => {
    const addr = addrOverride || (entry && entry.repostedBy);
    if (!addr) return;
    setKeeperAmt(''); setKeeperTip({ addr: String(addr), name: String((entry && (entry.name || entry.storeName || entry.title)) || 'listing') });
  };
  const sendKeeperTip = async () => {
    const kas = Number(keeperAmt || '0');
    if (!keeperTip) return;
    if (!(kas > 0) || kas > 5000) { Alert.alert('Invalid amount', 'Enter between 0 and 5000 KAS.'); return; }
    setKeeperBusy(true);
    try {
      const ps = require('./proposal_share');
      const SS = require('expo-secure-store');
      const sender = (await SS.getItemAsync('kv_kaspa_address')) || (await SS.getItemAsync('kaspa_address'));
      const priv = await ps._kvResolvePrivHex();
      if (!sender || !priv) throw new Error('wallet identity unavailable');
      const { sendKaspaViaRest } = require('./kaspa_rest_tx');
      const r: any = await sendKaspaViaRest({ senderAddress: sender, recipientAddress: String(keeperTip.addr), amountSompi: BigInt(Math.round(kas * 1e8)), privateKeyHex: priv, network: 'testnet-10' as any });
      if (r && r.success === false) throw new Error(String(r.error || 'send failed'));
      console.log('[KeeperTip]', kas, 'KAS ->', String(keeperTip.addr).slice(0, 24));
      setKeeperTip(null);
      Alert.alert('Tip sent \u2713', kas + ' KAS to the keeper of "' + keeperTip.name + '". Tips are what keep listings alive.');
    } catch (e: any) { Alert.alert('Tip failed', String((e && e.message) || e)); }
    setKeeperBusy(false);
  };
  const tipDev = (item: any) => {
    const addr = item && item.quad && item.quad.tip_addr;
    if (!addr || !(String(addr).startsWith('kaspatest:') || String(addr).startsWith('kaspa:'))) return;
    setTipAmt(''); setTipT(item);
  };
  const doTip = async () => {
    const addr = tipT && tipT.quad && tipT.quad.tip_addr;
    const kas = Number(tipAmt || '0');
    if (!addr) return;
    if (!(kas > 0) || kas > 5000) { Alert.alert('Invalid amount', 'Enter between 0 and 5000 KAS.'); return; }
    setTipBusy(true);
    try {
      const ps = require('./proposal_share');
      const SS = require('expo-secure-store');
      const sender = await SS.getItemAsync('kaspa_address');
      const priv = await ps._kvResolvePrivHex();
      if (!sender || !priv) throw new Error('wallet identity unavailable');
      const { sendKaspaViaRest } = require('./kaspa_rest_tx');
      const r: any = await sendKaspaViaRest({
        senderAddress: sender, recipientAddress: String(addr),
        amountSompi: BigInt(Math.round(kas * 1e8)),
        privateKeyHex: priv, network: 'testnet-10' as any,
      });
      if (r && r.success && (r.txId || r.transactionId)) {
        setTipT(null);
        Alert.alert('Tip sent \u2713', kas + ' KAS \u2192 ' + String(r.txId || r.transactionId).slice(0, 18) + '\u2026');
      } else { Alert.alert('Tip failed', String((r && r.error) || 'unknown')); }
    } catch (e: any) { Alert.alert('Tip failed', String(e?.message || e)); }
    setTipBusy(false);
  };

  // KV_GAME_REPOST: any player who has the game installed can keep it alive on chain
  const [repostingGame, setRepostingGame] = useState<string>('');
  const [repostGameProg, setRepostGameProg] = useState<string>('');
  const runRepostGame = async (item: any) => {
    const q = item && item.quad;
    if (!q || repostingGame) return;
    try {
      const gc = require('./game_chunks');
      const plan: any = await gc.repostGamePlan(q);
      if (!plan.ok) { Alert.alert('Repost', String(plan.error)); return; }
      const age = Math.max(0, Math.round((Date.now() - Math.max(Number(item.t || 0), Number(item.keptAt || 0))) / 3600000));
      Alert.alert('Keep ' + (item.name || q.game) + ' alive?', 'Last posted ~' + age + 'h ago (the chain keeps data ~30h).\n\nThis re-posts the whole game from YOUR verified copy: ' + plan.txs + ' records, about ' + plan.estKas + ' KAS + fees. The dust lands at the game\'s own addresses. New players can download it for another ~30 hours and your wallet is credited as its keeper.\n\nKeep this screen open while it runs.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Repost', onPress: async () => {
          setRepostingGame(q.head); setRepostGameProg('0/' + plan.txs);
          try {
            const ps = require('./proposal_share'); const SS = require('expo-secure-store');
            const sender = (await SS.getItemAsync('kv_kaspa_address')) || (await SS.getItemAsync('kaspa_address'));
            const priv = await ps._kvResolvePrivHex();
            if (!sender || !priv) throw new Error('wallet identity unavailable');
            const { bytesToHex, hexToBytes } = require('@noble/hashes/utils'); const { secp256k1 } = require('@noble/curves/secp256k1');
            const keeper = { privateKeyHex: priv, pubkeyHex: bytesToHex(secp256k1.getPublicKey(hexToBytes(priv), true)), address: sender, network: 'testnet-10' as any };
            const r: any = await gc.repostGame(keeper, q, item.rec || null, (d: number, t: number) => setRepostGameProg(d + '/' + t));
            if (r && r.success) Alert.alert('Reposted ✓', (item.name || q.game) + ' is fresh on chain again (' + r.sent + ' records). New players can install it for ~30 more hours.');
            else Alert.alert('Repost stopped', String((r && r.error) || 'unknown') + '\n\nWhat was sent still counts - you can tap Repost again.');
          } catch (e: any) { Alert.alert('Repost failed', String((e && e.message) || e)); }
          setRepostingGame(''); setRepostGameProg('');
        } },
      ]);
    } catch (e: any) { Alert.alert('Repost failed', String((e && e.message) || e)); }
  };
  // KV_GAME_KEEPER_TIP: tip whoever kept a game alive (wallet-to-wallet)
  const tipGameKeeper = (item: any, addr: string) => {
    const nm = String((item && (item.name || (item.quad && item.quad.game))) || 'game');
    require('./kv_prompt').kvPrompt('Tip the keeper', 'Keeper of "' + nm + '"\n' + addr + '\n\nKAS goes straight to their wallet. Tips are what keep games alive.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send tip', onPress: async (v: string) => {
        const kas = Number(String(v || '').replace(/[^0-9.]/g, ''));
        if (!(kas > 0) || kas > 5000) { Alert.alert('Invalid amount', 'Enter between 0 and 5000 KAS.'); return; }
        try {
          const ps = require('./proposal_share'); const SS = require('expo-secure-store');
          const sender = (await SS.getItemAsync('kv_kaspa_address')) || (await SS.getItemAsync('kaspa_address'));
          const priv = await ps._kvResolvePrivHex();
          if (!sender || !priv) throw new Error('wallet identity unavailable');
          if (sender === addr) { Alert.alert('That is you', 'You kept this game alive yourself.'); return; }
          const { sendKaspaViaRest } = require('./kaspa_rest_tx');
          const r: any = await sendKaspaViaRest({ senderAddress: sender, recipientAddress: String(addr), amountSompi: BigInt(Math.round(kas * 1e8)), privateKeyHex: priv, network: 'testnet-10' as any });
          if (r && r.success === false) throw new Error(String(r.error || 'send failed'));
          console.log('[GameKeeperTip]', kas, 'KAS ->', String(addr).slice(0, 24));
          Alert.alert('Tip sent \u2713', kas + ' KAS to the keeper of "' + nm + '".');
        } catch (e: any) { Alert.alert('Tip failed', String((e && e.message) || e)); }
      } },
    ], 'plain-text', '1');
  };
  const installGame = async (item: any) => {
    const q = item.quad;
    if (!q || installingGame) return;
    setInstallingGame(q.head);
    try {
      const gc = require('./game_chunks');
      const r = await gc.fetchGamePuzzle(q.manifestAddress, q.manifestHash, q.head, 'testnet-10', undefined,
        { anchor_hash: q.anchor_hash, daa_from: q.daa_from, daa_to: q.daa_to });
      if (!r || !r.html) throw new Error((r && r.error) || 'download failed');
      const AS = require('@react-native-async-storage/async-storage').default;
      const raw = await AS.getItem('kv_installed_games');
      const list = raw ? JSON.parse(raw) : [];
      const next = [{ id: q.game || item.name, name: item.name || q.game, installedAt: Date.now(), ...q },
        ...list.filter((g: any) => g.head !== q.head)];
      await AS.setItem('kv_installed_games', JSON.stringify(next));
      Alert.alert('Installed ✓', (item.name || q.game) + ' downloaded and hash-verified. Open it from the Entertainment Center.');
    } catch (e: any) { Alert.alert('Install failed', String(e?.message || e)); }
    setInstallingGame('');
  };

  // Filter by query
  const filteredData = useMemo(() => { // KV_SEARCH_V2: any word order, ranked, typo-tolerant
    try { return require('./kv_search').searchItems(getCurrentData() || [], dq, section); } catch { return []; }
  }, [section, dapps, storefronts, coupons, academics, services, games, dq]);

  // Render item
  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const onPress = () => {
      // Route based on section type
      if (section === 'storefronts' || section === 'academics' || section === 'services') { // KV_ACAD_VIEW + KV_MANAGE_TABS: store-rail listings share the chain-config modal
        setStoreView({ entry: item, config: null, loading: true });
        (async () => {
          try {
            const cfgHash = (item as any).configHash || '';
            console.log('[Mailbox] modal open - cfgHash:', cfgHash ? cfgHash.slice(0, 16) : 'MISSING', 'addr:', item.arweaveTx.slice(0, 24));
            if (!cfgHash) { setStoreView(sv => sv ? { ...sv, loading: false } : sv); return; }
            const { fetchStoreConfig } = await import('./config_chunks');
            let { config, error: _cfgErr } = await fetchStoreConfig(item.arweaveTx, cfgHash, 'testnet-10', (item as any).coords || undefined, (item as any).ownerPubkey || undefined);
            // KV_CFG_RETRY: one retry - a transient API miss must not read as "not on-chain"
            if (!config) { await new Promise((r) => setTimeout(r, 1500)); const _r2: any = await fetchStoreConfig(item.arweaveTx, cfgHash, 'testnet-10', (item as any).coords || undefined, (item as any).ownerPubkey || undefined); if (_r2 && _r2.config) { config = _r2.config; _cfgErr = _r2.error; } }
            // KV_CFG_SCAN: config chunks (products, coupons, description) never render unscanned
            try { if (config) { const _cfm = require('./content_filter'); const scanObject = _cfm.scanObjectStrict || _cfm.scanObject; const _sc = scanObject(config); if (!_sc.ok) { console.warn('[Mailbox] store config BLOCKED:', _sc.reason, 'at', _sc.path); setStoreView(sv => sv && sv.entry.id === item.id ? { ...sv, config: null, loading: false } : sv); return; } } } catch {}
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
        // KV_MANAGE_TABS: dapp listings manageable from the same modal
        const _openManage = () => setStoreView({ entry: { ...item, _kvKind: 'dapp' } as any, config: null, loading: false });
        if (videoLink && appLink) {
          Alert.alert(item.name || 'App', 'Watch the demo or open the app?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Manage Listing', onPress: _openManage },
            { text: '🎬 Watch Demo', onPress: () => Linking.openURL(videoLink.startsWith('http') ? videoLink : 'https://' + videoLink) },
            { text: '🚀 Open App', onPress: () => Linking.openURL(appLink.startsWith('http') ? appLink : 'https://' + appLink) },
          ]);
        } else {
          const link = videoLink || appLink;
          Alert.alert(item.name || 'App', link ? 'Open the app or manage the listing?' : 'No demo or app URL set.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Manage Listing', onPress: _openManage },
            ...(link ? [{ text: 'Open App', onPress: () => Linking.openURL(link.startsWith('http') ? link : 'https://' + link) }] : []),
          ]);
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
        try { Clipboard.setStringAsync(item.code || item.title || ''); Alert.alert('Coupon Copied!', (item.code || item.title) + ' — use at checkout in a Neighbor Agreement'); } catch { Alert.alert('Coupon', item.title || item.code || 'No code'); }
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
      case 'storefronts': return <StorefrontCard item={item} onPress={onPress} onRepost={(e: any) => runRepost(e, (e && e._kvKind) || 'store')} reposting={repostBusy} onFlag={(e: any) => runFlag(e, 'store')} onTipKeeper={tipKeeper} />;
      case 'coupons': return <CouponCard item={item} onPress={onPress} />;
      case 'academics': return <AcademicCard item={item} onPress={onPress} />;
      case 'services': return <ServiceCard item={item} onPress={onPress} />;
      case 'games': return <GameRegistryCard item={item} onInstall={installGame} installing={installingGame === (item.quad && item.quad.head)} onTip={tipDev} onRepost={runRepostGame} onTipKeeper={tipGameKeeper} reposting={repostingGame === (item.quad && item.quad.head)} repostProg={repostGameProg} />;
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

        {/* KV_SEARCH_CHIPS: one tap = a search, no typing */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: rs.s(6) }} contentContainerStyle={{ paddingHorizontal: rs.s(12) }}>
          {((require('./kv_search').SEARCH_CHIPS as any)[section] || ['all']).map((c: string) => {
            const on = query.trim().toLowerCase() === c;
            return (
              <TouchableOpacity key={c} onPress={() => setQuery(on ? '' : c)} style={{ marginRight: rs.s(6), borderWidth: 1, borderColor: on ? '#d97706' : '#d6d3d1', backgroundColor: on ? '#fef3c7' : 'transparent', borderRadius: 14, paddingVertical: 4, paddingHorizontal: 10 }}>
                <Text style={{ fontSize: rs.font(11), color: '#44403c', fontWeight: '700' }}>{c}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

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
              Type any words (any order) or tap a chip - "all" lists everything. Results come straight from the Kaspa L1 registry.
            </Text>
          </View>
        ) : loading && filteredData.length === 0 ? (
          <SkeletonList count={4} />
        ) : filteredData.length === 0 ? (
          <EmptyState section={section} />
        ) : (
          <FlatList
            data={filteredData.slice(0, shown)}
            keyExtractor={(item: any, i: number) => String(item.id || (item.quad && item.quad.head) || item.arweaveTx || item.address || i)}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={7}
            removeClippedSubviews
            renderItem={renderItem}
            numColumns={1} /* KV_ENVELOPE_CARDS: one envelope per row */
            key={'list'}
            columnWrapperStyle={undefined}
            contentContainerStyle={mainStyles.list}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.purple600} />
            }
            onEndReached={() => { if (shown < filteredData.length) setShown((n: number) => n + 60); else handleLoadMore(); }}
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
      <Modal visible={!!tipT} animationType="fade" transparent onRequestClose={() => setTipT(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 22 }}>
          <View style={{ backgroundColor: '#15151f', borderRadius: 14, padding: 18, borderColor: '#7c3aed', borderWidth: 1 }}>
            <Text style={{ color: '#b9a6ff', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>{'\u{1F49C} TIP THE DEV'}</Text>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700', marginTop: 6 }}>{(tipT && tipT.name) || 'dev'}</Text>
            <Text style={{ color: '#8a8aa0', fontSize: 10, marginTop: 8 }}>TO (declared by dev in their announce)</Text>
            <Text style={{ color: '#ddd', fontSize: 10, fontFamily: 'monospace', marginTop: 2 }} selectable>
              {(tipT && tipT.quad && tipT.quad.tip_addr) || ''}
            </Text>
            <TextInput value={tipAmt} onChangeText={setTipAmt} keyboardType="decimal-pad" placeholder="0.0"
              placeholderTextColor="#555" editable={!tipBusy}
              style={{ marginTop: 14, backgroundColor: '#0b0b12', color: '#fff', borderRadius: 9, paddingHorizontal: 12,
                paddingVertical: 10, fontSize: 22, fontWeight: '700', borderColor: '#333', borderWidth: 1 }} />
            <Text style={{ color: '#6f6f85', fontSize: 9, marginTop: 8, lineHeight: 13 }}>
              {'Sent straight from your wallet to the dev. KasVillage never holds or fees it. Never send KAS to an address typed inside a game or page \u2014 only through sheets like this one.'}
            </Text>
            <View style={{ flexDirection: 'row', marginTop: 14, gap: 8 }}>
              <TouchableOpacity onPress={() => setTipT(null)} disabled={tipBusy}
                style={{ flex: 1, paddingVertical: 11, borderRadius: 9, borderColor: '#444', borderWidth: 1, alignItems: 'center' }}>
                <Text style={{ color: '#aaa', fontWeight: '700', fontSize: 12 }}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={doTip} disabled={tipBusy}
                style={{ flex: 2, paddingVertical: 11, borderRadius: 9, backgroundColor: tipBusy ? '#555' : '#7c3aed', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{tipBusy ? 'SENDING\u2026' : 'SEND TIP'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

{(() => { const { KvPromptHost } = require('./kv_prompt'); return <KvPromptHost />; })()}
      {/* KV_COLD_SCAN scanner */}
      <Modal visible={!!coldScan} animationType="slide" onRequestClose={() => setColdScan(null)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {coldScan ? (() => { const { CameraView } = require('expo-camera'); return (
            <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={(ev: any) => {
                const g: any = globalThis as any; if (g.__kvScanLock) return; g.__kvScanLock = true;
                const cs = coldScan; setColdScan(null);
                const d = String((ev && ev.data) || '');
                setTimeout(() => { if (cs) cs.onKey(d); }, 500);
              }} />
          ); })() : null}
          <Text style={{ position: 'absolute', top: 70, alignSelf: 'center', color: '#fff', fontWeight: '700', fontSize: 16 }}>Point at the cold-key QR</Text>
          <TouchableOpacity onPress={() => setColdScan(null)} style={{ position: 'absolute', bottom: 50, alignSelf: 'center', backgroundColor: '#fff', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32 }}>
            <Text style={{ fontWeight: '700', fontSize: 15 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
      <Modal visible={!!gameView} animationType="slide" transparent onRequestClose={() => setGameView(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(28,25,23,0.85)', justifyContent: 'center', padding: rs.s(20) }}>
          <View style={{ backgroundColor: COLORS.cardBg, borderRadius: rs.s(20), padding: rs.s(18), maxHeight: '88%' }}>
            {gameView && (
              <View>
                <Text style={{ fontSize: rs.font(19), fontWeight: '900', color: COLORS.stone900, textAlign: 'center' }}>{gameView.name}</Text>
                <Text style={{ fontSize: rs.font(9), color: COLORS.stone400, textAlign: 'center', marginTop: 2, marginBottom: rs.s(12) }}>
                  descriptor {gameView.hash.slice(0, 16)}... on Kaspa L1
                </Text>
                {/* KV_GAME_FLAG_BTN */}
                {(() => { const _fi = ((globalThis as any).__kvFlagInfo || new Map()).get(String(gameView.addr)); return _fi && _fi.n ? (
                  <Text style={{ color: '#92400e', backgroundColor: '#fef3c7', fontSize: rs.font(10), fontWeight: 'bold', textAlign: 'center', borderRadius: rs.s(8), padding: rs.s(6), marginBottom: rs.s(8) }}>{'\u2691 Flagged ' + _fi.n + '/3 \u2014 ' + _fi.reasons.join(', ')}</Text>
                ) : null; })()}
                <TouchableOpacity onPress={() => runFlag({ arweaveTx: gameView.addr, id: gameView.addr, name: gameView.name } as any, 'dapp')} style={{ alignSelf: 'center', borderWidth: 1, borderColor: '#d97706', borderRadius: rs.s(10), paddingVertical: rs.s(5), paddingHorizontal: rs.s(12), marginBottom: rs.s(10) }}>
                  <Text style={{ color: '#d97706', fontSize: rs.font(10), fontWeight: 'bold' }}>Flag this game (0.2 KAS)</Text>
                </TouchableOpacity>
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
                          // Display-side gate. This is the one that matters:
                          // anyone can write to the registry address without
                          // going through this app.
                          const { scanDescriptor, reasonMessage } = require('./content_filter');
                          const _scan = scanDescriptor(config);
                          if (!_scan.ok) {
                            console.warn('[Game] content rejected:', _scan.reason, _scan.path);
                            setGameView(g => g ? { ...g, loading: false, error: reasonMessage(_scan.reason) } : g);
                            return;
                          }
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
          {/* KV_KEEPER_TIP2: overlay INSIDE the store modal - iOS cannot stack sibling Modals */}
          {keeperTip ? (
            <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(28,25,23,0.7)', justifyContent: 'center', padding: rs.s(24), zIndex: 999, elevation: 999 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: rs.s(16), padding: rs.s(18) }}>
              <Text style={{ fontWeight: '900', fontSize: rs.font(14), color: '#292524' }}>Tip the keeper</Text>
              <Text style={{ fontSize: rs.font(10), color: '#78716c', marginTop: rs.s(4) }}>{keeperTip ? 'Keeper of "' + keeperTip.name + '"' : ''}</Text>
              <Text style={{ fontSize: rs.font(9), color: '#a8a29e', marginTop: rs.s(2) }}>{keeperTip ? String(keeperTip.addr) : ''}</Text>
              <View style={{ flexDirection: 'row', gap: rs.s(8), marginTop: rs.s(12) }}>
                {['1', '5', '25'].map((v) => (
                  <TouchableOpacity key={v} onPress={() => setKeeperAmt(v)} style={{ flex: 1, borderWidth: 1, borderColor: keeperAmt === v ? '#4f46e5' : '#d6d3d1', borderRadius: rs.s(10), paddingVertical: rs.s(8), alignItems: 'center' }}>
                    <Text style={{ fontWeight: 'bold', fontSize: rs.font(11), color: keeperAmt === v ? '#4f46e5' : '#57534e' }}>{v} KAS</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput value={keeperAmt} onChangeText={setKeeperAmt} keyboardType="decimal-pad" placeholder="Custom amount (KAS)" placeholderTextColor="#a8a29e" style={{ borderWidth: 1, borderColor: '#d6d3d1', borderRadius: rs.s(10), marginTop: rs.s(10), padding: rs.s(10), color: '#292524', fontSize: rs.font(12) }} />
              <View style={{ flexDirection: 'row', gap: rs.s(8), marginTop: rs.s(12) }}>
                <TouchableOpacity onPress={() => setKeeperTip(null)} style={{ flex: 1, backgroundColor: '#e7e5e4', borderRadius: rs.s(10), paddingVertical: rs.s(12), alignItems: 'center' }}>
                  <Text style={{ fontWeight: 'bold', color: '#57534e', fontSize: rs.font(12) }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={keeperBusy} onPress={sendKeeperTip} style={{ flex: 1, backgroundColor: '#4f46e5', borderRadius: rs.s(10), paddingVertical: rs.s(12), alignItems: 'center' }}>
                  <Text style={{ fontWeight: 'bold', color: '#fff', fontSize: rs.font(12) }}>{keeperBusy ? 'Sending...' : 'Send Tip'}</Text>
                </TouchableOpacity>
              </View>
            </View>
            </View>
          ) : null}
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
              // Display-side gate on fetched store configs. Same exposure the
              // game rail had: anyone can write to the registry directly.
              try {
                const { scanObjectStrict: scanObject, reasonMessage } = require('./content_filter'); // KV_PUB_STRICT_MB
                const _sc = scanObject(cfg);
                if (!_sc.ok) {
                  console.warn('[Store] content rejected:', _sc.reason, _sc.path || '');
                  return (
                    <View style={{ padding: rs.s(20), alignItems: 'center' }}>
                      <Text style={{ fontSize: rs.font(11), color: COLORS.red500, textAlign: 'center' }}>
                        {reasonMessage(_sc.reason)}
                      </Text>
                    </View>
                  );
                }
              } catch {}
              // KV_ACAD_VIEW: abstract configs (title/text) render as a paper, not a store
              if (cfg && (cfg.text || cfg.abstractText) && !cfg.stash) {
                const _qa = [cfg.qaChannel, cfg.qaHandle].filter(Boolean).join(': ');
                return (
                  <ScrollView contentContainerStyle={{ padding: rs.s(18) }}>
                    {/* KV_ACAD_CLOSE */}
                    <TouchableOpacity onPress={() => setStoreView(null)} style={{ alignSelf: 'flex-end', paddingHorizontal: rs.s(10), paddingVertical: rs.s(4), backgroundColor: '#e7e5e4', borderRadius: rs.s(14) }}>
                      <Text style={{ fontSize: rs.font(13), fontWeight: 'bold', color: '#57534e' }}>{'\u2715'}</Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: rs.font(16), fontWeight: '900', color: '#292524' }}>{cfg.title || (storeView.entry as any).title || (storeView.entry as any).storeName || 'Abstract'}</Text>
                    <Text style={{ fontSize: rs.font(10), color: '#4f46e5', marginTop: rs.s(2) }}>{String(cfg.institutionDomain || '') + (cfg.researcherId ? '  \u00b7  ' + cfg.researcherId : '')}</Text>
                    <Text style={{ fontSize: rs.font(12), color: '#44403c', marginTop: rs.s(12), lineHeight: rs.font(18) }}>{cfg.text || cfg.abstractText}</Text>
                    {Array.isArray(cfg.keywords) && cfg.keywords.length > 0 ? <Text style={{ fontSize: rs.font(10), color: '#78716c', marginTop: rs.s(10) }}>{cfg.keywords.join(' \u00b7 ')}</Text> : null}
                    {cfg.repositoryUrl ? <TouchableOpacity onPress={() => { try { require('react-native').Linking.openURL(String(cfg.repositoryUrl)); } catch {} }} style={{ marginTop: rs.s(12) }}><Text style={{ fontSize: rs.font(11), color: '#4f46e5' }}>{cfg.repositoryUrl}</Text></TouchableOpacity> : null}
                    {_qa ? <Text style={{ fontSize: rs.font(10), color: '#57534e', marginTop: rs.s(10) }}>Questions: {_qa}</Text> : null}
                    {true ? ( /* KV_QA_DM KV_QA_ALWAYS */
                      <View style={{ marginTop: rs.s(10), borderWidth: 1, borderColor: '#e7e5e4', borderRadius: rs.s(10), padding: rs.s(10) }}>
                        <Text style={{ fontSize: rs.font(12), fontWeight: 'bold', color: '#292524' }}>Ask the researcher</Text>
                        <Text style={{ fontSize: rs.font(9), color: '#78716c', marginTop: rs.s(2) }}>First question free{Number(cfg.questionPrice || 0) > 0 ? ' \u00b7 follow-ups ' + cfg.questionPrice + ' KAS' : ''} \u00b7 delivered to their {String(cfg.qaChannel || 'DM')}</Text>
                        <TextInput value={qaText} onChangeText={setQaText} multiline placeholder="Type your question..." placeholderTextColor="#a8a29e" style={{ borderWidth: 1, borderColor: '#d6d3d1', borderRadius: rs.s(8), marginTop: rs.s(8), padding: rs.s(8), minHeight: rs.s(60), color: '#292524', fontSize: rs.font(12), textAlignVertical: 'top' }} />
                        <TouchableOpacity disabled={qaBusy} onPress={() => askQuestion(storeView.entry, cfg)} style={{ marginTop: rs.s(8), backgroundColor: '#4f46e5', borderRadius: rs.s(10), paddingVertical: rs.s(10), alignItems: 'center' }}>
                          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: rs.font(12) }}>{qaBusy ? 'Preparing...' : 'Ask via ' + String(cfg.qaChannel || 'DM')}</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                    {(() => { // KV_LISTING_CLOCK
                      const _ca = Number((storeView.entry as any).createdAt || 0);
                      if (!_ca) return null;
                      const _ah = Math.max(0, (Date.now() - _ca) / 3600000);
                      const _left = Math.max(0, 30 - _ah);
                      const _col = _ah < 18 ? '#16a34a' : _ah < 26 ? '#d97706' : '#b91c1c';
                      const _msg = _ah < 18 ? 'fresh - no repost needed' : _ah < 26 ? 'renew soon' : 'expiring - repost to keep it alive';
                      return <Text style={{ color: _col, fontSize: rs.font(10), fontWeight: 'bold', marginTop: rs.s(12), textAlign: 'center' }}>Last announced {_ah < 1 ? '<1' : Math.floor(_ah)}h ago {'\u00b7'} ~{Math.floor(_left)}h+ left {'\u00b7'} {_msg}</Text>;
                    })()}
                    {(((storeView.entry as any).keepers || []) as string[]).length > 0 ? (
                      <View style={{ marginTop: rs.s(12) }}>
                        <Text style={{ color: '#d97706', fontSize: rs.font(10), fontWeight: 'bold' }}>Kept alive by {(((storeView.entry as any).keepers || []) as string[]).length} keeper(s)</Text>
                        {(((storeView.entry as any).keepers || []) as string[]).slice(0, 5).map((_ka: string, _ki: number) => (
                          <TouchableOpacity key={_ki} onPress={() => tipKeeper(storeView.entry, _ka)} style={{ marginTop: rs.s(6), borderWidth: 1, borderColor: '#d97706', borderRadius: rs.s(10), paddingVertical: rs.s(8), alignItems: 'center' }}>
                            <Text style={{ color: '#d97706', fontSize: rs.font(10), fontWeight: 'bold' }}>{_ka.slice(10, 30)}... {'\u2014'} Tip this keeper</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}
                    {(storeView.entry as any)?.coords?.tip_addr ? ( /* KV_STORE_TIP_SHEET: tip moved off the envelope */
                      <TouchableOpacity onPress={() => kvTipStore(storeView.entry)} style={{ marginTop: rs.s(8), borderWidth: 1, borderColor: '#7c3aed', borderRadius: rs.s(10), paddingVertical: rs.s(8), alignItems: 'center' }}>
                        <Text style={{ color: '#7c3aed', fontSize: rs.font(11), fontWeight: 'bold' }}>{'\u{1F49C} Tip this store (1 KAS)'}</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity disabled={repostBusy} onPress={() => runRepost(storeView.entry as any, ((storeView.entry as any)._kvKind || 'store'))} style={{ marginTop: rs.s(8), borderWidth: 1, borderColor: '#4f46e5', borderRadius: rs.s(10), paddingVertical: rs.s(10), alignItems: 'center' }}>
                      <Text style={{ color: '#4f46e5', fontSize: rs.font(11), fontWeight: 'bold' }}>{repostBusy ? 'Reposting...' : 'Repost \u2014 keep this listing alive (0.2 KAS)'}</Text>
                    </TouchableOpacity>
{(() => { // KV_FLAG_BADGE
                      const _fi = ((globalThis as any).__kvFlagInfo || new Map()).get(String((storeView.entry as any).arweaveTx || (storeView.entry as any).id));
                      if (!_fi || !_fi.n) return null;
                      return (
                        <View style={{ marginTop: rs.s(8), backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#d97706', borderRadius: rs.s(10), padding: rs.s(8) }}>
                          <Text style={{ color: '#92400e', fontSize: rs.font(11), fontWeight: 'bold' }}>{'\u2691 Flagged ' + _fi.n + '/3 \u2014 ' + _fi.reasons.join(', ')}</Text>
                          <Text style={{ color: '#92400e', fontSize: rs.font(10), marginTop: rs.s(2) }}>At 3 flags from different publishers this listing is delisted in every wallet. Flags are public on the Kaspa chain.</Text>
                        </View>
                      );
                    })()}
                    {/* KV_FLAG_BTN */}
                    <TouchableOpacity onPress={() => runFlag(storeView.entry as any, 'store')} style={{ marginTop: rs.s(8), borderWidth: 1, borderColor: '#d97706', borderRadius: rs.s(10), paddingVertical: rs.s(10), alignItems: 'center' }}>
                      <Text style={{ color: '#d97706', fontSize: rs.font(11), fontWeight: 'bold' }}>Flag this listing (0.2 KAS)</Text>
                    </TouchableOpacity>
                    {/* KV_DELIST_OWNER */}
                    <TouchableOpacity onPress={() => runDelistOwner(storeView.entry as any, ((storeView.entry as any)._kvKind || 'store'))} style={{ marginTop: rs.s(8), borderWidth: 1, borderColor: '#b91c1c', borderRadius: rs.s(10), paddingVertical: rs.s(10), alignItems: 'center' }}>
                      <Text style={{ color: '#b91c1c', fontSize: rs.font(11), fontWeight: 'bold' }}>Delist (owner only, ~1 KAS)</Text>
                    </TouchableOpacity>
                    {/* KV_ACAD_CLOSE_BTM */}
                    <TouchableOpacity onPress={() => setStoreView(null)} style={{ marginTop: rs.s(16), backgroundColor: '#57534e', borderRadius: rs.s(12), paddingVertical: rs.s(14), alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: rs.font(14) }}>Close</Text>
                    </TouchableOpacity>
                    <View style={{ height: rs.s(24) }} />
                  </ScrollView>
                );
              }
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
                  {/* KV_REPOST_UI: keeper bar (stores) */}
                  <View style={{ paddingHorizontal: rs.s(14), paddingTop: rs.s(10) }}>
                    {(() => { // KV_LISTING_CLOCK
                      const _ca = Number((storeView.entry as any).createdAt || 0);
                      if (!_ca) return null;
                      const _ah = Math.max(0, (Date.now() - _ca) / 3600000);
                      const _left = Math.max(0, 30 - _ah);
                      const _col = _ah < 18 ? '#16a34a' : _ah < 26 ? '#d97706' : '#b91c1c';
                      const _msg = _ah < 18 ? 'fresh - no repost needed' : _ah < 26 ? 'renew soon' : 'expiring - repost to keep it alive';
                      return <Text style={{ color: _col, fontSize: rs.font(10), fontWeight: 'bold', marginTop: rs.s(0), textAlign: 'center' }}>Last announced {_ah < 1 ? '<1' : Math.floor(_ah)}h ago {'\u00b7'} ~{Math.floor(_left)}h+ left {'\u00b7'} {_msg}</Text>;
                    })()}
                    {(((storeView.entry as any).keepers || []) as string[]).length > 0 ? (
                      <View style={{ marginBottom: rs.s(6) }}>
                        <Text style={{ color: '#d97706', fontSize: rs.font(9), fontWeight: 'bold' }}>Kept alive by {(((storeView.entry as any).keepers || []) as string[]).length} keeper(s)</Text>
                        {(((storeView.entry as any).keepers || []) as string[]).slice(0, 5).map((_ka: string, _ki: number) => (
                          <TouchableOpacity key={_ki} onPress={() => tipKeeper(storeView.entry, _ka)} style={{ marginTop: rs.s(4), borderWidth: 1, borderColor: '#d97706', borderRadius: rs.s(10), paddingVertical: rs.s(7), alignItems: 'center' }}>
                            <Text style={{ color: '#d97706', fontSize: rs.font(9), fontWeight: 'bold' }}>{_ka.slice(10, 30)}... {'\u2014'} Tip this keeper</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}
                    {(storeView.entry as any)?.coords?.tip_addr ? ( /* KV_STORE_TIP_SHEET: tip moved off the envelope */
                      <TouchableOpacity onPress={() => kvTipStore(storeView.entry)} style={{ marginTop: rs.s(8), borderWidth: 1, borderColor: '#7c3aed', borderRadius: rs.s(10), paddingVertical: rs.s(8), alignItems: 'center' }}>
                        <Text style={{ color: '#7c3aed', fontSize: rs.font(11), fontWeight: 'bold' }}>{'\u{1F49C} Tip this store (1 KAS)'}</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity disabled={repostBusy} onPress={() => runRepost(storeView.entry as any, ((storeView.entry as any)._kvKind || 'store'))} style={{ borderWidth: 1, borderColor: '#4f46e5', borderRadius: rs.s(10), paddingVertical: rs.s(8), alignItems: 'center' }}>
                      <Text style={{ color: '#4f46e5', fontSize: rs.font(10), fontWeight: 'bold' }}>{repostBusy ? 'Reposting...' : 'Repost \u2014 keep this listing alive (0.2 KAS)'}</Text>
                    </TouchableOpacity>
{(() => { // KV_FLAG_BADGE
                      const _fi = ((globalThis as any).__kvFlagInfo || new Map()).get(String((storeView.entry as any).arweaveTx || (storeView.entry as any).id));
                      if (!_fi || !_fi.n) return null;
                      return (
                        <View style={{ marginTop: rs.s(6), backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#d97706', borderRadius: rs.s(10), padding: rs.s(8) }}>
                          <Text style={{ color: '#92400e', fontSize: rs.font(11), fontWeight: 'bold' }}>{'\u2691 Flagged ' + _fi.n + '/3 \u2014 ' + _fi.reasons.join(', ')}</Text>
                          <Text style={{ color: '#92400e', fontSize: rs.font(10), marginTop: rs.s(2) }}>At 3 flags from different publishers this listing is delisted in every wallet. Flags are public on the Kaspa chain.</Text>
                        </View>
                      );
                    })()}
                    {/* KV_FLAG_BTN store */}
                    <TouchableOpacity onPress={() => runFlag(storeView.entry as any, 'store')} style={{ marginTop: rs.s(6), borderWidth: 1, borderColor: '#d97706', borderRadius: rs.s(10), paddingVertical: rs.s(7), alignItems: 'center' }}>
                      <Text style={{ color: '#d97706', fontSize: rs.font(10), fontWeight: 'bold' }}>Flag this listing (0.2 KAS)</Text>
                    </TouchableOpacity>
                    {/* KV_DELIST_OWNER store */}
                    <TouchableOpacity onPress={() => runDelistOwner(storeView.entry as any, ((storeView.entry as any)._kvKind || 'store'))} style={{ marginTop: rs.s(6), borderWidth: 1, borderColor: '#b91c1c', borderRadius: rs.s(10), paddingVertical: rs.s(7), alignItems: 'center' }}>
                      <Text style={{ color: '#b91c1c', fontSize: rs.font(10), fontWeight: 'bold' }}>Delist (owner only, ~1 KAS)</Text>
                    </TouchableOpacity>
                  </View>
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

// KV_CLIP_ASYNC
