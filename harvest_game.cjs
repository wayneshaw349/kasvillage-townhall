// harvest_game.cjs — rebuild the ENTIRE GAME from raw blocks, outside the app.
//
// Uses only: pruning point (or a saved checkpoint) + the stateless /blocks
// passthrough + the manifest already harvested (harvest_found.json). Collects
// all 396 fragment chunk payloads in the publish window, assembles 66
// fragments, verifies the hash chain to HEAD and the full-page sha256.
// Crash-safe: progress checkpoints to harvest_state.json every page — Ctrl-C
// or a network death resumes where it left off, never from the pruning point.
//
// Run:  node harvest_game.cjs      (expects harvest_found.json beside it)
const BASE = 'https://kasvillage.app.runonflux.io';
const SPAN_START = 581218000;   // fragments began ~433s before the manifest
const SPAN_END   = 581224400;
const HTML_SHA   = '512b8dd2d563c14611baa16b1392182213c24af40001da8a4234e62cb8737946';
const HEAD       = 'ef0c3a6ff34488044747589b3ee301c238879f496f60bf7bfb6c9fa7292ff63a';
const crypto = require('crypto');
const fs = require('fs');
const pako = require('pako');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

async function j(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url.slice(0, 90) + ' -> ' + r.status);
  return r.json();
}
(async () => {
  // 1. Rebuild the manifest from the previous harvest
  const mc = JSON.parse(fs.readFileSync('harvest_found.json', 'utf8')).map(x => x.rec.d).sort((a, b) => a.seq - b.seq);
  const manifest = JSON.parse(Buffer.from(pako.inflate(Buffer.from(mc.map(r => r.c).join(''), 'base64'))).toString('utf8'));
  console.log('manifest: frags', manifest.frags.length, '| head', manifest.head.slice(0, 12), '| html bytes', manifest.html_bytes);
  if (manifest.head !== HEAD) { console.error('head mismatch!'); process.exit(1); }
  // verify the chain BEFORE trusting fragment hashes (link_i = sha(prev + h_i))
  let prev = '0'.repeat(64);
  for (const f of manifest.frags) {
    if (sha(Buffer.from(prev + f.h, 'utf8')) !== f.link) { console.error('chain broken at', f.i); process.exit(1); }
    prev = f.link;
  }
  if (prev !== HEAD) { console.error('chain does not end at HEAD'); process.exit(1); }
  console.log('hash chain verified: 66 links -> HEAD ✓');
  const want = new Set(manifest.frags.map(f => f.h));

  // 2. Walk (resume from checkpoint if present)
  const t0 = Date.now();
  let low, phase, store;
  if (fs.existsSync('harvest_state.json')) {
    ({ low, phase, store } = JSON.parse(fs.readFileSync('harvest_state.json', 'utf8')));
    console.log('RESUMING from checkpoint: phase', phase, 'daa-cursor saved');
  } else if (process.argv[2] && /^[0-9a-f]{64}$/.test(process.argv[2])) {
    low = process.argv[2]; phase = 'skim'; store = {};
    console.log('walk from PROVIDED ANCHOR', low.slice(0, 16) + '… (span entry in seconds, not minutes)');
  } else {
    const sink = await j(BASE + '/api/kaspa/sink');
    low = sink.pruning_point; phase = 'skim'; store = {};
    console.log('fresh walk from pruning point', low.slice(0, 16) + '… (~80 min; checkpointed)');
  }
  let pages = 0;
  while (true) {
    let page;
    try { page = await j(BASE + `/api/kaspa/blocks?low_hash=${low}&daa_max=${SPAN_END}&txs=${phase === 'full' ? 1 : 0}`); }
    catch (e) { console.log('page error, retry 2s:', String(e).slice(0, 90)); await new Promise(r => setTimeout(r, 2000)); continue; }
    pages++;
    const hi = page.page_daa_max || 0;
    if (phase === 'skim' && hi >= SPAN_START) {
      phase = 'full';
      console.log('>>> entering span (refetching crossing page with payloads)');
      continue; // refetch the SAME cursor with txs=1 so the crossing page is not skipped
    }
    if (phase === 'full') {
      for (const b of page.blocks || []) for (const tx of b.txs || []) {
        try {
          const raw = Buffer.from(tx.payload_hex, 'hex').toString('utf8');
          const rec = JSON.parse(raw.startsWith('KVP1') ? raw.slice(4) : raw);
          const d = rec && rec.d;
          if (rec.k === 'cfg' && d && d.ty === 'html' && want.has(d.h)) {
            const k = d.h + ':' + d.seq;
            if (!store[k] || rec.t > store[k].t) store[k] = { t: rec.t, tot: d.tot, c: d.c };
          }
        } catch {}
      }
    }
    if (pages % 50 === 0 || (phase === 'full' && pages % 10 === 0)) {
      console.log(`[${phase}] page ${pages}  daa ${hi}  chunks ${Object.keys(store).length}  (${Math.round((Date.now() - t0) / 1000)}s)`);
    }
    if (page.next_low_hash) low = page.next_low_hash;
    fs.writeFileSync('harvest_state.json', JSON.stringify({ low, phase, store }));
    if (page.done || !page.next_low_hash) break;
  }
  console.log('walk finished. chunk records:', Object.keys(store).length);

  // 3. Assemble fragments -> page
  const texts = [];
  let missing = 0;
  for (const f of manifest.frags) {
    const tot = store[f.h + ':0'] ? store[f.h + ':0'].tot : null;
    if (tot == null) { console.log('MISSING all chunks for frag', f.i, f.h.slice(0, 10)); missing++; continue; }
    let b64 = '', ok = true;
    for (let i = 0; i < tot; i++) {
      const c = store[f.h + ':' + i];
      if (!c) { console.log('missing chunk', i, 'of frag', f.i); ok = false; missing++; break; }
      b64 += c.c;
    }
    if (!ok) continue;
    const text = Buffer.from(pako.inflate(Buffer.from(b64, 'base64'))).toString('utf8');
    if (sha(Buffer.from(text, 'utf8')) !== f.h) { console.log('frag', f.i, 'hash mismatch'); missing++; continue; }
    texts[f.i] = text;
  }
  if (missing) { console.log(missing, 'fragments incomplete — state saved; a rerun continues the walk'); process.exit(1); }
  const html = texts.join('');
  const gotSha = sha(Buffer.from(html, 'utf8'));
  console.log('assembled page:', html.length, 'bytes | sha256', gotSha);
  console.log(gotSha === HTML_SHA ? '*** FULL GAME REBUILT FROM RAW BLOCKS — MATCH ***' : 'sha mismatch vs ' + HTML_SHA);
  fs.writeFileSync('kascity_harvested.html', html);
  console.log('written: kascity_harvested.html — open it in a browser.');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
