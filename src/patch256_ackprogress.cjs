// patch256_ackprogress.cjs
// SRC showcase_kascity255.html -> DST showcase_kascity256.html
// Two fixes from the paired feeds:
// A) PROGRESSION = CHAIN-CONFIRMED. P1's rent record existed locally but never reached
//    the chain, yet every progression scan counted it -- so the 248 pass-escalation never
//    fired while both boards' watchdogs stayed pinned to P1: deadlock. Records now carry
//    an __acked flag (set on append ack, on log-sourced stubs, on resync rebuilds, on
//    drain reconciliation), and ALL progression scans (grant, outbound gate, ROLL button,
//    watchdog, decision re-ask) count only acked entries. An orphaned local record can no
//    longer satisfy "the roller progressed" -- the escalation closes the turn instead.
// B) POST-EFFECT SNAPSHOTS. rec.snap was captured at record time, BEFORE the move's
//    effects (rent!), so adopting a roll's snapshot refunded its own rent. The tail now
//    refreshes the snapshot at send time (>=1s later, effects applied).
// Count-guarded, CRLF-safe, abort-before-write.

const fs = require("fs");
const SRC = "showcase_kascity255.html";
const DST = "showcase_kascity256.html";

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

// ---------- A1: ack on append success ----------
rep("A1-ack-on-append",
  "            M.seen[o.i]=1;                 // our own entry: the /log echo is not re-applied",
`            M.seen[o.i]=1;                 // our own entry: the /log echo is not re-applied
            r.__acked=1;                   // __KV_V256: chain-confirmed`);

// ---------- A2: log-sourced drain stub is acked ----------
rep("A2-ack-drain-stub",
  "        if(!mv4[m.i]){ mv4[m.i]={ i:m.i, s:m.s, a:m.a, v:m.v, t:m.t, hash:m.hash||null, snap:m.snap||null, fx:m.fx||null }; }",
  "        if(!mv4[m.i]){ mv4[m.i]={ i:m.i, s:m.s, a:m.a, v:m.v, t:m.t, hash:m.hash||null, snap:m.snap||null, fx:m.fx||null, __sent:1, __acked:1 }; }");

// ---------- A3: force-adopt stub is acked ----------
rep("A3-ack-force-stub",
  "        if(!mv[m.i]){ mv[m.i]={ i:m.i, s:m.s, a:m.a, v:m.v, t:m.t, hash:m.hash||null, snap:m.snap||null, fx:m.fx||null }; }",
  "        if(!mv[m.i]){ mv[m.i]={ i:m.i, s:m.s, a:m.a, v:m.v, t:m.t, hash:m.hash||null, snap:m.snap||null, fx:m.fx||null, __sent:1, __acked:1 }; }");

// ---------- A4: resync rebuild is acked ----------
rep("A4-ack-resync",
  '        var rec={ i:e.i, s:b.s, a:b.a, v:b.v, t:b.t, hash:b.hash||null, snap:b.snap||null, fx:b.fx||null, __sent:1 };',
  '        var rec={ i:e.i, s:b.s, a:b.a, v:b.v, t:b.t, hash:b.hash||null, snap:b.snap||null, fx:b.fx||null, __sent:1, __acked:1 };');

// ---------- A5: drain own-echo reconciliation acks ----------
rep("A5-ack-reconcile",
  "      }catch(e0){}",
`        if(mv0[m.i]) mv0[m.i].__acked=1;   // __KV_V256: log echoed it -- chain-confirmed
      }catch(e0){}`);

// ---------- A6: progression scans count acked entries only ----------
// A6-grant removed: patch249 E1 deleted the choke-point grant block entirely

rep("A6-outbound",
  "              for(var __u2=__gi+1;__u2<__mvG.length;__u2++){ var __q2=__mvG[__u2]; if(__q2 && __q2!==rec && __q2.s===__lr.s){ __dn2=true; break; } }",
  "              for(var __u2=__gi+1;__u2<__mvG.length;__u2++){ var __q2=__mvG[__u2]; if(__q2 && __q2!==rec && __q2.__acked && __q2.s===__lr.s){ __dn2=true; break; } }");

rep("A6-button",
  "        if(q && q.s===lr.s){ __prog=true; break; } }              // __KV_V247: roller progressed",
  "        if(q && q.__acked && q.s===lr.s){ __prog=true; break; } }   // __KV_V256: chain-confirmed progression only");

rep("A6-watchdog",
  "        var __wdn=false; for(var __wj=__wli+1;__wj<mv.length;__wj++){ var __wq=mv[__wj]; if(__wq && __wq.s===lastRoll.s){ __wdn=true; break; } }",
  "        var __wdn=false; for(var __wj=__wli+1;__wj<mv.length;__wj++){ var __wq=mv[__wj]; if(__wq && __wq.__acked && __wq.s===lastRoll.s){ __wdn=true; break; } }");

rep("A6-reask",
  "          var __ddn=false; for(var __dj=__dli+1;__dj<mv.length;__dj++){ var __dq=mv[__dj]; if(__dq && __dq.s===seatNow){ __ddn=true; break; } }",
  "          var __ddn=false; for(var __dj=__dli+1;__dj<mv.length;__dj++){ var __dq=mv[__dj]; if(__dq && __dq.__acked && __dq.s===seatNow){ __ddn=true; break; } }");

// ---------- B: post-effect snapshot at send time ----------
rep("B1-send-snap",
`        (function(r){
          ord("/api/game/room/"+M.room+"/append", { wallet:wallet(), kind:"move",`,
`        (function(r){
          try{ if(window.KV_SNAPSHOT) r.snap = window.KV_SNAPSHOT(); }catch(eS){}   // __KV_V256: post-effect state
          ord("/api/game/room/"+M.room+"/append", { wallet:wallet(), kind:"move",`);

if (errs.length) {
  console.error("ABORT -- nothing written:");
  errs.forEach(function(e){ console.error("  " + e); });
  process.exit(1);
}

let out = hadCRLF ? s.replace(/\n/g, "\r\n") : s;
fs.writeFileSync(DST, out, "utf8");
const chk = fs.readFileSync(DST, "utf8");
const must = ["__KV_V256: chain-confirmed", "__KV_V256: post-effect state", "__KV_V256: chain-confirmed progression only"];
const missing = must.filter(function(x){ return chk.indexOf(x) < 0; });
if (missing.length) { console.error("POST-WRITE CHECK FAILED", missing); process.exit(1); }
console.log("OK -> " + DST + "  (" + chk.length + " chars)");
