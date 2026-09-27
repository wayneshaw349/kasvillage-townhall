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
import { fetchGamePuzzle, TRUSTED_GAMES, GameManifest } from './game_chunks';
import { KV_WNET_INJECT, handleKvNetMessage } from './kv_net_bridge';
import { useRef } from 'react';

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
  /** Chain GAME mode: solve the hash-chained puzzle instead of a single page. */
  game?: { manifestAddress: string; manifestHash: string; head: string };
}

// Injected before page scripts run. Belt-and-braces: even if a link slipped the
// scanners, this converts taps into postMessage instead of navigation.
const CONSOLE_TAP = `
(function(){
  function post(kind, args){ try { window.ReactNativeWebView.postMessage(JSON.stringify({ kvlog: kind + ': ' + args.map(function(a){ try { return typeof a === 'string' ? a : JSON.stringify(a); } catch(e){ return String(a); } }).join(' ') })); } catch(e){} }
  ['log','warn','error'].forEach(function(k){ var o = console[k]; console[k] = function(){ post(k, Array.prototype.slice.call(arguments)); o && o.apply(console, arguments); }; });
  window.addEventListener('error', function(e){ post('onerror', [String(e.message || e), String(e.filename || '') + ':' + String(e.lineno || '')]); });
  window.addEventListener('unhandledrejection', function(e){ post('unhandledrejection', [String((e.reason && e.reason.message) || e.reason)]); });
})();
`;

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

// [CSP-LEAK-FIX] Subresource fetches (<img src>, CSS url()/@import, fonts) are
// NOT routed through onShouldStartLoadWithRequest on either platform — a remote
// tracking pixel leaks the viewer's IP to the page author. A restrictive CSP in
// <head> closes the channel entirely: no network, inline style + data: only.
const CSP_META = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:; media-src data:; font-src data:;">';
function injectCsp(raw: string): string {
  if (/http-equiv=["']Content-Security-Policy["']/i.test(raw)) return raw;
  if (/<head(\s[^>]*)?>/i.test(raw)) return raw.replace(/<head(\s[^>]*)?>/i, (mm) => mm + CSP_META); // word-boundary: never matches JS like i<heads.length
  if (/<html[^>]*>/i.test(raw)) return raw.replace(/<html([^>]*)>/i, '<html$1><head>' + CSP_META + '</head>');
  return CSP_META + raw;
}

export default function OnChainPageView(props: OnChainPageViewProps) {
  const { storeAddress, pageHash, network = 'testnet-10', ownerPubkey } = props;
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const webRef = useRef<any>(null);
  const [paySheet, setPaySheet] = useState<any>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [payDone, setPayDone] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setHtml(null);
    setError(null);
    (async () => {
      const res = props.game
        ? await fetchGamePuzzle(props.game.manifestAddress, props.game.manifestHash, props.game.head, network,
            (have, total) => { if (alive) setProgress('solving puzzle ' + have + '/' + total); })
        : await fetchHtmlPage(storeAddress, pageHash, network);
      if (!alive) return;
      // Games: full inline-JS apps, verified by hash chain + scanner - the
      // static-page CSP (default-src none, no scripts) would kill them.
      if (res.html) setHtml(props.game ? res.html : injectCsp(res.html));
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
    if (path.startsWith('pay/')) {
      // KV PAY - the ONE sanctioned payment surface for every on-chain page,
      // dapp and game. Format: kv://pay/<kaspa address>/<amount KAS>[?m=memo]
      // Convention users learn: KAS only ever moves through this sheet.
      try {
        const rest = path.slice(4);
        const q = rest.indexOf('?');
        const core = q >= 0 ? rest.slice(0, q) : rest;
        const qs = q >= 0 ? rest.slice(q + 1) : '';
        const segs = core.split('/');
        const addr = decodeURIComponent(segs[0] || '');
        const kas = Number(segs[1] || '0');
        const memo = qs.startsWith('m=') ? decodeURIComponent(qs.slice(2)).slice(0, 60) : '';
        const okAddr = (addr.startsWith('kaspatest:') || addr.startsWith('kaspa:')) && addr.length >= 20 && addr.length <= 80;
        if (!okAddr || !(kas > 0) || kas > 5000) { setNotice('Invalid payment request.'); return; }
        setPayDone(null);
        setPaySheet({ addr, kas, memo });
      } catch { setNotice('Invalid payment request.'); }
      return;
    }
    setNotice('Unsupported link: ' + href.slice(0, 40));
  }, [ownerPubkey, props]);

  const confirmPay = useCallback(async () => {
    if (!paySheet || payBusy) return;
    setPayBusy(true);
    try {
      const ps = require('./proposal_share');
      const getId = ps._kvResolveIdentity || ps.resolveKvIdentity || ps.kvResolveIdentity || ps.getKvIdentity || ps.resolveIdentity;
      let ident: any = getId ? await getId() : null;
      if (!ident || !ident.address || !ident.privkey) {
        const SS = require('expo-secure-store');
        ident = { address: await SS.getItemAsync('kaspa_address'), privkey: await ps._kvResolvePrivHex(), network };
      }
      if (!ident || !ident.address || !ident.privkey) throw new Error('wallet identity unavailable');
      const { sendKaspaViaRest } = require('./kaspa_rest_tx');
      const r: any = await sendKaspaViaRest({
        senderAddress: ident.address,
        recipientAddress: paySheet.addr,
        amountSompi: BigInt(Math.round(paySheet.kas * 1e8)),
        privateKeyHex: ident.privkey,
        network: (ident.network || network) as any,
      });
      if (r && r.success && (r.txId || r.transactionId)) {
        const txid = String(r.txId || r.transactionId);
        setPayDone(txid);
        webRef.current?.injectJavaScript('try{window.dispatchEvent(new CustomEvent("kvpay",{detail:{ok:true,txid:"' + txid + '",kas:' + paySheet.kas + '}}))}catch(e){};true;');
      } else {
        setNotice('Payment failed: ' + String((r && r.error) || 'unknown'));
        setPaySheet(null);
      }
    } catch (e: any) {
      setNotice('Payment failed: ' + String(e?.message || e));
      setPaySheet(null);
    }
    setPayBusy(false);
  }, [paySheet, payBusy, network]);

  const onMessage = useCallback((event: any) => {
    try { const _d = JSON.parse(event?.nativeEvent?.data || '{}'); if (_d.kvlog !== undefined) { console.log('[GamePage]', _d.kvlog); return; } } catch {}
    if (handleKvNetMessage(event.nativeEvent.data, (js) => webRef.current?.injectJavaScript(js))) return;
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.kv) handleKvLink(msg.kv);
      else if (msg.blocked) setNotice('External links are disabled inside on-chain pages.');
    } catch { /* ignore malformed bridge messages */ }
  }, [handleKvLink]);

  // Hard block: nothing navigates. kv:// is routed, everything else refused.
  const onShouldStartLoadWithRequest = useCallback((req: any) => {
    const url = String(req?.url || '');
    if (url.startsWith('about:blank') || url === '' || url.startsWith('data:text/html') || url.startsWith('https://kv-game.local')) return true;
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
        <Text style={styles.loading}>{progress || 'Rebuilding page from chain…'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <WebView
        source={{ html, baseUrl: 'https://kv-game.local/' }}
        originWhitelist={['https://kv-game.local']}
        ref={webRef}
        injectedJavaScriptBeforeContentLoaded={CONSOLE_TAP + BRIDGE + KV_WNET_INJECT}
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
      {paySheet ? (
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#17131f', borderColor: '#7c3aed', borderWidth: 2, borderRadius: 14, padding: 18 }}>
            <Text style={{ color: '#b9a6ff', fontWeight: '900', fontSize: 16, letterSpacing: 2 }}>KV PAY</Text>
            <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 8 }}>{paySheet.kas} KAS</Text>
            {paySheet.memo ? <Text style={{ color: '#cbb9ff', fontSize: 13, marginTop: 2 }}>{paySheet.memo}</Text> : null}
            <Text style={{ color: '#8a8098', fontSize: 11, marginTop: 12 }}>to</Text>
            <Text style={{ color: '#e6e0f5', fontFamily: 'monospace', fontSize: 11 }} numberOfLines={2}>{paySheet.addr}</Text>
            <Text style={{ color: '#f0c860', fontSize: 11, marginTop: 12 }}>
              {'Requested by this ' + (props.game ? 'game' : 'page') + '. KAS only ever moves through this sheet - never type amounts, addresses or your seed inside a page.'}
            </Text>
            {payDone ? (
              <Text style={{ color: '#34d399', fontSize: 12, marginTop: 12 }} numberOfLines={1}>{'sent \u2713 ' + payDone.slice(0, 18) + '\u2026'}</Text>
            ) : null}
            <View style={{ flexDirection: 'row', marginTop: 16 }}>
              <TouchableOpacity disabled={payBusy} onPress={() => { setPaySheet(null); setPayDone(null); }}
                style={{ flex: 1, padding: 12, alignItems: 'center' }}>
                <Text style={{ color: '#aaa', fontWeight: '700' }}>{payDone ? 'CLOSE' : 'CANCEL'}</Text>
              </TouchableOpacity>
              {!payDone ? (
                <TouchableOpacity disabled={payBusy} onPress={confirmPay}
                  style={{ flex: 1, backgroundColor: payBusy ? '#555' : '#7c3aed', borderRadius: 10, padding: 12, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '900' }}>{payBusy ? 'SENDING\u2026' : 'CONFIRM & SEND'}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}
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
