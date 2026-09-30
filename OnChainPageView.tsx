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
// Landscape without a native dependency. The body is laid out at swapped
// dimensions and rotated into the portrait viewport, so the game reflows as if
// the phone turned - no expo-screen-orientation, no dev-client rebuild. Touch
// coordinates map through a real CSS transform, so input keeps working.
const KV_ROT_JS = "(function(){try{var r=__R__,s=__S__;var b=document.body;if(!b)return;if(!window.__kvVInit){window.__kvVInit=1;var st=document.createElement('style');st.textContent='html{background:#000;}html,body{margin:0;padding:0;overflow:hidden;}';document.head.appendChild(st);window.addEventListener('resize',function(){try{window.__kvView(window.__kvR||0,window.__kvS||0);}catch(e){}});}window.__kvNat=function(){var t=b.style.transform;b.style.transform='none';var w=1,h=1,i,c=b.children;for(i=0;i<c.length;i++){var q=c[i].getBoundingClientRect();if(q.width>w)w=q.width;if(q.bottom>h)h=q.bottom;}w=Math.max(w,b.scrollWidth,1);h=Math.max(h,b.scrollHeight,1);b.style.transform=t;return{w:w,h:h};};window.__kvView=function(rr,ss){b.style.transformOrigin='0 0';var vw=window.innerWidth,vh=window.innerHeight;var n=window.__kvNat();if(!ss){var tw=rr?vh:vw,th=rr?vw:vh;ss=Math.min(tw/n.w,th/n.h)*0.88;if(!isFinite(ss)||ss<=0)ss=1;ss=Math.round(ss*100)/100;}var x,y;if(rr){x=(vw+ss*n.h)/2;y=(vh-ss*n.w)/2;b.style.transform='translate('+x+'px,'+y+'px) rotate(90deg) scale('+ss+')';}else{x=(vw-ss*n.w)/2;if(x<0)x=0;y=(vh-ss*n.h)/2;if(y<0)y=0;b.style.transform='translate('+x+'px,'+y+'px) scale('+ss+')';}window.__kvR=rr;window.__kvS=ss;try{window.ReactNativeWebView.postMessage(JSON.stringify({kvview:1,scale:ss,w:n.w,h:n.h}));}catch(e){}};window.__kvView(r,s);}catch(e){}})();true;";

// iOS suspends a Web Audio AudioContext during inactivity. The game's
// sequencer loops correctly (step % 64, driven by setInterval) - but it
// schedules against ctx.currentTime, and a suspended context's clock STOPS.
// So `while (nt < ctx.currentTime + .12)` schedules nothing, the music goes
// silent with no error, and only a gesture plus resume() revives it. Which is
// why it always died while waiting on someone else's turn: that is exactly
// when nobody is touching the screen.
//
// The context is a closure local, so we wrap the constructor BEFORE the page
// loads, keep every instance, and resume any that fall asleep. The game is on
// chain and immutable; this fixes it from outside without a republish.
const KV_AUDIO_KEEP = "(function(){try{var C=window.AudioContext||window.webkitAudioContext;if(!C)return;var made=[];function W(){var c=new C();made.push(c);return c;}W.prototype=C.prototype;try{window.AudioContext=W;}catch(e){}try{window.webkitAudioContext=W;}catch(e){}function kick(){for(var i=0;i<made.length;i++){var c=made[i];if(c&&c.state==='suspended'){try{c.resume();}catch(e){}}}}setInterval(kick,1500);document.addEventListener('touchstart',kick,true);document.addEventListener('touchend',kick,true);document.addEventListener('visibilitychange',kick);window.__kvAudioKick=kick;}catch(e){}})();true;";

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
  const [rot, setRot] = useState(false);
  const [zoom, setZoom] = useState(1);
  // Remember how this person likes to view THIS game. Rebuilding the board
  // smaller would mean 66 fragments and ~77 KAS for a preference; a stored
  // zoom costs nothing and is per-player rather than baked in for everyone.
  const viewKey = 'kv_view_' + String((props.game && (props.game as any).head) || 'page').slice(0, 16);
  const applyView = (r: boolean, z: number) => {
    webRef.current?.injectJavaScript(KV_ROT_JS.replace('__R__', r ? '1' : '0').replace('__S__', String(z)));
    try {
      const AS = require('@react-native-async-storage/async-storage').default;
      AS.setItem(viewKey, JSON.stringify({ r, z })).catch(() => {});
    } catch {}
  };
  useEffect(() => {
    if (!props.game || !html) return;
    let alive = true;
    (async () => {
      try {
        const AS = require('@react-native-async-storage/async-storage').default;
        const raw = await AS.getItem(viewKey);
        const v = raw ? JSON.parse(raw) : null;
        if (!alive) return;
        // No stored preference: auto-fit once (scale 0 = measure and fit).
        const r = v ? !!v.r : false, z = v ? Number(v.z) || 0 : 0;
        setRot(r); setZoom(z);
        setTimeout(() => applyView(r, z), 350);
      } catch {}
    })();
    return () => { alive = false; };
  }, [html]);
  const [payBusy, setPayBusy] = useState(false);
  const [payDone, setPayDone] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setHtml(null);
    setError(null);
    (async () => {
      const res = props.game
        ? await fetchGamePuzzle(props.game.manifestAddress, props.game.manifestHash, props.game.head, network,
            (have, total) => { if (alive) setProgress('solving puzzle ' + have + '/' + total); },
            // Coordinates must reach the fetcher here too, not only on Mailbox
            // install. Without them the coordinate walk is skipped entirely and
            // a recycled relay leaves an installed game unbootable.
            ((props.game as any).anchor_hash || (props.game as any).daa_to) ? {
              anchor_hash: (props.game as any).anchor_hash,
              daa_from: (props.game as any).daa_from,
              daa_to: (props.game as any).daa_to,
            } : undefined)
        : await fetchHtmlPage(storeAddress, pageHash, network, (props as any).coords);
      if (!alive) return;
      // Games: full inline-JS apps, verified by hash chain + scanner - the
      // static-page CSP (default-src none, no scripts) would kill them.
      if (res.html) setHtml(props.game ? res.html : injectCsp(res.html));
      else {
        const g: any = props.game || {};
        const diag = props.game
          ? ' [head ' + String(g.head || '').slice(0, 10) + ' · coords ' + (g.anchor_hash || g.daa_to ? 'yes' : 'NO') + ']'
          : '';
        try { console.log('[KV] game boot failed', { err: res.error, head: g.head, anchor: g.anchor_hash, from: g.daa_from, to: g.daa_to }); } catch {}
        setError((res.error || 'page unavailable') + diag);
      }
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
        injectedJavaScriptBeforeContentLoaded={CONSOLE_TAP + BRIDGE + KV_WNET_INJECT + (props.game ? KV_AUDIO_KEEP : '')}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        javaScriptEnabled
        domStorageEnabled={false}
        thirdPartyCookiesEnabled={false}
        sharedCookiesEnabled={false}
        allowFileAccess={false}
        allowUniversalAccessFromFileURLs={false}
        // Games need inline audio. With allowsInlineMediaPlayback false, iOS
        // forces media out of inline playback entirely, and with the default
        // mediaPlaybackRequiresUserAction=true, anything that interrupts the
        // track needs a FRESH user gesture to resume - which never comes while
        // you are sitting watching someone else's turn. KV_MUSIC.loop was
        // already true; the loop was never the problem.
        // Both stay locked down for ordinary pages, which have no business
        // autoplaying anything.
        allowsInlineMediaPlayback={!!props.game}
        mediaPlaybackRequiresUserAction={!props.game}
        cacheEnabled={false}
        setSupportMultipleWindows={false}
        style={styles.fill}
      />
      {props.game ? (
        <View style={{ position: 'absolute', right: 6, top: '32%' }}>
          {[
            { t: '\u27F3', on: () => { const n = !rot; setRot(n); applyView(n, 0); }, hot: rot },
            { t: '\u25A3', on: () => { setZoom(0); applyView(rot, 0); }, hot: false },
            { t: '\u2212', on: () => { const z = Math.max(0.3, Math.round((zoom - 0.15) * 100) / 100); setZoom(z); applyView(rot, z); }, hot: false },
            { t: '+', on: () => { const z = Math.min(1.5, Math.round((zoom + 0.15) * 100) / 100); setZoom(z); applyView(rot, z); }, hot: false },
          ].map((b, i) => (
            <TouchableOpacity key={i} onPress={b.on}
              style={{ width: 36, height: 36, borderRadius: 18, marginBottom: 7,
                backgroundColor: b.hot ? '#7c3aed' : 'rgba(10,10,16,0.82)',
                borderWidth: 1, borderColor: '#7c5cff', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{b.t}</Text>
            </TouchableOpacity>
          ))}
          <Text style={{ color: '#b9a6ff', fontSize: 9, textAlign: 'center' }}>{Math.round(zoom * 100) + '%'}</Text>
        </View>
      ) : null}
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
