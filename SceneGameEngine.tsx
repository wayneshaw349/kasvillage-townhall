// SceneGameEngine.tsx - runs a kv_scene_v1 descriptor fetched from Kaspa L1.
//
// Sibling to GridGameEngine: same {game} prop, dispatched on the descriptor's
// `engine` field. The scene JSON is data only - the engine ships inside the app
// and is the only logic that ever executes, so "no code execution" stays true.
//
// The WebView is locked down: no navigation, no network, no file access. The
// only channel out is postMessage, and the engine decides what crosses it
// (ready / error / commitState), never the scene.

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { SCENE_ENGINE_HTML } from './scene_engine_html';

export interface SceneGameEngineProps {
  game: any;
  height?: number;
  /** Persisted via the SDK's commitState. */
  onCommitState?: (gameId: string, state: any) => void;
  onError?: (message: string) => void;
}

export default function SceneGameEngine({ game, height = 380, onCommitState, onError }: SceneGameEngineProps) {
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Inject the scene before the engine boots so there is no load round-trip.
  const html = useMemo(() => {
    let payload = '{}';
    try { payload = JSON.stringify(game); } catch { payload = '{}'; }
    const inject = '<script>window.__KV_SCENE__=' + payload.replace(/</g, '\\u003c') + ';</script>';
    return inject + SCENE_ENGINE_HTML;
  }, [game]);

  const onMessage = useCallback((event: any) => {
    let msg: any = null;
    try { msg = JSON.parse(event.nativeEvent.data); } catch { return; }
    if (msg.kv === 'ready') { setReady(true); setErr(null); return; }
    if (msg.kv === 'error') {
      setErr(msg.message || 'scene failed to load');
      onError?.(msg.message || 'scene failed to load');
      return;
    }
    if (msg.kv === 'commitState') {
      console.log('[SceneEngine] commitState', msg.gameId, msg.state);
      onCommitState?.(msg.gameId, msg.state);
    }
  }, [onCommitState, onError]);

  // Nothing navigates. The engine never requests a URL; anything that tries is
  // a scene doing something it should not be able to do, so it is refused.
  const blockNav = useCallback((req: any) => {
    const url = String(req?.url || '');
    return url === '' || url.startsWith('about:blank') || url.startsWith('data:text/html');
  }, []);

  if (err) {
    return (
      <View style={[styles.center, { height }]}>
        <Text style={styles.errTitle}>Scene rejected</Text>
        <Text style={styles.errBody}>{err}</Text>
      </View>
    );
  }

  return (
    <View style={{ height, backgroundColor: '#000', borderRadius: 8, overflow: 'hidden' }}>
      <WebView
        ref={webRef}
        source={{ html }}
        originWhitelist={[]}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={blockNav}
        javaScriptEnabled
        domStorageEnabled={false}
        thirdPartyCookiesEnabled={false}
        sharedCookiesEnabled={false}
        allowFileAccess={false}
        allowUniversalAccessFromFileURLs={false}
        cacheEnabled={false}
        setSupportMultipleWindows={false}
        scrollEnabled={false}
        bounces={false}
        style={{ flex: 1, backgroundColor: '#000' }}
      />
      {!ready ? (
        <View style={styles.overlay}>
          <ActivityIndicator color="#c9b48a" />
          <Text style={styles.loading}>Generating scene from chain…</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#141414', borderRadius: 8 },
  overlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.75)' },
  loading: { marginTop: 10, color: '#8B7355', fontSize: 12 },
  errTitle: { color: '#c0392b', fontSize: 14, fontWeight: '600', marginBottom: 6 },
  errBody: { color: '#8a8a8a', fontSize: 12, textAlign: 'center' },
});
