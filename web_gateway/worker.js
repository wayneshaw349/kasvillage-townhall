// KasVillage Web Gateway - Cloudflare Worker (kasvillage.com)
// Read-only mirror of the on-chain Mailbox: fetches registry records from Kaspa REST,
// verifies every signature, honors delists, and renders crawlable HTML pages with
// OpenGraph tags + sitemap. Holds NO keys; wallets remain the source of truth.
import { schnorr } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';

const NET = 'testnet-10'; // flip to 'mainnet' at launch
const API = { 'mainnet': 'https://api.kaspa.org', 'testnet-10': 'https://api-tn10.kaspa.org' };
const KV_MOD_PUBKEY = '0268c16db707f28883ebd4217d20ffb02a38d3227159dd34bdb4d40a3a715e9483';
const CACHE_S = 300; // edge-cache pages for 5 min

const te = new TextEncoder();
const hex2b = (h) => { const a = new Uint8Array(h.length / 2); for (let i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; };
const b2hex = (a) => Array.from(a).map((x) => x.toString(16).padStart(2, '0')).join('');

// ---- kaspa address encode (ported from the wallet, byte-for-byte) ----
function deriveAddress(xOnlyHex, network) {
  const prefix = network === 'mainnet' ? 'kaspa' : 'kaspatest';
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  function polymod(values) { let c = 1n; for (const d of values) { const c0 = c >> 35n; c = ((c & 0x07fffffffffn) << 5n) ^ BigInt(d); if (c0 & 1n) c ^= 0x98f2bc8e61n; if (c0 & 2n) c ^= 0x79b76d99e2n; if (c0 & 4n) c ^= 0xf33e5fb3c4n; if (c0 & 8n) c ^= 0xae2eabe2a8n; if (c0 & 0x10n) c ^= 0x1e4f43e470n; } return c ^ 1n; }
  function conv8to5(p) { const r = []; let buf = 0, bits = 0; for (const b of p) { buf = (buf << 8) | b; bits += 8; while (bits >= 5) { bits -= 5; r.push((buf >> bits) & 31); buf &= (1 << bits) - 1; } } if (bits > 0) r.push((buf << (5 - bits)) & 31); return r; }
  const fp5 = conv8to5([0, ...hex2b(xOnlyHex)]);
  const pfx5 = Array.from(prefix).map((c) => c.charCodeAt(0) & 0x1f);
  const cs = polymod([...pfx5, 0, ...fp5, 0, 0, 0, 0, 0, 0, 0, 0]);
  const csB = []; for (let i = 4; i >= 0; i--) csB.push(Number((cs >> BigInt(i * 8)) & 0xffn));
  let addr = prefix + ':'; for (const d of [...fp5, ...conv8to5(csB)]) addr += CHARSET[d];
  return addr;
}
const registryAddress = (cat) => deriveAddress(b2hex(sha256(te.encode('KV-REGISTRY-V1-' + cat.toLowerCase()))), NET);

// ---- record decode + verify (mirrors kaspa_payload.ts) ----
function canonJson(x) { if (Array.isArray(x)) return '[' + x.map(canonJson).join(',') + ']'; if (x && typeof x === 'object') return '{' + Object.keys(x).sort().map((k) => JSON.stringify(k) + ':' + canonJson(x[k])).join(',') + '}'; return JSON.stringify(x); }
function decodeRec(payloadHex) {
  try { if (!payloadHex) return null; let s = ''; const b = hex2b(payloadHex); for (const c of b) s += String.fromCharCode(c); if (!s.startsWith('KVP1')) return null; return JSON.parse(decodeURIComponent(escape(s.slice(4)))); } catch { return null; }
}
function verifyRec(r) {
  try { if (!r || !r.sig || !r.o) return false; const { sig, ...body } = r; const msg = sha256(te.encode(canonJson(body))); const xo = r.o.length === 66 ? r.o.slice(2) : r.o; return schnorr.verify(hex2b(sig), msg, hex2b(xo)); } catch { return false; }
}
async function fetchRecords(address, limit = 100) {
  const u = `${API[NET]}/addresses/${encodeURIComponent(address)}/full-transactions?limit=${limit}&resolve_previous_outpoints=light`;
  const txs = await (await fetch(u, { cf: { cacheTtl: 60 } })).json();
  const out = [];
  for (const tx of txs || []) { const rec = decodeRec(tx.payload); if (rec && verifyRec(rec)) out.push({ rec, t: Number(tx.block_time || 0) }); }
  return out;
}

// ---- lanes ----
async function gamesLane() {
  const rows = await fetchRecords(registryAddress('game'), 150);
  const byHead = new Map(); const keeps = new Map(); const delist = new Map();
  for (const { rec: r, t } of rows) {
    const d = r.d || {}; const head = String(d.head || '');
    if ((r.k === 'delist' || r.k === 'undelist') && head) { const e = delist.get(head) || {}; e[r.k + ':' + r.o] = Math.max(e[r.k + ':' + r.o] || 0, r.t || t); delist.set(head, e); continue; }
    if (!head || !d.game) continue;
    const cur = byHead.get(head);
    if (!cur || (r.t || t) > cur.t) byHead.set(head, { head, game: String(d.game), owner: r.o, t: r.t || t, manifestAddress: String(d.manifestAddress || ''), price: d.price });
    if (r.k === 'keep') { const k = keeps.get(head) || { n: 0, who: new Set() }; k.n++; k.who.add(r.o); keeps.set(head, k); }
  }
  const out = [];
  for (const g of byHead.values()) {
    const dl = delist.get(g.head) || {};
    const hidden = Object.keys(dl).some((k) => { if (!k.startsWith('delist:')) return false; const o = k.slice(7); if (o !== g.owner && o !== KV_MOD_PUBKEY) return false; const liftT = dl['undelist:' + KV_MOD_PUBKEY] || 0; return dl[k] > (o === KV_MOD_PUBKEY ? liftT : 0); });
    if (hidden) continue;
    const k = keeps.get(g.head) || { n: 0, who: new Set() };
    out.push({ ...g, keeps: k.n, keepers: k.who.size });
  }
  return out.sort((a, b) => b.t - a.t);
}
async function nameLane(cat) {
  const rows = await fetchRecords(registryAddress(cat), 150);
  const byKey = new Map(); const delisted = new Set();
  for (const { rec: r, t } of rows) {
    const d = r.d || {}; const key = String(d.storeAddress || d.head || r.o || '');
    if (r.k === 'delist') { delisted.add(key + '|' + r.o); continue; }
    if (!d.name) continue;
    const cur = byKey.get(key);
    if (!cur || (r.t || t) > cur.t) byKey.set(key, { key, name: String(d.name).slice(0, 60), category: String(d.category || cat).slice(0, 30), owner: r.o, t: r.t || t });
  }
  return [...byKey.values()].filter((e) => !delisted.has(e.key + '|' + e.owner) && !delisted.has(e.key + '|' + KV_MOD_PUBKEY)).sort((a, b) => b.t - a.t);
}

// ---- html ----
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function page(title, desc, body, canonical) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="website">${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
<style>:root{color-scheme:dark}body{background:#0a0a0a;color:#e9eef2;font:16px/1.5 system-ui,sans-serif;margin:0;padding:24px;max-width:760px;margin:auto}
a{color:#ec4899;text-decoration:none}a:hover{text-decoration:underline}h1{font-size:26px}h1 b{color:#ec4899}
.card{background:#1a1a2e;border:1px solid #333;border-radius:12px;padding:14px 16px;margin:10px 0}
.card h3{margin:0 0 4px;font-size:16px}.mut{color:#9aa6b1;font-size:13px}.tag{display:inline-block;background:#4f46e5;color:#fff;border-radius:6px;padding:1px 8px;font-size:11px;margin-right:6px}
.btn{display:inline-block;background:#ec4899;color:#fff;font-weight:700;border-radius:10px;padding:10px 18px;margin-top:10px}
nav a{margin-right:14px;color:#e9eef2;font-weight:600}footer{margin-top:32px;font-size:12px;color:#5d6873}</style></head><body>
<h1><b>Kas</b>Village</h1><nav><a href="/">Home</a><a href="/games">Games</a><a href="/stores">Stores</a><a href="/dapps">DApps</a></nav>
${body}
<footer>Read-only mirror of the on-chain KasVillage Mailbox on Kaspa ${esc(NET)}. Every listing shown here is signature-verified and re-derived from the chain; deals, downloads and payments happen only in the KasVillage wallet, where content is additionally hash-verified. This site holds no keys and no user data.</footer></body></html>`;
}
const gameCard = (g) => `<div class="card"><h3><a href="/g/${esc(g.head)}">${esc(g.game)}</a></h3><div class="mut"><span class="tag">GAME</span>verified by hash · sandboxed · ${g.keeps} keep${g.keeps === 1 ? '' : 's'} by ${g.keepers} wallet${g.keepers === 1 ? '' : 's'}${g.price ? ' · ' + esc(g.price) + ' KAS/board' : ' · first board free'}</div></div>`;
const nameCard = (s, lane) => `<div class="card"><h3><a href="/s/${esc(s.key)}">${esc(s.name)}</a></h3><div class="mut"><span class="tag">${esc(lane)}</span>${esc(s.category)} · pledge-anchored on Kaspa</div></div>`;

async function handle(url) {
  const p = url.pathname.replace(/\/+$/, '') || '/';
  const site = url.origin;
  if (p === '/robots.txt') return new Response(`User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`, { headers: { 'content-type': 'text/plain' } });
  if (p === '/sitemap.xml') {
    const [g, s, d] = await Promise.all([gamesLane(), nameLane('store'), nameLane('dapp')]);
    const urls = ['/', '/games', '/stores', '/dapps', ...g.map((x) => '/g/' + x.head), ...s.map((x) => '/s/' + x.key), ...d.map((x) => '/s/' + x.key)];
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${site + u}</loc></url>`).join('')}</urlset>`, { headers: { 'content-type': 'application/xml' } });
  }
  if (p === '/') {
    const [g, s] = await Promise.all([gamesLane(), nameLane('store')]);
    return html(page('KasVillage — games, stores & DApps on Kaspa', 'A Kaspa-native village: hash-verified games, pledge-anchored stores and DApps, non-custodial escrow deals.',
      `<p class="mut">Everything below lives on the Kaspa blockchain: publishers stake KAS to list, content is verified by hash, and the community can flag bad actors off the board. Browsing is public — playing and dealing happens in the KasVillage wallet.</p>
       <h2>Latest games</h2>${g.slice(0, 5).map(gameCard).join('') || '<p class="mut">none live right now</p>'}
       <h2>Latest stores</h2>${s.slice(0, 5).map((x) => nameCard(x, 'STORE')).join('') || '<p class="mut">none live right now</p>'}`));
  }
  if (p === '/games') { const g = await gamesLane(); return html(page('Games — KasVillage', 'On-chain, hash-verified games on Kaspa.', `<h2>Games (${g.length})</h2>` + (g.map(gameCard).join('') || '<p class="mut">none live right now</p>'))); }
  if (p === '/stores') { const s = await nameLane('store'); return html(page('Stores — KasVillage', 'Pledge-anchored stores and services on Kaspa.', `<h2>Stores & services (${s.length})</h2>` + (s.map((x) => nameCard(x, 'STORE')).join('') || '<p class="mut">none live right now</p>'))); }
  if (p === '/dapps') { const d = await nameLane('dapp'); return html(page('DApps — KasVillage', 'Sandboxed, SDK-scanned DApps on Kaspa.', `<h2>DApps (${d.length})</h2>` + (d.map((x) => nameCard(x, 'DAPP')).join('') || '<p class="mut">none live right now</p>'))); }
  const gm = p.match(/^\/g\/([0-9a-f]{64})$/);
  if (gm) {
    const g = (await gamesLane()).find((x) => x.head === gm[1]);
    if (!g) return html(page('Game not found — KasVillage', 'This game is not currently live on the registry.', '<p>Not live right now — it may be pruned. Any wallet that saved it can repost it.</p>'), 404);
    return html(page(`${g.game} — on-chain game on KasVillage`, `Hash-verified Kaspa game · ${g.keeps} keeps by ${g.keepers} wallets. Play it in the KasVillage wallet.`,
      `<div class="card"><h3>${esc(g.game)}</h3><div class="mut">head ${esc(g.head.slice(0, 16))}… · kept alive by ${g.keepers} wallet${g.keepers === 1 ? '' : 's'} (${g.keeps} reposts) · every byte verified against this hash before it runs</div>
       <a class="btn" href="https://github.com/wayneshaw349/kasvillage-townhall">Get the KasVillage wallet to play</a></div>`, url.href));
  }
  const sm = p.match(/^\/s\/([a-z0-9:]{10,90})$/);
  if (sm) {
    const all = [...(await nameLane('store')), ...(await nameLane('dapp'))];
    const s = all.find((x) => x.key === sm[1]);
    if (!s) return html(page('Listing not found — KasVillage', 'Not currently live.', '<p>Not live on the registry right now.</p>'), 404);
    return html(page(`${s.name} — on KasVillage`, `${s.category} on Kaspa — pledge-anchored, community-moderated. Deal in the KasVillage wallet.`,
      `<div class="card"><h3>${esc(s.name)}</h3><div class="mut">${esc(s.category)} · publisher staked KAS to list · flags by 3 community members delist automatically</div>
       <a class="btn" href="https://github.com/wayneshaw349/kasvillage-townhall">Open in the KasVillage wallet</a></div>`, url.href));
  }
  return html(page('Not found — KasVillage', 'No such page.', '<p>Nothing here.</p>'), 404);
}
const html = (body, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': `public, s-maxage=${CACHE_S}, max-age=60` } });

export default {
  async fetch(request) {
    try { return await handle(new URL(request.url)); }
    catch (e) { return new Response('gateway error: ' + (e && e.message), { status: 500 }); }
  },
};
