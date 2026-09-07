// patch260_end_marker.cjs — explicit end-of-turn move on the chain
// Owner posts "end" when its turn concludes; followers step deterministically and clear grace timers.
// SRC showcase_kascity259.html -> DST showcase_kascity260.html
const fs = require("fs");
const SRC = "showcase_kascity259.html";
const DST = "showcase_kascity260.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const fails = [];
function count(a){ return s.split(a).length - 1; }

// A1: follow list in the two /start payloads (add "end")
const F1 = 'follow:["buy","pass"]';
const F2 = 'follow: ["buy","pass"]';
const f1c = count(F1), f2c = count(F2);
if (f1c + f2c < 2) fails.push("A1 follow list: found " + (f1c + f2c) + " (expected 2+) — paste the turn_order lines (9458/9640) if this aborts");

// A2: applyRemote action switch entry point
const A2 = '    var a=String(m.a||"");\n    // __KV_V233: effect payloads';
if (count(A2) !== 1) fails.push("A2 applyRemote a= anchor: found " + count(A2));

// A3: end-marker publisher install point — after the V237 resync banner comment
const A3 = "  // ---- __KV_V237: full-log resync -- the flux chain is the record; rebuild from it ----";
if (count(A3) !== 1) fails.push("A3 resync banner: found " + count(A3));

if (fails.length) {
  console.error("ABORT — anchors:\n" + fails.join("\n"));
  process.exit(1);
}

// ---- apply A1 ----
if (f1c) s = s.split(F1).join('follow:["buy","pass","end"]');
if (f2c) s = s.split(F2).join('follow: ["buy","pass","end"]');

// ---- apply A2: handle remote "end" ----
s = s.replace(A2,
'    var a=String(m.a||"");\n' +
'    // __KV_V260: explicit end-of-turn — step to the next seat, clear grace state, mark consumed\n' +
'    if(a==="end"){\n' +
'      try{\n' +
'        var mvE=(window.KV_MOVES||[]);\n' +
'        if(!mvE[m.i]) mvE[m.i]={ i:m.i, s:m.s, a:"end", v:m.v, t:m.t, hash:m.hash||null, snap:m.snap||null, fx:m.fx||null, __sent:1, __acked:1 };\n' +
'        var nxE=((m.s%4)+1);\n' +
'        var fE=(window.KV_FLAGS&&window.KV_FLAGS())||{};\n' +
'        if((fE.seat||1)!==nxE){\n' +
'          window.KV_SETSTATE("turn", nxE-1); window.KV_SETSTATE("seat", nxE);\n' +
'          window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0);\n' +
'          window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",-1);\n' +
'          window.KV_SETSTATE("buy",-1); window.KV_SETSTATE("buy_tile",-1);\n' +
'        }\n' +
'        M.__botAskAt={}; M.__dnudge=null;\n' +
'        log("turn closed by P"+m.s+" \\u2014 engine to P"+nxE, "#9cd87c");\n' +
'      }catch(eE){}\n' +
'      return;\n' +
'    }\n' +
'    // __KV_V233: effect payloads');

// ---- apply A3: publisher — owner posts "end" when its turn counter advances past an owned seat ----
s = s.replace(A3,
'  // ---- __KV_V260: end-of-turn publisher — owned seats close their turns on the chain ----\n' +
'  (function(){\n' +
'    var lastTurn=null;\n' +
'    setInterval(function(){\n' +
'      try{\n' +
'        if(!M.started || M.halted) return;\n' +
'        var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};\n' +
'        var t=(f.turn||0);\n' +
'        if(lastTurn===null){ lastTurn=t; return; }\n' +
'        if(t===lastTurn) return;\n' +
'        var prevSeat=((lastTurn%4)+1);\n' +
'        lastTurn=t;\n' +
'        if(!(prevSeat===M.seat || (M.owns&&M.owns(prevSeat)))) return;\n' +
'        M.__endSent=M.__endSent||{};\n' +
'        var ek=prevSeat+"/"+t;\n' +
'        if(M.__endSent[ek]) return;\n' +
'        M.__endSent[ek]=1;\n' +
'        if(window.KV_MOVE) window.KV_MOVE(prevSeat, "end", t);\n' +
'      }catch(e){}\n' +
'    }, 600);\n' +
'  })();\n\n' + A3);

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
