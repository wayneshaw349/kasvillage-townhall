// PayNearby.tsx — KasVillage QR Code + WiFi Hotspot PayNearby
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
import { Linking } from 'react-native';
import { IOUBalanceSheetModal as IOUBalanceSheetShare } from './IOUBalanceSheetShare';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { sha256 } from '@noble/hashes/sha256';
import { schnorr } from '@noble/curves/secp256k1';
import * as secp from '@noble/secp256k1';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKaspaPrice } from './useKaspaPrice';
import { useBluetoothPay } from './bluetooth_p2p';
import { createProposal, decodeProposal, verifyProposal, acceptProposal, shareProposal, shareAcceptance } from './proposal_share';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const rs = (size: number) => Math.round((size * SCREEN_WIDTH) / 375);

// ============================================================================
// TYPES
// ============================================================================

type Mode = 'choose' | 'ble_send' | 'ble_receive' | 'send_proposal' | 'receive_proposal' | 'tally' | 'catalog' | 'shop' | 'verify';
interface CatalogItem { id: string; name: string; priceKas: number; }
interface CartLine { item: CatalogItem; qty: number; }

interface QRPayload {
  requestAmountKAS?: number;
  bleUUID?: string;
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

export const QRPayNearby: React.FC<{ onClose: () => void; onNavigateSend?: (addr?: string, sompi?: number) => void }> = ({ onClose, onNavigateSend }) => {
  const [mode, setMode] = useState<Mode>('choose');
  const [showIOUSheet, setShowIOUSheet] = useState(false);
  const [requestedAmt, setRequestedAmt] = useState(0);
  const [address, setAddress] = useState('');
  const [pubkey, setPubkey] = useState('');
  const [apt, setApt] = useState('APT-...');
  const [network, setNetwork] = useState('testnet-10');
  const [avatarName, setAvatarName] = useState('Villager');
  const [requestAmount, setRequestAmount] = useState('');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [storeName, setStoreName] = useState('');
  const [storeLocation, setStoreLocation] = useState('');
  const [itemQR, setItemQR] = useState<{ name: string; data: string } | null>(null);
  useEffect(() => { (async () => { try { const sn = await AsyncStorage.getItem('kv_store_name'); if (sn) setStoreName(sn); const sl = await AsyncStorage.getItem('kv_store_location'); if (sl) setStoreLocation(sl); } catch {} })(); }, []);
  const kasPrice = (() => { try { return useKaspaPrice(); } catch { return null as any; } })();
  useEffect(() => { (async () => { try { const c = await AsyncStorage.getItem('kv_store_catalog'); if (c) setCatalog(JSON.parse(c)); } catch {} })(); }, []);
  const saveCatalog = useCallback(async (items: CatalogItem[]) => { setCatalog(items); try { await AsyncStorage.setItem('kv_store_catalog', JSON.stringify(items)); } catch {} }, []);
  const cartTotal = cart.reduce((s, l) => s + l.item.priceKas * l.qty, 0);
  const addToCart = (item: CatalogItem) => setCart(prev => { const ex = prev.find(l => l.item.id === item.id); return ex ? prev.map(l => l.item.id === item.id ? { ...l, qty: l.qty + 1 } : l) : [...prev, { item, qty: 1 }]; });
  const [cameraActive, setCameraActive] = useState(false);
  const [receiptQR, setReceiptQR] = useState('');
  const [receiptItems, setReceiptItems] = useState<CartLine[]>([]);
  const [verifyResult, setVerifyResult] = useState<'valid'|'invalid'|null>(null);
  const [scannedReceipt, setScannedReceipt] = useState<any>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const bytesToHex = (b: Uint8Array) => Array.from(b).map(x => x.toString(16).padStart(2,'0')).join('');
  const hexToBytesQ = (h: string) => { const a = new Uint8Array(h.length/2); for (let i=0;i<a.length;i++) a[i]=parseInt(h.substr(i*2,2),16); return a; };
  const signItem = async (id: string, name: string, priceKas: number): Promise<{ sig: string; pubkey: string } | null> => {
    try {
      const { loadMainWallet } = await import('./kasvillage_cold_wallet');
      const w = await (loadMainWallet as any)();
      if (!w?.privKeyHex) return null;
      const priv = hexToBytesQ(w.privKeyHex);
      const msg = sha256(new TextEncoder().encode(`${id}|${name}|${priceKas}`));
      const sig = schnorr.sign(msg, priv);
      const xonly = bytesToHex(schnorr.getPublicKey(priv));
      return { sig: bytesToHex(sig), pubkey: xonly };
    } catch (e) { console.warn('[ItemSign] failed:', e); return null; }
  };
  const verifyItem = (id: string, name: string, priceKas: number, sig: string, pubkey: string): boolean => {
    try {
      const msg = sha256(new TextEncoder().encode(`${id}|${name}|${priceKas}`));
      return schnorr.verify(hexToBytesQ(sig), msg, hexToBytesQ(pubkey));
    } catch { return false; }
  };
  const buildReceiptHash = (lines: CartLine[], txId: string) => {
    const canonical = JSON.stringify(lines.sort((a,b)=>a.item.id.localeCompare(b.item.id)).map(l=>({id:l.item.id,name:l.item.name,priceKas:l.item.priceKas,qty:l.qty})));
    return bytesToHex(sha256(new TextEncoder().encode(canonical + txId)));
  };
  const removeFromCart = (id: string) => setCart(prev => prev.map(l => l.item.id === id ? { ...l, qty: l.qty - 1 } : l).filter(l => l.qty > 0));
  const [pasteInput, setPasteInput] = useState('');
  const [resolvedAddress, setResolvedAddress] = useState('');
  const { scanning, advertising, payees, startReceiving, stopReceiving, startScanning, stopScanning } = useBluetoothPay();
  const [selectedPeer, setSelectedPeer] = useState<any>(null);
  const [proposalAmount, setProposalAmount] = useState('');
  const [proposalDesc, setProposalDesc] = useState('');
  const [proposalSending, setProposalSending] = useState(false);
  const [incomingText, setIncomingText] = useState('');
  const [incomingProposal, setIncomingProposal] = useState<any>(null);
  const [proposalVerified, setProposalVerified] = useState(false);

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
    bleUUID: '6b617376-696c-6c61-6765-000000000001',
    requestAmountKAS: parseFloat(requestAmount) || 0,
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
        {showIOUSheet && <IOUBalanceSheetShare visible={true} onClose={() => setShowIOUSheet(false)} />}
        <Text style={styles.title}>📡 Pay Nearby</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* Mode Selector */}
        {mode === 'choose' && (
          <View style={styles.modeContainer}>
            <Text style={styles.modeTitle}>How would you like to connect?</Text>

            

            

            {/* Bluetooth Option */}
            <View style={{ marginTop: rs(8), borderTopWidth: 1, borderTopColor: '#222', paddingTop: rs(12) }}>
              <Text style={{ color: '#666', fontSize: rs(11), textAlign: 'center', marginBottom: rs(8) }}>Pair via QR + Bluetooth — works iPhone & Android</Text>
              <View style={{ flexDirection: 'row', gap: rs(8) }}>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#1A1A2E', borderRadius: rs(12), padding: rs(14), alignItems: 'center', borderWidth: 1, borderColor: '#4169E1' }}
                  onPress={() => { setMode('ble_receive'); try { startReceiving(address, avatarName); } catch(e) { console.warn('[BLE] Not available:', e); } }}
                >
                  <Text style={{ color: '#4169E1', fontSize: rs(13), fontWeight: '600' }}>📶 BLE Receive</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#1A1A2E', borderRadius: rs(12), padding: rs(14), alignItems: 'center', borderWidth: 1, borderColor: '#4CAF50' }}
                  onPress={() => { setMode('ble_send'); try { startScanning(20000); } catch(e) { console.warn('[BLE] Not available:', e); } }}
                >
                  <Text style={{ color: '#4CAF50', fontSize: rs(13), fontWeight: '600' }}>📶 BLE Send</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={{ marginTop: rs(8), backgroundColor: '#1A1A2E', borderRadius: rs(12), padding: rs(14), alignItems: 'center', borderWidth: 1, borderColor: '#49d6aa' }} onPress={() => setMode('tally')}>
                <Text style={{ color: '#49d6aa', fontSize: rs(13), fontWeight: '600' }}>🧮 Store Tally / Cash Register</Text>
              </TouchableOpacity>
            

            <TouchableOpacity style={{ marginTop: rs(8), backgroundColor: '#1A1A2E', borderRadius: rs(12), padding: rs(14), alignItems: 'center', borderWidth: 1, borderColor: '#49d6aa' }} onPress={() => { setCart([]); setMode('shop'); }}>
                <Text style={{ color: '#49d6aa', fontSize: rs(13), fontWeight: '600' }}>Shop Here (scan items)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ marginTop: rs(8), backgroundColor: '#1A1A2E', borderRadius: rs(12), padding: rs(14), alignItems: 'center', borderWidth: 1, borderColor: '#e74c3c' }} onPress={() => setMode('verify')}>
                <Text style={{ color: '#e74c3c', fontSize: rs(13), fontWeight: '600' }}>🔍 Security Verify</Text>
              </TouchableOpacity>
            {/* Hotspot Info */}
            <View style={styles.hotspotCard}>
              <Text style={styles.hotspotTitle}>📶 Works Offline!</Text>
              <Text style={styles.hotspotText}>
                No internet? One phone creates a WiFi hotspot, the other connects. Then scan QR to exchange addresses. Settlement broadcasts when internet returns.
              </Text>
              <Text style={styles.hotspotSteps}>
                1. Tap below to open Hotspot settings{'\n'}
                2. Other phone connects to your hotspot{'\n'}
                3. Show/Scan QR code{'\n'}
                4. Trade offline!
              </Text>
            <TouchableOpacity
                style={{ backgroundColor: '#10B981', borderRadius: rs(10), padding: rs(12), marginTop: rs(10), alignItems: 'center' }}
                onPress={() => {
                  if (Platform.OS === 'ios') {
                    Alert.alert('Turn On Hotspot', 'Go to Settings > Personal Hotspot > Toggle ON\n\nOr use Control Center (swipe down).', [{ text: 'Got it' }]);
                  } else {
                    Linking.sendIntent('android.settings.TETHERING_SETTINGS').catch(() => { Alert.alert('Hotspot', 'Go to Settings > Mobile Hotspot > Turn On'); });
                  }
                }}
              >
                <Text style={{ color: '#FFF', fontSize: rs(14), fontWeight: '700' }}>📶 Open Hotspot Settings</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* SEND PROPOSAL */}
        {mode === 'send_proposal' && (
          <View>
            <TouchableOpacity onPress={() => setMode('choose')} style={{ marginBottom: rs(12) }}>
              <Text style={{ color: '#F59E0B', fontSize: rs(14) }}>← Back</Text>
            </TouchableOpacity>
            <Text style={{ color: '#FFF', fontSize: rs(18), fontWeight: '700', marginBottom: rs(16) }}>Create Signed Proposal</Text>

            <View style={{ backgroundColor: '#1A1A2E', borderRadius: rs(16), padding: rs(16), borderWidth: 1, borderColor: '#333' }}>
              <Text style={{ color: '#888', fontSize: rs(12), marginBottom: rs(6) }}>Amount (KAS)</Text>
              <TextInput
                style={{ backgroundColor: '#0A0A14', borderRadius: rs(10), padding: rs(14), color: '#FFF', fontSize: rs(20), fontWeight: '700', textAlign: 'center', borderWidth: 1, borderColor: '#333', marginBottom: rs(12) }}
                placeholder="0.00"
                placeholderTextColor="#555"
                value={proposalAmount}
                onChangeText={setProposalAmount}
                keyboardType="decimal-pad"
              />
              <Text style={{ color: '#888', fontSize: rs(12), marginBottom: rs(6) }}>What for?</Text>
              <TextInput
                style={{ backgroundColor: '#0A0A14', borderRadius: rs(10), padding: rs(14), color: '#FFF', fontSize: rs(14), borderWidth: 1, borderColor: '#333', marginBottom: rs(12) }}
                placeholder="Coffee, goods, services..."
                placeholderTextColor="#555"
                value={proposalDesc}
                onChangeText={setProposalDesc}
              />
              <TouchableOpacity
                style={{ backgroundColor: proposalAmount && !proposalSending ? '#F59E0B' : '#333', borderRadius: rs(12), padding: rs(16), alignItems: 'center' }}
                onPress={async () => {
                  const n = parseFloat(proposalAmount);
                  if (isNaN(n) || n <= 0) { Alert.alert('Error', 'Enter a valid amount'); return; }
                  setProposalSending(true);
                  const result = await createProposal('pay', n, proposalDesc || 'KAS payment');
                  setProposalSending(false);
                  if ('error' in result) { Alert.alert('Error', result.error); return; }
                  await shareProposal(result.encoded, n);
                  setProposalAmount('');
                  setProposalDesc('');
                  setMode('choose');
                }}
                disabled={!proposalAmount || proposalSending}
              >
                <Text style={{ color: proposalAmount ? '#000' : '#666', fontSize: rs(16), fontWeight: '700' }}>
                  {proposalSending ? 'Signing...' : '📤 Sign & Share Proposal'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ backgroundColor: '#0D2818', borderRadius: rs(12), padding: rs(12), marginTop: rs(12), borderWidth: 1, borderColor: '#10B981' }}>
              <Text style={{ color: '#10B981', fontSize: rs(11) }}>
                ✓ Signed with your ephemeral key{'\n'}
                ✓ Balance verified before sharing{'\n'}
                ✓ Expires in 24 hours{'\n'}
                ✓ No private keys in the message
              </Text>
            </View>
          </View>
        )}

        {/* RECEIVE PROPOSAL */}
        {mode === 'receive_proposal' && (
          <View>
            <TouchableOpacity onPress={() => { setMode('choose'); setIncomingProposal(null); setIncomingText(''); setProposalVerified(false); }} style={{ marginBottom: rs(12) }}>
              <Text style={{ color: '#F59E0B', fontSize: rs(14) }}>← Back</Text>
            </TouchableOpacity>
            <Text style={{ color: '#FFF', fontSize: rs(18), fontWeight: '700', marginBottom: rs(16) }}>Verify Proposal</Text>

            <View style={{ backgroundColor: '#1A1A2E', borderRadius: rs(16), padding: rs(16), borderWidth: 1, borderColor: '#333' }}>
              <Text style={{ color: '#888', fontSize: rs(12), marginBottom: rs(6) }}>Paste the proposal text (starts with kv1:)</Text>
              <TextInput
                style={{ backgroundColor: '#0A0A14', borderRadius: rs(10), padding: rs(14), color: '#FFF', fontSize: rs(12), minHeight: rs(80), borderWidth: 1, borderColor: '#333', marginBottom: rs(8), fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}
                placeholder="kv1:eyJ2Ijox..."
                placeholderTextColor="#555"
                value={incomingText}
                onChangeText={setIncomingText}
                multiline
              />
              <View style={{ flexDirection: 'row', gap: rs(8) }}>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#333', borderRadius: rs(8), padding: rs(12), alignItems: 'center' }}
                  onPress={async () => {
                    const clip = await Clipboard.getStringAsync();
                    if (clip) setIncomingText(clip);
                  }}
                >
                  <Text style={{ color: '#FFF', fontSize: rs(14) }}>📋 Paste</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#F59E0B', borderRadius: rs(8), padding: rs(12), alignItems: 'center' }}
                  onPress={() => {
                    const decoded = decodeProposal(incomingText.trim());
                    if (!decoded) { Alert.alert('Invalid', 'Could not decode proposal. Make sure you copied the full text.'); return; }
                    const v = verifyProposal(decoded);
                    if (!v.valid) { Alert.alert('Verification Failed', v.error || 'Invalid signature'); return; }
                    setIncomingProposal(decoded);
                    setProposalVerified(true);
                  }}
                >
                  <Text style={{ color: '#000', fontSize: rs(14), fontWeight: '700' }}>🔍 Verify</Text>
                </TouchableOpacity>
              </View>
            </View>

            {proposalVerified && incomingProposal && (
              <View style={{ backgroundColor: '#0D2818', borderRadius: rs(16), padding: rs(16), marginTop: rs(12), borderWidth: 1, borderColor: '#10B981' }}>
                <Text style={{ color: '#10B981', fontSize: rs(16), fontWeight: '700', marginBottom: rs(8) }}>✅ Proposal Verified</Text>
                <Text style={{ color: '#FFF', fontSize: rs(14) }}>From: {incomingProposal.fromName} ({incomingProposal.fromAPT})</Text>
                <Text style={{ color: '#FFF', fontSize: rs(20), fontWeight: '900', marginTop: rs(8) }}>
                  {(Number(incomingProposal.amount) / 1e8).toFixed(2)} KAS
                </Text>
                <Text style={{ color: '#AAA', fontSize: rs(12), marginTop: rs(4) }}>{incomingProposal.desc}</Text>
                <Text style={{ color: '#666', fontSize: rs(10), marginTop: rs(4) }}>Network: {incomingProposal.net}</Text>
                <Text style={{ color: '#666', fontSize: rs(10) }}>Address: {incomingProposal.fromAddr.slice(0, 35)}...</Text>

                <TouchableOpacity
                  style={{ backgroundColor: '#10B981', borderRadius: rs(12), padding: rs(16), alignItems: 'center', marginTop: rs(12) }}
                  onPress={async () => {
                    const result = await acceptProposal(incomingProposal);
                    if ('error' in result) { Alert.alert('Error', result.error); return; }
                    const amtKAS = Number(incomingProposal.amount) / 1e8;
                    await shareAcceptance(result.encoded, amtKAS);
                    Alert.alert('Accepted!', 'Counter-signed acceptance shared. The sender can now complete the transaction.');
                    setMode('choose');
                    setIncomingProposal(null);
                    setIncomingText('');
                    setProposalVerified(false);
                  }}
                >
                  <Text style={{ color: '#FFF', fontSize: rs(16), fontWeight: '700' }}>✓ Accept & Counter-Sign</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ backgroundColor: '#333', borderRadius: rs(12), padding: rs(14), alignItems: 'center', marginTop: rs(8) }}
                  onPress={() => { setIncomingProposal(null); setProposalVerified(false); }}
                >
                  <Text style={{ color: '#FF6B6B', fontSize: rs(14) }}>✗ Reject</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* SHOP MODE - customer scans items */}
        {mode === 'shop' && (
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(12) }}>
              <TouchableOpacity onPress={() => { setCameraActive(false); setMode('choose'); setCart([]); }}>
                <Text style={{ color: '#F59E0B', fontSize: rs(14) }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ color: '#49d6aa', fontSize: rs(16), fontWeight: '700' }}>Scan Items</Text>
              <Text style={{ color: '#FFF', fontSize: rs(14) }}>{cart.length} items</Text>
            </View>
            {!cameraPermission?.granted ? (
              <TouchableOpacity onPress={requestCameraPermission} style={{ backgroundColor: '#49d6aa', borderRadius: rs(10), padding: rs(14), alignItems: 'center' }}>
                <Text style={{ color: '#000', fontWeight: '700' }}>Allow Camera</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ borderRadius: rs(12), overflow: 'hidden', height: rs(240) }}>
                <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={({ data }) => {
                    try {
                      const parsed = JSON.parse(data);
                      if (parsed.type === 'kv_item' && parsed.id) {
                        if (!parsed.sig || !parsed.pubkey || !verifyItem(parsed.id, parsed.name, parsed.priceKas, parsed.sig, parsed.pubkey)) { console.warn('[Shop] Rejected unsigned/forged item:', parsed.id); return; }
                        addToCart({ id: parsed.id, name: parsed.name, priceKas: parsed.priceKas });
                      }
                    } catch {}
                  }}
                />
              </View>
            )}
            {cart.length > 0 && (
              <View style={{ marginTop: rs(12), backgroundColor: '#0D0D1A', borderRadius: rs(12), padding: rs(14) }}>
                <Text style={{ color: '#49d6aa', fontWeight: '700', marginBottom: rs(8), fontSize: rs(13) }}>Cart</Text>
                {cart.map(line => (
                  <View key={line.item.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: rs(4) }}>
                    <Text style={{ color: '#FFF', fontSize: rs(12) }}>{line.item.name} x{line.qty}</Text>
                    <Text style={{ color: '#87CEEB', fontSize: rs(12) }}>{(line.item.priceKas * line.qty).toFixed(2)} KAS</Text>
                  </View>
                ))}
                <View style={{ borderTopWidth: 1, borderTopColor: '#333', marginTop: rs(8), paddingTop: rs(8), flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: '#FFF', fontWeight: '700', fontSize: rs(14) }}>Total</Text>
                  <Text style={{ color: '#49d6aa', fontWeight: '700', fontSize: rs(14) }}>{cartTotal.toFixed(2)} KAS</Text>
                </View>
                <TouchableOpacity onPress={() => {
                  setCameraActive(false);
                  setRequestAmount(String(cartTotal));
                  setReceiptItems([...cart]);
                  setMode('ble_receive');
                  try { startReceiving(address, avatarName); } catch {}
                }} style={{ marginTop: rs(12), backgroundColor: '#49d6aa', borderRadius: rs(10), padding: rs(14), alignItems: 'center' }}>
                  <Text style={{ color: '#000', fontWeight: '700', fontSize: rs(14) }}>Finish Shopping — Pay {cartTotal.toFixed(2)} KAS</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        {/* VERIFY MODE - security scans receipt QR */}
        {mode === 'verify' && (
          <View>
            <TouchableOpacity onPress={() => { setMode('choose'); setVerifyResult(null); setScannedReceipt(null); }} style={{ marginBottom: rs(12) }}>
              <Text style={{ color: '#F59E0B', fontSize: rs(14) }}>Back</Text>
            </TouchableOpacity>
            <Text style={{ color: '#FFF', fontSize: rs(18), fontWeight: '700', marginBottom: rs(12) }}>Security Verify</Text>
            {!verifyResult ? (
              !cameraPermission?.granted ? (
                <TouchableOpacity onPress={requestCameraPermission} style={{ backgroundColor: '#49d6aa', borderRadius: rs(10), padding: rs(14), alignItems: 'center' }}>
                  <Text style={{ color: '#000', fontWeight: '700' }}>Allow Camera</Text>
                </TouchableOpacity>
              ) : (
                <View>
                  <Text style={{ color: '#888', fontSize: rs(12), textAlign: 'center', marginBottom: rs(8) }}>Scan customer receipt QR</Text>
                  <View style={{ borderRadius: rs(12), overflow: 'hidden', height: rs(260) }}>
                    <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                      onBarcodeScanned={({ data }) => {
                        try {
                          const r = JSON.parse(data);
                          if (r.type === 'kv_receipt' && r.hash && r.txId) {
                            setScannedReceipt(r);
                            const recheck = buildReceiptHash(r.items, r.txId);
                            setVerifyResult(recheck === r.hash ? 'valid' : 'invalid');
                          }
                        } catch {}
                      }}
                    />
                  </View>
                </View>
              )
            ) : (
              <View style={{ borderRadius: rs(16), padding: rs(20), alignItems: 'center', backgroundColor: verifyResult === 'valid' ? '#0D2818' : '#2a0a0a', borderWidth: 2, borderColor: verifyResult === 'valid' ? '#10B981' : '#e74c3c' }}>
                <Text style={{ fontSize: rs(48) }}>{verifyResult === 'valid' ? '✅' : '❌'}</Text>
                <Text style={{ color: verifyResult === 'valid' ? '#10B981' : '#e74c3c', fontSize: rs(22), fontWeight: '900', marginTop: rs(8) }}>{verifyResult === 'valid' ? 'PAID & VERIFIED' : 'INVALID RECEIPT'}</Text>
                {scannedReceipt && verifyResult === 'valid' && (
                  <View style={{ marginTop: rs(12), width: '100%' }}>
                    {scannedReceipt.store?.name ? <Text style={{ color: '#FFF', fontWeight: '700', fontSize: rs(14), marginBottom: rs(6) }}>{scannedReceipt.store.name}{scannedReceipt.store.location ? ' — ' + scannedReceipt.store.location : ''}</Text> : null}
                    <Text style={{ color: '#49d6aa', fontWeight: '700', marginBottom: rs(6), fontSize: rs(13) }}>Items paid for:</Text>
                    {scannedReceipt.items?.map((l: CartLine) => (
                      <View key={l.item.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: rs(4) }}>
                        <Text style={{ color: '#FFF', fontSize: rs(12) }}>{l.item.name} x{l.qty}</Text>
                        <Text style={{ color: '#87CEEB', fontSize: rs(12) }}>{(l.item.priceKas * l.qty).toFixed(2)} KAS</Text>
                      </View>
                    ))}
                    <Text style={{ color: '#FFF', fontWeight: '700', marginTop: rs(8) }}>TX: {scannedReceipt.txId?.slice(0,20)}...</Text>
                  </View>
                )}
                <TouchableOpacity onPress={() => { setVerifyResult(null); setScannedReceipt(null); }} style={{ marginTop: rs(16), backgroundColor: '#333', borderRadius: rs(10), padding: rs(12), alignItems: 'center', width: '100%' }}>
                  <Text style={{ color: '#FFF', fontSize: rs(13) }}>Scan Next Customer</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        {/* STORE TALLY */}
        {mode === 'tally' && (
          <View>
            <TouchableOpacity onPress={() => setMode('choose')} style={{ marginBottom: rs(12) }}>
              <Text style={{ color: '#F59E0B', fontSize: rs(14) }}>Back</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(12) }}>
              <Text style={{ color: '#49d6aa', fontSize: rs(18), fontWeight: '700' }}>Cash Register</Text>
              <TouchableOpacity onPress={() => setMode('catalog')} style={{ backgroundColor: '#1A1A2E', borderRadius: rs(8), paddingVertical: rs(6), paddingHorizontal: rs(12), borderWidth: 1, borderColor: '#333' }}>
                <Text style={{ color: '#87CEEB', fontSize: rs(12) }}>Manage Items</Text>
              </TouchableOpacity>
            </View>
            {catalog.length === 0 && <Text style={{ color: '#666', textAlign: 'center', marginVertical: rs(20), fontSize: rs(13) }}>No items yet. Tap Manage Items to add.</Text>}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: rs(8) }}>
              {catalog.map(item => (
                <TouchableOpacity key={item.id} onPress={() => addToCart(item)} style={{ backgroundColor: '#1A1A2E', borderRadius: rs(10), padding: rs(12), borderWidth: 1, borderColor: '#333', minWidth: '30%' }}>
                  <Text style={{ color: '#FFF', fontSize: rs(13), fontWeight: '600' }}>{item.name}</Text>
                  <Text style={{ color: '#49d6aa', fontSize: rs(12) }}>{item.priceKas} KAS</Text>
                </TouchableOpacity>
              ))}
            </View>
            {cart.length > 0 && (
              <View style={{ marginTop: rs(16), backgroundColor: '#0D0D1A', borderRadius: rs(12), padding: rs(14) }}>
                <Text style={{ color: '#49d6aa', fontSize: rs(14), fontWeight: '700', marginBottom: rs(8) }}>Cart</Text>
                {cart.map(line => (
                  <View key={line.item.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(6) }}>
                    <Text style={{ color: '#FFF', fontSize: rs(13), flex: 1 }}>{line.item.name} x{line.qty}</Text>
                    <Text style={{ color: '#87CEEB', fontSize: rs(13), marginRight: rs(10) }}>{(line.item.priceKas * line.qty).toFixed(2)}</Text>
                    <TouchableOpacity onPress={() => removeFromCart(line.item.id)}><Text style={{ color: '#FF6B6B', fontSize: rs(16) }}>-</Text></TouchableOpacity>
                  </View>
                ))}
                <View style={{ borderTopWidth: 1, borderTopColor: '#333', marginTop: rs(8), paddingTop: rs(8), flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: '#FFF', fontSize: rs(15), fontWeight: '700' }}>Total</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: '#49d6aa', fontSize: rs(15), fontWeight: '700' }}>{cartTotal.toFixed(2)} KAS</Text>
                    {kasPrice?.usdPerKas > 0 && <Text style={{ color: '#666', fontSize: rs(11) }}>~${(cartTotal * kasPrice.usdPerKas).toFixed(2)}</Text>}
                  </View>
                </View>
                <TouchableOpacity onPress={() => { setRequestAmount(String(cartTotal)); setReceiptItems([...cart]); setCart([]); setMode('ble_receive'); try { startReceiving(address, avatarName); } catch {} }} style={{ marginTop: rs(12), backgroundColor: '#49d6aa', borderRadius: rs(10), padding: rs(14), alignItems: 'center' }}>
                  <Text style={{ color: '#000', fontSize: rs(14), fontWeight: '700' }}>Charge {cartTotal.toFixed(2)} KAS</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        {/* CATALOG */}
        {mode === 'catalog' && (
          <View>
            <TouchableOpacity onPress={() => setMode('tally')} style={{ marginBottom: rs(12) }}>
              <Text style={{ color: '#F59E0B', fontSize: rs(14) }}>Back to Register</Text>
            </TouchableOpacity>
            {itemQR && (<View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 999, alignItems: 'center', justifyContent: 'center' }}><View style={{ backgroundColor: '#1A1A2E', borderRadius: rs(16), padding: rs(20), alignItems: 'center' }}><Text style={{ color: '#FFF', fontSize: rs(16), fontWeight: '700', marginBottom: rs(12) }}>{itemQR.name}</Text><View style={{ backgroundColor: '#FFF', padding: rs(12), borderRadius: rs(10) }}><QRCode value={itemQR.data} size={rs(200)} /></View><Text style={{ color: '#87CEEB', fontSize: rs(10), marginTop: rs(10), textAlign: 'center' }}>Print + place on item. Signed — tamper-proof.</Text><TouchableOpacity onPress={() => setItemQR(null)} style={{ marginTop: rs(14), backgroundColor: '#49d6aa', borderRadius: rs(10), padding: rs(12), paddingHorizontal: rs(30) }}><Text style={{ color: '#000', fontWeight: '700' }}>Close</Text></TouchableOpacity></View></View>)}
            <Text style={{ color: '#49d6aa', fontSize: rs(18), fontWeight: '700', marginBottom: rs(12) }}>Store Setup</Text>
            <TextInput value={storeName} onChangeText={(t) => { setStoreName(t); AsyncStorage.setItem('kv_store_name', t).catch(()=>{}); }} placeholder="Store name" placeholderTextColor="#666" style={{ backgroundColor: '#1A1A2E', color: '#FFF', borderRadius: rs(8), padding: rs(10), borderWidth: 1, borderColor: '#333', marginBottom: rs(8) }} />
            <TextInput value={storeLocation} onChangeText={(t) => { setStoreLocation(t); AsyncStorage.setItem('kv_store_location', t).catch(()=>{}); }} placeholder="Location (address or city)" placeholderTextColor="#666" style={{ backgroundColor: '#1A1A2E', color: '#FFF', borderRadius: rs(8), padding: rs(10), borderWidth: 1, borderColor: '#333', marginBottom: rs(8) }} />
            <TouchableOpacity onPress={() => Linking.openURL('https://kasmap.org')} style={{ backgroundColor: '#1A1A2E', borderRadius: rs(8), padding: rs(12), alignItems: 'center', marginBottom: rs(16), borderWidth: 1, borderColor: '#49d6aa' }}>
              <Text style={{ color: '#49d6aa', fontSize: rs(13), fontWeight: '600' }}>List your store on KasMap</Text>
            </TouchableOpacity>
            <Text style={{ color: '#49d6aa', fontSize: rs(16), fontWeight: '700', marginBottom: rs(12) }}>Item Catalog</Text>
            <View style={{ flexDirection: 'row', gap: rs(8), marginBottom: rs(12) }}>
              <TextInput value={newItemName} onChangeText={setNewItemName} placeholder="Item name" placeholderTextColor="#666" style={{ flex: 2, backgroundColor: '#1A1A2E', color: '#FFF', borderRadius: rs(8), padding: rs(10), borderWidth: 1, borderColor: '#333' }} />
              <TextInput value={newItemPrice} onChangeText={setNewItemPrice} placeholder="KAS" placeholderTextColor="#666" keyboardType="decimal-pad" style={{ flex: 1, backgroundColor: '#1A1A2E', color: '#FFF', borderRadius: rs(8), padding: rs(10), borderWidth: 1, borderColor: '#333' }} />
            </View>
            <TouchableOpacity onPress={() => { const p = parseFloat(newItemPrice); if (!newItemName.trim() || !(p > 0)) { Alert.alert('Invalid', 'Enter name and price'); return; } saveCatalog([...catalog, { id: 'i' + Date.now(), name: newItemName.trim(), priceKas: p }]); setNewItemName(''); setNewItemPrice(''); }} style={{ backgroundColor: '#49d6aa', borderRadius: rs(10), padding: rs(12), alignItems: 'center', marginBottom: rs(16) }}>
              <Text style={{ color: '#000', fontSize: rs(14), fontWeight: '700' }}>Add Item</Text>
            </TouchableOpacity>
            {catalog.map(item => (
              <View key={item.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1A1A2E', borderRadius: rs(10), padding: rs(12), marginBottom: rs(8) }}>
                <Text style={{ color: '#FFF', fontSize: rs(13) }}>{item.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs(12) }}>
                  <Text style={{ color: '#49d6aa', fontSize: rs(13) }}>{item.priceKas} KAS</Text>
                  <TouchableOpacity onPress={async () => { const s = await signItem(item.id, item.name, item.priceKas); if (!s) { Alert.alert('Error', 'Could not sign item'); return; } setItemQR({ name: item.name, data: JSON.stringify({ type: 'kv_item', id: item.id, name: item.name, priceKas: item.priceKas, sig: s.sig, pubkey: s.pubkey }) }); }}><Text style={{ color: '#49d6aa', fontSize: rs(13), marginRight: rs(10) }}>Show QR</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => saveCatalog(catalog.filter(c => c.id !== item.id))}><Text style={{ color: '#FF6B6B', fontSize: rs(14) }}>Delete</Text></TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
        {/* BLE RECEIVE */}
        {mode === 'ble_receive' && (
          <View style={{ alignItems: 'center' }}>
            <TouchableOpacity onPress={() => { stopReceiving(); setMode('choose'); }} style={{ alignSelf: 'flex-start', marginBottom: rs(12) }}>
              <Text style={{ color: '#F59E0B', fontSize: rs(14) }}>← Back to QR</Text>
            </TouchableOpacity>
            <View style={{ backgroundColor: '#1A1A2E', borderWidth: 2, borderColor: '#4169E1', borderRadius: rs(16), padding: rs(24), alignItems: 'center', width: '100%' }}>
              {advertising && <Text style={{ color: '#4169E1', fontSize: rs(40), marginBottom: rs(12) }}>📡</Text>}
              <Text style={{ color: '#4169E1', fontSize: rs(18), fontWeight: '700' }}>
                {advertising ? 'Broadcasting...' : 'Starting BLE...'}
              </Text>
              <Text style={{ color: '#87CEEB', fontSize: rs(12), marginTop: rs(8), textAlign: 'center' }}>
                Your address is visible to nearby senders via Bluetooth
              </Text>
              <Text style={{ color: '#666', fontSize: rs(10), marginTop: rs(12), textAlign: 'center' }}>{address}</Text>
              <View style={{ backgroundColor: '#FFF', padding: rs(12), borderRadius: rs(10), marginTop: rs(16) }}>
                <QRCode value={qrPayload} size={rs(180)} />
              </View>
              <Text style={{ color: '#87CEEB', fontSize: rs(10), marginTop: rs(8), textAlign: 'center' }}>Scan to connect + get address{parseFloat(requestAmount) > 0 ? ' + ' + requestAmount + ' KAS request' : ''}</Text>
              <TextInput value={requestAmount} onChangeText={setRequestAmount} placeholder="Request amount (KAS)" placeholderTextColor="#666" keyboardType="decimal-pad" style={{ width: '100%', backgroundColor: '#0D0D1A', color: '#FFF', borderRadius: rs(10), padding: rs(10), marginTop: rs(12), borderWidth: 1, borderColor: '#333', textAlign: 'center' }} />
              {receiptItems.length > 0 && (
                <View style={{ marginTop: rs(14), backgroundColor: '#0D2818', borderRadius: rs(12), padding: rs(14), width: '100%', alignItems: 'center', borderWidth: 1, borderColor: '#10B981' }}>
                  <Text style={{ color: '#10B981', fontWeight: '700', fontSize: rs(13), marginBottom: rs(8) }}>Deterministic Receipt</Text>
                  <View style={{ backgroundColor: '#FFF', padding: rs(10), borderRadius: rs(8) }}>
                    <QRCode value={JSON.stringify({ type: 'kv_receipt', items: receiptItems, txId: (globalThis as any).__kvLastTxId || 'PENDING', hash: buildReceiptHash(receiptItems, (globalThis as any).__kvLastTxId || 'PENDING'), store: { name: storeName, location: storeLocation } })} size={rs(150)} />
                  </View>
                  <Text style={{ color: '#87CEEB', fontSize: rs(10), marginTop: rs(8), textAlign: 'center' }}>Show at exit — security scans to verify payment</Text>
                  <TouchableOpacity onPress={() => setReceiptItems([])} style={{ marginTop: rs(8) }}><Text style={{ color: '#666', fontSize: rs(11) }}>Clear receipt</Text></TouchableOpacity>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', gap: rs(8), marginTop: rs(14), width: '100%' }}>
              <TouchableOpacity style={{ flex: 1, backgroundColor: '#F59E0B', borderRadius: rs(12), padding: rs(14), alignItems: 'center' }} onPress={() => { stopReceiving(); setMode('send_proposal'); }}>
                <Text style={{ color: '#000', fontWeight: '700', fontSize: rs(14) }}>Send KAS</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, backgroundColor: '#1A1A2E', borderRadius: rs(12), padding: rs(14), alignItems: 'center', borderWidth: 1, borderColor: '#D4AF37' }} onPress={() => { stopReceiving(); setShowIOUSheet(true); }}>
                <Text style={{ color: '#D4AF37', fontWeight: '700', fontSize: rs(14) }}>Create IOU</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={{ marginTop: rs(16), backgroundColor: '#333', borderRadius: rs(10), paddingVertical: rs(12), paddingHorizontal: rs(24) }}
              onPress={() => { stopReceiving(); setMode('choose'); }}
            >
              <Text style={{ color: '#FFF', fontSize: rs(14) }}>Stop Receiving</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* BLE SEND */}
        {mode === 'ble_send' && (
          <View>
            <TouchableOpacity onPress={() => { stopScanning(); setMode('choose'); }} style={{ marginBottom: rs(12) }}>
              <Text style={{ color: '#F59E0B', fontSize: rs(14) }}>← Back to QR</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: rs(12) }}>
              <Text style={{ color: '#4CAF50', fontSize: rs(16), fontWeight: '700' }}>
                {scanning ? 'Scanning... ' : 'Scan complete '}
              </Text>
              <Text style={{ color: '#4CAF50', fontSize: rs(14) }}>Found {payees.length} nearby</Text>
              <TouchableOpacity onPress={() => { stopScanning(); setMode('choose'); }} style={{ marginLeft: 'auto' }}>
                <Text style={{ color: '#FF6B6B', fontSize: rs(14) }}>Cancel</Text>
              </TouchableOpacity>
            </View>
            {payees.length === 0 && scanning && (
              <Text style={{ color: '#666', textAlign: 'center', marginTop: rs(30), fontSize: rs(13) }}>
                Looking for nearby KasVillage users...
              </Text>
            )}
            {payees.map((p: any) => (
              <TouchableOpacity
                key={p.id}
                style={{ backgroundColor: '#1A1A1A', borderRadius: rs(12), padding: rs(14), marginBottom: rs(8), borderWidth: 1, borderColor: '#333' }}
                onPress={() => {
                  setResolvedAddress(p.kaspaAddress);
                  stopScanning();
                  setMode('send_proposal');
                  setPasteInput(p.kaspaAddress);
                }}
              >
                <Text style={{ color: '#FFF', fontSize: rs(15), fontWeight: '600' }}>{p.displayName}</Text>
                <Text style={{ color: '#888', fontSize: rs(11), marginTop: rs(2) }}>{p.kaspaAddress.slice(0, 30)}...</Text>
              </TouchableOpacity>
            ))}
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
