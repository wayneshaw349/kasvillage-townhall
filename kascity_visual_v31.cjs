// kascity_visual_v31.cjs
// Reads kascity_v30.json + scene_engine.html -> writes kascity_v31.json + showcase_kascity31.html
// Property risk system:
//  - each property gets per-GAME randomized stats at boot: AGE (5-55yr), TAX (6-24), HAZARD% (age-linked:
//    older = more prone). Different every game (rand()).
//  - survey readout: landing on any property shows its TAX / AGE / HAZARD% live under the name banner.
//  - hazards are now per-property + probabilistic: landing on an OWNED property rolls against its
//    hazard%; on a hit the OWNER pays 40 repair, thunder/wind plays, HAZARD caption flashes.
//    (Global hazard deck untouched elsewhere; this adds the local layer.)
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v30.json')) die('kascity_v30.json missing');
if (!fs.existsSync('scene_engine.html')) die('scene_engine.html missing');
if (!fs.existsSync('showcase_kascity25.html')) die('showcase_kascity25.html missing');
let engine = fs.readFileSync('scene_engine.html', 'utf8');
const j = JSON.parse(fs.readFileSync('kascity_v30.json', 'utf8'));
const byId = id => j.nodes.find(n => n.id === id);
const director = byId('director') || die('director missing');

// property tiles = those with a district band
const propTiles = [];
for (let i = 0; i < 40; i++) {
  const t = byId('tile_' + i);
  if (t && t.children && t.children.some(c => /^band_/.test(c.id || ''))) propTiles.push(i);
}
if (propTiles.length < 16) die('property tiles ' + propTiles.length);

// ---------- 1. boot: per-game random stats ----------
let bootOk = false;
(function walkA(o) {
  if (bootOk || !o || typeof o !== 'object') return;
  if (Array.isArray(o)) {
    const ri = o.findIndex(e => e && e.do && e.do.action === 'setState' && e.do.args && e.do.args[0] === 'ready' && e.do.args[1] === 1);
    if (ri >= 0) {
      const ins = [];
      for (const i of propTiles) {
        ins.push({ after: 0.1, do: { action: 'setFlagExpr', args: ['age_t' + i, 'floor(rand() * 50) + 5'] } });
        ins.push({ after: 0.1, do: { action: 'setFlagExpr', args: ['tax_t' + i, 'floor(rand() * 18) + 6'] } });
        ins.push({ after: 0.1, do: { action: 'setFlagExpr', args: ['hz_t' + i, 'floor(world.flags.age_t' + i + ' * 0.5 + rand() * 12)'] } });
      }
      for (const f of ['svy_age', 'svy_tax', 'svy_hz']) ins.push({ after: 0.1, do: { action: 'setState', args: [f, 0] } });
      o.splice(ri, 0, ...ins);
      bootOk = true; return;
    }
    o.forEach(walkA);
  } else Object.values(o).forEach(walkA);
})(director.alarms);
if (!bootOk) die('boot anchor missing');

// ---------- 2. extend our landing branches: survey copy + probabilistic hazard ----------
let landN = 0;
(function walk(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.selector)) {
    for (const br of o.selector) {
      if (!br || !Array.isArray(br.sequence)) continue;
      const c0 = br.sequence[0] && br.sequence[0].cond;
      const m = typeof c0 === 'string' && /^world\.flags\.moved == 1 && world\.flags\.pos == (\d+) && world\.flags\.shown_tile != \1$/.exec(c0);
      if (!m) continue;
      const i = parseInt(m[1], 10);
      if (propTiles.indexOf(i) < 0) continue;
      if (br.sequence.some(e => e && e.do && e.do.args && e.do.args[0] === 'svy_age')) continue;
      br.sequence.push(
        { do: { action: 'setFlagExpr', args: ['svy_age', 'world.flags.age_t' + i] } },
        { do: { action: 'setFlagExpr', args: ['svy_tax', 'world.flags.tax_t' + i] } },
        { do: { action: 'setFlagExpr', args: ['svy_hz', 'world.flags.hz_t' + i] } },
        { do: { action: 'setFlagExpr', args: ['hzr', 'rand() * 100'] } },
        { selector: [
          { sequence: [
            { cond: "world.flags.hzr < world.flags.hz_t" + i + " && ownerOf('t" + i + "') == 1" },
            { do: { action: 'addSeatStat', args: [1, 'cash'], amount: -40 } },
            { do: { action: 'playSound', args: ['hazard'] } },
            { do: { action: 'setText', args: ['HAZARD DAMAGE! owner pays 40'], to: 'cap' } },
            { do: { action: 'show', args: [], to: 'cap' } },
            { do: { action: 'setState', args: ['bfshow', 1] } },
            { do: { action: 'setFlagExpr', args: ['bf_t', 'world.time'] } }
          ]},
          { sequence: [
            { cond: "world.flags.hzr < world.flags.hz_t" + i + " && ownerOf('t" + i + "') == 2" },
            { do: { action: 'addSeatStat', args: [2, 'cash'], amount: -40 } },
            { do: { action: 'playSound', args: ['hazard'] } },
            { do: { action: 'setText', args: ['HAZARD DAMAGE! owner pays 40'], to: 'cap' } },
            { do: { action: 'show', args: [], to: 'cap' } },
            { do: { action: 'setState', args: ['bfshow', 1] } },
            { do: { action: 'setFlagExpr', args: ['bf_t', 'world.time'] } }
          ]},
          { sequence: [
            { cond: "world.flags.hzr < world.flags.hz_t" + i + " && ownerOf('t" + i + "') == 3" },
            { do: { action: 'addSeatStat', args: [3, 'cash'], amount: -40 } },
            { do: { action: 'playSound', args: ['hazard'] } },
            { do: { action: 'setText', args: ['HAZARD DAMAGE! owner pays 40'], to: 'cap' } },
            { do: { action: 'show', args: [], to: 'cap' } },
            { do: { action: 'setState', args: ['bfshow', 1] } },
            { do: { action: 'setFlagExpr', args: ['bf_t', 'world.time'] } }
          ]},
          { sequence: [
            { cond: "world.flags.hzr < world.flags.hz_t" + i + " && ownerOf('t" + i + "') == 4" },
            { do: { action: 'addSeatStat', args: [4, 'cash'], amount: -40 } },
            { do: { action: 'playSound', args: ['hazard'] } },
            { do: { action: 'setText', args: ['HAZARD DAMAGE! owner pays 40'], to: 'cap' } },
            { do: { action: 'show', args: [], to: 'cap' } },
            { do: { action: 'setState', args: ['bfshow', 1] } },
            { do: { action: 'setFlagExpr', args: ['bf_t', 'world.time'] } }
          ]},
          { cond: '1 == 1' }
        ]}
      );
      landN++;
    }
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v);
})(director.bt);
if (landN < 16) die('landing branches extended ' + landN);

// ---------- 3. survey HUD strip ----------
const hud = byId('hud') || die('hud missing');
if (hud.children.some(c => c.id === 'svy_tax')) die('survey strip exists');
hud.children.push(
  { id: 'svyl1', type: 'Label', anchor: 'bottomCenter', pos: [-92, -28], size: 10, text: 'TAX', color: '#b8c4b0' },
  { id: 'svy_tax', type: 'Label', anchor: 'bottomCenter', pos: [-66, -28], size: 12, text: '', bind: 'world.flags.svy_tax', color: '#f8f0d8', weight: 700 },
  { id: 'svyl2', type: 'Label', anchor: 'bottomCenter', pos: [-34, -28], size: 10, text: 'AGE', color: '#b8c4b0' },
  { id: 'svy_age', type: 'Label', anchor: 'bottomCenter', pos: [-8, -28], size: 12, text: '', bind: 'world.flags.svy_age', color: '#f8f0d8', weight: 700 },
  { id: 'svyl3', type: 'Label', anchor: 'bottomCenter', pos: [26, -28], size: 10, text: 'HAZARD%', color: '#b8c4b0' },
  { id: 'svy_hz', type: 'Label', anchor: 'bottomCenter', pos: [82, -28], size: 12, text: '', bind: 'world.flags.svy_hz', color: '#e08a5a', weight: 700 }
);

// ---------- write ----------
const v31str = JSON.stringify(j);
fs.writeFileSync('kascity_v31.json', v31str);

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
engine = engine.split(bindAnchor).join(
  'if (n.type === "Label" && n.bind) { var cvb = resolvePath(n.bind.split("."), exprCtx(null)); if (cvb != null && cvb === cvb) { n.text = "" + Math.round(cvb); (window.KV_STATS || (window.KV_STATS = {}))[n.bind] = Math.round(cvb); } }\n    ' + bindAnchor);

const src25 = fs.readFileSync('showcase_kascity25.html', 'utf8');
const cs = src25.indexOf('// ---- injected kascity v25 showcase ----');
const ce = src25.indexOf('try { loadScene(');
if (cs < 0 || ce <= cs) die('corner-card block not found');
const cardsJs = src25.slice(cs, ce).replace('v25 showcase', 'v31 showcase');

fs.writeFileSync('showcase_kascity31.html', engine.replace('</script>', [
  '', cardsJs,
  'try { loadScene(' + JSON.stringify(v31str) + '); }',
  "catch (e) { console.error('kascity31 boot: ' + (e && e.message)); }", ''
].join('\n') + '\n</script>'));

console.log('PASS per-game stats seeded for ' + propTiles.length + ' properties (age/tax/hazard, age-linked)');
console.log('PASS survey strip (TAX/AGE/HAZARD%) live on landing');
console.log('PASS per-property probabilistic hazards on ' + landN + ' tiles (owner pays 40)');
console.log('OK kascity_v31.json + showcase_kascity31.html');
