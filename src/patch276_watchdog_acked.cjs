// patch276_watchdog_acked.cjs — turn-pointer watchdog: lastRoll must be chain-acked;
// only buy/pass/end close a turn (mgmt/bid entries are not progress); go provokes non-owned asks.
// SRC showcase_kascity275.html -> DST showcase_kascity276.html
const fs = require("fs");
const SRC = "showcase_kascity275.html";
const DST = "showcase_kascity276.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const fails = [];
function must(a, n, label){ const c = s.split(a).length - 1; if (c !== n) fails.push(label + ": expected " + n + " found " + c); }

const A1 = '        for(var i=mv.length-1;i>=0;i--){ var r=mv[i]; if(r && String(r.a)==="roll"){ lastRoll=r; break; } }\n' +
'        if(!lastRoll) return;\n' +
'        // __KV_V247: the roller\'s turn is not over until they progress\n' +
'        var __wli=-1; for(var __wi=mv.length-1;__wi>=0;__wi--){ if(mv[__wi]===lastRoll){ __wli=__wi; break; } }\n' +
'        var __wdn=false; for(var __wj=__wli+1;__wj<mv.length;__wj++){ var __wq=mv[__wj]; if(__wq && __wq.__acked && __wq.s===lastRoll.s){ __wdn=true; break; } }';

const A2 = '          window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",-1);\n' +
'          window.KV_SETSTATE("buy",-1); window.KV_SETSTATE("buy_tile",-1);\n' +
'        }\n' +
'        lastChange=Date.now();';

must(A1, 1, "A1 watchdog lastRoll scan");
must(A2, 1, "A2 watchdog setstate tail");

if (fails.length) {
  console.error("ABORT — anchors:\n" + fails.join("\n"));
  process.exit(1);
}

s = s.replace(A1,
'        for(var i=mv.length-1;i>=0;i--){ var r=mv[i]; if(r && r.__acked && String(r.a)==="roll"){ lastRoll=r; break; } }   // __KV_V276: acked only\n' +
'        if(!lastRoll) return;\n' +
'        // __KV_V276: only a real closer (buy/pass/end) ends the roller\'s turn\n' +
'        var __wli=-1; for(var __wi=mv.length-1;__wi>=0;__wi--){ if(mv[__wi]===lastRoll){ __wli=__wi; break; } }\n' +
'        var __wdn=false; for(var __wj=__wli+1;__wj<mv.length;__wj++){ var __wq=mv[__wj]; if(__wq && __wq.__acked && __wq.s===lastRoll.s && /^(buy|pass|end)$/.test(String(__wq.a))){ __wdn=true; break; } }');

s = s.replace(A2,
'          var __goW=(exp===M.seat || (M.owns&&M.owns(exp))) ? -1 : 0;   // __KV_V276: provoke non-owned asks\n' +
'          window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",__goW);\n' +
'          window.KV_SETSTATE("buy",-1); window.KV_SETSTATE("buy_tile",-1);\n' +
'        }\n' +
'        lastChange=Date.now();');

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
