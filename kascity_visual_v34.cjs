// kascity_visual_v34.cjs — v32 palette with every mustard/yellow district swapped to sand #e8c98f;
// apricot, terracotta, and sage accent districts kept.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v33.json')) die('kascity_v33.json missing');
if (!fs.existsSync('scene_engine.html')) die('scene_engine.html missing');
if (!fs.existsSync('showcase_kascity25.html')) die('showcase_kascity25.html missing');
let engine = fs.readFileSync('scene_engine.html', 'utf8');
const j = JSON.parse(fs.readFileSync('kascity_v33.json', 'utf8'));
const RES = j.resources || die('resources missing');
const pal = {
  td_kiln: '#e8c98f',      // sand (was mustard)
  td_copper: '#e8c98f',    // sand
  td_market: '#f4c078',    // apricot
  td_orchard: '#e8c98f',   // sand (was ochre)
  td_amber: '#ee9670',     // light terracotta
  td_beacon: '#e8c98f',    // sand (was golden)
  td_cathedral: '#cdd188', // light sage
  td_crown: '#e8c98f'      // sand (was amber gold)
};
let n = 0;
for (const [m, c] of Object.entries(pal)) {
  if (!RES.materials[m]) die(m + ' missing');
  RES.materials[m] = { color: c };
  n++;
}
if (n !== 8) die('recolored ' + n);

const v34str = JSON.stringify(j);
fs.writeFileSync('kascity_v34.json', v34str);

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
fs.writeFileSync('showcase_kascity34.html', engine.replace('</script>', [
  '', src25.slice(cs, ce).replace('v25 showcase', 'v34 showcase'),
  'try { loadScene(' + JSON.stringify(v34str) + '); }',
  "catch (e) { console.error('kascity34 boot: ' + (e && e.message)); }", ''
].join('\n') + '\n</script>'));

console.log('PASS mustard yellows -> sand; apricot/terracotta/sage kept');
console.log('OK kascity_v34.json + showcase_kascity34.html');
