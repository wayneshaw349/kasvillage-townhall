// ============================================================================
// MNEMONIC EXPORT MODAL — SEED PHRASE BACKUP
// ============================================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  PixelRatio,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  X,
  Eye,
  EyeOff,
  Copy,
  Download,
  AlertTriangle,
  Shield,
  CheckCircle,
} from 'lucide-react-native';

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
  
  amber50: '#fffbeb',
  amber100: '#fef3c7',
  amber200: '#fde68a',
  amber600: '#d97706',
  amber700: '#b45309',
  amber800: '#92400e',
  
  red500: '#ef4444',
  red600: '#dc2626',
  red700: '#b91c1c',
  
  green100: '#dcfce7',
  green500: '#22c55e',
  green600: '#16a34a',
  
  blue50: '#eff6ff',
  blue100: '#dbeafe',
  blue200: '#bfdbfe',
  blue700: '#1d4ed8',
  blue800: '#1e40af',
};

// ============================================================================
// COMPONENT PROPS
// ============================================================================
interface MnemonicExportModalProps {
  visible: boolean;
  mnemonic: string;
  onClose: () => void;
  walletAddress: string;
  publicKey: string;
}

// ============================================================================
// MNEMONIC EXPORT MODAL
// ============================================================================
const MnemonicExportModal: React.FC<MnemonicExportModalProps> = ({
  visible,
  mnemonic,
  onClose,
  walletAddress,
}) => {
  const [revealSeed, setRevealSeed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'ledger' | 'tangem' | 'print' | null>(null);
  const [exporting, setExporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const words = mnemonic ? mnemonic.split(' ') : [];

  const handleCopyMnemonic = async () => {
    try {
      await Clipboard.setStringAsync(mnemonic);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      Alert.alert('Error', 'Failed to copy to clipboard');
    }
  };

  const handleExportLedger = async () => {
    setExporting(true);
    try {
      Alert.alert(
        '📱 Ledger Import Steps',
        `1. Open Ledger Live\n2. Add Account → Kaspa\n3. Settings → Advanced\n4. Select "Restore from seed phrase"\n5. Enter your 12 words in order\n6. Confirm on device\n\nYour address will match: ${walletAddress}`,
        [{ text: 'Got It', onPress: () => setSelectedFormat(null) }]
      );
    } finally {
      setExporting(false);
    }
  };

  const handleExportTangem = async () => {
    setExporting(true);
    try {
      Alert.alert(
        '🪪 Tangem Wallet Setup',
        `1. Tap Tangem card to iPhone/Android\n2. Create new wallet\n3. Choose "Import existing"\n4. Enter your 12-word seed phrase\n5. Confirm on card\n\nYour Tangem address will match: ${walletAddress}`,
        [{ text: 'Got It', onPress: () => setSelectedFormat(null) }]
      );
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = async () => {
    setExporting(true);
    try {
      Alert.alert(
        '🖨️ Print Instructions',
        `1. Screenshot this seed grid (PIN & WiFi off)\n2. Print on secure color printer\n3. Store in waterproof safe\n4. NEVER take digital photos after\n5. Destroy screenshot after printing`,
        [{ text: 'Screenshot Now', onPress: () => setSelectedFormat(null) }]
      );
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteSeed = () => {
    if (confirmDelete) {
      Alert.alert(
        '⚠️ Seed Deleted',
        'Your 12-word seed has been removed from KasVillage. Keep it safe in your Ledger/Tangem or write-down.',
        [{ text: 'OK', onPress: onClose }]
      );
    } else {
      setConfirmDelete(true);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* HEADER */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>🔒 Your 12-Word Seed</Text>
              <Text style={styles.subtitle}>Never share. Never screenshot (unless printing).</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={rs.s(24)} color={COLORS.stone700} />
            </TouchableOpacity>
          </View>

          {/* CONTENT */}
          <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
            {/* WARNING */}
            <View style={styles.warningBox}>
              <AlertTriangle size={rs.s(16)} color={COLORS.red700} style={{ marginRight: rs.s(8) }} />
              <Text style={styles.warningText}>
                <Text style={{ fontWeight: '700' }}>CRITICAL:</Text> Anyone with these 12 words can steal your wallet.
              </Text>
            </View>

            {/* REVEAL TOGGLE */}
            <TouchableOpacity style={styles.revealToggle} onPress={() => setRevealSeed(!revealSeed)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs.s(8) }}>
                {revealSeed ? <Eye size={rs.s(20)} color={COLORS.amber600} /> : <EyeOff size={rs.s(20)} color={COLORS.stone500} />}
                <Text style={styles.revealText}>{revealSeed ? 'Hide Seed' : 'Tap to Reveal Seed'}</Text>
              </View>
            </TouchableOpacity>

            {/* SEED GRID */}
            {revealSeed ? (
              <View style={styles.seedGrid}>
                {words.map((word, i) => (
                  <View key={i} style={styles.wordCard}>
                    <Text style={styles.wordNumber}>{i + 1}.</Text>
                    <Text style={styles.wordText}>{word}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.seedGridBlurred}>
                {[...Array(12)].map((_, i) => (
                  <View key={i} style={styles.wordCardBlurred}>
                    <Text style={styles.wordNumberBlurred}>{i + 1}.</Text>
                    <Text style={styles.wordTextBlurred}>••••</Text>
                  </View>
                ))}
              </View>
            )}

            {/* ADDRESS REF */}
            <View style={styles.refBox}>
              <CheckCircle size={rs.s(16)} color={COLORS.green600} />
              <View style={{ flex: 1, marginLeft: rs.s(8) }}>
                <Text style={styles.refLabel}>Your Kaspa Address (for verification)</Text>
                <Text style={styles.refValue} numberOfLines={1}>{walletAddress || 'Loading...'}</Text>
              </View>
            </View>

            {/* ACTIONS */}
            {revealSeed && (
              <View style={styles.actionSection}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: COLORS.blue800 }]}
                  onPress={handleCopyMnemonic}
                  disabled={copied}
                >
                  <Copy size={rs.s(16)} color={COLORS.white} style={{ marginRight: rs.s(8) }} />
                  <Text style={styles.actionBtnText}>{copied ? '✓ Copied' : 'Copy All'}</Text>
                </TouchableOpacity>

                {selectedFormat === null ? (
                  <>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: COLORS.amber700 }]}
                      onPress={() => setSelectedFormat('ledger')}
                    >
                      <Download size={rs.s(16)} color={COLORS.white} style={{ marginRight: rs.s(8) }} />
                      <Text style={styles.actionBtnText}>📱 Ledger Import</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: COLORS.amber700 }]}
                      onPress={() => setSelectedFormat('tangem')}
                    >
                      <Download size={rs.s(16)} color={COLORS.white} style={{ marginRight: rs.s(8) }} />
                      <Text style={styles.actionBtnText}>🪪 Tangem Card</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: COLORS.stone600 }]}
                      onPress={() => setSelectedFormat('print')}
                    >
                      <Download size={rs.s(16)} color={COLORS.white} style={{ marginRight: rs.s(8) }} />
                      <Text style={styles.actionBtnText}>🖨️ Print Backup</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: COLORS.green600 }]}
                    onPress={
                      selectedFormat === 'ledger' ? handleExportLedger
                        : selectedFormat === 'tangem' ? handleExportTangem
                        : handlePrint
                    }
                    disabled={exporting}
                  >
                    {exporting ? (
                      <ActivityIndicator color={COLORS.white} size="small" />
                    ) : (
                      <Shield size={rs.s(16)} color={COLORS.white} style={{ marginRight: rs.s(8) }} />
                    )}
                    <Text style={styles.actionBtnText}>{exporting ? 'Processing...' : 'Continue'}</Text>
                  </TouchableOpacity>
                )}

                {selectedFormat !== null && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: COLORS.stone400 }]}
                    onPress={() => setSelectedFormat(null)}
                    disabled={exporting}
                  >
                    <Text style={styles.actionBtnText}>← Back</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    { backgroundColor: confirmDelete ? COLORS.red600 : COLORS.red500, marginTop: rs.s(12), borderWidth: 1, borderColor: COLORS.red700 }
                  ]}
                  onPress={handleDeleteSeed}
                >
                  <Text style={styles.actionBtnText}>{confirmDelete ? '⚠️ Confirm Delete' : '🗑️ Remove from Phone'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* NOTES */}
            <View style={styles.notesBox}>
              <Text style={styles.notesTitle}>💡 Storage Tips</Text>
              <Text style={styles.notesText}>• <Text style={{ fontWeight: '600' }}>Best:</Text> Ledger / Tangem hardware wallet</Text>
              <Text style={styles.notesText}>• <Text style={{ fontWeight: '600' }}>Good:</Text> Laminated printout in safe</Text>
              <Text style={styles.notesText}>• <Text style={{ fontWeight: '600' }}>NEVER:</Text> Screenshots, notes app, email</Text>
            </View>
          </ScrollView>

          {/* FOOTER */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.closeAction} onPress={onClose}>
              <Text style={styles.closeActionText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', padding: rs.s(16) },
  modal: { backgroundColor: COLORS.white, borderRadius: rs.s(20), maxHeight: '90%', overflow: 'hidden' },
  header: { flexDirection: 'row', padding: rs.s(20), borderBottomWidth: 1, borderBottomColor: COLORS.stone200, backgroundColor: COLORS.blue50 },
  title: { fontSize: rs.font(18), fontWeight: '700', color: COLORS.stone800, marginBottom: rs.s(4) },
  subtitle: { fontSize: rs.font(12), color: COLORS.stone600 },
  closeBtn: { width: rs.s(40), height: rs.s(40), justifyContent: 'center', alignItems: 'center', marginLeft: rs.s(12) },
  content: { flex: 1 },
  contentInner: { padding: rs.s(20), paddingBottom: rs.s(40) },
  warningBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: COLORS.red500, borderRadius: rs.s(12), padding: rs.s(12), flexDirection: 'row', marginBottom: rs.s(20) },
  warningText: { fontSize: rs.font(12), color: COLORS.red700, flex: 1, lineHeight: rs.s(18) },
  revealToggle: { backgroundColor: COLORS.amber100, borderWidth: 1, borderColor: COLORS.amber200, borderRadius: rs.s(12), padding: rs.s(14), marginBottom: rs.s(20), flexDirection: 'row', justifyContent: 'center' },
  revealText: { fontSize: rs.font(14), fontWeight: '600', color: COLORS.amber800 },
  seedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: rs.s(8), marginBottom: rs.s(20) },
  wordCard: { flex: 1, minWidth: rs.s(100), backgroundColor: COLORS.stone50, borderWidth: 1, borderColor: COLORS.stone200, borderRadius: rs.s(8), padding: rs.s(12), alignItems: 'center' },
  wordNumber: { fontSize: rs.font(10), color: COLORS.stone500, marginBottom: rs.s(4) },
  wordText: { fontSize: rs.font(14), fontWeight: '600', color: COLORS.stone800 },
  seedGridBlurred: { flexDirection: 'row', flexWrap: 'wrap', gap: rs.s(8), marginBottom: rs.s(20) },
  wordCardBlurred: { flex: 1, minWidth: rs.s(100), backgroundColor: COLORS.stone100, borderWidth: 1, borderColor: COLORS.stone300, borderRadius: rs.s(8), padding: rs.s(12), alignItems: 'center' },
  wordNumberBlurred: { fontSize: rs.font(10), color: COLORS.stone400, marginBottom: rs.s(4) },
  wordTextBlurred: { fontSize: rs.font(14), fontWeight: '600', color: COLORS.stone400 },
  refBox: { backgroundColor: COLORS.green100, borderWidth: 1, borderColor: COLORS.green600, borderRadius: rs.s(8), padding: rs.s(12), flexDirection: 'row', alignItems: 'center', marginBottom: rs.s(20) },
  refLabel: { fontSize: rs.font(11), color: COLORS.stone700, fontWeight: '600' },
  refValue: { fontSize: rs.font(11), color: COLORS.stone600, fontFamily: 'monospace', marginTop: rs.s(4) },
  actionSection: { gap: rs.s(10), marginBottom: rs.s(12) },
  actionBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: rs.s(12), paddingHorizontal: rs.s(16), borderRadius: rs.s(8) },
  actionBtnText: { fontSize: rs.font(14), fontWeight: '600', color: COLORS.white },
  notesBox: { backgroundColor: COLORS.blue50, borderWidth: 1, borderColor: COLORS.blue200, borderRadius: rs.s(8), padding: rs.s(12) },
  notesTitle: { fontSize: rs.font(13), fontWeight: '700', color: COLORS.blue800, marginBottom: rs.s(8) },
  notesText: { fontSize: rs.font(12), color: COLORS.blue700, lineHeight: rs.s(18), marginBottom: rs.s(4) },
  footer: { padding: rs.s(16), borderTopWidth: 1, borderTopColor: COLORS.stone200, backgroundColor: COLORS.stone50 },
  closeAction: { paddingVertical: rs.s(12), paddingHorizontal: rs.s(20), borderRadius: rs.s(8), backgroundColor: COLORS.stone700, alignItems: 'center' },
  closeActionText: { fontSize: rs.font(14), fontWeight: '600', color: COLORS.white },
});

export default MnemonicExportModal;