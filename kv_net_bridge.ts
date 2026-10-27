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
//     onMessage={(e) => { if (handleKvNetMessage(e.nativeEvent.data, (js) => ref.current?.injectJavaScript(js), { sign: isGame })) return; /* existing handling */ }}
//   opts.sign (default false) is the ONLY way relay requests get signed with the wallet key.
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
// KV_DEAD_HOST: Flux nodes rotate, so games carry stale http://IP:35816 mirrors.
// A mirror that fails a connection is marked dead for 8 minutes and fails
// instantly afterwards, and plain-IP mirrors get a short 3.5s timeout - the
// live relay then gets its turn well inside the game's own 9s lobby window.
const KV_DEAD_MS = 8 * 60_000, KV_IP_TIMEOUT_MS = 3_500;
const _kvDeadHosts = new Map<string, number>();
/** KV_RELAY_VIA_DOMAIN: plain-IP relay mirrors are blocked by iOS ATS and many
 *  mobile carriers. The https Flux domain load-balances onto the same nodes, so a
 *  failed http://IP:35816 call is retried once through the domain - the game's own
 *  reseed/gossip logic already copes with rooms living on different nodes. */
export function kvRelayFallbackUrl(url: string, allow = KV_WNET_ALLOW): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' || !/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) return null;
    if (!allow.ipv4Ports.includes(+u.port)) return null;
    return 'https://' + KV_RELAY_HTTPS[0] + u.pathname + u.search;
  } catch { return null; }
}
export function kvHostTimeout(url: string): number {
  try { const u = new URL(url); if (u.protocol === 'http:' && /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) return KV_IP_TIMEOUT_MS; } catch {}
  return TIMEOUT_MS;
}

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

// ---------------------------------------------------------------------------
// SESSION DIGEST - move-log hash + timing, captured from traffic already
// passing through this bridge. The game does not cooperate and cannot opt out
// or forge it: every move POST is hashed in order, client-side.
//
// Timing is the part that distinguishes a human from a script. Human gaps
// scatter widely (high coefficient of variation); scripted play clusters
// tight. We publish the stats, not a verdict - anyone can recompute them from
// the committed hash chain and draw their own conclusion.
// ---------------------------------------------------------------------------
import { sha256 as _kvSha } from '@noble/hashes/sha256';
import { utf8ToBytes as _kvU8, bytesToHex as _kvHex } from '@noble/hashes/utils';

let _kvSess: { head: string; h: string; n: number; last: number; gaps: number[] } | null = null;

export function kvSessionStart(gameHead: string) {
  _kvSess = { head: String(gameHead || ''), h: '0'.repeat(64), n: 0, last: 0, gaps: [] };
}

function _kvSessNote(url: string, body: string | null) {
  if (!_kvSess) return;
  const now = Date.now();
  if (_kvSess.last) _kvSess.gaps.push(now - _kvSess.last);
  if (_kvSess.gaps.length > 500) _kvSess.gaps.shift();
  _kvSess.last = now;
  _kvSess.n += 1;
  _kvSess.h = _kvHex(_kvSha(_kvU8(_kvSess.h + '|' + url + '|' + (body || ''))));
}

/** Move-log commitment + timing stats for the session. Null if none started. */
export function kvSessionDigest(): null | {
  head: string; moves: number; moveHash: string;
  meanGapMs: number; cvGap: number; spanMs: number;
} {
  if (!_kvSess || _kvSess.n === 0) return null;
  const g = _kvSess.gaps;
  const mean = g.length ? g.reduce((a, b2) => a + b2, 0) / g.length : 0;
  const varr = g.length > 1 ? g.reduce((a, b2) => a + (b2 - mean) * (b2 - mean), 0) / (g.length - 1) : 0;
  const cv = mean > 0 ? Math.sqrt(varr) / mean : 0;
  return {
    head: _kvSess.head, moves: _kvSess.n, moveHash: _kvSess.h,
    meanGapMs: Math.round(mean), cvGap: Math.round(cv * 1000) / 1000,
    spanMs: g.reduce((a, b2) => a + b2, 0),
  };
}

export function kvSessionEnd() { _kvSess = null; }

// ---------------------------------------------------------------------------
// KV_RELAY_SIG - the wallet (never the game) signs requests to KasVillage relay
// nodes so the relay can bind a seat to this wallet's key. Headers:
//   X-KV-Pub  33-byte compressed secp256k1 pubkey (hex)
//   X-KV-Ts   unix seconds
//   X-KV-Sig  BIP340 Schnorr over sha256("KV_RELAY_V2\n" + host + "\n" + METHOD
//             + "\n" + pathAndQuery + "\n" + sha256hex(body) + "\n" + floor(ts/60))
//             host = URL.host of the target (V2 binds the node: no cross-node replay)
// The text-tagged sha256 domain can never be a Kaspa tx sighash (blake2b,
// keyed "TransactionSigningHash"). Only relay hosts are signed for: the
// KasVillage *.app.runonflux.io apps and plain-IPv4 relay-port nodes. No key
// -> the request goes out unsigned, exactly as before. Signing happens only
// when the WebView host opts in: handleKvNetMessage(raw, inject, { sign: true }).
// ---------------------------------------------------------------------------
import { schnorr as _kvSchnorr, secp256k1 as _kvSecp } from '@noble/curves/secp256k1';
import { hexToBytes as _kvH2B } from '@noble/hashes/utils';

const KV_RELAY_HTTPS = KV_WNET_ALLOW.https.filter((h) => /^kasvillage[a-z0-9_-]*\.app\.runonflux\.io$/.test(h));

export function kvIsRelayUrl(url: string, devRelayHost?: string | null, allow = KV_WNET_ALLOW): boolean {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  if (!kvNetAllowed(url, allow)) return false;
  if (u.protocol === 'https:') return KV_RELAY_HTTPS.includes(u.hostname) || (!!devRelayHost && u.hostname.toLowerCase() === devRelayHost); // KV_DEV_RELAY
  if (u.protocol === 'http:') return allow.ipv4Ports.includes(+u.port);
  return false;
}

// KV_DEV_RELAY: a game may declare its own multiplayer server (any public HTTPS
// host - Cloudflare, Railway, Fly, a Flux app, ...). kvDevRelayHost() validates
// the declared value; the viewer widens that one game's allowlist to this single
// host and the bridge signs relay POSTs for it, so a dev relay running the same
// room code gets the same seat binding. Never private hosts, never plain http,
// never bare IPs (those stay on the ip:35816 path), never credentials in the URL.
export function kvDevRelayHost(declared: any): string | null {
  try {
    const s = String(declared || '').trim();
    if (!s || s.length > 200) return null;
    const u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s);
    if (u.protocol !== 'https:') return null;
    if (u.port && u.port !== '443') return null;
    if (u.username || u.password) return null;
    const h = u.hostname.toLowerCase().replace(/\.$/, '');
    if (!/^[a-z0-9.-]+$/.test(h) || !h.includes('.') || h.length > 120) return null;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return null;
    if (/(^|\.)(localhost|local|internal|lan|home|corp|test|invalid)$/.test(h)) return null;
    return h;
  } catch { return null; }
}

/** Allowlist for one game: the standard hosts plus its declared relay host. */
export function kvDevRelayAllow(declared: any): typeof KV_WNET_ALLOW | null {
  const h = kvDevRelayHost(declared);
  if (!h || KV_WNET_ALLOW.https.includes(h)) return null;
  return { ...KV_WNET_ALLOW, https: [...KV_WNET_ALLOW.https, h] };
}

export function kvRelaySigMessage(host: string, method: string, pathAndQuery: string, body: string, ts: number): Uint8Array {
  const bh = _kvHex(_kvSha(_kvU8(body)));
  return _kvSha(_kvU8('KV_RELAY_V2\n' + host.toLowerCase() + '\n' + method + '\n' + pathAndQuery + '\n' + bh + '\n' + Math.floor(ts / 60)));
}

/** Pure signer (exported for tests): returns the three relay auth headers. */
export function kvRelaySign(privHex: string, method: string, url: string, body: string, ts: number): Record<string, string> {
  const u = new URL(url);
  const priv = _kvH2B(privHex);
  const msg = kvRelaySigMessage(u.host, method, u.pathname + u.search, body, ts);
  return {
    'X-KV-Pub': _kvHex(_kvSecp.getPublicKey(priv, true)),
    'X-KV-Ts': String(ts),
    'X-KV-Sig': _kvHex(_kvSchnorr.sign(msg, priv)),
  };
}

let _kvKeyCache: { hex: string | null; at: number } | null = null;
async function _kvRelayKey(): Promise<string | null> {
  const t = Date.now();
  if (_kvKeyCache && t - _kvKeyCache.at < 60_000) return _kvKeyCache.hex;
  let hex: string | null = null;
  try { hex = await require('./proposal_share')._kvResolvePrivHex(); } catch { hex = null; }
  if (typeof hex !== 'string' || !/^[0-9a-fA-F]{64}$/.test(hex)) hex = null;
  _kvKeyCache = { hex, at: t };
  return hex;
}

async function _kvRelayHeaders(method: string, url: string, body: string | null, devRelayHost?: string | null, allow = KV_WNET_ALLOW): Promise<Record<string, string>> {
  if (method !== 'POST' || !kvIsRelayUrl(url, devRelayHost, allow)) return {};   // reads need no auth; never sign for other hosts
  try {
    const priv = await _kvRelayKey();
    if (!priv) return {};
    return kvRelaySign(priv, method, url, body || '', Math.floor(Date.now() / 1000));
  } catch { return {}; }
}

export type KvNetOpts = {
  /** Sign relay POSTs with the wallet key. Default false = never sign. */
  sign?: boolean;
  /** Host allowlist override (tests). */
  allow?: typeof KV_WNET_ALLOW;
  /** KV_DEV_RELAY: this game's declared relay host (already validated). */
  relayHost?: string | null;
};

/** Returns true if the message was a KV_WNET message (handled here). */
export function handleKvNetMessage(raw: string, inject: (js: string) => void, opts?: KvNetOpts): boolean {
  const allow = opts?.allow ?? KV_WNET_ALLOW;
  const sign = opts?.sign === true;
  let m: any;
  try { m = JSON.parse(raw); } catch { return false; }
  if (!m || typeof m.kvwnet !== 'string') return false;

  if (m.kvwnet === 'copy') {
    // KV_CLIP_GUARD: a game may copy text, but never a Kaspa address (stops address-swap tricks)
    if (typeof m.text === 'string') Clipboard.setStringAsync(m.text.slice(0, 100000).replace(/kaspa(test)?:[a-z0-9]{20,}/gi, '[address hidden]')).catch(() => {});
    return true;
  }
  if (m.kvwnet !== 'req' || !Number.isInteger(m.id)) return true;

  const reply = (payload: object) => {
    const js = JSON.stringify(payload).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    inject(`window.__kvWnetReply(${m.id}, ${js}); true;`);
  };
  const method = String(m.method || 'GET').toUpperCase();
  // KV_WNET_TRACE (dev builds only): every game request + outcome, visible in Metro
  const _trace = (msg: string) => { try { if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[KV_WNET]', method, String(m.url).slice(0, 96), '->', msg); } catch {} };
  if (!kvNetAllowed(String(m.url), allow)) { _trace('BLOCKED (host not allowed)'); reply({ error: 'blocked host: ' + String(m.url).slice(0, 80) }); return true; }
  if (method !== 'GET' && method !== 'POST') { reply({ error: 'method not allowed' }); return true; }
  if (m.body != null && (typeof m.body !== 'string' || m.body.length > MAX_BODY)) { reply({ error: 'body too large' }); return true; }

  if (method === 'POST') { try { _kvSessNote(String(m.url), typeof m.body === 'string' ? m.body : null); } catch {} }

  (async () => {
    const body0 = method === 'POST' && typeof m.body === 'string' ? m.body : null;
    const tryOnce = async (url: string): Promise<{ ok: true; status: number; body: string } | { ok: false; err: string }> => {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), kvHostTimeout(url));
      try {
        const headers: Record<string, string> = {};
        const ct = m.headers && m.headers['Content-Type'];
        if (typeof ct === 'string' && ct.length < 100) headers['Content-Type'] = ct;
        if (sign) Object.assign(headers, await _kvRelayHeaders(method, url, body0, opts?.relayHost, allow)); // KV_RELAY_SIG (opt-in; re-signed per host)
        const r = await fetch(url, { method, headers, body: method === 'POST' ? (body0 ?? undefined) : undefined, signal: c.signal });
        if (r.url && r.url !== url && !kvNetAllowed(String(r.url), allow)) return { ok: false, err: 'blocked redirect: ' + String(r.url).slice(0, 80) }; // KV_NET_REDIRECT
        const body = await r.text();
        if (body.length > MAX_RESP) return { ok: false, err: 'response too large' };
        try { _kvDeadHosts.delete(new URL(url).host); } catch {} // KV_DEAD_HOST: it answered
        return { ok: true, status: r.status, body };
      } catch (e: any) {
        try { const _u = new URL(url); if (_u.protocol === 'http:' && /^\d+\.\d+\.\d+\.\d+$/.test(_u.hostname)) _kvDeadHosts.set(_u.host, Date.now() + KV_DEAD_MS); } catch {} // KV_DEAD_HOST
        return { ok: false, err: String(e?.message || e) };
      } finally { clearTimeout(t); }
    };
    const primary = String(m.url);
    const fb = kvRelayFallbackUrl(primary, allow); // KV_RELAY_VIA_DOMAIN
    let dead = false;
    try { dead = (_kvDeadHosts.get(new URL(primary).host) || 0) > Date.now(); } catch {}
    let res = dead ? { ok: false as const, err: 'dead host (cached)' } : await tryOnce(primary);
    let via = '';
    if (!res.ok && fb) { via = ' [via domain]'; res = await tryOnce(fb); }
    if (res.ok) { _trace('HTTP ' + res.status + via + ' (' + res.body.length + 'b) ' + res.body.slice(0, 80).replace(/\s+/g, ' ')); reply({ status: res.status, body: res.body }); }
    else { _trace('ERROR' + via + ' ' + res.err.slice(0, 80)); reply({ error: res.err }); }
  })();
  return true;
}
