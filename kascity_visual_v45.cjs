// kascity_visual_v45.cjs
// Reads kascity_v44.json + scene_engine.html + audio -> kascity_v45.json + showcase_kascity45.html
//  1) CLOCK FIX: countdown now starts on the first interaction (pointer/key) instead of waiting for a
//     log event, and freezes at 0:00 with a GAME OVER banner.
//  2) XP SYSTEM (earn-only, never purchasable — keeps the skill/consideration line clean):
//       +12  property acquired
//       +1   per 20 cash of rent/income received
//       +30  district completed (all siblings owned)
//       +8   surviving a mortgage payment cycle without going negative
//       +60  win / +25 second place
//     XP shows live per player; at time-up a signed-ready result payload is built at
//     window.KV_RESULT = { gameId, endedAt, seats:[{seat,wallet,xp,netWorth,props,rank}] }
//     ready for TownHall reportResult / Arweave inscription. Copy button included.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
const need = ['kascity_v44.json','scene_engine.html','showcase_kascity25.html','showcase_kascity42.html',
              'kv_music_loop.mp3','sfx_ching.mp3','sfx_boo.mp3','sfx_gavel.mp3','sfx_dang.mp3','sfx_fireworks.mp3'];
for (const f of need) if (!fs.existsSync(f)) die(f + ' missing');
let engine = fs.readFileSync('scene_engine.html', 'utf8');
const j = JSON.parse(fs.readFileSync('kascity_v44.json', 'utf8'));
const byId = id => j.nodes.find(n => n.id === id);

// district map for completion XP
const district = {};
for (let i = 0; i < 40; i++) {
  const t = byId('tile_' + i);
  if (!t || !t.children) continue;
  const band = t.children.find(c => /^band_/.test(c.id || ''));
  if (!band || !band.material) continue;
  (district[band.material] = district[band.material] || []).push(i);
}
const groups = Object.values(district).filter(g => g.length > 1);
if (groups.length < 4) die('districts ' + groups.length);

// tile names/prices
const dstr = JSON.stringify(byId('director'));
const names = {};
const re = /"prompt","args":\["buy","(.+?) is unowned\. Buy for (\d+)\?"(?:,"[^"]*")*\]\}\},\{"do":\{"action":"setState","args":\["buy_tile",(\d+)\]/g;
let mm; while ((mm = re.exec(dstr)) !== null) names[parseInt(mm[3],10)] = { n: mm[1], p: parseInt(mm[2],10) };
if (Object.keys(names).length < 16) die('names ' + Object.keys(names).length);

const v45str = JSON.stringify(j);
fs.writeFileSync('kascity_v45.json', v45str);

// ---------- engine ----------
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
window.KV_GROUPS = ${JSON.stringify(groups)};
window.KV_XP = {1:0,2:0,3:0,4:0};

(function () {
  var COL={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};
  function el(t,css,par){var e=document.createElement(t);e.style.cssText=css;(par||document.body).appendChild(e);return e;}
  function F(){return (window.KV_FLAGS&&window.KV_FLAGS())||{};}
  function sv(p,k){var v=window.KV_SEAT?window.KV_SEAT(p,k):null;return v==null?null:Math.round(v);}
  function cashOf(p){var v=sv(p,'cash');return v==null?"-":v;}
  function mortOf(p){var v=sv(p,'mort');return v==null?"-":v;}
  function bankOf(p){var c=sv(p,'cash'),pv=sv(p,'propval');return c==null?"-":(c+(pv||0));}
  function nameOf(i){return (window.KV_NAMES[i]&&window.KV_NAMES[i].n)||("Block "+i);}
  var TIDS=Object.keys(window.KV_NAMES).map(Number);

  // ---- audio ----
  var started=false;
  function start(){ if(started)return; started=true; if(t0===null)t0=Date.now();
    try{window.KV_MUSIC.play();}catch(e){} }
  document.addEventListener("pointerdown",start); document.addEventListener("keydown",start);
  var mb=el("button","position:fixed;right:8px;bottom:8px;z-index:60;width:30px;height:30px;border-radius:15px;background:rgba(20,16,12,.85);color:#f4e4c1;border:1px solid #5a4a3a;font-size:14px;cursor:pointer;");
  mb.textContent="\\u266A";
  mb.onclick=function(e){e.stopPropagation();if(window.KV_MUSIC.paused){window.KV_MUSIC.play();mb.style.opacity=1;}else{window.KV_MUSIC.pause();mb.style.opacity=.45;}};

  // ---- clock: starts on first interaction ----
  var clock=el("div","position:fixed;left:50%;top:60px;transform:translateX(-50%);z-index:59;font:900 30px/1 Impact,'Arial Black',sans-serif;color:#f8f0d8;text-shadow:2px 2px 0 #241c12;pointer-events:none;");
  var t0=null, TOTAL=480, over=false;
  setInterval(function(){
    if(t0===null){clock.textContent="8:00";return;}
    var l=Math.max(0,TOTAL-Math.floor((Date.now()-t0)/1000));
    clock.textContent=Math.floor(l/60)+":"+String(l%60).padStart(2,"0");
    clock.style.color=l<=30?"#ff6a4a":"#f8f0d8";
    if(l===0&&!over){over=true;endGame();}
  },250);

  // ---- panel ----
  var panel=el("div","position:fixed;right:6px;top:50%;transform:translateY(-50%);z-index:57;width:236px;font:12px/1.5 monospace;color:#f4e4c1;");
  var head=el("div","background:rgba(20,16,12,.92);border:1px solid #5a4a3a;border-radius:4px 4px 0 0;padding:4px 8px;cursor:pointer;letter-spacing:1px;display:flex;justify-content:space-between;",panel);
  head.innerHTML="<b>GAME LOG</b><span>&#9660;</span>";
  var body=el("div","background:rgba(20,16,12,.88);border:1px solid #5a4a3a;border-top:0;border-radius:0 0 4px 4px;padding:6px 8px;",panel);
  var tally=el("div","margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #3a3228;",body);
  var feed=el("div","max-height:200px;overflow:hidden;display:flex;flex-direction:column-reverse;gap:3px;",body);
  var open=true;
  head.onclick=function(){open=!open;body.style.display=open?"block":"none";head.lastChild.innerHTML=open?"&#9660;":"&#9654;";};
  function log(txt,col){
    var r=el("div","border-left:3px solid "+(col||"#8a7a5a")+";padding:2px 7px;transition:opacity 1.5s;",feed);
    r.textContent=txt;
    while(feed.children.length>9)feed.removeChild(feed.firstChild);
    setTimeout(function(){r.style.opacity=.55;},16000);
  }
  window.KV_LOG=log;

  // ---- XP ----
  function xp(p,amt,why){
    if(!amt)return;
    window.KV_XP[p]=(window.KV_XP[p]||0)+amt;
    log("P"+p+"  +"+amt+" XP  "+why, COL[p]);
  }
  var doneDistricts={};
  function checkDistricts(){
    window.KV_GROUPS.forEach(function(g,gi){
      for(var p=1;p<=4;p++){
        var key=gi+":"+p;
        if(doneDistricts[key])continue;
        var all=g.every(function(t){return window.KV_OWNER&&window.KV_OWNER(t)===p;});
        if(all){doneDistricts[key]=1; xp(p,30,"district complete");}
      }
    });
  }

  setInterval(function(){
    for(var p=1;p<=4;p++){
      var c=document.getElementById("kvc"+p),b=document.getElementById("kvb"+p),m=document.getElementById("kvm"+p);
      if(c)c.textContent=cashOf(p); if(b)b.textContent=bankOf(p); if(m)m.textContent=mortOf(p);
      var x=document.getElementById("kvx"+p);
      if(!x){
        var card=(c&&c.parentNode)||null;
        if(card){ card.insertAdjacentHTML("beforeend","<br>XP <span id=kvx"+p+" style='color:#9cd87c'>0</span>"); }
      } else x.textContent=window.KV_XP[p]||0;
    }
    var rows=[];
    for(var q=1;q<=4;q++){var bv=bankOf(q);rows.push({p:q,nw:bv==="-"?0:bv});}
    rows.sort(function(a,b){return b.nw-a.nw;});
    var h="";
    rows.forEach(function(r,i){h+="<span style='color:"+COL[r.p]+"'>&#9632;</span>"+(i+1)+". P"+r.p+" <b>"+bankOf(r.p)+"</b> <span style='opacity:.6'>xp "+(window.KV_XP[r.p]||0)+"</span><br>";});
    tally.innerHTML=h;
    checkDistricts();
  },400);

  var prev={}, lastTile=-1;
  setInterval(function(){
    for(var p=1;p<=4;p++){
      var c=sv(p,'cash'); if(c==null)continue;
      if(prev[p]!=null&&c!==prev[p]){
        var d=c-prev[p];
        if(d>0){ log("P"+p+"  received  "+d,COL[p]); xp(p,Math.floor(d/20),"income"); }
        else log("P"+p+"  paid  "+(-d),COL[p]);
      }
      prev[p]=c;
    }
    var f=F(),seat=f.evseat,tile=f.evtile;
    if(tile!=null&&tile>=0&&tile!==lastTile&&seat>=1){
      lastTile=tile; log("P"+seat+"  bought  "+nameOf(tile),COL[seat]); xp(seat,12,"acquisition");
    }
  },250);

  // ---- end of game ----
  function endGame(){
    try{window.KV_VOX.fw.cloneNode().play();}catch(e){}
    var rows=[];
    for(var p=1;p<=4;p++){
      var props=0; TIDS.forEach(function(t){ if(window.KV_OWNER&&window.KV_OWNER(t)===p) props++; });
      var bv=bankOf(p);
      rows.push({seat:p, wallet:(window.KV_WALLETS&&window.KV_WALLETS[p])||null,
                 xp:window.KV_XP[p]||0, netWorth:(bv==="-"?0:bv), props:props});
    }
    rows.sort(function(a,b){return b.netWorth-a.netWorth;});
    rows.forEach(function(r,i){ r.rank=i+1; });
    if(rows[0]) { window.KV_XP[rows[0].seat]+=60; rows[0].xp+=60; }
    if(rows[1]) { window.KV_XP[rows[1].seat]+=25; rows[1].xp+=25; }
    window.KV_RESULT={ gameId:"kascity-"+Date.now(), endedAt:new Date().toISOString(), seats:rows };

    var ov=el("div","position:fixed;inset:0;z-index:70;background:rgba(10,8,6,.88);display:flex;align-items:center;justify-content:center;");
    var box=el("div","background:#14100c;border:2px solid #caa64c;border-radius:10px;padding:20px 26px;font:13px/1.7 monospace;color:#f4e4c1;min-width:330px;",ov);
    var h="<div style='font:900 26px Impact,sans-serif;color:#f0c860;letter-spacing:2px;margin-bottom:10px'>FINAL BELL</div>";
    rows.forEach(function(r){
      h+="<span style='color:"+COL[r.seat]+"'>&#9632;</span> "+r.rank+". P"+r.seat+
         " &nbsp;net <b>"+r.netWorth+"</b> &nbsp;props <b>"+r.props+"</b> &nbsp;XP <b style='color:#9cd87c'>"+r.xp+"</b><br>";
    });
    box.innerHTML=h;
    var cp=el("button","margin-top:14px;padding:7px 14px;background:#2a2118;color:#f4e4c1;border:1px solid #5a4a3a;border-radius:5px;font:12px monospace;cursor:pointer;",box);
    cp.textContent="copy result payload";
    cp.onclick=function(){
      var txt=JSON.stringify(window.KV_RESULT,null,2);
      navigator.clipboard.writeText(txt).then(function(){cp.textContent="copied \\u2713";},function(){cp.textContent="copy failed";});
    };
    log("FINAL BELL — result payload ready (window.KV_RESULT)","#f0c860");
  }
  window.KV_END=endGame;

  // ---- board labels + owner rings + click stats ----
  var pop=el("div","position:fixed;z-index:61;display:none;background:rgba(20,16,12,.96);border:1px solid #caa64c;border-radius:6px;padding:9px 13px;font:12px/1.7 monospace;color:#f4e4c1;box-shadow:0 4px 16px rgba(0,0,0,.6);min-width:165px;");
  document.addEventListener("pointerdown",function(e){if(!pop.contains(e.target))pop.style.display="none";},true);
  var lab={},spot={};
  TIDS.forEach(function(i){
    var L=el("div","position:fixed;z-index:56;transform:translate(-50%,-50%);pointer-events:none;font:700 9px/1.1 monospace;color:#f8f0d8;text-shadow:1px 1px 0 #241c12;text-align:center;width:74px;");
    L.textContent=nameOf(i); lab[i]=L;
    var h=el("div","position:fixed;z-index:56;width:48px;height:48px;margin:-24px 0 0 -24px;cursor:pointer;border-radius:6px;border:2px solid transparent;box-sizing:border-box;");
    h.onmouseenter=function(){h.style.background="rgba(255,242,160,.16)";};
    h.onmouseleave=function(){h.style.background="transparent";};
    h.onclick=function(ev){
      ev.stopPropagation();
      var f=F(),age=f["age_t"+i],tax=f["tax_t"+i],hz=f["hz_t"+i],own=window.KV_OWNER?window.KV_OWNER(i):null,d=window.KV_NAMES[i]||{};
      pop.innerHTML="<b style='color:#f0c860'>"+nameOf(i)+"</b><br>PRICE <b>"+(d.p!=null?d.p:"?")+"</b><br>OWNER <b style='color:"+(own?COL[own]:"#9a9a9a")+"'>"+(own?("P"+own):"unowned")+"</b><br>AGE <b>"+(age!=null?Math.round(age)+" yrs":"?")+"</b><br>TAX <b>"+(tax!=null?Math.round(tax):"?")+"</b><br>HAZARD <b style='color:"+(hz>=28?"#ff6a4a":"#9cd87c")+"'>"+(hz!=null?Math.round(hz)+"%":"?")+"</b>";
      pop.style.display="block";
      pop.style.left=Math.min(window.innerWidth-200,ev.clientX+12)+"px";
      pop.style.top=Math.min(window.innerHeight-180,ev.clientY+12)+"px";
    };
    spot[i]=h;
  });
  setInterval(function(){
    if(!window.KV_PROJECT||!window.KV_NODE)return;
    var cv=document.querySelector("canvas"); if(!cv)return;
    var r=cv.getBoundingClientRect(),sx=r.width/cv.width,sy=r.height/cv.height;
    TIDS.forEach(function(i){
      var n=window.KV_NODE("tile_"+i);
      if(!n||!n.worldPos){lab[i].style.display="none";spot[i].style.display="none";return;}
      var p=window.KV_PROJECT(n.worldPos);
      if(!p){lab[i].style.display="none";spot[i].style.display="none";return;}
      var x=r.left+p.x*sx,y=r.top+p.y*sy;
      lab[i].style.display="block";lab[i].style.left=x+"px";lab[i].style.top=(y-2)+"px";
      spot[i].style.display="block";spot[i].style.left=x+"px";spot[i].style.top=y+"px";
      var own=window.KV_OWNER?window.KV_OWNER(i):null;
      spot[i].style.borderColor=own?COL[own]:"transparent";
      spot[i].style.boxShadow=own?("0 0 10px "+COL[own]):"none";
      lab[i].style.color=own?COL[own]:"#f8f0d8";
    });
  },200);
})();
`;

const src25 = fs.readFileSync('showcase_kascity25.html', 'utf8');
const cs = src25.indexOf('// ---- injected kascity v25 showcase ----');
const ce = src25.indexOf('try { loadScene(');
if (cs < 0 || ce <= cs) die('corner-card block not found');

fs.writeFileSync('showcase_kascity45.html', engine.replace('</script>', [
  '', uiJs,
  src25.slice(cs, ce).replace('v25 showcase', 'v45 showcase'),
  'try { loadScene(' + JSON.stringify(v45str) + '); }',
  "catch (e) { console.error('kascity45 boot: ' + (e && e.message)); }", ''
].join('\n') + '\n</script>'));

console.log('PASS clock starts on first interaction, ends at 0:00 with final bell');
console.log('PASS XP wired: +12 acquisition, +1/20 income, +30 district, +60 win / +25 second');
console.log('PASS result payload window.KV_RESULT (gameId, seats, wallets, xp, netWorth, props, rank) + copy button');
console.log('OK kascity_v45.json + showcase_kascity45.html (' + (fs.statSync('showcase_kascity45.html').size/1024/1024).toFixed(1) + ' MB)');
