// patch262_end_guard_kick.cjs
// A: end publisher only fires when the chain's last action move belongs to prevSeat
// C: drain mid-fuse kick — re-step a wedged engine at ~5s instead of waiting for the 16s fuse
// D: hostBot shepherd throttled to one click per ask per 3s
// E: movement trace suppressed for 6s after any snapshot adopt (teleports are not crimes)
// SRC showcase_kascity261.html -> DST showcase_kascity262.html
const fs = require("fs");
const SRC = "showcase_kascity261.html";
const DST = "showcase_kascity262.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const fails = [];
function must(a, n, label){ const c = s.split(a).length - 1; if (c !== n) fails.push(label + ": expected " + n + " found " + c); }

const A1 = '        var ek=prevSeat+"/"+t;\n        if(M.__endSent[ek]) return;\n        M.__endSent[ek]=1;\n        if(window.KV_MOVE) window.KV_MOVE(prevSeat, "end", t);';
const C1 = "    M.lagN=0;                        // wait for the engine to reach that seat\n    M.assertN=(M.assertN||0)+1;";
const D1 = '          if(hostBot && /Tap to roll/.test(ptxt)){';
const E1 = '      if (__relay) { var __mp2=window.KV_MP2; if(!(p===__mp2.seat || (__mp2.owns&&__mp2.owns(p)))) continue; }';
const E2 = "// ---- movement trace (v162) ----";

must(A1, 1, "A1 end publisher body");
must(C1, 1, "C1 assertN increment");
must(D1, 1, "D1 shepherd branch");
must(E1, 1, "E1 relay owned-seat skip");
must(E2, 1, "E2 movement trace banner");

if (fails.length) {
  console.error("ABORT — anchors:\n" + fails.join("\n"));
  process.exit(1);
}

// A: chain-backed end guard
s = s.replace(A1,
'        // __KV_V262: only close a turn the chain actually shows prevSeat playing\n' +
'        var __mvT=(window.KV_MOVES||[]), __lastAct=null;\n' +
'        for(var __ti=__mvT.length-1;__ti>=0;__ti--){ var __tr=__mvT[__ti]; if(!__tr) continue; var __ta=String(__tr.a||""); if(__ta==="roll"||__ta==="buy"||__ta==="pass"){ __lastAct=__tr; break; } }\n' +
'        if(!__lastAct || __lastAct.s!==prevSeat) return;\n' +
'        var ek=prevSeat+"/"+t;\n' +
'        if(M.__endSent[ek]) return;\n' +
'        M.__endSent[ek]=1;\n' +
'        if(window.KV_MOVE) window.KV_MOVE(prevSeat, "end", t);');

// C: mid-fuse kick at ~5s (tick 12 of 400ms)
s = s.replace(C1, C1 + "\n" +
'    if(M.assertN===12){ try{\n' +
'      window.KV_SETSTATE("turn", m.s-1); window.KV_SETSTATE("seat", m.s);\n' +
'      window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0);\n' +
'      window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",-1);\n' +
'      log("mid-fuse kick: re-stepping engine to P"+m.s+" for move "+m.i, "#caa64c");\n' +
'    }catch(eK){} }');

// D: shepherd throttle
s = s.replace(D1, D1 + "\n" +
'            M.__shepAt=M.__shepAt||{}; var __shk="r/"+seatNow+"/"+(window.KV_MOVES||[]).length;\n' +
'            if(M.__shepAt[__shk] && Date.now()-M.__shepAt[__shk]<3000) return;\n' +
'            M.__shepAt[__shk]=Date.now();');

// E: adopt-timestamp wrapper + 6s trace suppression after adopt
s = s.replace(E2,
'// ---- __KV_V262: timestamp snapshot adopts (movement trace ignores teleports) ----\n' +
'(function(){ var iv=setInterval(function(){\n' +
'  if(!window.KV_ADOPT || window.KV_ADOPT.__kvWrapped) return;\n' +
'  var orig=window.KV_ADOPT;\n' +
'  var w=function(sn){ window.__KV_ADOPT_AT=Date.now(); return orig(sn); };\n' +
'  w.__kvWrapped=1; window.KV_ADOPT=w; clearInterval(iv);\n' +
'}, 500); })();\n\n' + E2);

s = s.replace(E1, E1 + "\n" +
'      if (__relay && Date.now()-(window.__KV_ADOPT_AT||0)<6000) { continue; }   // __KV_V262: fresh adopt = teleport, not a crime');

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
