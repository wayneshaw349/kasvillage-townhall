// kascity_visual_v205.cjs — JS-side AI acts only for seats this client owns
// 1. Bot bidding (10462): candidates were "seats not in KV_HUMANS" — in a relay game that is
//    the remote human too. Now: only seats this client owns (host: its bots; guest: none).
// 2. Offer answers (10141-10150): the owner's ACCEPT/REFUSE was AI-decided unless the owner
//    was local. Now: if the owner is a seat this client doesn't own, no local decision — the
//    owner's own client answers and it arrives through the relay.
// 3. KV.why(): one-line engine/queue diagnostic.
const fs = require("fs");
const SRC = "showcase_kascity204.html";
const DST = "showcase_kascity205.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V205") !== -1) { console.error("ABORT: v205 already applied."); process.exit(1); }

const A1 = `    var bots=[1,2,3,4].filter(function(p){ return humans.indexOf(p)<0 && cashOf(p)>=350; });`;
const A2 = `        var need=(theirCash<380||theirMort>150);`;
const A3 = `    window.KV.retry=function(){ return window.KV_RETRY2(); };`;
for (const [k, a] of [["A1", A1], ["A2", A2], ["A3", A3]]) {
  const c = s.split(a).length - 1;
  if (c !== 1) { console.error("ABORT: anchor " + k + " count " + c + " (expected 1). File untouched."); process.exit(1); }
}

s = s.replace(A1,
`    // __KV_V205: in a relay game only seats this client owns may be driven by local AI
    var __mp=window.KV_MP2, __relay=!!(__mp&&__mp.room&&__mp.started);
    var bots=[1,2,3,4].filter(function(p){ return humans.indexOf(p)<0 && cashOf(p)>=350 && (!__relay || __mp.owns(p)); });`);

s = s.replace(A2,
`        // __KV_V205: a remote owner answers on their own board; their reply arrives via the relay
        if(window.KV_MP2 && window.KV_MP2.room && window.KV_MP2.started && !window.KV_MP2.owns(owner)){
          if(window.KV_LOG) window.KV_LOG("P"+owner+" will answer from their board", "#7a6a58");
          return;
        }
        var need=(theirCash<380||theirMort>150);`);

s = s.replace(A3,
`    window.KV.retry=function(){ return window.KV_RETRY2(); };
    window.KV.why=function(){ var f=(window.KV_FLAGS&&window.KV_FLAGS())||{}; var o={seat:f.seat,turn:f.turn,phase:f.phase,asked:f.asked,go:f.go,buy:f.buy,moved:f.moved,humans:f.humans,hud:f.hud_seat,t0:f.t0,left:f.left|0,modal:!!document.querySelector("[data-kvmodal]"),me:M.seat,role:M.role,halted:!!M.halted,queue:(M.queue||[]).slice(0,4).map(function(m){return m.i+":P"+m.s+m.a+"@"+m.v;}),assertN:M.assertN||0,local:(window.KV_MOVES||[]).length}; console.log(JSON.stringify(o)); return o; };`);

fs.writeFileSync(DST, s);
console.log("PASS anchors 3/3 — AI gated to owned seats; KV.why() added");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
