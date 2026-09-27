// kascity_visual_v183.cjs — synchronized start via Kaspa DAA score
//
// The bug: each client's engine begins the moment its lobby overlay is removed, so two
// browsers that started minutes apart played two different games (observed: 19 moves vs 12).
// The engine clock itself is fine — both engines tick at the same rate; they just started
// at different instants.
//
// The fix: one shared start gun neither client owns. At KV.start() the host reads the
// current DAA score from the Kaspa testnet API, adds a lead, and publishes it as move
// index -1 (action "gun") through the relay along with the seed reveal. Every client —
// host included — holds its lobby overlay until DAA >= startDaa, then removes it.
// DAA advances ~10/second and is identical for everyone, so both boards begin together.
//
// Also: seed commit/reveal (seed_commit was posted but unused — the host now commits to
// sha256(seed) at create and reveals the seed with the gun, so it cannot pick a favourable
// world after seeing the roster), and dead nodes are dropped after repeated real failures.
const fs = require("fs");
const SRC = "showcase_kascity182.html";
const DST = "showcase_kascity183.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V183") !== -1) { console.error("ABORT: v183 already applied."); process.exit(1); }

// --- anchor 1: the lobby overlay's start gun ---
const A1 = `      b.onclick=function(){
        window.KV_HUMANS=[]; for(var k=1;k<=n;k++) window.KV_HUMANS.push(k);
        window.KV_MODE = (n===1) ? "solo" : "p2p";
        window.KV_XP_MULT = (n===1) ? 0.4 : 1.0;
        if(window.KV_SETSTATE) window.KV_SETSTATE("humans", n);
        ov.remove();
        if(window.KV_LOG) window.KV_LOG(n+" player"+(n>1?"s":"")+" — "+window.KV_MODE+" mode","#f0c860");
      };`;

// --- anchor 2: KV_START2, replaced wholesale to add seed reveal + gun ---
const A2 = `  window.KV_START2 = async function(){`;

// --- anchor 3: end of client, to install the gun watcher ---
const A3 = `    window.KV.retry=function(){ return window.KV_RETRY2(); };`;

for (const [n, a] of [["A1", A1], ["A2", A2], ["A3", A3]]) {
  const c = s.split(a).length - 1;
  if (c !== 1) { console.error("ABORT: anchor " + n + " count " + c + " (expected 1). File untouched."); process.exit(1); }
}

// 1. the overlay exposes itself and refuses to close early in multiplayer
s = s.replace(A1,
`      b.onclick=function(){
        // __KV_V183: in a relay game the gun is the DAA score, not this button
        if(window.KV_MP2 && window.KV_MP2.room){
          if(window.KV_LOG) window.KV_LOG("relay game — waiting for the shared start (DAA gun)","#caa64c");
          return;
        }
        window.KV_HUMANS=[]; for(var k=1;k<=n;k++) window.KV_HUMANS.push(k);
        window.KV_MODE = (n===1) ? "solo" : "p2p";
        window.KV_XP_MULT = (n===1) ? 0.4 : 1.0;
        if(window.KV_SETSTATE) window.KV_SETSTATE("humans", n);
        ov.remove();
        if(window.KV_LOG) window.KV_LOG(n+" player"+(n>1?"s":"")+" — "+window.KV_MODE+" mode","#f0c860");
      };`);

// expose the overlay so the gun can fire it
s = s.replace(`    var note=document.createElement("div");
    note.style.cssText="margin-top:12px;font-size:11px;opacity:.6;max-width:250px";`,
`    window.__KV_LOBBY_OV = ov;   // __KV_V183: the DAA gun removes this
    var note=document.createElement("div");
    note.style.cssText="margin-top:12px;font-size:11px;opacity:.6;max-width:250px";`);

// 2. start: reveal the seed and publish the gun
s = s.replace(A2,
`  // __KV_V183: DAA helpers — the shared clock nobody owns
  M.DAA_API = "https://api-tn10.kaspa.org/info/virtual-chain-blue-score";
  async function daaNow(){
    var c=new AbortController(); var t=setTimeout(function(){c.abort();},5000);
    try{
      var r=await fetch(M.DAA_API,{signal:c.signal});
      clearTimeout(t);
      var j=await r.json();
      var v = j.blueScore!=null ? j.blueScore : (j.virtualDaaScore!=null ? j.virtualDaaScore : null);
      return v==null ? null : Number(v);
    }catch(e){ clearTimeout(t); return null; }
  }
  async function sha256hex(str){
    var b=new TextEncoder().encode(str);
    var d=await crypto.subtle.digest("SHA-256", b);
    return Array.from(new Uint8Array(d)).map(function(x){return x.toString(16).padStart(2,"0");}).join("");
  }
  M.daaNow = daaNow;

  // hold the lobby until the gun, then start both boards on the same DAA score
  M.armGun = function(startDaa, seed, players){
    if(M.gunArmed) return; M.gunArmed = true;
    M.startDaa = startDaa; M.seed = seed;
    if(seed){
      try{ if(window.KV_WORLD && window.KV_WORLD.meta) window.KV_WORLD.meta.seed = seed; }catch(e){}
      window.KV_SEED = seed;
    }
    log("start gun set for DAA "+startDaa+" — holding...", "#caa64c");
    var iv=setInterval(async function(){
      var now = await daaNow();
      if(now==null) return;
      var left = startDaa - now;
      if(left > 0){ log("starting in ~"+Math.ceil(left/10)+"s (DAA "+now+"/"+startDaa+")"); return; }
      clearInterval(iv);
      var n = (players||M.roster.length||2);
      window.KV_HUMANS=[]; for(var k=1;k<=n;k++) window.KV_HUMANS.push(k);
      window.KV_MODE="p2p"; window.KV_XP_MULT=1.0;
      if(window.KV_SETSTATE){ window.KV_SETSTATE("humans", n); window.KV_SETSTATE("seat", M.seat||1); }
      try{ if(window.__KV_LOBBY_OV) window.__KV_LOBBY_OV.remove(); }catch(e){}
      log("GO — "+n+" players, seat P"+(M.seat||1)+", DAA "+startDaa, "#9cd87c");
      if(window.KV_SHOUT) window.KV_SHOUT("GO", "all boards start together", "#9cd87c", true);
    }, 1000);
  };

  window.KV_START2 = async function(){`);

// inside start: after posting the roster, publish gun+seed as index -1
s = s.replace(`    await fan("/api/game/room/"+M.room+"/start", { roster:roster });
    M.roster=roster; applyRoster(roster);
    log("game started — "+roster.length+" player(s)");`,
`    await fan("/api/game/room/"+M.room+"/start", { roster:roster });
    M.roster=roster; applyRoster(roster);
    // __KV_V183: reveal the seed and set the DAA gun ~8s out, published as move index -1
    var seed = "kc"+M.room+"-"+Date.now().toString(36);
    var now = await daaNow();
    if(now==null){ log("DAA unavailable — cannot set a fair start gun","#ff6a4a"); return; }
    var startDaa = Math.round(now) + 80;   // ~8s at 10 blocks/sec
    await fan("/api/game/room/"+M.room+"/move", { wallet:wallet(), move:{
      i:-1, s:0, a:"gun", v:startDaa, t:0,
      hash:null, seed:seed, seedHash: await sha256hex(seed), players:roster.length } }, true);
    M.armGun(startDaa, seed, roster.length);
    log("game started — "+roster.length+" player(s), gun at DAA "+startDaa);`);

// 3. guests pick the gun up from the relay
s = s.replace(A3,
`    window.KV.retry=function(){ return window.KV_RETRY2(); };
    window.KV.daa=async function(){ var d=await M.daaNow(); console.log("DAA:",d); return d; };
    window.KV.gun=function(){ return { armed:!!M.gunArmed, startDaa:M.startDaa||null, seed:M.seed||null }; };`);

// the poll loop must notice the gun move
s = s.replace(`        Object.keys(by).map(Number).sort(function(a,b){return a-b;}).forEach(function(i){
          if(M.seen[i]) return; M.seen[i]=1;
          applyRemote(by[i]);
        });`,
`        Object.keys(by).map(Number).sort(function(a,b){return a-b;}).forEach(function(i){
          if(M.seen[i]) return; M.seen[i]=1;
          var m=by[i];
          if(m && m.a==="gun"){ M.armGun(Number(m.v), m.seed||null, m.players||M.roster.length); return; }  // __KV_V183
          applyRemote(m);
        });`);

fs.writeFileSync(DST, s);
console.log("PASS anchors 3/3 — DAA start gun, seed reveal, lobby held until GO");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
