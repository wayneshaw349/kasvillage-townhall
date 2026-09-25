// kv_net_bridge.ts — the ONLY network + clipboard a chain game gets.
//
// Chain games (showcase_kascity414_chain.html) contain no fetch / XHR /
// clipboard calls, so they pass html_chunks.ts scanHtmlForPublish. Every call
// goes through window.KV_WNET, which this bridge injects into the WebView
// before the page loads. The wallet (React Native side) does the request, and
// only for allowlisted hosts, GET/POST, capped sizes, 10 s timeout.
//
// Wire into any WebView that renders a chain game (EngineHost / OnChainPageView):
//   <WebView
//     injectedJavaScriptBeforeContentLoaded={KV_WNET_INJECT}
//     onMessage={(e) => { if (handleKvNetMessage(e.nativeEvent.data, (js) => ref.current?.injectJavaScript(js))) return; /* existing handling */ }}
//   />

import * as Clipboard from 'expo-clipboard';

export const KV_WNET_ALLOW = {
  https: [
    'kasvillage.app.runonflux.io', 'kasvillage_1.app.runonflux.io', 'kasvillage_2.app.runonflux.io',
    'api.runonflux.io', 'api-tn10.kaspa.org', 'api.kaspa.org',
  ],
  // relay nodes (incl. Flux-discovered ones) are plain IPv4 on the relay port only
  ipv4Ports: [35816],
};
const MAX_BODY = 64 * 1024, MAX_RESP = 2 * 1024 * 1024, TIMEOUT_MS = 10_000;

export function kvNetAllowed(url: string, allow = KV_WNET_ALLOW): boolean {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  if (u.username || u.password) return false;
  if (u.protocol === 'https:') return allow.https.includes(u.hostname) && (u.port === '' || u.port === '443');
  if (u.protocol === 'http:') {
    const ip = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(u.hostname);
    if (!ip || ip.slice(1).some((o) => +o > 255)) return false;
    const [a, b] = [+ip[1], +ip[2]];
    // no private / loopback / link-local targets from a game page
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return false;
    return allow.ipv4Ports.includes(+u.port);
  }
  return false;
}

// Runs inside the WebView before the page's own scripts. No fetch/XHR in here.
export const KV_WNET_INJECT = `(function(){
  if (window.KV_WNET && window.KV_WNET.__wallet) return;
  var seq = 0, pend = {};
  function post(m){ window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  function abortErr(){ var e = new Error("aborted"); e.name = "AbortError"; return e; }
  window.__kvWnetReply = function(id, res){
    var p = pend[id]; if (!p) return; delete pend[id];
    if (res.error) { p.rej(new Error(res.error)); return; }
    p.res({ ok: res.status >= 200 && res.status < 300, status: res.status,
      text: function(){ return Promise.resolve(res.body); },
      json: function(){ return Promise.resolve().then(function(){ return JSON.parse(res.body); }); } });
  };
  window.KV_WNET = { __wallet: 1,
    req: function(url, o){ o = o || {};
      return new Promise(function(res, rej){
        var id = ++seq;
        if (o.signal) {
          if (o.signal.aborted) return rej(abortErr());
          o.signal.addEventListener("abort", function(){ if (pend[id]) { delete pend[id]; rej(abortErr()); } });
        }
        pend[id] = { res: res, rej: rej };
        var h = {}; if (o.headers && o.headers["Content-Type"]) h["Content-Type"] = String(o.headers["Content-Type"]);
        post({ kvwnet: "req", id: id, url: String(url), method: o.method || "GET", headers: h,
               body: typeof o.body === "string" ? o.body : null });
      }); },
    copy: function(t){ post({ kvwnet: "copy", text: String(t).slice(0, 100000) }); return Promise.resolve(); }
  };
})(); true;`;

/** Returns true if the message was a KV_WNET message (handled here). */
export function handleKvNetMessage(raw: string, inject: (js: string) => void, allow = KV_WNET_ALLOW): boolean {
  let m: any;
  try { m = JSON.parse(raw); } catch { return false; }
  if (!m || typeof m.kvwnet !== 'string') return false;

  if (m.kvwnet === 'copy') {
    if (typeof m.text === 'string') Clipboard.setStringAsync(m.text.slice(0, 100000)).catch(() => {});
    return true;
  }
  if (m.kvwnet !== 'req' || !Number.isInteger(m.id)) return true;

  const reply = (payload: object) => {
    const js = JSON.stringify(payload).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    inject(`window.__kvWnetReply(${m.id}, ${js}); true;`);
  };
  const method = String(m.method || 'GET').toUpperCase();
  if (!kvNetAllowed(String(m.url), allow)) { reply({ error: 'blocked host: ' + String(m.url).slice(0, 80) }); return true; }
  if (method !== 'GET' && method !== 'POST') { reply({ error: 'method not allowed' }); return true; }
  if (m.body != null && (typeof m.body !== 'string' || m.body.length > MAX_BODY)) { reply({ error: 'body too large' }); return true; }

  (async () => {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), TIMEOUT_MS);
    try {
      const headers: Record<string, string> = {};
      const ct = m.headers && m.headers['Content-Type'];
      if (typeof ct === 'string' && ct.length < 100) headers['Content-Type'] = ct;
      const r = await fetch(m.url, { method, headers, body: method === 'POST' ? m.body : undefined, signal: c.signal });
      const body = await r.text();
      if (body.length > MAX_RESP) { reply({ error: 'response too large' }); return; }
      reply({ status: r.status, body });
    } catch (e: any) {
      reply({ error: String(e?.message || e) });
    } finally { clearTimeout(t); }
  })();
  return true;
}
