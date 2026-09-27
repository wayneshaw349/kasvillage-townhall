// kascity_visual_v20.cjs — portraits: set spriteSize (billboards ignore transform.scale entirely).
// Default spriteSize is 2; portraits render huge because they inherited panel_deed's value (or default).
// Sets spriteSize 0.7 on each portrait — roughly 3x smaller than default panel size.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
if (!fs.existsSync('kascity_v19.json')) die('kascity_v19.json missing');
if (!fs.existsSync('scene_engine.html')) die('scene_engine.html missing');
let engine = fs.readFileSync('scene_engine.html', 'utf8');
const j = JSON.parse(fs.readFileSync('kascity_v19.json', 'utf8'));
let portN = 0, prev = null;
for (let p = 1; p <= 4; p++) {
  const n = j.nodes.find(x => x.id === 'portrait_p' + p);
  if (!n) die('portrait_p' + p + ' missing');
  prev = n.spriteSize;
  n.spriteSize = 0.7;
  n.aspect = 20 / 22;
  portN++;
}
if (portN !== 4) die('portraits ' + portN);
console.log('previous spriteSize was: ' + (prev === undefined ? '(unset -> default 2)' : prev));

const v20str = JSON.stringify(j);
fs.writeFileSync('kascity_v20.json', v20str);

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

fs.writeFileSync('showcase_kascity20.html', engine.replace('</script>', [
  '', '// ---- injected kascity v20 showcase ----',
  'try { loadScene(' + JSON.stringify(v20str) + '); }',
  "catch (e) { console.error('kascity20 boot: ' + (e && e.message)); }", ''
].join('\n') + '\n</script>'));

console.log('PASS portraits spriteSize 0.7');
console.log('OK kascity_v20.json + showcase_kascity20.html');
