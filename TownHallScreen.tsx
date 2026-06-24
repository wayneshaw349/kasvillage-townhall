// ============================================================================
// KASVILLAGE EXPO - TOWN HALL SCREEN
// ============================================================================
// Town Hall features:
// - Verification search (check any APT/address/DApp/user stats)
// - SEND: Submit codebase/content for verification → Town Hall generates SNARK proof
// - RECEIVE: Download your verification proof from Arweave
// - User Stats verification (prove stats are real)
// - DApp/Store rule compliance verification
// - APT conflict resolution (same number → prompt change)
// - All verification events stored
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
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
  Modal,
  Linking,
} from 'react-native';
import Svg, {
  Rect,
  Circle,
  Path,
  G,
  Polygon,
  Ellipse,
  Line,
} from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import {
  Search,
  Shield,
  CheckCircle,
  XCircle,
  Copy,
  Download,
  Upload,
  Clock,
  AlertTriangle,
  ChevronRight,
  Building2,
  User,
  Package,
  GraduationCap,
  Wrench,
  Gamepad2,
  ExternalLink,
  FileCode,
  BarChart3,
  History,
  AlertCircle,
} from 'lucide-react-native';
import { deriveApt, deriveAptWithCheck, resolveAptToPubkey, verifyApt } from './apt_derivation';
import { lookupByAddress, lookupByApt, lookupCounterparty } from './counterparty_lookup';

const TOWNHALL_BASE = 'https://kasvillage.app.runonflux.io';

// ============================================================================
// RESPONSIVE SCALER
// ============================================================================
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
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
  // Sky
  skyBlue: '#87CEEB',
  skyLight: '#B0E0E6',
  
  // Building
  brickRed: '#B85450',
  brickDark: '#8B3A3A',
  roofNavy: '#2C3E50',
  roofDark: '#1A252F',
  columnGray: '#D3D3D3',
  columnLight: '#E8E8E8',
  windowBeige: '#F5F5DC',
  windowFrame: '#D2B48C',
  doorNavy: '#2C3E50',
  
  // Grass
  grassGreen: '#5D8A4A',
  grassLight: '#6B9B59',
  
  // Trees
  treeGreen: '#4A7C3F',
  treeDark: '#3A6830',
  trunk: '#8B4513',
  
  // Clouds
  cloudWhite: '#FFFFFF',
  cloudGray: '#F0F0F0',
  
  // UI
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
  
  amber100: '#fef3c7',
  amber500: '#f59e0b',
  amber600: '#d97706',
  amber700: '#b45309',
  amber800: '#92400e',
  
  green500: '#22c55e',
  green600: '#16a34a',
  green700: '#15803d',
  
  red500: '#ef4444',
  red600: '#dc2626',
  
  indigo500: '#6366f1',
  indigo600: '#4f46e5',
};

// ============================================================================
// TYPES
// ============================================================================
interface TownHallScreenProps {
  onClose?: () => void;
}

interface VerificationResult {
  found: boolean;
  type?: 'apt' | 'address' | 'dapp' | 'store' | 'academic' | 'service' | 'stats';
  verified?: boolean;
  aptNumber?: string;
  address?: string;
  name?: string;
  traits?: number;
  arweaveTx?: string;
  isOwner?: boolean;
  error?: string;
  // Stats verification
  xp?: number;
  pComplete?: number;
  successes?: number;
  deadlocks?: number;
  statsProofTx?: string;
  // Rule compliance
  rulesFollowed?: boolean;
  violations?: string[];
}

interface VerificationEvent {
  id: string;
  type: 'dapp' | 'store' | 'academic' | 'service' | 'stats' | 'identity';
  name: string;
  status: 'pending' | 'verified' | 'rejected';
  arweaveTx?: string;
  timestamp: number;
}

interface SendVerificationRequest {
  type: 'dapp' | 'store' | 'academic' | 'service' | 'stats';
  name: string;
  codebaseUrl?: string;
  contentHash?: string;
  description?: string;
}

// APT conflict resolution
interface AptConflict {
  requestedApt: string;
  existingOwner: string;
  suggestedAlternatives: string[];
}

type AccessLevel = 'GUEST' | 'RESIDENT' | 'PASSPORT_ELIGIBLE' | 'VERIFIED_PASSPORT';

interface UserStats {
  xp: number;
  successes: number;
  deadlocks: number;
  totalTransactions: number;
}

// ============================================================================
// STATS LOOKUP COMPONENT (stub)
// ============================================================================
interface StatsResult {
  pubkey: string;
  apt: string;
  xp: number;
  pComplete: number;
  successes: number;
  deadlocks: number;
  platform?: string;
  lastAttested?: number;
  deviceHashPrefix?: string;
  attestationFound: boolean;
  proofTxId?: string;
  proofType?: string;
  l1EventsRoot?: string;
  proofVerified?: boolean;
  error?: string;
}

const StatsLookup: React.FC<{ myApt: string | null; myAddress: string | null; myPubkey?: string | null }> = ({ myApt, myAddress, myPubkey }) => {
  const [lookupQuery, setLookupQuery] = useState('');
  const [isLooking, setIsLooking] = useState(false);
  const [result, setResult] = useState<StatsResult | null>(null);

  const handleLookup = async () => {
    const q = lookupQuery.trim();
    if (!q) return;
    setIsLooking(true);
    setResult(null);

    try {
      let lookupResult: { pubkey: string | null; stats: any } | null = null;

      if (q.toLowerCase().startsWith('kaspa:')) {
        // Address lookup → Arweave KV-Address tag → pubkey → stats
        lookupResult = await lookupByAddress(q);
      } else {
        // APT lookup: check self first, then Arweave
        const aptNum = q.replace(/^APT-/i, '');
        const myAptNum = (myApt || '').replace(/^APT-/i, '');
        if (aptNum === myAptNum && myPubkey) {
          console.log('[StatsLookup] Self-lookup via /user-stats');
          const res = await fetch('https://kasvillage.app.runonflux.io/user-stats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pubkey: myPubkey }) });
          if (res.ok) { lookupResult = { pubkey: myPubkey, stats: await res.json() }; }
        } else {
          lookupResult = await lookupByApt(aptNum);
        }
      }

      if (lookupResult?.pubkey && lookupResult?.stats) {
        const s = lookupResult.stats;
        
        // Parallel attestation query
        let platform = '';
        let lastAttested = 0;
        let deviceHashPrefix = '';
        let attestationFound = false;
        try {
          const attQuery = `{
            transactions(
              tags: [
                { name: "App-Name", values: ["KasVillage"] },
                { name: "KV-Type", values: ["device-attestation"] },
                { name: "KV-Pubkey", values: ["${lookupResult.pubkey}"] }
              ],
              sort: HEIGHT_DESC,
              first: 1
            ) {
              edges { node { tags { name value } } }
            }
          }`;
          const attRes = await fetch('https://arweave.net/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: attQuery }),
          });
          if (attRes.ok) {
            const attData = await attRes.json();
            const attTags = attData?.data?.transactions?.edges?.[0]?.node?.tags;
            if (attTags) {
              attestationFound = true;
              for (const tag of attTags) {
                if (tag.name === 'KV-Platform') platform = tag.value;
                if (tag.name === 'KV-DeviceHash') deviceHashPrefix = tag.value.slice(0, 8);
              }
              // Get timestamp from attestation payload or block time
              const tsTag = attTags.find((t: {name: string}) => t.name === 'KV-Timestamp');
              if (tsTag) lastAttested = parseInt(tsTag.value, 10);
            }
          }
        } catch (e) {
          console.warn('[StatsLookup] Attestation query failed:', e);
        }

        // Query Arweave for stats proof
        let proofTxId = "";
        let proofType = "";
        let l1EventsRoot = "";
        let proofVerified = false;
        try {
          const proofGql = JSON.stringify({ query: `{transactions(tags:[{name:"App-Name",values:["KasVillage"]},{name:"KV-Type",values:["stats-proof"]},{name:"KV-Pubkey",values:["${lookupResult.pubkey}"]}],first:1,sort:HEIGHT_DESC){edges{node{id tags{name value}}}}}` });
          const proofRes = await fetch('https://arweave.net/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: proofGql });
          if (proofRes.ok) {
            const proofData = await proofRes.json();
            const proofEdge = proofData?.data?.transactions?.edges?.[0];
            if (proofEdge) {
              proofTxId = proofEdge.node.id;
              proofVerified = true;
              const tags = proofEdge.node.tags || [];
              proofType = tags.find((t: any) => t.name === 'KV-ProofType')?.value || 'Halo2-IPA';
            }
          }
        } catch (e) { console.warn('[StatsLookup] Proof query failed:', e); }

        setResult({
          pubkey: lookupResult.pubkey,
          apt: 'APT-' + deriveApt(lookupResult.pubkey),
          xp: s.xp ?? 250,
          pComplete: s.p_complete ?? s.pComplete ?? 0.5,
          successes: s.successes ?? 0,
          deadlocks: s.deadlocks ?? 0,
          platform,
          lastAttested,
          deviceHashPrefix,
          attestationFound,
          proofTxId,
          proofType,
          l1EventsRoot,
          proofVerified,
        });
      } else {
        setResult({ pubkey: '', apt: '', xp: 0, pComplete: 0, successes: 0, deadlocks: 0, attestationFound: false, error: 'Not found — user may not have completed a transaction yet' });
      }
    } catch (e) {
      console.error('[StatsLookup]', e);
      setResult({ pubkey: '', apt: '', xp: 0, pComplete: 0, successes: 0, deadlocks: 0, attestationFound: false, error: 'Lookup failed' });
    }

    setIsLooking(false);
  };

  // Bayesian reputation: (1 + successes) / (2 + successes + deadlocks)
  const bayesianScore = result && !result.error
    ? ((1 + result.successes) / (2 + result.successes + result.deadlocks) * 100).toFixed(1)
    : null;

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: rs.s(10) }}>
        <TextInput
          style={[styles.searchInput, { flex: 1 }]}
          value={lookupQuery}
          onChangeText={setLookupQuery}
          placeholder="APT-11167863 or kaspa:..."
          placeholderTextColor={COLORS.stone400}
          onSubmitEditing={handleLookup}
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleLookup} disabled={isLooking}>
          {isLooking ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Search size={rs.s(20)} color={COLORS.white} />
          )}
        </TouchableOpacity>
      </View>

      {result && !result.error && (
        <View style={{
          marginTop: rs.s(12),
          padding: rs.s(12),
          backgroundColor: COLORS.stone100,
          borderRadius: rs.s(8),
          borderWidth: 1,
          borderColor: COLORS.stone200,
        }}>
          <Text style={{ fontSize: rs.font(13), color: COLORS.stone500, marginBottom: rs.s(4) }}>
            {result.apt}
          </Text>
          <Text style={{ fontSize: rs.font(11), color: COLORS.stone400, marginBottom: rs.s(8) }} numberOfLines={1}>
            {result.pubkey.slice(0, 16)}...{result.pubkey.slice(-8)}
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: rs.font(18), fontWeight: '900', color: COLORS.stone800 }}>{result.xp}</Text>
              <Text style={{ fontSize: rs.font(10), color: COLORS.stone500 }}>XP</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: rs.font(18), fontWeight: '900', color: COLORS.stone800 }}>{bayesianScore}%</Text>
              <Text style={{ fontSize: rs.font(10), color: COLORS.stone500 }}>Trust</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: rs.font(18), fontWeight: '900', color: COLORS.green600 }}>{result.successes}</Text>
              <Text style={{ fontSize: rs.font(10), color: COLORS.stone500 }}>Success</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: rs.font(18), fontWeight: '900', color: COLORS.amber600 }}>{result.deadlocks}</Text>
              <Text style={{ fontSize: rs.font(10), color: COLORS.stone500 }}>Deadlock</Text>
            </View>
          </View>
        </View>
      )}


      {result && !result.error && (
        <View style={{
          marginTop: rs.s(8),
          padding: rs.s(10),
          backgroundColor: result.attestationFound ? '#f0fdf4' : '#fef2f2',
          borderRadius: rs.s(6),
          borderWidth: 1,
          borderColor: result.attestationFound ? '#bbf7d0' : '#fecaca',
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: rs.font(12), fontWeight: '700', color: result.attestationFound ? '#166534' : '#991b1b' }}>
              {result.attestationFound ? '✓ Device attested' : '✗ No attestation'}
            </Text>
            {result.attestationFound && result.platform ? (
              <Text style={{ fontSize: rs.font(11), color: '#166534' }}>
                {result.platform === 'ios' ? '📱 iOS' : result.platform === 'android' ? '🤖 Android' : result.platform}
              </Text>
            ) : null}
          </View>
          {result.attestationFound && (
            <View style={{ marginTop: rs.s(4) }}>
              <Text style={{ fontSize: rs.font(10), color: (() => {
                if (!result.lastAttested) return COLORS.stone500;
                const daysAgo = Math.floor((Date.now() - result.lastAttested) / 86400000);
                if (daysAgo < 30) return '#16a34a';
                if (daysAgo < 180) return '#d97706';
                return '#dc2626';
              })() }}>
                {(() => {
                  if (!result.lastAttested) return 'Timestamp unavailable';
                  const daysAgo = Math.floor((Date.now() - result.lastAttested) / 86400000);
                  if (daysAgo < 1) return 'Verified today';
                  if (daysAgo < 30) return 'Verified ' + daysAgo + ' days ago';
                  if (daysAgo < 365) return 'Verified ' + Math.floor(daysAgo / 30) + ' months ago';
                  return 'Verified ' + Math.floor(daysAgo / 365) + '+ years ago';
                })()}
              </Text>
              {result.deviceHashPrefix ? (
                <Text style={{ fontSize: rs.font(9), color: COLORS.stone400, marginTop: 2 }}>
                  Device: {result.deviceHashPrefix}...
                </Text>
              ) : null}
            </View>
          )}
        </View>
      )}


      {result && !result.error && result.proofVerified && (
        <TouchableOpacity
          onPress={() => result.proofTxId && Linking.openURL("https://arweave.net/" + result.proofTxId)}
          style={{
            marginTop: rs.s(8),
            padding: rs.s(10),
            backgroundColor: '#f0fdf4',
            borderRadius: rs.s(6),
            borderWidth: 1,
            borderColor: '#bbf7d0',
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: rs.font(12), fontWeight: '700', color: '#166534' }}>
              🔒 SNARK Proof Verified
            </Text>
            <Text style={{ fontSize: rs.font(10), color: '#166534' }}>
              {result.proofType}
            </Text>
          </View>
          <Text style={{ fontSize: rs.font(9), color: COLORS.stone400, marginTop: rs.s(4) }}>
            TX: {result.proofTxId?.slice(0, 24)}... (tap to view on Arweave)
          </Text>
        </TouchableOpacity>
      )}

      {result && !result.error && !result.proofVerified && (
        <View style={{
          marginTop: rs.s(8),
          padding: rs.s(10),
          backgroundColor: '#fffbeb',
          borderRadius: rs.s(6),
          borderWidth: 1,
          borderColor: '#fde68a',
        }}>
          <Text style={{ fontSize: rs.font(12), fontWeight: '700', color: '#92400e' }}>
            ⚠️ No SNARK proof on Arweave
          </Text>
          <Text style={{ fontSize: rs.font(10), color: COLORS.stone500, marginTop: 2 }}>
            This user has not generated a verifiable stats proof yet
          </Text>
        </View>
      )}
      {result?.error && (
        <View style={{
          marginTop: rs.s(12),
          padding: rs.s(12),
          backgroundColor: '#fef2f2',
          borderRadius: rs.s(8),
          borderWidth: 1,
          borderColor: '#fecaca',
        }}>
          <Text style={{ fontSize: rs.font(13), color: '#991b1b' }}>{result.error}</Text>
        </View>
      )}
    </View>
  );
};

// ============================================================================
// PIXEL TOWN HALL BUILDING BACKGROUND
// ============================================================================
const TownHallBackground: React.FC = () => {
  const w = SCREEN_WIDTH;
  const h = SCREEN_HEIGHT * 0.45; // Building takes top 45%
  
  // Building dimensions
  const buildingW = w * 0.85;
  const buildingH = h * 0.55;
  const buildingX = (w - buildingW) / 2;
  const buildingY = h * 0.35;
  
  // Roof
  const roofH = h * 0.22;
  const roofY = buildingY - roofH + rs.s(10);
  
  // Portico (entrance)
  const porticoW = buildingW * 0.28;
  const porticoH = buildingH * 0.75;
  const porticoX = (w - porticoW) / 2;
  const porticoY = buildingY + buildingH - porticoH;
  
  // Columns
  const columnW = rs.s(14);
  const columnH = porticoH - rs.s(30);
  
  // Windows
  const windowW = rs.s(28);
  const windowH = rs.s(40);
  
  return (
    <View style={styles.backgroundContainer}>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        {/* Sky */}
        <Rect x="0" y="0" width={w} height={h} fill={COLORS.skyBlue} />
        
        {/* Clouds */}
        <G>
          {/* Cloud 1 - left */}
          <Ellipse cx={w * 0.15} cy={h * 0.15} rx={rs.s(45)} ry={rs.s(25)} fill={COLORS.cloudWhite} />
          <Ellipse cx={w * 0.1} cy={h * 0.18} rx={rs.s(35)} ry={rs.s(20)} fill={COLORS.cloudWhite} />
          <Ellipse cx={w * 0.22} cy={h * 0.17} rx={rs.s(40)} ry={rs.s(22)} fill={COLORS.cloudWhite} />
          
          {/* Cloud 2 - center */}
          <Ellipse cx={w * 0.55} cy={h * 0.1} rx={rs.s(50)} ry={rs.s(28)} fill={COLORS.cloudWhite} />
          <Ellipse cx={w * 0.48} cy={h * 0.12} rx={rs.s(38)} ry={rs.s(22)} fill={COLORS.cloudWhite} />
          <Ellipse cx={w * 0.63} cy={h * 0.11} rx={rs.s(42)} ry={rs.s(24)} fill={COLORS.cloudWhite} />
          
          {/* Cloud 3 - right */}
          <Ellipse cx={w * 0.85} cy={h * 0.18} rx={rs.s(48)} ry={rs.s(26)} fill={COLORS.cloudWhite} />
          <Ellipse cx={w * 0.78} cy={h * 0.2} rx={rs.s(36)} ry={rs.s(20)} fill={COLORS.cloudWhite} />
          <Ellipse cx={w * 0.92} cy={h * 0.19} rx={rs.s(40)} ry={rs.s(23)} fill={COLORS.cloudWhite} />
        </G>
        
        {/* Birds */}
        <G stroke={COLORS.black} strokeWidth="1.5" fill="none">
          <Path d={`M${w * 0.52} ${h * 0.08} Q${w * 0.54} ${h * 0.06} ${w * 0.56} ${h * 0.08}`} />
          <Path d={`M${w * 0.56} ${h * 0.08} Q${w * 0.58} ${h * 0.06} ${w * 0.60} ${h * 0.08}`} />
          <Path d={`M${w * 0.58} ${h * 0.12} Q${w * 0.60} ${h * 0.10} ${w * 0.62} ${h * 0.12}`} />
          <Path d={`M${w * 0.62} ${h * 0.12} Q${w * 0.64} ${h * 0.10} ${w * 0.66} ${h * 0.12}`} />
        </G>
        
        {/* Grass */}
        <Rect x="0" y={h * 0.85} width={w} height={h * 0.15} fill={COLORS.grassGreen} />
        <Rect x="0" y={h * 0.87} width={w} height={h * 0.13} fill={COLORS.grassLight} />
        
        {/* Main Building - Brick body */}
        <Rect
          x={buildingX}
          y={buildingY}
          width={buildingW}
          height={buildingH}
          fill={COLORS.brickRed}
        />
        
        {/* Brick texture lines */}
        {Array.from({ length: 8 }).map((_, i) => (
          <Line
            key={`brick-h-${i}`}
            x1={buildingX}
            y1={buildingY + (i + 1) * (buildingH / 9)}
            x2={buildingX + buildingW}
            y2={buildingY + (i + 1) * (buildingH / 9)}
            stroke={COLORS.brickDark}
            strokeWidth="1"
            opacity="0.3"
          />
        ))}
        
        {/* Roof */}
        <Polygon
          points={`
            ${buildingX - rs.s(10)},${buildingY + rs.s(5)}
            ${w / 2},${roofY}
            ${buildingX + buildingW + rs.s(10)},${buildingY + rs.s(5)}
          `}
          fill={COLORS.roofNavy}
        />
        
        {/* Roof texture */}
        {Array.from({ length: 6 }).map((_, i) => (
          <Line
            key={`roof-${i}`}
            x1={buildingX + rs.s(20) + i * rs.s(25)}
            y1={buildingY + rs.s(5) - i * rs.s(4)}
            x2={buildingX + rs.s(50) + i * rs.s(25)}
            y2={buildingY + rs.s(5) - i * rs.s(4) - rs.s(3)}
            stroke={COLORS.roofDark}
            strokeWidth="2"
            opacity="0.4"
          />
        ))}
        
        {/* Flag pole and flag */}
        <Line
          x1={w / 2}
          y1={roofY - rs.s(35)}
          x2={w / 2}
          y2={roofY}
          stroke={COLORS.columnGray}
          strokeWidth="3"
        />
        <Polygon
          points={`
            ${w / 2},${roofY - rs.s(35)}
            ${w / 2 + rs.s(20)},${roofY - rs.s(28)}
            ${w / 2},${roofY - rs.s(20)}
          `}
          fill={COLORS.brickRed}
        />
        
        {/* Clock on pediment */}
        <Circle cx={w / 2} cy={buildingY - rs.s(8)} r={rs.s(14)} fill={COLORS.cloudWhite} />
        <Circle cx={w / 2} cy={buildingY - rs.s(8)} r={rs.s(12)} fill={COLORS.white} stroke={COLORS.stone400} strokeWidth="1" />
        <Line x1={w / 2} y1={buildingY - rs.s(8)} x2={w / 2} y2={buildingY - rs.s(15)} stroke={COLORS.black} strokeWidth="2" />
        <Line x1={w / 2} y1={buildingY - rs.s(8)} x2={w / 2 + rs.s(6)} y2={buildingY - rs.s(5)} stroke={COLORS.black} strokeWidth="2" />
        
        {/* Portico pediment (triangle above entrance) */}
        <Polygon
          points={`
            ${porticoX - rs.s(8)},${porticoY + rs.s(5)}
            ${w / 2},${porticoY - rs.s(25)}
            ${porticoX + porticoW + rs.s(8)},${porticoY + rs.s(5)}
          `}
          fill={COLORS.columnLight}
        />
        <Polygon
          points={`
            ${porticoX},${porticoY + rs.s(5)}
            ${w / 2},${porticoY - rs.s(18)}
            ${porticoX + porticoW},${porticoY + rs.s(5)}
          `}
          fill={COLORS.columnGray}
        />
        
        {/* Columns */}
        {[0, 1, 2, 3].map((i) => {
          const colX = porticoX + (i === 0 ? rs.s(8) : i === 3 ? porticoW - rs.s(8) - columnW : porticoW * (i / 3));
          return (
            <G key={`col-${i}`}>
              <Rect
                x={colX}
                y={porticoY + rs.s(5)}
                width={columnW}
                height={columnH}
                fill={COLORS.columnLight}
              />
              {/* Column lines */}
              <Line
                x1={colX + columnW * 0.3}
                y1={porticoY + rs.s(10)}
                x2={colX + columnW * 0.3}
                y2={porticoY + columnH}
                stroke={COLORS.columnGray}
                strokeWidth="1"
              />
              <Line
                x1={colX + columnW * 0.7}
                y1={porticoY + rs.s(10)}
                x2={colX + columnW * 0.7}
                y2={porticoY + columnH}
                stroke={COLORS.columnGray}
                strokeWidth="1"
              />
            </G>
          );
        })}
        
        {/* Door */}
        <Rect
          x={w / 2 - rs.s(22)}
          y={buildingY + buildingH - rs.s(55)}
          width={rs.s(44)}
          height={rs.s(55)}
          fill={COLORS.doorNavy}
          rx={rs.s(3)}
        />
        {/* Door lights */}
        <Circle cx={w / 2 - rs.s(8)} cy={buildingY + buildingH - rs.s(25)} r={rs.s(3)} fill="#FFA500" />
        <Circle cx={w / 2 + rs.s(8)} cy={buildingY + buildingH - rs.s(25)} r={rs.s(3)} fill="#FFA500" />
        
        {/* Windows - Left side */}
        {[0, 1].map((row) => 
          [0, 1].map((col) => {
            const wx = buildingX + rs.s(18) + col * (windowW + rs.s(18));
            const wy = buildingY + rs.s(15) + row * (windowH + rs.s(12));
            return (
              <G key={`win-l-${row}-${col}`}>
                <Rect x={wx} y={wy} width={windowW} height={windowH} fill={COLORS.windowBeige} rx={rs.s(2)} />
                <Line x1={wx + windowW / 2} y1={wy} x2={wx + windowW / 2} y2={wy + windowH} stroke={COLORS.windowFrame} strokeWidth="2" />
                <Line x1={wx} y1={wy + windowH / 2} x2={wx + windowW} y2={wy + windowH / 2} stroke={COLORS.windowFrame} strokeWidth="2" />
                <Line x1={wx} y1={wy + windowH / 3} x2={wx + windowW} y2={wy + windowH / 3} stroke={COLORS.windowFrame} strokeWidth="1" />
                <Line x1={wx} y1={wy + windowH * 2 / 3} x2={wx + windowW} y2={wy + windowH * 2 / 3} stroke={COLORS.windowFrame} strokeWidth="1" />
              </G>
            );
          })
        )}
        
        {/* Windows - Right side */}
        {[0, 1].map((row) => 
          [0, 1].map((col) => {
            const wx = buildingX + buildingW - rs.s(18) - windowW - col * (windowW + rs.s(18));
            const wy = buildingY + rs.s(15) + row * (windowH + rs.s(12));
            return (
              <G key={`win-r-${row}-${col}`}>
                <Rect x={wx} y={wy} width={windowW} height={windowH} fill={COLORS.windowBeige} rx={rs.s(2)} />
                <Line x1={wx + windowW / 2} y1={wy} x2={wx + windowW / 2} y2={wy + windowH} stroke={COLORS.windowFrame} strokeWidth="2" />
                <Line x1={wx} y1={wy + windowH / 2} x2={wx + windowW} y2={wy + windowH / 2} stroke={COLORS.windowFrame} strokeWidth="2" />
                <Line x1={wx} y1={wy + windowH / 3} x2={wx + windowW} y2={wy + windowH / 3} stroke={COLORS.windowFrame} strokeWidth="1" />
                <Line x1={wx} y1={wy + windowH * 2 / 3} x2={wx + windowW} y2={wy + windowH * 2 / 3} stroke={COLORS.windowFrame} strokeWidth="1" />
              </G>
            );
          })
        )}
        
        {/* Trees - Left */}
        <G>
          {/* Tree 1 */}
          <Rect x={buildingX - rs.s(25)} y={h * 0.78} width={rs.s(8)} height={rs.s(20)} fill={COLORS.trunk} />
          <Ellipse cx={buildingX - rs.s(21)} cy={h * 0.72} rx={rs.s(18)} ry={rs.s(22)} fill={COLORS.treeGreen} />
          <Ellipse cx={buildingX - rs.s(25)} cy={h * 0.68} rx={rs.s(14)} ry={rs.s(18)} fill={COLORS.treeDark} />
          
          {/* Bush */}
          <Ellipse cx={buildingX + rs.s(8)} cy={h * 0.88} rx={rs.s(14)} ry={rs.s(10)} fill={COLORS.treeGreen} />
          
          {/* Tree 2 */}
          <Rect x={buildingX - rs.s(55)} y={h * 0.75} width={rs.s(10)} height={rs.s(25)} fill={COLORS.trunk} />
          <Ellipse cx={buildingX - rs.s(50)} cy={h * 0.65} rx={rs.s(22)} ry={rs.s(28)} fill={COLORS.treeDark} />
          <Ellipse cx={buildingX - rs.s(55)} cy={h * 0.60} rx={rs.s(18)} ry={rs.s(22)} fill={COLORS.treeGreen} />
        </G>
        
        {/* Trees - Right */}
        <G>
          {/* Tree 1 */}
          <Rect x={buildingX + buildingW + rs.s(17)} y={h * 0.78} width={rs.s(8)} height={rs.s(20)} fill={COLORS.trunk} />
          <Ellipse cx={buildingX + buildingW + rs.s(21)} cy={h * 0.72} rx={rs.s(18)} ry={rs.s(22)} fill={COLORS.treeGreen} />
          <Ellipse cx={buildingX + buildingW + rs.s(25)} cy={h * 0.68} rx={rs.s(14)} ry={rs.s(18)} fill={COLORS.treeDark} />
          
          {/* Bush */}
          <Ellipse cx={buildingX + buildingW - rs.s(8)} cy={h * 0.88} rx={rs.s(14)} ry={rs.s(10)} fill={COLORS.treeGreen} />
          
          {/* Tree 2 */}
          <Rect x={buildingX + buildingW + rs.s(45)} y={h * 0.75} width={rs.s(10)} height={rs.s(25)} fill={COLORS.trunk} />
          <Ellipse cx={buildingX + buildingW + rs.s(50)} cy={h * 0.65} rx={rs.s(22)} ry={rs.s(28)} fill={COLORS.treeDark} />
          <Ellipse cx={buildingX + buildingW + rs.s(55)} cy={h * 0.60} rx={rs.s(18)} ry={rs.s(22)} fill={COLORS.treeGreen} />
        </G>
        
        {/* Small bushes */}
        <Ellipse cx={porticoX - rs.s(15)} cy={h * 0.90} rx={rs.s(12)} ry={rs.s(8)} fill={COLORS.treeDark} />
        <Ellipse cx={porticoX + porticoW + rs.s(15)} cy={h * 0.90} rx={rs.s(12)} ry={rs.s(8)} fill={COLORS.treeDark} />
      </Svg>
    </View>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export const TownHallScreen: React.FC<TownHallScreenProps> = ({ onClose }) => {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<VerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [myAddress, setMyAddress] = useState<string | null>(null);
  const [myPubkey, setMyPubkey] = useState<string | null>(null);
  const [myApt, setMyApt] = useState<string | null>(null);
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('GUEST');
  const [traitCount, setTraitCount] = useState(0);
  const [isVerified, setIsVerified] = useState(false);
  useEffect(() => { SecureStore.getItemAsync('kv_townhall_verified').then(v => { if (v === 'true') setIsVerified(true); }); }, []);
  // Verification from Arweave, not local flag
  const [myStats, setMyStats] = useState<UserStats | null>(null);
  
  // Verification events history
  const [verificationEvents, setVerificationEvents] = useState<VerificationEvent[]>([]);
  
  // Send verification modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendType, setSendType] = useState<'dapp' | 'store' | 'stats'>('dapp');
  const [sendName, setSendName] = useState('');
  const [sendCodeUrl, setSendCodeUrl] = useState('');
  const [sendDescription, setSendDescription] = useState('');
  const [sendAddress, setSendAddress] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  // Receive proofs modal
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [myProofs, setMyProofs] = useState<VerificationEvent[]>([]);
  const [isLoadingProofs, setIsLoadingProofs] = useState(false);
  
  // APT conflict modal
  const [showAptConflict, setShowAptConflict] = useState(false);
  const [aptConflict, setAptConflict] = useState<AptConflict | null>(null);
  
  // Load user data
  useEffect(() => {
    const loadData = async () => {
      const pubkey = await SecureStore.getItemAsync('kv_public_key');
      const kaspaAddress = await SecureStore.getItemAsync('kaspa_address');
      // Count traits from avatar recipe (same as ProfileScreen)
      let traits = null;
      try {
        const recipeStr = await SecureStore.getItemAsync('kv_avatar_recipe');
        if (recipeStr) {
          const recipe = JSON.parse(recipeStr);
          const traitKeys = ['name','race','class','occupation','animal','originStory','formativeMemory','scenarioDesire','characterDescription','voiceLine','lifePhilosophy','powerSpike','signatureMove'];
          const filled = traitKeys.filter(k => recipe[k] && recipe[k].length > 0).length;
          traits = String(filled);
        }
      } catch {}
      
      if (pubkey) {
        setMyPubkey(pubkey);
        const { apt: derivedApt } = await deriveAptWithCheck(pubkey);
        setMyApt('APT-' + derivedApt);
        console.log('[TownHall] pubkey:', pubkey.slice(0, 10) + '... → APT-' + derivedApt);
      }
      if (kaspaAddress) setMyAddress(kaspaAddress);
      if (traits) setTraitCount(parseInt(traits, 10) || 0);
      
      // Load verification events from storage
      const eventsJson = await SecureStore.getItemAsync('kv_verification_events');
      if (eventsJson) {
        setVerificationEvents(JSON.parse(eventsJson));
      }
    };
    loadData();
  }, []);
  
  // Search for verification (APT, address, DApp, stats)
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setSearchResult(null);
    
    try {
      const query = searchQuery.trim();
      
      // Determine search type
      let searchType: 'apt' | 'address' | 'dapp' | 'store' | 'stats' = 'apt';
      if (query.toLowerCase().startsWith('kaspa:')) {
        searchType = 'address';
      } else if (query.toLowerCase().startsWith('dapp-') || query.toLowerCase().startsWith('game-')) {
        searchType = 'dapp';
      } else if (query.toLowerCase().startsWith('store-')) {
        searchType = 'store';
      } else if (query.toLowerCase().startsWith('stats-') || query.toLowerCase().includes('stats')) {
        searchType = 'stats';
      }
      
      // Route to correct endpoint based on search type
      const BASE = 'https://kasvillage.app.runonflux.io';
      let url = '';
      let method = 'GET';
      let body = undefined;
      
      const isApt = query.toUpperCase().startsWith('APT-') || /^\d{5,}$/.test(query);
      const isPubkey = /^[0-9a-fA-F]{64,66}$/.test(query);
      
      if (searchType === 'dapp') {
        url = isApt ? `${BASE}/api/dapp/apt/${query}` : `${BASE}/api/dapp/${query}`;
      } else if (searchType === 'store') {
        url = isApt ? `${BASE}/api/storefront/apt/${query}` : `${BASE}/api/storefront/${query}`;
      } else if (searchType === 'stats') {
        const id = query.replace(/^stats-/i, '');
        url = isApt ? `${BASE}/api/counterparty/apt/${id}` : `${BASE}/api/counterparty/${id}`;
      } else {
        // Default: APT or pubkey lookup
        url = isApt ? `${BASE}/api/counterparty/apt/${query}` : isPubkey ? `${BASE}/api/counterparty/${query}` : `${BASE}/api/counterparty/apt/APT-${query}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.ok !== false && !data.error) {
        // Map response to search result format
        const stats = data.stats || data;
        setSearchResult({
          found: true,
          type: searchType,
          verified: stats.citadel_tier !== 'guest',
          aptNumber: stats.apt_alias || query,
          address: stats.pubkey,
          name: stats.brand_name || stats.pubkey?.slice(0, 12),
          traits: 0,
          arweaveTx: stats.arweave_tx,
          isOwner: false,
          xp: stats.xp || 0,
          pComplete: stats.p_complete || 0.5,
          successes: stats.successes || 0,
          deadlocks: stats.deadlocks || 0,
          statsProofTx: undefined,
          rulesFollowed: true,
          violations: [],
        });
      } else {
        setSearchResult({
          found: false,
          error: data.error || 'Not found',
        });
      }
    } catch (error) {
      setSearchResult({
        found: false,
        error: 'Search failed. Try again.',
      });
    }
    
    setIsSearching(false);
  };
  
  // SEND: Submit content for verification
  const handleSendVerification = async () => {
    if (!sendName.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    
    if (sendType === 'dapp' && !sendCodeUrl.trim()) {
      Alert.alert('Error', 'Code URL is required for DApp verification');
      return;
    }
    
    setIsSending(true);
    
    try {
      let payload: any;
      
      if (sendType === 'dapp') {
        payload = {
          owner_pubkey: myPubkey || '',
          apt_number: myApt || '',
          dapp_name: sendName,
          dapp_code: '', // Code fetched by TownHall from URL
          dapp_url: sendCodeUrl,
          category: 'UtilityTool',
          xp_commitment: 500,
          trait_count: traitCount,
          signature: 'self-attest',
          device_attestation: 'pending',
        };
      } else if (sendType === 'store') {
        payload = {
          owner_pubkey: myPubkey || '',
          apt_number: myApt || '',
          name: sendName,
          description: sendDescription,
          signature: 'self-attest',
        };
      } else {
        // Stats verification
        payload = {
          owner_pubkey: myPubkey || '',
          apt_number: myApt || '',
          stats: myStats || { xp: 0, successes: 0, deadlocks: 0, total_transactions: 0, created_at: 0, last_active_at: Date.now() },
          stats_signature: 'self-attest',
          device_attestation: 'pending',
        };
      }
      
      let response;
      if (sendType === 'stats') {
        // SNARK proof via counterparty endpoint
        response = await fetch(`${TOWNHALL_BASE}/api/counterparty/${myPubkey}/proof?include_proof=true&address=${encodeURIComponent(sendAddress || myAddress || "")}`);
      } else {
        const sendEndpoint = sendType === 'dapp' ? '/api/verify/dapp' : '/api/verify/store';
        response = await fetch(`${TOWNHALL_BASE}${sendEndpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      
      const data = await response.json();
      
      if (data.ok || data.found || data.proof) {
        // Add to verification events
        const newEvent: VerificationEvent = {
          id: data.verification_id,
          type: sendType,
          name: sendName,
          status: 'pending',
          timestamp: Date.now(),
        };
        
        // Save proof for later retrieval
        if (data.proof) {
          await SecureStore.setItemAsync('kv_last_stats_proof', JSON.stringify(data.proof));
          await SecureStore.setItemAsync('kv_last_stats', JSON.stringify(data.stats));
        }
        // Inscribe stats proof to Arweave
        if (data.proof && myPubkey) {
          try {
            const { uploadToIrys: statsUpload } = await import('./arweave_upload');
            const proofPayload = JSON.stringify({
              v: 1,
              type: 'stats-proof',
              pubkey: myPubkey,
              apt: myApt,
              stats: data.stats,
              proof: data.proof,
              timestamp: Date.now(),
            });
            const tags = [
              { name: 'App-Name', value: 'KasVillage' },
              { name: 'KV-Type', value: 'stats-proof' },
              { name: 'KV-Pubkey', value: myPubkey },
              { name: 'KV-ProofType', value: data.proof.proof_type || 'Halo2-IPA-Stats-Mock-V2' },
              { name: 'KV-Successes', value: String(data.stats?.successes || 0) },
              { name: 'KV-Deadlocks', value: String(data.stats?.deadlocks || 0) },
              { name: 'KV-XP', value: String(data.stats?.xp || 0) },
              { name: 'Content-Type', value: 'application/json' },
            ];
            const result = await statsUpload(proofPayload, tags);
            const txId = result?.txId || '';
            if (txId) {
              await SecureStore.setItemAsync('kv_stats_proof_tx', txId);
              console.log('[TownHall] Stats proof inscribed:', txId);
            }
          } catch (e) {
            console.warn('[TownHall] Stats proof inscription failed:', e);
          }
        }
        const updatedEvents = [newEvent, ...verificationEvents];
        setVerificationEvents(updatedEvents);
        await SecureStore.setItemAsync('kv_verification_events', JSON.stringify(updatedEvents));
        
        setShowSendModal(false);
        setSendName('');
        setSendCodeUrl('');
        setSendDescription('');
        
        Alert.alert(
          'Submitted!',
          `Your ${sendType} has been submitted for verification. Town Hall will generate a SNARK proof and post to Arweave.`,
          [{ text: 'OK' }]
        );
      } else {
        // Check for APT conflict
        if (data.apt_conflict) {
          setAptConflict({
            requestedApt: data.requested_apt,
            existingOwner: data.existing_owner,
            suggestedAlternatives: data.alternatives || [],
          });
          setShowAptConflict(true);
        } else {
          Alert.alert('Error', data.error || 'Submission failed');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Try again.');
    }
    
    setIsSending(false);
  };
  
  // RECEIVE: Load and download proofs
  const handleReceiveProofs = async () => {
    setShowReceiveModal(true);
    setIsLoadingProofs(true);
    
    try {
      // Query Arweave directly for user proofs
      const gql = JSON.stringify({ query: `{transactions(tags:[{name:"App-Name",values:["KasVillage"]},{name:"KV-Pubkey",values:["${myPubkey}"]}],first:10,sort:HEIGHT_DESC){edges{node{id tags{name value} block{timestamp}}}}}` });
      const arRes = await fetch('https://arweave.net/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: gql });
      const arData = await arRes.json();
      const edges = arData?.data?.transactions?.edges || [];
      const proofs = edges.map((e: any) => {
        const getTag = (name: string) => e.node.tags?.find((t: any) => t.name === name)?.value || '';
        return {
          id: e.node.id,
          type: getTag('KV-Type').includes('stats') ? 'stats' : getTag('KV-Type').includes('verification') ? 'identity' : 'dapp',
          name: getTag('KV-Type') || 'Proof',
          status: 'verified' as const,
          arweaveTx: e.node.id,
          timestamp: e.node.block?.timestamp ? e.node.block.timestamp * 1000 : Date.now(),
        };
      });
      setMyProofs(proofs);
    } catch (error) {
      Alert.alert('Error', 'Failed to load proofs');
    }
    
    setIsLoadingProofs(false);
  };
  
  // Download proof from Arweave
  const handleDownloadProof = async (arweaveTx: string, name: string) => {
    try {
      const url = `https://arweave.net/${arweaveTx}`;
      await Clipboard.setStringAsync(url);
      Alert.alert('Copied!', `Arweave proof URL copied:\n${url}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to copy proof URL');
    }
  };
  
  // Generate stats hash
  const generateStatsHash = async (stats: UserStats | null): Promise<string> => {
    if (!stats) return '';
    const statsJson = JSON.stringify({
      xp: stats.xp,
      successes: stats.successes,
      deadlocks: stats.deadlocks,
      totalTransactions: stats.totalTransactions,
    });
    // In production: use crypto hash
    return `stats_${Date.now()}`;
  };
  
  // Handle APT conflict resolution
  const handleChangeApt = async (newApt: string) => {
    try {
      const response = await fetch(`${TOWNHALL_BASE}/api/apt/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pubkey: myPubkey, 
          current_apt: myApt,
          new_apt: newApt,
        }),
      });
      
      const data = await response.json();
      
      if (data.ok || data.found || data.proof) {
        setMyApt(newApt);
        await SecureStore.setItemAsync('kv_apt_number', newApt);
        setShowAptConflict(false);
        Alert.alert('Success', `Your APT is now ${newApt}`);
      } else {
        Alert.alert('Error', data.error || 'Failed to change APT');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error');
    }
  };
  
  // Request verification (for current user)
  const handleVerify = async () => {
    if (traitCount < 6) {
      Alert.alert(
        'Passport Required',
        `You need 6 traits to verify. You have ${traitCount}.`,
        [{ text: 'OK' }]
      );
      return;
    }
    
    setIsVerifying(true);
    
    try {
      // Build avatar from recipe
      let avatar = { animal:'',class:'',combatStyle:'',definingMoment:'',formativeMemory:'',lifePhilosophy:'',loreOrigin:'',mutant:'',mutate:'',name:'',occupation:'',originStory:'',personality:'',powerSpike:'',race:'',signatureMove:'',voiceLine:'',weakness:'' };
      try {
        const recipeStr = await SecureStore.getItemAsync('kv_avatar_recipe');
        if (recipeStr) {
          const r = JSON.parse(recipeStr);
          avatar.name = r.name || '';
          avatar.race = r.race || '';
          avatar.class = r.class || '';
          avatar.occupation = r.occupation || '';
          avatar.animal = r.animal || '';
          avatar.originStory = r.originStory || '';
          avatar.formativeMemory = r.formativeMemory || '';
          avatar.lifePhilosophy = r.lifePhilosophy || '';
          avatar.powerSpike = r.powerSpike || '';
          avatar.signatureMove = r.signatureMove || '';
          avatar.voiceLine = r.voiceLine || '';
          avatar.personality = r.characterDescription || r.scenarioDesire || '';
          avatar.definingMoment = r.scenarioDesire || r.characterDescription || '';
        }
      } catch {}
      const response = await fetch(`${TOWNHALL_BASE}/verify-identity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey: myPubkey, avatar, signature: 'self-attest' }),
      });
      const data = await response.json();
      
      if (data.ok || data.success || data.proof_id) {
        // Poll for async proof
        if (data.proof_id) {
          const pollForProof = async () => {
            for (let i = 0; i < 48; i++) {
              await new Promise(r => setTimeout(r, 5000));
              try {
                const pollRes = await fetch(`${TOWNHALL_BASE}/proof-status/${data.proof_id}?t=${Date.now()}`);
                const pollData = await pollRes.json();
                console.log('[TownHall] Proof poll:', pollData.status);
                if (pollData.status === 'ready' && pollData.response) {
                  data.proof_hash = pollData.response.proof_hash;
                  data.proof_public_inputs = pollData.response.proof_public_inputs;
                  break;
                }
                if (pollData.status === 'failed') break;
                if (!pollData.status && pollData.error) continue; // Wrong container, retry
              } catch {}
            }
          };
          await pollForProof();
        }
        setIsVerified(true);
        let arweaveTxId = null;
        try {
          const privKey = await SecureStore.getItemAsync('kv_l1_privkey') || await SecureStore.getItemAsync('kv_private_key') || '';
          if (privKey && data.proof_hash) {
            const proofPayload = JSON.stringify({ v:1, type:'identity-verification', pubkey:myPubkey, apt:myApt, tier:data.tier, traits:data.traits, proof_hash:data.proof_hash, public_inputs:data.proof_public_inputs||[], timestamp:Date.now() });
            const tags = [{ name:'App-Name', value:'KasVillage' },{ name:'KV-Type', value:'verification-proof' },{ name:'KV-Pubkey', value:myPubkey||'' },{ name:'KV-ProofHash', value:(data.proof_hash||'').slice(0,64) },{ name:'KV-Tier', value:data.tier||'Guest' },{ name:'Content-Type', value:'application/json' }];
            const arweaveUpload = await import('./arweave_upload');
              console.log('[TownHall] Starting Arweave inscription, payload:', proofPayload.length, 'bytes');
              if (arweaveUpload.uploadToTurbo) {
              const result = await arweaveUpload.uploadToTurbo(proofPayload, tags);
              console.log('[TownHall] Upload result:', JSON.stringify(result));
              arweaveTxId = result?.txId || null;
              console.log('[TownHall] Proof inscribed:', arweaveTxId);
              if (arweaveTxId) await SecureStore.setItemAsync('kv_townhall_verified', 'true');
              if (arweaveTxId) await SecureStore.setItemAsync('kv_verification_tx', arweaveTxId);
            }
          }
        } catch (e) { console.warn('[TownHall] Arweave inscription failed:', e); }
        Alert.alert('? Verified!', arweaveTxId ? 'Proof on Arweave! TX: '+arweaveTxId.slice(0,24)+'...' : 'Verified! Proof: '+(data.proof_hash||'').slice(0,24)+'...', [{ text: 'OK' }]);
      } else {
        Alert.alert('Verification Failed', data.error || 'Please try again.');
      }
    } catch (error) {
      Alert.alert('Verification Failed', 'Network error. Please try again.');
    }
    
    setIsVerifying(false);
  };
  
  // Copy address
  const handleCopyAddress = async () => {
    if (myAddress) {
      await Clipboard.setStringAsync(myAddress);
      Alert.alert('Copied', 'Address copied to clipboard');
    }
  };
  
  // Copy APT
  const handleCopyApt = async () => {
    if (myApt) {
      await Clipboard.setStringAsync(myApt);
      Alert.alert('Copied', 'APT number copied to clipboard');
    }
  };
  
  // Get icon for result type
  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'apt':
      case 'address':
        return <User size={rs.s(20)} color={COLORS.indigo500} />;
      case 'store':
        return <Package size={rs.s(20)} color={COLORS.amber600} />;
      case 'academic':
        return <GraduationCap size={rs.s(20)} color={COLORS.green500} />;
      case 'service':
        return <Wrench size={rs.s(20)} color={COLORS.stone500} />;
      case 'dapp':
        return <Gamepad2 size={rs.s(20)} color={COLORS.indigo500} />;
      default:
        return <Building2 size={rs.s(20)} color={COLORS.stone500} />;
    }
  };
  
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Town Hall Building Background */}
      <TownHallBackground />
      
      {/* Content overlay */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Spacer for building */}
        <View style={styles.buildingSpacer} />
        
        {/* Title */}
        <View style={styles.titleBar}>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={{ paddingRight: 12, paddingVertical: 4 }}>
              <Text style={{ fontSize: 16, color: COLORS.amber600, fontWeight: 'bold' }}>← Back</Text>
            </TouchableOpacity>
          )}
          <Building2 size={rs.s(24)} color={COLORS.amber600} />
          <Text style={styles.title}>Town Hall</Text>
        </View>
        
        {/* Search Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔍 Verification Search</Text>
          <Text style={styles.cardSubtitle}>
            Check verification status of any APT, address, store, or DApp
          </Text>
          
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="APT-303, kaspa:..., dapp-xyz..."
              placeholderTextColor={COLORS.stone400}
              autoCapitalize="none"
              onSubmitEditing={handleSearch}
            />
            <TouchableOpacity
              style={styles.searchBtn}
              onPress={handleSearch}
              disabled={isSearching}
            >
              {isSearching ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Search size={rs.s(20)} color={COLORS.white} />
              )}
            </TouchableOpacity>
          </View>
          
          {/* Search Result */}
          {searchResult && (
            <View style={[
              styles.resultBox,
              searchResult.found && searchResult.verified && styles.resultBoxVerified,
              searchResult.found && !searchResult.verified && styles.resultBoxUnverified,
              !searchResult.found && styles.resultBoxNotFound,
            ]}>
              {searchResult.found ? (
                <>
                  <View style={styles.resultHeader}>
                    {getTypeIcon(searchResult.type)}
                    <Text style={styles.resultType}>
                      {searchResult.type?.toUpperCase()}
                    </Text>
                    {searchResult.verified ? (
                      <View style={styles.verifiedBadge}>
                        <CheckCircle size={rs.s(14)} color={COLORS.green500} />
                        <Text style={styles.verifiedText}>Verified</Text>
                      </View>
                    ) : (
                      <View style={styles.unverifiedBadge}>
                        <Clock size={rs.s(14)} color={COLORS.amber600} />
                        <Text style={styles.unverifiedText}>Unverified</Text>
                      </View>
                    )}
                  </View>
                  
                  {searchResult.aptNumber && (
                    <Text style={styles.resultApt}>🏠 {searchResult.aptNumber}</Text>
                  )}
                  {searchResult.name && (
                    <Text style={styles.resultName}>{searchResult.name}</Text>
                  )}
                  {searchResult.address && (
                    <Text style={styles.resultAddress} numberOfLines={1}>
                      {searchResult.address}
                    </Text>
                  )}
                  {searchResult.traits !== undefined && (
                    <Text style={styles.resultTraits}>
                      {searchResult.traits}/6 traits
                    </Text>
                  )}
                  
                  {/* DApp owner-only verify button */}
                  {searchResult.type === 'dapp' && searchResult.isOwner && !searchResult.verified && (
                    <TouchableOpacity style={styles.resultVerifyBtn}>
                      <Shield size={rs.s(16)} color={COLORS.white} />
                      <Text style={styles.resultVerifyText}>Verify This DApp</Text>
                    </TouchableOpacity>
                  )}
                  
                  {/* Non-owner sees status only */}
                  {searchResult.type === 'dapp' && !searchResult.isOwner && !searchResult.verified && (
                    <View style={styles.pendingNote}>
                      <AlertTriangle size={rs.s(14)} color={COLORS.amber600} />
                      <Text style={styles.pendingText}>
                        Pending verification by developer
                      </Text>
                    </View>
                  )}
                  
                  {searchResult.arweaveTx && (
                    <TouchableOpacity style={styles.arweaveLink} onPress={() => Linking.openURL('https://arweave.net/' + searchResult.arweaveTx)}>
                      <ExternalLink size={rs.s(12)} color={COLORS.indigo500} />
                      <Text style={styles.arweaveLinkText}>View on Arweave</Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <View style={styles.notFoundBox}>
                  <XCircle size={rs.s(24)} color={COLORS.red500} />
                  <Text style={styles.notFoundText}>{searchResult.error}</Text>
                </View>
              )}
            </View>
          )}
        </View>
        
        {/* Your Identity Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🏠 Your Identity</Text>
          
          {myApt ? (
            <>
              <View style={styles.identityRow}>
                <View style={styles.identityInfo}>
                  <Text style={styles.identityLabel}>APT Number</Text>
                  <Text style={styles.identityValue}>{myApt}</Text>
                </View>
                <TouchableOpacity style={styles.copyBtn} onPress={handleCopyApt}>
                  <Copy size={rs.s(18)} color={COLORS.amber600} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.identityRow}>
                <View style={styles.identityInfo}>
                  <Text style={styles.identityLabel}>Kaspa Address</Text>
                  <Text style={styles.identityAddress} numberOfLines={1}>
                    {myAddress}
                  </Text>
                </View>
                <TouchableOpacity style={styles.copyBtn} onPress={handleCopyAddress}>
                  <Copy size={rs.s(18)} color={COLORS.amber600} />
                </TouchableOpacity>
              </View>
              
              {/* Verification Status */}
              <View style={styles.statusRow}>
                <View style={styles.statusItem}>
                  <Text style={styles.statusLabel}>Traits</Text>
                  <Text style={styles.statusValue}>{traitCount}/6</Text>
                </View>
                <View style={styles.statusItem}>
                  <Text style={styles.statusLabel}>Level</Text>
                  <Text style={styles.statusValue}>
                    {accessLevel === 'VERIFIED_PASSPORT' ? '🏰 Passport' :
                     accessLevel === 'PASSPORT_ELIGIBLE' ? '📜 Eligible' :
                     accessLevel === 'RESIDENT' ? '🏠 Resident' : '👤 Guest'}
                  </Text>
                </View>
                <View style={styles.statusItem}>
                  <Text style={styles.statusLabel}>Status</Text>
                  {isVerified ? (
                    <View style={styles.miniVerified}>
                      <CheckCircle size={rs.s(12)} color={COLORS.green500} />
                      <Text style={styles.miniVerifiedText}>Verified</Text>
                    </View>
                  ) : (
                    <Text style={styles.statusValue}>—</Text>
                  )}
                </View>
              </View>
              
              {/* User Stats Display */}
              {myStats && (
                <View style={styles.statsBox}>
                  <Text style={styles.statsTitle}>📊 Your Stats</Text>
                  <View style={styles.statsGrid}>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{myStats.xp}</Text>
                      <Text style={styles.statLabel}>XP</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{myStats.successes}</Text>
                      <Text style={styles.statLabel}>Success</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{myStats.deadlocks}</Text>
                      <Text style={styles.statLabel}>Deadlock</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>
                        {((1 + myStats.successes) / (2 + myStats.successes + myStats.deadlocks) * 100).toFixed(0)}%
                      </Text>
                      <Text style={styles.statLabel}>Trust</Text>
                    </View>
                  </View>
                </View>
              )}
              
              {/* Verification Proof Buttons (NOT wallet send/receive) */}
              <Text style={styles.proofSectionTitle}>Verification Proofs</Text>
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionBtn} onPress={handleReceiveProofs}>
                  <Download size={rs.s(20)} color={COLORS.white} />
                  <Text style={styles.actionBtnText}>Receive Proofs</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.sendBtn]} onPress={() => { setSendAddress(myAddress || ''); setShowSendModal(true); }}>
                  <Upload size={rs.s(20)} color={COLORS.white} />
                  <Text style={styles.actionBtnText}>Send for Verify</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.proofNote}>
                Send: Submit DApp/Store/Stats for verification{'\n'}
                Receive: Download your Arweave proofs
              </Text>
            </>
          ) : (
            <View style={styles.noWalletBox}>
              <AlertTriangle size={rs.s(24)} color={COLORS.amber600} />
              <Text style={styles.noWalletText}>No wallet registered</Text>
              <TouchableOpacity style={styles.downloadBtn}>
                <Download size={rs.s(18)} color={COLORS.white} />
                <Text style={styles.downloadBtnText}>Create Wallet</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        {/* Verification Events History */}
        {verificationEvents.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📜 Verification History</Text>
            {verificationEvents.slice(0, 5).map((event) => (
              <View key={event.id} style={styles.eventRow}>
                <View style={styles.eventIcon}>
                  {event.type === 'dapp' ? <Gamepad2 size={rs.s(16)} color={COLORS.indigo500} /> :
                   event.type === 'store' ? <Package size={rs.s(16)} color={COLORS.amber600} /> :
                   event.type === 'stats' ? <BarChart3 size={rs.s(16)} color={COLORS.green500} /> :
                   <Shield size={rs.s(16)} color={COLORS.stone500} />}
                </View>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventName}>{event.name}</Text>
                  <Text style={styles.eventType}>{event.type.toUpperCase()}</Text>
                </View>
                <View style={[
                  styles.eventStatus,
                  event.status === 'verified' && styles.eventStatusVerified,
                  event.status === 'pending' && styles.eventStatusPending,
                  event.status === 'rejected' && styles.eventStatusRejected,
                ]}>
                  <Text style={styles.eventStatusText}>
                    {event.status === 'verified' ? '✓' : event.status === 'pending' ? '⏳' : '✗'}
                  </Text>
                </View>
                {event.arweaveTx && (
                  <TouchableOpacity onPress={() => handleDownloadProof(event.arweaveTx!, event.name)}>
                    <ExternalLink size={rs.s(16)} color={COLORS.indigo500} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}
        
        {/* Verify Your Content Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🛡️ Verify Your Content</Text>
          <Text style={styles.cardSubtitle}>
            Verification makes your storefronts, DApps, academics, and services visible in search.
            Town Hall posts the proof to Arweave for FREE.
          </Text>
          
          {isVerified ? (
            <View style={styles.alreadyVerified}>
              <CheckCircle size={rs.s(24)} color={COLORS.green500} />
              <Text style={styles.alreadyVerifiedText}>
                You're verified! Your content is visible in search.
              </Text>
            
              <TouchableOpacity
                style={{ backgroundColor: '#F59E0B', borderRadius: 10, padding: 12, marginTop: 10, alignItems: 'center', width: '100%' }}
                onPress={() => { setIsVerified(false); }}
              >
                <Text style={{ color: '#000', fontWeight: '700', fontSize: 13 }}>Re-verify + Inscribe to Arweave</Text>
              </TouchableOpacity>
            </View>
          ) : traitCount >= 6 ? (
            <TouchableOpacity
              style={styles.verifyBtn}
              onPress={handleVerify}
              disabled={isVerifying}
            >
              {isVerifying ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Shield size={rs.s(20)} color={COLORS.white} />
                  <Text style={styles.verifyBtnText}>Verify Now (FREE)</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.needTraitsBox}>
              <Text style={styles.needTraitsText}>
                Need {6 - traitCount} more traits to verify
              </Text>
              <View style={styles.traitProgress}>
                <View
                  style={[
                    styles.traitProgressFill,
                    { width: `${(traitCount / 6) * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.traitProgressText}>
                {traitCount}/6 traits
              </Text>
            </View>
          )}
        </View>
        
        {/* User Stats Lookup & Proof Generation */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📊 Stats Lookup & Proof</Text>
          <Text style={styles.cardSubtitle}>
            Look up any user's stats or generate a SNARK proof of your own stats
          </Text>
          
          <StatsLookup 
            myApt={myApt}
            myAddress={myAddress}
            myPubkey={myPubkey}
          />
        </View>
        
        {/* Info Section */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How Verification Works</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoBullet}>1.</Text>
            <Text style={styles.infoText}>
              Complete 6 avatar traits (Passport level)
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoBullet}>2.</Text>
            <Text style={styles.infoText}>
              Click "Verify Now" — Town Hall runs SNARK proof
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoBullet}>3.</Text>
            <Text style={styles.infoText}>
              Town Hall posts proof to Arweave (FREE for you)
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoBullet}>4.</Text>
            <Text style={styles.infoText}>
              Your content becomes visible in search
            </Text>
          </View>
        </View>
        
        <View style={styles.bottomSpacer} />
      </ScrollView>
      
      {/* SEND VERIFICATION MODAL */}
      <Modal visible={showSendModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📤 Submit for Verification</Text>
              <TouchableOpacity onPress={() => setShowSendModal(false)}>
                <XCircle size={rs.s(24)} color={COLORS.stone400} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>
              Submit your content for Town Hall to verify. We'll generate a SNARK proof and post to Arweave (FREE).
            </Text>
            
            {/* Type selector */}
            <View style={styles.typeSelector}>
              {(['dapp', 'store', 'stats'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeBtn, sendType === type && styles.typeBtnActive]}
                  onPress={() => setSendType(type)}
                >
                  {type === 'dapp' && <Gamepad2 size={rs.s(16)} color={sendType === type ? COLORS.white : COLORS.stone600} />}
                  {type === 'store' && <Package size={rs.s(16)} color={sendType === type ? COLORS.white : COLORS.stone600} />}
                  {type === 'stats' && <BarChart3 size={rs.s(16)} color={sendType === type ? COLORS.white : COLORS.stone600} />}
                  <Text style={[styles.typeBtnText, sendType === type && styles.typeBtnTextActive]}>
                    {type === 'dapp' ? 'DApp/Game' : type === 'store' ? 'Store' : 'Stats'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Name input */}
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.modalInput}
              value={sendName}
              onChangeText={setSendName}
              placeholder={sendType === 'stats' ? 'Stats Verification' : `My ${sendType} name...`}
              placeholderTextColor={COLORS.stone400}
            />
            
            {/* Code URL for DApps */}
            {sendType === 'dapp' && (
              <>
                <Text style={styles.inputLabel}>Code Repository URL</Text>
                <TextInput
                  style={styles.modalInput}
                  value={sendCodeUrl}
                  onChangeText={setSendCodeUrl}
                  placeholder="https://github.com/..."
                  placeholderTextColor={COLORS.stone400}
                  autoCapitalize="none"
                />
                <Text style={styles.inputHint}>
                  Town Hall will verify your code follows rules (no casino, no prohibited content)
                </Text>
              </>
            )}
            
            {/* Stats preview */}
            {sendType === 'stats' && myStats && (
              <View style={styles.statsPreview}>
                <Text style={styles.statsPreviewTitle}>Stats to Verify:</Text>
                <Text style={styles.statsPreviewText}>
                  XP: {myStats.xp} | Success: {myStats.successes} | Deadlock: {myStats.deadlocks}
                </Text>
                <Text style={styles.statsPreviewText}>
                  Trust: {((1 + myStats.successes) / (2 + myStats.successes + myStats.deadlocks) * 100).toFixed(1)}%
                </Text>
              </View>
            )}

            {/* Kaspa Address for L1 queries */}
            {sendType === 'stats' && (
              <>
                <Text style={styles.inputLabel}>Kaspa Address (for L1 proof)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={sendAddress}
                  onChangeText={setSendAddress}
                  placeholder="kaspa:qr0n..."
                  placeholderTextColor={COLORS.stone400}
                  autoCapitalize="none"
                />
                <Text style={styles.inputHint}>
                  Your on-chain address — needed to verify L1 transaction history
                </Text>
              </>
            )}
            
            {/* Description */}
            <Text style={styles.inputLabel}>Description (optional)</Text>
            <TextInput
              style={[styles.modalInput, styles.modalInputMulti]}
              value={sendDescription}
              onChangeText={setSendDescription}
              placeholder="Brief description..."
              placeholderTextColor={COLORS.stone400}
              multiline
              numberOfLines={3}
            />
            
            <TouchableOpacity
              style={[styles.submitBtn, isSending && styles.submitBtnDisabled]}
              onPress={handleSendVerification}
              disabled={isSending}
            >
              {isSending ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Upload size={rs.s(18)} color={COLORS.white} />
                  <Text style={styles.submitBtnText}>Submit for Verification</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      {/* RECEIVE PROOFS MODAL */}
      <Modal visible={showReceiveModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📥 Your Verification Proofs</Text>
              <TouchableOpacity onPress={() => setShowReceiveModal(false)}>
                <XCircle size={rs.s(24)} color={COLORS.stone400} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>
              Download your verification proofs from Arweave. These are permanent, verifiable records.
            </Text>
            
            {isLoadingProofs ? (
              <ActivityIndicator size="large" color={COLORS.amber500} style={{ marginVertical: rs.s(40) }} />
            ) : myProofs.length === 0 ? (
              <View style={styles.noProofsBox}>
                <FileCode size={rs.s(40)} color={COLORS.stone300} />
                <Text style={styles.noProofsText}>No proofs yet</Text>
                <Text style={styles.noProofsSubtext}>Submit content for verification to get proofs</Text>
              </View>
            ) : (
              <ScrollView style={styles.proofsScroll}>
                {myProofs.map((proof) => (
                  <View key={proof.id} style={styles.proofCard}>
                    <View style={styles.proofHeader}>
                      {proof.type === 'dapp' && <Gamepad2 size={rs.s(20)} color={COLORS.indigo500} />}
                      {proof.type === 'store' && <Package size={rs.s(20)} color={COLORS.amber600} />}
                      {proof.type === 'stats' && <BarChart3 size={rs.s(20)} color={COLORS.green500} />}
                      <Text style={styles.proofName}>{proof.name}</Text>
                    </View>
                    
                    <View style={styles.proofMeta}>
                      <Text style={styles.proofType}>{proof.type.toUpperCase()}</Text>
                      <View style={[
                        styles.proofStatus,
                        proof.status === 'verified' && styles.proofStatusVerified,
                      ]}>
                        {proof.status === 'verified' ? (
                          <CheckCircle size={rs.s(12)} color={COLORS.green500} />
                        ) : (
                          <Clock size={rs.s(12)} color={COLORS.amber600} />
                        )}
                        <Text style={styles.proofStatusText}>{proof.status}</Text>
                      </View>
                    </View>
                    
                    {proof.arweaveTx && (
                      <TouchableOpacity
                        style={styles.downloadProofBtn}
                        onPress={() => handleDownloadProof(proof.arweaveTx!, proof.name)}
                      >
                        <Download size={rs.s(16)} color={COLORS.white} />
                        <Text style={styles.downloadProofText}>Copy Arweave URL</Text>
                      </TouchableOpacity>
                    )}
                    
                    <Text style={styles.proofDate}>
                      {new Date(proof.timestamp).toLocaleDateString()}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
            
            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setShowReceiveModal(false)}
            >
              <Text style={styles.closeModalText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      {/* APT CONFLICT MODAL */}
      <Modal visible={showAptConflict} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.conflictModal}>
            <AlertCircle size={rs.s(40)} color={COLORS.amber600} />
            <Text style={styles.conflictTitle}>APT Number Conflict</Text>
            <Text style={styles.conflictText}>
              {aptConflict?.requestedApt} is already assigned to another device.
              Please choose a different APT number:
            </Text>
            
            {aptConflict?.suggestedAlternatives.map((alt) => (
              <TouchableOpacity
                key={alt}
                style={styles.altAptBtn}
                onPress={() => handleChangeApt(alt)}
              >
                <Text style={styles.altAptText}>🏠 {alt}</Text>
              </TouchableOpacity>
            ))}
            
            <TouchableOpacity
              style={styles.cancelConflictBtn}
              onPress={() => setShowAptConflict(false)}
            >
              <Text style={styles.cancelConflictText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
  },
  backgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.45,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: rs.s(16),
  },
  buildingSpacer: {
    height: SCREEN_HEIGHT * 0.38,
  },
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs.s(10),
    marginBottom: rs.s(16),
  },
  title: {
    fontSize: rs.font(28),
    fontWeight: '900',
    color: COLORS.stone800,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: rs.s(16),
    padding: rs.s(18),
    marginBottom: rs.s(16),
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: rs.font(16),
    fontWeight: 'bold',
    color: COLORS.stone800,
    marginBottom: rs.s(6),
  },
  cardSubtitle: {
    fontSize: rs.font(12),
    color: COLORS.stone500,
    marginBottom: rs.s(14),
    lineHeight: rs.font(18),
  },
  searchRow: {
    flexDirection: 'row',
    gap: rs.s(10),
  },
  searchInput: {
    flex: 1,
    backgroundColor: COLORS.stone50,
    borderRadius: rs.s(12),
    paddingHorizontal: rs.s(14),
    paddingVertical: rs.s(12),
    fontSize: rs.font(13),
    color: COLORS.stone800,
    borderWidth: 1,
    borderColor: COLORS.stone200,
  },
  searchBtn: {
    backgroundColor: COLORS.amber600,
    borderRadius: rs.s(12),
    width: rs.s(48),
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultBox: {
    backgroundColor: COLORS.stone50,
    borderRadius: rs.s(12),
    padding: rs.s(14),
    marginTop: rs.s(14),
    borderWidth: 1,
    borderColor: COLORS.stone200,
  },
  resultBoxVerified: {
    backgroundColor: '#f0fdf4',
    borderColor: COLORS.green500,
  },
  resultBoxUnverified: {
    backgroundColor: '#fffbeb',
    borderColor: COLORS.amber500,
  },
  resultBoxNotFound: {
    marginBottom: rs.s(10),
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(8),
    marginBottom: rs.s(10),
  },
  resultType: {
    fontSize: rs.font(10),
    fontWeight: 'bold',
    color: COLORS.stone500,
    flex: 1,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(4),
    backgroundColor: COLORS.green500 + '20',
    borderRadius: rs.s(8),
    paddingHorizontal: rs.s(8),
    paddingVertical: rs.s(4),
  },
  verifiedText: {
    fontSize: rs.font(10),
    fontWeight: 'bold',
    color: COLORS.green600,
  },
  unverifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(4),
    backgroundColor: COLORS.amber500 + '20',
    borderRadius: rs.s(8),
    paddingHorizontal: rs.s(8),
    paddingVertical: rs.s(4),
  },
  unverifiedText: {
    fontSize: rs.font(10),
    fontWeight: 'bold',
    color: COLORS.amber700,
  },
  resultApt: {
    fontSize: rs.font(20),
    fontWeight: '900',
    color: COLORS.stone800,
    marginBottom: rs.s(4),
  },
  resultName: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.stone700,
    marginBottom: rs.s(4),
  },
  resultAddress: {
    fontSize: rs.font(10),
    fontFamily: 'monospace',
    color: COLORS.stone500,
    marginBottom: rs.s(4),
  },
  resultTraits: {
    fontSize: rs.font(11),
    color: COLORS.stone500,
  },
  resultVerifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs.s(8),
    backgroundColor: COLORS.green600,
    borderRadius: rs.s(10),
    paddingVertical: rs.s(10),
    marginTop: rs.s(12),
  },
  resultVerifyText: {
    fontSize: rs.font(13),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  pendingNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(6),
    marginTop: rs.s(10),
  },
  pendingText: {
    fontSize: rs.font(11),
    color: COLORS.amber700,
  },
  arweaveLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(4),
    marginTop: rs.s(10),
  },
  arweaveLinkText: {
    fontSize: rs.font(11),
    color: COLORS.indigo500,
  },
  notFoundBox: {
    alignItems: 'center',
    gap: rs.s(8),
  },
  notFoundText: {
    fontSize: rs.font(13),
    color: COLORS.red600,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.stone50,
    borderRadius: rs.s(12),
    padding: rs.s(12),
    marginBottom: rs.s(10),
  },
  identityInfo: {
    flex: 1,
  },
  identityLabel: {
    fontSize: rs.font(10),
    color: COLORS.stone500,
    marginBottom: rs.s(2),
  },
  identityValue: {
    fontSize: rs.font(18),
    fontWeight: 'bold',
    color: COLORS.amber600,
  },
  identityAddress: {
    fontSize: rs.font(11),
    fontFamily: 'monospace',
    color: COLORS.stone700,
  },
  copyBtn: {
    padding: rs.s(8),
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: rs.s(14),
  },
  statusItem: {
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: rs.font(10),
    color: COLORS.stone500,
    marginBottom: rs.s(2),
  },
  statusValue: {
    fontSize: rs.font(13),
    fontWeight: 'bold',
    color: COLORS.stone700,
  },
  miniVerified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(3),
  },
  miniVerifiedText: {
    fontSize: rs.font(11),
    fontWeight: 'bold',
    color: COLORS.green600,
  },
  actionRow: {
    flexDirection: 'row',
    gap: rs.s(12),
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs.s(8),
    backgroundColor: COLORS.amber600,
    borderRadius: rs.s(12),
    paddingVertical: rs.s(14),
  },
  actionBtnText: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  noWalletBox: {
    alignItems: 'center',
    paddingVertical: rs.s(20),
  },
  noWalletText: {
    fontSize: rs.font(14),
    color: COLORS.stone500,
    marginVertical: rs.s(10),
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(8),
    backgroundColor: COLORS.amber600,
    borderRadius: rs.s(12),
    paddingVertical: rs.s(12),
    paddingHorizontal: rs.s(24),
  },
  downloadBtnText: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  alreadyVerified: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: rs.s(10),
    backgroundColor: COLORS.green500 + '15',
    borderRadius: rs.s(12),
    padding: rs.s(14),
  },
  alreadyVerifiedText: {
    flex: 1,
    fontSize: rs.font(13),
    color: COLORS.green700,
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs.s(10),
    backgroundColor: COLORS.green600,
    borderRadius: rs.s(14),
    paddingVertical: rs.s(16),
  },
  verifyBtnText: {
    fontSize: rs.font(16),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  needTraitsBox: {
    alignItems: 'center',
    paddingVertical: rs.s(10),
  },
  needTraitsText: {
    fontSize: rs.font(13),
    color: COLORS.stone600,
    marginBottom: rs.s(10),
  },
  traitProgress: {
    width: '100%',
    height: rs.s(8),
    backgroundColor: COLORS.stone200,
    borderRadius: rs.s(4),
    overflow: 'hidden',
  },
  traitProgressFill: {
    height: '100%',
    backgroundColor: COLORS.amber500,
    borderRadius: rs.s(4),
  },
  traitProgressText: {
    fontSize: rs.font(11),
    color: COLORS.stone500,
    marginTop: rs.s(6),
  },
  infoCard: {
    backgroundColor: COLORS.stone100,
    borderRadius: rs.s(16),
    padding: rs.s(18),
    marginBottom: rs.s(16),
  },
  infoTitle: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.stone700,
    marginBottom: rs.s(12),
  },
  infoRow: {
    flexDirection: 'row',
    gap: rs.s(8),
    marginBottom: rs.s(8),
  },
  infoBullet: {
    fontSize: rs.font(12),
    fontWeight: 'bold',
    color: COLORS.amber600,
    width: rs.s(18),
  },
  infoText: {
    flex: 1,
    fontSize: rs.font(12),
    color: COLORS.stone600,
    lineHeight: rs.font(18),
  },
  bottomSpacer: {
    height: rs.s(100),
  },
  // Stats box
  statsBox: {
    backgroundColor: COLORS.stone50,
    borderRadius: rs.s(12),
    padding: rs.s(14),
    marginBottom: rs.s(14),
  },
  statsTitle: {
    fontSize: rs.font(12),
    fontWeight: 'bold',
    color: COLORS.stone700,
    marginBottom: rs.s(10),
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: rs.font(18),
    fontWeight: '900',
    color: COLORS.amber600,
  },
  statLabel: {
    fontSize: rs.font(9),
    color: COLORS.stone500,
    marginTop: rs.s(2),
  },
  // Proof section
  proofSectionTitle: {
    fontSize: rs.font(11),
    fontWeight: 'bold',
    color: COLORS.stone600,
    marginBottom: rs.s(8),
    marginTop: rs.s(4),
  },
  sendBtn: {
    backgroundColor: COLORS.indigo600,
  },
  proofNote: {
    fontSize: rs.font(10),
    color: COLORS.stone500,
    textAlign: 'center',
    marginTop: rs.s(8),
    lineHeight: rs.font(16),
  },
  // Event history
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(10),
    paddingVertical: rs.s(10),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.stone100,
  },
  eventIcon: {
    width: rs.s(32),
    height: rs.s(32),
    borderRadius: rs.s(8),
    backgroundColor: COLORS.stone100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventInfo: {
    flex: 1,
  },
  eventName: {
    fontSize: rs.font(13),
    fontWeight: 'bold',
    color: COLORS.stone800,
  },
  eventType: {
    fontSize: rs.font(9),
    color: COLORS.stone500,
  },
  eventStatus: {
    width: rs.s(24),
    height: rs.s(24),
    borderRadius: rs.s(12),
    backgroundColor: COLORS.stone200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventStatusVerified: {
    backgroundColor: COLORS.green500 + '30',
  },
  eventStatusPending: {
    backgroundColor: COLORS.amber500 + '30',
  },
  eventStatusRejected: {
    backgroundColor: COLORS.red500 + '30',
  },
  eventStatusText: {
    fontSize: rs.font(12),
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: rs.s(24),
    borderTopRightRadius: rs.s(24),
    padding: rs.s(20),
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: rs.s(12),
  },
  modalTitle: {
    fontSize: rs.font(18),
    fontWeight: '900',
    color: COLORS.stone800,
  },
  modalSubtitle: {
    fontSize: rs.font(12),
    color: COLORS.stone500,
    marginBottom: rs.s(20),
    lineHeight: rs.font(18),
  },
  typeSelector: {
    flexDirection: 'row',
    gap: rs.s(10),
    marginBottom: rs.s(20),
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs.s(6),
    backgroundColor: COLORS.stone100,
    borderRadius: rs.s(10),
    paddingVertical: rs.s(12),
  },
  typeBtnActive: {
    backgroundColor: COLORS.amber600,
  },
  typeBtnText: {
    fontSize: rs.font(11),
    fontWeight: 'bold',
    color: COLORS.stone600,
  },
  typeBtnTextActive: {
    color: COLORS.white,
  },
  inputLabel: {
    fontSize: rs.font(11),
    fontWeight: 'bold',
    color: COLORS.stone600,
    marginBottom: rs.s(6),
  },
  modalInput: {
    backgroundColor: COLORS.stone50,
    borderRadius: rs.s(10),
    borderWidth: 1,
    borderColor: COLORS.stone200,
    paddingHorizontal: rs.s(14),
    paddingVertical: rs.s(12),
    fontSize: rs.font(14),
    color: COLORS.stone800,
    marginBottom: rs.s(14),
  },
  modalInputMulti: {
    height: rs.s(80),
    textAlignVertical: 'top',
  },
  inputHint: {
    fontSize: rs.font(10),
    color: COLORS.stone500,
    marginTop: rs.s(-10),
    marginBottom: rs.s(14),
  },
  statsPreview: {
    backgroundColor: COLORS.green500 + '15',
    borderRadius: rs.s(10),
    padding: rs.s(12),
    marginBottom: rs.s(14),
  },
  statsPreviewTitle: {
    fontSize: rs.font(11),
    fontWeight: 'bold',
    color: COLORS.green700,
    marginBottom: rs.s(4),
  },
  statsPreviewText: {
    fontSize: rs.font(12),
    color: COLORS.stone600,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs.s(10),
    backgroundColor: COLORS.green600,
    borderRadius: rs.s(14),
    paddingVertical: rs.s(16),
    marginTop: rs.s(10),
  },
  submitBtnDisabled: {
    backgroundColor: COLORS.stone300,
  },
  submitBtnText: {
    fontSize: rs.font(15),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  // Receive modal
  noProofsBox: {
    alignItems: 'center',
    paddingVertical: rs.s(40),
  },
  noProofsText: {
    fontSize: rs.font(16),
    fontWeight: 'bold',
    color: COLORS.stone500,
    marginTop: rs.s(12),
  },
  noProofsSubtext: {
    fontSize: rs.font(12),
    color: COLORS.stone400,
    marginTop: rs.s(4),
  },
  proofsScroll: {
    maxHeight: rs.s(300),
  },
  proofCard: {
    backgroundColor: COLORS.stone50,
    borderRadius: rs.s(12),
    padding: rs.s(14),
    marginBottom: rs.s(12),
  },
  proofHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(10),
    marginBottom: rs.s(8),
  },
  proofName: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.stone800,
  },
  proofMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(10),
    marginBottom: rs.s(10),
  },
  proofType: {
    fontSize: rs.font(9),
    fontWeight: 'bold',
    color: COLORS.stone500,
    backgroundColor: COLORS.stone200,
    paddingHorizontal: rs.s(6),
    paddingVertical: rs.s(2),
    borderRadius: rs.s(4),
  },
  proofStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(4),
  },
  proofStatusVerified: {},
  proofStatusText: {
    fontSize: rs.font(10),
    color: COLORS.stone600,
  },
  downloadProofBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs.s(6),
    backgroundColor: COLORS.indigo500,
    borderRadius: rs.s(8),
    paddingVertical: rs.s(10),
    marginBottom: rs.s(8),
  },
  downloadProofText: {
    fontSize: rs.font(12),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  proofDate: {
    fontSize: rs.font(10),
    color: COLORS.stone400,
    textAlign: 'right',
  },
  closeModalBtn: {
    backgroundColor: COLORS.stone200,
    borderRadius: rs.s(12),
    paddingVertical: rs.s(14),
    alignItems: 'center',
    marginTop: rs.s(16),
  },
  closeModalText: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.stone700,
  },
  // Conflict modal
  conflictModal: {
    backgroundColor: COLORS.white,
    borderRadius: rs.s(20),
    padding: rs.s(24),
    margin: rs.s(20),
    alignItems: 'center',
  },
  conflictTitle: {
    fontSize: rs.font(18),
    fontWeight: '900',
    color: COLORS.stone800,
    marginTop: rs.s(12),
    marginBottom: rs.s(8),
  },
  conflictText: {
    fontSize: rs.font(13),
    color: COLORS.stone600,
    textAlign: 'center',
    marginBottom: rs.s(20),
    lineHeight: rs.font(20),
  },
  altAptBtn: {
    backgroundColor: COLORS.amber100,
    borderRadius: rs.s(12),
    paddingVertical: rs.s(14),
    paddingHorizontal: rs.s(32),
    marginBottom: rs.s(10),
    width: '100%',
    alignItems: 'center',
  },
  altAptText: {
    fontSize: rs.font(16),
    fontWeight: 'bold',
    color: COLORS.amber800,
  },
  cancelConflictBtn: {
    marginTop: rs.s(10),
  },
  cancelConflictText: {
    fontSize: rs.font(14),
    color: COLORS.stone500,
  },
});

export default TownHallScreen;



