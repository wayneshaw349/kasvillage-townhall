// kascity_visual_v41.cjs
// Reads kascity_v40.json + scene_engine.html + audio -> kascity_v41.json + showcase_kascity41.html
// FIX "too many nodes: 515": the hidden bind Labels I added (66 tile-stat + 8 cash/mort + 2 event)
// pushed the scene past the 512 cap. All of them are removed; instead the engine now exposes
// window.KV_FLAGS() and window.KV_SEAT(p,'stat') so the UI reads state directly — zero extra nodes.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
const need = ['kascity_v40.json','scene_engine.html','showcase_kascity25.html','kv_music_loop.mp3',
              'sfx_ching.mp3','sfx_boo.mp3','sfx_gavel.mp3','sfx_dang.mp3','sfx_fireworks.mp3'];
for (const f of need) if (!fs.existsSync(f)) die(f + ' missing');
let engine = fs.readFileSync('scene_engine.html', 'utf8');
const j = JSON.parse(fs.readFileSync('kascity_v40.json', 'utf8'));
const byId = id => j.nodes.find(n => n.id === id);

// ---------- strip the hidden helper labels ----------
const hud = byId('hud') || die('hud missing');
const before = hud.children.length;
hud.children = hud.children.filter(c => !/^(ga|gt|gh)\d+$/.test(c.id || '')
                                     && !/^(fc|fm)[1-4]$/.test(c.id || '')
                                     && c.id !== 'ev_seat' && c.id !== 'ev_tile'
                                     && !/^(c|cr|bk)[1-4]$/.test(c.id || '')
                                     && !/^(crl|bkl)[1-4]$/.test(c.id || ''));
const removed = before - hud.children.length;
if (removed < 60) die('helper labels removed ' + removed + ' (<60)');

function countAll(list) { let c = 0; for (const n of list) { c++; if (n.children) c += countAll(n.children); } return c; }
const total = countAll(j.nodes);
if (total > 512) die('still over cap: ' + total);

const v41str = JSON.stringify(j);
fs.writeFileSync('kascity_v41.json', v41str);

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
window.KV_TILES = ${JSON.stringify(propTiles)};

(function () {
  var COL = {1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};
  function el(t,css,par){var e=document.createElement(t);e.style.cssText=css;(par||document.body).appendChild(e);return e;}
  function F(){ return (window.KV_FLAGS && window.KV_FLAGS()) || {}; }
  function seatv(p,k){ var v = window.KV_SEAT ? window.KV_SEAT(p,k) : null; return v==null?null:Math.round(v); }
  function cashOf(p){ var v=seatv(p,'cash'); return v==null?"-":v; }
  function mortOf(p){ var v=seatv(p,'mort'); return v==null?"-":v; }
  function bankOf(p){ var c=seatv(p,'cash'), pv=seatv(p,'propval'); return (c==null)?"-":(c+(pv||0)); }

  function start(){ try{window.KV_MUSIC.play();}catch(e){} document.removeEventListener("pointerdown",start); document.removeEventListener("keydown",start); }
  document.addEventListener("pointerdown", start); document.addEventListener("keydown", start);
  var mb=el("button","position:fixed;right:8px;bottom:8px;z-index:60;width:30px;height:30px;border-radius:15px;background:rgba(20,16,12,.85);color:#f4e4c1;border:1px solid #5a4a3a;font-size:14px;cursor:pointer;");
  mb.textContent="\\u266A";
  mb.onclick=function(e){e.stopPropagation(); if(window.KV_MUSIC.paused){window.KV_MUSIC.play();mb.style.opacity=1;}else{window.KV_MUSIC.pause();mb.style.opacity=.45;}};

  var clock=el("div","position:fixed;left:50%;top:60px;transform:translateX(-50%);z-index:59;font:900 30px/1 Impact,'Arial Black',sans-serif;color:#f8f0d8;text-shadow:2px 2px 0 #241c12;pointer-events:none;");
  var t0=null, TOTAL=600;
  setInterval(function(){
    if(t0===null){clock.textContent="10:00";return;}
    var left=Math.max(0,TOTAL-Math.floor((Date.now()-t0)/1000));
    clock.textContent=Math.floor(left/60)+":"+String(left%60).padStart(2,"0");
    clock.style.color=left<=30?"#ff6a4a":"#f8f0d8";
  },250);

  var panel=el("div","position:fixed;right:6px;top:50%;transform:translateY(-50%);z-index:57;width:190px;font:10px/1.45 monospace;color:#f4e4c1;");
  var head=el("div","background:rgba(20,16,12,.9);border:1px solid #5a4a3a;border-radius:4px 4px 0 0;padding:3px 7px;cursor:pointer;letter-spacing:1px;display:flex;justify-content:space-between;",panel);
  head.innerHTML="<b>GAME LOG</b><span>&#9660;</span>";
  var body=el("div","background:rgba(20,16,12,.86);border:1px solid #5a4a3a;border-top:0;border-radius:0 0 4px 4px;padding:5px 7px;",panel);
  var tally=el("div","margin-bottom:5px;padding-bottom:5px;border-bottom:1px solid #3a3228;",body);
  var feed=el("div","max-height:150px;overflow:hidden;display:flex;flex-direction:column-reverse;gap:2px;",body);
  var open=true;
  head.onclick=function(){open=!open;body.style.display=open?"block":"none";head.lastChild.innerHTML=open?"&#9660;":"&#9654;";};
  function log(txt,col){
    if(t0===null)t0=Date.now();
    var r=el("div","border-left:2px solid "+(col||"#8a7a5a")+";padding:1px 6px;transition:opacity 1s;",feed);
    r.textContent=txt;
    while(feed.children.length>10)feed.removeChild(feed.firstChild);
    setTimeout(function(){r.style.opacity=.5;},9000);
  }
  window.KV_LOG=log;

  // corner card values
  setInterval(function(){
    for(var p=1;p<=4;p++){
      var c=document.getElementById("kvc"+p), b=document.getElementById("kvb"+p), m=document.getElementById("kvm"+p);
      if(c)c.textContent=cashOf(p);
      if(b)b.textContent=bankOf(p);
      if(m)m.textContent=mortOf(p);
    }
    var rows=[];
    for(var q=1;q<=4;q++){var bv=bankOf(q);rows.push({p:q,nw:(bv==="-"?0:bv)});}
    rows.sort(function(a,b){return b.nw-a.nw;});
    var h="";
    rows.forEach(function(r,i){
      h+="<span style='color:"+COL[r.p]+"'>&#9632;</span> "+(i+1)+". P"+r.p+" <b>"+bankOf(r.p)+"</b> <span style='opacity:.65'>$"+cashOf(r.p)+" m"+mortOf(r.p)+"</span><br>";
    });
    tally.innerHTML=h;
  },400);

  var prev={}, lastTile=-1;
  setInterval(function(){
    for(var p=1;p<=4;p++){
      var c=seatv(p,'cash'); if(c==null)continue;
      if(prev[p]!=null&&c!==prev[p]){var d=c-prev[p];log("P"+p+(d>0?" +":" -")+Math.abs(d),COL[p]);}
      prev[p]=c;
    }
    var f=F(), seat=f.evseat, tile=f.evtile;
    if(tile!=null&&tile>=0&&tile!==lastTile&&seat>=1){lastTile=tile;log("P"+seat+" BOUGHT block "+tile,COL[seat]);}
  },250);

  var pop=el("div","position:fixed;z-index:61;display:none;background:rgba(20,16,12,.95);border:1px solid #caa64c;border-radius:6px;padding:8px 12px;font:11px/1.6 monospace;color:#f4e4c1;box-shadow:0 4px 16px rgba(0,0,0,.6);min-width:145px;");
  document.addEventListener("pointerdown",function(e){if(!pop.contains(e.target))pop.style.display="none";},true);
  var spots={};
  window.KV_TILES.forEach(function(i){
    var h=el("div","position:fixed;z-index:56;width:50px;height:50px;margin:-25px 0 0 -25px;cursor:pointer;border-radius:6px;");
    h.onmouseenter=function(){h.style.background="rgba(255,242,160,.16)";};
    h.onmouseleave=function(){h.style.background="transparent";};
    h.onclick=function(ev){
      ev.stopPropagation();
      var f=F(), age=f["age_t"+i], tax=f["tax_t"+i], hz=f["hz_t"+i];
      pop.innerHTML="<b style='color:#f0c860'>BLOCK "+i+"</b><br>AGE <b>"+(age!=null?Math.round(age)+" yrs":"?")+"</b><br>TAX <b>"+(tax!=null?Math.round(tax):"?")+"</b><br>HAZARD <b style='color:"+(hz>=28?"#ff6a4a":"#9cd87c")+"'>"+(hz!=null?Math.round(hz)+"%":"?")+"</b><br><span style='opacity:.65'>"+(hz>=28?"high risk":"low risk")+"</span>";
      pop.style.display="block";
      pop.style.left=Math.min(window.innerWidth-190,ev.clientX+12)+"px";
      pop.style.top=Math.min(window.innerHeight-140,ev.clientY+12)+"px";
    };
    spots[i]=h;
  });
  setInterval(function(){
    if(!window.KV_PROJECT||!window.KV_NODE)return;
    var cv=document.querySelector("canvas"); if(!cv)return;
    var r=cv.getBoundingClientRect();
    window.KV_TILES.forEach(function(i){
      var n=window.KV_NODE("tile_"+i),h=spots[i];
      if(!n||!n.worldPos){h.style.display="none";return;}
      var p=window.KV_PROJECT(n.worldPos);
      if(!p){h.style.display="none";return;}
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

fs.writeFileSync('showcase_kascity41.html', engine.replace('</script>', [
  '', uiJs,
  src25.slice(cs, ce).replace('v25 showcase', 'v41 showcase'),
  'try { loadScene(' + JSON.stringify(v41str) + '); }',
  "catch (e) { console.error('kascity41 boot: ' + (e && e.message)); }", ''
].join('\n') + '\n</script>'));

console.log('PASS ' + removed + ' hidden helper labels removed');
console.log('PASS node count ' + total + '/512');
console.log('PASS engine exposes KV_FLAGS / KV_SEAT — UI reads state with zero extra nodes');
console.log('OK kascity_v41.json + showcase_kascity41.html (' + (fs.statSync('showcase_kascity41.html').size/1024/1024).toFixed(1) + ' MB)');
