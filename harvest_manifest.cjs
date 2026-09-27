// harvest_manifest.cjs — PROVE THE COORDINATES, outside the app, zero chain writes.
//
// Walks raw blocks via the relay's stateless passthrough:
//   pruning_point --(txs=0 skim, light)--> daa ~581.21M --(txs=1)--> 581.23M
// hunting tonight's 5 manifest chunk txs (ids from the publish log). If their
// payloads assemble + hash to the known manifestHash, retrieval-from-
// coordinates is proven with no indexer, no records store, no new txs.
//
// Run on the PC:  node harvest_manifest.cjs
const BASE = 'https://kasvillage.app.runonflux.io';
const TARGETS = new Set([
  '069f6d34a0bb941994afb5e78423dfd9f386e0166db233f10b4c238e5067eb7e',
  'e0c569dd98633f189d3d08accd91234e8ad5fc648009eef8a53e687aef69d854',
  '7d78bb64ff0e572567b285511271963c23445043ad235e19a410da94d7ed02a9',
  '0750da821bea49cc8abde81dc12104156a41cfa292d2b5e0302c8c922c4037b7',
  'a567c0657a2bf16e799cd0d94692219174170e88e479c7ed36e84449b7b51d21',
]);
const MANIFEST_HASH = '523a54405c51997410fb72c31bdc088c61720aa709b5ff4f38f3e25c316a98b3';
const SPAN_START = 581210000;   // switch to full pages here (margin before cluster)
const SPAN_END   = 581230000;   // stop after cluster
const crypto = require('crypto');
const fs = require('fs');

async function j(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' -> ' + r.status + ' ' + (await r.text()).slice(0, 120));
  return r.json();
}
(async () => {
  const t0 = Date.now();
  const sink = await j(BASE + '/api/kaspa/sink');
  console.log('virtual daa:', sink.virtual_daa_score, '| pruning point:', sink.pruning_point.slice(0, 16) + '…');
  let low = sink.pruning_point;
  let pages = 0, found = {};
  let phase = 'skim';
  while (true) {
    const wantTx = phase === 'full' ? 1 : 0;
    let page;
    try {
      page = await j(BASE + `/api/kaspa/blocks?low_hash=${low}&daa_max=${SPAN_END}&txs=${wantTx}`);
    } catch (e) {
      console.log('page error, retrying in 2s:', String(e).slice(0, 120));
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }
    pages++;
    const hi = page.page_daa_max || 0;
    if (pages % 50 === 0 || phase === 'full') {
      const pct = Math.min(100, Math.round(100 * (hi - 580150000) / (SPAN_END - 580150000)));
      console.log(`[${phase}] page ${pages}  daa ${hi}  (${Math.round((Date.now() - t0) / 1000)}s)`);
    }
    if (phase === 'skim' && hi >= SPAN_START) {
      phase = 'full';
      console.log('>>> entering span, full pages on');
    }
    if (phase === 'full') {
      for (const b of page.blocks || []) {
        for (const tx of b.txs || []) {
          if (TARGETS.has(tx.id) && !found[tx.id]) {
            found[tx.id] = { daa: b.daa_score, payload_hex: tx.payload_hex };
            console.log('FOUND', tx.id.slice(0, 12), 'at daa', b.daa_score, `(${Object.keys(found).length}/5)`);
          }
        }
      }
    }
    if (Object.keys(found).length === 5) break;
    if (page.done) { console.log('walk exhausted (done flag) — stopping'); break; }
    if (!page.next_low_hash) { console.log('no next hash — stopping'); break; }
    low = page.next_low_hash;
  }
  console.log('\npages:', pages, 'elapsed:', Math.round((Date.now() - t0) / 1000) + 's', 'found:', Object.keys(found).length + '/5');
  if (!Object.keys(found).length) return;
  // decode + assemble
  const chunks = Object.entries(found).map(([id, f]) => {
    const raw = Buffer.from(f.payload_hex, 'hex').toString('utf8');
    const json = JSON.parse(raw.startsWith('KVP1') ? raw.slice(4) : raw);
    return { id, daa: f.daa, rec: json };
  });
  fs.writeFileSync('harvest_found.json', JSON.stringify(chunks, null, 2));
  console.log('payloads written to harvest_found.json; keys of first record:', Object.keys(chunks[0].rec).join(','));
  // try common assembly shapes: sort by seq-ish field, concat data-ish field
  const seqKey = ['s', 'seq', 'i'].find(k => k in chunks[0].rec);
  const datKey = ['d', 'data', 'c'].find(k => k in chunks[0].rec);
  if (seqKey && datKey) {
    chunks.sort((a, b) => a.rec[seqKey] - b.rec[seqKey]);
    const joined = chunks.map(c => c.rec[datKey]).join('');
    for (const [label, buf] of [['utf8', Buffer.from(joined, 'utf8')], ['b64', Buffer.from(joined, 'base64')]]) {
      const h = crypto.createHash('sha256').update(buf).digest('hex');
      console.log(`assembled(${label}) sha256:`, h, h === MANIFEST_HASH ? '<== MATCH — THEORY PROVEN' : '');
    }
  } else {
    console.log('unknown chunk shape — inspect harvest_found.json (proof of retrieval already achieved)');
  }
})().catch(e => { console.error('FATAL', e); process.exit(1); });
