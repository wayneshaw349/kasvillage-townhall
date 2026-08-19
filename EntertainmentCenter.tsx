// EntertainmentCenter.tsx — KasVillage Expo
// DApps, Games directory + Book Shelf (Academic Research P2P)

import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, TextInput, Linking, Modal, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import EngineHost from './EngineHost';
import { SCENE_ENGINE_HTML } from './scene_engine_html';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const rs = (size: number) => Math.round((size * SCREEN_WIDTH) / 375);

// ============================================================================
// TYPES
// ============================================================================

interface DApp {
  id: string;
  name: string;
  category: string;
  board: 'Elite' | 'Main' | 'Incubator';
  url: string;
  stakeKas: number;
  lockStart: string;
  lockEnd: string;
  trustScore: number;
  ownerApt: string;
  verified: boolean;
  price: number; // 0 = free
}

interface BookshelfItem {
  id: string;
  type: 'abstract' | 'paper' | 'tutoring' | 'audit';
  title: string;
  author: string;
  abstractSummary?: string;
  abstractLink?: string;
  costKas: number;
  purchased: boolean;
  purchasedAt?: number;
  notes?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BOARDS = ['All', 'Elite', 'Main', 'Incubator'] as const;

const BOARD_COLORS: Record<string, { bg: string; text: string }> = {
  Elite: { bg: '#7C3AED', text: '#FFFFFF' },
  Main: { bg: '#2563EB', text: '#FFFFFF' },
  Incubator: { bg: '#059669', text: '#FFFFFF' },
};

// ============================================================================
// MOCK DATA
// ============================================================================

const mockDApps: DApp[] = [
  {
    id: 'dapp-1',
    name: 'KasSwap DEX',
    category: 'DeFi',
    board: 'Elite',
    url: 'https://kasswap.example.com',
    stakeKas: 5200,
    lockStart: '2025-01-01',
    lockEnd: '2026-01-01',
    trustScore: 9800,
    ownerApt: 'APT-101',
    verified: true,
    price: 0,
  },
  {
    id: 'dapp-2',
    name: 'Village Chess',
    category: 'Game',
    board: 'Main',
    url: 'https://chess.example.com',
    stakeKas: 800,
    lockStart: '2025-03-01',
    lockEnd: '2025-12-31',
    trustScore: 3200,
    ownerApt: 'APT-205',
    verified: true,
    price: 5,
  },
  {
    id: 'dapp-3',
    name: 'NFT Gallery',
    category: 'Art',
    board: 'Incubator',
    url: 'https://gallery.example.com',
    stakeKas: 150,
    lockStart: '2025-06-01',
    lockEnd: '2025-09-30',
    trustScore: 650,
    ownerApt: 'APT-412',
    verified: false,
    price: 0,
  },
  {
    id: 'dapp-4',
    name: 'Prediction Market',
    category: 'DeFi',
    board: 'Main',
    url: 'https://predict.example.com',
    stakeKas: 1200,
    lockStart: '2025-02-15',
    lockEnd: '2026-02-15',
    trustScore: 4100,
    ownerApt: 'APT-118',
    verified: true,
    price: 0,
  },
];

const mockBookshelf: BookshelfItem[] = [
  {
    id: 'book-1',
    type: 'abstract',
    title: 'Zero-Knowledge Proofs in L2 Systems',
    author: 'Dr. A. Nakamoto',
    abstractSummary: 'Survey of ZK implementations in blockchain layer 2 solutions',
    costKas: 25,
    purchased: true,
    purchasedAt: Date.now() - 86400000 * 5,
  },
  {
    id: 'book-2',
    type: 'tutoring',
    title: 'Rust Smart Contract Development',
    author: 'Prof. K. Buterin',
    costKas: 100,
    purchased: false,
  },
  {
    id: 'book-3',
    type: 'audit',
    title: 'Security Audit: KasSwap V2',
    author: 'ChainSec Labs',
    abstractSummary: 'Comprehensive audit of token swap logic',
    costKas: 500,
    purchased: false,
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getProtectionStats = (dapp: DApp) => {
  const now = new Date();
  const start = new Date(dapp.lockStart);
  const end = new Date(dapp.lockEnd);
  const totalDuration = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  const remainingDays = Math.max(0, (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const runwayPercent = totalDuration > 0 ? Math.min(100, (remainingDays / totalDuration) * 100) : 0;
  const monthsLeft = Math.floor(remainingDays / 30);
  
  return {
    runwayPercent,
    monthsLeft,
    daysLeft: Math.floor(remainingDays),
    isExpiringSoon: remainingDays < 45,
  };
};

// ============================================================================
// COMPONENTS
// ============================================================================

const BoardBadge: React.FC<{ board: string }> = ({ board }) => {
  const colors = BOARD_COLORS[board] || { bg: '#6B7280', text: '#FFFFFF' };
  return (
    <View style={[styles.boardBadge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.boardBadgeText, { color: colors.text }]}>{board}</Text>
    </View>
  );
};

const DAppCard: React.FC<{ dapp: DApp; onPress: () => void }> = ({ dapp, onPress }) => {
  const stats = getProtectionStats(dapp);
  
  return (
    <TouchableOpacity style={styles.dappCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.dappHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.dappName}>{dapp.name}</Text>
          <Text style={styles.dappCategory}>{dapp.category}</Text>
        </View>
        <BoardBadge board={dapp.board} />
      </View>
      
      {/* Protection Runway */}
      <View style={styles.runwayContainer}>
        <View style={styles.runwayHeader}>
          <Text style={styles.runwayLabel}>Protection Runway</Text>
          <Text style={styles.runwayKas}>{dapp.stakeKas.toLocaleString()} KAS</Text>
        </View>
        <View style={styles.runwayBarBg}>
          <View 
            style={[
              styles.runwayBarFill, 
              { 
                width: `${stats.runwayPercent}%`,
                backgroundColor: stats.isExpiringSoon ? '#EF4444' : '#6366F1',
              }
            ]} 
          />
        </View>
        <View style={styles.runwayFooter}>
          <Text style={styles.runwayDate}>Valid until {dapp.lockEnd}</Text>
          <Text style={[
            styles.runwayMonths,
            stats.isExpiringSoon && { color: '#EF4444' }
          ]}>
            {stats.monthsLeft} Mo.
          </Text>
        </View>
      </View>
      
      {/* Verification Badge */}
      {dapp.verified && (
        <View style={styles.verifiedBadge}>
          <Text style={styles.verifiedText}>✓ Verified</Text>
        </View>
      )}
      
      {/* Price */}
      {dapp.price > 0 && (
        <Text style={styles.dappPrice}>{dapp.price} KAS</Text>
      )}
    </TouchableOpacity>
  );
};

const BookshelfCard: React.FC<{ item: BookshelfItem; onPurchase: () => void }> = ({ item, onPurchase }) => {
  const typeIcons: Record<string, string> = {
    abstract: '📄',
    paper: '📑',
    tutoring: '🎓',
    audit: '🔍',
  };
  
  return (
    <View style={styles.bookCard}>
      <View style={styles.bookHeader}>
        <Text style={styles.bookIcon}>{typeIcons[item.type] || '📚'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.bookTitle}>{item.title}</Text>
          <Text style={styles.bookAuthor}>{item.author}</Text>
        </View>
      </View>
      
      {item.abstractSummary && (
        <Text style={styles.bookSummary} numberOfLines={2}>
          {item.abstractSummary}
        </Text>
      )}
      
      <View style={styles.bookFooter}>
        <Text style={styles.bookPrice}>{item.costKas} KAS</Text>
        
        {item.purchased ? (
          <View style={styles.purchasedBadge}>
            <Text style={styles.purchasedText}>✓ Purchased</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.buyButton} onPress={onPurchase}>
            <Text style={styles.buyButtonText}>Purchase</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const DAppDetailModal: React.FC<{ 
  dapp: DApp | null; 
  visible: boolean; 
  onClose: () => void;
  onLaunch: (d: DApp) => void;
}> = ({ dapp, visible, onClose, onLaunch }) => {
  if (!dapp) return null;
  
  const stats = getProtectionStats(dapp);
  
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{dapp.name}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalScroll}>
            <View style={styles.modalSection}>
              <Text style={styles.sectionLabel}>Category</Text>
              <Text style={styles.sectionValue}>{dapp.category}</Text>
            </View>
            
            <View style={styles.modalSection}>
              <Text style={styles.sectionLabel}>Board</Text>
              <BoardBadge board={dapp.board} />
            </View>
            
            <View style={styles.modalSection}>
              <Text style={styles.sectionLabel}>Trust Score</Text>
              <Text style={styles.sectionValue}>{dapp.trustScore.toLocaleString()}</Text>
            </View>
            
            <View style={styles.modalSection}>
              <Text style={styles.sectionLabel}>Owner</Text>
              <Text style={styles.sectionValue}>{dapp.ownerApt}</Text>
            </View>
            
            <View style={styles.modalSection}>
              <Text style={styles.sectionLabel}>Protection Pledge</Text>
              <Text style={styles.sectionValue}>{dapp.stakeKas.toLocaleString()} KAS</Text>
            </View>
            
            <View style={styles.modalSection}>
              <Text style={styles.sectionLabel}>Runway Remaining</Text>
              <Text style={[
                styles.sectionValue,
                stats.isExpiringSoon && { color: '#EF4444' }
              ]}>
                {stats.daysLeft} days ({stats.monthsLeft} months)
              </Text>
            </View>
            
            <TouchableOpacity 
              style={styles.visitButton}
              onPress={() => onLaunch(dapp)}
            >
              <Text style={styles.visitButtonText}>🌐 Visit DApp</Text>
            </TouchableOpacity>
            
            {dapp.verified && (
              <View style={styles.verificationNote}>
                <Text style={styles.verificationNoteText}>
                  ✓ This DApp has been verified by Town Hall. Code scanned for prohibited patterns.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================


// DApp integrity verification — blocks loading if code hash doesn't match verified version
const verifyDAppIntegrity = async (dappId: string, codeHash: string): Promise<{ safe: boolean; warning?: string }> => {
  try {
    const TOWNHALL_API = 'https://kasvillage.app.runonflux.io';
    const resp = await fetch(TOWNHALL_API + '/api/verify/integrity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dapp_id: dappId, loaded_hash: codeHash }),
    });
    const data = await resp.json();
    if (!data.matches) {
      return { safe: false, warning: 'Code hash mismatch — DApp may have been modified after verification' };
    }
    return { safe: true };
  } catch {
    return { safe: true }; // Network error = allow but warn
  }
};

export const EntertainmentCenter: React.FC<{ navigation?: any; onClose?: () => void }> = ({ 
  navigation, 
  onClose 
}) => {
  const [activeTab, setActiveTab] = useState<'dapps' | 'bookshelf'>('dapps');
  const [activeBoard, setActiveBoard] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [dapps, setDapps] = useState<DApp[]>(mockDApps);
  const [bookshelf, setBookshelf] = useState<BookshelfItem[]>(mockBookshelf);
  const [selectedDApp, setSelectedDApp] = useState<DApp | null>(null);
  // In-app engine player. null = not playing; otherwise the fetched
  // descriptor plus the record it came from.
  const [playingGame, setPlayingGame] = useState<{ dapp: DApp; descriptor: string } | null>(null);
  const [launching, setLaunching] = useState(false);

  // Play routing: scene descriptors play IN-APP through EngineHost;
  // everything else keeps the historical system-browser behaviour.
  const launchDApp = async (dapp: DApp) => {
    if (launching) return;
    setLaunching(true);
    try {
      const _gh = (dapp as any).gameHash || '';
      if (_gh) {
        // On-chain game: descriptor lives in config chunks under the dapp address.
        const { fetchStoreConfig } = await import('./config_chunks');
        const { config, error } = await fetchStoreConfig(dapp.id, _gh, 'testnet-10');
        if (!config) throw new Error('descriptor fetch failed: ' + (error || 'no config'));
        const { scanDescriptor, reasonMessage } = require('./content_filter');
        const _scan = scanDescriptor(config);
        if (!_scan.ok) {
          console.warn('[Launch] content rejected:', _scan.reason, _scan.path);
          throw new Error(reasonMessage(_scan.reason));
        }
        setPlayingGame({ dapp, descriptor: JSON.stringify(config) });
        setLaunching(false);
        return;
      }
      const res = await fetch(dapp.url);
      const text = (await res.text()).trim();
      if (text.startsWith('{')) {
        // Looks like a scene descriptor. EngineHost hash-pins it when the
        // record carries an attested hash, and its validate() gates the rest.
        setPlayingGame({ dapp, descriptor: text });
      } else {
        Linking.openURL(dapp.url);
      }
    } catch (e) {
      // Unreachable content: fall back to the browser rather than a dead tap.
      Linking.openURL(dapp.url);
    }
    setLaunching(false);
  };
  const [refreshing, setRefreshing] = useState(false);

  const filteredDApps = dapps.filter(d => {
    const matchesBoard = activeBoard === 'All' || d.board === activeBoard;
    const matchesSearch = searchQuery === '' || 
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesBoard && matchesSearch;
  });

  const filteredBookshelf = bookshelf.filter(item =>
    searchQuery === '' ||
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onRefresh = async () => {
    setRefreshing(true);
    // TODO: Fetch from Arweave/Town Hall
    await new Promise(r => setTimeout(r, 1000));
    setRefreshing(false);
  };

  const handlePurchaseBook = (item: BookshelfItem) => {
    // TODO: Integrate with wallet
    setBookshelf(prev => 
      prev.map(b => b.id === item.id ? { ...b, purchased: true, purchasedAt: Date.now() } : b)
    );
  };

  // Full-screen player takes over the Entertainment Center while a game
  // is running; closing returns to the directory exactly where it was.
  if (playingGame) {
    return (
      <EngineHost
        engineHtml={SCENE_ENGINE_HTML}
        descriptor={playingGame.descriptor}
        expectedHash={(playingGame.dapp as any).gameHash || (playingGame.dapp as any).contentHash || (playingGame.dapp as any).content_hash || undefined}
        gameId={playingGame.dapp.id}
        title={playingGame.dapp.name}
        onClose={() => setPlayingGame(null)}
        onResult={(r) => {
          // Episode completions / match results surface here and ride the
          // existing KVSTAT3 dual-sign rail. Log until that hookup lands.
          console.log('[EC] engine game result:', JSON.stringify(r).slice(0, 200));
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#1C1917', '#292524', '#1C1917']}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🎮 Entertainment Center</Text>
          <Text style={styles.headerSubtitle}>DApps, Games & Academic Research</Text>
        </View>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.headerClose}>
            <Text style={styles.headerCloseText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Tab Switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'dapps' && styles.tabActive]}
          onPress={() => setActiveTab('dapps')}
        >
          <Text style={[styles.tabText, activeTab === 'dapps' && styles.tabTextActive]}>
            🎮 DApps & Games
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'bookshelf' && styles.tabActive]}
          onPress={() => setActiveTab('bookshelf')}
        >
          <Text style={[styles.tabText, activeTab === 'bookshelf' && styles.tabTextActive]}>
            📚 Book Shelf
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={activeTab === 'dapps' ? "Search DApps..." : "Search research..."}
          placeholderTextColor="#78716C"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      
      {/* Board Filter (DApps only) */}
      {activeTab === 'dapps' && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.boardFilter}
          contentContainerStyle={styles.boardFilterContent}
        >
          {BOARDS.map(board => (
            <TouchableOpacity
              key={board}
              style={[styles.boardTab, activeBoard === board && styles.boardTabActive]}
              onPress={() => setActiveBoard(board)}
            >
              <Text style={[
                styles.boardTabText,
                activeBoard === board && styles.boardTabTextActive
              ]}>
                {board}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      
      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" />
        }
      >
        {activeTab === 'dapps' ? (
          <>
            {filteredDApps.map(dapp => (
              <DAppCard 
                key={dapp.id} 
                dapp={dapp}
                onPress={() => setSelectedDApp(dapp)}
              />
            ))}
            
            {filteredDApps.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={styles.emptyText}>No DApps found</Text>
              </View>
            )}
            
            {/* Build DApp CTA */}
            <TouchableOpacity 
              style={styles.buildCta}
              onPress={() => Linking.openURL('https://claude.ai/code')}
            >
              <Text style={styles.buildCtaIcon}>🛠️</Text>
              <View>
                <Text style={styles.buildCtaTitle}>Build Your Own DApp</Text>
                <Text style={styles.buildCtaSubtitle}>Claude Code IDE</Text>
              </View>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {filteredBookshelf.map(item => (
              <BookshelfCard 
                key={item.id} 
                item={item}
                onPurchase={() => handlePurchaseBook(item)}
              />
            ))}
            
            {filteredBookshelf.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📚</Text>
                <Text style={styles.emptyText}>No items found</Text>
              </View>
            )}
          </>
        )}
        
        <View style={{ height: rs(100) }} />
      </ScrollView>
      
      {/* DApp Detail Modal */}
      <DAppDetailModal 
        dapp={selectedDApp}
        visible={!!selectedDApp}
        onClose={() => setSelectedDApp(null)}
        onLaunch={(d) => { setSelectedDApp(null); launchDApp(d); }}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: rs(16),
    paddingBottom: rs(8),
  },
  headerTitle: {
    fontSize: rs(22),
    fontWeight: '900',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: rs(12),
    color: '#A8A29E',
    marginTop: rs(2),
  },
  headerClose: {
    width: rs(32),
    height: rs(32),
    borderRadius: rs(16),
    backgroundColor: '#44403C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCloseText: {
    fontSize: rs(16),
    color: '#FFFFFF',
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: rs(16),
    gap: rs(8),
  },
  tab: {
    flex: 1,
    paddingVertical: rs(10),
    borderRadius: rs(8),
    backgroundColor: '#292524',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#F59E0B',
  },
  tabText: {
    fontSize: rs(12),
    fontWeight: '700',
    color: '#A8A29E',
  },
  tabTextActive: {
    color: '#1C1917',
  },

  // Search
  searchContainer: {
    padding: rs(16),
    paddingBottom: rs(8),
  },
  searchInput: {
    backgroundColor: '#292524',
    borderRadius: rs(12),
    padding: rs(14),
    fontSize: rs(14),
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#44403C',
  },

  // Board Filter
  boardFilter: {
    maxHeight: rs(44),
  },
  boardFilterContent: {
    paddingHorizontal: rs(16),
    gap: rs(8),
  },
  boardTab: {
    paddingHorizontal: rs(16),
    paddingVertical: rs(8),
    borderRadius: rs(8),
    backgroundColor: '#292524',
  },
  boardTabActive: {
    backgroundColor: '#F59E0B',
  },
  boardTabText: {
    fontSize: rs(12),
    fontWeight: '600',
    color: '#A8A29E',
  },
  boardTabTextActive: {
    color: '#1C1917',
  },

  // Content
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: rs(16),
    gap: rs(12),
  },

  // DApp Card
  dappCard: {
    backgroundColor: '#292524',
    borderRadius: rs(16),
    padding: rs(16),
    borderWidth: 1,
    borderColor: '#44403C',
  },
  dappHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: rs(12),
  },
  dappName: {
    fontSize: rs(16),
    fontWeight: '800',
    color: '#FFFFFF',
  },
  dappCategory: {
    fontSize: rs(11),
    color: '#A8A29E',
    marginTop: rs(2),
  },
  boardBadge: {
    paddingHorizontal: rs(10),
    paddingVertical: rs(4),
    borderRadius: rs(6),
  },
  boardBadgeText: {
    fontSize: rs(10),
    fontWeight: '700',
  },
  runwayContainer: {
    backgroundColor: '#1C1917',
    borderRadius: rs(12),
    padding: rs(12),
  },
  runwayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: rs(6),
  },
  runwayLabel: {
    fontSize: rs(10),
    fontWeight: '700',
    color: '#6366F1',
    textTransform: 'uppercase',
  },
  runwayKas: {
    fontSize: rs(12),
    fontWeight: '800',
    color: '#FFFFFF',
  },
  runwayBarBg: {
    height: rs(6),
    backgroundColor: '#44403C',
    borderRadius: rs(3),
    overflow: 'hidden',
  },
  runwayBarFill: {
    height: '100%',
    borderRadius: rs(3),
  },
  runwayFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: rs(6),
  },
  runwayDate: {
    fontSize: rs(9),
    color: '#78716C',
    fontStyle: 'italic',
  },
  runwayMonths: {
    fontSize: rs(10),
    fontWeight: '700',
    color: '#6366F1',
  },
  verifiedBadge: {
    marginTop: rs(10),
    backgroundColor: '#059669',
    paddingHorizontal: rs(10),
    paddingVertical: rs(4),
    borderRadius: rs(6),
    alignSelf: 'flex-start',
  },
  verifiedText: {
    fontSize: rs(10),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dappPrice: {
    position: 'absolute',
    top: rs(16),
    right: rs(16),
    fontSize: rs(12),
    fontWeight: '800',
    color: '#F59E0B',
  },

  // Book Card
  bookCard: {
    backgroundColor: '#292524',
    borderRadius: rs(16),
    padding: rs(16),
    borderWidth: 1,
    borderColor: '#44403C',
  },
  bookHeader: {
    flexDirection: 'row',
    gap: rs(12),
    marginBottom: rs(8),
  },
  bookIcon: {
    fontSize: rs(28),
  },
  bookTitle: {
    fontSize: rs(14),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bookAuthor: {
    fontSize: rs(11),
    color: '#A8A29E',
    marginTop: rs(2),
  },
  bookSummary: {
    fontSize: rs(12),
    color: '#78716C',
    marginBottom: rs(12),
    lineHeight: rs(18),
  },
  bookFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookPrice: {
    fontSize: rs(16),
    fontWeight: '800',
    color: '#F59E0B',
  },
  purchasedBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: rs(12),
    paddingVertical: rs(6),
    borderRadius: rs(8),
  },
  purchasedText: {
    fontSize: rs(11),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buyButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: rs(16),
    paddingVertical: rs(8),
    borderRadius: rs(8),
  },
  buyButtonText: {
    fontSize: rs(12),
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: rs(40),
  },
  emptyIcon: {
    fontSize: rs(48),
    marginBottom: rs(12),
  },
  emptyText: {
    fontSize: rs(14),
    color: '#78716C',
  },

  // Build CTA
  buildCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1B4B',
    borderRadius: rs(16),
    padding: rs(16),
    gap: rs(12),
    borderWidth: 1,
    borderColor: '#4338CA',
  },
  buildCtaIcon: {
    fontSize: rs(32),
  },
  buildCtaTitle: {
    fontSize: rs(14),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buildCtaSubtitle: {
    fontSize: rs(11),
    color: '#818CF8',
    marginTop: rs(2),
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#292524',
    borderTopLeftRadius: rs(24),
    borderTopRightRadius: rs(24),
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: rs(16),
    borderBottomWidth: 1,
    borderBottomColor: '#44403C',
  },
  modalTitle: {
    fontSize: rs(20),
    fontWeight: '900',
    color: '#FFFFFF',
  },
  closeButton: {
    width: rs(32),
    height: rs(32),
    borderRadius: rs(16),
    backgroundColor: '#44403C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: rs(16),
    color: '#FFFFFF',
  },
  modalScroll: {
    padding: rs(16),
  },
  modalSection: {
    marginBottom: rs(16),
  },
  sectionLabel: {
    fontSize: rs(11),
    color: '#A8A29E',
    textTransform: 'uppercase',
    marginBottom: rs(4),
  },
  sectionValue: {
    fontSize: rs(16),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  visitButton: {
    backgroundColor: '#2563EB',
    borderRadius: rs(12),
    padding: rs(16),
    alignItems: 'center',
    marginTop: rs(8),
  },
  visitButtonText: {
    fontSize: rs(16),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  verificationNote: {
    backgroundColor: '#064E3B',
    borderRadius: rs(12),
    padding: rs(12),
    marginTop: rs(16),
  },
  verificationNoteText: {
    fontSize: rs(11),
    color: '#6EE7B7',
    lineHeight: rs(16),
  },
});

export default EntertainmentCenter;
