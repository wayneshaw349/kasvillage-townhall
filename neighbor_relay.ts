// neighbor_relay.ts
// P2P relay for partial TX exchange in Neighbor Agreements
// Supports: Bluetooth, Same WiFi, Tailscale, KasVillage Akash relay
//
// Flow:
// 1. Party A creates partial sig → posts to relay
// 2. Party B polls/receives → completes + broadcasts
// 3. Both see TX confirmation

import * as SecureStore from 'expo-secure-store';
// LocalServer removed � WiFi P2P not available in Expo Go
const getLocalIP = async (): Promise<string | null> => null;
const LocalP2PServer = null;
import { TailscaleHelper } from './tailscaleHelper';
import { getBluetoothP2P, BluetoothPeer, BluetoothStatus } from './bluetooth_p2p';

// =============================================================================
// CONSTANTS
// =============================================================================

// Akash relay endpoint (KasVillage backend)
const AKASH_RELAY_URL = 'https://relay.kasvillage.dev';
const RELAY_POLL_INTERVAL = 3000; // 3 seconds
const RELAY_TIMEOUT = 600000; // 10 minutes

// =============================================================================
// TYPES
// =============================================================================

export type RelayMethod = 'bluetooth' | 'wifi' | 'tailscale' | 'akash';

export interface PartialTxPayload {
  agreementId: string;
  partialTx: string;
  senderPubkey: string;
  recipientPubkey: string;
  timestamp: number;
  signature?: string; // Optional signature for verification
}

export interface RelayResult {
  success: boolean;
  method?: RelayMethod;
  url?: string;
  peerId?: string;
  error?: string;
}

export interface RelayStatus {
  connected: boolean;
  method: RelayMethod | null;
  localIP?: string;
  tailscaleIP?: string;
  bluetoothAvailable?: boolean;
  bluetoothPeers?: BluetoothPeer[];
}

// =============================================================================
// RELAY STATUS CHECK
// =============================================================================

export async function checkRelayStatus(): Promise<RelayStatus> {
  const [localIP, tailscaleIP] = await Promise.all([
    getLocalIP().catch(() => null),
    TailscaleHelper.getTailscaleIP().catch(() => null),
  ]);
  
  // Check Bluetooth
  let bluetoothAvailable = false;
  try {
    const bt = getBluetoothP2P();
    bluetoothAvailable = await bt.initialize();
  } catch {}
  
  // Priority: Bluetooth > Tailscale > WiFi > Akash
  let method: RelayMethod = 'akash';
  if (bluetoothAvailable) method = 'bluetooth';
  else if (tailscaleIP) method = 'tailscale';
  else if (localIP) method = 'wifi';
  
  return {
    connected: !!(localIP || tailscaleIP || bluetoothAvailable),
    method,
    localIP: localIP ?? undefined,
    tailscaleIP: tailscaleIP ?? undefined,
    bluetoothAvailable,
  };
}

// =============================================================================
// LOCAL P2P SERVER EXTENSION
// =============================================================================

export class NeighborRelayServer extends LocalP2PServer {
  private partialTxStore: Map<string, PartialTxPayload> = new Map();
  private onPartialTxCallback?: (payload: PartialTxPayload) => void;
  
  constructor(port: number = 8788) {
    super({ port });
  }
  
  setPartialTx(agreementId: string, payload: PartialTxPayload): void {
    this.partialTxStore.set(agreementId, payload);
  }
  
  getPartialTx(agreementId: string): PartialTxPayload | null {
    return this.partialTxStore.get(agreementId) ?? null;
  }
  
  onPartialTx(callback: (payload: PartialTxPayload) => void): void {
    this.onPartialTxCallback = callback;
  }
  
  protected handleRequest(raw: string, socket: any): void {
    const [requestLine] = raw.split('\r\n');
    const [method, path] = requestLine.split(' ');
    
    const cors = [
      'Access-Control-Allow-Origin: *',
      'Access-Control-Allow-Methods: GET, POST, OPTIONS',
      'Access-Control-Allow-Headers: Content-Type',
    ].join('\r\n');
    
    if (method === 'OPTIONS') {
      this.sendResponse(socket, 204, '', cors);
      return;
    }
    
    const getMatch = path.match(/^\/api\/neighbor\/([^\/]+)\/partial$/);
    if (method === 'GET' && getMatch) {
      const agreementId = decodeURIComponent(getMatch[1]);
      const payload = this.partialTxStore.get(agreementId);
      
      if (!payload) {
        this.sendResponse(socket, 404, '{"error":"Not found"}', `${cors}\r\nContent-Type: application/json`);
        return;
      }
      
      this.sendResponse(socket, 200, JSON.stringify(payload), `${cors}\r\nContent-Type: application/json`);
      return;
    }
    
    const postMatch = path.match(/^\/api\/neighbor\/([^\/]+)\/partial$/);
    if (method === 'POST' && postMatch) {
      const agreementId = decodeURIComponent(postMatch[1]);
      const bodyStart = raw.indexOf('\r\n\r\n') + 4;
      const body = raw.slice(bodyStart);
      
      try {
        const payload = JSON.parse(body) as PartialTxPayload;
        
        if (!payload.partialTx || !payload.senderPubkey) {
          this.sendResponse(socket, 400, '{"error":"Missing required fields"}', `${cors}\r\nContent-Type: application/json`);
          return;
        }
        
        payload.agreementId = agreementId;
        payload.timestamp = Date.now();
        
        this.partialTxStore.set(agreementId, payload);
        this.onPartialTxCallback?.(payload);
        
        this.sendResponse(socket, 200, '{"success":true}', `${cors}\r\nContent-Type: application/json`);
      } catch (e) {
        this.sendResponse(socket, 400, '{"error":"Invalid JSON"}', `${cors}\r\nContent-Type: application/json`);
      }
      return;
    }
    
    super.handleRequest(raw, socket);
  }
  
  private sendResponse(socket: any, status: number, body: string, headers: string): void {
    const statusText: Record<number, string> = { 200: 'OK', 204: 'No Content', 400: 'Bad Request', 404: 'Not Found' };
    const bodyBytes = new TextEncoder().encode(body);
    const response = [
      `HTTP/1.1 ${status} ${statusText[status] || 'Error'}`,
      headers,
      `Content-Length: ${bodyBytes.length}`,
      'Connection: close',
      '',
      '',
    ].join('\r\n');
    
    socket.write(new TextEncoder().encode(response));
    socket.write(bodyBytes);
    socket.destroy();
  }
}
// =============================================================================
// AKASH RELAY CLIENT
// =============================================================================

async function postToAkashRelay(payload: PartialTxPayload): Promise<RelayResult> {
  try {
    const response = await fetch(`${AKASH_RELAY_URL}/api/neighbor/${payload.agreementId}/partial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 30000); return c.signal; })(),
    });
    
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return { success: false, error: `Relay error: ${response.status} ${text}` };
    }
    
    return {
      success: true,
      method: 'akash',
      url: `${AKASH_RELAY_URL}/api/neighbor/${payload.agreementId}/partial`,
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

async function fetchFromAkashRelay(agreementId: string): Promise<PartialTxPayload | null> {
  try {
    const response = await fetch(`${AKASH_RELAY_URL}/api/neighbor/${agreementId}/partial`, {
      signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 10000); return c.signal; })(),
    });
    
    if (!response.ok) return null;
    
    return await response.json();
  } catch {
    return null;
  }
}

// =============================================================================
// UNIFIED RELAY API
// =============================================================================

/**
 * Post partial TX to relay (auto-selects best method)
 * Priority: Bluetooth > Tailscale > WiFi > Akash
 */
export async function postPartialTx(
  payload: PartialTxPayload,
  preferredMethod?: RelayMethod,
): Promise<RelayResult> {
  const status = await checkRelayStatus();
  const method = preferredMethod ?? status.method ?? 'akash';
  
  console.log(`[Relay] Posting partial TX via ${method}`);
  
  switch (method) {
    case 'bluetooth':
      try {
        const bt = getBluetoothP2P();
        
        // Find peer
        const peer = await bt.findPeer(payload.agreementId, payload.senderPubkey, 30000);
        if (!peer) {
          console.log('[Relay] No Bluetooth peer found, falling back to Akash');
          return postToAkashRelay(payload);
        }
        
        // Connect
        const connected = await bt.connectToPeer(peer.id);
        if (!connected) {
          console.log('[Relay] Bluetooth connect failed, falling back to Akash');
          return postToAkashRelay(payload);
        }
        
        // Send
        const result = await bt.sendPartialTx(payload.partialTx, payload.agreementId);
        
        if (result.success) {
          return {
            success: true,
            method: 'bluetooth',
            peerId: result.peerId,
          };
        } else {
          console.log('[Relay] Bluetooth send failed, falling back to Akash');
          return postToAkashRelay(payload);
        }
      } catch (e) {
        console.error('[Relay] Bluetooth error:', e);
        return postToAkashRelay(payload);
      }
      
    case 'wifi':
    case 'tailscale':
      // For local methods, store in SecureStore for server to pick up
      // The other party will poll our local server
      await SecureStore.setItemAsync(
        `kv_partial_tx_${payload.agreementId}`,
        JSON.stringify(payload)
      );
      
      const ip = method === 'tailscale' ? status.tailscaleIP : status.localIP;
      return {
        success: true,
        method,
        url: `http://${ip}:8788/api/neighbor/${payload.agreementId}/partial`,
      };
      
    case 'akash':
    default:
      return postToAkashRelay(payload);
  }
}

/**
 * Fetch partial TX from relay (tries all methods)
 */
export async function fetchPartialTx(
  agreementId: string,
  relayUrl?: string,
  senderPubkey?: string,
): Promise<PartialTxPayload | null> {
  // If we have a specific URL (from QR/link), use it
  if (relayUrl) {
    try {
      const response = await fetch(relayUrl, { signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 10000); return c.signal; })() });
      if (response.ok) {
        return await response.json();
      }
    } catch {
      // Fall through to other methods
    }
  }
  
  // Try Bluetooth first if available
  try {
    const bt = getBluetoothP2P();
    const initialized = await bt.initialize();
    
    if (initialized && senderPubkey) {
      console.log('[Relay] Trying Bluetooth receive...');
      const peer = await bt.findPeer(agreementId, senderPubkey, 10000);
      
      if (peer) {
        const connected = await bt.connectToPeer(peer.id);
        if (connected) {
          const partialTx = await bt.waitForPartialTx(30000);
          if (partialTx) {
            return {
              agreementId,
              partialTx,
              senderPubkey: peer.pubkey || '',
              recipientPubkey: senderPubkey,
              timestamp: Date.now(),
            };
          }
        }
      }
    }
  } catch (e) {
    console.log('[Relay] Bluetooth fetch failed:', e);
  }
  
  // Check local storage (for WiFi/Tailscale)
  try {
    const stored = await SecureStore.getItemAsync(`kv_partial_tx_${agreementId}`);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {}
  
  // Fall back to Akash relay
  return fetchFromAkashRelay(agreementId);
}

/**
 * Poll for partial TX with timeout
 */
export async function pollForPartialTx(
  agreementId: string,
  relayUrl?: string,
  onReceive?: (payload: PartialTxPayload) => void,
  timeoutMs: number = RELAY_TIMEOUT,
): Promise<PartialTxPayload | null> {
  const startTime = Date.now();
  
  console.log(`[Relay] Polling for partial TX: ${agreementId}`);
  
  while (Date.now() - startTime < timeoutMs) {
    const payload = await fetchPartialTx(agreementId, relayUrl);
    
    if (payload && payload.partialTx) {
      console.log(`[Relay] Received partial TX from ${payload.senderPubkey.slice(0, 8)}...`);
      onReceive?.(payload);
      return payload;
    }
    
    await new Promise(resolve => setTimeout(resolve, RELAY_POLL_INTERVAL));
  }
  
  console.log('[Relay] Polling timeout');
  return null;
}

/**
 * Clear partial TX from relay/storage
 */
export async function clearPartialTx(agreementId: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(`kv_partial_tx_${agreementId}`);
  } catch {}
  
  // Also try to delete from Akash relay
  try {
    await fetch(`${AKASH_RELAY_URL}/api/neighbor/${agreementId}/partial`, {
      method: 'DELETE',
      signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 5000); return c.signal; })(),
    });
  } catch {}
}

// =============================================================================
// QR CODE DATA
// =============================================================================

export interface RelayQRData {
  type: 'neighbor_partial';
  agreementId: string;
  relayUrl: string;
  senderPubkey: string;
  method: RelayMethod;
}

export function generateRelayQRData(
  agreementId: string,
  relayUrl: string,
  senderPubkey: string,
  method: RelayMethod,
): string {
  const data: RelayQRData = {
    type: 'neighbor_partial',
    agreementId,
    relayUrl,
    senderPubkey,
    method,
  };
  return JSON.stringify(data);
}

export function parseRelayQRData(qrData: string): RelayQRData | null {
  try {
    const data = JSON.parse(qrData);
    if (data.type !== 'neighbor_partial') return null;
    return data as RelayQRData;
  } catch {
    return null;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  AKASH_RELAY_URL,
  RELAY_POLL_INTERVAL,
  RELAY_TIMEOUT,
};
