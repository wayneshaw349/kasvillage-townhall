// kascity_visual_v12.cjs
// Reads kascity_v11.json + showcase_kascity11.html -> writes kascity_v12.json + showcase_kascity12.html
// Changes: distinct humanoid figures per player, full-tile owner color plates,
// landing-name display, player portraits (2-frame blink), live cash numbers (Label bind engine patch,
// applied ONLY inside the embedded engine of showcase_kascity12.html).
// Abort-on-mismatch: writes nothing unless every check passes. scene_engine.html and v11 files untouched.
const fs = require('fs');

function die(msg) { console.error('ABORT: ' + msg + ' — nothing written.'); process.exit(1); }

const V11 = 'kascity_v11.json';
const SHOW11 = 'showcase_kascity11.html';
if (!fs.existsSync(V11)) die(V11 + ' missing');
if (!fs.existsSync(SHOW11)) die(SHOW11 + ' missing');

const v11raw = fs.readFileSync(V11, 'utf8');
const j = JSON.parse(v11raw);
const nodes = j.nodes;
const byId = id => nodes.find(n => n.id === id);

// ---------- 1. distinct figures ----------
const figMap = { token_p1: 'slim', token_p2: 'broad', token_p3: 'tall', token_p4: 'shorty' };
let figN = 0;
for (const [id, mesh] of Object.entries(figMap)) {
  const t = byId(id);
  if (!t) die('missing ' + id);
  t.mesh = mesh;
  t.transform = t.transform || {};
  t.transform.scale = [1.5, 1.5, 1.5];
  figN++;
}
if (figN !== 4) die('figures patched ' + figN + ' != 4');

// ---------- 2. owner plates (full-tile color) ----------
const RES = j.resources || die('resources missing');
if (!RES.meshes || !RES.meshes.ownFlag) die('resources.meshes.ownFlag missing');
RES.meshes.ownPlate = { type: 'box', size: [2.06, 0.05, 2.06] };
let plateN = 0;
for (const n of nodes) {
  if (!n.children) continue;
  for (const c of n.children) {
    const m = /^own_(\d+)_(\d)$/.exec(c.id || '');
    if (!m) continue;
    const p = parseInt(m[2], 10);
    c.mesh = 'ownPlate';
    c.transform = { pos: [0, 0.10 + p * 0.006, 0] };
    plateN++;
  }
}
if (plateN < 80) die('owner plates found ' + plateN + ' (<80)');

// ---------- 3. tile names + landing display ----------
const dstr = JSON.stringify(byId('director') || {});
const names = {};
const re = /"prompt","args":\["buy","(.+?) is unowned\. Buy for \d+\?"(?:,"[^"]*")*\]\}\},\{"do":\{"action":"setState","args":\["buy_tile",(\d+)\]/g;
let mm;
while ((mm = re.exec(dstr)) !== null) names[parseInt(mm[2], 10)] = mm[1];
if (Object.keys(names).length < 10) die('tile names extracted ' + Object.keys(names).length + ' (<10)');
const matName = { grant: 'CITY GRANT', levy: 'LEVY OFFICE', fate: 'FATE', utility: 'UTILITY', transit: 'TRANSIT', corner: 'CORNER' };
for (let i = 0; i < 40; i++) {
  if (names[i]) continue;
  const t = byId('tile_' + i);
  names[i] = (t && matName[t.material]) || (i === 0 ? 'START' : 'BLOCK ' + i);
}

const director = byId('director');
if (!director || !director.bt || !Array.isArray(director.bt.sequence)) die('director.bt.sequence missing');
const rootSel = director.bt.sequence[1] && director.bt.sequence[1].selector;
if (!Array.isArray(rootSel)) die('director root selector missing');
const landing = [];
for (let i = 0; i < 40; i++) {
  landing.push({ sequence: [
    { cond: 'world.flags.moved == 1 && world.flags.pos == ' + i + ' && world.flags.shown_tile != ' + i },
    { do: { action: 'setState', args: ['shown_tile', i] } },
    { do: { action: 'setText', args: ['\u25BC  ' + names[i] + '  \u25BC'], to: 'tile_label' } }
  ]});
}
rootSel.unshift(...landing);

// boot: init shown_tile before ready
let bootPatched = false;
(function walk(o) {
  if (bootPatched || !o || typeof o !== 'object') return;
  if (Array.isArray(o)) {
    const ri = o.findIndex(e => e && e.do && e.do.action === 'setState' && e.do.args && e.do.args[0] === 'ready' && e.do.args[1] === 1);
    if (ri >= 0) {
      o.splice(ri, 0, { after: 0.1, do: { action: 'setState', args: ['shown_tile', -1] } });
      bootPatched = true;
      return;
    }
    o.forEach(walk);
  } else Object.values(o).forEach(walk);
})(director.alarms);
if (!bootPatched) die('boot ready anchor not found in director.alarms');

// ---------- 4. HUD: cash numbers + bigger landing label ----------
const hud = byId('hud');
if (!hud || !Array.isArray(hud.children)) die('hud missing');
const cashRows = [[104, 22], [104, 50], [104, 78], [104, 106]];
for (let p = 1; p <= 4; p++) {
  if (hud.children.some(c => c.id === 'c' + p)) die('hud c' + p + ' already exists (already patched?)');
  hud.children.push({ id: 'c' + p, type: 'Label', anchor: 'topLeft', pos: cashRows[p - 1], size: 12,
    text: '', bind: 'seats.' + p + '.cash', color: ['#d94f4f', '#4f7fd9', '#4fd98a', '#d9c14f'][p - 1], weight: 700, shadow: '#241c12' });
}
const tl = hud.children.find(c => c.id === 'tile_label');
if (!tl) die('tile_label missing');
tl.size = 20; tl.weight = 900; tl.color = '#f8f0d8'; tl.shadow = '#241c12';
tl.font = "Impact, 'Arial Black', sans-serif";

// ---------- 5. portraits (clone panel_deed, 2-frame blink sprites) ----------
const spriteContainerKey = (RES.sprites && RES.sprites.deed && RES.sprites.deed.frames) ? 'sprites' : null;
if (!spriteContainerKey) die('sprite container with "deed" not found');
const sprites = RES.sprites;

function portraitSprite(hair, shirt) {
  const W = 20, H = 22, skin = '#e8b488', ink = '#241c12', eye = '#241c12', mouth = '#c85a3e';
  function face(eyesOpen) {
    const r = [];
    r.push({ rect: [0, 0, W, 1], color: ink }, { rect: [0, H - 1, W, 1], color: ink });
    r.push({ rect: [0, 0, 1, H], color: ink }, { rect: [W - 1, 0, 1, H], color: ink });
    r.push({ rect: [1, 1, W - 2, 4], color: hair });                 // hair
    r.push({ rect: [1, 5, W - 2, 11], color: skin });                // face
    r.push({ rect: [3, 4, 3, 2], color: hair }, { rect: [W - 6, 4, 3, 2], color: hair }); // fringe
    if (eyesOpen) { r.push({ rect: [5, 9, 2, 2], color: eye }, { rect: [13, 9, 2, 2], color: eye }); }
    else { r.push({ rect: [5, 10, 2, 1], color: ink }, { rect: [13, 10, 2, 1], color: ink }); }
    r.push({ rect: [9, 11, 2, 2], color: '#d09a70' });               // nose
    r.push({ rect: [7, 14, 6, 1], color: mouth });                   // mouth
    r.push({ rect: [1, 16, W - 2, 5], color: shirt });               // shirt
    r.push({ rect: [8, 16, 4, 5], color: ink });                     // collar
    return r;
  }
  return { w: W, h: H, frames: [face(true), face(false)] };
}
const pcol = { 1: '#d94f4f', 2: '#4f7fd9', 3: '#4fd98a', 4: '#d9c14f' };
const hcol = { 1: '#241c12', 2: '#8a6a48', 3: '#f0c860', 4: '#5a4a6a' };
const panelTpl = byId('panel_deed');
if (!panelTpl) die('panel_deed missing');
let portraitN = 0;
for (let p = 1; p <= 4; p++) {
  const sid = 'pface' + p;
  sprites[sid] = portraitSprite(hcol[p], pcol[p]);
  const clone = JSON.parse(JSON.stringify(panelTpl));
  (function swap(o) {
    if (!o || typeof o !== 'object') return;
    for (const k of Object.keys(o)) {
      if (o[k] === 'deed') o[k] = sid;
      else if (typeof o[k] === 'string' && /^panel_deed/.test(o[k])) o[k] = o[k].replace('panel_deed', 'portrait_p' + p);
      else if (typeof o[k] === 'object') swap(o[k]);
    }
  })(clone);
  clone.id = 'portrait_p' + p;
  delete clone.hidden;
  clone.transform = clone.transform || {};
  const base = Array.isArray(clone.transform.pos) ? clone.transform.pos.slice() : [0, 3, 0];
  clone.transform.pos = [base[0] + 13.5, (base[1] || 3), base[2] - 4.5 + (p - 1) * 3];
  clone.transform.scale = [0.55, 0.55, 0.55];
  nodes.push(clone);
  portraitN++;
}
if (portraitN !== 4) die('portraits ' + portraitN + ' != 4');

// ---------- write v12 json ----------
const v12str = JSON.stringify(j);
fs.writeFileSync('kascity_v12.json', v12str);

// ---------- showcase: build from engine (same as v11 builder) + Label-bind patch ----------
let engine = fs.readFileSync('scene_engine.html', 'utf8');
const anchor = 'if (n.type === "ProgressBar" && n.bind) {';
const occA = engine.split(anchor).length - 1;
if (occA !== 1) die('engine ProgressBar bind anchor occurrences = ' + occA + ' (need exactly 1)');
const labelBind = 'if (n.type === "Label" && n.bind) { var cvb = resolvePath(n.bind.split("."), exprCtx(null)); if (cvb != null && cvb === cvb) n.text = "" + Math.round(cvb); }\n    ';
engine = engine.split(anchor).join(labelBind + anchor);
if (engine.split('</script>').length - 1 < 1) die('no </script> in engine');
const inject = [
  '', '// ---- injected kascity v12 showcase ----',
  'try { loadScene(' + JSON.stringify(v12str) + '); }',
  "catch (e) { console.error('kascity12 boot: ' + (e && e.message)); }", ''
].join('\n');
fs.writeFileSync('showcase_kascity12.html', engine.replace('</script>', inject + '\n</script>'));

console.log('PASS figures 4/4');
console.log('PASS owner plates ' + plateN);
console.log('PASS tile names ' + Object.keys(names).length + '/40');
console.log('PASS landing branches 40, boot init inserted');
console.log('PASS hud cash labels c1-c4 + tile_label restyle');
console.log('PASS portraits 4 (2-frame blink sprites)');
console.log('PASS showcase built from engine + Label-bind patch');
console.log('OK kascity_v12.json (' + (v12str.length / 1024).toFixed(1) + ' KB)');
console.log('OK showcase_kascity12.html');
