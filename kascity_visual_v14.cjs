// kascity_visual_v14.cjs
// Reads kascity_v13.json + scene_engine.html -> writes kascity_v14.json + showcase_kascity14.html
// Changes: portraits 3x smaller (0.32 -> 0.11); every property tile gets a mini art billboard
// (district-themed sprite clipped above the square) so buyers can see what they're buying;
// tiles tinted by district wealth (poor worn -> rich gold). No BT changes.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }

const V13 = 'kascity_v13.json';
if (!fs.existsSync(V13)) die(V13 + ' missing');
if (!fs.existsSync('scene_engine.html')) die('scene_engine.html missing');
let engine = fs.readFileSync('scene_engine.html', 'utf8');
const j = JSON.parse(fs.readFileSync(V13, 'utf8'));
const RES = j.resources || die('resources missing');
const nodes = j.nodes;
const byId = id => nodes.find(n => n.id === id);

// ---------- 1. portraits 3x smaller ----------
let portN = 0;
for (let p = 1; p <= 4; p++) {
  const n = byId('portrait_p' + p);
  if (!n) die('portrait_p' + p + ' missing');
  n.transform.scale = [0.11, 0.11, 0.11];
  portN++;
}
if (portN !== 4) die('portraits ' + portN);

// ---------- 2. district map: band material -> wealth tier + art sprite ----------
// poor: plumbing/sidewalk problems | mid: appliances/hvac | upper: storm/electrical | rich: lawsuits/deeds
const district = {
  g_kiln:      { tier: 'poor',  art: 'pipes' },
  g_copper:    { tier: 'poor',  art: 'walks' },
  g_market:    { tier: 'mid',   art: 'appl'  },
  g_orchard:   { tier: 'mid',   art: 'hvac'  },
  g_amber:     { tier: 'upper', art: 'storm' },
  g_beacon:    { tier: 'upper', art: 'volt'  },
  g_cathedral: { tier: 'rich',  art: 'court' },
  g_crown:     { tier: 'rich',  art: 'deed'  }
};
const tierMat = {
  poor:  { color: '#cbb894' },
  mid:   { color: '#e0d2ae' },
  upper: { color: '#eee0bd' },
  rich:  { color: '#f6e8c2' }
};
for (const t of Object.keys(tierMat)) RES.materials['tile_' + t] = tierMat[t];

// ---------- 3. per-tile art billboards + tint ----------
const panelTpl = byId('panel_deed');
if (!panelTpl) die('panel_deed missing');
for (const a of Object.values(district)) if (!RES.sprites[a.art]) die('sprite ' + a.art + ' missing');

let artN = 0, tintN = 0;
for (let i = 0; i < 40; i++) {
  const tile = byId('tile_' + i);
  if (!tile || !tile.children) continue;
  const band = tile.children.find(c => /^band_/.test(c.id || ''));
  if (!band || !district[band.material]) continue;
  const d = district[band.material];
  tile.material = 'tile_' + d.tier; tintN++;

  const clone = JSON.parse(JSON.stringify(panelTpl));
  (function swap(o) {
    if (!o || typeof o !== 'object') return;
    for (const k of Object.keys(o)) {
      if (o[k] === 'deed') o[k] = d.art;
      else if (typeof o[k] === 'string' && /^panel_deed/.test(o[k])) o[k] = o[k].replace('panel_deed', 'tileart_' + i);
      else if (typeof o[k] === 'object') swap(o[k]);
    }
  })(clone);
  clone.id = 'tileart_' + i;
  delete clone.hidden;
  const tp = tile.transform.pos;
  clone.transform = { pos: [tp[0], 1.05, tp[2]], scale: [0.12, 0.12, 0.12] };
  nodes.push(clone);
  artN++;
}
if (artN < 16) die('tile art billboards ' + artN + ' (<16)');
if (tintN !== artN) die('tint/art mismatch ' + tintN + '/' + artN);

// node cap
function countAll(list) { let c = 0; for (const n of list) { c++; if (n.children) c += countAll(n.children); } return c; }
const total = countAll(nodes);
const cap = (j.compliance && j.compliance.maxNodes) || 512;
if (total > cap) die('node count ' + total + ' exceeds cap ' + cap);

// ---------- write ----------
const v14str = JSON.stringify(j);
fs.writeFileSync('kascity_v14.json', v14str);

const anchor = 'if (n.type === "ProgressBar" && n.bind) {';
if (engine.split(anchor).length - 1 !== 1) die('engine bind anchor mismatch');
const labelBind = 'if (n.type === "Label" && n.bind) { var cvb = resolvePath(n.bind.split("."), exprCtx(null)); if (cvb != null && cvb === cvb) n.text = "" + Math.round(cvb); }\n    ';
engine = engine.split(anchor).join(labelBind + anchor);
const inject = [
  '', '// ---- injected kascity v14 showcase ----',
  'try { loadScene(' + JSON.stringify(v14str) + '); }',
  "catch (e) { console.error('kascity14 boot: ' + (e && e.message)); }", ''
].join('\n');
fs.writeFileSync('showcase_kascity14.html', engine.replace('</script>', inject + '\n</script>'));

console.log('PASS portraits 0.11 (3x smaller)');
console.log('PASS district tint on ' + tintN + ' tiles (poor->rich)');
console.log('PASS tile art billboards ' + artN);
console.log('PASS nodes ' + total + '/' + cap);
console.log('OK kascity_v14.json (' + (v14str.length / 1024).toFixed(1) + ' KB)');
console.log('OK showcase_kascity14.html');
