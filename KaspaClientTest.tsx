// KaspaClientTest.tsx
// Test screen for native KaspaClient (no WebView)

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useKaspaClient, KaspaNetwork } from '../KaspaClient';

export function KaspaClientTest() {
  const {
    client,
    isConnected,
    isConnecting,
    error,
    serverInfo,
    connect,
    disconnect,
  } = useKaspaClient('mainnet');

  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const log = (msg: string) => {
    console.log('[Test]', msg);
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  const testConnect = async (network: KaspaNetwork) => {
    setLoading(true);
    log(`Connecting to ${network}...`);
    try {
      await connect(network);
      log(`âœ“ Connected! Server: ${serverInfo?.serverVersion}`);
    } catch (e: any) {
      log(`âœ— Connect failed: ${e.message}`);
    }
    setLoading(false);
  };

  const testBalance = async () => {
    setLoading(true);
    // Test address with known balance
    const testAddr = 'kaspa:qz0qsrq0dghfmczd0xt99ehtqz3dswdhqsqlhwqd7chvm3shse6csyzrxctm7';
    log(`Fetching balance for ${testAddr.slice(0, 25)}...`);
    try {
      const balKAS = await client.getBalanceKAS(testAddr);
      log(`âœ“ Balance: ${parseFloat(balKAS).toFixed(8)} KAS`);
    } catch (e: any) {
      log(`âœ— Balance failed: ${e.message}`);
    }
    setLoading(false);
  };

  const testUtxos = async () => {
    setLoading(true);
    const testAddr = 'kaspa:qz0qsrq0dghfmczd0xt99ehtqz3dswdhqsqlhwqd7chvm3shse6csyzrxctm7';
    log(`Fetching UTXOs...`);
    try {
      const utxos = await client.getUtxos([testAddr]);
      log(`âœ“ Found ${utxos.length} UTXOs`);
      if (utxos.length > 0) {
        const first = utxos[0];
        const amountKAS = Number(first.amount) / 1e8;
        log(`  First: ${amountKAS.toFixed(8)} KAS`);
      }
    } catch (e: any) {
      log(`âœ— UTXOs failed: ${e.message}`);
    }
    setLoading(false);
  };

  const testServerInfo = async () => {
    setLoading(true);
    log('Getting server info...');
    try {
      const info = await client.getServerInfo();
      log(`âœ“ Server: ${info.serverVersion}`);
      log(`  Synced: ${info.isSynced}`);
      log(`  DAA Score: ${info.virtualDaaScore}`);
    } catch (e: any) {
      log(`âœ— Server info failed: ${e.message}`);
    }
    setLoading(false);
  };

  const testFeeEstimate = async () => {
    setLoading(true);
    log('Getting fee estimate...');
    try {
      const fee = await client.getFeeEstimate();
      log(`âœ“ Fee: ${JSON.stringify(fee).slice(0, 80)}...`);
    } catch (e: any) {
      log(`âœ— Fee failed: ${e.message}`);
    }
    setLoading(false);
  };

  const testDisconnect = async () => {
    log('Disconnecting...');
    try {
      await disconnect();
      log('âœ“ Disconnected');
    } catch (e: any) {
      log(`âœ— Disconnect failed: ${e.message}`);
    }
  };

  const clearLogs = () => setLogs([]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kaspa Client Test</Text>
      <Text style={styles.subtitle}>Using @kcoin/kaspa-web3.js</Text>

      <View style={styles.status}>
        <Text style={styles.statusText}>
          {isConnecting ? 'â³' : isConnected ? 'âœ…' : 'âŒ'} 
          {isConnected ? ` Connected to ${client.getNetwork()}` : ' Not connected'}
        </Text>
        {serverInfo && (
          <Text style={styles.statusText}>
            Server: {serverInfo.serverVersion}
          </Text>
        )}
        {error && <Text style={styles.error}>{error}</Text>}
        {loading && <ActivityIndicator size="small" color="#49d6aa" />}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connect</Text>
        <View style={styles.buttonRow}>
          <Button 
            title="Mainnet" 
            onPress={() => testConnect('mainnet')} 
            disabled={loading || isConnecting} 
          />
          <Button 
            title="Testnet-10" 
            onPress={() => testConnect('testnet-10')} 
            disabled={loading || isConnecting} 
          />
          <Button 
            title="Testnet-11" 
            onPress={() => testConnect('testnet-11')} 
            disabled={loading || isConnecting} 
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>
        <View style={styles.buttonRow}>
          <Button 
            title="Balance" 
            onPress={testBalance} 
            disabled={!isConnected || loading} 
          />
          <Button 
            title="UTXOs" 
            onPress={testUtxos} 
            disabled={!isConnected || loading} 
          />
          <Button 
            title="Server" 
            onPress={testServerInfo} 
            disabled={!isConnected || loading} 
          />
        </View>
        <View style={styles.buttonRow}>
          <Button 
            title="Fee Est" 
            onPress={testFeeEstimate} 
            disabled={!isConnected || loading} 
          />
          <Button 
            title="Disconnect" 
            onPress={testDisconnect} 
            disabled={!isConnected || loading} 
          />
          <Button 
            title="Clear" 
            onPress={clearLogs} 
          />
        </View>
      </View>

      <ScrollView style={styles.logs}>
        {logs.length === 0 ? (
          <Text style={styles.logPlaceholder}>Logs will appear here...</Text>
        ) : (
          logs.map((l, i) => (
            <Text key={i} style={styles.log}>{l}</Text>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function Button({ 
  title, 
  onPress, 
  disabled = false 
}: { 
  title: string; 
  onPress: () => void; 
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.buttonText, disabled && styles.buttonTextDisabled]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#1a1a2e',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#49d6aa',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  status: {
    backgroundColor: '#16213e',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
  },
  error: {
    color: '#ff6b6b',
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  button: {
    flex: 1,
    backgroundColor: '#49d6aa',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#333',
  },
  buttonText: {
    color: '#1a1a2e',
    fontWeight: '600',
    fontSize: 13,
  },
  buttonTextDisabled: {
    color: '#666',
  },
  logs: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    borderRadius: 8,
    padding: 12,
  },
  logPlaceholder: {
    color: '#444',
    fontStyle: 'italic',
  },
  log: {
    color: '#aaa',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
});

export default KaspaClientTest;



