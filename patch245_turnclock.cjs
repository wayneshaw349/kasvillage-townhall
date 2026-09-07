// patch245_turnclock.cjs
// SRC showcase_kascity244.html -> DST showcase_kascity245.html
// Chain-clocked engine, step 1:
//   P1: fan() bug fix + node health. The reseed check tested indexOf("404")===0 against
//       "HTTP 404 ..." so it NEVER reseeded -- that is the 82.65.58.211 404 flood. Fixed
//       to "HTTP 404". Per-node failure counters; 6 consecutive failures evicts the node
//       from M.nodes and resets the orderer list (kept >= 1 node).
//   P2/P3: ord() success resets the node's counter; ord() failure counts and evicts.
//   P4: TURN GRANT at the KV_MOVE choke point -- in a relay game, an engine-generated
//       roll/buy/pass for a seat the chain does not grant is VOID (not recorded, not
//       posted), logged, and a resync is scheduled to repair any local visual effects.
//       Remote replays (applying window) are exempt. This makes off-turn engine
//       free-running (bots, stale go kicks, stray prompts) harmless: the chain is the clock.
// Count-guarded, CRLF-safe, abort-before-write.

const fs = require("fs");
const SRC = "showcase_kascity244.html";
const DST = "showcase_kascity245.html";

let raw = fs.readFileSync(SRC, "utf8");
const hadCRLF = raw.indexOf("\r\n") >= 0;
let s = hadCRLF ? raw.replace(/\r\n/g, "\n") : raw;

const errs = [];
function count(h, n){ return h.split(n).length - 1; }
function rep(label, o, n, expect){
  expect = expect == null ? 1 : expect;
  const c = count(s, o);
  if (c !== expect) { errs.push(`[${label}] anchor count ${c}, expected ${expect}`); return; }
  s = s.split(o).join(n);
}
function span(label, a0, a1, n){
  const c0 = count(s, a0), c1 = count(s, a1);
  if (c0 !== 1) { errs.push(`[${label}] start count ${c0}`); return; }
  if (c1 !== 1) { errs.push(`[${label}] end count ${c1}`); return; }
  const i0 = s.indexOf(a0), i1 = s.indexOf(a1);
  if (i1 < i0) { errs.push(`[${label}] end before start`); return; }
  s = s.slice(0, i0) + n + s.slice(i1 + a1.length);
}

// ---------- P0: M state gains bad counter map ----------
rep("P0-state",
  "  var M = { nodes:[], room:null, wallet:null, seat:0, roster:[], started:false, seen:{}, hi:-1, polling:false, logN:0, ordIdx:0, ordList:null };",
  "  var M = { nodes:[], room:null, wallet:null, seat:0, roster:[], started:false, seen:{}, hi:-1, polling:false, logN:0, ordIdx:0, ordList:null, bad:{} };");

// ---------- P1: fan() -- reseed fix + health eviction ----------
span("P1-fan",
`  async function fan(path, body, reseedable){`,
`        if(reseedable && String(e.message).indexOf("404")===0){ await seedNode(u); return one(u, path, body); }
        throw e;
      }
    }));`,
`  async function fan(path, body, reseedable){
    if(!M.nodes.length) await discover();
    var res = await Promise.allSettled(M.nodes.map(async function(u){
      try {
        var out = await one(u, path, body);
        M.bad[u]=0;
        return out;
      }
      catch(e){
        // __KV_V245: "HTTP 404 ..." -- the old indexOf("404")===0 never matched, so
        // reseed never fired and a wiped node 404-spammed forever
        if(reseedable && String(e && e.message).indexOf("HTTP 404")===0){
          try{ await seedNode(u); var out2 = await one(u, path, body); M.bad[u]=0; return out2; }
          catch(e2){ e=e2; }
        }
        M.bad[u]=(M.bad[u]||0)+1;
        if(M.bad[u]===6 && M.nodes.length>1){
          M.nodes=M.nodes.filter(function(x){ return x!==u; });
          M.ordList=null;
          log("node evicted after repeated failures: "+u, "#e0a040");
        }
        throw e;
      }
    }));`);

// ---------- P2: ord() success resets health ----------
rep("P2-ord-ok",
`        var out = await one(u, path, body);
        if(k>0){ M.ordIdx = at; log("orderer failover -> "+u, "#e0a040"); }
        return out;`,
`        var out = await one(u, path, body);
        M.bad[u]=0;
        if(k>0){ M.ordIdx = at; log("orderer failover -> "+u, "#e0a040"); }
        return out;`);

// ---------- P3: ord() failure counts and evicts ----------
rep("P3-ord-bad",
`            return out2;
          }catch(e2){}
        }
      }`,
`            return out2;
          }catch(e2){}
        }
        M.bad[u]=(M.bad[u]||0)+1;
        if(M.bad[u]>=6 && M.nodes.length>1){
          M.nodes=M.nodes.filter(function(x){ return x!==u; });
          M.ordList=null;
          log("orderer candidate evicted: "+u, "#e0a040");
        }
      }`);

// ---------- P4: turn grant at the record choke point ----------
rep("P4-turn-grant",
`      var rec={i:__idx, s:seat, a:action, v:arg, t:left};
      if(fx) rec.fx = fx;`,
`      // __KV_V245: turn grant -- the chain is the clock; off-turn engine output is void
      if (__mp && __mp.room && __mp.started && !(__mp.applying && __mp.applying.s === seat)) {
        if (/^(roll|buy|pass)$/.test(String(action))) {
          var __ok = true, __mvT = window.KV_MOVES, __lrT = null;
          for (var __t=__mvT.length-1; __t>=0; __t--) { var __rT=__mvT[__t]; if(__rT && String(__rT.a)==="roll"){ __lrT=__rT; break; } }
          if (String(action)==="roll") {
            if (__lrT) __ok = (seat === ((__lrT.s % 4) + 1));
            else if (__mp.opener != null) __ok = (seat === __mp.opener);
          } else {
            __ok = !!(__lrT && __lrT.s === seat);
          }
          if (!__ok) {
            if (window.KV_LOG) window.KV_LOG("void: P"+seat+" "+action+" out of turn \\u2014 the chain is the clock", "#e0a040");
            try { if (__mp.resync) setTimeout(function(){ __mp.resync("out-of-turn generation"); }, 200); } catch(eG){}
            return null;
          }
        }
      }
      var rec={i:__idx, s:seat, a:action, v:arg, t:left};
      if(fx) rec.fx = fx;`);

if (errs.length) {
  console.error("ABORT -- nothing written:");
  errs.forEach(function(e){ console.error("  " + e); });
  process.exit(1);
}

let out = hadCRLF ? s.replace(/\n/g, "\r\n") : s;
fs.writeFileSync(DST, out, "utf8");
const chk = fs.readFileSync(DST, "utf8");
const must = ["__KV_V245: turn grant", "node evicted after repeated failures", 'indexOf("HTTP 404")===0'];
const missing = must.filter(function(x){ return chk.indexOf(x) < 0; });
if (missing.length) { console.error("POST-WRITE CHECK FAILED", missing); process.exit(1); }
console.log("OK -> " + DST + "  (" + chk.length + " chars)");
