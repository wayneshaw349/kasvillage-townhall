// kascity_visual_v177.cjs
// v176 closed the watcher-vs-settlement dupe; one class survived:
// the settlement emitter fires a second time later with a changed balance, so the
// value-bearing key (seat|action|arg|t) differs and slips past dedup.
// Fix: for cash:* records, exclude the value from the dedup key (seat|cash:tile|t).
// Same seat + same tile + same clock-second can only settle once (holding period).
// p2pbuy/buy/renovate keys unchanged (tile stays in key so same-second buys of
// different tiles still record).

const fs = require("fs");
const SRC = "showcase_kascity176.html";
const DST = "showcase_kascity177.html";

let s = fs.readFileSync(SRC, "utf8");

const anchor = 'var _dk = seat+"|"+action+"|"+arg+"|"+left;';
const count = s.split(anchor).length - 1;
if (count !== 1) {
  console.error("ABORT: v176 dedup key anchor found " + count + " times (expected 1). File untouched.");
  process.exit(1);
}
if (s.indexOf("__KV_DEDUP177") !== -1) {
  console.error("ABORT: __KV_DEDUP177 already present. File untouched.");
  process.exit(1);
}

s = s.replace(anchor,
  'var _dk = seat+"|"+action+"|"+(action.indexOf("cash:")===0?"":arg)+"|"+left; /* __KV_DEDUP177: cash keys ignore value */');

// self-test replaying the observed v176 sequence (indices 41-46)
(function selfTest(){
  const KV_MOVES = [];
  const D = {};
  function move(seat, action, arg, left){
    if(/^(p2pbuy$|buy$|renovate$|cash:)/.test(action)){
      const dk = seat+"|"+action+"|"+(action.indexOf("cash:")===0?"":arg)+"|"+left;
      const prev = D[dk];
      if(prev !== undefined && (KV_MOVES.length - prev) < 12) return null;
      D[dk] = KV_MOVES.length;
    }
    KV_MOVES.push({s:seat,a:action,v:arg,t:left});
  }
  move(1,"p2pbuy",13,307);      // 41
  move(1,"cash:13",988,307);    // 42
  move(3,"cash:13",870,307);    // 43
  move(1,"cash:13",1028,307);   // 44  <- double-fire, changed balance, must be dropped
  move(1,"p2pbuy",5,307);       // 46  <- different tile same second, must survive
  move(1,"cash:5",948,307);     // t5 settlement, must survive
  const got = KV_MOVES.map(x=>x.s+"|"+x.a+"@"+x.t+":"+x.v).join(",");
  const c={}; KV_MOVES.forEach(x=>{const k=x.s+"|"+x.a+"|"+(x.a.indexOf("cash:")===0?"":x.v)+"@"+x.t;c[k]=(c[k]||0)+1;});
  const d=Object.keys(c).filter(k=>c[k]>1);
  if (d.length !== 0){ console.error("SELF-TEST FAIL: dupes " + d + " | " + got); process.exit(1); }
  if (KV_MOVES.length !== 5){ console.error("SELF-TEST FAIL: expected 5 records, got " + KV_MOVES.length + " | " + got); process.exit(1); }
  if (KV_MOVES[3].a !== "p2pbuy" || KV_MOVES[3].v !== 5){ console.error("SELF-TEST FAIL: tile-5 buy lost"); process.exit(1); }
  console.log("PASS v177: double-fire cash dropped, same-second different-tile buy and its cash preserved");
})();

fs.writeFileSync(DST, s);
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
