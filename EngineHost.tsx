// EngineHost.tsx
// ============================================================================
// WebView host for the KasVillage scene engine (scene_engine.html).
//
// WHY THIS EXISTS
// The wallet already has a DApp sandbox, but it speaks a different protocol:
//   sandbox:  { id, type, data }  ->  window._kasvillage_respond(id, ok, result)
//   engine:   { kv:"sdk", id, method, params }  ->  KV.resolve(id, res)
// The engine is the published, on-chain-adjacent artifact whose interface must
// stay stable, so the wallet adapts (decision A). This component is that
// adapter. The DApp sandbox remains untouched for L2 template games.
//
// TRUST MODEL
// Different from the DApp sandbox. There, untrusted CODE runs in the WebView
// and the sandbox strips eval/innerHTML/location. Here, OUR engine runs and
// hosts untrusted DATA (the scene descriptor), which the engine's own
// validate() gates. The host's job is:
//   1. hash-pin the descriptor against its on-chain attestation BEFORE loading
//   2. answer the engine's SDK calls from the wallet context, gated by the
//      permissions the DESCRIPTOR declares (not what the game asks for at
//      runtime -- grants are read once from the validated descriptor)
//   3. never expose more than the method table below
//
// USAGE
//   <EngineHost
//     engineHtml={ENGINE_HTML}            // bundled scene_engine.html string
//     descriptor={descriptorJson}         // scene JSON (already fetched)
//     expectedHash={attestation.sha256}   // hex; from the KVP1/Arweave record
//     gameId={dapp.dappId}
//     onClose={() => ...}
//     onResult={(record) => ...}          // signed result for the Mailbox rail
//   />
// ============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import * as Crypto from 'expo-crypto';

// ---------------------------------------------------------------------------
// Wallet surface the host consumes. Wire these from your WalletContext /
// AppNavigator; every one is optional -- a missing capability answers with an
// error instead of hanging the engine (its call() would otherwise wait 8s).
// ---------------------------------------------------------------------------
export interface EngineWalletBridge {
  getPubkey?: () => Promise<{ pubkey: string; alias?: string; verified?: boolean }>;
  getUserStats?: () => Promise<{ xp: number; reputation: number }>;
  getBalanceSompi?: () => Promise<bigint>;
  signMessage?: (messageHex: string) => Promise<string | null>;
  // NO free persistence, by policy. A free wallet-side save is a channel a
  // malicious game can fill with bait, and durable state the player never
  // explicitly approved. The ONLY durable state is a paid, visible act: an
  // on-chain record via reportResult (episode completions, season progress,
  // match results). In-session continuity uses the engine's memory backend.
}

interface EngineHostProps {
  engineHtml: string;
  descriptor: string;            // raw descriptor JSON text (hash is over these bytes)
  expectedHash?: string;         // sha256 hex from the on-chain attestation
  gameId: string;
  bridge?: EngineWalletBridge;
  onClose: () => void;
  onResult?: (result: any) => void;
  title?: string;
}

// Permissions the engine's schema knows. The descriptor's declared list is the
// grant set; anything else is denied regardless of what the running game asks.
const KNOWN_PERMS = ['identity', 'stats', 'balance', 'persist'] as const;

// per-session cap so a hostile descriptor cannot hammer the bridge
const MAX_CALLS_PER_MINUTE = 120;

export const EngineHost: React.FC<EngineHostProps> = ({
  engineHtml, descriptor, expectedHash, gameId, bridge, onClose, onResult, title,
}) => {
  const webRef = useRef<WebView>(null);
  const [phase, setPhase] = useState<'hashing' | 'ready' | 'hash_mismatch' | 'invalid'>('hashing');
  const callTimes = useRef<number[]>([]);

  // ---- 1. hash-pin the descriptor before anything loads -------------------
  const [pinnedDescriptor, setPinnedDescriptor] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (expectedHash) {
          let canon = descriptor;
          try { canon = JSON.stringify(JSON.parse(descriptor)); } catch {}
          const digest = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256, canon);
          if (!alive) return;
          if (digest.toLowerCase() !== expectedHash.toLowerCase()) {
            setPhase('hash_mismatch');
            return;
          }
        }
        // must at least parse; the engine's validate() does the real gating
        JSON.parse(descriptor);
        if (!alive) return;
        setPinnedDescriptor(descriptor);
        setPhase('ready');
      } catch {
        if (alive) setPhase('invalid');
      }
    })();
    return () => { alive = false; };
  }, [descriptor, expectedHash]);

  // grants come from the DESCRIPTOR, read once, not from runtime requests
  const grants = useMemo<Set<string>>(() => {
    try {
      const d = JSON.parse(descriptor);
      const perms: string[] = Array.isArray(d.permissions) ? d.permissions : [];
      return new Set(perms.filter(p => (KNOWN_PERMS as readonly string[]).includes(p)));
    } catch { return new Set(); }
  }, [descriptor]);

  // ---- 2. the page: engine + injected descriptor --------------------------
  // The engine boots, then loadScene() runs with the pinned descriptor.
  // JSON.stringify twice: once to make it a JS string literal safely.
  const html = useMemo(() => {
    if (!pinnedDescriptor) return '';
    const boot =
      '<script>' +
      'try { loadScene(' + JSON.stringify(pinnedDescriptor) + '); }' +
      'catch (e) { if (window.ReactNativeWebView) ReactNativeWebView.postMessage(' +
      'JSON.stringify({ kv: "host", event: "boot_error", message: String(e && e.message) })); }' +
      '</script>';
    return engineHtml + boot;
  }, [engineHtml, pinnedDescriptor]);

  // ---- 3. answer the engine's SDK calls -----------------------------------
  const respond = useCallback((id: number, res: any) => {
    // KV.resolve is the engine's own response entry point -- its protocol,
    // not ours, which is the entire point of decision A.
    webRef.current?.injectJavaScript(
      'if (typeof KV !== "undefined" && KV.resolve) KV.resolve(' +
      JSON.stringify(id) + ',' + JSON.stringify(res) + '); true;');
  }, []);

  const rateLimited = useCallback((): boolean => {
    const now = Date.now();
    callTimes.current = callTimes.current.filter(t => now - t < 60000);
    if (callTimes.current.length >= MAX_CALLS_PER_MINUTE) return true;
    callTimes.current.push(now);
    return false;
  }, []);

  const handleMessage = useCallback(async (ev: WebViewMessageEvent) => {
    let msg: any;
    try { msg = JSON.parse(ev.nativeEvent.data); } catch { return; }

    // host events (boot errors, results) ------------------------------------
    if (msg && msg.kv === 'host') {
      if (msg.event === 'boot_error') {
        Alert.alert('Game failed to load', String(msg.message || 'unknown error'));
        onClose();
      }
      return;
    }

    // engine SDK protocol: { kv:"sdk", id, method, params } ------------------
    if (!msg || msg.kv !== 'sdk' || typeof msg.id !== 'number') return;
    const { id, method, params } = msg;

    if (rateLimited()) { respond(id, { error: 'rate limited' }); return; }

    try {
      switch (method) {
        case 'connect': {
          if (!grants.has('identity')) { respond(id, { error: 'permission denied: identity' }); break; }
          if (!bridge?.getPubkey) { respond(id, { error: 'identity unavailable' }); break; }
          const who = await bridge.getPubkey();
          respond(id, { pubkey: who.pubkey, alias: who.alias || '', verified: !!who.verified });
          break;
        }
        case 'getUserStats': {
          if (!grants.has('stats')) { respond(id, { error: 'permission denied: stats' }); break; }
          if (!bridge?.getUserStats) { respond(id, { error: 'stats unavailable' }); break; }
          respond(id, await bridge.getUserStats());
          break;
        }
        case 'getBalance': {
          if (!grants.has('balance')) { respond(id, { error: 'permission denied: balance' }); break; }
          if (!bridge?.getBalanceSompi) { respond(id, { error: 'balance unavailable' }); break; }
          respond(id, { sompi: Number(await bridge.getBalanceSompi()) });
          break;
        }
        case 'getState':
        case 'setState':
        case 'commitState': {
          // Refused by policy, not by missing wiring. The engine falls back to
          // its memory backend for in-session continuity; anything durable
          // must go through reportResult and be inscribed.
          respond(id, { error: 'persistence not supported: durable state is on-chain only' });
          break;
        }
        case 'reportResult': {
          // The ONE durable path. Episode completions, season progress, match
          // results -- handed up to the KVSTAT3 dual-sign / inscription flow.
          // The player sees and pays for every durable write. The host signs
          // nothing here.
          onResult?.(params);
          respond(id, { ok: true });
          break;
        }
        default:
          respond(id, { error: 'unknown method: ' + String(method) });
      }
    } catch (e: any) {
      respond(id, { error: String(e?.message || e) });
    }
  }, [grants, bridge, gameId, onResult, onClose, respond, rateLimited]);

  // ---- render --------------------------------------------------------------
  if (phase === 'hashing') {
    return (
      <View style={styles.center}><Text style={styles.dim}>Verifying game…</Text></View>
    );
  }
  if (phase === 'hash_mismatch') {
    return (
      <View style={styles.center}>
        <Text style={styles.err}>⚠️ Game content does not match its on-chain attestation.</Text>
        <Text style={styles.dim}>The published content may have been altered. Not loading it.</Text>
        <TouchableOpacity style={styles.btn} onPress={onClose}>
          <Text style={styles.btnText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (phase === 'invalid') {
    return (
      <View style={styles.center}>
        <Text style={styles.err}>Game descriptor is not valid JSON.</Text>
        <TouchableOpacity style={styles.btn} onPress={onClose}>
          <Text style={styles.btnText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>{title || gameId}</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>
      <WebView
        ref={webRef}
        originWhitelist={['about:blank']}
        source={{ html }}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled={false}       // engine persistence goes through the bridge
        allowFileAccess={false}
        allowUniversalAccessFromFileURLs={false}
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={(req) => req.url === 'about:blank'}
        style={styles.web}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1917' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#44403C',
  },
  title: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', flex: 1, marginRight: 12 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#44403C',
    justifyContent: 'center', alignItems: 'center',
  },
  closeText: { color: '#FFFFFF', fontSize: 16 },
  web: { flex: 1, backgroundColor: '#000000' },
  center: {
    flex: 1, backgroundColor: '#1C1917',
    justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12,
  },
  err: { color: '#F87171', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  dim: { color: '#A8A29E', fontSize: 13, textAlign: 'center' },
  btn: {
    marginTop: 16, backgroundColor: '#44403C', borderRadius: 10,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  btnText: { color: '#FFFFFF', fontWeight: '700' },
});

export default EngineHost;
