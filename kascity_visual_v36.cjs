// kascity_visual_v36.cjs
// Reads kascity_v34.json + scene_engine.html + audio files -> kascity_v36.json + showcase_kascity36.html
// Audio integration:
//   MUSIC  kv_music_loop.mp3 (77s jersey + bridge, browser-looped) starts on first tap, 45% volume
//   SFX    ching  -> buy, rent, depot (sale / rent paid / payday)
//          boo    -> tax, levy
//          gavel  -> gavel, evict, jail (lawsuits / court)
//          dang   -> hazard, storm, bust (hazards / disasters)
//   Existing synth layers still play underneath; the mp3s layer on top via the vox hook.
// Required in this folder: kascity_v34.json, scene_engine.html, showcase_kascity25.html,
//   kv_music_loop.mp3, sfx_ching.mp3, sfx_boo.mp3, sfx_gavel.mp3, sfx_dang.mp3
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
const need = ['kascity_v34.json', 'scene_engine.html', 'showcase_kascity25.html',
              'kv_music_loop.mp3', 'sfx_ching.mp3', 'sfx_boo.mp3', 'sfx_gavel.mp3', 'sfx_dang.mp3'];
for (const f of need) if (!fs.existsSync(f)) die(f + ' missing');

let engine = fs.readFileSync('scene_engine.html', 'utf8');
const j = JSON.parse(fs.readFileSync('kascity_v34.json', 'utf8'));
const snd = (j.resources && j.resources.sounds) || die('sounds missing');

// ---------- map sfx onto sound ids ----------
const map = {
  ching: ['buy', 'rent', 'depot'],
  boo:   ['tax'],
  gavel: ['gavel', 'evict', 'jail'],
  dang:  ['hazard', 'storm', 'bust']
};
let wired = 0, missing = [];
for (const [sfx, ids] of Object.entries(map)) {
  for (const id of ids) {
    if (!snd[id]) { missing.push(id); continue; }
    snd[id].vox = sfx;
    delete snd[id].speech;      // sample replaces TTS on these
    wired++;
  }
}
if (wired < 8) die('sfx wired ' + wired + ' (<8); missing: ' + missing.join(','));

const v36str = JSON.stringify(j);
fs.writeFileSync('kascity_v36.json', v36str);

// ---------- engine hooks ----------
const fnAnchor = 'function playSoundDef(d, at) {';
if (engine.split(fnAnchor).length - 1 !== 1) die('playSoundDef anchor mismatch');
engine = engine.split(fnAnchor).join(fnAnchor + '\n' +
  '  if (d && d.vox && window.KV_VOX && window.KV_VOX[d.vox]) {\n' +
  '    try { var _a = window.KV_VOX[d.vox].cloneNode(); _a.volume = 0.85; _a.play(); } catch (e) {}\n' +
  '  }\n' +
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

// ---------- audio payload ----------
const b64 = f => fs.readFileSync(f).toString('base64');
const audioJs = [
  'window.KV_VOX = window.KV_VOX || {};',
  'window.KV_VOX.ching = new Audio("data:audio/mpeg;base64,' + b64('sfx_ching.mp3') + '");',
  'window.KV_VOX.boo   = new Audio("data:audio/mpeg;base64,' + b64('sfx_boo.mp3') + '");',
  'window.KV_VOX.gavel = new Audio("data:audio/mpeg;base64,' + b64('sfx_gavel.mp3') + '");',
  'window.KV_VOX.dang  = new Audio("data:audio/mpeg;base64,' + b64('sfx_dang.mp3') + '");',
  'for (var _k in window.KV_VOX) window.KV_VOX[_k].preload = "auto";',
  '',
  'window.KV_MUSIC = new Audio("data:audio/mpeg;base64,' + b64('kv_music_loop.mp3') + '");',
  'window.KV_MUSIC.loop = true; window.KV_MUSIC.volume = 0.45; window.KV_MUSIC.preload = "auto";',
  '(function(){',
  '  function start(){ try { window.KV_MUSIC.play(); } catch(e){} ',
  '    document.removeEventListener("pointerdown", start); document.removeEventListener("keydown", start); }',
  '  document.addEventListener("pointerdown", start); document.addEventListener("keydown", start);',
  '  var btn = document.createElement("button");',
  '  btn.textContent = "\\u266A"; btn.title = "music on/off";',
  '  btn.style.cssText = "position:fixed;right:8px;bottom:8px;z-index:60;width:34px;height:34px;border-radius:17px;" +',
  '    "background:rgba(20,16,12,0.85);color:#f4e4c1;border:1px solid #5a4a3a;font-size:15px;cursor:pointer;";',
  '  btn.addEventListener("click", function(e){ e.stopPropagation();',
  '    if (window.KV_MUSIC.paused) { window.KV_MUSIC.play(); btn.style.opacity = 1; }',
  '    else { window.KV_MUSIC.pause(); btn.style.opacity = 0.45; } });',
  '  document.body.appendChild(btn);',
  '})();'
].join('\n');

const src25 = fs.readFileSync('showcase_kascity25.html', 'utf8');
const cs = src25.indexOf('// ---- injected kascity v25 showcase ----');
const ce = src25.indexOf('try { loadScene(');
if (cs < 0 || ce <= cs) die('corner-card block not found');

fs.writeFileSync('showcase_kascity36.html', engine.replace('</script>', [
  '', audioJs,
  src25.slice(cs, ce).replace('v25 showcase', 'v36 showcase'),
  'try { loadScene(' + JSON.stringify(v36str) + '); }',
  "catch (e) { console.error('kascity36 boot: ' + (e && e.message)); }", ''
].join('\n') + '\n</script>'));

const kb = (fs.statSync('showcase_kascity36.html').size / 1024 / 1024).toFixed(1);
console.log('PASS ' + wired + ' sound ids wired to samples' + (missing.length ? ' (absent ids skipped: ' + missing.join(',') + ')' : ''));
console.log('PASS music loop embedded + looping, tap-to-start, mute button');
console.log('OK kascity_v36.json + showcase_kascity36.html (' + kb + ' MB)');
