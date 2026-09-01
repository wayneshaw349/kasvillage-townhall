// kascity_visual_v189.cjs — host-owned bots + no local turn-nudging in relay games
//
// Observed with nobody touching either board: A logged "P4 was stuck - turn passed on",
// "P3 was stuck - turn passed on", then "YOUR TURN"; B still showed "P3 thinking".
// Three causes, all fixed here:
//  1. Outbound relay wrapped window.KV_MOVE, but rolls are recorded by the position
//     watcher calling internal move() -> never relayed. Outbound now tails KV_MOVES.
//  2. Stall detector + bot loop-breaker nudge turns on wall-clock timers per machine.
//     Disabled in relay games (the relay's turn deadline is the future replacement).
//  3. Bots ran on both clients. Now: host's engine plays bot seats (humans = roster
//     length) and relays their moves alongside its own; guest's engine treats every
//     non-own seat as remote (humans = 4) and receives them.
const fs = require("fs");
const SRC = "showcase_kascity188.html";
const DST = "showcase_kascity189.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V189") !== -1) { console.error("ABORT: v189 already applied."); process.exit(1); }

// --- A1: gun -> engine humans flag by role ---
const A1 = `      window.KV_HUMANS=[ M.seat||1 ];
      window.KV_SEATS_TOTAL = n;
      window.KV_MODE="p2p"; window.KV_XP_MULT=1.0;
      if(window.KV_SETSTATE){ window.KV_SETSTATE("humans", n); window.KV_SETSTATE("seat", M.seat||1); }`;
// --- A2: applyRoster does the same ---
const A2 = `    window.KV_HUMANS=[ M.seat||1 ];              // __KV_V185: own seat only
    window.KV_SEATS_TOTAL = roster.length;
    if(window.KV_SETSTATE){ window.KV_SETSTATE("humans", roster.length); window.KV_SETSTATE("seat", M.seat); }`;
// --- A3: replace the KV_MOVE outbound wrapper with a KV_MOVES tail ---
const A3_START = `  // ---- outbound: own-seat moves, sent once the choke-point hash lands ----
  (function(){
    var iv=setInterval(function(){
      if(!window.KV_MOVE) return;
      clearInterval(iv);
      var base=window.KV_MOVE;
      window.KV_MOVE=function(seat,action,value){`;
const A3_END = `        return out;
      };
    },250);
  })();`;
// --- A4: stall detector ---
const A4 = `      if(!(f.t0>0)){ since=Date.now(); step=0; return; }  // v103: not started yet = not a stall`;
// --- A5: bot loop breaker ---
const A5 = `  var since=null, lastTurn=null;
  setInterval(function(){
    var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};
    if(f.over || window.KV_SEALED || !(f.t0>0)) return;
    var seat=((f.turn||0)%4)+1;
    var bot=(window.KV_HUMANS||[1]).indexOf(seat)<0;`;

for (const [n, a] of [["A1", A1], ["A2", A2], ["A3_START", A3_START], ["A3_END", A3_END], ["A4", A4], ["A5", A5]]) {
  const c = s.split(a).length - 1;
  if (c !== 1) { console.error("ABORT: anchor " + n + " count " + c + " (expected 1). File untouched."); process.exit(1); }
}

const humansByRole = `(M.role==="host" ? n : 4)`;
s = s.replace(A1,
`      window.KV_HUMANS=[ M.seat||1 ];
      window.KV_SEATS_TOTAL = n;
      window.KV_MODE="p2p"; window.KV_XP_MULT=1.0;
      // __KV_V189: host's engine plays the bots (seats > roster); guest's engine waits for every other seat
      if(window.KV_SETSTATE){ window.KV_SETSTATE("humans", ${humansByRole}); window.KV_SETSTATE("seat", M.seat||1); }`);

s = s.replace(A2,
`    window.KV_HUMANS=[ M.seat||1 ];              // __KV_V185: own seat only
    window.KV_SEATS_TOTAL = roster.length;
    if(window.KV_SETSTATE){ window.KV_SETSTATE("humans", (M.role==="host" ? roster.length : 4)); window.KV_SETSTATE("seat", M.seat); }`);

// A3: cut the whole wrapper block and replace with a tail on KV_MOVES
const i0 = s.indexOf(A3_START), i1 = s.indexOf(A3_END, i0) + A3_END.length;
s = s.slice(0, i0) +
`  // ---- outbound (__KV_V189): tail the record itself, so watcher-recorded moves relay too ----
  // host sends its own seat AND every bot seat (seat > roster length); guest sends its own seat only
  (function(){
    var sent={};
    function mine(seat){
      if(seat===M.seat) return true;
      if(M.role==="host" && M.roster.length && seat>M.roster.length) return true;
      return false;
    }
    setInterval(function(){
      if(!M.started || !M.room || M.halted) return;
      var list=window.KV_MOVES||[];
      for(var i=0;i<list.length;i++){
        var rec=list[i];
        if(!rec || sent[rec.i] || !mine(rec.s)) continue;
        if(rec.hash==null) continue;              // wait for the choke-point commit
        sent[rec.i]=1;
        (function(r){
          fan("/api/game/room/"+M.room+"/move", { wallet:wallet(),
            move:{ i:r.i, s:r.s, a:String(r.a), v:r.v, t:r.t, hash:r.hash } }, true)
          .catch(function(){ delete sent[r.i]; log("move "+r.i+" not relayed — retrying","#e0a040"); });
        })(rec);
      }
    }, 300);
  })();` + s.slice(i1);

// A4: stall detector off in relay games
s = s.replace(A4,
`      if(window.KV_MP2 && window.KV_MP2.room) return;   // __KV_V189: no local nudging in a relay game
      if(!(f.t0>0)){ since=Date.now(); step=0; return; }  // v103: not started yet = not a stall`);

// A5: loop breaker off in relay games
s = s.replace(A5,
`  var since=null, lastTurn=null;
  setInterval(function(){
    var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};
    if(f.over || window.KV_SEALED || !(f.t0>0)) return;
    if(window.KV_MP2 && window.KV_MP2.room) return;     // __KV_V189: relay games are driven by the record
    var seat=((f.turn||0)%4)+1;
    var bot=(window.KV_HUMANS||[1]).indexOf(seat)<0;`);

fs.writeFileSync(DST, s);
console.log("PASS anchors 6/6 — outbound tails KV_MOVES, host-owned bots, stall/loop nudgers off in relay games");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
