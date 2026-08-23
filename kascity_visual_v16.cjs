// kascity_visual_v16.cjs
// Reads kascity_v15.json + scene_engine.html -> writes kascity_v16.json + showcase_kascity16.html
// Adds a computer voice: engine patch teaches playSoundDef an optional d.speech = {text,pitch,rate,svol}
// key (Web Speech API, zero assets) that speaks ALONGSIDE the existing synth layers. Then wires lines:
// evict "Bye, Felisha!" | buy "Deed secured" | rent "Rent paid" | storm "Storm warning" |
// hazard "Hazard" | depot "Payday" | win "You win the city" | bust "Bankrupt".
// Engine patched only inside the built showcase; scene_engine.html untouched on disk.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }

const V15 = 'kascity_v15.json';
if (!fs.existsSync(V15)) die(V15 + ' missing');
if (!fs.existsSync('scene_engine.html')) die('scene_engine.html missing');
let engine = fs.readFileSync('scene_engine.html', 'utf8');
const j = JSON.parse(fs.readFileSync(V15, 'utf8'));
const snd = (j.resources && j.resources.sounds) || die('sounds missing');

// ---------- 1. speech lines on existing sound defs (extra key; synth layers untouched) ----------
const lines = {
  evict:  { text: 'Bye, Felisha!',    pitch: 0.6, rate: 1.05, svol: 1.0 },
  buy:    { text: 'Deed secured',     pitch: 0.7, rate: 1.15, svol: 0.9 },
  rent:   { text: 'Rent paid',        pitch: 0.7, rate: 1.2,  svol: 0.8 },
  storm:  { text: 'Storm warning',    pitch: 0.5, rate: 0.95, svol: 1.0 },
  hazard: { text: 'Hazard',           pitch: 0.5, rate: 1.0,  svol: 0.9 },
  depot:  { text: 'Payday',           pitch: 0.8, rate: 1.2,  svol: 0.9 },
  win:    { text: 'You win the city', pitch: 0.7, rate: 1.0,  svol: 1.0 },
  bust:   { text: 'Bankrupt',         pitch: 0.4, rate: 0.9,  svol: 1.0 }
};
let spN = 0;
for (const [k, sp] of Object.entries(lines)) {
  if (!snd[k]) die('sound ' + k + ' missing');
  snd[k].speech = sp;
  spN++;
}
if (spN !== 8) die('speech lines ' + spN + ' != 8');

// ---------- 2. engine speech patch ----------
const fnAnchor = 'function playSoundDef(d, at) {';
if (engine.split(fnAnchor).length - 1 !== 1) die('playSoundDef anchor occurrences != 1');
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
if (engine.split(bindAnchor).length - 1 !== 1) die('bind anchor occurrences != 1');
const labelBind = 'if (n.type === "Label" && n.bind) { var cvb = resolvePath(n.bind.split("."), exprCtx(null)); if (cvb != null && cvb === cvb) n.text = "" + Math.round(cvb); }\n    ';
engine = engine.split(bindAnchor).join(labelBind + bindAnchor);

// ---------- write ----------
const v16str = JSON.stringify(j);
fs.writeFileSync('kascity_v16.json', v16str);
const inject = [
  '', '// ---- injected kascity v16 showcase ----',
  'try { loadScene(' + JSON.stringify(v16str) + '); }',
  "catch (e) { console.error('kascity16 boot: ' + (e && e.message)); }", ''
].join('\n');
fs.writeFileSync('showcase_kascity16.html', engine.replace('</script>', inject + '\n</script>'));

console.log('PASS speech lines on 8 events (Bye Felisha, Deed secured, Rent paid, Storm warning, Hazard, Payday, You win the city, Bankrupt)');
console.log('PASS engine speech patch + Label bind (embedded only)');
console.log('OK kascity_v16.json (' + (v16str.length / 1024).toFixed(1) + ' KB)');
console.log('OK showcase_kascity16.html');
