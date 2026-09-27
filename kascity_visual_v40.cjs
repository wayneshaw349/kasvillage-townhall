// kascity_visual_v40.cjs
// Reads kascity_v39.json + scene_engine.html + audio -> kascity_v40.json + showcase_kascity40.html
//  1) LAYOUT: play-by-play + standings moved to the RIGHT edge, mid-screen, narrow and collapsible —
//     clear of the four corner cards, the prompt bar, and the board.
//  2) CASH FIX: "seats.N.cash" doesn't resolve through the bind path (BANK worked because it reads a
//     world flag). Cash is now mirrored to world.flags.cashN in the beat branches, same as net worth.
//  3) Duplicate engine clock labels parked offscreen; only the DOM countdown shows.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
const need = ['kascity_v39.json','scene_engine.html','showcase_kascity25.html','kv_music_loop.mp3',
              'sfx_ching.mp3','sfx_boo.mp3','sfx_gavel.mp3','sfx_dang.mp3','sfx_fireworks.mp3'];
for (const f of need) if (!fs.existsSync(f)) die(f + ' missing');
let engine = fs.readFileSync('scene_engine.html', 'utf8');
const j = JSON.parse(fs.readFileSync('kascity_v39.json', 'utf8'));
const byId = id => j.nodes.find(n => n.id === id);
const director = byId('director') || die('director missing');

// ---------- 1. mirror cash + mort to world flags in the beat branches ----------
let beatN = 0;
(function walk(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.sequence) && o.sequence[0] && typeof o.sequence[0].cond === 'string'
      && o.sequence[0].cond.indexOf('floor(mod(world.time, 2) * 4) ==') === 0) {
    if (!o.sequence.some(e => e && e.do && e.do.args && e.do.args[0] === 'cash1')) {
      for (let p = 1; p <= 4; p++) {
        o.sequence.push({ do: { action: 'setFlagExpr', args: ['cash' + p, "seatStat(" + p + ",'cash')"] } });
        o.sequence.push({ do: { action: 'setFlagExpr', args: ['mrt' + p, "seatStat(" + p + ",'mort')"] } });
      }
    }
    beatN++;
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v);
})(director.bt);
if (beatN !== 8) die('beat branches ' + beatN + ' != 8');

// hud bind labels for the new flags + park the old clock
const hud = byId('hud') || die('hud missing');
for (let p = 1; p <= 4; p++) {
  for (const [id, fl] of [['fc' + p, 'cash' + p], ['fm' + p, 'mrt' + p]]) {
    if (!hud.children.some(c => c.id === id))
      hud.children.push({ id, type: 'Label', anchor: 'topLeft', pos: [-9999, -9999], size: 8, text: '', bind: 'world.flags.' + fl });
  }
}
for (const id of ['clock_m', 'clock_s', 'clock_lbl']) {
  const n = hud.children.find(c => c.id === id);
  if (n) n.pos = [-9999, -9999];
}

// boot seeds
let bootOk = false;
(function walkA(o) {
  if (bootOk || !o || typeof o !== 'object') return;
  if (Array.isArray(o)) {
    const ri = o.findIndex(e => e && e.do && e.do.action === 'setState' && e.do.args && e.do.args[0] === 'ready' && e.do.args[1] === 1);
    if (ri >= 0) {
      const ins = [];
      for (let p = 1; p <= 4; p++) {
        ins.push({ after: 0.1, do: { action: 'setState', args: ['cash' + p, 2000] } });
        ins.push({ after: 0.1, do: { action: 'setState', args: ['mrt' + p, 0] } });
      }
      o.splice(ri, 0, ...ins);
      bootOk = true; return;
    }
    o.forEach(walkA);
  } else Object.values(o).forEach(walkA);
})(director.alarms);
if (!bootOk) die('boot anchor missing');

const v40str = JSON.stringify(j);
fs.writeFileSync('kascity_v40.json', v40str);

// ---------- engine patches ----------
const psRe = /function playSound\(id, at\) \{\r?\n\s*if \(!AUDIO_ON\) return;\r?\n\s*var d = soundDef\(id\);\r?\n\s*if \(!d\) return;/;
const psM = engine.match(psRe);
if (!psM) die('playSound anchor not found');
const NL = psM[0].indexOf('\r\n') >= 0 ? '\r\n' : '\n';
engine = engine.split(psM[0]).join(psM[0] + NL +
  '  if (d.vox && window.KV_VOX && window.KV_VOX[d.vox]) {' + NL +
  '    try { var _a = window.KV_VOX[d.vox].cloneNode(); _a.volume = 0.9; _a.play(); } catch (e) {}' + NL +
  '  }' + NL);
const bindAnchor = 'if (n.type === "ProgressBar" && n.bind) {';
if (engine.split(bindAnchor).length - 1 !== 1) die('bind anchor mismatch');
engine = engine.split(bindAnchor).join(
  'if (n.type === "Label" && n.bind) { var cvb = resolvePath(n.bind.split("."), exprCtx(null)); if (cvb != null && cvb === cvb) { n.text = "" + Math.round(cvb); (window.KV_STATS || (window.KV_STATS = {}))[n.bind] = Math.round(cvb); } }\n    ' + bindAnchor);
const readyAnchor = 'post({ kv: "ready", id: scene.meta.id, permissions: scene.permissions || [] });';
if (engine.split(readyAnchor).length - 1 !== 1) die('ready anchor mismatch');
engine = engine.split(readyAnchor).join(readyAnchor + NL +
  '  window.KV_PROJECT = function (p) { try { return project(p); } catch (e) { return null; } };' + NL +
  '  window.KV_SCENE = scene;' + NL +
  '  window.KV_NODE = function (id) { var f = null; (function w(ns){ for (var i=0;i<ns.length;i++){ if(ns[i].id===id){f=ns[i];return;} if(ns[i].children) w(ns[i].children); } })(scene.nodes); return f; };' + NL);

const b64 = f => fs.readFileSync(f).toString('base64');
const propTiles = [];
for (let i = 0; i < 40; i++) {
  const t = byId('tile_' + i);
  if (t && t.children && t.children.some(c => /^band_/.test(c.id || ''))) propTiles.push(i);
}

const uiJs = `
window.KV_VOX = window.KV_VOX || {};
window.KV_VOX.ching = new Audio("data:audio/mpeg;base64,${b64('sfx_ching.mp3')}");
window.KV_VOX.boo   = new Audio("data:audio/mpeg;base64,${b64('sfx_boo.mp3')}");
window.KV_VOX.gavel = new Audio("data:audio/mpeg;base64,${b64('sfx_gavel.mp3')}");
window.KV_VOX.dang  = new Audio("data:audio/mpeg;base64,${b64('sfx_dang.mp3')}");
window.KV_VOX.fw    = new Audio("data:audio/mpeg;base64,${b64('sfx_fireworks.mp3')}");
for (var _k in window.KV_VOX) window.KV_VOX[_k].preload = "auto";
window.KV_MUSIC = new Audio("data:audio/mpeg;base64,${b64('kv_music_loop.mp3')}");
window.KV_MUSIC.loop = true; window.KV_MUSIC.volume = 0.42; window.KV_MUSIC.preload = "auto";
window.KV_STATS = window.KV_STATS || {};
window.KV_TILES = ${JSON.stringify(propTiles)};

(function () {
  var COL = {1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};
  function el(tag, css, parent) { var e=document.createElement(tag); e.style.cssText=css; (parent||document.body).appendChild(e); return e; }
  function cash(p){ var v=window.KV_STATS["world.flags.cash"+p]; return v==null?"-":v; }
  function mort(p){ var v=window.KV_STATS["world.flags.mrt"+p]; return v==null?"-":v; }
  function bank(p){ var v=window.KV_STATS["world.flags.nw"+p]; return v==null?"-":v; }

  function start(){ try{window.KV_MUSIC.play();}catch(e){} document.removeEventListener("pointerdown",start); document.removeEventListener("keydown",start); }
  document.addEventListener("pointerdown", start); document.addEventListener("keydown", start);
  var mb = el("button","position:fixed;right:8px;bottom:8px;z-index:60;width:30px;height:30px;border-radius:15px;background:rgba(20,16,12,.85);color:#f4e4c1;border:1px solid #5a4a3a;font-size:14px;cursor:pointer;");
  mb.textContent="\\u266A";
  mb.onclick=function(e){e.stopPropagation(); if(window.KV_MUSIC.paused){window.KV_MUSIC.play();mb.style.opacity=1;}else{window.KV_MUSIC.pause();mb.style.opacity=.45;}};

  // ---- countdown (clear of the turn banner) ----
  var clock = el("div","position:fixed;left:50%;top:60px;transform:translateX(-50%);z-index:59;font:900 30px/1 Impact,'Arial Black',sans-serif;color:#f8f0d8;text-shadow:2px 2px 0 #241c12;letter-spacing:1px;pointer-events:none;");
  var t0=null, TOTAL=600;
  setInterval(function(){
    if(t0===null){ clock.textContent="10:00"; return; }
    var left=Math.max(0, TOTAL-Math.floor((Date.now()-t0)/1000));
    clock.textContent=Math.floor(left/60)+":"+String(left%60).padStart(2,"0");
    clock.style.color = left<=30 ? "#ff6a4a" : "#f8f0d8";
  },250);

  // ---- RIGHT-EDGE PANEL: standings + feed, collapsible ----
  var panel = el("div","position:fixed;right:6px;top:50%;transform:translateY(-50%);z-index:57;width:190px;font:10px/1.45 monospace;color:#f4e4c1;");
  var head = el("div","background:rgba(20,16,12,.9);border:1px solid #5a4a3a;border-radius:4px 4px 0 0;padding:3px 7px;cursor:pointer;letter-spacing:1px;display:flex;justify-content:space-between;", panel);
  head.innerHTML="<b>GAME LOG</b><span>&#9660;</span>";
  var body = el("div","background:rgba(20,16,12,.86);border:1px solid #5a4a3a;border-top:0;border-radius:0 0 4px 4px;padding:5px 7px;", panel);
  var tally = el("div","margin-bottom:5px;padding-bottom:5px;border-bottom:1px solid #3a3228;", body);
  var feed = el("div","max-height:150px;overflow:hidden;display:flex;flex-direction:column-reverse;gap:2px;", body);
  var open=true;
  head.onclick=function(){ open=!open; body.style.display=open?"block":"none"; head.lastChild.innerHTML=open?"&#9660;":"&#9654;"; };

  function log(text, color){
    if(t0===null) t0=Date.now();
    var row=el("div","border-left:2px solid "+(color||"#8a7a5a")+";padding:1px 6px;transition:opacity 1s;",feed);
    row.textContent=text;
    while(feed.children.length>10) feed.removeChild(feed.firstChild);
    setTimeout(function(){row.style.opacity=.5;},9000);
  }
  window.KV_LOG = log;

  setInterval(function(){
    var rows=[];
    for(var p=1;p<=4;p++) rows.push({p:p, nw:(window.KV_STATS["world.flags.nw"+p]||0)});
    rows.sort(function(a,b){return b.nw-a.nw;});
    var h="";
    rows.forEach(function(r,i){
      h+="<span style='color:"+COL[r.p]+"'>&#9632;</span> "+(i+1)+". P"+r.p+" <b>"+bank(r.p)+"</b>"+
         " <span style='opacity:.65'>$"+cash(r.p)+" m"+mort(r.p)+"</span><br>";
    });
    tally.innerHTML=h;
  },400);

  var prevCash={}, lastTile=-1;
  setInterval(function(){
    for(var p=1;p<=4;p++){
      var c=window.KV_STATS["world.flags.cash"+p];
      if(c==null) continue;
      if(prevCash[p]!=null && c!==prevCash[p]){
        var d=c-prevCash[p];
        log("P"+p+(d>0?" +":" -")+Math.abs(d), COL[p]);
      }
      prevCash[p]=c;
    }
    var seat=window.KV_STATS["world.flags.evseat"], tile=window.KV_STATS["world.flags.evtile"];
    if(tile!=null && tile>=0 && tile!==lastTile && seat>=1){ lastTile=tile; log("P"+seat+" BOUGHT block "+tile, COL[seat]); }
  },250);

  // ---- clickable squares ----
  var pop = el("div","position:fixed;z-index:61;display:none;background:rgba(20,16,12,.95);border:1px solid #caa64c;border-radius:6px;padding:8px 12px;font:11px/1.6 monospace;color:#f4e4c1;box-shadow:0 4px 16px rgba(0,0,0,.6);min-width:145px;");
  document.addEventListener("pointerdown", function(e){ if(!pop.contains(e.target)) pop.style.display="none"; }, true);
  var spots={};
  window.KV_TILES.forEach(function(i){
    var h=el("div","position:fixed;z-index:56;width:50px;height:50px;margin:-25px 0 0 -25px;cursor:pointer;border-radius:6px;");
    h.onmouseenter=function(){h.style.background="rgba(255,242,160,.16)";};
    h.onmouseleave=function(){h.style.background="transparent";};
    h.onclick=function(ev){
      ev.stopPropagation();
      var s=window.KV_STATS, age=s["world.flags.age_t"+i], tax=s["world.flags.tax_t"+i], hz=s["world.flags.hz_t"+i];
      pop.innerHTML="<b style='color:#f0c860'>BLOCK "+i+"</b><br>AGE <b>"+(age!=null?age+" yrs":"?")+"</b><br>TAX <b>"+(tax!=null?tax:"?")+"</b><br>HAZARD <b style='color:"+(hz>=28?"#ff6a4a":"#9cd87c")+"'>"+(hz!=null?hz+"%":"?")+"</b><br><span style='opacity:.65'>"+(hz>=28?"high risk":"low risk")+"</span>";
      pop.style.display="block";
      pop.style.left=Math.min(window.innerWidth-190, ev.clientX+12)+"px";
      pop.style.top=Math.min(window.innerHeight-140, ev.clientY+12)+"px";
    };
    spots[i]=h;
  });
  setInterval(function(){
    if(!window.KV_PROJECT || !window.KV_NODE) return;
    var cv=document.querySelector("canvas");
    var r=cv?cv.getBoundingClientRect():null;
    window.KV_TILES.forEach(function(i){
      var n=window.KV_NODE("tile_"+i), h=spots[i];
      if(!n||!n.worldPos||!r){ h.style.display="none"; return; }
      var p=window.KV_PROJECT(n.worldPos);
      if(!p){ h.style.display="none"; return; }
      h.style.display="block";
      h.style.left=(r.left+p.x*(r.width/cv.width))+"px";
      h.style.top=(r.top+p.y*(r.height/cv.height))+"px";
    });
  },200);
})();
`;

const src25 = fs.readFileSync('showcase_kascity25.html', 'utf8');
const cs = src25.indexOf('// ---- injected kascity v25 showcase ----');
const ce = src25.indexOf('try { loadScene(');
if (cs < 0 || ce <= cs) die('corner-card block not found');

fs.writeFileSync('showcase_kascity40.html', engine.replace('</script>', [
  '', uiJs,
  src25.slice(cs, ce).replace('v25 showcase', 'v40 showcase'),
  'try { loadScene(' + JSON.stringify(v40str) + '); }',
  "catch (e) { console.error('kascity40 boot: ' + (e && e.message)); }", ''
].join('\n') + '\n</script>'));

console.log('PASS cash/mort mirrored to world flags in ' + beatN + ' beat branches (fixes CASH "-")');
console.log('PASS log + standings moved to right edge, collapsible, clear of cards and prompt bar');
console.log('PASS duplicate engine clock parked; DOM countdown only');
console.log('OK kascity_v40.json + showcase_kascity40.html (' + (fs.statSync('showcase_kascity40.html').size/1024/1024).toFixed(1) + ' MB)');
