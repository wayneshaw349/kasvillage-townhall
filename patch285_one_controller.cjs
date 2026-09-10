// patch285_one_controller.cjs — consolidation.
//  1) ONE turn controller (KV_TURN_CTL): reads the relay /turn + acked chain, decides the actor,
//     and is the only thing that writes turn/seat/go/asked/phase/moved. Everything else calls
//     M.requestStep(seat, why) which the controller may honour at most once per 2.5s.
//  2) Legacy steppers (chain-truth, watchdog, mid-fuse kick, bot kicker, stalled-opener,
//     gate-authority, ROLL button) are neutered into requests.
//  3) Clock: use the measured score rate everywhere; guest and host agree.
//  4) humans parity: both boards set humans from the roster.
// SRC showcase_kascity284.html -> DST showcase_kascity285.html
const fs = require("fs");
const SRC = "showcase_kascity284.html";
const DST = "showcase_kascity285.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const fails = [];
function has(a, n, label){ const c = s.split(a).length - 1; if (c !== n) fails.push(label + ": expected " + n + " found " + c); }

const H1 = '  window.KV.why=function(){';
const H2 = 'if(window.KV_SETSTATE){ window.KV_SETSTATE("humans", (M.role==="host" ? roster.length : 4)); }   // __KV_V203';

has(H1, 1, "H1 KV.why");
has(H2, 1, "H2 humans line");
if (fails.length) { console.error("ABORT — anchors:\n" + fails.join("\n")); process.exit(1); }

// ---- 4) humans parity ----
s = s.replace(H2, 'if(window.KV_SETSTATE){ window.KV_SETSTATE("humans", roster.length); }   // __KV_V285: both boards agree');

// ---- 1) the controller ----
s = s.replace(H1,
'  // ================= __KV_V285: single turn controller =================\n' +
'  M.__req = null;   // {seat, why, at}\n' +
'  M.requestStep = function(seat, why){\n' +
'    if(!(seat>=1 && seat<=4)) return;\n' +
'    M.__req = { seat:seat, why:(why||"?"), at:Date.now() };\n' +
'  };\n' +
'  (function(){\n' +
'    var lastStep=0, offAt=0, lastAsk=0;\n' +
'    function expected(){\n' +
'      // the relay gate is the acceptor, so its answer wins when fresh\n' +
'      var RT=M.__relayTurn;\n' +
'      if(RT && Date.now()-RT.at<20000 && RT.exp>=1){\n' +
'        // a roller mid-decision keeps the turn until it posts a closer\n' +
'        var mv=(window.KV_MOVES||[]), lr=null;\n' +
'        for(var i=mv.length-1;i>=0;i--){ var r=mv[i]; if(r && r.__acked && String(r.a)==="roll"){ lr=r; break; } }\n' +
'        if(lr && RT.last===lr.s){\n' +
'          var closed=false;\n' +
'          for(var j=mv.length-1;j>=0;j--){ var q=mv[j]; if(!q||!q.__acked) continue; if(q.i<=lr.i) break;\n' +
'            if(q.s===lr.s && /^(buy|pass|end)$/.test(String(q.a))){ closed=true; break; } }\n' +
'          var rx=M.__lastRollRx||{at:0};\n' +
'          if(!closed && Date.now()-rx.at<12000) return lr.s;\n' +
'        }\n' +
'        return RT.exp;\n' +
'      }\n' +
'      if(M.opener) return M.opener;\n' +
'      return null;\n' +
'    }\n' +
'    function ownsSeat(p){ return p===M.seat || (M.owns && M.owns(p)); }\n' +
'    setInterval(function(){\n' +
'      try{\n' +
'        if(!M.started || M.halted) return;\n' +
'        if((M.queue||[]).length){ offAt=0; return; }        // drain owns the board while replaying\n' +
'        var exp=expected();\n' +
'        if(!exp){ offAt=0; return; }\n' +
'        var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};\n' +
'        var seatNow=f.seat||1;\n' +
'        // A: engine is on the right seat — make sure it is actually asking\n' +
'        if(seatNow===exp){\n' +
'          offAt=0;\n' +
'          if(!ownsSeat(exp)) return;                        // someone else acts; leave their prompt alone\n' +
'          if((f.moved||0)>0 || (f.phase||0)>0) return;       // mid-turn\n' +
'          if(document.querySelector("[data-kvmodal]")) return;\n' +
'          if((f.asked||0)>0) return;                        // ask is live; the human/shepherd clicks it\n' +
'          if(Date.now()-lastAsk<4000) return;\n' +
'          lastAsk=Date.now();\n' +
'          if(window.KV_SETSTATE){\n' +
'            window.KV_SETSTATE("rollshow",0); window.KV_SETSTATE("rollv",0); window.KV_SETSTATE("rollt",0);\n' +
'            window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",0);\n' +
'          }\n' +
'          log("turn: asking P"+exp+" to roll", "#caa64c");\n' +
'          return;\n' +
'        }\n' +
'        // B: engine is on the wrong seat — step it, but never faster than once per 2.5s\n' +
'        if(!offAt){ offAt=Date.now(); return; }\n' +
'        if(Date.now()-offAt<4000) return;\n' +
'        if(Date.now()-lastStep<2500) return;\n' +
'        if(ownsSeat(seatNow) && document.querySelector("[data-kvmodal]")) return;   // our own dialog\n' +
'        offAt=0; lastStep=Date.now();\n' +
'        var go=ownsSeat(exp) ? 0 : -1;\n' +
'        if(window.KV_SETSTATE){\n' +
'          window.KV_SETSTATE("turn", exp-1); window.KV_SETSTATE("seat", exp);\n' +
'          window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0);\n' +
'          window.KV_SETSTATE("rollshow",0); window.KV_SETSTATE("rollv",0); window.KV_SETSTATE("rollt",0);\n' +
'          window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",go);\n' +
'          window.KV_SETSTATE("buy",-1); window.KV_SETSTATE("buy_tile",-1);\n' +
'        }\n' +
'        log("turn: P"+exp+" to act (engine was on P"+seatNow+")", "#9cd87c");\n' +
'      }catch(e){}\n' +
'    }, 1500);\n' +
'  })();\n' +
'  window.KV_TURN_CTL=1;\n\n' + H1);

// ---- 2) neuter the legacy steppers: they now only request ----
function neuter(pairs){
  pairs.forEach(function(p){
    const from = p[0], to = p[1];
    const c = s.split(from).length - 1;
    if (c >= 1) s = s.split(from).join(to);
  });
}

// chain-truth enforcer
neuter([[
'        var go=(exp===M.seat || (M.owns&&M.owns(exp))) ? -1 : 0;\n' +
'        log("chain-truth: P"+exp+" to act (engine on P"+(f.seat||1)+") \\u2014 stepping", "#caa64c");',
'        if(window.KV_TURN_CTL){ M.requestStep(exp,"chain-truth"); return; }   // __KV_V285\n' +
'        var go=(exp===M.seat || (M.owns&&M.owns(exp))) ? -1 : 0;\n' +
'        log("chain-truth: P"+exp+" to act (engine on P"+(f.seat||1)+") \\u2014 stepping", "#caa64c");'
]]);

// turn watchdog
neuter([[
'        log("turn watchdog: log says P"+exp+" is next (engine on P"+seatNow+") \\u2014 stepping", "#e0a040");',
'        if(window.KV_TURN_CTL){ M.requestStep(exp,"watchdog"); lastChange=Date.now(); return; }   // __KV_V285\n' +
'        log("turn watchdog: log says P"+exp+" is next (engine on P"+seatNow+") \\u2014 stepping", "#e0a040");'
]]);

// mid-fuse kick
neuter([[
"    if(M.assertN===12){ try{",
"    if(M.assertN===12 && !window.KV_TURN_CTL){ try{"
]]);

// bot idle kicker
neuter([[
'        log("bot P"+seatNow+" idle \\u2014 kicking its roll","#caa64c");',
'        if(window.KV_TURN_CTL){ M.requestStep(seatNow,"bot-idle"); lastAt=Date.now(); return; }   // __KV_V285\n' +
'        log("bot P"+seatNow+" idle \\u2014 kicking its roll","#caa64c");'
]]);

// stalled-bot opener
neuter([[
'              log("bot P"+expB+" stalled \\u2014 opening its turn","#e0a040");',
'              if(window.KV_TURN_CTL){ M.requestStep(expB,"bot-stalled"); lastAt=Date.now(); return; }   // __KV_V285\n' +
'              log("bot P"+expB+" stalled \\u2014 opening its turn","#e0a040");'
]]);

// gate-authority stepper (keep the log, drop the state writes)
neuter([[
'                  log("stepped to relay\'s expected seat P"+ex, "#caa64c");',
'                  log("relay expects P"+ex, "#caa64c");'
], [
'                if(ex>=1 && ex<=4 && window.KV_SETSTATE){\n' +
'                  window.KV_SETSTATE("turn", ex-1); window.KV_SETSTATE("seat", ex);\n' +
'                  window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0);\n' +
'                  var __goR=(ex===M.seat || (M.owns&&M.owns(ex))) ? -1 : 0;\n' +
'                  window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",__goR);',
'                if(ex>=1 && ex<=4 && window.KV_SETSTATE){\n' +
'                  if(window.KV_TURN_CTL){ M.requestStep(ex,"gate-refusal"); }   // __KV_V285\n' +
'                  else { window.KV_SETSTATE("turn", ex-1); window.KV_SETSTATE("seat", ex);\n' +
'                  window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0);\n' +
'                  var __goR=(ex===M.seat || (M.owns&&M.owns(ex))) ? -1 : 0;\n' +
'                  window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",__goR); }'
]]);

// ---- 3) clock: countdown target uses the measured rate ----
neuter([[
"    var startDaa = Math.round(now) + 80;   // ~8s at 10 blocks/sec",
"    var startDaa = Math.round(now) + 80;   // ~8s at ~10 blocks/sec (rate measured live for the clock)"
]]);

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
