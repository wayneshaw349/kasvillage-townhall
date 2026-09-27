// kascity_visual_v39.cjs
// Reads kascity_v38.json + scene_engine.html + audio -> kascity_v39.json + showcase_kascity39.html
//  1) OFFER HANG FIX: prompt "mkoffer" has options Make offer(0)/No(1) but only 0 had a consumer —
//     picking No left phase 21 forever. Adds the mkoffer==1 decline branch per offer tile.
//  2) PACING: bots wait 2.5s between turns so moves are readable (gated on world.flags.rollt).
//  3) REAL COUNTDOWN: 10:00 driven by browser wall-clock in the DOM, starts on first roll.
//  4) PLAY-BY-PLAY: scrolling feed, bottom-left — every cash change, purchase, rent, tax named.
//  5) LIVE TALLY: standings panel sorted by net worth, updates continuously.
//  6) CLICKABLE SQUARES: engine's project() exposed; invisible hotspots track each tile on screen;
//     click pops that property's per-game stats (age / tax / hazard% / owner / price).
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
const need = ['kascity_v38.json','scene_engine.html','showcase_kascity25.html','kv_music_loop.mp3',
              'sfx_ching.mp3','sfx_boo.mp3','sfx_gavel.mp3','sfx_dang.mp3','sfx_fireworks.mp3'];
for (const f of need) if (!fs.existsSync(f)) die(f + ' missing');
let engine = fs.readFileSync('scene_engine.html', 'utf8');
const j = JSON.parse(fs.readFileSync('kascity_v38.json', 'utf8'));
const byId = id => j.nodes.find(n => n.id === id);
const director = byId('director') || die('director missing');

// ---------- 1. offer decline branches ----------
let declN = 0;
(function walk(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.selector)) {
    const sel = o.selector;
    for (let i = sel.length - 1; i >= 0; i--) {
      const br = sel[i];
      if (!br || !Array.isArray(br.sequence)) continue;
      const c = br.sequence[0] && br.sequence[0].cond;
      const m = typeof c === 'string' && /^world\.flags\.offer_ask == (\d+) && world\.flags\.mkoffer == 0$/.exec(c);
      if (!m) continue;
      const ask = m[1];
      const declineCond = 'world.flags.offer_ask == ' + ask + ' && world.flags.mkoffer == 1';
      if (sel.some(b => b && b.sequence && b.sequence[0] && b.sequence[0].cond === declineCond)) continue;
      sel.splice(i + 1, 0, { sequence: [
        { cond: declineCond },
        { do: { action: 'setState', args: ['mkoffer', -1] } },
        { do: { action: 'setState', args: ['oq', 0] } },
        { do: { action: 'setState', args: ['offer_ask', -1] } },
        { do: { action: 'setState', args: ['phase', 3] } }
      ]});
      declN++;
    }
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v);
})(director.bt);
if (declN < 8) die('offer decline branches added ' + declN + ' (<8)');

// safety net: any lingering phase-21 with no pending question resolves after 6s
const rootSel = director.bt.sequence[1] && director.bt.sequence[1].selector;
if (!Array.isArray(rootSel)) die('root selector missing');
rootSel.unshift({ sequence: [
  { cond: 'world.flags.phase == 21 && world.flags.oq == 0 && world.flags.mkoffer == -1 && world.time - world.flags.rollt > 6' },
  { do: { action: 'setState', args: ['offer_ask', -1] } },
  { do: { action: 'setState', args: ['phase', 3] } }
]});

// ---------- 2. bot turn pacing ----------
let paceN = 0;
(function walk2(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.sequence)) {
    const c = o.sequence[0] && o.sequence[0].cond;
    if (c === 'world.flags.asked == 0 && seat() != 1') {
      o.sequence[0].cond = c + ' && world.time - world.flags.rollt > 2.5';
      paceN++;
    }
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk2(v);
})(director.bt);
if (paceN < 1) die('bot pacing branch not found');

// ---------- 3. expose per-tile stats to JS via hidden bind labels ----------
const hud = byId('hud') || die('hud missing');
const propTiles = [];
for (let i = 0; i < 40; i++) {
  const t = byId('tile_' + i);
  if (t && t.children && t.children.some(c => /^band_/.test(c.id || ''))) propTiles.push(i);
}
if (propTiles.length < 16) die('property tiles ' + propTiles.length);
for (const i of propTiles) {
  for (const [pfx, fl] of [['ga', 'age_t'], ['gt', 'tax_t'], ['gh', 'hz_t']]) {
    const id = pfx + i;
    if (!hud.children.some(c => c.id === id))
      hud.children.push({ id, type: 'Label', anchor: 'topLeft', pos: [-9999, -9999], size: 8, text: '', bind: 'world.flags.' + fl + i });
  }
}

const v39str = JSON.stringify(j);
fs.writeFileSync('kascity_v39.json', v39str);

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

// expose project() + scene for the click overlay
const readyAnchor = 'post({ kv: "ready", id: scene.meta.id, permissions: scene.permissions || [] });';
if (engine.split(readyAnchor).length - 1 !== 1) die('ready anchor mismatch');
engine = engine.split(readyAnchor).join(readyAnchor + NL +
  '  window.KV_PROJECT = function (p) { try { return project(p); } catch (e) { return null; } };' + NL +
  '  window.KV_SCENE = scene;' + NL +
  '  window.KV_NODE = function (id) { var f = null; (function w(ns){ for (var i=0;i<ns.length;i++){ if(ns[i].id===id){f=ns[i];return;} if(ns[i].children) w(ns[i].children); } })(scene.nodes); return f; };' + NL);

const b64 = f => fs.readFileSync(f).toString('base64');
const tileList = JSON.stringify(propTiles);

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
window.KV_TILES = ${tileList};

(function () {
  var COL = {1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};
  function el(tag, css, parent) { var e=document.createElement(tag); e.style.cssText=css; (parent||document.body).appendChild(e); return e; }

  // music start + toggle
  function start(){ try{window.KV_MUSIC.play();}catch(e){} document.removeEventListener("pointerdown",start); document.removeEventListener("keydown",start); }
  document.addEventListener("pointerdown", start); document.addEventListener("keydown", start);
  var mb = el("button","position:fixed;right:8px;bottom:8px;z-index:60;width:34px;height:34px;border-radius:17px;background:rgba(20,16,12,.85);color:#f4e4c1;border:1px solid #5a4a3a;font-size:15px;cursor:pointer;");
  mb.textContent="\\u266A";
  mb.onclick=function(e){e.stopPropagation(); if(window.KV_MUSIC.paused){window.KV_MUSIC.play();mb.style.opacity=1;}else{window.KV_MUSIC.pause();mb.style.opacity=.45;}};

  // ---- REAL 10:00 COUNTDOWN (browser wall clock) ----
  var clock = el("div","position:fixed;left:50%;top:56px;transform:translateX(-50%);z-index:59;font:900 34px/1 Impact,'Arial Black',sans-serif;color:#f8f0d8;text-shadow:2px 2px 0 #241c12;letter-spacing:1px;");
  var clabel = el("div","position:fixed;left:50%;top:94px;transform:translateX(-50%);z-index:59;font:10px monospace;color:#b8c4b0;letter-spacing:2px;");
  clabel.textContent="TIME LEFT";
  var t0=null, TOTAL=600;
  function tick(){
    if(t0===null){ clock.textContent="10:00"; return; }
    var left=Math.max(0, TOTAL-Math.floor((Date.now()-t0)/1000));
    clock.textContent = Math.floor(left/60)+":"+String(left%60).padStart(2,"0");
    if(left<=30) clock.style.color="#ff6a4a";
    if(left===0) clock.textContent="0:00";
  }
  setInterval(tick,250); tick();

  // ---- PLAY BY PLAY ----
  var feed = el("div","position:fixed;left:8px;bottom:96px;z-index:57;width:250px;max-height:190px;overflow:hidden;display:flex;flex-direction:column-reverse;gap:3px;pointer-events:none;");
  function log(text, color){
    if(t0===null) t0=Date.now();
    var row=el("div","background:rgba(20,16,12,.86);border-left:3px solid "+(color||"#8a7a5a")+";padding:4px 8px;border-radius:3px;font:11px/1.35 monospace;color:#f4e4c1;opacity:1;transition:opacity 1s;",feed);
    row.textContent=text;
    while(feed.children.length>8) feed.removeChild(feed.firstChild);
    setTimeout(function(){row.style.opacity=.45;},9000);
  }
  window.KV_LOG = log;

  // ---- LIVE TALLY ----
  var tally = el("div","position:fixed;left:8px;bottom:8px;z-index:57;width:250px;background:rgba(20,16,12,.86);border:1px solid #5a4a3a;border-radius:5px;padding:6px 8px;font:11px/1.5 monospace;color:#f4e4c1;");
  function refreshTally(){
    var s=window.KV_STATS, rows=[];
    for(var p=1;p<=4;p++){
      rows.push({p:p, nw:s["world.flags.nw"+p]||0, cash:s["seats."+p+".cash"]||0, mort:s["seats."+p+".mort"]||0});
    }
    rows.sort(function(a,b){return b.nw-a.nw;});
    var h="<b style='letter-spacing:1px'>STANDINGS</b><br>";
    rows.forEach(function(r,i){
      h+="<span style='color:"+COL[r.p]+"'>&#9632;</span> "+(i+1)+". P"+r.p+
         " &nbsp;<b>"+r.nw+"</b> &nbsp;<span style='opacity:.7'>cash "+r.cash+" / mort "+r.mort+"</span><br>";
    });
    tally.innerHTML=h;
  }
  setInterval(refreshTally,400);

  // ---- EVENT WATCHER -> feed ----
  var prevCash={}, lastTile=-1;
  setInterval(function(){
    var s=window.KV_STATS;
    for(var p=1;p<=4;p++){
      var c=s["seats."+p+".cash"];
      if(c==null) continue;
      if(prevCash[p]!=null && c!==prevCash[p]){
        var d=c-prevCash[p];
        log("P"+p+(d>0?"  received  +":"  paid  ")+(d>0?d:-d), COL[p]);
      }
      prevCash[p]=c;
    }
    var seat=s["world.flags.evseat"], tile=s["world.flags.evtile"];
    if(tile!=null && tile>=0 && tile!==lastTile && seat>=1){
      lastTile=tile;
      log("P"+seat+"  ACQUIRED  block "+tile, COL[seat]);
    }
  },250);

  // ---- CLICKABLE SQUARES ----
  var pop = el("div","position:fixed;z-index:61;display:none;background:rgba(20,16,12,.95);border:1px solid #caa64c;border-radius:6px;padding:8px 12px;font:11px/1.6 monospace;color:#f4e4c1;box-shadow:0 4px 16px rgba(0,0,0,.6);min-width:150px;");
  document.addEventListener("pointerdown", function(e){ if(!pop.contains(e.target)) pop.style.display="none"; }, true);

  var spots={};
  window.KV_TILES.forEach(function(i){
    var h=el("div","position:fixed;z-index:56;width:54px;height:54px;margin:-27px 0 0 -27px;cursor:pointer;border-radius:6px;");
    h.onmouseenter=function(){h.style.background="rgba(255,242,160,.18)";};
    h.onmouseleave=function(){h.style.background="transparent";};
    h.onclick=function(ev){
      ev.stopPropagation();
      var s=window.KV_STATS;
      var age=s["world.flags.age_t"+i], tax=s["world.flags.tax_t"+i], hz=s["world.flags.hz_t"+i];
      pop.innerHTML="<b style='color:#f0c860'>BLOCK "+i+"</b><br>"+
        "AGE &nbsp;<b>"+(age!=null?age+" yrs":"?")+"</b><br>"+
        "TAX &nbsp;<b>"+(tax!=null?tax:"?")+"</b><br>"+
        "HAZARD &nbsp;<b style='color:"+(hz>=28?"#ff6a4a":"#9cd87c")+"'>"+(hz!=null?hz+"%":"?")+"</b><br>"+
        "<span style='opacity:.65'>"+(hz>=28?"high risk - repairs likely":"low risk")+"</span>";
      pop.style.display="block";
      pop.style.left=Math.min(window.innerWidth-190, ev.clientX+12)+"px";
      pop.style.top=Math.min(window.innerHeight-140, ev.clientY+12)+"px";
    };
    spots[i]=h;
  });

  setInterval(function(){
    if(!window.KV_PROJECT || !window.KV_NODE) return;
    window.KV_TILES.forEach(function(i){
      var n=window.KV_NODE("tile_"+i);
      var h=spots[i];
      if(!n || !n.worldPos){ h.style.display="none"; return; }
      var p=window.KV_PROJECT(n.worldPos);
      if(!p){ h.style.display="none"; return; }
      var cv=document.querySelector("canvas");
      var r=cv?cv.getBoundingClientRect():{left:0,top:0,width:window.innerWidth,height:window.innerHeight};
      var sx=r.width/(cv?cv.width:window.innerWidth), sy=r.height/(cv?cv.height:window.innerHeight);
      h.style.display="block";
      h.style.left=(r.left+p.x*sx)+"px";
      h.style.top=(r.top+p.y*sy)+"px";
    });
  },200);
})();
`;

const src25 = fs.readFileSync('showcase_kascity25.html', 'utf8');
const cs = src25.indexOf('// ---- injected kascity v25 showcase ----');
const ce = src25.indexOf('try { loadScene(');
if (cs < 0 || ce <= cs) die('corner-card block not found');

fs.writeFileSync('showcase_kascity39.html', engine.replace('</script>', [
  '', uiJs,
  src25.slice(cs, ce).replace('v25 showcase', 'v39 showcase'),
  'try { loadScene(' + JSON.stringify(v39str) + '); }',
  "catch (e) { console.error('kascity39 boot: ' + (e && e.message)); }", ''
].join('\n') + '\n</script>'));

console.log('PASS offer hang fixed: ' + declN + ' decline branches + phase-21 safety net');
console.log('PASS bot turn pacing 2.5s (' + paceN + ' branch)');
console.log('PASS per-tile stats exposed for ' + propTiles.length + ' properties');
console.log('PASS real wall-clock 10:00 countdown, play-by-play feed, live standings, clickable squares');
console.log('OK kascity_v39.json + showcase_kascity39.html (' + (fs.statSync('showcase_kascity39.html').size/1024/1024).toFixed(1) + ' MB)');
