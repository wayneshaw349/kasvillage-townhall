// wire_publish_any.cjs — #7 universal publishing: any HTML game/app by URL, no PC step.
//  kv_build_chain.ts (new): on-phone port of make_chain.cjs - identical HEAD for identical input,
//     same wallet-safe rewrites, same <=60 KB hash-chained fragments, real publisher chunk counts,
//     scans (page, every fragment, visible text through the content filter) - blocked = not publishable.
//  Workspace: "+ PUBLISH ANY HTML GAME (by URL)" -> paste link -> game id -> build + scan ->
//     it gets its own row (PUBLISH / ANNOUNCE / SEND BOARD / GRANT / DELIST / UNLISTED all work).
//     Saved in kv_my_games (link + manifest, not the page) and rebuilt from the link when publishing;
//     if the page at the link changed, it refuses (HEAD mismatch) instead of publishing something else.
//     Nonce base per (your key, game id) is deterministic and far from existing ranges.
const fs = require('fs');
const LIB = "// kv_build_chain.ts \u2014 on-phone port of make_chain.cjs (universal publishing, #7).\n// Any HTML -> wallet-safe chain edition -> <=60 KB hash-chained fragments -> bundle for runPublish.\n// Same rewrite rules, same fragmenting, same hash chain => same HEAD as make_chain.cjs for the same input.\n// Chunk counts use the real publisher (htmlToChunkData), so slot allocation matches what gets sent.\nimport { sha256 } from '@noble/hashes/sha256';\nimport { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';\n\nconst FRAG_MAX = 60000, ZERO = '0'.repeat(64), SLOT_MAX = 300, KAS_PER_CHUNK = 0.2;\nconst shaHex = (s: string) => bytesToHex(sha256(utf8ToBytes(s)));\nconst blen = (s: string) => utf8ToBytes(s).length;\n\nexport interface ChainBuild { ok: boolean; issues: string[]; bundle?: any; head?: string; htmlBytes?: number; chunks?: number; estKas?: number }\n\nexport function buildChainBundle(srcHtml: string, game: string): ChainBuild {\n  const issues: string[] = [];\n  if (!/^[a-z0-9-]{3,48}$/.test(game)) return { ok: false, issues: ['game id must be 3-48 chars of a-z 0-9 -'] };\n  const srcSha = shaHex(srcHtml);\n  let html = srcHtml;\n  // network + clipboard go through the wallet bridge only (identical to make_chain.cjs)\n  html = html.replace(/navigator\\.clipboard && navigator\\.clipboard\\.writeText/g, 'window.KV_WNET && KV_WNET.copy');\n  html = html.replace(/navigator\\.clipboard\\.writeText\\(/g, 'KV_WNET.copy(');\n  html = html.replace(/\\bfetch\\s*\\(/g, 'KV_WNET.req(');\n  const STUB = '<script>window.KV_WNET=window.KV_WNET||{req:function(){return Promise.reject(new Error(\"offline: open KasCity in the KasVillage wallet\"));},copy:function(){return Promise.reject(new Error(\"no clipboard\"));}};</script>\\n';\n  html = STUB + html;\n  const htmlSha = shaHex(html), htmlBytes = blen(html);\n\n  // fragments (same algorithm as make_chain.cjs)\n  const { htmlToChunkData, scanHtmlForPublish } = require('./html_chunks');\n  const frags: any[] = [];\n  for (let pos = 0, prev = ZERO; pos < html.length; ) {\n    let end = Math.min(html.length, pos + FRAG_MAX);\n    while (blen(html.slice(pos, end)) > FRAG_MAX) end -= 256;\n    if (end < html.length) { const nl = html.lastIndexOf('\\n', end); if (nl > pos + FRAG_MAX / 2) end = nl + 1; }\n    if (end < html.length && /[\\uD800-\\uDBFF]/.test(html[end - 1])) end--;\n    const text = html.slice(pos, end), fh = shaHex(text), link = shaHex(prev + fh);\n    const nChunks = htmlToChunkData(text).chunks.length;\n    frags.push({ i: frags.length, h: fh, prev, link, bytes: blen(text), chunks: nChunks, text });\n    prev = link; pos = end;\n  }\n  if (!frags.length) return { ok: false, issues: ['empty page'] };\n  const head = frags[frags.length - 1].link;\n  let slot = 0, used = 0;\n  for (const f of frags) { if (used + f.chunks > SLOT_MAX) { slot++; used = 0; } f.slot = slot; used += f.chunks; }\n  const tot = frags.reduce((a: number, f: any) => a + f.chunks, 0);\n  if (slot + 1 > 80) issues.push('too many address slots (' + (slot + 1) + ') - game too large');\n\n  // wallet scans: full page with the game cap, every fragment on its own, visible text through the content filter\n  try { const { scanGameForPublish } = require('./game_chunks'); const g = scanGameForPublish(html); if (!g.ok) for (const x of g.issues) issues.push('page: ' + x.code + (x.detail ? ' ' + String(x.detail).slice(0, 60) : '')); } catch (e: any) { issues.push('page scan error: ' + String(e && e.message || e)); }\n  for (const f of frags) { try { const r = scanHtmlForPublish(f.text); for (const x of (r.issues || [])) issues.push('fragment ' + f.i + ': ' + x.code); } catch {} }\n  try {\n    const cf = require('./content_filter'); const scan = cf.scanObjectStrict || cf.scanObject;\n    const visible = srcHtml.replace(/<script[\\s\\S]*?<\\/script>/gi, ' ').replace(/<style[\\s\\S]*?<\\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').slice(0, 200000);\n    // KV_SCRIPT_STRINGS: canvas games draw text from JS - scan string literals too\n    const lits: string[] = []; const _re = /([\"\x27`])((?:\\\\.|(?!\\1)[^\\\\\\n]){4,300})\\1/g; let _m: any; let _n = 0;\n    while ((_m = _re.exec(srcHtml)) && _n < 20000) { _n++; if (/[a-z]{3,}\\s+[a-z]{2,}/i.test(_m[2])) lits.push(_m[2]); }\n    const r = scan({ text: visible, strings: lits });\n    if (r && r.ok === false) issues.push('content: ' + r.reason);\n  } catch {}\n\n  const manifest = {\n    kind: 'kv_game_manifest', v: 2, game, build: game, source_sha256: srcSha,\n    html_sha256: htmlSha, html_bytes: htmlBytes, head, frag_max: FRAG_MAX, total_chunks: tot, est_kas: +(tot * KAS_PER_CHUNK).toFixed(1),\n    slots: slot + 1, frags: frags.map((f) => ({ i: f.i, h: f.h, link: f.link, bytes: f.bytes, chunks: f.chunks, slot: f.slot })),\n    addresses: new Array(slot + 1).fill(null), music: null,\n  };\n  // solve the puzzle exactly as the wallet will\n  let pl = ZERO, joined = '';\n  for (const fr of manifest.frags) { const t = frags[fr.i].text; if (shaHex(t) !== fr.h || shaHex(pl + fr.h) !== fr.link) { issues.push('chain broken at ' + fr.i); break; } pl = fr.link; joined += t; }\n  if (pl !== head || shaHex(joined) !== htmlSha) issues.push('puzzle does not solve to the page');\n  const bundle = { manifest, frags: frags.map((f) => ({ kind: 'kv_frag', v: 1, game, i: f.i, n: frags.length, h: f.h, prev: f.prev, link: f.link, bytes: f.bytes, text: f.text })) };\n  return { ok: issues.length === 0, issues, bundle, head, htmlBytes, chunks: tot, estKas: manifest.est_kas };\n}\n\n/** Deterministic, collision-resistant nonce base per (publisher, game): 2,000,000 + k*100, k < 100,000. */\nexport function nonceBaseFor(pubkeyHex: string, game: string): number {\n  return 2000000 + (parseInt(shaHex(pubkeyHex + ':' + game).slice(0, 8), 16) % 100000) * 100;\n}\n";
const AS = "require('@react-native-async-storage/async-storage').default";

const FNS = `  // KV_PUBLISH_ANY: universal publishing - any HTML game/app by URL
  const [gamesTick, setGamesTick] = useState(0);
  try {
    const _g: any = globalThis as any;
    if (!_g.__kvMyGamesLoaded) {
      _g.__kvMyGamesLoaded = 1;
      ${AS}.getItem('kv_my_games').then((v: any) => {
        try {
          const m = JSON.parse(v || '{}'); const { TRUSTED_GAMES } = require('./game_chunks');
          for (const id of Object.keys(m)) {
            if (!(GAMES as any)[id]) (GAMES as any)[id] = { bundle: { manifest: m[id].manifest, frags: [] }, head: m[id].head, nonceBase: m[id].nonceBase, url: m[id].url };
            (TRUSTED_GAMES as any)[id] = m[id].head;
          }
          setGamesTick((x: number) => x + 1);
        } catch {}
      });
    }
  } catch {}
  const kvFetchBuild = async (url: string, id: string) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error('could not fetch the page (' + r.status + ')');
    const html = await r.text();
    const { buildChainBundle } = require('./kv_build_chain');
    return buildChainBundle(html, id);
  };
  const runPublishAny = () => {
    const kvP = require('./kv_prompt').kvPrompt;
    kvP('Publish any HTML - link', 'Link to the finished .html (GitHub raw, your own site...). The wallet fetches it, makes the chain edition and scans it.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Next', onPress: (url: string) => {
      url = String(url || '').trim();
      if (!/^https:\\/\\/\\S+$/i.test(url)) { Alert.alert('Bad link', 'Use a full https:// link to the .html file.'); return; }
      const guess = (url.split('?')[0].split('/').pop() || 'game').replace(/\\.html?$/i, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'game';
      setTimeout(() => kvP('Game id', 'a-z, 0-9 and - only. Names the listing and its on-chain addresses.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Build', onPress: async (id: string) => {
        id = String(id || '').trim().toLowerCase();
        if (gbusy) return;
        setGbusy(id); setGlog([]);
        try {
          const prevE: any = (GAMES as any)[id];
          if (prevE && !prevE.url) throw new Error('"' + id + '" is a built-in game id - pick another');
          gadd('fetching ' + url);
          const b: any = await kvFetchBuild(url, id);
          if (!b.ok) { b.issues.forEach((x: string) => gadd('BLOCKED: ' + x)); setGbusy(''); Alert.alert('Not publishable', b.issues.slice(0, 6).join('\\n') + (b.issues.length > 6 ? '\\n\\u2026' : '')); return; }
          gadd('built ' + b.bundle.frags.length + ' fragments | HEAD ' + b.head.slice(0, 16) + '\\u2026 | ' + b.chunks + ' chunks (~' + b.estKas + ' KAS)');
          const { _kvResolvePrivHex } = require('./proposal_share');
          const priv = await _kvResolvePrivHex(); if (!priv) throw new Error('wallet keys unavailable');
          const pub = bytesToHex(secp256k1.getPublicKey(hexToBytes(priv), true));
          const { nonceBaseFor } = require('./kv_build_chain');
          const nonceBase = (prevE && prevE.nonceBase) || nonceBaseFor(pub, id);
          (GAMES as any)[id] = { bundle: b.bundle, head: b.head, nonceBase, url };
          const { TRUSTED_GAMES } = require('./game_chunks'); (TRUSTED_GAMES as any)[id] = b.head;
          const _A = ${AS};
          const saved = JSON.parse((await _A.getItem('kv_my_games')) || '{}');
          saved[id] = { url, head: b.head, nonceBase, manifest: b.bundle.manifest, savedAt: Date.now() };
          await _A.setItem('kv_my_games', JSON.stringify(saved));
          setGamesTick((x: number) => x + 1);
          setGbusy('');
          const unl = !!(globalThis as any).__kvUnlisted;
          Alert.alert('Ready: ' + id, b.bundle.frags.length + ' fragments, about ' + b.estKas + ' KAS to publish.\\nIt has its own row now. PUBLISH puts it on chain' + (unl ? ' (UNLISTED is on: no public announce).' : ' and announces it.'), [
            { text: 'Later', style: 'cancel' },
            { text: 'Publish now', onPress: () => runPublish(id) },
          ]);
        } catch (e: any) { gadd('ERROR: ' + String((e && e.message) || e)); setGbusy(''); Alert.alert('Publish any failed', String((e && e.message) || e)); }
      } }], 'plain-text', guess), 450);
    } }], 'plain-text', 'https://');
  };
`;

const jobs = [
  { f: 'Workspace.tsx', marker: 'KV_PUBLISH_ANY', edits: [
    ["  const runDelist = async (gameId: string) => {", FNS + "  const runDelist = async (gameId: string) => {"],
    ["      const entry = GAMES[gameId];\n      const { publishGamePuzzle, fetchGamePuzzle, TRUSTED_GAMES } = require('./game_chunks');\n",
     `      const entry = GAMES[gameId];
      const { publishGamePuzzle, fetchGamePuzzle, TRUSTED_GAMES } = require('./game_chunks');
      if (entry && (entry as any).url && (!entry.bundle.frags || !entry.bundle.frags.length)) { // KV_PUBLISH_ANY rebuild from the link
        gadd('rebuilding from ' + (entry as any).url);
        const rb: any = await kvFetchBuild((entry as any).url, gameId);
        if (!rb.ok || rb.head !== entry.head) { gadd('ERROR: the page at the link changed or is blocked - use PUBLISH ANY HTML again (' + (rb.issues || []).slice(0, 2).join('; ') + ')'); setGbusy(''); return; }
        entry.bundle = rb.bundle;
      }
`],
    ["      {Object.entries(GAMES).map(([id, e]: any) => (",
     `      <TouchableOpacity disabled={!!gbusy} onPress={runPublishAny} style={{ backgroundColor: '#13261f', borderWidth: 1, borderColor: '#16a34a', borderRadius: 8, padding: 10, marginBottom: 8, alignItems: 'center' }}>
        <Text style={{ color: '#4ade80', fontWeight: '800', fontFamily: 'monospace', fontSize: 12 }}>{'\\uFF0B PUBLISH ANY HTML GAME (by link)'}</Text>
      </TouchableOpacity>
      {Object.entries(GAMES).map(([id, e]: any) => (`],
    ["'PUBLISH ' + id + ' (' + e.bundle.frags.length + ' frags)'",
     "'PUBLISH ' + id + ' (' + (e.bundle.frags.length || (e.bundle.manifest && e.bundle.manifest.frags ? e.bundle.manifest.frags.length : 0)) + ' frags)'"],
  ] },
];
let ok = true; const staged = [];
for (const j of jobs) {
  let s = fs.readFileSync(j.f, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes(j.marker)) { console.log(j.f + ': already patched - skipping'); continue; }
  for (const [a] of j.edits) { const c = s.split(a).length - 1; if (c !== 1) { console.error(j.f + ' ANCHOR count ' + c + ' expected 1: ' + a.slice(0, 70).replace(/\n/g, ' ')); ok = false; } }
  staged.push({ ...j, s, CRLF });
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
if (!fs.existsSync('kv_build_chain.ts')) { fs.writeFileSync('kv_build_chain.ts', LIB); console.log('kv_build_chain.ts: created'); } else console.log('kv_build_chain.ts: exists');
for (const j of staged) { let s = j.s; for (const [a, b] of j.edits) s = s.split(a).join(b); fs.writeFileSync(j.f, j.CRLF ? s.replace(/\n/g, '\r\n') : s); console.log(j.f + ': patched'); }
console.log('DONE - universal publishing: + PUBLISH ANY HTML GAME (by link) in Workspace.');
