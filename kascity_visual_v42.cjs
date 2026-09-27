// kascity_visual_v42.cjs
// Reads kascity_v41.json + scene_engine.html + audio -> kascity_v42.json + showcase_kascity42.html
//  1) AUTO-ROLL FIX: the "Your turn. Tap to roll" prompt branch had no seat() == 1 guard, so during a
//     bot's pacing window it prompted the human instead — that's why NPCs waited on your press.
//  2) OWNER HIGHLIGHT: owner plate widened + raised so the square wears a bold ring in that player's
//     colour, plus a matching flash the moment it's bought.
//  3) SQUARE NAMES: every property's name floats over its square (DOM, projected — zero scene nodes).
//  4) PLAY-BY-PLAY: bigger type, property names instead of block numbers, longer dwell.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
const need = ['kascity_v41.json','scene_engine.html','showcase_kascity25.html','kv_music_loop.mp3',
              'sfx_ching.mp3','sfx_boo.mp3','sfx_gavel.mp3','sfx_dang.mp3','sfx_fireworks.mp3'];
for (const f of need) if (!fs.existsSync(f)) die(f + ' missing');
let engine = fs.readFileSync('scene_engine.html', 'utf8');
const j = JSON.parse(fs.readFileSync('kascity_v41.json', 'utf8'));
const RES = j.resources || die('resources missing');
const byId = id => j.nodes.find(n => n.id === id);
const director = byId('director') || die('director missing');

// ---------- 1. auto-roll fix ----------
let fixN = 0;
(function walk(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.sequence)) {
    const c = o.sequence[0] && o.sequence[0].cond;
    if (c === 'world.flags.asked == 0'
        && o.sequence.some(e => e && e.do && e.do.action === 'prompt' && (e.do.args || [])[0] === 'go')) {
      o.sequence[0].cond = 'world.flags.asked == 0 && seat() == 1';
      fixN++;
    }
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v);
})(director.bt);
if (fixN < 1) die('roll prompt branch not found');

// ---------- 2. owner highlight stronger ----------
RES.meshes.ownPlate = { type: 'box', size: [2.62, 0.1, 2.62] };
let plateN = 0;
for (const n of j.nodes) {
  if (!n.children) continue;
  for (const c of n.children) {
    const m = /^own_(\d+)_(\d)$/.exec(c.id || '');
    if (!m) continue;
    c.transform.pos = [0, 0.085 + parseInt(m[2], 10) * 0.004, 0];
    plateN++;
  }
}
if (plateN < 80) die('owner plates ' + plateN);

// ---------- 3. tile names from the buy prompts ----------
const dstr = JSON.stringify(director);
const names = {};
const re = /"prompt","args":\["buy","(.+?) is unowned\. Buy for (\d+)\?"(?:,"[^"]*")*\]\}\},\{"do":\{"action":"setState","args":\["buy_tile",(\d+)\]/g;
let mm;
while ((mm = re.exec(dstr)) !== null) names[parseInt(mm[3], 10)] = { n: mm[1], p: parseInt(mm[2], 10) };
if (Object.keys(names).length < 16) die('tile names ' + Object.keys(names).length);

function countAll(list) { let c = 0; for (const n of list) { c++; if (n.children) c += countAll(n.children); } return c; }
const total = countAll(j.nodes);
if (total > 512) die('node cap ' + total);

const v42str = JSON.stringify(j);
fs.writeFileSync('kascity_v42.json', v42str);

// ---------- engine patches ----------
const psRe = /function playSound\(id, at\) \{\r?\n\s*if \(!AUDIO_ON\) return;\r?\n\s*var d = soundDef\(id\);\r?\n\s*if \(!d\) return;/;
const psM = engine.match(psRe);
if (!psM) die('playSound anchor not found');
const NL = psM[0].indexOf('\r\n') >= 0 ? '\r\n' : '\n';
engine = engine.split(psM[0]).join(psM[0] + NL +
  '  if (d.vox && window.KV_VOX && window.KV_VOX[d.vox]) {' + NL +
  '    try { var _a = window.KV_VOX[d.vox].cloneNode(); _a.volume = 0.9; _a.play(); } catch (e) {}' + NL +
  '  }' + NL);
const readyAnchor = 'post({ kv: "ready", id: scene.meta.id, permissions: scene.permissions || [] });';
if (engine.split(readyAnchor).length - 1 !== 1) die('ready anchor mismatch');
engine = engine.split(readyAnchor).join(readyAnchor + NL +
  '  window.KV_PROJECT = function (p) { try { return project(p); } catch (e) { return null; } };' + NL +
  '  window.KV_SCENE = scene;' + NL +
  '  window.KV_FLAGS = function () { try { var c = exprCtx(null); return (c && c.world && c.world.flags) || {}; } catch (e) { return {}; } };' + NL +
  '  window.KV_SEAT = function (p, k) { try { var c = exprCtx(null); if (c && c.seats && c.seats[p]) return c.seats[p][k]; } catch (e) {} return null; };' + NL +
  '  window.KV_NODE = function (id) { var f = null; (function w(ns){ for (var i=0;i<ns.length;i++){ if(ns[i].id===id){f=ns[i];return;} if(ns[i].children) w(ns[i].children); } })(scene.nodes); return f; };' + NL +
  '  window.KV_OWNER = function (tid) { var o = null; for (var s = 1; s <= 4; s++) { var n = window.KV_NODE("own_" + tid + "_" + s); if (n && n.visible !== false && !n.hidden) o = s; } return o; };' + NL);

const b64 = f => fs.readFileSync(f).toString('base64');

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
window.KV_NAMES = ${JSON.stringify(names)};

(function () {
  var COL = {1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};
  function el(t,css,par){var e=document.createElement(t);e.style.cssText=css;(par||document.body).appendChild(e);return e;}
  function F(){ return (window.KV_FLAGS&&window.KV_FLAGS())||{}; }
  function sv(p,k){ var v=window.KV_SEAT?window.KV_SEAT(p,k):null; return v==null?null:Math.round(v); }
  function cashOf(p){var v=sv(p,'cash');return v==null?"-":v;}
  function mortOf(p){var v=sv(p,'mort');return v==null?"-":v;}
  function bankOf(p){var c=sv(p,'cash'),pv=sv(p,'propval');return c==null?"-":(c+(pv||0));}
  function nameOf(i){ return (window.KV_NAMES[i]&&window.KV_NAMES[i].n)||("Block "+i); }
  var TIDS = Object.keys(window.KV_NAMES).map(Number);

  function start(){try{window.KV_MUSIC.play();}catch(e){}document.removeEventListener("pointerdown",start);document.removeEventListener("keydown",start);}
  document.addEventListener("pointerdown",start); document.addEventListener("keydown",start);
  var mb=el("button","position:fixed;right:8px;bottom:8px;z-index:60;width:30px;height:30px;border-radius:15px;background:rgba(20,16,12,.85);color:#f4e4c1;border:1px solid #5a4a3a;font-size:14px;cursor:pointer;");
  mb.textContent="\\u266A";
  mb.onclick=function(e){e.stopPropagation();if(window.KV_MUSIC.paused){window.KV_MUSIC.play();mb.style.opacity=1;}else{window.KV_MUSIC.pause();mb.style.opacity=.45;}};

  var clock=el("div","position:fixed;left:50%;top:60px;transform:translateX(-50%);z-index:59;font:900 30px/1 Impact,'Arial Black',sans-serif;color:#f8f0d8;text-shadow:2px 2px 0 #241c12;pointer-events:none;");
  var t0=null,TOTAL=600;
  setInterval(function(){
    if(t0===null){clock.textContent="10:00";return;}
    var l=Math.max(0,TOTAL-Math.floor((Date.now()-t0)/1000));
    clock.textContent=Math.floor(l/60)+":"+String(l%60).padStart(2,"0");
    clock.style.color=l<=30?"#ff6a4a":"#f8f0d8";
  },250);

  // ---- panel: standings + readable feed ----
  var panel=el("div","position:fixed;right:6px;top:50%;transform:translateY(-50%);z-index:57;width:228px;font:12px/1.5 monospace;color:#f4e4c1;");
  var head=el("div","background:rgba(20,16,12,.92);border:1px solid #5a4a3a;border-radius:4px 4px 0 0;padding:4px 8px;cursor:pointer;letter-spacing:1px;display:flex;justify-content:space-between;",panel);
  head.innerHTML="<b>GAME LOG</b><span>&#9660;</span>";
  var body=el("div","background:rgba(20,16,12,.88);border:1px solid #5a4a3a;border-top:0;border-radius:0 0 4px 4px;padding:6px 8px;",panel);
  var tally=el("div","margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #3a3228;",body);
  var feed=el("div","max-height:210px;overflow:hidden;display:flex;flex-direction:column-reverse;gap:3px;",body);
  var open=true;
  head.onclick=function(){open=!open;body.style.display=open?"block":"none";head.lastChild.innerHTML=open?"&#9660;":"&#9654;";};
  function log(txt,col){
    if(t0===null)t0=Date.now();
    var r=el("div","border-left:3px solid "+(col||"#8a7a5a")+";padding:2px 7px;transition:opacity 1.5s;",feed);
    r.textContent=txt;
    while(feed.children.length>9)feed.removeChild(feed.firstChild);
    setTimeout(function(){r.style.opacity=.55;},16000);
  }
  window.KV_LOG=log;

  setInterval(function(){
    for(var p=1;p<=4;p++){
      var c=document.getElementById("kvc"+p),b=document.getElementById("kvb"+p),m=document.getElementById("kvm"+p);
      if(c)c.textContent=cashOf(p); if(b)b.textContent=bankOf(p); if(m)m.textContent=mortOf(p);
    }
    var rows=[];
    for(var q=1;q<=4;q++){var bv=bankOf(q);rows.push({p:q,nw:bv==="-"?0:bv});}
    rows.sort(function(a,b){return b.nw-a.nw;});
    var h="";
    rows.forEach(function(r,i){h+="<span style='color:"+COL[r.p]+"'>&#9632;</span>"+(i+1)+". P"+r.p+" <b>"+bankOf(r.p)+"</b> <span style='opacity:.6'>$"+cashOf(r.p)+"</span><br>";});
    tally.innerHTML=h;
  },400);

  var prev={},lastTile=-1;
  setInterval(function(){
    for(var p=1;p<=4;p++){
      var c=sv(p,'cash'); if(c==null)continue;
      if(prev[p]!=null&&c!==prev[p]){var d=c-prev[p];log("P"+p+(d>0?"  received  "+d:"  paid  "+(-d)),COL[p]);}
      prev[p]=c;
    }
    var f=F(),seat=f.evseat,tile=f.evtile;
    if(tile!=null&&tile>=0&&tile!==lastTile&&seat>=1){lastTile=tile;log("P"+seat+"  bought  "+nameOf(tile),COL[seat]);}
  },250);

  // ---- square name plates + owner highlight + click stats ----
  var pop=el("div","position:fixed;z-index:61;display:none;background:rgba(20,16,12,.96);border:1px solid #caa64c;border-radius:6px;padding:9px 13px;font:12px/1.7 monospace;color:#f4e4c1;box-shadow:0 4px 16px rgba(0,0,0,.6);min-width:165px;");
  document.addEventListener("pointerdown",function(e){if(!pop.contains(e.target))pop.style.display="none";},true);

  var lab={}, spot={};
  TIDS.forEach(function(i){
    var L=el("div","position:fixed;z-index:56;transform:translate(-50%,-50%);pointer-events:none;font:700 9px/1.1 monospace;color:#f8f0d8;text-shadow:1px 1px 0 #241c12;text-align:center;width:74px;white-space:normal;");
    L.textContent=nameOf(i);
    lab[i]=L;
    var h=el("div","position:fixed;z-index:56;width:48px;height:48px;margin:-24px 0 0 -24px;cursor:pointer;border-radius:6px;border:2px solid transparent;box-sizing:border-box;");
    h.onmouseenter=function(){h.style.background="rgba(255,242,160,.16)";};
    h.onmouseleave=function(){h.style.background="transparent";};
    h.onclick=function(ev){
      ev.stopPropagation();
      var f=F(),age=f["age_t"+i],tax=f["tax_t"+i],hz=f["hz_t"+i];
      var own=window.KV_OWNER?window.KV_OWNER(i):null;
      var d=window.KV_NAMES[i]||{};
      pop.innerHTML="<b style='color:#f0c860'>"+nameOf(i)+"</b><br>"+
        "PRICE <b>"+(d.p!=null?d.p:"?")+"</b><br>"+
        "OWNER <b style='color:"+(own?COL[own]:"#9a9a9a")+"'>"+(own?("P"+own):"unowned")+"</b><br>"+
        "AGE <b>"+(age!=null?Math.round(age)+" yrs":"?")+"</b><br>"+
        "TAX <b>"+(tax!=null?Math.round(tax):"?")+"</b><br>"+
        "HAZARD <b style='color:"+(hz>=28?"#ff6a4a":"#9cd87c")+"'>"+(hz!=null?Math.round(hz)+"%":"?")+"</b>";
      pop.style.display="block";
      pop.style.left=Math.min(window.innerWidth-200,ev.clientX+12)+"px";
      pop.style.top=Math.min(window.innerHeight-170,ev.clientY+12)+"px";
    };
    spot[i]=h;
  });

  setInterval(function(){
    if(!window.KV_PROJECT||!window.KV_NODE)return;
    var cv=document.querySelector("canvas"); if(!cv)return;
    var r=cv.getBoundingClientRect(), sx=r.width/cv.width, sy=r.height/cv.height;
    TIDS.forEach(function(i){
      var n=window.KV_NODE("tile_"+i);
      if(!n||!n.worldPos){lab[i].style.display="none";spot[i].style.display="none";return;}
      var p=window.KV_PROJECT(n.worldPos);
      if(!p){lab[i].style.display="none";spot[i].style.display="none";return;}
      var x=r.left+p.x*sx, y=r.top+p.y*sy;
      lab[i].style.display="block"; lab[i].style.left=x+"px"; lab[i].style.top=(y-2)+"px";
      spot[i].style.display="block"; spot[i].style.left=x+"px"; spot[i].style.top=y+"px";
      var own=window.KV_OWNER?window.KV_OWNER(i):null;
      spot[i].style.borderColor = own ? COL[own] : "transparent";
      spot[i].style.boxShadow = own ? ("0 0 10px "+COL[own]) : "none";
      lab[i].style.color = own ? COL[own] : "#f8f0d8";
    });
  },200);
})();
`;

const src25 = fs.readFileSync('showcase_kascity25.html', 'utf8');
const cs = src25.indexOf('// ---- injected kascity v25 showcase ----');
const ce = src25.indexOf('try { loadScene(');
if (cs < 0 || ce <= cs) die('corner-card block not found');

fs.writeFileSync('showcase_kascity42.html', engine.replace('</script>', [
  '', uiJs,
  src25.slice(cs, ce).replace('v25 showcase', 'v42 showcase'),
  'try { loadScene(' + JSON.stringify(v42str) + '); }',
  "catch (e) { console.error('kascity42 boot: ' + (e && e.message)); }", ''
].join('\n') + '\n</script>'));

console.log('PASS auto-roll fix: roll prompt now guarded with seat() == 1 (' + fixN + ' branch)');
console.log('PASS owner plates widened (' + plateN + ') + on-screen colour ring per owner');
console.log('PASS ' + Object.keys(names).length + ' square names on board + in log/popups');
console.log('PASS nodes ' + total + '/512');
console.log('OK kascity_v42.json + showcase_kascity42.html (' + (fs.statSync('showcase_kascity42.html').size/1024/1024).toFixed(1) + ' MB)');
