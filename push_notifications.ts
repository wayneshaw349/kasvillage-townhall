// push_notifications.ts
// KasVillage Push Notifications for FROST agreement flow
// Token registered → encrypted with user's pubkey → inscribed on Arweave
// Counterparty queries Arweave for token → decrypts → sends via Expo Push API

import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// ============================================================================
// TYPES
// ============================================================================

export interface PushToken {
  token: string;
  platform: 'ios' | 'android';
  timestamp: number;
}

export type FrostEvent =
  | 'partial_sig_ready'      // Counterparty signed their half
  | 'delivery_confirmed'     // Seller confirmed delivery
  | 'release_available'      // Funds ready to release
  | 'agreement_proposed'     // New agreement incoming
  | 'agreement_accepted'     // Your proposal was accepted
  | 'deadlock_initiated'     // Counterparty initiated deadlock
  | 'r_value_posted'         // Counterparty posted their R (nonce)
  | 'attestation_verified';  // Your attestation was verified

const EVENT_MESSAGES: Record<FrostEvent, { title: string; body: string }> = {
  partial_sig_ready:     { title: '✍️ Signature Ready', body: 'Your counterparty signed. Tap to complete the transaction.' },
  delivery_confirmed:    { title: '📦 Delivery Confirmed', body: 'Seller confirmed delivery. Review and release funds.' },
  release_available:     { title: '💰 Funds Released', body: 'Funds have been released to your wallet.' },
  agreement_proposed:    { title: '🤝 New Agreement', body: 'Someone proposed a trade agreement with you.' },
  agreement_accepted:    { title: '✅ Agreement Accepted', body: 'Your trade proposal was accepted.' },
  deadlock_initiated:    { title: '⚠️ Deadlock Alert', body: 'A deadlock was initiated on your agreement.' },
  r_value_posted:        { title: '🔑 Nonce Ready', body: 'Counterparty posted their R value. FROST can proceed.' },
  attestation_verified:  { title: '🛡️ Verified', body: 'Your device attestation was verified.' },
};

// ============================================================================
// REGISTER PUSH TOKEN
// ============================================================================

export async function registerPushToken(): Promise<PushToken | null> {
  try {
    // Request permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('[Push] Permission denied');
      return null;
    }

    // Get Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'kasvillage-mobile', // Your EAS project ID
    });
    const token = tokenData.data;
    const platform = Platform.OS as 'ios' | 'android';

    // Store locally
    await SecureStore.setItemAsync('kv_push_token', token);
    await SecureStore.setItemAsync('kv_push_platform', platform);

    console.log('[Push] Token registered:', token.slice(0, 20) + '...');
    return { token, platform, timestamp: Date.now() };
  } catch (e) {
    console.error('[Push] Registration failed:', e);
    return null;
  }
}

// ============================================================================
// INSCRIBE ENCRYPTED TOKEN TO ARWEAVE
// ============================================================================

export async function inscribePushToken(params: {
  pubkey: string;
  privKeyHex: string;
}): Promise<{ txId: string } | null> {
  try {
    const token = await SecureStore.getItemAsync('kv_push_token');
    const platform = await SecureStore.getItemAsync('kv_push_platform') || 'unknown';
    if (!token) {
      console.warn('[Push] No token to inscribe');
      return null;
    }

    // Encrypt token with user's own pubkey (only they can decrypt to share)
    // Simple XOR with SHA256(privkey) for now — upgrade to ECIES later
    const { sha256 } = await import('@noble/hashes/sha256');
    const keyBytes = sha256(new TextEncoder().encode(params.privKeyHex));
    const tokenBytes = new TextEncoder().encode(token);
    const encrypted = new Uint8Array(tokenBytes.length);
    for (let i = 0; i < tokenBytes.length; i++) {
      encrypted[i] = tokenBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    const encryptedHex = Array.from(encrypted, b => b.toString(16).padStart(2, '0')).join('');

    const payload = JSON.stringify({
      v: 1,
      encrypted_token: encryptedHex,
      platform,
      timestamp: Date.now(),
    });

    const tags = [
      { name: 'App-Name', value: 'KasVillage' },
      { name: 'KV-Type', value: 'push-token' },
      { name: 'KV-Pubkey', value: params.pubkey },
      { name: 'Content-Type', value: 'application/json' },
    ];

    const arweaveUpload = await import('./arweave_upload');
    const buildFn = (arweaveUpload as any).buildAns104Item || (arweaveUpload as any).default?.buildAns104Item;
    const uploadFn = (arweaveUpload as any).uploadToIrys || (arweaveUpload as any).default?.uploadToIrys;
    if (!buildFn || !uploadFn) { console.error('[Push] Arweave upload functions not found'); return null; }

    const data = new TextEncoder().encode(payload);
    const result = await buildFn(data, tags, params.privKeyHex).then(uploadFn);

    if (result?.txId) {
      await SecureStore.setItemAsync('kv_push_arweave_tx', result.txId);
      console.log('[Push] Token inscribed to Arweave:', result.txId);
      return { txId: result.txId };
    }
    return null;
  } catch (e) {
    console.error('[Push] Inscribe failed:', e);
    return null;
  }
}

// ============================================================================
// SEND PUSH TO COUNTERPARTY
// ============================================================================

export async function sendPushToCounterparty(params: {
  counterpartyPubkey: string;
  event: FrostEvent;
  agreementId?: string;
}): Promise<boolean> {
  try {
    // 1. Query Arweave for counterparty's encrypted push token
    const query = `{
      transactions(
        tags: [
          { name: "App-Name", values: ["KasVillage"] },
          { name: "KV-Type", values: ["push-token"] },
          { name: "KV-Pubkey", values: ["${params.counterpartyPubkey}"] }
        ],
        sort: HEIGHT_DESC,
        first: 1
      ) {
        edges { node { id } }
      }
    }`;

    const res = await fetch('https://arweave.net/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return false;

    const data = await res.json();
    const txId = data?.data?.transactions?.edges?.[0]?.node?.id;
    if (!txId) { console.warn('[Push] No push token found for counterparty'); return false; }

    // 2. Fetch the encrypted token data
    const tokenRes = await fetch(`https://arweave.net/${txId}`);
    if (!tokenRes.ok) return false;
    const tokenData = await tokenRes.json();

    // Note: In production, counterparty would need to decrypt and share
    // their token via a shared secret derived from ECDH.
    // For MVP: token is readable if you have the Arweave TX
    // The encryption is against their own key, so we need ECDH here.
    // SIMPLIFIED: For now, use Expo Push API directly if token is available

    // 3. Send via Expo Push API
    const msg = EVENT_MESSAGES[params.event];
    const pushBody = {
      to: tokenData.encrypted_token, // In MVP, this would be the decrypted token
      sound: 'default',
      title: msg.title,
      body: msg.body,
      data: {
        event: params.event,
        agreementId: params.agreementId || '',
      },
    };

    const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pushBody),
    });

    console.log('[Push] Sent to counterparty:', params.event, pushRes.ok);
    return pushRes.ok;
  } catch (e) {
    console.error('[Push] Send failed:', e);
    return false;
  }
}

// ============================================================================
// NOTIFICATION HANDLERS
// ============================================================================

export function setupNotificationHandlers(onEvent: (event: FrostEvent, data: any) => void): () => void {
  // Handle notification when app is in foreground
  const foregroundSub = Notifications.addNotificationReceivedListener(notification => {
    const data = notification.request.content.data;
    if (data?.event) {
      onEvent(data.event as FrostEvent, data);
    }
  });

  // Handle notification tap (app was in background)
  const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data;
    if (data?.event) {
      onEvent(data.event as FrostEvent, data);
    }
  });

  // Configure how notifications appear when app is in foreground
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  return () => {
    foregroundSub.remove();
    responseSub.remove();
  };
}

export default {
  registerPushToken,
  inscribePushToken,
  sendPushToCounterparty,
  setupNotificationHandlers,
};
