// patch290_inner_gate.cjs — 289's wrapper sat on window.KV_MOVE, but the engine calls the internal
// move() directly, so stray bot rolls bypassed it. Put the gate inside move() itself.
// In a relay game a "roll" is dropped unless the seat is the actor the relay expects (and the
// previous roller has closed its turn). Everything else is untouched; solo is untouched.
// SRC showcase_kascity289.html -> DST showcase_kascity290.html
const fs = require("fs");
const SRC = "showcase_kascity289.html";
const DST = "showcase_kascity290.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

const A = "function move(seat, action, arg, fx){";
const c = s.split(A).length - 1;
if (c !== 1) {
  console.error("ABORT — anchor found " + c + " times (expected 1)");
  process.exit(1);
}

s = s.replace(A,
'function move(seat, action, arg, fx){\n' +
'  // ---- __KV_V290: in a relay game only the expected actor may create a roll ----\n' +
'  try{\n' +
'    var __M=window.KV_MP2;\n' +
'    if(__M && __M.room && __M.started && String(action)==="roll"){\n' +
'      var __exp=null, __RT=__M.__relayTurn;\n' +
'      if(__RT && Date.now()-__RT.at<20000 && __RT.exp>=1) __exp=__RT.exp;\n' +
'      if(__exp==null && __M.opener) __exp=__M.opener;\n' +
'      if(__exp!=null){\n' +
'        var __mv=(window.KV_MOVES||[]), __lr=null;\n' +
'        for(var __i=__mv.length-1;__i>=0;__i--){ var __r=__mv[__i]; if(__r && __r.__acked && String(__r.a)==="roll"){ __lr=__r; break; } }\n' +
'        if(__lr && __lr.s===__exp){\n' +
'          var __closed=false;\n' +
'          for(var __j=__mv.length-1;__j>=0;__j--){ var __q=__mv[__j]; if(!__q||!__q.__acked) continue; if(__q.i<=__lr.i) break;\n' +
'            if(__q.s===__lr.s && /^(buy|pass|end)$/.test(String(__q.a))){ __closed=true; break; } }\n' +
'          if(!__closed){\n' +
'            window.__KV_DROP=window.__KV_DROP||{};\n' +
'            var __k1="mid/"+seat;\n' +
'            if(!window.__KV_DROP[__k1] || Date.now()-window.__KV_DROP[__k1]>5000){\n' +
'              window.__KV_DROP[__k1]=Date.now();\n' +
'              if(window.KV_LOG) window.KV_LOG("dropped P"+seat+" roll \\u2014 P"+__lr.s+" has not closed its turn","#7a6a58");\n' +
'            }\n' +
'            return;\n' +
'          }\n' +
'        }\n' +
'        if(seat!==__exp){\n' +
'          window.__KV_DROP=window.__KV_DROP||{};\n' +
'          var __k2="wrong/"+seat+"/"+__exp;\n' +
'          if(!window.__KV_DROP[__k2] || Date.now()-window.__KV_DROP[__k2]>5000){\n' +
'            window.__KV_DROP[__k2]=Date.now();\n' +
'            if(window.KV_LOG) window.KV_LOG("dropped P"+seat+" roll \\u2014 the chain expects P"+__exp,"#7a6a58");\n' +
'          }\n' +
'          return;\n' +
'        }\n' +
'      }\n' +
'    }\n' +
'  }catch(__e){}');

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
