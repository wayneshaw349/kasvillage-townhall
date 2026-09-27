// patch277_chain_truth.cjs — one enforcer: the acked chain decides who acts; engine disagreement
// for 6s continuous gets stepped, unconditionally (only our own open modal defers).
// Supersedes the 15s watchdog in practice by firing first with the same roll-rotation math.
// SRC showcase_kascity276.html -> DST showcase_kascity277.html
const fs = require("fs");
const SRC = "showcase_kascity276.html";
const DST = "showcase_kascity277.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

const A = "  // ---- __KV_V226: turn-pointer watchdog";
const c = s.split(A).length - 1;
if (c !== 1) {
  console.error("ABORT — anchor found " + c + " times (expected 1)");
  process.exit(1);
}

s = s.replace(A,
'  // ---- __KV_V277: chain-truth turn enforcer — the acked log decides, unconditionally ----\n' +
'  (function(){\n' +
'    var offAt=0;\n' +
'    setInterval(function(){\n' +
'      try{\n' +
'        if(!M.started || M.halted) return;\n' +
'        if((M.queue||[]).length){ offAt=0; return; }\n' +
'        var mv=(window.KV_MOVES||[]), lastRoll=null;\n' +
'        for(var i=mv.length-1;i>=0;i--){ var r=mv[i]; if(r && r.__acked && String(r.a)==="roll"){ lastRoll=r; break; } }\n' +
'        var exp=null;\n' +
'        if(lastRoll){\n' +
'          var closed=false;\n' +
'          for(var j=mv.length-1;j>=0;j--){ var q=mv[j]; if(!q||!q.__acked) continue; if(q.i<=lastRoll.i) break; if(q.s===lastRoll.s && /^(buy|pass|end)$/.test(String(q.a))){ closed=true; break; } }\n' +
'          var rx=M.__lastRollRx||{at:0};\n' +
'          exp=(closed || Date.now()-rx.at>12000) ? ((lastRoll.s%4)+1) : lastRoll.s;\n' +
'        } else if(M.opener){ exp=M.opener; }\n' +
'        if(!exp) return;\n' +
'        var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};\n' +
'        if((f.seat||1)===exp){ offAt=0; return; }\n' +
'        if(exp===M.seat || (M.owns&&M.owns(exp))){\n' +
'          if(document.querySelector("[data-kvmodal]")){ offAt=0; return; }\n' +
'        }\n' +
'        if(!offAt){ offAt=Date.now(); return; }\n' +
'        if(Date.now()-offAt<6000) return;\n' +
'        offAt=0;\n' +
'        var go=(exp===M.seat || (M.owns&&M.owns(exp))) ? -1 : 0;\n' +
'        log("chain-truth: P"+exp+" to act (engine on P"+(f.seat||1)+") \\u2014 stepping", "#caa64c");\n' +
'        window.KV_SETSTATE("turn", exp-1); window.KV_SETSTATE("seat", exp);\n' +
'        window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0);\n' +
'        window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",go);\n' +
'        window.KV_SETSTATE("buy",-1); window.KV_SETSTATE("buy_tile",-1);\n' +
'      }catch(e){}\n' +
'    }, 2000);\n' +
'  })();\n\n' + A);

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
