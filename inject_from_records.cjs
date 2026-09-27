// inject_from_records.cjs — records rail rescues the coordinate rail.
// Pulls the missing frag-0 chunks from the relay's records store (seeded by
// the re-press) and merges them into harvest_state.json, then rerun
// harvest_game.cjs to finish assembly. Run:  node inject_from_records.cjs
const fs = require('fs');
const pako = require('pako');
const SLOT0 = 'kaspatest:qq84zfnfkat2399k6ucjeugm4psx8flyx9v2ef9nvtr9g6x9c63wx9d39z594';
(async () => {
  const mc = JSON.parse(fs.readFileSync('harvest_found.json', 'utf8')).map(x => x.rec.d).sort((a, b) => a.seq - b.seq);
  const manifest = JSON.parse(Buffer.from(pako.inflate(Buffer.from(mc.map(r => r.c).join(''), 'base64'))).toString('utf8'));
  const frag0 = manifest.frags[0].h;
  console.log('hunting chunks for frag 0:', frag0.slice(0, 12) + '…');
  const st = JSON.parse(fs.readFileSync('harvest_state.json', 'utf8'));
  const r = await fetch('https://kasvillage.app.runonflux.io/api/kaspa/records/' + encodeURIComponent(SLOT0) + '?limit=4000');
  const wrapped = await r.json();
  const recs = (Array.isArray(wrapped) ? wrapped : wrapped.records || []).map(w => (w && w.record) ? w.record : w)
    .map(x => { if (typeof x === 'string') { try { return JSON.parse(x.startsWith('KVP1') ? x.slice(4) : x); } catch { return null; } } return x; });
  let added = 0;
  for (const rec of recs) {
    const d = rec && rec.d;
    if (rec && rec.k === 'cfg' && d && d.ty === 'html' && d.h === frag0) {
      const k = d.h + ':' + d.seq;
      if (!st.store[k] || rec.t > st.store[k].t) { st.store[k] = { t: rec.t, tot: d.tot, c: d.c }; added++; }
    }
  }
  fs.writeFileSync('harvest_state.json', JSON.stringify(st));
  const have = Object.keys(st.store).filter(k => k.startsWith(frag0)).map(k => +k.split(':')[1]).sort((a, b) => a - b);
  console.log('records scanned:', recs.length, '| frag0 chunks added:', added, '| frag0 seqs now:', have.join(','));
  console.log(have.length ? 'now run:  node harvest_game.cjs' : 'records empty — did the re-press finish? probe /records first');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
