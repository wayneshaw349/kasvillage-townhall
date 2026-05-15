// ============================================================================
// WALLET FORMATION TEST COMPONENT
// ============================================================================
// Drop this into your app to test wallet formation
// Usage: Import and render <WalletFormationTest />
// ============================================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import * as Crypto from 'expo-crypto';
import { deriveWalletFromIdentityHash, validateMnemonic } from '../bip39_wallet';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

export default function WalletFormationTest() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const [walletInfo, setWalletInfo] = useState<{
    address: string;
    mnemonic: string;
    pubkey: string;
  } | null>(null);

  const runTests = async () => {
    setRunning(true);
    setResults([]);
    const testResults: TestResult[] = [];

    try {
      // Test 1: Deterministic derivation
      console.log('[Test 1] Starting deterministic derivation test...');
      const testHash = 'a'.repeat(64);
      const wallet1 = await deriveWalletFromIdentityHash(testHash);
      const wallet2 = await deriveWalletFromIdentityHash(testHash);
      
      testResults.push({
        name: 'Deterministic Derivation',
        passed: wallet1.kaspaAddress === wallet2.kaspaAddress,
        details: `Same hash → same address: ${wallet1.kaspaAddress.slice(0, 20)}...`,
      });

      // Test 2: Different hash = different wallet
      console.log('[Test 2] Different hash test...');
      const differentHash = 'b'.repeat(64);
      const wallet3 = await deriveWalletFromIdentityHash(differentHash);
      
      testResults.push({
        name: 'Different Hash = Different Wallet',
        passed: wallet1.kaspaAddress !== wallet3.kaspaAddress,
        details: `Hash 'aaa...' ≠ Hash 'bbb...'`,
      });

      // Test 3: Valid Kaspa address format
      console.log('[Test 3] Address format test...');
      const validPrefix = wallet1.kaspaAddress.startsWith('kaspa:');
      const validLength = wallet1.kaspaAddress.length > 60;
      
      testResults.push({
        name: 'Valid Kaspa Address Format',
        passed: validPrefix && validLength,
        details: `Prefix: ${validPrefix ? '✓' : '✗'}, Length: ${wallet1.kaspaAddress.length}`,
      });

      // Test 4: 12-word mnemonic
      console.log('[Test 4] Mnemonic format test...');
      const words = wallet1.mnemonic.split(' ');
      
      testResults.push({
        name: '12-Word BIP39 Mnemonic',
        passed: words.length === 12,
        details: `Word count: ${words.length}`,
      });

      // Test 5: Mnemonic validation
      console.log('[Test 5] Mnemonic validation test...');
      const isValid = await validateMnemonic(wallet1.mnemonic);
      
      testResults.push({
        name: 'Mnemonic Checksum Valid',
        passed: isValid,
        details: isValid ? 'Checksum verified' : 'Checksum failed',
      });

      // Test 6: Simulated avatar hash
      console.log('[Test 6] Avatar simulation test...');
      const avatarData = JSON.stringify({
        name: 'TestWarrior',
        race: 'human',
        class: 'Warrior',
        occupation: 'Blacksmith',
        animal: 'Wolf',
        colors: { skin: '#FFD700', hair: '#8B4513' },
      });
      
      const avatarHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        avatarData,
        { encoding: Crypto.CryptoEncoding.HEX }
      );
      
      const avatarWallet = await deriveWalletFromIdentityHash(avatarHash);
      
      testResults.push({
        name: 'Avatar Hash Derivation',
        passed: avatarWallet.kaspaAddress.startsWith('kaspa:'),
        details: `Avatar → ${avatarWallet.kaspaAddress.slice(0, 25)}...`,
      });

      // Test 7: Pubkey format (33 bytes compressed = 66 hex chars)
      console.log('[Test 7] Public key format test...');
      const pubkeyValid = wallet1.publicKeyHex.length === 66;
      const startsWithCompressed = wallet1.publicKeyHex.startsWith('02') || 
                                    wallet1.publicKeyHex.startsWith('03');
      
      testResults.push({
        name: 'Compressed Public Key',
        passed: pubkeyValid && startsWithCompressed,
        details: `Length: ${wallet1.publicKeyHex.length}, Prefix: ${wallet1.publicKeyHex.slice(0, 2)}`,
      });

      // Test 8: Private key format (32 bytes = 64 hex chars)
      console.log('[Test 8] Private key format test...');
      const privkeyValid = wallet1.privateKeyHex.length === 64;
      
      testResults.push({
        name: 'Private Key Format',
        passed: privkeyValid,
        details: `Length: ${wallet1.privateKeyHex.length} hex chars (32 bytes)`,
      });

      // Store wallet info for display
      setWalletInfo({
        address: avatarWallet.kaspaAddress,
        mnemonic: avatarWallet.mnemonic,
        pubkey: avatarWallet.publicKeyHex,
      });

    } catch (error: any) {
      testResults.push({
        name: 'ERROR',
        passed: false,
        details: error.message || String(error),
      });
    }

    setResults(testResults);
    setRunning(false);
  };

  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🔐 Wallet Formation Test</Text>
      
      <TouchableOpacity 
        style={[styles.button, running && styles.buttonDisabled]}
        onPress={runTests}
        disabled={running}
      >
        {running ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.buttonText}>Run All Tests</Text>
        )}
      </TouchableOpacity>

      {results.length > 0 && (
        <>
          <View style={styles.summary}>
            <Text style={styles.summaryText}>
              {passedCount}/{totalCount} Tests Passed
            </Text>
            <Text style={[
              styles.summaryStatus,
              passedCount === totalCount ? styles.passed : styles.failed
            ]}>
              {passedCount === totalCount ? '✅ ALL PASS' : '❌ SOME FAILED'}
            </Text>
          </View>

          {results.map((result, index) => (
            <View 
              key={index} 
              style={[
                styles.resultCard,
                result.passed ? styles.resultPass : styles.resultFail
              ]}
            >
              <Text style={styles.resultName}>
                {result.passed ? '✓' : '✗'} {result.name}
              </Text>
              <Text style={styles.resultDetails}>{result.details}</Text>
            </View>
          ))}

          {walletInfo && (
            <View style={styles.walletCard}>
              <Text style={styles.walletTitle}>📍 Generated Wallet</Text>
              
              <Text style={styles.label}>Address:</Text>
              <Text style={styles.mono} selectable>{walletInfo.address}</Text>
              
              <Text style={styles.label}>Mnemonic:</Text>
              <Text style={styles.mono} selectable>{walletInfo.mnemonic}</Text>
              
              <Text style={styles.label}>Public Key:</Text>
              <Text style={styles.mono} selectable>
                {walletInfo.pubkey.slice(0, 32)}...
              </Text>
              
              <Text style={styles.warning}>
                ⚠️ Test wallet only - do not use for real funds
              </Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#4A90D9',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  summary: {
    backgroundColor: '#2A2A4E',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  summaryText: {
    color: '#FFF',
    fontSize: 18,
    marginBottom: 8,
  },
  summaryStatus: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  passed: {
    color: '#4CAF50',
  },
  failed: {
    color: '#FF4444',
  },
  resultCard: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  resultPass: {
    backgroundColor: '#1B4332',
    borderLeftColor: '#4CAF50',
  },
  resultFail: {
    backgroundColor: '#4A1A1A',
    borderLeftColor: '#FF4444',
  },
  resultName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  resultDetails: {
    color: '#AAA',
    fontSize: 13,
  },
  walletCard: {
    backgroundColor: '#2A2A4E',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#4A90D9',
  },
  walletTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  label: {
    color: '#888',
    fontSize: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  mono: {
    color: '#4A90D9',
    fontSize: 12,
    fontFamily: 'monospace',
    backgroundColor: '#1A1A2E',
    padding: 8,
    borderRadius: 4,
  },
  warning: {
    color: '#FF6B00',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
});
