// kascity_visual_v19.cjs — portraits 3x smaller (0.028 -> 0.0095)
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v18.json')) die('kascity_v18.json missing');
if (!fs.existsSync('scene_engine.html')) die('scene_engine.html missing');
let engine = fs.readFileSync('scene_engine.html', 'utf8');
const j = JSON.parse(fs.readFileSync('kascity_v18.json', 'utf8'));
let portN = 0;
for (let p = 1; p <= 4; p++) {
  const n = j.nodes.find(x => x.id === 'portrait_p' + p);
  if (!n) die('portrait_p' + p + ' missing');
  n.transform.scale = [0.0095, 0.0095, 0.0095];
  portN++;
}
if (portN !== 4) die('portraits ' + portN);

const v19str = JSON.stringify(j);
fs.writeFileSync('kascity_v19.json', v19str);

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

fs.writeFileSync('showcase_kascity19.html', engine.replace('</script>', [
  '', '// ---- injected kascity v19 showcase ----',
  'try { loadScene(' + JSON.stringify(v19str) + '); }',
  "catch (e) { console.error('kascity19 boot: ' + (e && e.message)); }", ''
].join('\n') + '\n</script>'));

console.log('PASS portraits 0.0095 (3x smaller)');
console.log('OK kascity_v19.json + showcase_kascity19.html');
