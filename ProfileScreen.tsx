// ProfileScreen.tsx — KasVillage Expo
// User profile with stats, XP, Bayesian trust, avatar traits

import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, RefreshControl, Alert, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Rect, Circle, Path, Text as SvgText } from 'react-native-svg';
import * as SecureStore from 'expo-secure-store';
import { getUserStats } from './wallet_registration_v2';
import * as LocalAuthentication from 'expo-local-authentication';
import MnemonicExportModal from './MnemonicExportModal';
import ProceduralBackground from './expo_procedural_backgrounds';
import { StoredAvatarRenderer, getStoredAvatar, RACE_GENERATORS, storeAvatarLocally, computeAvatarHash } from './avatar_silhouette_generator';
import type { AvatarIdentity, Race, Gender } from './avatar_silhouette_generator';
import { storeSerialHash, getSerialHash } from './device_attestation';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const rs = (size: number) => Math.round((size * SCREEN_WIDTH) / 375);

// ============================================================================
// TYPES
// ============================================================================

interface UserStats {
  xp: number;
  xp_balance: number;
  p_complete: number;
  p_dispute: number;
  p_deadlock: number;
  transactions_completed: number;
  successful_completions: number;
  deadlock_count: number;
  trait_count: number;
  storefront_count: number;
  dapps_created: number;
  dapp_approval_rate: number;
  academic_answers_count: number;
  academic_avg_rating: number;
  total_xp_slashed: number;
  in_snail_mode: boolean;
  snail_mode_reason: string | null;
  risk_rating: string;
  tier: string;
}

interface Avatar {
  name: string;
  race: string;
  class: string;
  occupation: string;
  personality: string;
  origin_story: string;
  defining_moment: string;
  weakness: string;
  signature_move: string;
  [key: string]: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const XP_TIERS = [
  { name: 'Base', threshold: 0, color: '#9CA3AF' },
  { name: 'Verified', threshold: 200, color: '#10B981' },
  { name: 'Custodian', threshold: 500, color: '#3B82F6' },
  { name: 'Sentinel', threshold: 1000, color: '#8B5CF6' },
  { name: 'Archon', threshold: 2000, color: '#F59E0B' },
];

const SNAIL_THRESHOLD = 150;
const ELITE_THRESHOLD = 300;
const CITADEL_BUYER_THRESHOLD = 5;
const CITADEL_SELLER_THRESHOLD = 6;

// ============================================================================
// MOCK DATA
// ============================================================================

const mockStats: UserStats = {
  xp: 0,
  xp_balance: 0,
  p_complete: -1,           // -1 = not available (TownHall offline)
  p_dispute: -1,
  p_deadlock: -1,
  transactions_completed: 0,
  successful_completions: 0,
  deadlock_count: 0,
  trait_count: 0,
  storefront_count: 0,
  dapps_created: 0,
  dapp_approval_rate: 0,
  academic_answers_count: 0,
  academic_avg_rating: 0,
  total_xp_slashed: 0,
  in_snail_mode: false,
  snail_mode_reason: null,
  risk_rating: 'Unavailable',
  tier: 'Base',
};

const mockAvatar: Avatar = {
  name: 'Villager',
  race: '',
  class: '',
  occupation: '',
  personality: '',
  origin_story: '',
  defining_moment: '',
  weakness: '',
  signature_move: '',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getXpTier = (xp: number) => {
  let current = XP_TIERS[0];
  for (const tier of XP_TIERS) {
    if (xp >= tier.threshold) current = tier;
  }
  return current;
};

const getNextTier = (xp: number) => {
  for (const tier of XP_TIERS) {
    if (xp < tier.threshold) return tier;
  }
  return XP_TIERS[XP_TIERS.length - 1];
};

const isSnailMode = (xp: number, pComplete: number) => 
  xp < SNAIL_THRESHOLD || pComplete < 0.5;

const isEliteMode = (xp: number) => xp >= ELITE_THRESHOLD;

const getFilledTraits = (avatar: Avatar): number => {
  const traitKeys = [
    'name', 'race', 'class', 'occupation', 'personality',
    'origin_story', 'defining_moment', 'weakness', 'signature_move',
    'lore_origin', 'combat_style', 'power_spike', 'voice_line',
    'formative_memory', 'life_philosophy', 'animal', 'mutant', 'mutate'
  ];
  return traitKeys.filter(k => avatar[k] && avatar[k].trim() !== '').length;
};

// ============================================================================
// COMPONENTS
// ============================================================================

const XpProgressBar: React.FC<{ xp: number }> = ({ xp }) => {
  const current = getXpTier(xp);
  const next = getNextTier(xp);
  const progress = next.threshold > current.threshold
    ? ((xp - current.threshold) / (next.threshold - current.threshold)) * 100
    : 100;

  return (
    <View style={styles.xpContainer}>
      <View style={styles.xpHeader}>
        <Text style={[styles.xpTierText, { color: current.color }]}>
          {current.name}
        </Text>
        <Text style={styles.xpText}>{xp} XP</Text>
      </View>
      <View style={styles.xpBarBg}>
        <View style={[styles.xpBarFill, { width: `${progress}%`, backgroundColor: current.color }]} />
      </View>
      <Text style={styles.xpNextText}>
        {next.threshold - xp} XP to {next.name}
      </Text>
    </View>
  );
};

const BayesianCard: React.FC<{ stats: UserStats }> = ({ stats }) => (
  <View style={styles.bayesianCard}>
    <Text style={styles.cardTitle}>🧠 Bayesian Trust Analysis</Text>
    <Text style={styles.bayesianSubtitle}>Laplace Smoothing</Text>
    
    <View style={styles.bayesianGrid}>
      <View style={styles.bayesianStat}>
        <Text style={styles.bayesianValue}>
          {stats.p_complete < 0 ? 'N/A' : (stats.p_complete * 100).toFixed(1)}%
        </Text>
        <Text style={styles.bayesianLabel}>P(Success)</Text>
      </View>
      <View style={styles.bayesianStat}>
        <Text style={[styles.bayesianValue, { color: '#F59E0B' }]}>
          {stats.p_dispute < 0 ? 'N/A' : (stats.p_dispute * 100).toFixed(1)}%
        </Text>
        <Text style={styles.bayesianLabel}>P(Dispute)</Text>
      </View>
      <View style={styles.bayesianStat}>
        <Text style={[styles.bayesianValue, { color: '#EF4444' }]}>
          {(stats.p_deadlock < 0 ? 'N/A' : (stats.p_deadlock < 0 ? 'N/A' : (stats.p_deadlock * 100).toFixed(2)))}%
        </Text>
        <Text style={styles.bayesianLabel}>P(Deadlock)</Text>
      </View>
    </View>

    <View style={styles.bayesianBar}>
      <View style={[styles.bayesianSegment, { flex: Math.max(0, stats.p_complete), backgroundColor: '#10B981' }]} />
      <View style={[styles.bayesianSegment, { flex: Math.max(0, stats.p_dispute), backgroundColor: '#F59E0B' }]} />
      <View style={[styles.bayesianSegment, { flex: Math.max(0, stats.p_deadlock), backgroundColor: '#EF4444' }]} />
    </View>
    
    <Text style={styles.bayesianFooter}>
      {stats.transactions_completed} samples • Rating: {stats.risk_rating}
    </Text>
  </View>
);

const StatsGrid: React.FC<{ stats: UserStats }> = ({ stats }) => (
  <View style={styles.statsGrid}>
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{stats.transactions_completed}</Text>
      <Text style={styles.statLabel}>Transactions</Text>
    </View>
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{stats.successful_completions}</Text>
      <Text style={styles.statLabel}>Completed</Text>
    </View>
    <View style={styles.statBox}>
      <Text style={[styles.statValue, stats.deadlock_count > 0 && { color: '#EF4444' }]}>
        {stats.deadlock_count}
      </Text>
      <Text style={styles.statLabel}>Deadlocks</Text>
    </View>
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{stats.storefront_count}</Text>
      <Text style={styles.statLabel}>Storefronts</Text>
    </View>
  </View>
);

const CitadelStatus: React.FC<{ traitCount: number }> = ({ traitCount }) => {
  const isBuyer = traitCount >= CITADEL_BUYER_THRESHOLD;
  const isSeller = traitCount >= CITADEL_SELLER_THRESHOLD;
  
  return (
    <View style={styles.citadelCard}>
      <Text style={styles.cardTitle}>🏰 Citadel Status</Text>
      
      <View style={styles.citadelRow}>
        <View style={[styles.citadelBadge, isBuyer && styles.citadelActive]}>
          <Text style={styles.citadelIcon}>🛒</Text>
          <Text style={styles.citadelText}>Resident</Text>
          <Text style={styles.citadelReq}>{traitCount}/5 traits</Text>
        </View>
        
        <View style={[styles.citadelBadge, isSeller && styles.citadelActive]}>
          <Text style={styles.citadelIcon}>🛍️</Text>
          <Text style={styles.citadelText}>Passport</Text>
          <Text style={styles.citadelReq}>{traitCount}/6 traits</Text>
        </View>
      </View>
      
      {!isBuyer && (
        <Text style={styles.citadelHint}>
          Create a new wallet with {CITADEL_BUYER_THRESHOLD} traits to buy items
        </Text>
      )}
      {isBuyer && !isSeller && (
        <Text style={styles.citadelHint}>
          Create a new wallet with {CITADEL_SELLER_THRESHOLD} traits to sell
        </Text>
      )}
    </View>
  );
};

const AvatarTraits: React.FC<{ avatar: Avatar }> = ({ avatar }) => {
  const displayTraits = [
    { key: 'name', label: 'Name' },
    { key: 'race', label: 'Race' },
    { key: 'class', label: 'Class' },
    { key: 'occupation', label: 'Occupation' },
    { key: 'personality', label: 'Personality' },
    { key: 'origin_story', label: 'Origin' },
    { key: 'defining_moment', label: 'Defining Moment' },
    { key: 'weakness', label: 'Weakness' },
    { key: 'signature_move', label: 'Signature Move' },
  ];

  return (
    <View style={styles.traitsCard}>
      <Text style={styles.cardTitle}>👤 Avatar Identity</Text>
      
      {displayTraits.map(({ key, label }) => (
        <View key={key} style={styles.traitRow}>
          <Text style={styles.traitLabel}>{label}</Text>
          <Text style={styles.traitValue}>
            {avatar[key] || '—'}
          </Text>
        </View>
      ))}
      
      <TouchableOpacity style={styles.editButton}>
        <Text style={styles.editButtonText}>Edit Avatar</Text>
      </TouchableOpacity>
    </View>
  );
};

const SnailModeBanner: React.FC<{ reason?: string | null }> = ({ reason }) => (
  <View style={styles.snailBanner}>
    <Text style={styles.snailIcon}>🐌</Text>
    <View>
      <Text style={styles.snailTitle}>SNAIL POISON ACTIVE</Text>
      <Text style={styles.snailText}>
        {reason || 'XP below 150 or P(complete) below 50%'}
      </Text>
    </View>
  </View>
);

const EliteModeBanner: React.FC = () => (
  <View style={styles.eliteBanner}>
    <Text style={styles.eliteIcon}>⚡</Text>
    <View>
      <Text style={styles.eliteTitle}>ELITE STATUS</Text>
      <Text style={styles.eliteText}>Priority processing • No rate limits</Text>
    </View>
  </View>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================


const AvatarLikenessCard: React.FC<{
  identity: AvatarIdentity | null;
  showLikeness: boolean;
  onToggle: () => void;
  uploading: boolean;
  uploadTx: string | null;
  onUpload: () => void;
}> = ({ identity, showLikeness, onToggle, uploading, uploadTx, onUpload }) => {
  if (!identity) return null;

  return (
    <View style={styles.traitsCard}>
      <TouchableOpacity onPress={onToggle} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.cardTitle}>{showLikeness ? '\u25BC' : '\u25B6'} Avatar Likeness</Text>
        <Text style={{ color: '#A8A29E', fontSize: rs(11) }}>{showLikeness ? 'Hide' : 'Show'}</Text>
      </TouchableOpacity>

      {showLikeness && (
        <View style={{ alignItems: 'center', paddingVertical: rs(12) }}>
          <View style={{ 
            backgroundColor: '#0f0f23', borderRadius: rs(16), padding: rs(16),
            borderWidth: 1, borderColor: '#8b5cf6',
          }}>
            <StoredAvatarRenderer identity={identity} size={rs(200)} fillColor="#1a1a2e" strokeColor="#8b5cf6" />
          </View>
          <Text style={{ color: '#A8A29E', fontSize: rs(10), marginTop: rs(8) }}>
            {identity.race} | {identity.gender} | {identity.paths.length} paths
          </Text>
          <Text style={{ color: '#78716C', fontSize: rs(9), marginTop: rs(2) }}>
            Hash: {identity.hash.slice(0, 24)}...
          </Text>
        </View>
      )}

      <TouchableOpacity 
        style={[styles.editButton, uploading && { opacity: 0.5 }]} 
        onPress={onUpload} disabled={uploading}
      >
        <Text style={styles.editButtonText}>
          {uploading ? 'Uploading...' : uploadTx ? 'Re-upload to Arweave' : 'Upload Likeness to Arweave'}
        </Text>
      </TouchableOpacity>

      {uploadTx && (
        <Text style={{ color: '#10B981', fontSize: rs(10), textAlign: 'center', marginTop: rs(8) }}>
          Uploaded: {uploadTx.slice(0, 24)}...
        </Text>
      )}
    </View>
  );
};

export const ProfileScreen: React.FC<{ navigation?: any; onNavigateEntertainment?: () => void; onNavigateTownHall?: () => void; onNavigateBookshelf?: () => void }> = ({ navigation, onNavigateEntertainment, onNavigateTownHall, onNavigateBookshelf }) => {
  const [stats, setStats] = useState<UserStats>(mockStats);
  const [serialInput, setSerialInput] = React.useState('');
  const [serialHashed, setSerialHashed] = React.useState(false);
  const [existingSerialHash, setExistingSerialHash] = React.useState<string | null>(null);

  // Check if serial already bound
  React.useEffect(() => {
    getSerialHash().then(h => { if (h) { setExistingSerialHash(h); setSerialHashed(true); } });
  }, []);
  const [avatar, setAvatar] = useState<Avatar>(mockAvatar);
  const [refreshing, setRefreshing] = useState(false);
  const [aptNumber] = useState('APT-303');

  // Mnemonic export state
  const [mnemonicModalVisible, setMnemonicModalVisible] = useState(false);
  const [mnemonic, setMnemonic] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [kasBalance, setKasBalance] = useState(0);
  const [txId, setTxId] = useState<string | null>(null);
  const [kaspaAddress, setKaspaAddress] = useState<string | null>(null);
  const [showAvatar, setShowAvatar] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUploadTx, setAvatarUploadTx] = useState<string | null>(null);
  const [avatarIdentity, setAvatarIdentity] = useState<AvatarIdentity | null>(null);

  useEffect(() => {
    getStoredAvatar().then(async (id) => {
      // REGEN: regenerate from recipe if no stored avatar
      if (!id) {
        try {
          const recipeStr = await SecureStore.getItemAsync('kv_avatar_recipe');
          if (recipeStr) {
            const recipe = JSON.parse(recipeStr);
            // Using imports from top of file
            const race = recipe.race || 'human';
            const gender = recipe.gender || 'male';
            const gen = RACE_GENERATORS[race.toLowerCase() as Race] || RACE_GENERATORS['human'];
            const paths = gen(gender, 1);
            const hash = computeAvatarHash(paths);
            const ident = { race: race as Race, gender: gender as Gender, paths, hash, name: recipe.name || 'Villager', createdAt: Date.now() };
            await storeAvatarLocally(ident);
            setAvatarIdentity(ident as any);
            console.log('[Profile] Avatar regenerated:', race, gender, paths.length, 'paths');
            return;
          }
        } catch (e) { console.warn('[Profile] Avatar regen failed:', e); }
      }
      if (id) {
        setAvatarIdentity(id);
      } else {
        // Local avatar missing — try Arweave recovery
        try {
          const pubkey = await SecureStore.getItemAsync('kaspa_pubkey');
          if (pubkey) {
            console.log('[Profile] No local avatar, attempting Arweave recovery...');
            const recovery: any = { success: false, identity: null, arweaveTxId: null };
            if (recovery.success && recovery.identity) {
              setAvatarIdentity(recovery.identity as any);
              console.log('[Profile] Avatar recovered from Arweave:', recovery.arweaveTxId);
            }
          }
        } catch (e) { console.warn('[Profile] Avatar recovery failed:', e); }
      }
    }).catch(() => {});
  }, []); // Default hidden

  // Load real data from SecureStore + REST API
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const recipeStr = await SecureStore.getItemAsync('kv_avatar_recipe');
        if (recipeStr) {
          const recipe = JSON.parse(recipeStr);
          setAvatar(prev => ({ ...prev, name: 'Villager' }));
          const traitKeys = ['name', 'race', 'class', 'occupation', 'animal',
            'originStory', 'formativeMemory', 'scenarioDesire', 'characterDescription',
            'voiceLine', 'lifePhilosophy', 'powerSpike', 'signatureMove'];
          const filled = traitKeys.filter(k => recipe[k] && recipe[k].length > 0).length;
          setStats(prev => ({ ...prev, trait_count: filled }));
        console.log('[Profile] trait_count:', filled, 'filled keys:', JSON.stringify(traitKeys.filter(k => recipe[k] && recipe[k].length > 0)));
        }
        const addr = await SecureStore.getItemAsync('kaspa_address');
        if (addr) {
          setKaspaAddress(addr);
          try {
            const apiBase = addr.startsWith('kaspatest:') ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
            const resp = await fetch(`${apiBase}/addresses/${addr}/balance`);
            if (resp.ok) {
              const data = await resp.json();
              setKasBalance(Number(BigInt(data.balance)) / 1e8);
            }
          } catch {}
        }
        const verified = await SecureStore.getItemAsync('kv_verified');
        if (verified === 'true') {
          setStats(prev => ({ ...prev, xp: Math.max(prev.xp, 200), tier: 'Verified' }));
        }
        // Fetch real stats from TownHall (Arweave-backed)
        try {
          console.log('[Profile] Fetching stats from TownHall...');
          console.log('[Profile] Fetching stats from TownHall...');
          const realStats = await getUserStats();
          console.log('[Profile] Got stats:', JSON.stringify(realStats));
          console.log('[Profile] Got stats:', JSON.stringify(realStats));
          if (realStats && realStats.xp > 0) {
            const pComplete = (1 + realStats.successes) / (2 + realStats.successes + realStats.deadlocks);
            setStats(prev => ({
              ...prev,
              xp: realStats.xp,
              p_complete: pComplete,
              p_dispute: realStats.deadlocks > 0 ? realStats.deadlocks / (realStats.successes + realStats.deadlocks) : 0,
              p_deadlock: realStats.deadlocks > 0 ? realStats.deadlocks / (realStats.successes + realStats.deadlocks) : 0,
              transactions_completed: realStats.successes + realStats.deadlocks,
              successful_completions: realStats.successes,
              deadlock_count: realStats.deadlocks,
              in_snail_mode: realStats.xp < 150 || pComplete < 0.5,
              tier: (realStats as any).citadel_tier || prev.tier,
            }));
          }
        } catch (e) { console.warn('[Profile] TownHall stats failed:', e); }
      } catch (err) {
        console.error('[Profile] Load failed:', err);
      }
    };
    loadProfile();
  }, []);
  const [publicKey, setPublicKey] = useState('');

  const traitCount = stats.trait_count;
  const snailMode = isSnailMode(stats.xp, stats.p_complete);
  const eliteMode = isEliteMode(stats.xp);

  const onRefresh = async () => {
    setRefreshing(true);
    // TODO: Fetch from Town Hall
    await new Promise(r => setTimeout(r, 1000));
    setRefreshing(false);
  };

  const handleExportSeed = async () => {
    try {
      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to view seed phrase',
        disableDeviceFallback: false,
      });
      if (!authResult.success) {
        Alert.alert('Authentication Required', 'Biometric auth is required to export your seed phrase.');
        return;
      }

      const storedMnemonic = await SecureStore.getItemAsync('kv_mnemonic');
      const storedAddress = await SecureStore.getItemAsync('kv_wallet_address');
      const storedPubKey = await SecureStore.getItemAsync('kv_public_key');

      if (!storedMnemonic) {
        Alert.alert('No Seed Found', 'No seed phrase stored on this device.');
        return;
      }

      setMnemonic(storedMnemonic);
      setWalletAddress(storedAddress || '');
      setPublicKey(storedPubKey || '');
      setMnemonicModalVisible(true);
    } catch (err) {
      Alert.alert('Error', 'Failed to retrieve seed phrase.');
    }
  };

    const handleUploadAvatar = async () => {
    if (!avatarIdentity) { Alert.alert('No Avatar', 'Complete the Identity Ritual first.'); return; }
    setAvatarUploading(true);
    try {
      // uploadAvatarSVG stub
      const uploadAvatarSVG = async (p: any): Promise<{success:boolean;error?:string;svgTxId?:string|null}> => ({success:false,error:"Not wired",svgTxId:null});
      const result = await uploadAvatarSVG({
        paths: avatarIdentity.paths, hash: avatarIdentity.hash,
        race: avatarIdentity.race, gender: avatarIdentity.gender, network: 'testnet-10',
      });
      if (result.success) {
        setAvatarUploadTx(result.svgTxId || null);
        Alert.alert('Uploaded!', 'Avatar SVG + paths on Arweave.\nTX: ' + (result.svgTxId || '').slice(0, 20) + '...');
      } else { Alert.alert('Failed', result.error || 'Unknown error'); }
    } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Upload failed'); }
    finally { setAvatarUploading(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={StyleSheet.absoluteFill}>
        <ProceduralBackground
          avatar={{ race: avatar.race || 'human', class: avatar.class || 'Warrior', occupation: avatar.occupation || '', name: avatar.name || '' }}
          section={'dashboard'}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
      </View>
      
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" />
        }
      >
        {/* Back Button */}
        <TouchableOpacity
          onPress={() => navigation?.goBack?.()}
          style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 4 }}
        >
          <Text style={{ color: "#F59E0B", fontSize: 16 }}>{"< Back to Village"}</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Profile</Text>
          <View style={styles.aptBadge}>
            <Text style={styles.aptText}>{aptNumber}</Text>
          </View>
        </View>

        {/* Status Banners */}
        {snailMode && <SnailModeBanner reason={stats.snail_mode_reason} />}
        {eliteMode && !snailMode && <EliteModeBanner />}

        {/* Avatar Viewer (hidden by default) */}
        <TouchableOpacity
          onPress={() => setShowAvatar(!showAvatar)}
          style={{ backgroundColor: '#1A1A1A', padding: 12, borderRadius: 8, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: '#333' }}
        >
          <Text style={{ color: '#D4AF37', fontSize: 14 }}>{showAvatar ? 'Hide Avatar' : 'Show Avatar'}</Text>
        </TouchableOpacity>
        {showAvatar && (
          <View style={{ backgroundColor: '#0A0A0A', borderRadius: 12, padding: 16, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: '#333' }}>
            {avatarIdentity ? (
              <StoredAvatarRenderer identity={avatarIdentity} size={200} fillColor='#1a1a2e' strokeColor='#D4AF37' />
            ) : (
              <Text style={{ color: '#888', fontSize: 12 }}>No avatar SVG stored yet</Text>
            )}
            <Text style={{ color: '#D4AF37', fontSize: 11, marginTop: 8 }}>Trait Count: {stats.trait_count}/6</Text>
          </View>
        )}

        {/* KAS Balance */}
        {kasBalance > 0 && (
          <View style={{ backgroundColor: '#1A1A1A', borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#333' }}>
            <Text style={{ color: '#888', fontSize: 12 }}>Balance</Text>
            <Text style={{ color: '#10B981', fontSize: 18, fontWeight: 'bold' }}>{kasBalance.toFixed(4)} KASPA</Text>
          </View>
        )}

        {/* XP Progress */}
        <XpProgressBar xp={stats.xp} />

        {/* Bayesian Trust */}
        <BayesianCard stats={stats} />

        {/* Quick Stats */}
        <StatsGrid stats={stats} />

        {/* Citadel Status */}
        <CitadelStatus traitCount={traitCount} />

        {/* Avatar Traits */}
        {/* Avatar traits hidden - quiz answers */}

        {/* Security & Backup */}
        <View style={styles.securityCard}>
          <Text style={styles.cardTitle}>🔐 Security & Backup</Text>

          <TouchableOpacity
            style={styles.seedExportButton}
            onPress={handleExportSeed}
          >
            <Text style={styles.seedExportIcon}>🗝️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.seedExportText}>Export Seed Phrase</Text>
              <Text style={styles.seedExportSub}>View, copy, or backup your 12-word mnemonic</Text>
            </View>
            <Text style={styles.seedExportArrow}>›</Text>
          </TouchableOpacity>

          {/* Hardware Attestation — Serial Bind */}
          <View style={{ marginTop: rs(12), backgroundColor: '#1A2A3A', borderRadius: rs(12), padding: rs(14), borderWidth: 1, borderColor: '#4A90D9' }}>
            <Text style={{ color: '#4A90D9', fontSize: rs(14), fontWeight: 'bold', marginBottom: rs(4) }}>🔒 Hardware Bind</Text>
            <Text style={{ color: '#AAA', fontSize: rs(11), lineHeight: rs(16), marginBottom: rs(8) }}>
              Bind this wallet to your physical device. Your serial is NEVER stored or transmitted — only a one-way hash is kept locally on your device.
            </Text>
            {serialHashed ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: '#4CAF50', fontSize: rs(13), fontWeight: '600' }}>✓ Device hardware-bound</Text>
                <Text style={{ color: '#666', fontSize: rs(10) }}>{existingSerialHash?.slice(0, 12)}...</Text>
              </View>
            ) : (
              <>
                <Text style={{ color: '#888', fontSize: rs(10), marginBottom: rs(6) }}>Settings → About → Serial Number → Copy → Paste below</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    style={{ flex: 1, backgroundColor: '#0A0A14', borderRadius: 8, padding: rs(10), color: '#FFF', fontSize: rs(14), fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', borderWidth: 1, borderColor: '#333' }}
                    placeholder="Paste serial..."
                    placeholderTextColor="#555"
                    value={serialInput}
                    onChangeText={setSerialInput}
                    autoCapitalize="characters"
                  />
                  {serialInput.length >= 5 && (
                    <TouchableOpacity
                      style={{ backgroundColor: '#4A90D9', borderRadius: 8, paddingHorizontal: rs(14), justifyContent: 'center' }}
                      onPress={async () => {
                        try {
                          const hash = await storeSerialHash(serialInput);
                          setSerialHashed(true);
                          setExistingSerialHash(hash);
                          Alert.alert('\u2705 Hardware Bound', 'Serial hash stored. Raw serial was NOT saved.');
                        } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Failed'); }
                      }}
                    >
                      <Text style={{ color: '#FFF', fontSize: rs(13), fontWeight: 'bold' }}>Bind</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsCard}>
          <Text style={styles.cardTitle}>⚡ Quick Actions</Text>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => onNavigateEntertainment?.()}
          >
            <Text style={styles.actionIcon}>🎮</Text>
            <Text style={styles.actionText}>Entertainment Center</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => onNavigateBookshelf?.()}
          >
            <Text style={styles.actionIcon}>📚</Text>
            <Text style={styles.actionText}>My Book Shelf</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => onNavigateTownHall?.()}
          >
            <Text style={styles.actionIcon}>🏛️</Text>
            <Text style={styles.actionText}>Town Hall Stats</Text>
          </TouchableOpacity>
        </View>

        {/* Footer Spacing */}
        <View style={{ height: rs(100) }} />
      </ScrollView>

      {/* Mnemonic Export Modal */}
      <MnemonicExportModal
        visible={mnemonicModalVisible}
        mnemonic={mnemonic}
        onClose={() => {
          setMnemonicModalVisible(false);
          setMnemonic('');
        }}
        walletAddress={walletAddress}
        publicKey={publicKey}
      />
    </SafeAreaView>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1917',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: rs(16),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: rs(16),
  },
  headerTitle: {
    fontSize: rs(28),
    fontWeight: '900',
    color: '#FFFFFF',
  },
  aptBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: rs(12),
    paddingVertical: rs(6),
    borderRadius: rs(12),
  },
  aptText: {
    fontSize: rs(12),
    fontWeight: '800',
    color: '#1C1917',
  },

  // XP Progress
  xpContainer: {
    backgroundColor: '#292524',
    borderRadius: rs(16),
    padding: rs(16),
    marginBottom: rs(16),
    borderWidth: 1,
    borderColor: '#44403C',
  },
  xpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: rs(8),
  },
  xpTierText: {
    fontSize: rs(18),
    fontWeight: '900',
  },
  xpText: {
    fontSize: rs(18),
    fontWeight: '900',
    color: '#FFFFFF',
  },
  xpBarBg: {
    height: rs(8),
    backgroundColor: '#44403C',
    borderRadius: rs(4),
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    borderRadius: rs(4),
  },
  xpNextText: {
    fontSize: rs(11),
    color: '#A8A29E',
    marginTop: rs(6),
    textAlign: 'right',
  },

  // Bayesian Card
  bayesianCard: {
    backgroundColor: '#1E1B18',
    borderRadius: rs(16),
    padding: rs(16),
    marginBottom: rs(16),
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  cardTitle: {
    fontSize: rs(14),
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: rs(4),
  },
  bayesianSubtitle: {
    fontSize: rs(10),
    color: '#60A5FA',
    marginBottom: rs(12),
    textTransform: 'uppercase',
  },
  bayesianGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: rs(12),
  },
  bayesianStat: {
    alignItems: 'center',
    flex: 1,
  },
  bayesianValue: {
    fontSize: rs(20),
    fontWeight: '900',
    color: '#10B981',
  },
  bayesianLabel: {
    fontSize: rs(10),
    color: '#A8A29E',
    marginTop: rs(2),
  },
  bayesianBar: {
    height: rs(6),
    flexDirection: 'row',
    borderRadius: rs(3),
    overflow: 'hidden',
    marginBottom: rs(8),
  },
  bayesianSegment: {
    height: '100%',
  },
  bayesianFooter: {
    fontSize: rs(10),
    color: '#78716C',
    textAlign: 'center',
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: rs(16),
    gap: rs(8),
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#292524',
    borderRadius: rs(12),
    padding: rs(12),
    alignItems: 'center',
  },
  statValue: {
    fontSize: rs(24),
    fontWeight: '900',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: rs(10),
    color: '#A8A29E',
    marginTop: rs(2),
  },

  // Citadel Card
  citadelCard: {
    backgroundColor: '#292524',
    borderRadius: rs(16),
    padding: rs(16),
    marginBottom: rs(16),
    borderWidth: 1,
    borderColor: '#44403C',
  },
  citadelRow: {
    flexDirection: 'row',
    gap: rs(12),
    marginTop: rs(12),
  },
  citadelBadge: {
    flex: 1,
    backgroundColor: '#1C1917',
    borderRadius: rs(12),
    padding: rs(12),
    alignItems: 'center',
    opacity: 0.5,
  },
  citadelActive: {
    opacity: 1,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  citadelIcon: {
    fontSize: rs(24),
    marginBottom: rs(4),
  },
  citadelText: {
    fontSize: rs(14),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  citadelReq: {
    fontSize: rs(10),
    color: '#A8A29E',
    marginTop: rs(2),
  },
  citadelHint: {
    fontSize: rs(11),
    color: '#F59E0B',
    marginTop: rs(12),
    textAlign: 'center',
  },

  // Avatar Traits
  traitsCard: {
    backgroundColor: '#292524',
    borderRadius: rs(16),
    padding: rs(16),
    marginBottom: rs(16),
    borderWidth: 1,
    borderColor: '#44403C',
  },
  traitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: rs(8),
    borderBottomWidth: 1,
    borderBottomColor: '#44403C',
  },
  traitLabel: {
    fontSize: rs(12),
    color: '#A8A29E',
  },
  traitValue: {
    fontSize: rs(12),
    fontWeight: '600',
    color: '#FFFFFF',
    maxWidth: '60%',
    textAlign: 'right',
  },
  editButton: {
    backgroundColor: '#F59E0B',
    borderRadius: rs(8),
    padding: rs(12),
    alignItems: 'center',
    marginTop: rs(12),
  },
  editButtonText: {
    fontSize: rs(14),
    fontWeight: '700',
    color: '#1C1917',
  },

  // Status Banners
  snailBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7F1D1D',
    borderRadius: rs(12),
    padding: rs(12),
    marginBottom: rs(16),
    gap: rs(12),
  },
  snailIcon: {
    fontSize: rs(28),
  },
  snailTitle: {
    fontSize: rs(12),
    fontWeight: '900',
    color: '#FCA5A5',
  },
  snailText: {
    fontSize: rs(10),
    color: '#FECACA',
  },
  eliteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5B21B6',
    borderRadius: rs(12),
    padding: rs(12),
    marginBottom: rs(16),
    gap: rs(12),
  },
  eliteIcon: {
    fontSize: rs(28),
  },
  eliteTitle: {
    fontSize: rs(12),
    fontWeight: '900',
    color: '#C4B5FD',
  },
  eliteText: {
    fontSize: rs(10),
    color: '#DDD6FE',
  },

  // Security & Backup Card
  securityCard: {
    backgroundColor: '#292524',
    borderRadius: rs(16),
    padding: rs(16),
    marginBottom: rs(16),
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  seedExportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1917',
    borderRadius: rs(12),
    padding: rs(14),
    marginTop: rs(8),
    gap: rs(12),
  },
  seedExportIcon: {
    fontSize: rs(24),
  },
  seedExportText: {
    fontSize: rs(14),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  seedExportSub: {
    fontSize: rs(10),
    color: '#A8A29E',
    marginTop: rs(2),
  },
  seedExportArrow: {
    fontSize: rs(24),
    color: '#78716C',
    fontWeight: '300',
  },

  // Actions Card
  actionsCard: {
    backgroundColor: '#292524',
    borderRadius: rs(16),
    padding: rs(16),
    borderWidth: 1,
    borderColor: '#44403C',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1917',
    borderRadius: rs(12),
    padding: rs(14),
    marginTop: rs(8),
    gap: rs(12),
  },
  actionIcon: {
    fontSize: rs(20),
  },
  actionText: {
    fontSize: rs(14),
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default ProfileScreen;