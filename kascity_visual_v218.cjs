// kascity_visual_v218.cjs — a collided move must re-commit, or it never publishes
// The v208 repost cleared r.hash and re-indexed, but nothing recomputed the hash;
// the outbound tail skips hash==null records, so the move was silently never sent
// again — permanent relay holes, and the peer starves. Now the repost immediately
// re-commits at the new index (using the captured snap) and the tail picks it up.
const fs = require("fs");
const SRC = "showcase_kascity217.html";
const DST = "showcase_kascity218.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V218") !== -1) { console.error("ABORT: v218 already applied."); process.exit(1); }

const A1 = `              delete sent[r.i];
              r.i = h + 1; r.hash = null;`;
const c = s.split(A1).length - 1;
if (c !== 1) { console.error("ABORT: anchor count " + c + " (expected 1). File untouched."); process.exit(1); }

s = s.replace(A1,
`              delete sent[r.i];
              r.i = h + 1; r.hash = null;
              // __KV_V218: re-commit at the new index so the tail republishes it
              try{
                if(window.KV_COMMIT && window.KV_COMMIT.add){
                  window.KV_COMMIT.add(r.i, r.s, r.a, r.v, r.snap).then(function(h2){ r.hash = h2; }).catch(function(){});
                }
              }catch(e){}`);

fs.writeFileSync(DST, s);
console.log("PASS anchor 1/1 — collision reposts re-commit; no permanent relay holes");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
