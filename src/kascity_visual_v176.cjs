// kascity_visual_v176.cjs
// Dedup economic move records at the single choke point: move() -> KV_MOVES.push
// Root cause (forensic v175): two writers -
//   line ~7399 ownership-watcher calls internal move() directly (bypasses all KV_MOVE wrappers)
//   line ~7054 settlement calls window.KV_MOVE (and sometimes fires twice)
// All prior guards (v161/v172/v174/v175) lived in the wrapper chain and could never see the first writer.
// Fix: inside move(), skip a record whose seat|action|arg|t key matches one pushed within the last 12 moves,
// restricted to economic actions (p2pbuy, buy, cash:*, renovate). Aborts before writing on any anchor mismatch.

const fs = require("fs");

const SRC = "showcase_kascity175.html";
const DST = "showcase_kascity176.html";

let s = fs.readFileSync(SRC, "utf8");

// ---- anchor (CRLF-safe): the rec build + push inside move() ----
const anchorRe = /var rec=\{i:window\.KV_MOVES\.length, s:seat, a:action, v:arg, t:left\};(\r?\n)(\s*)window\.KV_MOVES\.push\(rec\);/;

const matches = s.match(new RegExp(anchorRe.source, "g")) || [];
if (matches.length !== 1) {
  console.error("ABORT: anchor found " + matches.length + " times (expected 1). File untouched.");
  process.exit(1);
}

// dedup marker must not already exist
if (s.indexOf("__KV_DEDUP176") !== -1) {
  console.error("ABORT: __KV_DEDUP176 already present. File untouched.");
  process.exit(1);
}

s = s.replace(anchorRe, function(_m, nl, indent) {
  return 'var rec={i:window.KV_MOVES.length, s:seat, a:action, v:arg, t:left};' + nl +
    indent + '// __KV_DEDUP176: choke-point dedup for economic records (both writer paths funnel here)' + nl +
    indent + 'if(/^(p2pbuy$|buy$|renovate$|cash:)/.test(action)){' + nl +
    indent + '  window.__KV_DEDUP176 = window.__KV_DEDUP176 || {};' + nl +
    indent + '  var _dk = seat+"|"+action+"|"+arg+"|"+left;' + nl +
    indent + '  var _prev = window.__KV_DEDUP176[_dk];' + nl +
    indent + '  if(_prev !== undefined && (window.KV_MOVES.length - _prev) < 12){' + nl +
    indent + '    if(window.KV_LOG) window.KV_LOG("dedup: "+action+"@"+left, "#7a6a58");' + nl +
    indent + '    return null;' + nl +
    indent + '  }' + nl +
    indent + '  window.__KV_DEDUP176[_dk] = window.KV_MOVES.length;' + nl +
    indent + '}' + nl +
    indent + 'window.KV_MOVES.push(rec);';
});

// ---- self-test: simulate the two writer paths against the injected logic ----
(function selfTest(){
  const KV_MOVES = [];
  const D = {};
  function move(seat, action, arg, left){
    if(/^(p2pbuy$|buy$|renovate$|cash:)/.test(action)){
      const dk = seat+"|"+action+"|"+arg+"|"+left;
      const prev = D[dk];
      if(prev !== undefined && (KV_MOVES.length - prev) < 12) return null;
      D[dk] = KV_MOVES.length;
    }
    KV_MOVES.push({s:seat,a:action,v:arg,t:left});
    return 1;
  }
  // writer A (watcher) then writer B (settlement) same trade, same second
  move(2,"p2pbuy","t14",285);
  move(2,"p2pbuy","t14",285);          // dup via KV_MOVE path
  move(2,"cash:t14",-40,285);
  move(2,"cash:t14",-40,285);          // settlement double-fire
  move(3,"cash:t14",40,285);
  move(1,"renovate","t9",100);
  move(1,"renovate","t9",100);         // dup
  move(1,"roll",6,99);                 // non-economic untouched
  move(1,"roll",6,99);                 // non-economic dup allowed
  const counts = {};
  KV_MOVES.forEach(x=>{const k=x.s+"|"+x.a+"@"+x.t;counts[k]=(counts[k]||0)+1;});
  const econDupes = Object.keys(counts).filter(k=>counts[k]>1 && /\|(p2pbuy|buy|renovate|cash:)/.test(k));
  if (econDupes.length !== 0) { console.error("SELF-TEST FAIL: dupes survived " + econDupes); process.exit(1); }
  if (KV_MOVES.length !== 6) { console.error("SELF-TEST FAIL: expected 6 records, got " + KV_MOVES.length); process.exit(1); }
  // distinct legit trade later must still record
  move(2,"p2pbuy","t14",120);
  if (KV_MOVES[KV_MOVES.length-1].a !== "p2pbuy") { console.error("SELF-TEST FAIL: legit later trade blocked"); process.exit(1); }
  console.log("PASS choke-point dedup: engine + JS writers merged, non-economic untouched, later trades allowed");
})();

fs.writeFileSync(DST, s);
const mb = (fs.statSync(DST).size/1048576).toFixed(1);
console.log("OK " + DST + " (" + mb + " MB)");
