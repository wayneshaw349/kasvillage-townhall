// patch236_staleprompt.cjs
// SRC showcase_kascity235.html -> DST showcase_kascity236.html
// Guest board diagnosis: engine on the guest's own seat, but P1's buy/pass dialogue is
// still pending (invisible) in the DOM -- its answer was adopted via snapshot, never
// clicked, so the behavior tree stays paused and never asks the next seat to roll.
//   P1: applyRoster + armGun set hud_seat to this device's seat (__KV_V192 rule).
//   P2: restorer upgrade -- a pending dialogue that belongs to an already-answered
//       remote move gets its recorded answer clicked (dedup eats the duplicate record),
//       resuming the tree. Live own prompts are left alone.
// Count-guarded, CRLF-safe, abort-before-write.

const fs = require("fs");
const SRC = "showcase_kascity235.html";
const DST = "showcase_kascity236.html";

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

// ---------- P1a: hud_seat in applyRoster ----------
rep("P1a-hud-roster",
  "    if(window.KV_NET) window.KV_NET.seat=M.seat;   // the commit checker reads this",
`    if(window.KV_NET) window.KV_NET.seat=M.seat;   // the commit checker reads this
    if(window.KV_SETSTATE) window.KV_SETSTATE("hud_seat", M.seat);   // __KV_V236: this device controls seat X`);

// ---------- P1b: hud_seat at the gun ----------
rep("P1b-hud-gun",
`      window.KV_SEATS_TOTAL = n;
      window.KV_MODE="p2p"; window.KV_XP_MULT=1.0;`,
`      window.KV_SEATS_TOTAL = n;
      window.KV_MODE="p2p"; window.KV_XP_MULT=1.0;
      if(window.KV_SETSTATE && M.seat) window.KV_SETSTATE("hud_seat", M.seat);   // __KV_V236`);

// ---------- P2: stale-prompt breaker inside the roll restorer ----------
rep("P2-stale-breaker",
  '        if(document.querySelector("div[data-i]")) return;      // a prompt is already up',
`        var pr=document.querySelector("div[data-i]");
        if(pr){
          // __KV_V236: a dialogue is pending. Our own live prompt: leave it.
          // A stale prompt from an already-answered remote move: click the recorded
          // answer so the behavior tree resumes (choke-point dedup eats the duplicate).
          var vis=!!(pr.offsetWidth||pr.offsetHeight);
          var mvS=(window.KV_MOVES||[]), lr=null, lri=-1;
          for(var q=mvS.length-1;q>=0;q--){ var r2=mvS[q]; if(r2 && String(r2.a)==="roll"){ lr=r2; lri=q; break; } }
          if(vis && (!lr || lr.s===M.seat)) return;              // our live prompt
          if(lr && lr.s!==M.seat){
            var ch=null;
            for(var q2=lri+1;q2<mvS.length;q2++){ var r3=mvS[q2]; if(!r3||r3.s!==lr.s) continue;
              if(String(r3.a)==="buy"){ ch=0; break; } if(String(r3.a)==="pass"){ ch=1; break; } }
            if(ch!==null){
              var el2=document.querySelector("div[data-i='"+ch+"']");
              if(el2){ el2.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true}));
                log("cleared stale P"+lr.s+" prompt ("+(ch===0?"buy":"pass")+") \\u2014 tree resumes","#e0a040"); return; }
            }
          }
          return;                                                // genuinely pending: wait
        }`);

if (errs.length) {
  console.error("ABORT -- nothing written:");
  errs.forEach(function(e){ console.error("  " + e); });
  process.exit(1);
}

let out = hadCRLF ? s.replace(/\n/g, "\r\n") : s;
fs.writeFileSync(DST, out, "utf8");
const chk = fs.readFileSync(DST, "utf8");
const must = ["__KV_V236: this device controls seat X", "cleared stale P"];
const missing = must.filter(function(x){ return chk.indexOf(x) < 0; });
if (missing.length) { console.error("POST-WRITE CHECK FAILED", missing); process.exit(1); }
console.log("OK -> " + DST + "  (" + chk.length + " chars)");
