// QRPayNearby.tsx — KasVillage QR Code + WiFi Hotspot PayNearby
// Modes: Receive (show QR) | Send (paste address or APT)
// Works offline via WiFi hotspot — no internet required for discovery

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Alert, StyleSheet,
  Dimensions, ScrollView, Platform, Share
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const rs = (size: number) => Math.round((size * SCREEN_WIDTH) / 375);

// ============================================================================
// TYPES
// ============================================================================

type Mode = 'choose' | 'receive' | 'send';

interface QRPayload {
  type: 'kasvillage_pay';
  address: string;
  pubkey: string;
  apt: string;
  amount?: number;
  name?: string;
  network: string;
}

// ============================================================================
// APT DERIVATION (same as TownHall + ProfileScreen)
// ============================================================================

function deriveAPT(pubkey: string): string {
  if (!pubkey || pubkey.length < 10) return 'APT-000';
  const hexSlice = pubkey.slice(2, 9);
  const num = parseInt(hexSlice, 16) % 10000000;
  return `APT-${num}`;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const QRPayNearby: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [mode, setMode] = useState<Mode>('choose');
  const [address, setAddress] = useState('');
  const [pubkey, setPubkey] = useState('');
  const [apt, setApt] = useState('APT-...');
  const [network, setNetwork] = useState('testnet-10');
  const [avatarName, setAvatarName] = useState('Villager');
  const [requestAmount, setRequestAmount] = useState('');
  const [pasteInput, setPasteInput] = useState('');
  const [resolvedAddress, setResolvedAddress] = useState('');

  // Load wallet info
  useEffect(() => {
    (async () => {
      const addr = await SecureStore.getItemAsync('kaspa_address') || '';
      const pk = await SecureStore.getItemAsync('kv_l1_pubkey') ||
                 await SecureStore.getItemAsync('kaspa_pubkey') ||
                 await SecureStore.getItemAsync('kv_public_key') || '';
      const net = await SecureStore.getItemAsync('kv_network') || 'testnet-10';
      const recipe = await SecureStore.getItemAsync('kv_avatar_recipe');
      
      setAddress(addr);
      setPubkey(pk);
      setNetwork(net);
      if (pk) setApt(deriveAPT(pk));
      if (recipe) {
        try { setAvatarName(JSON.parse(recipe).name || 'Villager'); } catch {}
      }
    })();
  }, []);

  // Build QR payload
  const qrPayload = JSON.stringify({
    type: 'kasvillage_pay',
    address,
    pubkey: pubkey.slice(0, 16),
    apt,
    amount: requestAmount ? parseFloat(requestAmount) : undefined,
    name: avatarName,
    network,
  } as QRPayload);

  // Handle paste/APT input
  const handlePasteSubmit = useCallback(async () => {
    const input = pasteInput.trim();
    if (!input) return;

    // Direct Kaspa address
    if (input.startsWith('kaspa:') || input.startsWith('kaspatest:')) {
      setResolvedAddress(input);
      return;
    }

    // APT number — resolve via TownHall (future endpoint)
    if (input.toUpperCase().startsWith('APT-')) {
      // TODO: GET /api/apt/{number} → returns address
      Alert.alert('APT Lookup', `APT lookup coming soon. For now, paste the full Kaspa address.`);
      return;
    }

    // Try parsing as QR JSON payload
    try {
      const parsed = JSON.parse(input);
      if (parsed.type === 'kasvillage_pay' && parsed.address) {
        setResolvedAddress(parsed.address);
        Alert.alert('Found!', `${parsed.name || 'Villager'} (${parsed.apt})\n${parsed.address.slice(0, 30)}...`);
        return;
      }
    } catch {}

    Alert.alert('Invalid', 'Paste a Kaspa address, APT number, or scan a KasVillage QR code.');
  }, [pasteInput]);

  // Copy address to clipboard
  const handleCopyAddress = useCallback(async () => {
    await Clipboard.setStringAsync(address);
    Alert.alert('Copied!', 'Kaspa address copied to clipboard');
  }, [address]);

  // Share QR data
  const handleShare = useCallback(async () => {
    await Share.share({
      message: `Send KAS to ${apt}\n${address}\n\nKasVillage P2P`,
      title: `Pay ${avatarName}`,
    });
  }, [address, apt, avatarName]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>📡 Pay Nearby</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* Mode Selector */}
        {mode === 'choose' && (
          <View style={styles.modeContainer}>
            <Text style={styles.modeTitle}>How would you like to connect?</Text>

            <TouchableOpacity style={styles.modeCard} onPress={() => setMode('receive')}>
              <Text style={styles.modeIcon}>📥</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.modeCardTitle}>Receive KAS</Text>
                <Text style={styles.modeCardSub}>Show your QR code for someone to scan</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modeCard} onPress={() => setMode('send')}>
              <Text style={styles.modeIcon}>📤</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.modeCardTitle}>Send KAS</Text>
                <Text style={styles.modeCardSub}>Scan a QR code or paste an address</Text>
              </View>
            </TouchableOpacity>

            {/* Hotspot Info */}
            <View style={styles.hotspotCard}>
              <Text style={styles.hotspotTitle}>📶 Works Offline!</Text>
              <Text style={styles.hotspotText}>
                No internet? One phone creates a WiFi hotspot, the other connects. Then scan QR to exchange addresses. Settlement broadcasts when internet returns.
              </Text>
              <Text style={styles.hotspotSteps}>
                1. Phone A → Settings → Hotspot → Turn On{'\n'}
                2. Phone B → Connect to hotspot{'\n'}
                3. Show/Scan QR code{'\n'}
                4. Trade!
              </Text>
            </View>
          </View>
        )}

        {/* RECEIVE MODE — Show QR */}
        {mode === 'receive' && (
          <View style={styles.receiveContainer}>
            <TouchableOpacity onPress={() => setMode('choose')} style={styles.modeSwitch}>
              <Text style={styles.modeSwitchText}>← Change Mode</Text>
            </TouchableOpacity>

            <Text style={styles.receiveTitle}>Show this QR to sender</Text>

            {/* QR Code */}
            <View style={styles.qrContainer}>
              <QRCode
                value={qrPayload}
                size={rs(220)}
                backgroundColor="#FFFFFF"
                color="#000000"
              />
            </View>

            {/* Identity Info */}
            <View style={styles.identityCard}>
              <Text style={styles.identityName}>{avatarName}</Text>
              <TouchableOpacity onPress={handleCopyAddress}>
                <Text style={styles.identityApt}>{apt}</Text>
                <Text style={styles.identityAddr}>{address.slice(0, 35)}...</Text>
                <Text style={styles.copyHint}>tap to copy address</Text>
              </TouchableOpacity>
            </View>

            {/* Request Amount */}
            <View style={styles.amountCard}>
              <Text style={styles.amountLabel}>Request Amount (optional)</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor="#555"
                value={requestAmount}
                onChangeText={setRequestAmount}
                keyboardType="decimal-pad"
              />
              <Text style={styles.amountUnit}>KAS</Text>
            </View>

            {/* Share Button */}
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
              <Text style={styles.shareBtnText}>📤 Share Address</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* SEND MODE — Paste/Scan */}
        {mode === 'send' && (
          <View style={styles.sendContainer}>
            <TouchableOpacity onPress={() => setMode('choose')} style={styles.modeSwitch}>
              <Text style={styles.modeSwitchText}>← Change Mode</Text>
            </TouchableOpacity>

            <Text style={styles.sendTitle}>Enter recipient</Text>

            {/* Paste Input */}
            <View style={styles.pasteCard}>
              <Text style={styles.pasteLabel}>Paste address, APT number, or QR data</Text>
              <TextInput
                style={styles.pasteInput}
                placeholder="kaspatest:qq... or APT-7954310"
                placeholderTextColor="#555"
                value={pasteInput}
                onChangeText={setPasteInput}
                autoCapitalize="none"
                multiline
              />
              <View style={styles.pasteButtons}>
                <TouchableOpacity
                  style={styles.pasteBtn}
                  onPress={async () => {
                    const clip = await Clipboard.getStringAsync();
                    if (clip) setPasteInput(clip);
                  }}
                >
                  <Text style={styles.pasteBtnText}>📋 Paste</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.lookupBtn} onPress={handlePasteSubmit}>
                  <Text style={styles.lookupBtnText}>🔍 Lookup</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Resolved Address */}
            {resolvedAddress.length > 0 && (
              <View style={styles.resolvedCard}>
                <Text style={styles.resolvedLabel}>✅ Recipient Found</Text>
                <Text style={styles.resolvedAddr}>{resolvedAddress}</Text>
                <TouchableOpacity
                  style={styles.sendBtn}
                  onPress={() => {
                    // Navigate to SendKAS with pre-filled address
                    Alert.alert('Send KAS', `Ready to send to:\n${resolvedAddress.slice(0, 35)}...\n\nSendKAS screen will be wired here.`);
                  }}
                >
                  <Text style={styles.sendBtnText}>Send KAS →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Camera placeholder */}
            <View style={styles.cameraPlaceholder}>
              <Text style={styles.cameraIcon}>📷</Text>
              <Text style={styles.cameraText}>Camera QR scanning coming soon</Text>
              <Text style={styles.cameraSub}>For now, paste the QR data or address above</Text>
            </View>
          </View>
        )}

        <View style={{ height: rs(40) }} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A14' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: rs(16), paddingVertical: rs(12),
  },
  backBtn: { padding: rs(8) },
  backText: { color: '#F59E0B', fontSize: rs(16) },
  title: { color: '#FFF', fontSize: rs(20), fontWeight: '900' },
  scroll: { flex: 1 },
  scrollContent: { padding: rs(16) },

  // Mode Selector
  modeContainer: {},
  modeTitle: { color: '#FFF', fontSize: rs(18), fontWeight: '700', textAlign: 'center', marginBottom: rs(20) },
  modeCard: {
    flexDirection: 'row', alignItems: 'center', gap: rs(12),
    backgroundColor: '#1A1A2E', borderRadius: rs(16), padding: rs(20),
    marginBottom: rs(12), borderWidth: 1, borderColor: '#333',
  },
  modeIcon: { fontSize: rs(32) },
  modeCardTitle: { color: '#FFF', fontSize: rs(16), fontWeight: '700' },
  modeCardSub: { color: '#888', fontSize: rs(12), marginTop: rs(2) },

  // Hotspot
  hotspotCard: {
    backgroundColor: '#0D2818', borderRadius: rs(16), padding: rs(16),
    marginTop: rs(8), borderWidth: 1, borderColor: '#10B981',
  },
  hotspotTitle: { color: '#10B981', fontSize: rs(14), fontWeight: '700', marginBottom: rs(8) },
  hotspotText: { color: '#AAA', fontSize: rs(12), lineHeight: rs(18), marginBottom: rs(8) },
  hotspotSteps: { color: '#10B981', fontSize: rs(11), lineHeight: rs(18), fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  // Receive
  receiveContainer: { alignItems: 'center' },
  receiveTitle: { color: '#FFF', fontSize: rs(18), fontWeight: '700', marginBottom: rs(16) },
  qrContainer: {
    backgroundColor: '#FFF', borderRadius: rs(20), padding: rs(20),
    alignItems: 'center', justifyContent: 'center',
  },
  identityCard: {
    alignItems: 'center', marginTop: rs(16), backgroundColor: '#1A1A2E',
    borderRadius: rs(12), padding: rs(16), width: '100%',
  },
  identityName: { color: '#D4AF37', fontSize: rs(18), fontWeight: '900' },
  identityApt: { color: '#F59E0B', fontSize: rs(24), fontWeight: '900', marginTop: rs(4) },
  identityAddr: { color: '#888', fontSize: rs(11), marginTop: rs(4), fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  copyHint: { color: '#555', fontSize: rs(10), marginTop: rs(4) },

  // Amount
  amountCard: {
    flexDirection: 'row', alignItems: 'center', gap: rs(8),
    backgroundColor: '#1A1A2E', borderRadius: rs(12), padding: rs(14),
    marginTop: rs(12), width: '100%',
  },
  amountLabel: { color: '#888', fontSize: rs(11), position: 'absolute', top: rs(4), left: rs(14) },
  amountInput: {
    flex: 1, color: '#FFF', fontSize: rs(24), fontWeight: '700',
    paddingTop: rs(16), textAlign: 'center',
  },
  amountUnit: { color: '#F59E0B', fontSize: rs(16), fontWeight: '700' },

  // Share
  shareBtn: {
    backgroundColor: '#F59E0B', borderRadius: rs(12), padding: rs(14),
    alignItems: 'center', marginTop: rs(12), width: '100%',
  },
  shareBtnText: { color: '#000', fontSize: rs(16), fontWeight: '700' },

  // Mode Switch
  modeSwitch: { alignSelf: 'flex-start', marginBottom: rs(12) },
  modeSwitchText: { color: '#F59E0B', fontSize: rs(14) },

  // Send
  sendContainer: {},
  sendTitle: { color: '#FFF', fontSize: rs(18), fontWeight: '700', marginBottom: rs(16) },
  pasteCard: {
    backgroundColor: '#1A1A2E', borderRadius: rs(16), padding: rs(16),
    borderWidth: 1, borderColor: '#333',
  },
  pasteLabel: { color: '#888', fontSize: rs(12), marginBottom: rs(8) },
  pasteInput: {
    backgroundColor: '#0A0A14', borderRadius: rs(10), padding: rs(14),
    color: '#FFF', fontSize: rs(14), minHeight: rs(60),
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    borderWidth: 1, borderColor: '#333',
  },
  pasteButtons: { flexDirection: 'row', gap: rs(8), marginTop: rs(10) },
  pasteBtn: {
    flex: 1, backgroundColor: '#333', borderRadius: rs(8),
    padding: rs(12), alignItems: 'center',
  },
  pasteBtnText: { color: '#FFF', fontSize: rs(14), fontWeight: '600' },
  lookupBtn: {
    flex: 1, backgroundColor: '#F59E0B', borderRadius: rs(8),
    padding: rs(12), alignItems: 'center',
  },
  lookupBtnText: { color: '#000', fontSize: rs(14), fontWeight: '700' },

  // Resolved
  resolvedCard: {
    backgroundColor: '#0D2818', borderRadius: rs(16), padding: rs(16),
    marginTop: rs(12), borderWidth: 1, borderColor: '#10B981',
  },
  resolvedLabel: { color: '#10B981', fontSize: rs(14), fontWeight: '700' },
  resolvedAddr: {
    color: '#AAA', fontSize: rs(11), marginTop: rs(4),
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  sendBtn: {
    backgroundColor: '#10B981', borderRadius: rs(10), padding: rs(14),
    alignItems: 'center', marginTop: rs(12),
  },
  sendBtnText: { color: '#FFF', fontSize: rs(16), fontWeight: '700' },

  // Camera placeholder
  cameraPlaceholder: {
    alignItems: 'center', marginTop: rs(20), padding: rs(20),
    backgroundColor: '#1A1A2E', borderRadius: rs(16), borderWidth: 1,
    borderColor: '#333', borderStyle: 'dashed',
  },
  cameraIcon: { fontSize: rs(40), marginBottom: rs(8) },
  cameraText: { color: '#666', fontSize: rs(14) },
  cameraSub: { color: '#444', fontSize: rs(11), marginTop: rs(4) },
});

export default QRPayNearby;
