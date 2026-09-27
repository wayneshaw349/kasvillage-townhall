// kascity_visual_v188.cjs — fix the false STATE MISMATCH
// Confirmed on both clients: identical seed, identical first-rolls (1:7|2:8|3:7|4:12), yet
// "STATE MISMATCH at move 1 (first)". Cause: both boards simulate every seat's first-roll
// (and every bot move) locally and commit them; when the peer's copy of the same move
// arrives, applyRemote called KV_COMMIT.check, which RE-COMMITS it on top of a chain that
// already contains it — a different position, a different hash, a false alarm.
// Fix: if the local record already holds that index, compare hashes directly (equal = the
// boards agree, nothing to do; different = genuine divergence -> halt). Only moves the
// local board has not produced are applied through the engine, and their hash is checked
// against the local record once it lands.
const fs = require("fs");
const SRC = "showcase_kascity187.html";
const DST = "showcase_kascity188.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V188") !== -1) { console.error("ABORT: v188 already applied."); process.exit(1); }

const A1 = `  function applyRemote(m){
    if(m.s===M.seat) return;
    if(window.KV_COMMIT && m.hash){
      window.KV_COMMIT.check({ index:m.i, seat:m.s, action:m.a, value:m.v||0, hash:m.hash });
    }`;

const c1 = s.split(A1).length - 1;
if (c1 !== 1) { console.error("ABORT: applyRemote anchor count " + c1 + " (expected 1). File untouched."); process.exit(1); }

s = s.replace(A1,
`  // __KV_V188: agreement check against the local record, not a re-commit
  function halt(i, a, theirs, ours){
    if(M.halted) return; M.halted = true;
    log("STATE MISMATCH at move "+i+" ("+a+") — peer "+String(theirs).slice(0,12)+", we have "+String(ours).slice(0,12), "#ff4a3a");
    if(window.KV_SHOUT) window.KV_SHOUT("GAME HALTED","the boards disagree at move "+i+" — the result will not be signed","#ff4a3a",true);
    if(window.KV_NET) window.KV_NET.diverged = true;
  }
  function verifyLater(m, tries){
    var local=(window.KV_MOVES||[])[m.i];
    if(local && local.hash){ if(m.hash && local.hash!==m.hash) halt(m.i, m.a, m.hash, local.hash); return; }
    if((tries||0) < 20) setTimeout(function(){ verifyLater(m, (tries||0)+1); }, 250);
  }
  function applyRemote(m){
    if(M.halted) return;
    if(m.s===M.seat) return;
    var local=(window.KV_MOVES||[])[m.i];
    if(local && local.i===m.i){
      // our board already produced this move (first-rolls, bots, echoes): just compare
      if(m.hash && local.hash && m.hash!==local.hash) halt(m.i, m.a, m.hash, local.hash);
      return;
    }
    // a move we did not produce: replay it, then confirm the hash once the engine records it
    if(m.hash) verifyLater(m, 0);`);

fs.writeFileSync(DST, s);
console.log("PASS anchor 1/1 — relayed moves compared against the local record; no re-commit");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
