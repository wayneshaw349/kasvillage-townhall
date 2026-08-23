// kascity_visual_v24.cjs
// Reads kascity_v23.json + scene_engine.html -> writes kascity_v24.json + showcase_kascity24.html
// Economy rework per Wayne:
//  - REMOVED: credit-line lap repayment + flat mortgage tiers (v23 blocks stripped)
//  - NEW: buying property = taking a mortgage. Purchase price is the down payment; an equal amount
//    goes onto your MORTGAGE debt (seat stat 'mort'). Every revolution past GO you pay the mortgage
//    bill (50/lap, 25 when nearly paid) until it's cleared. Cash-based. Trades/acquisitions add debt too.
//  - HUD: CREDIT row relabeled MORTGAGE, bound to the debt. BANK (net worth) unchanged.
// Visuals: buildings rebuilt bigger + brighter so every square reads clearly.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v23.json')) die('kascity_v23.json missing');
if (!fs.existsSync('scene_engine.html')) die('scene_engine.html missing');
let engine = fs.readFileSync('scene_engine.html', 'utf8');
const j = JSON.parse(fs.readFileSync('kascity_v23.json', 'utf8'));
const RES = j.resources || die('resources missing');
const byId = id => j.nodes.find(n => n.id === id);
const director = byId('director') || die('director missing');

// ---------- 1. strip v23 loan/tier blocks from pass-GO ----------
let stripped = 0;
(function walkS(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.sequence)) {
    for (let i = o.sequence.length - 1; i >= 0; i--) {
      const e = o.sequence[i];
      if (e && Array.isArray(e.selector) && e.selector[0] && Array.isArray(e.selector[0].sequence)) {
        const c = e.selector[0].sequence[0] && e.selector[0].sequence[0].cond;
        if (c === "seatStat(seat(),'credit') >= 50" || c === "seatStat(seat(),'props') >= 4" || c === "seatStat(seat(),'props') >= 8") {
          o.sequence.splice(i, 1); stripped++;
        }
      }
    }
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walkS(v);
})(director.bt);
if (stripped !== 3) die('v23 blocks stripped ' + stripped + ' != 3');

// ---------- 2. mortgage accrual: props+1 acquisitions add debt = price ----------
let mtN = 0;
(function walkM(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.sequence)) {
    const seq = o.sequence;
    for (let i = seq.length - 1; i >= 0; i--) {
      const e = seq[i];
      if (e && e.do && e.do.action === 'addSeatStat' && e.do.args && e.do.args[1] === 'propval' && e.do.amount > 0) {
        // propval positive == acquisition; mirror onto mort
        seq.splice(i + 1, 0, { do: { action: 'addSeatStat', args: [e.do.args[0], 'mort'], amount: e.do.amount } });
        mtN++;
      }
    }
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walkM(v);
})(director.bt);
if (mtN < 20) die('mortgage accrual insertions ' + mtN + ' (<20)');

// ---------- 3. per-lap mortgage bill on pass-GO ----------
let goN = 0;
(function walkG(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.sequence) && o.sequence.some(e => e && e.cond === 'world.flags.sum >= 40')) {
    o.sequence.push(
      { selector: [
        { sequence: [
          { cond: "seatStat(seat(),'mort') >= 50" },
          { do: { action: 'addSeatStat', args: ['current', 'cash'], amount: -50 } },
          { do: { action: 'addSeatStat', args: ['current', 'mort'], amount: -50 } },
          { do: { action: 'playSound', args: ['tax'] } }
        ]},
        { sequence: [
          { cond: "seatStat(seat(),'mort') >= 1" },
          { do: { action: 'addSeatStat', args: ['current', 'cash'], amount: -25 } },
          { do: { action: 'addSeatStat', args: ['current', 'mort'], amount: -25 } },
          { do: { action: 'playSound', args: ['tax'] } }
        ]},
        { cond: '1 == 1' }
      ]},
      { selector: [
        { sequence: [
          { cond: "seatStat(seat(),'mort') < 0" },
          { do: { action: 'setSeatStat', args: ['current', 'mort', 0] } }
        ]},
        { cond: '1 == 1' }
      ]}
    );
    goN++;
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walkG(v);
})(director.bt);
if (goN < 1) die('pass-GO branches ' + goN);

// ---------- 4. boot: mort 0 ----------
let bootOk = false;
(function walkA(o) {
  if (bootOk || !o || typeof o !== 'object') return;
  if (Array.isArray(o)) {
    const ri = o.findIndex(e => e && e.do && e.do.action === 'setState' && e.do.args && e.do.args[0] === 'ready' && e.do.args[1] === 1);
    if (ri >= 0) {
      const ins = [];
      for (let p = 1; p <= 4; p++) ins.push({ after: 0.1, do: { action: 'setSeatStat', args: [p, 'mort', 0] } });
      o.splice(ri, 0, ...ins);
      bootOk = true; return;
    }
    o.forEach(walkA);
  } else Object.values(o).forEach(walkA);
})(director.alarms);
if (!bootOk) die('boot anchor missing');

// ---------- 5. HUD: CREDIT -> MORTGAGE ----------
const hud = byId('hud') || die('hud missing');
let relN = 0;
for (let p = 1; p <= 4; p++) {
  const lbl = hud.children.find(c => c.id === 'crl' + p);
  const val = hud.children.find(c => c.id === 'cr' + p);
  if (!lbl || !val) die('cr rows missing p' + p);
  lbl.text = 'MORTG';
  val.bind = 'seats.' + p + '.mort';
  val.color = '#e08a5a';
  relN++;
}
if (relN !== 4) die('hud relabel ' + relN);

// ---------- 6. buildings: bigger + brighter ----------
Object.assign(RES.meshes, {
  b_base:  { type: 'box', size: [1.2, 0.75, 0.9] },
  b_wide:  { type: 'box', size: [1.6, 0.6, 1.0] },
  b_tall:  { type: 'box', size: [0.65, 1.4, 0.65] },
  b_chim:  { type: 'box', size: [0.24, 0.7, 0.24] },
  b_steep: { type: 'box', size: [0.28, 1.0, 0.28] },
  b_awn:   { type: 'box', size: [1.25, 0.12, 0.45] },
  b_twr:   { type: 'box', size: [0.38, 1.0, 0.38] },
  b_roofS: { type: 'box', size: [0.85, 0.3, 0.85] }
});
Object.assign(RES.materials, {
  m_factory: { color: '#a8442e' }, m_shed: { color: '#9ab0c0' }, m_shop: { color: '#e0559a' },
  m_house: { color: '#e88a2e' }, m_town: { color: '#d02a2a' }, m_watch: { color: '#f0d020' },
  m_church: { color: '#ffffff' }, m_mansion: { color: '#2a4ad0' }
});
function B(mesh, mat, x, y, z, rot) { const n = { mesh, material: mat, transform: { pos: [x, y, z] } }; if (rot) n.transform.rot = rot; return n; }
const builds = {
  g_kiln:      () => [B('b_wide', 'm_factory', 0, 0.4, 0.2), B('b_chim', 'm_dark', -0.5, 1.0, 0.2), B('b_chim', 'm_dark', -0.15, 0.95, 0.2)],
  g_copper:    () => [B('b_wide', 'm_shed', 0, 0.4, 0.2), B('b_roofS', 'm_dark', -0.4, 0.85, 0.2), B('b_roofS', 'm_dark', 0.4, 0.85, 0.2)],
  g_market:    () => [B('b_base', 'm_shop', 0, 0.48, 0.15), B('b_awn', 'm_white', 0, 0.9, 0.55), B('b_roofS', 'm_dark', 0, 1.0, 0.1, [0, 45, 0])],
  g_orchard:   () => [B('b_base', 'm_house', 0, 0.48, 0.2), B('b_roofS', 'm_town', 0, 1.0, 0.2, [0, 45, 0])],
  g_amber:     () => [B('b_base', 'm_town', 0, 0.48, 0.2), B('b_base', 'm_town', 0, 1.2, 0.2), B('b_roofS', 'm_dark', 0, 1.72, 0.2, [0, 45, 0])],
  g_beacon:    () => [B('b_tall', 'm_watch', 0, 0.8, 0.2), B('b_roofS', 'm_gold', 0, 1.66, 0.2, [0, 45, 0])],
  g_cathedral: () => [B('b_base', 'm_church', 0, 0.48, 0.25), B('b_steep', 'm_church', -0.35, 1.2, 0.25), B('b_roofS', 'm_gold', -0.35, 1.85, 0.25, [0, 45, 0])],
  g_crown:     () => [B('b_wide', 'm_mansion', 0, 0.4, 0.2), B('b_twr', 'm_mansion', -0.55, 1.0, 0.2), B('b_twr', 'm_mansion', 0.55, 1.0, 0.2), B('b_roofS', 'm_gold', 0, 0.85, 0.2, [0, 45, 0])]
};
let built = 0;
for (let i = 0; i < 40; i++) {
  const tile = byId('tile_' + i);
  if (!tile || !tile.children) continue;
  const band = tile.children.find(c => /^band_/.test(c.id || ''));
  if (!band || !builds[band.material]) continue;
  tile.children = tile.children.filter(c => !/^bldg_/.test(c.id || ''));
  const parts = builds[band.material]();
  parts.forEach((p, k) => { p.id = 'bldg_' + i + '_' + k; });
  tile.children.push(...parts);
  built++;
}
if (built < 16) die('buildings rebuilt ' + built);

// ---------- write ----------
const v24str = JSON.stringify(j);
fs.writeFileSync('kascity_v24.json', v24str);

const fnAnchor = 'function playSoundDef(d, at) {';
if (engine.split(fnAnchor).length - 1 !== 1) die('playSoundDef anchor mismatch');
engine = engine.split(fnAnchor).join(fnAnchor + '\n' +
  '  if (d && d.speech && d.speech.text && typeof SpeechSynthesisUtterance !== "undefined") {\n' +
  '    try { var _u = new SpeechSynthesisUtterance(String(d.speech.text));\n' +
  '      _u.pitch = d.speech.pitch == null ? 1 : d.speech.pitch;\n' +
  '      _u.rate = d.speech.rate == null ? 1 : d.speech.rate;\n' +
  '      _u.volume = d.speech.svol == null ? 1 : d.speech.svol;\n' +
  '      window.speechSynthesis.cancel(); window.speechSynthesis.speak(_u); } catch (e) {}\n' +
  '  }\n');
const bindAnchor = 'if (n.type === "ProgressBar" && n.bind) {';
if (engine.split(bindAnchor).length - 1 !== 1) die('bind anchor mismatch');
engine = engine.split(bindAnchor).join('if (n.type === "Label" && n.bind) { var cvb = resolvePath(n.bind.split("."), exprCtx(null)); if (cvb != null && cvb === cvb) n.text = "" + Math.round(cvb); }\n    ' + bindAnchor);

const walletJs = [
  'window.KV_WALLETS = window.KV_WALLETS || {};',
  '(function(){',
  '  var spots = { 1: "left:8px;top:150px;", 2: "right:8px;top:150px;", 3: "left:8px;top:214px;", 4: "right:8px;top:214px;" };',
  '  for (var p = 1; p <= 4; p++) (function(p){',
  '    var el = document.createElement("input");',
  '    el.id = "kvw" + p; el.placeholder = "P" + p + " kaspa wallet";',
  '    el.style.cssText = "position:fixed;" + spots[p] + "width:150px;z-index:50;background:#1a1410;color:#f4e4c1;" +',
  '      "border:1px solid #5a4a3a;border-radius:4px;padding:3px 6px;font:11px monospace;opacity:0.85;";',
  '    el.addEventListener("input", function(){ window.KV_WALLETS[p] = el.value.trim(); });',
  '    document.body.appendChild(el);',
  '  })(p);',
  '})();'
].join('\n');
fs.writeFileSync('showcase_kascity24.html', engine.replace('</script>', [
  '', '// ---- injected kascity v24 showcase ----', walletJs,
  'try { loadScene(' + JSON.stringify(v24str) + '); }',
  "catch (e) { console.error('kascity24 boot: ' + (e && e.message)); }", ''
].join('\n') + '\n</script>'));

console.log('PASS v23 credit/tier blocks stripped (3)');
console.log('PASS mortgage debt on ' + mtN + ' acquisition steps');
console.log('PASS lap mortgage bill (50, then 25 near payoff, clamped at 0) on ' + goN + ' pass-GO branch(es)');
console.log('PASS HUD MORTG rows, mort seeded 0');
console.log('PASS ' + built + ' buildings rebuilt bigger + brighter');
console.log('OK kascity_v24.json + showcase_kascity24.html');
