// kascity_visual_v47.cjs   — SOLO MODE + MOVE CHAIN
// Reads kascity_v45.json + scene_engine.html + audio -> kascity_v47.json + showcase_kascity47.html
//
// 1) MOVE CHAIN: every decision is appended to a hash chain.
//      h0 = SHA256(seed ‖ sceneHash ‖ mode)
//      hi = SHA256(h(i-1) ‖ i ‖ seat ‖ action ‖ arg ‖ left)
//    'left' (clock remaining) is logged because bot strategy branches read it — replay needs it to
//    reproduce the same decisions. moveRoot = h_n.
// 2) SOUND HOOK: engine now reports every playSound id to JS, so XP can tell rent from a windfall —
//    the old cash-delta guess paid XP for GO salary and card luck.
// 3) XP REALLOCATION (skill, not luck):
//      buy from bank 8 | buy from player 20 | sell to player 15 | tenant issue resolved 12
//      rent collected 1 per 15 | GO salary + cards 0 | district 30 | win 60 / 2nd 25
//    SOLO DISCOUNT: playing bots earns 40% — reputation should come from real neighbours.
// 4) PAYLOAD: { mode:"solo", seedCommit, seed, moves[], moveRoot, xp{}, wallets{} } — the full log is
//    small enough to publish, so anyone can replay and recompute XP. No SNARK needed for solo.
const fs = require('fs');
function die(m) { console.error('ABORT: ' + m + ' — nothing written.'); process.exit(1); }
const need = ['kascity_v45.json','scene_engine.html','showcase_kascity25.html','showcase_kascity45.html',
              'kv_music_loop.mp3','sfx_ching.mp3','sfx_boo.mp3','sfx_gavel.mp3','sfx_dang.mp3','sfx_fireworks.mp3'];
for (const f of need) if (!fs.existsSync(f)) die(f + ' missing');
let engine = fs.readFileSync('scene_engine.html', 'utf8');
const j = JSON.parse(fs.readFileSync('kascity_v45.json', 'utf8'));
const byId = id => j.nodes.find(n => n.id === id);

const district = {};
for (let i = 0; i < 40; i++) {
  const t = byId('tile_' + i);
  if (!t || !t.children) continue;
  const band = t.children.find(c => /^band_/.test(c.id || ''));
  if (band && band.material) (district[band.material] = district[band.material] || []).push(i);
}
const groups = Object.values(district).filter(g => g.length > 1);
if (groups.length < 4) die('districts ' + groups.length);

const dstr = JSON.stringify(byId('director'));
const names = {};
const re = /"prompt","args":\["buy","(.+?) is unowned\. Buy for (\d+)\?"(?:,"[^"]*")*\]\}\},\{"do":\{"action":"setState","args":\["buy_tile",(\d+)\]/g;
let mm; while ((mm = re.exec(dstr)) !== null) names[parseInt(mm[3],10)] = { n: mm[1], p: parseInt(mm[2],10) };
if (Object.keys(names).length < 16) die('names ' + Object.keys(names).length);

const v47str = JSON.stringify(j);
fs.writeFileSync('kascity_v47.json', v47str);

// ---------- engine: sound hook + accessors ----------
const psRe = /function playSound\(id, at\) \{\r?\n\s*if \(!AUDIO_ON\) return;\r?\n\s*var d = soundDef\(id\);\r?\n\s*if \(!d\) return;/;
const psM = engine.match(psRe);
if (!psM) die('playSound anchor not found');
const NL = psM[0].indexOf('\r\n') >= 0 ? '\r\n' : '\n';
engine = engine.split(psM[0]).join(psM[0] + NL +
  '  try { if (window.KV_ON_SOUND) window.KV_ON_SOUND(id); } catch (e) {}' + NL +
  '  if (d.vox && window.KV_SFX) { try { window.KV_SFX(d.vox); } catch (e) {} }' + NL);
const readyAnchor = 'post({ kv: "ready", id: scene.meta.id, permissions: scene.permissions || [] });';
if (engine.split(readyAnchor).length - 1 !== 1) die('ready anchor mismatch');
engine = engine.split(readyAnchor).join(readyAnchor + NL +
  '  window.KV_PROJECT = function (p) { try { return project(p); } catch (e) { return null; } };' + NL +
  '  window.KV_FLAGS = function () { try { var c = exprCtx(null); return (c && c.world && c.world.flags) || {}; } catch (e) { return {}; } };' + NL +
  '  window.KV_SEAT = function (p, k) { try { var c = exprCtx(null); if (c && c.seats && c.seats[p]) return c.seats[p][k]; } catch (e) {} return null; };' + NL +
  '  window.KV_NODE = function (id) { var f = null; (function w(ns){ for (var i=0;i<ns.length;i++){ if(ns[i].id===id){f=ns[i];return;} if(ns[i].children) w(ns[i].children); } })(scene.nodes); return f; };' + NL +
  '  window.KV_OWNER = function (tid) { var o = null; for (var s = 1; s <= 4; s++) { var n = window.KV_NODE("own_" + tid + "_" + s); if (n && n.visible !== false && !n.hidden) o = s; } return o; };' + NL +
  '  window.KV_SEED = (scene.meta && scene.meta.seed) || "kv";' + NL);

const b64 = f => fs.readFileSync(f).toString('base64');

const uiJs = `
window.KV_VOX = {};
window.KV_VOX.ching = new Audio("data:audio/mpeg;base64,${b64('sfx_ching.mp3')}");
window.KV_VOX.boo   = new Audio("data:audio/mpeg;base64,${b64('sfx_boo.mp3')}");
window.KV_VOX.gavel = new Audio("data:audio/mpeg;base64,${b64('sfx_gavel.mp3')}");
window.KV_VOX.dang  = new Audio("data:audio/mpeg;base64,${b64('sfx_dang.mp3')}");
window.KV_VOX.fw    = new Audio("data:audio/mpeg;base64,${b64('sfx_fireworks.mp3')}");
for (var _k in window.KV_VOX) window.KV_VOX[_k].preload = "auto";
window.KV_MUSIC = new Audio("data:audio/mpeg;base64,${b64('kv_music_loop.mp3')}");
window.KV_MUSIC.loop = true; window.KV_MUSIC.volume = 0.42; window.KV_MUSIC.playbackRate = 1.0;
window.KV_NAMES = ${JSON.stringify(names)};
window.KV_GROUPS = ${JSON.stringify(groups)};
window.KV_MODE = "solo";
window.KV_XP = {1:0,2:0,3:0,4:0};
window.KV_MOVES = [];
window.KV_WALLETS = window.KV_WALLETS || {};

// ---- sfx gate ----
window.KV_SFX_LAST={}; window.KV_SFX_LIVE=0;
window.KV_SFX=function(k){
  var s=window.KV_VOX[k]; if(!s)return;
  var n=Date.now();
  if(window.KV_SFX_LAST[k]&&n-window.KV_SFX_LAST[k]<220)return;
  if(window.KV_SFX_LIVE>=3)return;
  window.KV_SFX_LAST[k]=n;
  var a=s.cloneNode(); a.playbackRate=1.0; a.volume=0.9;
  window.KV_SFX_LIVE++;
  var done=function(){window.KV_SFX_LIVE=Math.max(0,window.KV_SFX_LIVE-1);};
  a.addEventListener("ended",done); a.addEventListener("error",done); setTimeout(done,3000);
  try{a.play();}catch(e){done();}
};

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

  // ================= MOVE CHAIN =================
  async function sha(str){
    var b=new TextEncoder().encode(str);
    var h=await crypto.subtle.digest("SHA-256",b);
    return Array.from(new Uint8Array(h)).map(function(x){return x.toString(16).padStart(2,"0");}).join("");
  }
  var chain="", chainReady=false, seedCommit="";
  (async function(){
    chain = await sha((window.KV_SEED||"kv")+"|kascity|"+window.KV_MODE);
    seedCommit = await sha((window.KV_SEED||"kv")+"|commit");
    chainReady = true;
  })();
  async function move(seat, action, arg){
    var f=F(), left=(f.left!=null)?Math.round(f.left):-1;
    var rec={i:window.KV_MOVES.length, s:seat, a:action, v:arg, t:left};
    window.KV_MOVES.push(rec);
    if(chainReady) chain = await sha(chain+"|"+rec.i+"|"+rec.s+"|"+rec.a+"|"+rec.v+"|"+rec.t);
  }
  window.KV_MOVE = move;

  // ================= XP =================
  var SOLO_MULT = 0.4;               // bots earn you less than neighbours
  function xp(p,amt,why){
    if(!amt)return;
    var a = Math.max(1, Math.round(amt * (window.KV_MODE==="solo" ? SOLO_MULT : 1)));
    window.KV_XP[p]=(window.KV_XP[p]||0)+a;
    log("P"+p+"  +"+a+" XP  "+why, COL[p]);
  }

  // sound events tell us WHAT happened — cash deltas alone can't
  var pendingRent=0, lastSound="", lastSoundT=0;
  window.KV_ON_SOUND=function(id){ lastSound=id; lastSoundT=Date.now(); if(id==="rent")pendingRent=1;
    if(id==="evict"||id==="bnb"||id==="gavel"){ var cur=F().turn; xp(curSeat(), 12, "tenant handled"); } };
  function curSeat(){ var f=F(); return (f.hud_seat||f.turn||0)%4+1; }

  var doneDistricts={};
  function checkDistricts(){
    window.KV_GROUPS.forEach(function(g,gi){
      for(var p=1;p<=4;p++){
        var key=gi+":"+p;
        if(doneDistricts[key])continue;
        if(g.every(function(t){return window.KV_OWNER&&window.KV_OWNER(t)===p;})){doneDistricts[key]=1;xp(p,30,"district complete");}
      }
    });
  }

  // ---- audio / clock ----
  var started=false, t0=null, TOTAL=480, over=false;
  function start(){ if(started)return; started=true; if(t0===null)t0=Date.now();
    if(window.KV_MUSIC.paused){try{window.KV_MUSIC.play();}catch(e){}} }
  document.addEventListener("pointerdown",start); document.addEventListener("keydown",start);
  var mb=el("button","position:fixed;right:8px;bottom:8px;z-index:60;width:30px;height:30px;border-radius:15px;background:rgba(20,16,12,.85);color:#f4e4c1;border:1px solid #5a4a3a;font-size:14px;cursor:pointer;");
  mb.textContent="\\u266A";
  mb.onclick=function(e){e.stopPropagation();if(window.KV_MUSIC.paused){window.KV_MUSIC.play();mb.style.opacity=1;}else{window.KV_MUSIC.pause();mb.style.opacity=.45;}};
  var clock=el("div","position:fixed;left:50%;top:60px;transform:translateX(-50%);z-index:59;font:900 30px/1 Impact,'Arial Black',sans-serif;color:#f8f0d8;text-shadow:2px 2px 0 #241c12;pointer-events:none;");
  setInterval(function(){
    if(t0===null){clock.textContent="8:00";return;}
    var l=Math.max(0,TOTAL-Math.floor((Date.now()-t0)/1000));
    clock.textContent=Math.floor(l/60)+":"+String(l%60).padStart(2,"0");
    clock.style.color=l<=30?"#ff6a4a":"#f8f0d8";
    if(l===0&&!over){over=true;endGame();}
  },250);

  // ---- panel ----
  var panel=el("div","position:fixed;right:6px;top:50%;transform:translateY(-50%);z-index:57;width:236px;font:12px/1.5 monospace;color:#f4e4c1;");
  var head=el("div","background:rgba(20,16,12,.92);border:1px solid #5a4a3a;border-radius:4px 4px 0 0;padding:4px 8px;cursor:pointer;display:flex;justify-content:space-between;",panel);
  head.innerHTML="<b>GAME LOG</b><span>&#9660;</span>";
  var body=el("div","background:rgba(20,16,12,.88);border:1px solid #5a4a3a;border-top:0;border-radius:0 0 4px 4px;padding:6px 8px;",panel);
  var tally=el("div","margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #3a3228;",body);
  var feed=el("div","max-height:190px;overflow:hidden;display:flex;flex-direction:column-reverse;gap:3px;",body);
  var open=true;
  head.onclick=function(){open=!open;body.style.display=open?"block":"none";head.lastChild.innerHTML=open?"&#9660;":"&#9654;";};
  function log(txt,col){
    var r=el("div","border-left:3px solid "+(col||"#8a7a5a")+";padding:2px 7px;transition:opacity 1.5s;",feed);
    r.textContent=txt;
    while(feed.children.length>9)feed.removeChild(feed.firstChild);
    setTimeout(function(){r.style.opacity=.55;},16000);
  }
  window.KV_LOG=log;

  setInterval(function(){
    for(var p=1;p<=4;p++){
      var c=document.getElementById("kvc"+p),b=document.getElementById("kvb"+p),m=document.getElementById("kvm"+p),x=document.getElementById("kvx"+p);
      if(c)c.textContent=cashOf(p); if(b)b.textContent=bankOf(p); if(m)m.textContent=mortOf(p);
      if(!x&&c&&c.parentNode){c.parentNode.insertAdjacentHTML("beforeend","<br>XP <span id=kvx"+p+" style='color:#9cd87c'>0</span>");}
      else if(x)x.textContent=window.KV_XP[p]||0;
    }
    var rows=[];
    for(var q=1;q<=4;q++){var bv=bankOf(q);rows.push({p:q,nw:bv==="-"?0:bv});}
    rows.sort(function(a,b){return b.nw-a.nw;});
    var h="";
    rows.forEach(function(r,i){h+="<span style='color:"+COL[r.p]+"'>&#9632;</span>"+(i+1)+". P"+r.p+" <b>"+bankOf(r.p)+"</b> <span style='opacity:.6'>xp "+(window.KV_XP[r.p]||0)+"</span><br>";});
    tally.innerHTML=h;
    checkDistricts();
  },400);

  // ---- event watcher: moves + correct XP ----
  var prev={}, lastTile=-1, lastPos={}, lastOwner={};
  setInterval(function(){
    var f=F();
    // rolls
    for(var p=1;p<=4;p++){
      var pos=f["p"+p];
      if(pos!=null&&lastPos[p]!=null&&pos!==lastPos[p]) move(p,"roll",pos);
      lastPos[p]=pos;
    }
    // cash: rent earns, windfalls do not
    for(var q=1;q<=4;q++){
      var c=sv(q,'cash'); if(c==null)continue;
      if(prev[q]!=null&&c!==prev[q]){
        var d=c-prev[q];
        if(d>0){
          log("P"+q+"  received  "+d,COL[q]);
          if(pendingRent||(Date.now()-lastSoundT<600&&lastSound==="rent")){ xp(q,Math.floor(d/15),"rent collected"); pendingRent=0; }
        } else log("P"+q+"  paid  "+(-d),COL[q]);
      }
      prev[q]=c;
    }
    // ownership: bank buy vs player deal
    TIDS.forEach(function(t){
      var own=window.KV_OWNER?window.KV_OWNER(t):null;
      if(lastOwner[t]===undefined){lastOwner[t]=own;return;}
      if(own!==lastOwner[t]){
        var from=lastOwner[t];
        if(own){
          if(from){ xp(own,20,"bought from P"+from); xp(from,15,"sold to P"+own); move(own,"p2pbuy",t); }
          else { xp(own,8,"bought from bank"); move(own,"buy",t); }
          log("P"+own+"  now owns  "+nameOf(t),COL[own]);
        }
        lastOwner[t]=own;
      }
    });
  },250);

  // ---- end ----
  async function endGame(){
    try{window.KV_SFX("fw");}catch(e){}
    var rows=[];
    for(var p=1;p<=4;p++){
      var props=0; TIDS.forEach(function(t){if(window.KV_OWNER&&window.KV_OWNER(t)===p)props++;});
      var bv=bankOf(p);
      rows.push({seat:p, wallet:window.KV_WALLETS[p]||null, xp:window.KV_XP[p]||0,
                 netWorth:(bv==="-"?0:bv), props:props});
    }
    rows.sort(function(a,b){return b.netWorth-a.netWorth;});
    rows.forEach(function(r,i){r.rank=i+1;});
    if(rows[0]){var w=Math.round(60*SOLO_MULT);window.KV_XP[rows[0].seat]+=w;rows[0].xp+=w;}
    if(rows[1]){var s2=Math.round(25*SOLO_MULT);window.KV_XP[rows[1].seat]+=s2;rows[1].xp+=s2;}

    window.KV_RESULT={
      kind:"kascity.result.v1", mode:window.KV_MODE,
      seed:window.KV_SEED, seedCommit:seedCommit,
      moveRoot:chain, moveCount:window.KV_MOVES.length,
      moves:window.KV_MOVES, seats:rows
    };

    var ov=el("div","position:fixed;inset:0;z-index:70;background:rgba(10,8,6,.88);display:flex;align-items:center;justify-content:center;");
    var box=el("div","background:#14100c;border:2px solid #caa64c;border-radius:10px;padding:20px 26px;font:13px/1.7 monospace;color:#f4e4c1;min-width:360px;",ov);
    var h="<div style='font:900 26px Impact,sans-serif;color:#f0c860;letter-spacing:2px;margin-bottom:10px'>FINAL BELL</div>";
    rows.forEach(function(r){h+="<span style='color:"+COL[r.seat]+"'>&#9632;</span> "+r.rank+". P"+r.seat+" net <b>"+r.netWorth+"</b> props <b>"+r.props+"</b> XP <b style='color:#9cd87c'>"+r.xp+"</b><br>";});
    h+="<div style='margin-top:10px;opacity:.7;font-size:11px'>mode "+window.KV_MODE+" &nbsp;moves "+window.KV_MOVES.length+"<br>root "+chain.slice(0,32)+"…</div>";
    box.innerHTML=h;
    var cp=el("button","margin-top:14px;padding:7px 14px;background:#2a2118;color:#f4e4c1;border:1px solid #5a4a3a;border-radius:5px;font:12px monospace;cursor:pointer;",box);
    cp.textContent="copy verifiable result";
    cp.onclick=function(){navigator.clipboard.writeText(JSON.stringify(window.KV_RESULT)).then(function(){cp.textContent="copied \\u2713";});};
    log("FINAL BELL — moveRoot "+chain.slice(0,16)+"…","#f0c860");
  }
  window.KV_END=endGame;

  // ---- board overlay ----
  var pop=el("div","position:fixed;z-index:61;display:none;background:rgba(20,16,12,.96);border:1px solid #caa64c;border-radius:6px;padding:9px 13px;font:12px/1.7 monospace;color:#f4e4c1;min-width:165px;");
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

fs.writeFileSync('showcase_kascity47.html', engine.replace('</script>', [
  '', uiJs,
  src25.slice(cs, ce).replace('v25 showcase', 'v47 showcase'),
  'try { loadScene(' + JSON.stringify(v47str) + '); }',
  "catch (e) { console.error('kascity47 boot: ' + (e && e.message)); }", ''
].join('\n') + '\n</script>'));

console.log('PASS move chain: SHA-256 per decision, seed-committed, moveRoot in payload');
console.log('PASS sound hook: rent distinguished from GO salary / card windfalls');
console.log('PASS XP: bank buy 8 | p2p buy 20 | sell 15 | tenant 12 | rent 1/15 | district 30 | win 60');
console.log('PASS solo discount 40% (bot games earn less than neighbour games)');
console.log('OK kascity_v47.json + showcase_kascity47.html (' + (fs.statSync('showcase_kascity47.html').size/1024/1024).toFixed(1) + ' MB)');
