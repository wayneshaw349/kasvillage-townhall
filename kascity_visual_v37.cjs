// kascity_visual_v37.cjs
// Reads kascity_v36.json + scene_engine.html + audio -> kascity_v37.json + showcase_kascity37.html
//  1) CLOCK: big countdown top-center (existing clock_m/clock_s enlarged + repositioned + labeled)
//  2) EVENT BANNER: every buy / sell / offer flashes a bold DOM banner naming who did what
//  3) FIREWORKS: sfx_fireworks.mp3 on win + big purchases (deed events)
//  4) music loop replaced with the tightened cut (no dead pause after SET IT)
// Needs in folder: kascity_v36.json, scene_engine.html, showcase_kascity25.html,
//   kv_music_loop.mp3, sfx_ching.mp3, sfx_boo.mp3, sfx_gavel.mp3, sfx_dang.mp3, sfx_fireworks.mp3
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
const need = ['kascity_v36.json','scene_engine.html','showcase_kascity25.html','kv_music_loop.mp3',
              'sfx_ching.mp3','sfx_boo.mp3','sfx_gavel.mp3','sfx_dang.mp3','sfx_fireworks.mp3'];
for (const f of need) if (!fs.existsSync(f)) die(f + ' missing');
let engine = fs.readFileSync('scene_engine.html', 'utf8');
const j = JSON.parse(fs.readFileSync('kascity_v36.json', 'utf8'));
const snd = (j.resources && j.resources.sounds) || die('sounds missing');
const byId = id => j.nodes.find(n => n.id === id);

// ---------- 1. clock big + centered ----------
const hud = byId('hud') || die('hud missing');
const cm = hud.children.find(c => c.id === 'clock_m');
const cs_ = hud.children.find(c => c.id === 'clock_s');
if (!cm || !cs_) die('clock labels missing');
cm.anchor = 'topCenter'; cm.pos = [-26, 62]; cm.size = 26; cm.weight = 900;
cm.color = '#f8f0d8'; cm.shadow = '#241c12'; cm.font = "Impact, 'Arial Black', sans-serif";
cs_.anchor = 'topCenter'; cs_.pos = [10, 62]; cs_.size = 26; cs_.weight = 900;
cs_.color = '#f8f0d8'; cs_.shadow = '#241c12'; cs_.font = "Impact, 'Arial Black', sans-serif";
if (!hud.children.some(c => c.id === 'clock_lbl'))
  hud.children.push({ id: 'clock_lbl', type: 'Label', anchor: 'topCenter', pos: [0, 92], size: 10, text: 'TIME LEFT', color: '#b8c4b0' });

// ---------- 2. fireworks on win ----------
if (snd.win) { snd.win.vox = 'fw'; delete snd.win.speech; }
else die('win sound missing');

// ---------- 3. event banner flags: set on ownership flips ----------
const director = byId('director') || die('director missing');
let evN = 0;
(function walk(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.sequence)) {
    const seq = o.sequence;
    let tile = null, seat = null;
    for (const e of seq) {
      if (e && e.do && e.do.action === 'show' && typeof e.do.to === 'string') {
        const m = /^own_(\d+)_(\d)$/.exec(e.do.to);
        if (m) { tile = m[1]; seat = m[2]; break; }
      }
    }
    if (tile !== null && !seq.some(e => e && e.do && e.do.args && e.do.args[0] === 'evseat')) {
      seq.push(
        { do: { action: 'setState', args: ['evseat', parseInt(seat, 10)] } },
        { do: { action: 'setState', args: ['evtile', parseInt(tile, 10)] } },
        { do: { action: 'setFlagExpr', args: ['evt', 'world.time'] } }
      );
      evN++;
    }
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v);
})(director.bt);
if (evN < 20) die('event hooks ' + evN);

// mirror flags into HUD (offscreen labels -> KV_STATS -> DOM banner)
for (const [id, bind] of [['ev_seat', 'world.flags.evseat'], ['ev_tile', 'world.flags.evtile']]) {
  if (!hud.children.some(c => c.id === id))
    hud.children.push({ id, type: 'Label', anchor: 'topLeft', pos: [-9999, -9999], size: 8, text: '', bind });
}

// boot
let bootOk = false;
(function walkA(o) {
  if (bootOk || !o || typeof o !== 'object') return;
  if (Array.isArray(o)) {
    const ri = o.findIndex(e => e && e.do && e.do.action === 'setState' && e.do.args && e.do.args[0] === 'ready' && e.do.args[1] === 1);
    if (ri >= 0) {
      o.splice(ri, 0,
        { after: 0.1, do: { action: 'setState', args: ['evseat', 0] } },
        { after: 0.1, do: { action: 'setState', args: ['evtile', -1] } },
        { after: 0.1, do: { action: 'setState', args: ['evt', 0] } });
      bootOk = true; return;
    }
    o.forEach(walkA);
  } else Object.values(o).forEach(walkA);
})(director.alarms);
if (!bootOk) die('boot anchor missing');

const v37str = JSON.stringify(j);
fs.writeFileSync('kascity_v37.json', v37str);

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
  '  // EVENT BANNER',
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
  '      lastTile=tile;',
  '      bn.textContent="P"+seat+"  ACQUIRED  BLOCK "+tile;',
  '      bn.style.background=COL[seat]||"#f4e4c1"; bn.style.opacity=1;',
  '      hideAt=Date.now()+2200;',
  '    }',
  '    if(hideAt && Date.now()>hideAt){ bn.style.opacity=0; hideAt=0; }',
  '  },160);',
  '})();'
].join('\n');

const src25 = fs.readFileSync('showcase_kascity25.html', 'utf8');
const cs2 = src25.indexOf('// ---- injected kascity v25 showcase ----');
const ce2 = src25.indexOf('try { loadScene(');
if (cs2 < 0 || ce2 <= cs2) die('corner-card block not found');

fs.writeFileSync('showcase_kascity37.html', engine.replace('</script>', [
  '', audioJs,
  src25.slice(cs2, ce2).replace('v25 showcase', 'v37 showcase'),
  'try { loadScene(' + JSON.stringify(v37str) + '); }',
  "catch (e) { console.error('kascity37 boot: ' + (e && e.message)); }", ''
].join('\n') + '\n</script>'));

console.log('PASS clock enlarged top-center + TIME LEFT label');
console.log('PASS event banner hooks on ' + evN + ' ownership flips');
console.log('PASS fireworks on win; tightened music loop (no pause after SET IT)');
console.log('OK kascity_v37.json + showcase_kascity37.html (' + (fs.statSync('showcase_kascity37.html').size/1024/1024).toFixed(1) + ' MB)');
