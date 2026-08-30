// kascity_visual_v178.cjs — move-record rewrite (multiplayer prerequisite)
// 1. rec.hash assigned inside move()'s serialized chain queue via KV_COMMIT.add:
//    every move gets a commitment hash regardless of writer path (fixes hashes
//    stopping mid-record when internal-path moves bypassed the v171 wrapper).
// 2. v171 KV_MOVE commit wrapper retired (would double-extend the chain).
// 3. Ownership-watcher records balances on p2p trades (fixes 6/10 trades
//    missing cash records); v177 choke-point dedup arbitrates vs the KV_PAY
//    reporter, whichever fires first wins.
const fs = require("fs");
const SRC = "showcase_kascity177.html";
const DST = "showcase_kascity178.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V178") !== -1) { console.error("ABORT: v178 already applied."); process.exit(1); }

const A1 = `        chain = await sha(chain+"|"+rec.i+"|"+rec.s+"|"+rec.a+"|"+rec.v+"|"+rec.t);
        window.KV_ROOT = chain;`;

const A2 = `          if(from){ xp(own,20,"bought from P"+from); xp(from,15,"sold to P"+own); move(own,"p2pbuy",t); }`;

const A3 = `// ---- local moves extend the commitment chain (v171) ----
(function(){
  var installed = false;
  var iv = setInterval(function(){
    if (installed || !window.KV_MOVE || !window.KV_COMMIT) return;
    installed = true; clearInterval(iv);
    var base = window.KV_MOVE;
    window.KV_MOVE = function(seat, action, value){
      var out = base.apply(null, arguments);
      try {
        var list = window.KV_MOVES || [];
        var idx = list.length ? list[list.length - 1].i : 0;
        window.KV_COMMIT.add(idx, seat, action, value).then(function(h){
          if (list.length) list[list.length - 1].hash = h;
          window.KV_STATE_ROOT = h;
        });
      } catch (e) {}
      return out;
    };
  }, 300);
})();`;

for (const [n, a] of [["A1", A1], ["A2", A2], ["A3", A3]]) {
  const c = s.split(a).length - 1;
  if (c !== 1) { console.error("ABORT: anchor " + n + " count " + c + " (expected 1). File untouched."); process.exit(1); }
}

s = s.replace(A1, A1 + `
        // __KV_V178: every move gets a commitment hash here, at the choke point,
        // serialized by chainQ so hashes cannot interleave regardless of writer path
        if(window.KV_COMMIT && rec.hash == null){
          try{
            rec.hash = await window.KV_COMMIT.add(rec.i, rec.s, rec.a, rec.v);
            window.KV_STATE_ROOT = rec.hash;
          }catch(e){}
        }`);

s = s.replace(A2,
`          if(from){ xp(own,20,"bought from P"+from); xp(from,15,"sold to P"+own); move(own,"p2pbuy",t);
            // __KV_V178: the record must carry the money — resulting balances for both sides
            move(own,"cash:"+t, Math.round(sv(own,'cash')||0));
            move(from,"cash:"+t, Math.round(sv(from,'cash')||0)); }`);

s = s.replace(A3, `// ---- (v171 commit wrapper retired in v178: move() itself commits every record) ----`);

fs.writeFileSync(DST, s);
console.log("PASS anchors 3/3, v171 wrapper retired, choke-point commit + watcher cash installed");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
