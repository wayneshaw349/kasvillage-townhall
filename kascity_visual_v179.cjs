// kascity_visual_v179.cjs — fix the two v178 regressions seen in the game export
// 1. Watcher cash records read sv() which returned 0; read KV_WORLD.seats[p-1].cash
//    (the same accessor snapshot() uses) so watcher-recorded trades carry real balances.
// 2. Dedup key drops the clock: same seat+action+tile within the 12-move window is a
//    duplicate regardless of t (observed dup trios were 3-5 moves apart with different t).
const fs = require("fs");
const SRC = "showcase_kascity178.html";
const DST = "showcase_kascity179.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V179") !== -1) { console.error("ABORT: v179 already applied."); process.exit(1); }

const A1 = `            // __KV_V178: the record must carry the money — resulting balances for both sides
            move(own,"cash:"+t, Math.round(sv(own,'cash')||0));
            move(from,"cash:"+t, Math.round(sv(from,'cash')||0)); }`;

const A2 = `var _dk = seat+"|"+action+"|"+(action.indexOf("cash:")===0?"":arg)+"|"+left; /* __KV_DEDUP177: cash keys ignore value */`;

for (const [n, a] of [["A1", A1], ["A2", A2]]) {
  const c = s.split(a).length - 1;
  if (c !== 1) { console.error("ABORT: anchor " + n + " count " + c + " (expected 1). File untouched."); process.exit(1); }
}

s = s.replace(A1,
`            // __KV_V179: balances read the way snapshot() reads them — sv() returned 0 here
            var __W = window.KV_WORLD;
            var __c = function(p){ try { return Math.round((__W.seats[p-1]||{}).cash||0); } catch(e){ return 0; } };
            move(own,"cash:"+t, __c(own));
            move(from,"cash:"+t, __c(from)); }`);

s = s.replace(A2,
`var _dk = seat+"|"+action+"|"+(action.indexOf("cash:")===0?"":arg); /* __KV_V179: no clock in key — the 12-move window arbitrates */`);

fs.writeFileSync(DST, s);
console.log("PASS anchors 2/2 — real balances on watcher path, clockless dedup key");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
