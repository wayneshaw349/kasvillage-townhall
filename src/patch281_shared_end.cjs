// patch281_shared_end.cjs — both boards ring the final bell together, and a relay result stops
// claiming it was solo.
//  A: endGame publishes an "end_game" chain move (best-effort) so the finish is on the record.
//  B: a remote "end_game" ends our game too, so neither board keeps playing alone.
//  C: humans/solo derived from the relay roster, not the local defaults.
// SRC showcase_kascity280.html -> DST showcase_kascity281.html
const fs = require("fs");
const SRC = "showcase_kascity280.html";
const DST = "showcase_kascity281.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const fails = [];
function must(a, n, label){ const c = s.split(a).length - 1; if (c !== n) fails.push(label + ": expected " + n + " found " + c); }

const A1 = '    // drain the chain queue before publishing, or the root will not cover the final moves\n' +
'    window.KV_SEALED = true;                     // no further moves are accepted';
const A2 = '    window.KV_RESULT.humans=(window.KV_HUMANS||[1]).length;';
const A3 = 'if(window.KV_RESULT){ window.KV_RESULT.signed=true; window.KV_RESULT.solo=true; }';
const A4 = "    // __KV_V279: a remote scenario resolves from the chain, never from our own deck";

must(A1, 1, "A1 seal point");
must(A2, 1, "A2 humans field");
must(A3, 1, "A3 solo signing path");
must(A4, 1, "A4 applyRemote scn branch");

if (fails.length) {
  console.error("ABORT — anchors:\n" + fails.join("\n"));
  process.exit(1);
}

// A: publish the finish before sealing
s = s.replace(A1,
'    // __KV_V281: tell the other board the bell rang, before we stop accepting moves\n' +
'    try{\n' +
'      var __M=window.KV_MP2;\n' +
'      if(__M && __M.room && __M.started && window.KV_MOVE && !window.__KV_ENDSENT){\n' +
'        window.__KV_ENDSENT=1;\n' +
'        window.KV_MOVE(__M.seat||1, "end_game", 0);\n' +
'        await new Promise(function(r){ setTimeout(r, 900); });   // let the append land\n' +
'      }\n' +
'    }catch(eE){}\n' +
'    // drain the chain queue before publishing, or the root will not cover the final moves\n' +
'    window.KV_SEALED = true;                     // no further moves are accepted');

// B: a remote end_game ends our board too
s = s.replace(A4,
'    // __KV_V281: the other board rang the bell — finish here as well\n' +
'    if(a==="end_game"){\n' +
'      try{\n' +
'        var mvE2=(window.KV_MOVES||[]);\n' +
'        if(!mvE2[m.i]) mvE2[m.i]={ i:m.i, s:m.s, a:"end_game", v:m.v, t:m.t, hash:m.hash||null, snap:m.snap||null, fx:null, __sent:1, __acked:1 };\n' +
'        if(m.snap && window.KV_ADOPT) window.KV_ADOPT(m.snap);\n' +
'        log("P"+m.s+" reached the final bell \\u2014 closing this board too", "#f0c860");\n' +
'        if(!window.KV_SEALED && window.KV_END){ setTimeout(function(){ try{ window.KV_END(); }catch(e2){} }, 400); }\n' +
'      }catch(eG){}\n' +
'      un(); return;\n' +
'    }\n' + A4);

// C1: humans from the relay roster when there is one
s = s.replace(A2,
'    // __KV_V281: in a relay game the roster is the truth about how many humans played\n' +
'    var __mpR=window.KV_MP2;\n' +
'    var __relayGame=!!(__mpR && __mpR.room && __mpR.started && (__mpR.roster||[]).length);\n' +
'    window.KV_RESULT.humans = __relayGame ? __mpR.roster.length : (window.KV_HUMANS||[1]).length;\n' +
'    if(__relayGame){ window.KV_RESULT.solo=false; window.KV_RESULT.room=__mpR.room; }');

// C2: the solo signing shortcut must not claim solo in a relay game
s = s.replace(A3,
'if(window.KV_RESULT){ var __mpS=window.KV_MP2; var __rg=!!(__mpS && __mpS.room && __mpS.started && (__mpS.roster||[]).length);\n' +
'        window.KV_RESULT.signed=true; window.KV_RESULT.solo=!__rg; }   // __KV_V281');

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
