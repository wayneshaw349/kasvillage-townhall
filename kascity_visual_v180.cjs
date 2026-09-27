// kascity_visual_v180.cjs — multiplayer client for the deployed v50 relay API
// New self-contained KV_MP2 layer (old KV_MP / KV_NET stay inert, online:false):
//   discovery  : api.runonflux.io/apps/location/kasvillage -> http://ip:35816
//   host/join  : broadcast to EVERY node individually (stateless nodes never sync)
//   start      : host posts one authoritative roster to all nodes (deterministic seats)
//   outbound   : own-seat moves POSTed as {wallet, move:{i,s,a,v,t,hash}} after the
//                choke-point hash lands (bots replay identically on both clients — not relayed)
//   inbound    : /moves?since merged by index across nodes, verified by KV_COMMIT.check,
//                applied through the same SETSTATE mapping the old layer used
//   seed       : multiplayer games boot with KV_FIXED_SEED so both clients simulate the
//                same world (host/join survive the reload via localStorage)
// Console API: KV.host() -> room code | KV.join(code) | KV.start() (host) | KV.mp()
const fs = require("fs");
const SRC = "showcase_kascity179.html";
const DST = "showcase_kascity180.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("KV_MP2") !== -1) { console.error("ABORT: v180 already applied."); process.exit(1); }

const A1 = `if(scene.meta && !(window.KV_NET&&window.KV_NET.online) && !window.KV_FIXED_SEED){`;
const A2 = `  discover(true);
})();`;

for (const [n, a] of [["A1", A1], ["A2", A2]]) {
  const c = s.split(a).length - 1;
  if (c !== 1) { console.error("ABORT: anchor " + n + " count " + c + " (expected 1). File untouched."); process.exit(1); }
}

// --- early boot: a pending multiplayer session pins the seed before the engine randomizes ---
s = s.replace(A1,
`(function(){ try { var b = JSON.parse(localStorage.getItem("kv_mp2")||"null");
    if (b && b.room) { window.KV_FIXED_SEED = true; window.__KV_MP2_BOOT = b; }
  } catch(e){} })();
  ` + A1);

// --- the client itself, appended after the KV_RELAY block ---
const CLIENT = A2 + `

// ================= KV_MP2 — multiplayer client (v180, speaks the v50 relay API) =================
(function(){
  var COL={1:"#d94f4f",2:"#4f7fd9",3:"#4fd98a",4:"#d9c14f"};
  var APP="kasvillage", PORT=35816;
  var M = { nodes:[], room:null, wallet:null, seat:0, roster:[], started:false, seen:{}, hi:-1, polling:false };
  window.KV_MP2 = M;

  function log(m,c){ if(window.KV_LOG) window.KV_LOG(m, c||"#caa64c"); }

  function wallet(){
    if(M.wallet) return M.wallet;
    var w = localStorage.getItem("kv_mp2_wallet");
    if(!w){ var a=new Uint8Array(12); crypto.getRandomValues(a);
      w = "kcw"+Array.from(a).map(function(x){return x.toString(16).padStart(2,"0");}).join("");
      localStorage.setItem("kv_mp2_wallet", w); }
    M.wallet = w; return w;
  }

  async function discover(){
    try{
      var c=new AbortController(); var t=setTimeout(function(){c.abort();},6000);
      var r=await fetch("https://api.runonflux.io/apps/location/"+APP,{signal:c.signal});
      clearTimeout(t);
      var j=await r.json();
      var seen={};
      M.nodes=(j&&j.data||[]).map(function(d){ return "http://"+String(d.ip||"").split(":")[0]+":"+PORT; })
        .filter(function(u){ if(seen[u])return false; seen[u]=1; return true; });
    }catch(e){}
    if(!M.nodes.length) M.nodes=["https://kasvillage.app.runonflux.io"];
    log("relay: "+M.nodes.length+" node(s)");
    return M.nodes;
  }

  async function one(base, path, body){
    var c=new AbortController(); var t=setTimeout(function(){c.abort();},6000);
    var r=await fetch(base+path, { signal:c.signal, method: body!==undefined?"POST":"GET",
      headers:{"Content-Type":"application/json"}, body: body!==undefined?JSON.stringify(body):undefined });
    clearTimeout(t);
    if(!r.ok) throw new Error("HTTP "+r.status+" "+base);
    return r.json();
  }
  // write to every node; the room is re-created on any node that lost it (stateless)
  async function fan(path, body, reseedable){
    if(!M.nodes.length) await discover();
    var res = await Promise.allSettled(M.nodes.map(async function(u){
      try { return await one(u, path, body); }
      catch(e){
        if(reseedable && String(e.message).indexOf("404")===0){ await seedNode(u); return one(u, path, body); }
        throw e;
      }
    }));
    var ok = res.filter(function(r){return r.status==="fulfilled";}).map(function(r){return r.value;});
    if(!ok.length) throw new Error("no relay node accepted "+path);
    return ok;
  }
  async function seedNode(u){
    try{
      await one(u, "/api/game/room/create", { room:M.room, wallet:wallet(), seed_commit:"seed-"+M.room, game:"kascity" });
      if(M.started && M.roster.length)
        await one(u, "/api/game/room/"+M.room+"/start", { roster:M.roster });
      var log_=window.KV_MOVES||[];
      for(var i=0;i<log_.length;i++){ var m=log_[i];
        await one(u, "/api/game/room/"+M.room+"/move", { wallet:wallet(),
          move:{ i:m.i, s:m.s, a:String(m.a), v:m.v, t:m.t, hash:m.hash||null } }); }
      log("re-seeded a node with "+log_.length+" moves");
    }catch(e){}
  }

  // ---- lobby ----
  window.KV_HOST2 = async function(){
    await discover();
    var a=new Uint8Array(4); crypto.getRandomValues(a);
    var room="kc"+Array.from(a).map(function(x){return x.toString(16).padStart(2,"0");}).join("");
    await fan("/api/game/room/create", { room:room, wallet:wallet(), seed_commit:"seed-"+room, game:"kascity" });
    localStorage.setItem("kv_mp2", JSON.stringify({ room:room, role:"host" }));
    log("ROOM "+room+" — share this code. Reloading into multiplayer...", "#9cd87c");
    setTimeout(function(){ location.reload(); }, 900);
    return room;
  };
  window.KV_JOIN2 = async function(code){
    code=String(code||"").trim();
    if(!code) { log("KV.join('<code>')","#ff6a4a"); return; }
    await discover();
    M.room=code;
    await fan("/api/game/room/"+code+"/join", { wallet:wallet() }, true);
    localStorage.setItem("kv_mp2", JSON.stringify({ room:code, role:"guest" }));
    log("joined "+code+" — reloading into multiplayer...", "#9cd87c");
    setTimeout(function(){ location.reload(); }, 900);
  };
  window.KV_START2 = async function(){
    if(!M.room){ log("host first: KV.host()","#ff6a4a"); return; }
    // merged view of who joined across all nodes, ordered by join time, host first
    var infos = await fan("/api/game/room/"+M.room, undefined, true);
    var by={};
    infos.forEach(function(r){ (r.players||[]).forEach(function(p){
      if(by[p.wallet]==null || p.joined_at<by[p.wallet]) by[p.wallet]=p.joined_at; }); });
    var roster=Object.keys(by).sort(function(a,b){
      if(a===wallet()) return -1; if(b===wallet()) return 1;
      return by[a]-by[b] || (a<b?-1:1); });
    await fan("/api/game/room/"+M.room+"/start", { roster:roster });
    M.roster=roster; applyRoster(roster);
    log("game started — "+roster.length+" player(s)");
  };

  function applyRoster(roster){
    M.roster=roster; M.started=true;
    M.seat=roster.indexOf(wallet())+1;
    if(M.seat<1) M.seat=1;
    if(window.KV_NET) window.KV_NET.seat=M.seat;   // the commit checker reads this
    window.KV_HUMANS=roster.map(function(_,i){return i+1;});
    if(window.KV_SETSTATE){ window.KV_SETSTATE("humans", roster.length); window.KV_SETSTATE("seat", M.seat); }
    log("you are P"+M.seat+" of "+roster.length, COL[M.seat]||"#caa64c");
    strip();
  }

  // ---- outbound: own-seat moves, sent once the choke-point hash lands ----
  (function(){
    var iv=setInterval(function(){
      if(!window.KV_MOVE) return;
      clearInterval(iv);
      var base=window.KV_MOVE;
      window.KV_MOVE=function(seat,action,value){
        var out=base.apply(null,arguments);
        try{
          if(M.started && M.room && seat===M.seat){
            var list=window.KV_MOVES||[]; var rec=list[list.length-1];
            if(rec && rec.s===seat){
              var tries=0;
              (function send(){
                if(rec.hash==null && tries++<20) return setTimeout(send,150);
                fan("/api/game/room/"+M.room+"/move", { wallet:wallet(),
                  move:{ i:rec.i, s:rec.s, a:String(rec.a), v:rec.v, t:rec.t, hash:rec.hash||null } }, true)
                .catch(function(){ log("move not relayed — all nodes down","#ff6a4a"); });
              })();
            }
          }
        }catch(e){}
        return out;
      };
    },250);
  })();

  // ---- inbound: merge across nodes, verify, replay through the engine flags ----
  function applyRemote(m){
    if(m.s===M.seat) return;
    if(window.KV_COMMIT && m.hash){
      window.KV_COMMIT.check({ index:m.i, seat:m.s, action:m.a, value:m.v||0, hash:m.hash });
    }
    log("P"+m.s+"  "+m.a+(m.v?(" "+m.v):""), COL[m.s]);
    if(!window.KV_SETSTATE) return;
    var was=null; try{ var f=(window.KV_FLAGS&&window.KV_FLAGS())||{}; was=f.seat; }catch(e){}
    if(m.s) window.KV_SETSTATE("seat", m.s);
    var un=function(){ if(was!=null) window.KV_SETSTATE("seat", was); };
    var a=String(m.a||"");
    if(a.indexOf("accept:")===0){
      var t=+a.split(":")[1], own=0;
      try{ var w=window.KV_WORLD; own=w&&w.owners?(w.owners["t"+t]||0):0; }catch(e){}
      if(window.KV_PAY && own) window.KV_PAY(t, m.s, own, m.v||0);
      un(); return;
    }
    if(a.indexOf("lapse:")===0||a.indexOf("refuse:")===0){ un(); return; }
    if(a.indexOf("list:")===0){ var lt=+a.split(":")[1];
      window.KV_SETSTATE("lp_t"+lt, m.v||0); window.KV_SETSTATE("ls_t"+lt, 1); un(); return; }
    if(a.indexOf("unlist:")===0){ window.KV_SETSTATE("ls_t"+(+a.split(":")[1]), 0); un(); return; }
    if(a==="roll")           window.KV_SETSTATE("go",0);
    else if(a==="buy")       window.KV_SETSTATE("buy",0);
    else if(a==="pass")      window.KV_SETSTATE("buy",1);
    else if(a==="renovate"){ window.KV_SETSTATE("renov_by",m.s);
      window.KV_SETSTATE("renov_t",0); window.KV_SETSTATE("renov",m.v); }
    else if(a.indexOf("bid:")===0){
      window.KV_SETSTATE("tr_tile",+a.split(":")[1]);
      window.KV_SETSTATE("tr_from",m.s);
      window.KV_SETSTATE("tr_amt",m.v);
    }
    un();
  }

  async function poll(){
    if(!M.room || M.polling) return;
    M.polling=true;
    try{
      if(!M.started){
        var infos=await fan("/api/game/room/"+M.room, undefined, true);
        var st=infos.find(function(r){ return r.started && (r.players||[]).length; });
        if(st) applyRoster(st.players.sort(function(a,b){return a.seat-b.seat;}).map(function(p){return p.wallet;}));
      } else {
        var res=await fan("/api/game/room/"+M.room+"/moves?since=0", undefined, true);
        var by={};
        res.forEach(function(r){ (r.moves||[]).forEach(function(m){ if(by[m.i]==null) by[m.i]=m; }); });
        Object.keys(by).map(Number).sort(function(a,b){return a-b;}).forEach(function(i){
          if(M.seen[i]) return; M.seen[i]=1;
          applyRemote(by[i]);
        });
      }
    }catch(e){}
    M.polling=false;
    strip();
  }
  setInterval(poll, 1000);

  // ---- status strip ----
  var el=null;
  function strip(){
    if(!M.room) return;
    if(!el){ el=document.createElement("div");
      el.style.cssText="position:fixed;left:50%;top:34px;transform:translateX(-50%);z-index:66;font:9px monospace;color:#f4e4c1;background:#2a2118;padding:3px 10px;border-radius:9px;";
      document.body.appendChild(el); }
    el.textContent="ROOM "+M.room+"  P"+(M.seat||"?")+"  "+(M.started?(M.roster.length+" players"):"waiting")+"  nodes:"+M.nodes.length;
  }

  // ---- resume after the lobby reload ----
  (function(){
    var b=window.__KV_MP2_BOOT;
    if(!b||!b.room) return;
    localStorage.removeItem("kv_mp2");
    M.room=b.room;
    discover().then(function(){
      if(b.role==="host"){
        fan("/api/game/room/create",{room:M.room,wallet:wallet(),seed_commit:"seed-"+M.room,game:"kascity"}).catch(function(){});
        log("hosting "+M.room+" — when everyone has joined, run KV.start()", "#9cd87c");
      } else {
        fan("/api/game/room/"+M.room+"/join",{wallet:wallet()},true).catch(function(){});
        log("in room "+M.room+" — waiting for the host to start", "#9cd87c");
      }
      strip();
    });
  })();

  if(window.KV){
    window.KV.host=function(){ return window.KV_HOST2(); };
    window.KV.join=function(c){ return window.KV_JOIN2(c); };
    window.KV.start=function(){ return window.KV_START2(); };
    window.KV.mp=function(){ var r={room:M.room,seat:M.seat,started:M.started,roster:M.roster,nodes:M.nodes}; console.log(r); return r; };
  }
})();`;

s = s.replace(A2, CLIENT);
fs.writeFileSync(DST, s);
console.log("PASS anchors 2/2 — KV_MP2 client installed (host/join/start/relay/verify)");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
