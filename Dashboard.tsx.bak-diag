// ============================================================================
// KASVILLAGE EXPO - DASHBOARD COMPONENT
// ============================================================================
// Migrated from frontend.jsx with identical UI/UX
// Sims-inspired pixel backgrounds, chessboard header, warm earth tones
// ============================================================================

import React, { useState, useEffect, useContext, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  PixelRatio,
  Animated,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import Svg, { Rect, Defs, LinearGradient, Stop, Pattern, Line, Path as SvgPath, Circle as SvgCircle } from 'react-native-svg';
import { 
  MapPin, Wallet, Mail, Store, Scale, User, 
  ShieldCheck, Zap, Activity 
} from 'lucide-react-native';
import { useKaspaPrice } from './useKaspaPrice';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import ProceduralBackground from './expo_procedural_backgrounds';
import { SlothPoisonBar } from './SlothPoisonMeter';
import type { IOULedger } from './IOUBalanceSheetShare';
import { calculateNetPosition } from './IOUBalanceSheetShare';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFinancialSummary } from './proposal_share';
// TownHall stats fetched directly via /user-stats POST (no counterparty_lookup needed)

// ============================================================================
// DASHBOARD STATS HOOK — UTXO Ledger + Arweave + IOU + TX History
// ============================================================================
function useDashboardStats(pubkey?: string, balanceSompiFallback: bigint = 0n, xpFallback: number = 0) {
  const [stats, setStats] = useState({
    agreementsCompleted: 0,
    deadlocks: 0,
    pComplete: 0,
    xp: 0,
    totalVolumeSompi: 0,
    totalBalanceSompi: 0n,
    spendableBalanceSompi: 0n,
    committedSompi: 0n,
    iouAllocatedSompi: 0n,
    iousOwedSompi: 0n,
    iousOwedToYouSompi: 0n,
    agreementReturnsSompi: 0n,
    totalSentSompi: 0n,
    totalReceivedSompi: 0n,
    sendCount: 0,
    receiveCount: 0,
    storefronts: 0,
    isSnailPoison: false,
    // TownHall Bayesian
    bayesianScore: 0.5,
    bayesianConfidence: 0,
    townhallRiskRating: 'unknown' as string,
    townhallOnline: false,
    townhallVolumeSompi: 0,
    townhallAvgCompletionMs: 0,
    townhallSuccesses: 0,
    townhallDeadlocks: 0,
    enhancedFactors: null as any,
    pendingProposals: 0,
    acceptedProposals: 0,
    loading: true,
  });

  const refresh = useCallback(async () => {
    setStats(s => ({ ...s, loading: true }));

    try {
      // Derive pubkey from address if all SecureStore keys empty
      let resolvedPubkey = pubkey 
        || (await SecureStore.getItemAsync('kv_public_key')) 
        || (await SecureStore.getItemAsync('kaspa_pubkey')) 
        || (await SecureStore.getItemAsync('kv_l1_pubkey'))
        || (await SecureStore.getItemAsync('public_key'))
        || '';
      const addr = await SecureStore.getItemAsync('kaspa_address') || '';

      if (!resolvedPubkey && addr) {
        // Kaspa P2PK address embeds x-only pubkey in bech32 — decode it
        try {
          const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
          const dataPart = addr.split(':')[1] || '';
          const stripped = dataPart.slice(0, dataPart.length - 8); // remove 8-char checksum
          const fiveBit: number[] = [];
          for (const c of stripped) {
            const v = CHARSET.indexOf(c);
            if (v === -1) break;
            fiveBit.push(v);
          }
          // first 5-bit value is address type (0=P2PK), skip it
          const payload = fiveBit.slice(1);
          // convert 5-bit to 8-bit
          let acc = 0, bits = 0;
          const bytes: number[] = [];
          for (const v of payload) {
            acc = (acc << 5) | v;
            bits += 5;
            if (bits >= 8) {
              bits -= 8;
              bytes.push((acc >> bits) & 0xff);
            }
          }
          if (bytes.length >= 32) {
            const xOnly = bytes.slice(0, 32).map(b => b.toString(16).padStart(2, '0')).join('');
            resolvedPubkey = (await SecureStore.getItemAsync('kv_public_key')) || ('02' + xOnly); // assume even y (standard for x-only)
            console.log('[DashStats] Derived pubkey from address:', resolvedPubkey.slice(0, 16));
          }
        } catch (e) { console.warn('[DashStats] Address decode error:', e); }
      }

      console.log('[DashStats] pubkey:', resolvedPubkey.slice(0, 12) || 'NONE', 'addr:', addr.slice(0, 20) || 'NONE');

      // Read local XP from kv_user_stats (TownHall writes here)
      let localXp = 0;
      try {
        const statsJson = await SecureStore.getItemAsync('kv_user_stats');
        if (statsJson) {
          const us = JSON.parse(statsJson);
          localXp = us.xp ?? 0;
          console.log('[DashStats] Local XP from kv_user_stats:', localXp);
        }
      } catch {}

      // 1) UTXO ledger from AsyncStorage
      let totalBalanceSompi = 0n;
      let spendableBalanceSompi = 0n;
      try { const { releaseOrphanCollateral } = require('./utxo_ledger'); let _live: string[]=[]; try { const raw = await AsyncStorage.getItem('kv_frost_active_list'); if (raw) _live = (JSON.parse(raw)||[]).map((x: any) => x.agrId || x.agreementId).filter(Boolean); } catch {}
      const n = await releaseOrphanCollateral(_live); if (n > 0) console.log('[DashStats] freed', n, 'orphan UTXOs'); } catch {}
      let committedSompi = 0n;
      let iouAllocatedSompi = 0n;
      try {
        const ledgerJson = await AsyncStorage.getItem('kv_utxo_ledger');
        console.log('[DashStats] UTXO ledger:', ledgerJson ? ledgerJson.length + ' chars' : 'NONE');
        if (ledgerJson) {
          const entries: Array<{ amountSompi: string; status: string }> = JSON.parse(ledgerJson);
          for (const e of entries) {
            const amt = BigInt(e.amountSompi);
            totalBalanceSompi += amt;
            switch (e.status) {
              case 'free': spendableBalanceSompi += amt; break;
              case 'iou-allocated': iouAllocatedSompi += amt; break;
              case 'collateral-committed':
              case 'collateral-locked': committedSompi += amt; break;
            }
          }
          console.log('[DashStats] UTXO total:', Number(totalBalanceSompi)/1e8, 'free:', Number(spendableBalanceSompi)/1e8);
        }
      } catch (e) { console.warn('[DashStats] UTXO ledger error:', e); }

      // Fallback: if ledger empty but we have balanceSompi from prop, use it
      if (totalBalanceSompi === 0n && balanceSompiFallback > 0n) {
        totalBalanceSompi = balanceSompiFallback;
        spendableBalanceSompi = balanceSompiFallback; // assume all free if ledger not populated
        console.log('[DashStats] Using balanceSompi fallback:', Number(balanceSompiFallback)/1e8);
      }

      // 2) Arweave: frost-agreement stats (direct GraphQL, 8s timeout)
      let agreementsCompleted = 0, deadlocks = 0, pComplete = 0, xp = 0, totalVolumeSompi = 0;
      let totalAgreements = 0;
      try {
        if (resolvedPubkey) {
          const gql = `{ transactions(tags: [{ name: "App-Name", values: ["KasVillage"] }, { name: "KV-Type", values: ["frost-agreement"] }, { name: "KV-Pubkey", values: ["${resolvedPubkey}"] }], first: 100, sort: HEIGHT_DESC) { edges { node { tags { name value } } } } }`;
          const gql2 = `{ transactions(tags: [{ name: "App-Name", values: ["KasVillage"] }, { name: "KV-Type", values: ["frost-agreement"] }, { name: "KV-Counterparty", values: ["${resolvedPubkey}"] }], first: 100, sort: HEIGHT_DESC) { edges { node { tags { name value } } } } }`;

          const fetchAr = async (q: string) => {
            const r = await fetch('https://arweave.net/graphql', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: q }),
            });
            const d = await r.json();
            return d?.data?.transactions?.edges || [];
          };

          const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Arweave timeout')), 8000));
          const [edges1, edges2] = await Promise.race([
            Promise.all([fetchAr(gql), fetchAr(gql2)]),
            timeout.then(() => { throw new Error('timeout'); }),
          ]) as [any[], any[]];

          const allEdges = [...edges1, ...edges2];
          // Status ranking: Released/Deadlocked are terminal, keep highest per agreement
          const rank: Record<string, number> = { Proposed: 1, Accepted: 2, Agreed: 3, Released: 4, Deadlocked: 4 };
          const agrMap = new Map<string, { status: string; amount: number }>();

          for (const e of allEdges) {
            const tags: Record<string, string> = {};
            for (const t of e.node.tags) tags[t.name] = t.value;
            const agrId = tags['KV-AgreementId'] || '';
            const status = tags['KV-Status'] || '';
            const amount = parseInt(tags['KV-Amount'] || '0', 10);
            if (!agrId) continue;
            const existing = agrMap.get(agrId);
            if (!existing || (rank[status] || 0) > (rank[existing.status] || 0)) {
              agrMap.set(agrId, { status, amount });
            }
          }

          totalAgreements = agrMap.size;
          for (const [, v] of agrMap) {
            if (v.status === 'Released') { agreementsCompleted++; totalVolumeSompi += v.amount; }
            if (v.status === 'Deadlocked') { deadlocks++; }
          }

          // XP from Arweave: +10 per success, -50 per deadlock
          const arweaveXp = Math.max(0, agreementsCompleted * 10 - deadlocks * 50);
          // pComplete: Bayesian (1+s)/(2+s+d)
          pComplete = totalAgreements > 0 ? (1 + agreementsCompleted) / (2 + agreementsCompleted + deadlocks) : 0;
          xp = arweaveXp;

          console.log('[DashStats] Arweave — total:', totalAgreements, 'completed:', agreementsCompleted, 'deadlocks:', deadlocks, 'xp:', xp, 'volume:', totalVolumeSompi / 1e8);
        }
      } catch (e) { console.warn('[DashStats] Arweave error:', e); }

      // Use local XP if Arweave didn't provide it
      if (xp === 0 && localXp > 0) xp = localXp;
      if (xp === 0 && xpFallback > 0) xp = xpFallback;

      // ── TownHall Bayesian stats via /user-stats POST (direct Flux endpoint) ──
      const TOWNHALL_STATS_URL = 'https://kasvillage.app.runonflux.io/user-stats';
      let bayesianScore = pComplete || 0.5;
      let bayesianConfidence = 0;
      let townhallRiskRating = 'unknown';
      let townhallOnline = false;
      let townhallVolumeSompi = 0;
      let townhallAvgCompletionMs = 0;
      let townhallSuccesses = 0;
      let townhallDeadlocks = 0;
      let enhancedFactors: any = null;
      try {
        if (resolvedPubkey) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          const resp = await fetch(TOWNHALL_STATS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ pubkey: resolvedPubkey }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (resp.ok) {
            const ts = await resp.json();
            townhallOnline = true;
            const s = ts.successes || 0;
            const d = ts.deadlocks || 0;
            const n = s + d;
            const thXp = ts.xp || 0;
            const thPComplete = n > 0 ? (1 + s) / (2 + n) : 0.5;
            const thConfidence = Math.min(n / 10, 1);
            bayesianScore = thPComplete;
            bayesianConfidence = thConfidence;
            townhallSuccesses = s;
            townhallDeadlocks = d;
            // Risk rating
            if (thPComplete > 0.9 && thConfidence > 0.5) townhallRiskRating = 'highly_trusted';
            else if (thPComplete > 0.75) townhallRiskRating = 'reliable';
            else if (thPComplete < 0.4) townhallRiskRating = 'high_risk';
            else townhallRiskRating = 'medium_risk';
            // Prefer TownHall over local Arweave
            if (s > 0 || d > 0) {
              agreementsCompleted = s;
              deadlocks = d;
              pComplete = thPComplete;
              if (thXp > 0) xp = thXp;
            }
            console.log('[DashStats] TownHall — pComplete:', bayesianScore.toFixed(3),
              'confidence:', bayesianConfidence.toFixed(2), 'risk:', townhallRiskRating, 'xp:', thXp);
          } else {
            console.log('[DashStats] TownHall — HTTP', resp.status, 'using Arweave data');
          }
        }
      } catch (e: any) {
        console.warn('[DashStats] TownHall fetch error (non-fatal):', e?.message || e);
      }

      // 3) IOU ledgers: net positions
      let iousOwedSompi = 0n;
      let iousOwedToYouSompi = 0n;
      let agreementReturnsSompi = 0n;
      try {
        const json = await SecureStore.getItemAsync('kv_iou_ledgers');
        if (json) {
          const ledgers: IOULedger[] = JSON.parse(json);
          for (const ledger of ledgers) {
            if (ledger.status === 'settled') continue;
            const pos = calculateNetPosition(ledger, resolvedPubkey);
            iousOwedToYouSompi += pos.theyOwe;
            iousOwedSompi += pos.iOwe;
            if (ledger.status === 'settling' && pos.theyOwe > 0n) {
              agreementReturnsSompi += pos.theyOwe;
            }
          }
        }
      } catch (e) { console.warn('[DashStats] IOU error:', e); }

      // 4) TX history: direct send/receive
      let totalSentSompi = 0n;
      let totalReceivedSompi = 0n;
      let sendCount = 0;
      let receiveCount = 0;
      try {
        const txJson = await SecureStore.getItemAsync('kv_tx_history');
        if (txJson) {
          const txs: Array<{ type: string; amountSompi: string; status: string }> = JSON.parse(txJson);
          for (const tx of txs) {
            if (tx.status === 'failed') continue;
            const amt = BigInt(tx.amountSompi);
            if (tx.type === 'send') { totalSentSompi += amt; sendCount++; }
            if (tx.type === 'receive') { totalReceivedSompi += amt; receiveCount++; }
          }
        }
      } catch (e) { console.warn('[DashStats] TX history error:', e); }

      // 5) Proposals: pending + accepted counts
      let pendingProposals = 0;
      let acceptedProposals = 0;
      try {
        const propJson = await SecureStore.getItemAsync('kv_proposals');
        if (propJson) {
          const proposals = JSON.parse(propJson);
          pendingProposals = proposals.filter((p: any) => p.status === 'proposed').length;
          acceptedProposals = proposals.filter((p: any) => p.status === 'accepted').length;
          console.log('[DashStats] Proposals — pending:', pendingProposals, 'accepted:', acceptedProposals);
        }
      } catch (e) { console.warn('[DashStats] Proposals error:', e); }

      setStats(prev => ({ ...prev,
        agreementsCompleted, deadlocks, pComplete, xp, totalVolumeSompi,
        totalBalanceSompi, spendableBalanceSompi, committedSompi, iouAllocatedSompi,
        iousOwedSompi, iousOwedToYouSompi, agreementReturnsSompi,
        totalSentSompi, totalReceivedSompi, sendCount, receiveCount,
        storefronts: 0,
        isSnailPoison: xp < 0,
        bayesianScore, bayesianConfidence, townhallRiskRating, townhallOnline,
        townhallVolumeSompi, townhallAvgCompletionMs, townhallSuccesses, townhallDeadlocks,
        enhancedFactors,
        loading: false,
      }));
    } catch (e) {
      console.warn('[DashStats] OUTER error:', e);
      setStats(s => ({ ...s, loading: false }));
    }
  }, [pubkey, balanceSompiFallback, xpFallback]);

  useEffect(() => { refresh(); }, [refresh]);

  return { ...stats, refresh };
}

// ============================================================================
// RESPONSIVE SCALER (Same as expo_phone_)
// ============================================================================
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BASE_WIDTH = 393;
const BASE_HEIGHT = 852;
const widthScale = SCREEN_WIDTH / BASE_WIDTH;
const heightScale = SCREEN_HEIGHT / BASE_HEIGHT;
const scale = Math.min(widthScale, heightScale);

const rs = {
  s: (size: number) => Math.round(size * scale),
  w: (size: number) => Math.round(size * widthScale),
  h: (size: number) => Math.round(size * heightScale),
  font: (size: number) => Math.round(size * scale * (PixelRatio.getFontScale() > 1 ? 0.9 : 1)),
  fullWidth: (padding = 20) => SCREEN_WIDTH - (padding * 2 * widthScale),
  screenWidth: SCREEN_WIDTH,
  screenHeight: SCREEN_HEIGHT,
  isSmallDevice: SCREEN_WIDTH < 375,
};

// ============================================================================
// COLORS (Exact match from frontend.jsx)
// ============================================================================
const COLORS = {
  // Base warm tones
  warmWall: '#C5B8A8',
  darkWood: '#4A3728',
  medWood: '#3D2E22',
  lightWood: '#C4A77D',
  cream: '#E8DDD0',
  pink: '#D4A5A5',
  
  // Stone palette (Tailwind stone)
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
  
  // Amber palette
  amber50: '#fffbeb',
  amber100: '#fef3c7',
  amber200: '#fde68a',
  amber600: '#d97706',
  amber700: '#b45309',
  amber800: '#92400e',
  amber900: '#78350f',
  
  // Green palette
  green400: '#4ade80',
  green500: '#22c55e',
  green600: '#16a34a',
  
  // Red palette
  red600: '#dc2626',
  red800: '#991b1b',
  
  // Purple/Indigo
  purple600: '#9333ea',
  indigo600: '#4f46e5',
  
  // UI
  cardBg: '#FFF8F0',
  headerBg: '#C4A77D',
  chessLight: '#C4A77D',
  chessDark: '#6B4423',
};

// ============================================================================
// PIXEL BACKGROUNDS (SVG-based, matching frontend.jsx)
// ============================================================================

// Bedroom Background (Dashboard default)
const BedroomBackground: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <View style={bgStyles.container}>
      {/* Base warm gray walls */}
      <View style={[bgStyles.layer, { backgroundColor: COLORS.warmWall }]} />
      
      {/* Dark wood floor (bottom 1/3) */}
      <View style={bgStyles.floor}>
        <Svg width="100%" height="100%">
          <Defs>
            <Pattern id="woodPattern" width={50} height={100} patternUnits="userSpaceOnUse">
              <Rect width={48} height={100} fill={COLORS.darkWood} />
              <Rect x={48} width={2} height={100} fill={COLORS.medWood} />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#woodPattern)" />
        </Svg>
      </View>
      
      {/* Grass strip at top */}
      <View style={bgStyles.grassStrip}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="grassGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#7CB342" />
              <Stop offset="0.5" stopColor="#8BC34A" />
              <Stop offset="1" stopColor="#9CCC65" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#grassGrad)" />
        </Svg>
      </View>
      
      {/* Pixel grid overlay */}
      <View style={bgStyles.pixelOverlay}>
        <Svg width="100%" height="100%" opacity={0.08}>
          <Defs>
            <Pattern id="pixelGrid" width={16} height={16} patternUnits="userSpaceOnUse">
              <Line x1={0} y1={0} x2={16} y2={0} stroke="#5D4E37" strokeWidth={1} />
              <Line x1={0} y1={0} x2={0} y2={16} stroke="#5D4E37" strokeWidth={1} />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#pixelGrid)" />
        </Svg>
      </View>
      
      {/* Decorative elements */}
      <View style={bgStyles.decorContainer}>
        <Text style={[bgStyles.plantEmoji, { bottom: '35%', left: '5%' }]}>🌿</Text>
        <Text style={[bgStyles.plantEmoji, { bottom: '40%', left: '25%' }]}>🪴</Text>
        <Text style={[bgStyles.plantEmoji, { bottom: '38%', right: '35%' }]}>🌱</Text>
        <Text style={[bgStyles.starEmoji, { top: '8%', left: '10%' }]}>⭐</Text>
      </View>
      
      {/* Content */}
      <View style={bgStyles.content}>{children}</View>
    </View>
  );
};

// Dynamic Background Switcher
const DynamicBackground: React.FC<{
  activeTab: string;
  avatarConfig?: { race: string; class: string; occupation: string; name: string; gender?: string };
  children: React.ReactNode
}> = ({ activeTab, avatarConfig, children }) => {
  if (avatarConfig && avatarConfig.race) {
    const section = activeTab === "workspace" ? "workspace" : activeTab === "bathroom" ? "tradfi_ed" : "dashboard";
    return (
      <View style={{ flex: 1 }}>
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }}>
          <ProceduralBackground avatar={avatarConfig} section={section} />
        </View>
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    );
  }
  return <BedroomBackground>{children}</BedroomBackground>;
};

const bgStyles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -10,
  },
  floor: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '33%',
    zIndex: -9,
  },
  grassStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: rs.h(60),
    zIndex: -9,
  },
  pixelOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -8,
  },
  decorContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -7,
    opacity: 0.6,
  },
  plantEmoji: {
    position: 'absolute',
    fontSize: rs.font(32),
    color: '#2D5A27',
  },
  starEmoji: {
    position: 'absolute',
    fontSize: rs.font(40),
    color: '#FFD700',
    opacity: 0.4,
  },
  content: {
    flex: 1,
    zIndex: 1,
  },
});

// ============================================================================
// CHESSBOARD HEADER
// ============================================================================
const ChessboardHeader: React.FC<{
  apartment: string;
  isSnailMode?: boolean;
  isEliteMode?: boolean;
  network?: string;
  activeMode?: 'tutorial' | 'real';
  onSwitchMode?: (mode: 'tutorial' | 'real') => void;
}> = ({ apartment, isSnailMode, isEliteMode, network, activeMode, onSwitchMode }) => {
  const topOffset = isSnailMode ? rs.h(56) : isEliteMode ? rs.h(40) : 0;
  
  return (
    <View style={[headerStyles.container, { marginTop: topOffset }]}>
      {/* Chessboard pattern background */}
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id="chess" width={40} height={40} patternUnits="userSpaceOnUse">
            <Rect width={20} height={20} fill={COLORS.chessDark} />
            <Rect x={20} y={20} width={20} height={20} fill={COLORS.chessDark} />
            <Rect x={20} width={20} height={20} fill={COLORS.chessLight} />
            <Rect y={20} width={20} height={20} fill={COLORS.chessLight} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#chess)" />
      </Svg>
      
      {/* Chess pieces silhouettes */}
      <View style={headerStyles.chessPieces}>
        <Text style={headerStyles.pieceText}>♔</Text>
        <Text style={headerStyles.pieceText}>♞</Text>
        <Text style={headerStyles.pieceText}>♕</Text>
        <Text style={headerStyles.pieceText}>♜</Text>
        <Text style={headerStyles.pieceText}>♗</Text>
      </View>
      <TouchableOpacity
        onPress={() => {
          console.log('[Toggle] onSwitchMode exists:', !!onSwitchMode);
        if (!onSwitchMode) { console.log('[Toggle] onSwitchMode is undefined!'); return; }
          const next = activeMode === "tutorial" ? "real" : "tutorial";
          Alert.alert(
            next === "real" ? "Switch to Real KAS?" : "Switch to Tutorial?",
            next === "real" ? "You will use REAL Kaspa (mainnet). Transactions cost real money." : "Switch to Tutorial mode (testnet). Free tKAS for testing.",
            [{ text: "Cancel", style: "cancel" }, { text: next === "real" ? "Go Real" : "Go Tutorial", onPress: () => onSwitchMode(next) }]
          );
        }}
        style={{ backgroundColor: activeMode === "real" ? "#10B981" : "#F59E0B", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, position: "absolute", top: 8, right: 12 }}
      >
        <Text style={{ color: "#000", fontSize: 10, fontWeight: "bold" }}>{activeMode === "real" ? "REAL KAS ($)" : "TUTORIAL (free)"}</Text>
      </TouchableOpacity>
      
      {/* Warm overlay for readability */}
      <View style={headerStyles.overlay} />
      
      {/* Header content */}
      <View style={headerStyles.content}>
        <View style={headerStyles.leftSection}>
          <View style={headerStyles.titleRow}>
            <MapPin size={rs.s(20)} color={COLORS.amber700} />
            <Text style={headerStyles.title}>{apartment} Apartment</Text>
          </View>
          <Text style={headerStyles.subtitle}>Identity Protocol</Text>
        </View>
        
        <View style={headerStyles.rightSection}>
          <View style={headerStyles.statusDot} />
          <View style={headerStyles.avatar}>
            <User size={rs.s(20)} color={COLORS.amber800} />
          </View>
        </View>
      </View>
    </View>
  );
};

const headerStyles = StyleSheet.create({
  container: {
    paddingHorizontal: rs.s(24),
    paddingTop: rs.s(24),
    paddingBottom: rs.s(16),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(180, 83, 9, 0.5)',
    position: 'relative',
    overflow: 'hidden',
  },
  chessPieces: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    opacity: 0.15,
  },
  pieceText: {
    fontSize: rs.font(48),
    color: '#1a1a1a',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 251, 235, 0.6)',
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  leftSection: {},
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(8),
  },
  title: {
    fontSize: rs.font(20),
    fontWeight: '900',
    color: COLORS.stone900,
  },
  subtitle: {
    fontSize: rs.font(10),
    fontWeight: 'bold',
    color: COLORS.amber800,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
    marginTop: rs.s(2),
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(8),
  },
  statusDot: {
    width: rs.s(8),
    height: rs.s(8),
    borderRadius: rs.s(4),
    backgroundColor: COLORS.green500,
  },
  avatar: {
    width: rs.s(40),
    height: rs.s(40),
    backgroundColor: COLORS.amber100,
    borderWidth: 2,
    borderColor: COLORS.amber600,
    borderRadius: rs.s(20),
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// ============================================================================
// SNAIL POISON BANNER
// ============================================================================
const SnailModeBanner: React.FC<{ threshold: number }> = ({ threshold }) => {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.7, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  
  return (
    <Animated.View style={[bannerStyles.snailBanner, { opacity: pulseAnim }]}>
      <View style={bannerStyles.bannerContent}>
        <Text style={bannerStyles.bannerEmoji}>🐌</Text>
        <View>
          <Text style={bannerStyles.bannerTitle}>SNAIL POISON ACTIVE</Text>
          <Text style={bannerStyles.bannerText}>
            Your XP is below {threshold}. App is throttled. Complete successful transactions to recover.
          </Text>
        </View>
        <Text style={bannerStyles.bannerEmoji}>🐌</Text>
      </View>
    </Animated.View>
  );
};

// Elite Mode Banner
const EliteModeBanner: React.FC = () => (
  <View style={bannerStyles.eliteBanner}>
    <View style={bannerStyles.bannerContent}>
      <Text style={bannerStyles.eliteEmoji}>⚡</Text>
      <Text style={bannerStyles.eliteTitle}>ELITE STATUS ACTIVE</Text>
      <Text style={bannerStyles.eliteText}>Priority access • 120 req/min • Gold features</Text>
      <Text style={bannerStyles.eliteEmoji}>⚡</Text>
    </View>
  </View>
);

const bannerStyles = StyleSheet.create({
  snailBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingVertical: rs.s(12),
    paddingHorizontal: rs.s(16),
  },
  snailBannerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs.s(8),
  },
  bannerEmoji: {
    fontSize: rs.font(24),
  },
  bannerTitle: {
    fontWeight: '900',
    fontSize: rs.font(12),
    color: '#fff',
    textAlign: 'center',
  },
  bannerText: {
    fontSize: rs.font(10),
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  eliteBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: COLORS.purple600,
    paddingVertical: rs.s(8),
    paddingHorizontal: rs.s(16),
  },
  eliteEmoji: {
    fontSize: rs.font(16),
  },
  eliteTitle: {
    fontWeight: '900',
    fontSize: rs.font(12),
    color: '#fff',
  },
  eliteText: {
    fontSize: rs.font(10),
    color: 'rgba(255,255,255,0.9)',
  },
});

// ============================================================================
// NAV BUTTON (Bottom Tab)
// ============================================================================
interface NavButtonProps {
  active: boolean;
  icon: any;
  label: string;
  onPress: () => void;
}

const NavButton: React.FC<NavButtonProps> = ({ active, icon: Icon, label, onPress }) => (
  <TouchableOpacity 
    style={[navStyles.button, active && navStyles.buttonActive]} 
    onPress={onPress}
    activeOpacity={0.7}
  >
    {typeof Icon === 'string' ? (
      <Text style={navStyles.iconEmoji}>{Icon}</Text>
    ) : (
      <Icon 
        size={rs.s(20)} 
        color={active ? COLORS.amber700 : COLORS.stone400} 
      />
    )}
    <Text style={[navStyles.label, active && navStyles.labelActive]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const navStyles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: rs.s(8),
    paddingHorizontal: rs.s(16),
    borderRadius: rs.s(12),
  },
  buttonActive: {
    backgroundColor: COLORS.amber100,
  },
  iconEmoji: {
    fontSize: rs.font(20),
  },
  label: {
    fontSize: rs.font(10),
    fontWeight: 'bold',
    color: COLORS.stone400,
    marginTop: rs.s(4),
  },
  labelActive: {
    color: COLORS.amber700,
  },
});

// ============================================================================
// CARD COMPONENT
// ============================================================================
const Card: React.FC<{
  children: React.ReactNode;
  style?: any;
  variant?: 'default' | 'amber' | 'green' | 'blue';
}> = ({ children, style, variant = 'default' }) => {
  const variantStyles = {
    default: { backgroundColor: COLORS.cardBg, borderColor: COLORS.stone200 },
    amber: { backgroundColor: COLORS.amber50, borderColor: COLORS.amber200 },
    green: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
    blue: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  };
  
  return (
    <View style={[cardStyles.card, variantStyles[variant], style]}>
      {children}
    </View>
  );
};

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: rs.s(16),
    padding: rs.s(16),
    borderWidth: 1,
  },
});

// ============================================================================
// BAYESIAN TRUST GAUGE (SVG semi-arc + RN text overlay)
// ============================================================================
const BayesianGauge: React.FC<{
  score: number;      // 0..1
  confidence: number; // 0..1
  riskRating: string;
  online: boolean;
  loading?: boolean;
}> = ({ score, confidence, riskRating, online, loading }) => {
  const size = rs.s(160);
  const sw = rs.s(14);
  const r = (size - sw) / 2;
  const cx = size / 2;
  const cy = size / 2 + rs.s(8);

  // Semi-arc: 180° (left) to 0° (right)
  const clampedScore = Math.max(0, Math.min(1, score));
  const fillAngle = Math.PI - Math.PI * clampedScore;

  const x1 = cx + r * Math.cos(Math.PI);
  const y1 = cy - r * Math.sin(Math.PI);
  const x2 = cx + r * Math.cos(0);
  const y2 = cy - r * Math.sin(0);
  const fx = cx + r * Math.cos(fillAngle);
  const fy = cy - r * Math.sin(fillAngle);

  const largeArc = clampedScore > 0.5 ? 1 : 0;

  // Color based on score
  const gc = clampedScore >= 0.85 ? '#22c55e'
    : clampedScore >= 0.7 ? '#84cc16'
    : clampedScore >= 0.5 ? '#eab308'
    : clampedScore >= 0.3 ? '#f97316'
    : '#ef4444';

  const riskLabels: Record<string, string> = {
    highly_trusted: '\u2B50 Highly Trusted',
    reliable: '\u2713 Reliable',
    medium_risk: '\u26A0 Medium Risk',
    high_risk: '\uD83D\uDEA8 High Risk',
    unknown: '? New User',
  };

  const pctText = loading ? '...' : (clampedScore * 100).toFixed(0) + '%';

  return (
    <View style={{ alignItems: 'center', marginBottom: rs.s(8) }}>
      <View style={{ width: size, height: size / 2 + rs.s(30), position: 'relative' }}>
        <Svg width={size} height={size / 2 + rs.s(20)}>
          {/* Background arc */}
          <SvgPath
            d={`M ${x1} ${y1} A ${r} ${r} 0 1 1 ${x2} ${y2}`}
            fill="none"
            stroke="#e7e5e4"
            strokeWidth={sw}
            strokeLinecap="round"
          />
          {/* Filled arc */}
          {clampedScore > 0.01 && (
            <SvgPath
              d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${fx} ${fy}`}
              fill="none"
              stroke={gc}
              strokeWidth={sw}
              strokeLinecap="round"
            />
          )}
        </Svg>
        {/* Center text overlay (RN Text, not SVG Text — avoids import conflict) */}
        <View style={{ position: 'absolute', top: rs.s(20), left: 0, right: 0, alignItems: 'center' }}>
          <Text style={{ fontSize: rs.font(32), fontWeight: '900', color: gc }}>{pctText}</Text>
          <Text style={{ fontSize: rs.font(9), color: '#78716c', marginTop: rs.s(2) }}>Bayesian Trust</Text>
        </View>
      </View>
      <Text style={{ fontSize: rs.font(13), fontWeight: 'bold', color: gc, marginTop: -rs.s(4) }}>
        {riskLabels[riskRating] || riskRating}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs.s(8), marginTop: rs.s(4) }}>
        <Text style={{ fontSize: rs.font(9), color: '#a8a29e' }}>
          Confidence: {(confidence * 100).toFixed(0)}%
        </Text>
        <View style={{ width: rs.s(6), height: rs.s(6), borderRadius: rs.s(3), backgroundColor: online ? '#22c55e' : '#ef4444' }} />
        <Text style={{ fontSize: rs.font(9), color: online ? '#22c55e' : '#a8a29e' }}>
          {online ? 'TownHall' : 'Offline'}
        </Text>
      </View>
    </View>
  );
};

// ============================================================================
// WALLET OVERVIEW
// ============================================================================
const WalletOverview: React.FC<{
  balance: number;
  xp: number;
  onDeposit: () => void;
  onWithdraw: () => void;
  onSend: () => void;
  onPayNearby: () => void;
  onNavigateProfile?: () => void;
  onNavigateNeighbor?: () => void;
  onNavigateTxHistory?: () => void;
  onNavigatePhoneProof?: () => void;
  onNavigateBalanceSheet?: () => void;
  onNavigatePOBox?: () => void;
  onSwitchMode?: (mode: 'tutorial' | 'real') => void;
  activeMode?: 'tutorial' | 'real';
  balanceSompi?: bigint;
  // Stats from hook
  ds: ReturnType<typeof useDashboardStats>;
}> = ({ balance, xp, onDeposit, onWithdraw, onSend, onPayNearby, onNavigateProfile, onNavigateNeighbor, onNavigateTxHistory, onNavigatePOBox,
  onNavigatePhoneProof, onNavigateBalanceSheet, activeMode, onSwitchMode, balanceSompi = 0n, ds }) => {
  const { formattedPrice, usdPerKas, loading: priceLoading, isStale } = useKaspaPrice({ autoStart: true });
  const kasBalance = Number(balanceSompi) / 100_000_000;
  const usdValue = kasBalance * usdPerKas;

  return (
    <View style={walletStyles.container}>
      {/* Sloth Poison Meter */}
      <SlothPoisonBar />
      {/* Price Card */}
      <Card style={walletStyles.priceCard}>
        <View style={walletStyles.priceRow}>
          <Text style={walletStyles.priceLabel}>Kaspa Price</Text>
          {isStale && <Text style={walletStyles.staleText}>⚠️</Text>}
        </View>
        <Text style={walletStyles.priceValue}>
          {priceLoading ? '...' : formattedPrice}
        </Text>
      </Card>

      {/* Balance Card */}
      <Card style={walletStyles.balanceCard}>
        <Text style={walletStyles.balanceLabel}>Balance</Text>
        <Text style={walletStyles.balanceValue}>
          {kasBalance.toFixed(4)} KASPA
        </Text>
        {usdPerKas > 0 && (
          <Text style={walletStyles.usdValue}>≈ ${usdValue.toFixed(2)} USD</Text>
        )}
        <View style={walletStyles.xpRow}>
          <Zap size={rs.s(14)} color={COLORS.amber600} />
          <Text style={walletStyles.xpText}>{ds.loading ? '...' : ds.xp} XP</Text>
        </View>
      </Card>
    
    {/* Action Buttons */}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
    <View style={[walletStyles.actions, { paddingHorizontal: 4 }]}>
      {/* DASH_PUBKEY_BTN */}
      <TouchableOpacity style={[walletStyles.actionBtn, { borderRadius: 8 }]} onPress={async () => {
        try {
          const myPub = (await SecureStore.getItemAsync('kv_public_key'))
            || (await SecureStore.getItemAsync('kaspa_pubkey'))
            || (await SecureStore.getItemAsync('kv_l1_pubkey')) || '';
          if (myPub && /^0[23][0-9a-f]{64}$/i.test(myPub)) {
            await Clipboard.setStringAsync(myPub);
            Alert.alert('Copied', 'Your pubkey is copied. Share it with a counterparty to start a trade.');
          } else {
            Alert.alert('Not available', 'Your pubkey is not ready yet.');
          }
        } catch (e) { console.warn('[Dashboard][Pubkey] failed:', e); }
      }}>
        <Text style={walletStyles.actionIcon}>🔑</Text>
        <Text style={walletStyles.actionLabel}>My Pubkey</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[walletStyles.actionBtn, { backgroundColor: activeMode === 'real' ? '#10B981' : '#F59E0B', borderRadius: 8 }]} onPress={() => {
        console.log('[Toggle] onSwitchMode exists:', !!onSwitchMode);
        if (!onSwitchMode) { console.log('[Toggle] onSwitchMode is undefined!'); return; }
        const next = activeMode === 'tutorial' ? 'real' : 'tutorial';
        Alert.alert(
          next === 'real' ? 'Switch to Real Kaspa?' : 'Switch to Tutorial?',
          next === 'real' ? 'Transactions will use REAL Kaspa (mainnet).' : 'Switch to Tutorial mode (testnet). Free tKAS.',
          [{ text: 'Cancel', style: 'cancel' }, { text: next === 'real' ? 'Go Real' : 'Go Tutorial', onPress: () => onSwitchMode(next) }]
        );
      }}>
        <Text style={walletStyles.actionIcon}>{' '}</Text>
        <Text style={[walletStyles.actionLabel, { color: '#000' }]}>{activeMode === 'real' ? 'Real Kaspa' : 'Tutorial'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={walletStyles.actionBtn} onPress={onDeposit}>
        <Text style={walletStyles.actionIcon}>⬇️</Text>
        <Text style={walletStyles.actionLabel}>Receive</Text>
      </TouchableOpacity>
      <TouchableOpacity style={walletStyles.actionBtn} onPress={onSend}>
        <Text style={walletStyles.actionIcon}>📤</Text>
        <Text style={walletStyles.actionLabel}>Send</Text>
      </TouchableOpacity>
      <TouchableOpacity style={walletStyles.actionBtn} onPress={onPayNearby}>
        <Text style={walletStyles.actionIcon}>📡</Text>
        <Text style={walletStyles.actionLabel}>Pay Nearby</Text>
      </TouchableOpacity>
      <TouchableOpacity style={walletStyles.actionBtn} onPress={onNavigateProfile}>
        <Text style={walletStyles.actionIcon}>{' '}</Text>
        <Text style={walletStyles.actionLabel}>Profile</Text>
      </TouchableOpacity>
      <TouchableOpacity style={walletStyles.actionBtn} onPress={() => onNavigateTxHistory?.()}>
        <Text style={walletStyles.actionIcon}>{' '}</Text>
        <Text style={walletStyles.actionLabel}>History</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={walletStyles.actionBtn} onPress={() => {
        require('react-native').Linking.openURL('https://www.kraken.com/prices/kaspa');
      }}>
        <Text style={walletStyles.actionIcon}>{' '}</Text>
        <Text style={walletStyles.actionLabel}>Buy Kaspa</Text>
      </TouchableOpacity>
      <TouchableOpacity style={walletStyles.actionBtn} onPress={() => {
        require('react-native').Alert.alert(
          'Cash Out to USD',
          '1. Send KAS to your Kraken account\n2. Sell KAS for USD on Kraken\n3. Withdraw USD to your bank\n\nDa Village never holds your funds.',
          [
            { text: 'Open Kraken', onPress: () => require('react-native').Linking.openURL('https://www.kraken.com/prices/kaspa') },
            { text: 'Send KAS', onPress: () => onSend?.() },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      }}>
        <Text style={walletStyles.actionIcon}>{' '}</Text>
        <Text style={walletStyles.actionLabel}>Cash Out</Text>
      </TouchableOpacity>
      <TouchableOpacity style={walletStyles.actionBtn} onPress={() => { console.log('[PP] pressed', !!onNavigatePhoneProof); onNavigatePhoneProof?.(); }}>
        <Text style={walletStyles.actionIcon}>{' '}</Text>
        <Text style={walletStyles.actionLabel}>Phone Proof</Text>
      </TouchableOpacity>
      <TouchableOpacity style={walletStyles.actionBtn} onPress={onNavigateNeighbor}>
        <Text style={walletStyles.actionIcon}>{' '}</Text>
        <Text style={walletStyles.actionLabel}>Agreement</Text>
      </TouchableOpacity>
      <TouchableOpacity style={walletStyles.actionBtn} onPress={() => onNavigateBalanceSheet?.()}>
        <Text style={walletStyles.actionIcon}>{' '}</Text>
        <Text style={walletStyles.actionLabel}>Balance Sheet</Text>
      </TouchableOpacity>
    </View>
    </ScrollView>
    


    {/* Financial Summary — UTXO ledger tagged breakdown */}
    <Card variant="green" style={walletStyles.statsCard}>
      <Text style={walletStyles.statsTitle}>
        {ds.loading ? 'Loading Financial Summary…' : 'Financial Summary'}
      </Text>
      <View style={{ marginTop: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
          <Text style={{ color: "#888", fontSize: 13 }}>Total On-Chain</Text>
          <Text style={{ color: "#D4AF37", fontSize: 13, fontWeight: "bold" }}>{(Number(ds.totalBalanceSompi) / 1e8).toFixed(4)} KASPA</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
          <Text style={{ color: "#888", fontSize: 13 }}>Collateral (FROST)</Text>
          <Text style={{ color: "#E67E22", fontSize: 13 }}>{((Number(ds.totalBalanceSompi || 0) - Number(ds.spendableBalanceSompi || 0)) / 1e8).toFixed(4)} KASPA</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
          <Text style={{ color: "#888", fontSize: 13 }}>IOU-Backed UTXOs</Text>
          <Text style={{ color: "#E67E22", fontSize: 13 }}>{(Number(ds.iouAllocatedSompi) / 1e8).toFixed(4)} KASPA</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
          <Text style={{ color: "#888", fontSize: 13 }}>IOUs You Owe (net)</Text>
          <Text style={{ color: "#E74C3C", fontSize: 13 }}>{(Number(ds.iousOwedSompi) / 1e8).toFixed(4)} KASPA</Text>
        </View>
        {ds.pendingProposals > 0 && (
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
          <Text style={{ color: "#888", fontSize: 13 }}>Pending Proposals</Text>
          <Text style={{ color: "#F59E0B", fontSize: 13, fontWeight: "bold" }}>{ds.pendingProposals}</Text>
        </View>
        )}
        {ds.acceptedProposals > 0 && (
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
          <Text style={{ color: "#888", fontSize: 13 }}>Active Agreements</Text>
          <Text style={{ color: "#10B981", fontSize: 13, fontWeight: "bold" }}>{ds.acceptedProposals}</Text>
        </View>
        )}
        <View style={{ height: 1, backgroundColor: "#333", marginVertical: 8 }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
          <Text style={{ color: "#888", fontSize: 14, fontWeight: "bold" }}>Spendable (free UTXOs)</Text>
          <Text style={{ color: "#27AE60", fontSize: 14, fontWeight: "bold" }}>{((Number(ds.spendableBalanceSompi || 0) - Number(ds.iousOwedSompi || 0)) / 1e8).toFixed(4)} KASPA</Text>
        </View>
        <View style={{ height: 1, backgroundColor: "#333", marginVertical: 8 }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
          <Text style={{ color: "#888", fontSize: 13 }}>IOUs Owed to You</Text>
          <Text style={{ color: "#27AE60", fontSize: 13 }}>+{(Number(ds.iousOwedToYouSompi) / 1e8).toFixed(4)} KASPA</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
          <Text style={{ color: "#888", fontSize: 13 }}>Agreement Returns</Text>
          <Text style={{ color: "#27AE60", fontSize: 13 }}>+{(Number(ds.agreementReturnsSompi) / 1e8).toFixed(4)} KASPA</Text>
        </View>
        <View style={{ height: 1, backgroundColor: "#333", marginVertical: 8 }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
          <Text style={{ color: "#D4AF37", fontSize: 14, fontWeight: "bold" }}>Potential Balance</Text>
          <Text style={{ color: "#D4AF37", fontSize: 14, fontWeight: "bold" }}>{((Number(ds.totalBalanceSompi) + Number(ds.iousOwedToYouSompi) + Number(ds.agreementReturnsSompi)) / 1e8).toFixed(4)} KASPA</Text>
        </View>
        <View style={{ height: 1, backgroundColor: "#555", marginVertical: 8 }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
          <Text style={{ color: "#888", fontSize: 13 }}>Total Sent ({ds.sendCount})</Text>
          <Text style={{ color: "#E74C3C", fontSize: 13 }}>-{(Number(ds.totalSentSompi) / 1e8).toFixed(4)} KASPA</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
          <Text style={{ color: "#888", fontSize: 13 }}>Total Received ({ds.receiveCount})</Text>
          <Text style={{ color: "#27AE60", fontSize: 13 }}>+{(Number(ds.totalReceivedSompi) / 1e8).toFixed(4)} KASPA</Text>
        </View>
      </View>
    </Card>

    {/* Village Stats — TownHall Bayesian + Arweave data */}
    <Card variant="green" style={walletStyles.statsCard}>
      <Text style={walletStyles.statsTitle}>
        {ds.loading ? 'Loading Stats\u2026' : 'Your Stats'}
      </Text>
      {/* Bayesian Trust Gauge */}
      <BayesianGauge
        score={ds.bayesianScore}
        confidence={ds.bayesianConfidence}
        riskRating={ds.townhallRiskRating}
        online={ds.townhallOnline}
        loading={ds.loading}
      />
      {/* Enhanced Bayesian factor badges */}
      {ds.enhancedFactors && !ds.loading && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: rs.s(4), marginBottom: rs.s(8) }}>
          {ds.enhancedFactors.recencyFactor > 1 && (
            <Text style={{ fontSize: rs.font(9), color: '#22c55e', backgroundColor: '#f0fdf4', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' }}>Active</Text>
          )}
          {ds.enhancedFactors.recencyFactor < 1 && (
            <Text style={{ fontSize: rs.font(9), color: '#f97316', backgroundColor: '#fff7ed', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' }}>Stale</Text>
          )}
          {ds.enhancedFactors.patternPenalty < 1 && (
            <Text style={{ fontSize: rs.font(9), color: '#ef4444', backgroundColor: '#fef2f2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' }}>Pattern</Text>
          )}
          {ds.enhancedFactors.resolutionBonus > 1 && (
            <Text style={{ fontSize: rs.font(9), color: '#3b82f6', backgroundColor: '#eff6ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' }}>Recovered</Text>
          )}
          {ds.enhancedFactors.speedFactor > 1 && (
            <Text style={{ fontSize: rs.font(9), color: '#8b5cf6', backgroundColor: '#f5f3ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' }}>Fast</Text>
          )}
          {ds.enhancedFactors.speedFactor < 1 && (
            <Text style={{ fontSize: rs.font(9), color: '#f97316', backgroundColor: '#fff7ed', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' }}>Slow</Text>
          )}
        </View>
      )}
      <View style={walletStyles.statsRow}>
        <View style={walletStyles.statItem}>
          <Text style={walletStyles.statValue}>{ds.xp >= 2000 ? "Archon" : ds.xp >= 1000 ? "Sentinel" : ds.xp >= 500 ? "Custodian" : ds.xp >= 200 ? "Verified" : "Base"}</Text>
          <Text style={walletStyles.statLabel}>Tier</Text>
        </View>
        <View style={walletStyles.statItem}>
          <Text style={walletStyles.statValue}>{ds.xp}</Text>
          <Text style={walletStyles.statLabel}>XP</Text>
        </View>
        <View style={walletStyles.statItem}>
          <Text style={walletStyles.statValue}>{ds.agreementsCompleted > 0 ? (ds.pComplete >= 0.9 ? "Low" : ds.pComplete >= 0.7 ? "Med" : "High") : "Unknown"}</Text>
          <Text style={walletStyles.statLabel}>Risk Rating</Text>
        </View>
      </View>
      <View style={[walletStyles.statsRow, { marginTop: 8 }]}>
        <View style={walletStyles.statItem}>
          <Text style={walletStyles.statValue}>{ds.agreementsCompleted}</Text>
          <Text style={walletStyles.statLabel}>Completed</Text>
        </View>
        <View style={walletStyles.statItem}>
          <Text style={walletStyles.statValue}>{ds.deadlocks}</Text>
          <Text style={walletStyles.statLabel}>Deadlocks</Text>
        </View>
        <View style={walletStyles.statItem}>
          <Text style={walletStyles.statValue}>{ds.agreementsCompleted > 0 ? (ds.pComplete * 100).toFixed(1) + '%' : 'N/A'}</Text>
          <Text style={walletStyles.statLabel}>P(Complete)</Text>
        </View>
      </View>
      <View style={[walletStyles.statsRow, { marginTop: 8 }]}>
        <View style={walletStyles.statItem}>
          <Text style={walletStyles.statValue}>{ds.storefronts}</Text>
          <Text style={walletStyles.statLabel}>Storefronts</Text>
        </View>
        <View style={walletStyles.statItem}>
          <Text style={walletStyles.statValue}>{(ds.totalVolumeSompi / 1e8).toFixed(2)}</Text>
          <Text style={walletStyles.statLabel}>Volume (KAS)</Text>
        </View>
        <View style={walletStyles.statItem}>
          <Text style={[walletStyles.statValue, ds.isSnailPoison ? { color: COLORS.red600 } : {}]}>{ds.isSnailPoison ? "Yes" : "No"}</Text>
          <Text style={walletStyles.statLabel}>Snail Poison</Text>
        </View>
      </View>
      <View style={[walletStyles.statsRow, { marginTop: 8 }]}>
        <View style={walletStyles.statItem}>
          <Text style={walletStyles.statValue}>{ds.sendCount}</Text>
          <Text style={walletStyles.statLabel}>Sends</Text>
        </View>
        <View style={walletStyles.statItem}>
          <Text style={walletStyles.statValue}>{ds.receiveCount}</Text>
          <Text style={walletStyles.statLabel}>Receives</Text>
        </View>
        <View style={walletStyles.statItem}>
          <Text style={walletStyles.statValue}>{ds.sendCount + ds.receiveCount}</Text>
          <Text style={walletStyles.statLabel}>Total TXs</Text>
        </View>
      </View>
    </Card>
    </View>
  );
};

const walletStyles = StyleSheet.create({
  container: {
    padding: rs.s(16),
    gap: rs.s(16),
  },
  priceCard: {
    alignItems: 'center',
    backgroundColor: COLORS.amber50,
    borderColor: COLORS.amber200,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(4),
  },
  priceLabel: {
    fontSize: rs.font(10),
    color: COLORS.amber700,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  priceValue: {
    fontSize: rs.font(20),
    fontWeight: '900',
    color: COLORS.amber800,
    marginTop: rs.s(4),
  },
  staleText: {
    fontSize: rs.font(12),
  },
  usdValue: {
    fontSize: rs.font(12),
    color: COLORS.stone400,
    marginTop: rs.s(2),
  },
  balanceCard: {
    alignItems: 'center',
    backgroundColor: COLORS.stone800,
    borderColor: COLORS.stone700,
  },
  balanceLabel: {
    fontSize: rs.font(12),
    color: COLORS.stone400,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  balanceValue: {
    fontSize: rs.font(32),
    fontWeight: '900',
    color: '#fff',
    marginVertical: rs.s(8),
  },
  xpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(4),
  },
  xpText: {
    fontSize: rs.font(14),
    color: COLORS.amber600,
    fontWeight: 'bold',
  },
  actions: {
    flexDirection: 'row',
  },
  actionBtn: {
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    paddingVertical: rs.s(16),
    paddingHorizontal: rs.s(24),
    borderRadius: rs.s(16),
    borderWidth: 1,
    borderColor: COLORS.stone200,
  },
  actionIcon: {
    fontSize: rs.font(24),
  },
  actionLabel: {
    fontSize: rs.font(12),
    fontWeight: 'bold',
    color: COLORS.stone700,
    marginTop: rs.s(4),
  },
  statsCard: {
    marginTop: rs.s(8),
  },
  statsTitle: {
    fontSize: rs.font(12),
    fontWeight: '900',
    color: COLORS.green600,
    textTransform: 'uppercase',
    marginBottom: rs.s(12),
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: rs.font(18),
    fontWeight: '900',
    color: COLORS.stone800,
  },
  statLabel: {
    fontSize: rs.font(10),
    color: COLORS.stone500,
    marginTop: rs.s(2),
  },
});

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================
interface DashboardProps {
  onNavigateBalanceSheet?: () => void;
  user: {
    apartment: string;
    xp: number;
    pubkey?: string;
  };
  balance: number;
  isSnailMode?: boolean;
  isEliteMode?: boolean;
  snailThreshold?: number;
  navigation?: any;
  onNavigateMailbox?: () => void;
  onNavigateWorkspace?: () => void;
  onNavigateEntertainment?: () => void;
  onNavigateProfile?: () => void;
  onNavigateNeighbor?: () => void;
  onNavigateSendKas?: () => void;
  onNavigateTownHall?: () => void;
  onNavigatePayNearby?: () => void;
  onNavigateBathroom?: () => void;
  onNavigateReceive?: () => void;
  onNavigateTxHistory?: () => void;
  onNavigatePhoneProof?: () => void;
  onNavigatePOBox?: () => void;
  activeMode?: 'tutorial' | 'real';
  onSwitchMode?: (mode: 'tutorial' | 'real') => void;
  balanceSompi?: bigint;
}


export const Dashboard: React.FC<DashboardProps> = ({
  user,
  balance,
  isSnailMode = false,
  isEliteMode = false,
  snailThreshold = 150,
  navigation,
  onNavigateMailbox,
  onNavigateWorkspace,
  onNavigateEntertainment,
  onNavigateProfile,
  onNavigateNeighbor,
  onNavigateSendKas,
  onNavigateTownHall,
  onNavigatePayNearby,
  onNavigateBathroom,
  onNavigateReceive,
  onNavigateTxHistory,
  onNavigatePOBox,
  onNavigatePhoneProof,
  onNavigateBalanceSheet,
  activeMode = 'tutorial',
  onSwitchMode,
  balanceSompi = 0n,
}) => {

  const [activeTab, setActiveTab] = useState<'wallet' | 'mailbox' | 'workspace' | 'bathroom'>('wallet');
  const [avatarConfig, setAvatarConfig] = useState<{ race: string; class: string; occupation: string; name: string; gender?: string } | null>(null);
  const [kaspaAddress, setKaspaAddress] = useState<string>('');

  // ---- REAL DATA HOOK ----
  const ds = useDashboardStats(user.pubkey, balanceSompi, user.xp);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const str = await SecureStore.getItemAsync("kv_avatar_recipe");
        if (str) {
          const r = JSON.parse(str);
          setAvatarConfig({ race: r.race || "human", class: r.class || "Warrior", occupation: r.occupation || "", name: r.name || "", gender: r.gender || "" });
        }
        const addr = await SecureStore.getItemAsync("kaspa_address");
        if (addr) setKaspaAddress(addr);
      } catch {}
    };
    loadConfig();
  }, []);
  const [refreshing, setRefreshing] = useState(false);
  
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await ds.refresh();
    setRefreshing(false);
  }, [ds.refresh]);
  
  const handleSend = useCallback(() => {
    onNavigateSendKas?.();
  }, [onNavigateSendKas]);
  
  const handleTownHall = useCallback(() => {
    onNavigateTownHall?.();
  }, [onNavigateTownHall]);
  
  return (
    <DynamicBackground activeTab={activeTab} avatarConfig={avatarConfig || undefined}>
      <View style={dashStyles.container}>
        {/* Status Banners */}
        {isSnailMode && <SnailModeBanner threshold={snailThreshold} />}
        {isEliteMode && <EliteModeBanner />}
        
        {/* Header */}
        <ChessboardHeader 
          apartment={user.apartment}
          isSnailMode={isSnailMode}
          isEliteMode={isEliteMode}
          network={activeMode === 'real' ? 'mainnet' : 'testnet-10'}
          activeMode={activeMode}
          onSwitchMode={onSwitchMode}
        />
        
        {/* Main Content */}
        <ScrollView
          style={dashStyles.scrollView}
          contentContainerStyle={dashStyles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.amber600}
            />
          }
        >
          {activeTab === 'wallet' && (
            <WalletOverview
              balance={balance}
              balanceSompi={balanceSompi}
              xp={user.xp}
              ds={ds}
              onDeposit={() => onNavigateReceive?.()}
              onWithdraw={() => onNavigateSendKas?.()}
              onSend={handleSend}
              onNavigateProfile={onNavigateProfile}
              activeMode={activeMode}
              onSwitchMode={onSwitchMode}
              onNavigateNeighbor={onNavigateNeighbor}
              onNavigateTxHistory={onNavigateTxHistory}
              onNavigatePOBox={onNavigatePOBox}
              onNavigatePhoneProof={onNavigatePhoneProof}
              onNavigateBalanceSheet={onNavigateBalanceSheet}
              onPayNearby={() => onNavigatePayNearby?.()}
            />
          )}
          
          {activeTab === 'mailbox' && (
            <TouchableOpacity style={dashStyles.placeholder} onPress={onNavigateMailbox} activeOpacity={0.7}>
              <Text style={dashStyles.placeholderText}>📬 Village / Mailbox</Text>
              <Text style={dashStyles.placeholderSub}>Browse storefronts, coupons, DApps</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity
                  style={{ backgroundColor: '#D4AF37', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 }}
                  onPress={onNavigateMailbox}
                >
                  <Text style={{ color: '#1A1A1A', fontWeight: 'bold' }}>Browse Storefronts</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ backgroundColor: '#4A90D9', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 }}
                  onPress={onNavigateEntertainment}
                >
                  <Text style={{ color: '#FFF', fontWeight: 'bold' }}>DApps</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={{ backgroundColor: '#4CAF50', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, marginTop: 8 }}
                onPress={onNavigateNeighbor}
              >
                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>🤝 New Trade Agreement</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          
          {activeTab === 'workspace' && (
            <TouchableOpacity style={dashStyles.placeholder} onPress={onNavigateWorkspace} activeOpacity={0.7}>
              <Text style={dashStyles.placeholderText}>🔧 Workspace</Text>
              <Text style={dashStyles.placeholderSub}>Build your storefront, manage listings</Text>
              <TouchableOpacity
                style={{ backgroundColor: '#D4AF37', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, marginTop: 12 }}
                onPress={onNavigateWorkspace}
              >
                <Text style={{ color: '#1A1A1A', fontWeight: 'bold' }}>Open Workspace</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          
          {activeTab === 'bathroom' && (
            <TouchableOpacity style={dashStyles.placeholder} onPress={onNavigateProfile} activeOpacity={0.7}>
              <Text style={dashStyles.placeholderText}>🪞 Bathroom Mirror</Text>
              <Text style={dashStyles.placeholderSub}>View your avatar, trade history, reputation</Text>
              <TouchableOpacity
                style={{ backgroundColor: '#9932CC', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, marginTop: 12 }}
                onPress={onNavigateProfile}
              >
                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>View Profile</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        </ScrollView>
        
        {/* Bottom Navigation */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.cardBg, borderTopWidth: 2, borderTopColor: COLORS.amber100 }} contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', paddingVertical: rs.s(16), paddingBottom: rs.s(32), paddingHorizontal: 8 }}>
          <NavButton 
            active={activeTab === 'wallet'} 
            icon={Wallet} 
            label="Wallet" 
            onPress={() => setActiveTab('wallet')} 
          />
          <NavButton 
            active={activeTab === 'mailbox'} 
            icon={Mail} 
            label="Village" 
            onPress={() => onNavigateMailbox?.()} 
          />
          <NavButton 
            active={activeTab === 'workspace'} 
            icon={Store} 
            label="🔧 Workspace" 
            onPress={() => onNavigateWorkspace?.()} 
          />
          <NavButton 
            active={activeTab === 'bathroom'} 
            icon={Scale} 
            label="🪞 Mirror" 
            onPress={() => onNavigateBathroom?.()} 
          />
          <NavButton 
            active={false} 
            icon={ShieldCheck} 
            label="🏛️ Town Hall" 
            onPress={handleTownHall} 
          />
        </ScrollView>
      </View>
    </DynamicBackground>
  );
};

const dashStyles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: rs.h(100), // Space for bottom nav
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: rs.s(24),
  },
  bottomNav: {},
  placeholder: {
    margin: rs.s(16),
    alignItems: 'center',
    paddingVertical: rs.s(48),
  },
  placeholderText: {
    fontSize: rs.font(24),
    fontWeight: '900',
    color: COLORS.stone800,
  },
  placeholderSub: {
    fontSize: rs.font(14),
    color: COLORS.stone500,
    marginTop: rs.s(8),
  },
});

export default memo(Dashboard);



