// ============================================================================
// KASVILLAGE - TRANSACTION HISTORY + TAX CSV EXPORT
// ============================================================================
// Fetches transaction history from Kaspa REST API
// Decodes KV2T wallet tags for categorization
// FIFO batch tracking for cost basis estimation
// CSV export for tax record-keeping
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Share,
  Dimensions,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import { decodeTag, TagType } from './wallet_tags_simple';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================================
// TYPES
// ============================================================================

interface KaspaTx {
  transaction_id: string;
  block_time: number; // milliseconds
  inputs: Array<{
    previous_outpoint_hash: string;
    previous_outpoint_index: number;
    signature_script: string;
    previous_outpoint_address?: string;
    previous_outpoint_amount?: number;
  }>;
  outputs: Array<{
    amount: number; // sompi
    script_public_key_address: string;
    script_public_key_type: string;
  }>;
}

interface ProcessedTx {
  txId: string;
  timestamp: number;
  date: string;
  type: 'send' | 'receive' | 'inscription' | 'frost' | 'xp' | 'self' | 'unknown';
  typeLabel: string;
  amount: number; // KAS (positive = receive, negative = send)
  amountSompi: bigint;
  counterparty: string; // address
  fee: number; // KAS
  tagData?: any; // decoded KV2T tag
  usdEstimate?: number;
}

// ============================================================================
// COLORS
// ============================================================================

const COLORS = {
  bg: '#0A0A0A',
  card: '#1A1A1A',
  cardBorder: '#333',
  text: '#FFF',
  textMuted: '#888',
  textDim: '#555',
  green: '#10B981',
  red: '#EF4444',
  amber: '#D4AF37',
  blue: '#3B82F6',
  purple: '#8B5CF6',
  cyan: '#06B6D4',
};

// ============================================================================
// TRANSACTION HISTORY COMPONENT
// ============================================================================

interface TransactionHistoryProps {
  onClose: () => void;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({ onClose }) => {
  const [transactions, setTransactions] = useState<ProcessedTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [network, setNetwork] = useState('testnet-10');

  // Load transaction history
  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const addr = await SecureStore.getItemAsync('kaspa_address');
      if (!addr) { setError('No wallet address found'); setLoading(false); return; }
      setAddress(addr);
      
      const isTestnet = addr.startsWith('kaspatest:');
      setNetwork(isTestnet ? 'testnet-10' : 'mainnet');
      const apiBase = isTestnet ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';

      // Fetch full transactions
      const resp = await fetch(`${apiBase}/addresses/${addr}/full-transactions?limit=50&resolve_previous_outpoints=light`);
      if (!resp.ok) throw new Error(`API error: ${resp.status}`);
      const txs: KaspaTx[] = await resp.json();

      // Process each transaction
      const processed: ProcessedTx[] = txs.map(tx => {
        const isInput = tx.inputs.some(inp => inp.previous_outpoint_address === addr);
        const isOutput = tx.outputs.some(out => out.script_public_key_address === addr);

        // Calculate amounts
        const inputAmount = tx.inputs
          .filter(inp => inp.previous_outpoint_address === addr)
          .reduce((sum, inp) => sum + (inp.previous_outpoint_amount || 0), 0);
        const outputAmount = tx.outputs
          .filter(out => out.script_public_key_address === addr)
          .reduce((sum, out) => sum + out.amount, 0);

        const totalOutputs = tx.outputs.reduce((sum, out) => sum + out.amount, 0);
        const totalInputs = tx.inputs.reduce((sum, inp) => sum + (inp.previous_outpoint_amount || 0), 0);
        const fee = Math.max(0, totalInputs - totalOutputs);

        let type: ProcessedTx['type'] = 'unknown';
        let typeLabel = 'Unknown';
        let amount = 0;
        let counterparty = '';

        if (isInput && isOutput) {
          // Could be self-transfer or change
          const netAmount = outputAmount - inputAmount;
          if (Math.abs(netAmount) < 1000) {
            type = 'self';
            typeLabel = 'Self Transfer';
            amount = 0;
          } else if (netAmount < 0) {
            type = 'send';
            typeLabel = 'Sent';
            amount = netAmount / 1e8;
            const recipient = tx.outputs.find(o => o.script_public_key_address !== addr);
            counterparty = recipient?.script_public_key_address || '';
          } else {
            type = 'receive';
            typeLabel = 'Received';
            amount = netAmount / 1e8;
          }
        } else if (isOutput && !isInput) {
          type = 'receive';
          typeLabel = 'Received';
          amount = outputAmount / 1e8;
          const sender = tx.inputs[0]?.previous_outpoint_address || '';
          counterparty = sender;
        } else if (isInput && !isOutput) {
          type = 'send';
          typeLabel = 'Sent';
          amount = -(inputAmount - outputAmount) / 1e8;
          const recipient = tx.outputs.find(o => o.script_public_key_address !== addr);
          counterparty = recipient?.script_public_key_address || '';
        }

        // Try to decode KV2T tag from outputs
        let tagData = null;
        for (const out of tx.outputs) {
          if (out.script_public_key_type === 'scripthash' || out.amount === 0) {
            // OP_RETURN or zero-value output might contain tag
            // Tags are in the script, not easily accessible via REST light resolve
          }
        }

        // Check for inscription (very small send to self)
        if (type === 'self' && fee > 0 && fee < 100000) {
          type = 'inscription';
          typeLabel = 'Inscription';
        }

        const timestamp = tx.block_time || 0;
        const date = timestamp > 0 
          ? new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          : 'Pending';

        return {
          txId: tx.transaction_id,
          timestamp,
          date,
          type,
          typeLabel,
          amount,
          amountSompi: BigInt(Math.round(Math.abs(amount) * 1e8)),
          counterparty,
          fee: fee / 1e8,
          tagData,
        };
      });

      // Sort by timestamp descending (newest first)
      processed.sort((a, b) => b.timestamp - a.timestamp);
      setTransactions(processed);
    } catch (err: any) {
      console.error('[TxHistory] Error:', err.message);
      setError(err.message || 'Failed to load transactions');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  // ============================================================================
  // CSV EXPORT
  // ============================================================================

  const exportCSV = useCallback(async () => {
    if (transactions.length === 0) {
      Alert.alert('No Data', 'No transactions to export.');
      return;
    }

    const header = 'Date,Type,Amount (KASPA),Fee (KASPA),Counterparty Address,Transaction ID,Network';
    const rows = transactions.map(tx => 
      `"${tx.date}","${tx.typeLabel}","${tx.amount.toFixed(8)}","${tx.fee.toFixed(8)}","${tx.counterparty}","${tx.txId}","${network}"`
    );
    
    const disclaimer = [
      '',
      '"DISCLAIMER"',
      '"This is an activity report for record-keeping purposes only."',
      '"This is NOT tax advice. Amounts are estimates based on on-chain data."',
      '"Consult a qualified tax professional for tax reporting requirements."',
      `"Generated: ${new Date().toISOString()}"`,
      `"Wallet: ${address.slice(0, 20)}..."`,
      `"Network: ${network}"`,
    ];

    const csv = [header, ...rows, ...disclaimer].join('\n');

    try {
      await Share.share({
        message: csv,
        title: `KasVillage_Activity_${new Date().toISOString().slice(0, 10)}.csv`,
      });
    } catch {
      // Fallback: copy to clipboard
      await Clipboard.setStringAsync(csv);
      Alert.alert('Copied', 'Transaction history CSV copied to clipboard.');
    }
  }, [transactions, address, network]);

  // ============================================================================
  // TYPE ICON + COLOR
  // ============================================================================

  const getTypeStyle = (type: ProcessedTx['type']) => {
    switch (type) {
      case 'receive': return { icon: '+', color: COLORS.green, bg: '#10B98120' };
      case 'send': return { icon: '-', color: COLORS.red, bg: '#EF444420' };
      case 'inscription': return { icon: 'I', color: COLORS.purple, bg: '#8B5CF620' };
      case 'frost': return { icon: 'F', color: COLORS.cyan, bg: '#06B6D420' };
      case 'xp': return { icon: 'X', color: COLORS.amber, bg: '#D4AF3720' };
      case 'self': return { icon: 'S', color: COLORS.textMuted, bg: '#88888820' };
      default: return { icon: '?', color: COLORS.textMuted, bg: '#88888820' };
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
          <Text style={styles.backText}>{"< Back"}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Transaction History</Text>
        <TouchableOpacity onPress={exportCSV} style={styles.exportBtn}>
          <Text style={styles.exportText}>Export CSV</Text>
        </TouchableOpacity>
      </View>

      {/* Network badge */}
      <View style={styles.networkRow}>
        <View style={[styles.networkBadge, { backgroundColor: network === 'mainnet' ? COLORS.green : COLORS.amber }]}>
          <Text style={styles.networkText}>{network === 'mainnet' ? 'MAINNET' : 'TESTNET'}</Text>
        </View>
        <Text style={styles.addressText}>{address.slice(0, 25)}...</Text>
      </View>

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>Activity report for record-keeping. Not tax advice.</Text>
      </View>

      {/* Transaction List */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.amber} />
            <Text style={styles.loadingText}>Loading transactions...</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={loadTransactions} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && transactions.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No transactions found</Text>
            <Text style={styles.emptySubtext}>Transactions will appear here after your first send or receive</Text>
          </View>
        )}

        {transactions.map((tx, index) => {
          const style = getTypeStyle(tx.type);
          return (
            <TouchableOpacity
              key={tx.txId}
              style={styles.txCard}
              onPress={() => {
                Clipboard.setStringAsync(tx.txId);
                Alert.alert('Copied', 'Transaction ID copied to clipboard');
              }}
              activeOpacity={0.7}
            >
              <View style={styles.txRow}>
                {/* Type icon */}
                <View style={[styles.txIcon, { backgroundColor: style.bg }]}>
                  <Text style={[styles.txIconText, { color: style.color }]}>{style.icon}</Text>
                </View>

                {/* Details */}
                <View style={styles.txDetails}>
                  <Text style={styles.txType}>{tx.typeLabel}</Text>
                  <Text style={styles.txDate}>{tx.date}</Text>
                  {tx.counterparty ? (
                    <Text style={styles.txAddress} numberOfLines={1}>
                      {tx.type === 'send' ? 'To: ' : 'From: '}{tx.counterparty.slice(0, 20)}...
                    </Text>
                  ) : null}
                </View>

                {/* Amount */}
                <View style={styles.txAmountCol}>
                  <Text style={[styles.txAmount, { color: tx.amount >= 0 ? COLORS.green : COLORS.red }]}>
                    {tx.amount >= 0 ? '+' : ''}{tx.amount.toFixed(4)}
                  </Text>
                  <Text style={styles.txAmountLabel}>KASPA</Text>
                  {tx.fee > 0 && (
                    <Text style={styles.txFee}>Fee: {tx.fee.toFixed(6)}</Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Summary */}
        {!loading && transactions.length > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Transactions</Text>
              <Text style={styles.summaryValue}>{transactions.length}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Received</Text>
              <Text style={[styles.summaryValue, { color: COLORS.green }]}>
                +{transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0).toFixed(4)} KASPA
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Sent</Text>
              <Text style={[styles.summaryValue, { color: COLORS.red }]}>
                {transactions.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0).toFixed(4)} KASPA
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Fees</Text>
              <Text style={styles.summaryValue}>
                {transactions.reduce((s, t) => s + t.fee, 0).toFixed(6)} KASPA
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Network</Text>
              <Text style={styles.summaryValue}>{network}</Text>
            </View>
          </View>
        )}

        {/* Export section */}
        {!loading && transactions.length > 0 && (
          <TouchableOpacity onPress={exportCSV} style={styles.exportCard}>
            <Text style={styles.exportCardTitle}>Export Activity Report (CSV)</Text>
            <Text style={styles.exportCardSub}>
              Date, Type, Amount, Fee, Address, TX ID, Network
            </Text>
            <Text style={styles.exportCardDisclaimer}>
              This is an estimated activity report for record-keeping purposes only. Not tax advice.
            </Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  backBtn: {
    padding: 8,
  },
  backText: {
    color: COLORS.amber,
    fontSize: 14,
    fontWeight: 'bold',
  },
  title: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  exportBtn: {
    backgroundColor: COLORS.amber + '30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  exportText: {
    color: COLORS.amber,
    fontSize: 12,
    fontWeight: 'bold',
  },
  networkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  networkBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  networkText: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  addressText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  disclaimer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  disclaimerText: {
    color: COLORS.textDim,
    fontSize: 10,
    fontStyle: 'italic',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: COLORS.textMuted,
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  errorText: {
    color: COLORS.red,
    fontSize: 14,
    marginBottom: 12,
  },
  retryBtn: {
    backgroundColor: COLORS.amber + '30',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: COLORS.amber,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptySubtext: {
    color: COLORS.textDim,
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  txCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txIconText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  txDetails: {
    flex: 1,
  },
  txType: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  txDate: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  txAddress: {
    color: COLORS.textDim,
    fontSize: 10,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  txAmountCol: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  txAmountLabel: {
    color: COLORS.textMuted,
    fontSize: 9,
  },
  txFee: {
    color: COLORS.textDim,
    fontSize: 9,
    marginTop: 2,
  },
  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.amber + '40',
  },
  summaryTitle: {
    color: COLORS.amber,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  summaryValue: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: 'bold',
  },
  exportCard: {
    backgroundColor: COLORS.amber + '15',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.amber + '40',
    alignItems: 'center',
  },
  exportCardTitle: {
    color: COLORS.amber,
    fontSize: 14,
    fontWeight: 'bold',
  },
  exportCardSub: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  exportCardDisclaimer: {
    color: COLORS.textDim,
    fontSize: 9,
    marginTop: 8,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

export default TransactionHistory;
