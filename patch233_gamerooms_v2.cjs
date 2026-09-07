// patch233_gamerooms_v2.cjs
// SRC showcase_kascity232.html -> DST showcase_kascity233.html
// KV_MP2 migration to relay v51 game_rooms v2:
//   - single room orderer: lowest sha256(room+"|"+nodeURL), failover walks sorted list, reseeds via /append
//   - outbound: POST /append {wallet, kind:"move"|"gun", body{ s,a,v,t,hash,snap,fx }}; adopt server i from response
//   - inbound: GET /log?after=M.logN, apply entries in log order, server i authoritative
//   - deleted: maxSeen head computation in move(), !stored repost block, sentinel-4e9 gun
//   - kept: consumed() relocation (it IS the adopt-server-i step for watcher-recorded copies), v232 self-heal
//   - fx payloads: mgmt: (scenario cash/deed), accept: (both bot-answer sites); applyRemote applies fx, snap-adopt skipped for fx moves
// Count-guarded, CRLF-safe, abort-before-write on any mismatch.

const fs = require("fs");
const SRC = "showcase_kascity232.html";
const DST = "showcase_kascity233.html";

let raw = fs.readFileSync(SRC, "utf8");
const hadCRLF = raw.indexOf("\r\n") >= 0;
let s = hadCRLF ? raw.replace(/\r\n/g, "\n") : raw;

const errs = [];
function count(hay, needle) { return hay.split(needle).length - 1; }
function rep(label, oldS, newS, expect) {
  expect = expect == null ? 1 : expect;
  const c = count(s, oldS);
  if (c !== expect) { errs.push(`[${label}] anchor count ${c}, expected ${expect}`); return; }
  s = s.split(oldS).join(newS);
}
function span(label, startA, endA, newText) {
  const cs = count(s, startA), ce = count(s, endA);
  if (cs !== 1) { errs.push(`[${label}] start anchor count ${cs}, expected 1`); return; }
  if (ce !== 1) { errs.push(`[${label}] end anchor count ${ce}, expected 1`); return; }
  const i0 = s.indexOf(startA);
  const i1 = s.indexOf(endA);
  if (i1 < i0) { errs.push(`[${label}] end anchor precedes start anchor`); return; }
  s = s.slice(0, i0) + newText + s.slice(i1 + endA.length);
}

// ---------- P0: header + M state ----------
rep("P0-header",
  "multiplayer client (v180, speaks the v50 relay API)",
  "multiplayer client (v233, game_rooms v2: /append + /log, single orderer)");

rep("P0-state",
  '  var M = { nodes:[], room:null, wallet:null, seat:0, roster:[], started:false, seen:{}, hi:-1, polling:false };',
  '  var M = { nodes:[], room:null, wallet:null, seat:0, roster:[], started:false, seen:{}, hi:-1, polling:false, logN:0, ordIdx:0, ordList:null };');

// ---------- P1: move() -- drop maxSeen/queue head computation; add fx param ----------
rep("P1a-signature",
  "    function move(seat, action, arg){",
  "    function move(seat, action, arg, fx){");

rep("P1b-drop-head",
`        } else {
          var __h = window.KV_MOVES.length - 1;
          if (__mp.maxSeen != null && __mp.maxSeen > __h) __h = __mp.maxSeen;
          (__mp.queue || []).forEach(function(q){ if (q.i > __h) __h = q.i; });
          __idx = __h + 1;                               // own move: next slot after everything known
        }`,
`        }
        // __KV_V233: own moves index at local length; /append response relocates to the server i`);

rep("P1c-rec-fx",
  "      var rec={i:__idx, s:seat, a:action, v:arg, t:left};",
  "      var rec={i:__idx, s:seat, a:action, v:arg, t:left};\n      if(fx) rec.fx = fx;");

// ---------- P2: seedNode -> /append replay ----------
span("P2-seednode",
`  async function seedNode(u){`,
`      log("re-seeded a node with "+log_.length+" moves");`,
`  async function seedNode(u){
    try{
      await one(u, "/api/game/room/create", { room:M.room, wallet:wallet(), seed_commit:"seed-"+M.room, game:"kascity" });
      if(M.started && M.roster.length)
        await one(u, "/api/game/room/"+M.room+"/start", { roster:M.roster });
      var log_=(window.KV_MOVES||[]).filter(Boolean);
      for(var i=0;i<log_.length;i++){ var m=log_[i];
        await one(u, "/api/game/room/"+M.room+"/append", { wallet:wallet(), kind:"move",
          body:{ s:m.s, a:String(m.a), v:m.v, t:m.t, hash:m.hash||null, snap:m.snap||null, fx:m.fx||null } }); }
      M.logN = log_.length;
      log("re-seeded orderer with "+log_.length+" moves via /append");`);

// ---------- P3: orderer machinery, inserted before the lobby section ----------
rep("P3-orderer",
  "  window.KV_HOST2 = async function(){",
`  // ---- __KV_V233: room orderer -- lowest sha256(room+"|"+node), failover walks the sorted list ----
  async function ordListF(){
    if(M.ordList && M.ordList.length) return M.ordList;
    if(!M.nodes.length) await discover();
    var scored = await Promise.all(M.nodes.map(async function(u){
      return { u:u, k: await sha256hex(M.room+"|"+u) };
    }));
    scored.sort(function(a,b){ return a.k<b.k?-1:(a.k>b.k?1:0); });
    M.ordList = scored.map(function(x){ return x.u; });
    log("orderer: "+(M.ordList[0]||"?")+" ("+M.ordList.length+" candidates)");
    return M.ordList;
  }
  async function ord(path, body){
    var L = await ordListF();
    for(var k=0;k<L.length;k++){
      var at = (M.ordIdx + k) % L.length;
      var u = L[at];
      try{
        var out = await one(u, path, body);
        if(k>0){ M.ordIdx = at; log("orderer failover -> "+u, "#e0a040"); }
        return out;
      }catch(e){
        if(String(e && e.message).indexOf("HTTP 404")===0){
          try{ await seedNode(u); var out2 = await one(u, path, body);
            if(k>0){ M.ordIdx = at; log("orderer failover (reseeded) -> "+u, "#e0a040"); }
            return out2;
          }catch(e2){}
        }
      }
    }
    throw new Error("no orderer accepted "+path);
  }
  M.ord = ord;

  window.KV_HOST2 = async function(){`);

// ---------- P4: gun via /append kind "gun" ----------
span("P4-gun",
`    await fan("/api/game/room/"+M.room+"/move", { wallet:wallet(), move:{`,
`      hash:null, seed:seed, seedHash: await sha256hex(seed), players:roster.length } }, true);`,
`    await ord("/api/game/room/"+M.room+"/append", { wallet:wallet(), kind:"gun",
      body:{ startDaa:startDaa, seed:seed, seedHash: await sha256hex(seed), players:roster.length } });`);

// ---------- P5: outbound tail -- per-rec sent flag, /append post, adopt server i, no repost ----------
rep("P5a-sent-check",
  "        if(!rec || sent[rec.i]) continue;",
  "        if(!rec || rec.__sent) continue;");

rep("P5b-sent-set",
  "        sent[rec.i]=1;",
  "        rec.__sent=1;");

span("P5c-append",
`        (function(r){`,
`        })(rec);`,
`        (function(r){
          ord("/api/game/room/"+M.room+"/append", { wallet:wallet(), kind:"move",
            body:{ s:r.s, a:String(r.a), v:r.v, t:r.t, hash:r.hash, snap:r.snap||null, fx:r.fx||null } })
          .then(function(o){
            if(!o || o.stored!==true || o.i==null){ r.__sent=0; return; }
            M.seen[o.i]=1;                 // our own entry: the /log echo is not re-applied
            if(o.i !== r.i){
              var mv=(window.KV_MOVES||[]);
              if(mv[r.i]===r) delete mv[r.i];
              r.i = o.i; mv[o.i] = r;
              try{
                if(window.KV_COMMIT && window.KV_COMMIT.add){
                  window.KV_COMMIT.add(r.i, r.s, r.a, r.v, r.snap).then(function(h2){ r.hash = h2; }).catch(function(){});
                }
              }catch(e){}
              log("append: adopted relay i"+o.i+" ("+r.a+" P"+r.s+")", "#9cd87c");
            }
          })
          .catch(function(){ r.__sent=0; log("append failed for "+r.a+" P"+r.s+" \\u2014 retrying","#e0a040"); });
        })(rec);`);

// ---------- P6: poll -- /log?after=logN, kinds, log-order queue ----------
span("P6-poll",
`        var res=await fan("/api/game/room/"+M.room+"/moves?since=0", undefined, true);`,
`          M.queue.push(m); M.queue.sort(function(a,b){ return a.i-b.i; });`,
`        var lg = await ord("/api/game/room/"+M.room+"/log?after="+(M.logN||0));
        ((lg && lg.entries) || []).forEach(function(e){
          M.logN = (M.logN||0) + 1;
          if(M.seen[e.i]) return; M.seen[e.i]=1;
          if(e.kind==="gun"){
            var gb=e.body||{};
            M.armGun(Number(gb.startDaa!=null?gb.startDaa:gb.v), gb.seed||null, gb.players||M.roster.length);
            return;
          }
          if(e.kind!=="move") return;
          var b2=e.body||{};
          var m={ i:e.i, s:b2.s, a:b2.a, v:b2.v, t:b2.t, hash:b2.hash||null, snap:b2.snap||null, fx:b2.fx||null };
          if(m.a==="first" && m.s>=1 && m.s<=4){ M.firstList=M.firstList||{}; (M.firstList[m.s]=M.firstList[m.s]||[]).push(Number(m.v)); return; }
          M.queue = M.queue || [];
          M.queue.push(m);   // __KV_V233: log order IS apply order`);

// ---------- P7: drain -- own moves reconcile to server i on shift ----------
rep("P7-own-reconcile",
  "    if(m.s===M.seat || M.owns(m.s)){ M.queue.shift(); return; }        // my own or my bots: I produced it",
`    if(m.s===M.seat || M.owns(m.s)){
      // __KV_V233: our own entry echoed from the log -- make sure our local copy sits at the server i
      try{
        var mv0=(window.KV_MOVES||[]);
        if(!mv0[m.i] || mv0[m.i].s!==m.s || String(mv0[m.i].a)!==String(m.a)){
          for(var j0=0;j0<mv0.length;j0++){ var r0=mv0[j0];
            if(r0 && r0.i!==m.i && r0.s===m.s && String(r0.a)===String(m.a) && String(r0.v)===String(m.v)){
              delete mv0[j0]; r0.i=m.i; mv0[m.i]=r0; break; } }
        }
      }catch(e0){}
      M.queue.shift(); return;
    }`);

// ---------- P8: non-turnBound adopt -- carry fx, skip snap-adopt when fx present ----------
rep("P8-adopt-fx",
`        if(!mv4[m.i]){ mv4[m.i]={ i:m.i, s:m.s, a:m.a, v:m.v, t:m.t, hash:m.hash||null, snap:m.snap||null }; }
        if(window.KV_ADOPT && m.snap) window.KV_ADOPT(m.snap);`,
`        if(!mv4[m.i]){ mv4[m.i]={ i:m.i, s:m.s, a:m.a, v:m.v, t:m.t, hash:m.hash||null, snap:m.snap||null, fx:m.fx||null }; }
        if(window.KV_ADOPT && m.snap && !m.fx) window.KV_ADOPT(m.snap);   // __KV_V233: fx is the precise effect; snap would double-apply`);

// ---------- P9: applyRemote -- fx application path ----------
rep("P9-applyremote-fx",
  '    var a=String(m.a||"");',
`    var a=String(m.a||"");
    // __KV_V233: effect payloads -- the mover states exactly what changed; apply and return
    if(m.fx){
      try{
        var fx=m.fx;
        if(fx.cash){ Object.keys(fx.cash).forEach(function(p){
          var d=Math.round(+fx.cash[p]||0); if(!d) return;
          var cur=(function(){ var v=(window.KV_SEAT&&window.KV_SEAT(+p,"cash")); if(v==null){ var ff=(window.KV_FLAGS&&window.KV_FLAGS())||{}; v=ff["cash"+p]; } return v==null?0:Math.round(v); })();
          window.KV_SETSTATE("cash"+p, cur+d);
          try{ var w2=window.KV_WORLD; if(w2&&w2.seats&&w2.seats[+p-1]) w2.seats[+p-1].cash=cur+d; }catch(e2){}
        }); }
        if(fx.deed){ Object.keys(fx.deed).forEach(function(t){
          try{ var w3=window.KV_WORLD; if(w3&&w3.owners) w3.owners["t"+t]=+fx.deed[t]||0; }catch(e3){}
        }); }
        log("fx applied: "+a+" @"+m.i, "#9cd87c");
        un(); return;
      }catch(eF){}
    }`);

// ---------- P10: fx at the generating sites ----------
// scenario resolve()
rep("P10a-scenario-fx",
  '      if(window.KV_MOVE) window.KV_MOVE(seat,"mgmt:"+sc.id,oi);',
`      if(window.KV_MOVE){
        var __fx={ cash:{} };
        __fx.cash[seat] = lost ? Math.round(Math.min(0, swing)) : Math.round(swing + (__sale||0));
        if(sold!=null){ __fx.deed={}; __fx.deed[sold]=0; }
        window.KV_MOVE(seat,"mgmt:"+sc.id,oi,__fx);
      }`);

// KV_MP2 V228 bot answer to a remote bid (buyer = r.s, amount = v)
rep("P10b-v228-fx",
  '          if(window.KV_MOVE) window.KV_MOVE(owner,(accept?"accept:":"refuse:")+tile, threshold);',
`          if(window.KV_MOVE){ var __fxA=null;
            if(accept){ __fxA={cash:{},deed:{}}; __fxA.cash[r.s]=-v; __fxA.cash[owner]=(__fxA.cash[owner]||0)+v; __fxA.deed[tile]=r.s; }
            window.KV_MOVE(owner,(accept?"accept:":"refuse:")+tile, threshold, __fxA); }`);

// local offer flow bot answer (buyer = me, amount = v)
rep("P10c-offer-fx",
  'if(window.KV_MOVE) window.KV_MOVE(owner,(accept?"accept:":"refuse:")+tile,Math.round(threshold));',
`if(window.KV_MOVE){ var __fxB=null;
  if(accept){ __fxB={cash:{},deed:{}}; __fxB.cash[me]=-v; __fxB.cash[owner]=(__fxB.cash[owner]||0)+v; __fxB.deed[tile]=me; }
  window.KV_MOVE(owner,(accept?"accept:":"refuse:")+tile,Math.round(threshold), __fxB); }`);

// ---------- verdict ----------
if (errs.length) {
  console.error("ABORT -- nothing written:");
  errs.forEach(function(e){ console.error("  " + e); });
  process.exit(1);
}

let out = hadCRLF ? s.replace(/\n/g, "\r\n") : s;
fs.writeFileSync(DST, out, "utf8");

// post-write assertions
const chk = fs.readFileSync(DST, "utf8");
const must = [
  "game_rooms v2: /append + /log, single orderer",
  '"/append"',
  '"/log?after="',
  "ordListF",
  "__KV_V233: log order IS apply order",
  "fx applied: ",
  '"mgmt:"+sc.id,oi,__fx'
];
const missing = must.filter(function(x){ return chk.indexOf(x) < 0; });
const gone = ['/moves?since=0', 'i:4000000000'].filter(function(x){ return chk.indexOf(x) >= 0; });
if (missing.length || gone.length) {
  console.error("POST-WRITE CHECK FAILED", { missing: missing, legacyStillPresent: gone });
  process.exit(1);
}
console.log("OK -> " + DST + "  (" + chk.length + " chars, CRLF=" + hadCRLF + ")");
