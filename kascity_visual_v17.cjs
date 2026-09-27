// kascity_visual_v17.cjs
// Reads kascity_v16.json + scene_engine.html -> writes kascity_v17.json + showcase_kascity17.html
// Fixes from screenshots: tile art was reusing giant comic celebration cells -> replaced with small
// custom property ICONS (monopoly-style: pipe, sidewalk, fridge, fan, storm cloud, bolt, gavel, deed);
// tile icons shrunk to icon size and lowered; portraits shrunk hard. Center emblem untouched.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }

const V16 = 'kascity_v16.json';
if (!fs.existsSync(V16)) die(V16 + ' missing');
if (!fs.existsSync('scene_engine.html')) die('scene_engine.html missing');
let engine = fs.readFileSync('scene_engine.html', 'utf8');
const j = JSON.parse(fs.readFileSync(V16, 'utf8'));
const RES = j.resources || die('resources missing');
const nodes = j.nodes;
const byId = id => nodes.find(n => n.id === id);

// ---------- 1. tiny property icon sprites (12x12, transparent bg) ----------
const I = '#241c12';
function S(rects) { return { w: 12, h: 12, frames: [rects] }; }
const icons = {
  icon_pipes: S([ // green pipe elbow with drip
    { rect: [2, 2, 3, 7], color: '#7cb85c' }, { rect: [2, 7, 7, 3], color: '#7cb85c' },
    { rect: [2, 2, 3, 1], color: I }, { rect: [8, 7, 1, 3], color: I },
    { rect: [3, 3, 1, 5], color: '#9cd87c' }, { rect: [9, 5, 1, 1], color: '#4f7fd9' }, { rect: [9, 6, 1, 1], color: '#4f7fd9' }
  ]),
  icon_walks: S([ // sidewalk slabs with crack
    { rect: [1, 4, 10, 5], color: '#b0b8c0' }, { rect: [1, 4, 10, 1], color: '#d8e4ec' },
    { rect: [4, 4, 1, 5], color: I }, { rect: [8, 4, 1, 5], color: I },
    { rect: [5, 6, 1, 1], color: I }, { rect: [6, 7, 1, 1], color: I }
  ]),
  icon_appl: S([ // fridge
    { rect: [3, 1, 6, 10], color: '#e8e0d0' }, { rect: [3, 1, 6, 1], color: I }, { rect: [3, 10, 6, 1], color: I },
    { rect: [3, 1, 1, 10], color: I }, { rect: [8, 1, 1, 10], color: I },
    { rect: [3, 5, 6, 1], color: I }, { rect: [7, 3, 1, 1], color: '#8aa0a8' }, { rect: [7, 7, 1, 1], color: '#8aa0a8' }
  ]),
  icon_hvac: S([ // fan
    { rect: [5, 5, 2, 2], color: I },
    { rect: [2, 4, 3, 2], color: '#8cc4f0' }, { rect: [7, 6, 3, 2], color: '#8cc4f0' },
    { rect: [4, 1, 2, 3], color: '#8cc4f0' }, { rect: [6, 8, 2, 3], color: '#8cc4f0' }
  ]),
  icon_storm: S([ // cloud + snow
    { rect: [2, 2, 8, 3], color: '#8b93a8' }, { rect: [1, 3, 10, 2], color: '#8b93a8' },
    { rect: [3, 7, 1, 1], color: '#dce8f0' }, { rect: [6, 8, 1, 1], color: '#dce8f0' },
    { rect: [9, 7, 1, 1], color: '#dce8f0' }, { rect: [5, 10, 1, 1], color: '#dce8f0' }
  ]),
  icon_volt: S([ // lightning bolt
    { rect: [6, 1, 3, 3], color: '#f8dc70' }, { rect: [5, 3, 3, 3], color: '#f0c030' },
    { rect: [4, 5, 4, 2], color: '#f8dc70' }, { rect: [4, 7, 2, 2], color: '#f0c030' }, { rect: [3, 9, 2, 2], color: '#f8dc70' }
  ]),
  icon_court: S([ // gavel
    { rect: [2, 2, 4, 3], color: '#8a6a48' }, { rect: [2, 2, 4, 1], color: '#a8845c' },
    { rect: [5, 4, 5, 2], color: '#a8845c' }, { rect: [8, 9, 3, 2], color: '#8a6a48' }
  ]),
  icon_deed: S([ // deed scroll with gold seal
    { rect: [3, 1, 6, 10], color: '#f4e4c1' }, { rect: [3, 1, 6, 1], color: I }, { rect: [3, 10, 6, 1], color: I },
    { rect: [3, 1, 1, 10], color: I }, { rect: [8, 1, 1, 10], color: I },
    { rect: [4, 3, 4, 1], color: '#8a6a48' }, { rect: [4, 5, 4, 1], color: '#8a6a48' },
    { rect: [6, 7, 2, 2], color: '#caa64c' }
  ])
};
for (const [k, v] of Object.entries(icons)) RES.sprites[k] = v;

// ---------- 2. repoint tileart nodes to icons + shrink + lower ----------
const artMap = { pipes: 'icon_pipes', walks: 'icon_walks', appl: 'icon_appl', hvac: 'icon_hvac',
                 storm: 'icon_storm', volt: 'icon_volt', court: 'icon_court', deed: 'icon_deed' };
let artN = 0;
for (const n of nodes) {
  if (!/^tileart_\d+$/.test(n.id || '')) continue;
  (function swap(o) {
    if (!o || typeof o !== 'object') return;
    for (const k of Object.keys(o)) {
      if (typeof o[k] === 'string' && artMap[o[k]]) o[k] = artMap[o[k]];
      else if (typeof o[k] === 'object') swap(o[k]);
    }
  })(n);
  n.transform.pos[1] = 0.5;
  n.transform.scale = [0.045, 0.045, 0.045];
  artN++;
}
if (artN < 16) die('tileart nodes repointed ' + artN + ' (<16)');

// ---------- 3. portraits much smaller ----------
let portN = 0;
for (let p = 1; p <= 4; p++) {
  const n = byId('portrait_p' + p);
  if (!n) die('portrait_p' + p + ' missing');
  n.transform.scale = [0.028, 0.028, 0.028];
  n.transform.pos[1] = 1.2;
  portN++;
}
if (portN !== 4) die('portraits ' + portN);

// ---------- write ----------
const v17str = JSON.stringify(j);
fs.writeFileSync('kascity_v17.json', v17str);

const fnAnchor = 'function playSoundDef(d, at) {';
if (engine.split(fnAnchor).length - 1 !== 1) die('playSoundDef anchor mismatch');
const speechCode = fnAnchor + '\n' +
  '  if (d && d.speech && d.speech.text && typeof SpeechSynthesisUtterance !== "undefined") {\n' +
  '    try {\n' +
  '      var _u = new SpeechSynthesisUtterance(String(d.speech.text));\n' +
  '      _u.pitch = d.speech.pitch == null ? 1 : d.speech.pitch;\n' +
  '      _u.rate = d.speech.rate == null ? 1 : d.speech.rate;\n' +
  '      _u.volume = d.speech.svol == null ? 1 : d.speech.svol;\n' +
  '      window.speechSynthesis.cancel();\n' +
  '      window.speechSynthesis.speak(_u);\n' +
  '    } catch (e) {}\n' +
  '  }\n';
engine = engine.split(fnAnchor).join(speechCode);
const bindAnchor = 'if (n.type === "ProgressBar" && n.bind) {';
if (engine.split(bindAnchor).length - 1 !== 1) die('bind anchor mismatch');
const labelBind = 'if (n.type === "Label" && n.bind) { var cvb = resolvePath(n.bind.split("."), exprCtx(null)); if (cvb != null && cvb === cvb) n.text = "" + Math.round(cvb); }\n    ';
engine = engine.split(bindAnchor).join(labelBind + bindAnchor);

const inject = [
  '', '// ---- injected kascity v17 showcase ----',
  'try { loadScene(' + JSON.stringify(v17str) + '); }',
  "catch (e) { console.error('kascity17 boot: ' + (e && e.message)); }", ''
].join('\n');
fs.writeFileSync('showcase_kascity17.html', engine.replace('</script>', inject + '\n</script>'));

console.log('PASS 8 property icon sprites (pipe/sidewalk/fridge/fan/storm/bolt/gavel/deed)');
console.log('PASS ' + artN + ' tile icons repointed, size 0.045 @ y0.5');
console.log('PASS portraits 0.028');
console.log('OK kascity_v17.json (' + (v17str.length / 1024).toFixed(1) + ' KB)');
console.log('OK showcase_kascity17.html');
