// OnChainPageView.tsx - sandboxed renderer for hash-pinned on-chain HTML pages.
//
// SANDBOX RULES (all enforced, none optional):
//   1. Page bytes come only from Kaspa L1, hash-verified in fetchHtmlPage.
//   2. originWhitelist=[] + onShouldStartLoadWithRequest blocks ALL navigation.
//      Nothing leaves the WebView. External http(s) taps show a refusal notice.
//   3. kv:// pseudo-links are intercepted and handled natively (DM, product,
//      page jump). They never reach the network layer.
//   4. No cookies, no file access, no third-party content, no cache.
//
// The page cannot phone home: publish-time and fetch-time scans strip fetch/
// XHR/sendBeacon/external script/iframe, and navigation is hard-blocked here
// as defence in depth.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { fetchHtmlPage } from './html_chunks';

export interface OnChainPageViewProps {
  storeAddress: string;
  pageHash: string;
  network?: string;
  ownerPubkey?: string;
  /** kv://dm -> open a mailbox thread with the page owner. */
  onDirectMessage?: (ownerPubkey: string) => void;
  /** kv://product/<id> -> open the product detail sheet. */
  onProduct?: (productId: string) => void;
  /** kv://page/<hash> -> navigate to another on-chain page at same address. */
  onPage?: (hash: string) => void;
  onClose?: () => void;
}

// Injected before page scripts run. Belt-and-braces: even if a link slipped the
// scanners, this converts taps into postMessage instead of navigation.
const BRIDGE = `
(function(){
  document.addEventListener('click', function(e){
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.indexOf('kv://') === 0) {
      e.preventDefault();
      window.ReactNativeWebView.postMessage(JSON.stringify({ kv: href }));
    } else if (href && href.charAt(0) !== '#') {
      e.preventDefault();
      window.ReactNativeWebView.postMessage(JSON.stringify({ blocked: href }));
    }
  }, true);
  true;
})();
`;

export default function OnChainPageView(props: OnChainPageViewProps) {
  const { storeAddress, pageHash, network = 'testnet-10', ownerPubkey } = props;
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setHtml(null);
    setError(null);
    (async () => {
      const res = await fetchHtmlPage(storeAddress, pageHash, network);
      if (!alive) return;
      if (res.html) setHtml(res.html);
      else setError(res.error || 'page unavailable');
    })();
    return () => { alive = false; };
  }, [storeAddress, pageHash, network]);

  const handleKvLink = useCallback((href: string) => {
    const path = href.slice('kv://'.length);
    if (path === 'dm' || path.startsWith('dm/')) {
      const pk = path.startsWith('dm/') ? path.slice(3) : (ownerPubkey || '');
      if (pk && props.onDirectMessage) props.onDirectMessage(pk);
      else setNotice('No contact available for this page.');
      return;
    }
    if (path.startsWith('product/')) {
      props.onProduct?.(path.slice('product/'.length));
      return;
    }
    if (path.startsWith('page/')) {
      props.onPage?.(path.slice('page/'.length));
      return;
    }
    setNotice('Unsupported link: ' + href.slice(0, 40));
  }, [ownerPubkey, props]);

  const onMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.kv) handleKvLink(msg.kv);
      else if (msg.blocked) setNotice('External links are disabled inside on-chain pages.');
    } catch { /* ignore malformed bridge messages */ }
  }, [handleKvLink]);

  // Hard block: nothing navigates. kv:// is routed, everything else refused.
  const onShouldStartLoadWithRequest = useCallback((req: any) => {
    const url = String(req?.url || '');
    if (url.startsWith('about:blank') || url === '' || url.startsWith('data:text/html')) return true;
    if (url.startsWith('kv://')) { handleKvLink(url); return false; }
    setNotice('External links are disabled inside on-chain pages.');
    return false;
  }, [handleKvLink]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errTitle}>Page unavailable</Text>
        <Text style={styles.errBody}>{error}</Text>
        {props.onClose ? (
          <TouchableOpacity style={styles.btn} onPress={props.onClose}>
            <Text style={styles.btnText}>Close</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  if (!html) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.loading}>Rebuilding page from chain…</Text>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <WebView
        source={{ html }}
        originWhitelist={[]}
        injectedJavaScriptBeforeContentLoaded={BRIDGE}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        javaScriptEnabled
        domStorageEnabled={false}
        thirdPartyCookiesEnabled={false}
        sharedCookiesEnabled={false}
        allowFileAccess={false}
        allowUniversalAccessFromFileURLs={false}
        allowsInlineMediaPlayback={false}
        cacheEnabled={false}
        setSupportMultipleWindows={false}
        style={styles.fill}
      />
      <View style={styles.verifiedBar}>
        <Text style={styles.verifiedText}>
          ⛓ On-chain page · hash {pageHash.slice(0, 12)} verified
        </Text>
      </View>
      {notice ? (
        <TouchableOpacity style={styles.toast} onPress={() => setNotice(null)}>
          <Text style={styles.toastText}>{notice}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loading: { marginTop: 12, color: '#8a8a8a', fontSize: 13 },
  errTitle: { fontSize: 16, fontWeight: '600', color: '#c0392b', marginBottom: 6 },
  errBody: { fontSize: 13, color: '#8a8a8a', textAlign: 'center' },
  btn: { marginTop: 16, paddingHorizontal: 18, paddingVertical: 9, backgroundColor: '#2b2b2b', borderRadius: 6 },
  btnText: { color: '#fff', fontSize: 13 },
  verifiedBar: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#10231a', borderTopWidth: 1, borderTopColor: '#1d3a2c' },
  verifiedText: { color: '#49c07a', fontSize: 11 },
  toast: { position: 'absolute', left: 16, right: 16, bottom: 48, backgroundColor: 'rgba(30,30,30,0.95)', padding: 12, borderRadius: 8 },
  toastText: { color: '#eee', fontSize: 12, textAlign: 'center' },
});
