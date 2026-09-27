// kascity_visual_v38.cjs
// Reads kascity_v37.json + scene_engine.html + audio -> kascity_v38.json + showcase_kascity38.html
// FIX: playSound() returns early for layered defs, so playSoundDef never saw d.vox/d.speech — that's
// why no samples (or TTS) ever played. The hook now lives at the TOP of playSound, where the whole
// sound def is still intact. Everything else identical to v37.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
const need = ['kascity_v37.json','scene_engine.html','showcase_kascity25.html','kv_music_loop.mp3',
              'sfx_ching.mp3','sfx_boo.mp3','sfx_gavel.mp3','sfx_dang.mp3','sfx_fireworks.mp3'];
for (const f of need) if (!fs.existsSync(f)) die(f + ' missing');
let engine = fs.readFileSync('scene_engine.html', 'utf8');
const j = JSON.parse(fs.readFileSync('kascity_v37.json', 'utf8'));
fs.writeFileSync('kascity_v38.json', JSON.stringify(j));
const v38str = JSON.stringify(j);

// ---- THE FIX: hook at top of playSound, before the layers early-return ----
const psRe = /function playSound\(id, at\) \{\r?\n\s*if \(!AUDIO_ON\) return;\r?\n\s*var d = soundDef\(id\);\r?\n\s*if \(!d\) return;/;
const psM = engine.match(psRe);
if (!psM) die('playSound anchor not found (engine differs)');
if (engine.split(psM[0]).length - 1 !== 1) die('playSound anchor not unique');
const psAnchor = psM[0];
const NL = psAnchor.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
engine = engine.split(psAnchor).join(psAnchor + NL +
  '  if (d.vox && window.KV_VOX && window.KV_VOX[d.vox]) {' + NL +
  '    try { var _a = window.KV_VOX[d.vox].cloneNode(); _a.volume = 0.9; _a.play(); } catch (e) {}' + NL +
  '  }\n' +
  '  if (d.speech && d.speech.text && typeof SpeechSynthesisUtterance !== "undefined") {\n' +
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

const b64 = f => fs.readFileSync(f).toString('base64');
const audioJs = [
  'window.KV_VOX = window.KV_VOX || {};',
  'window.KV_VOX.ching = new Audio("data:audio/mpeg;base64,' + b64('sfx_ching.mp3') + '");',
  'window.KV_VOX.boo   = new Audio("data:audio/mpeg;base64,' + b64('sfx_boo.mp3') + '");',
  'window.KV_VOX.gavel = new Audio("data:audio/mpeg;base64,' + b64('sfx_gavel.mp3') + '");',
  'window.KV_VOX.dang  = new Audio("data:audio/mpeg;base64,' + b64('sfx_dang.mp3') + '");',
  'window.KV_VOX.fw    = new Audio("data:audio/mpeg;base64,' + b64('sfx_fireworks.mp3') + '");',
  'for (var _k in window.KV_VOX) window.KV_VOX[_k].preload = "auto";',
  'window.KV_MUSIC = new Audio("data:audio/mpeg;base64,' + b64('kv_music_loop.mp3') + '");',
  'window.KV_MUSIC.loop = true; window.KV_MUSIC.volume = 0.45; window.KV_MUSIC.preload = "auto";',
  '(function(){',
  '  function start(){ try { window.KV_MUSIC.play(); } catch(e){}',
  '    document.removeEventListener("pointerdown", start); document.removeEventListener("keydown", start); }',
  '  document.addEventListener("pointerdown", start); document.addEventListener("keydown", start);',
  '  var btn=document.createElement("button"); btn.textContent="\\u266A";',
  '  btn.style.cssText="position:fixed;right:8px;bottom:8px;z-index:60;width:34px;height:34px;border-radius:17px;background:rgba(20,16,12,0.85);color:#f4e4c1;border:1px solid #5a4a3a;font-size:15px;cursor:pointer;";',
  '  btn.addEventListener("click",function(e){e.stopPropagation();',
  '    if(window.KV_MUSIC.paused){window.KV_MUSIC.play();btn.style.opacity=1;}else{window.KV_MUSIC.pause();btn.style.opacity=0.45;}});',
  '  document.body.appendChild(btn);',
  '  // SFX TEST PANEL — click to verify each sample',
  '  var tp=document.createElement("div");',
  '  tp.style.cssText="position:fixed;right:8px;bottom:50px;z-index:60;display:flex;gap:4px;";',
  '  ["ching","boo","gavel","dang","fw"].forEach(function(k){',
  '    var b=document.createElement("button"); b.textContent=k.slice(0,2);',
  '    b.style.cssText="width:26px;height:22px;font:9px monospace;background:rgba(20,16,12,0.85);color:#f4e4c1;border:1px solid #5a4a3a;border-radius:3px;cursor:pointer;";',
  '    b.addEventListener("click",function(e){e.stopPropagation(); window.KV_VOX[k].cloneNode().play();});',
  '    tp.appendChild(b);',
  '  });',
  '  document.body.appendChild(tp);',
  '  var COL={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};',
  '  var bn=document.createElement("div");',
  '  bn.style.cssText="position:fixed;left:50%;top:112px;transform:translateX(-50%);z-index:58;padding:7px 18px;"+',
  '    "border-radius:6px;font:700 15px/1.2 monospace;color:#12100e;opacity:0;transition:opacity .18s;pointer-events:none;"+',
  '    "box-shadow:0 2px 10px rgba(0,0,0,.5);white-space:nowrap;";',
  '  document.body.appendChild(bn);',
  '  var lastTile=-1, hideAt=0;',
  '  setInterval(function(){',
  '    var s=window.KV_STATS||{}, seat=s["world.flags.evseat"], tile=s["world.flags.evtile"];',
  '    if(tile!=null && tile>=0 && tile!==lastTile && seat>=1){',
  '      lastTile=tile; bn.textContent="P"+seat+"  ACQUIRED  BLOCK "+tile;',
  '      bn.style.background=COL[seat]||"#f4e4c1"; bn.style.opacity=1; hideAt=Date.now()+2200;',
  '    }',
  '    if(hideAt && Date.now()>hideAt){ bn.style.opacity=0; hideAt=0; }',
  '  },160);',
  '})();'
].join('\n');

const src25 = fs.readFileSync('showcase_kascity25.html', 'utf8');
const cs = src25.indexOf('// ---- injected kascity v25 showcase ----');
const ce = src25.indexOf('try { loadScene(');
if (cs < 0 || ce <= cs) die('corner-card block not found');

fs.writeFileSync('showcase_kascity38.html', engine.replace('</script>', [
  '', audioJs,
  src25.slice(cs, ce).replace('v25 showcase', 'v38 showcase'),
  'try { loadScene(' + JSON.stringify(v38str) + '); }',
  "catch (e) { console.error('kascity38 boot: ' + (e && e.message)); }", ''
].join('\n') + '\n</script>'));

console.log('PASS vox/speech hook moved to playSound (before the layers early-return)');
console.log('PASS SFX test buttons added bottom-right (ch/bo/ga/da/fw)');
console.log('OK kascity_v38.json + showcase_kascity38.html (' + (fs.statSync('showcase_kascity38.html').size/1024/1024).toFixed(1) + ' MB)');
