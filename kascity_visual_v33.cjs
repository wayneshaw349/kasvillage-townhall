// kascity_visual_v33.cjs — all district squares in sand #e8c98f (uniform look test)
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v32.json')) die('kascity_v32.json missing');
if (!fs.existsSync('scene_engine.html')) die('scene_engine.html missing');
if (!fs.existsSync('showcase_kascity25.html')) die('showcase_kascity25.html missing');
let engine = fs.readFileSync('scene_engine.html', 'utf8');
const j = JSON.parse(fs.readFileSync('kascity_v32.json', 'utf8'));
const RES = j.resources || die('resources missing');
let n = 0;
for (const m of ['td_kiln','td_copper','td_market','td_orchard','td_amber','td_beacon','td_cathedral','td_crown']) {
  if (!RES.materials[m]) die(m + ' missing');
  RES.materials[m] = { color: '#e8c98f' };
  n++;
}
if (n !== 8) die('recolored ' + n);

const v33str = JSON.stringify(j);
fs.writeFileSync('kascity_v33.json', v33str);

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
fs.writeFileSync('showcase_kascity33.html', engine.replace('</script>', [
  '', src25.slice(cs, ce).replace('v25 showcase', 'v33 showcase'),
  'try { loadScene(' + JSON.stringify(v33str) + '); }',
  "catch (e) { console.error('kascity33 boot: ' + (e && e.message)); }", ''
].join('\n') + '\n</script>'));

console.log('PASS 8 districts -> sand #e8c98f');
console.log('OK kascity_v33.json + showcase_kascity33.html');
