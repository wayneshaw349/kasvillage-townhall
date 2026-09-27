// patch246_botshepherd.cjs
// SRC showcase_kascity245.html -> DST showcase_kascity246.html
// Stall diagnosis: bot P3's turn, go=0 kicks ignored -- the engine tree is paused on a
// pending hidden dialogue, and the v236 stale-prompt breaker only ran when the stalled
// seat was OUR OWN. Fix: the host shepherds its bots too.
//   R1: restorer guard admits host-owned bot seats (seatNow > roster length).
//   R2: breaker is prompt-text aware --
//       - a bot's "Tap to roll" ask is clicked immediately (the v245 grant validates it)
//       - stale buy/pass prompts are answered from the chain as before
//       - a bot's OWN buy/pass ask stuck >5s defaults to pass (engine bot logic
//         normally answers in <1s; 5s means it is wedged)
//   R3/R4: roll-done check and re-ask key use the stalled seat, not always M.seat.
// Count-guarded, CRLF-safe, abort-before-write.

const fs = require("fs");
const SRC = "showcase_kascity245.html";
const DST = "showcase_kascity246.html";

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

// ---------- R1: guard admits host bots ----------
rep("R1-guard",
  "        if((f.seat||1)!==M.seat) return;",
`        var seatNow=(f.seat||1);
        var hostBot=(M.role==="host" && M.roster.length && seatNow>M.roster.length);
        if(seatNow!==M.seat && !hostBot) return;   // __KV_V246: the host shepherds its bots too`);

// ---------- R2: prompt-text-aware breaker ----------
rep("R2-breaker",
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
        }`,
`        var pr=document.querySelector("div[data-i]");
        if(pr){
          var vis=!!(pr.offsetWidth||pr.offsetHeight);
          var ptxt=(pr.parentElement&&pr.parentElement.parentElement)?pr.parentElement.parentElement.textContent:"";
          var mvS=(window.KV_MOVES||[]), lr=null, lri=-1;
          for(var q=mvS.length-1;q>=0;q--){ var r2=mvS[q]; if(r2 && String(r2.a)==="roll"){ lr=r2; lri=q; break; } }
          // __KV_V246: a bot's roll ask never waits on a tap -- the turn grant validates it
          if(hostBot && /Tap to roll/.test(ptxt)){
            var el0=document.querySelector("div[data-i='0']");
            if(el0){ el0.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true}));
              log("answered bot P"+seatNow+"'s roll ask","#caa64c"); }
            return;
          }
          if(vis && !hostBot && (!lr || lr.s===M.seat)) return;   // our live prompt
          if(lr && /buy|pass|deed|block/i.test(ptxt)){
            var ch=null;
            for(var q2=lri+1;q2<mvS.length;q2++){ var r3=mvS[q2]; if(!r3||r3.s!==lr.s) continue;
              if(String(r3.a)==="buy"){ ch=0; break; } if(String(r3.a)==="pass"){ ch=1; break; } }
            if(ch===null && hostBot && lr.s===seatNow){
              // the bot's own decision is wedged: give the engine 5s, then pass
              M.__botAskAt = M.__botAskAt || {};
              var bk = mvS.length+"|"+seatNow;
              if(!M.__botAskAt[bk]){ M.__botAskAt[bk]=Date.now(); return; }
              if(Date.now()-M.__botAskAt[bk] < 5000) return;
              ch=1;
              log("bot P"+seatNow+"'s decision wedged \\u2014 passing","#e0a040");
            }
            if(ch!==null){
              var el2=document.querySelector("div[data-i='"+ch+"']");
              if(el2){ el2.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true}));
                log("cleared pending P"+lr.s+" prompt ("+(ch===0?"buy":"pass")+") \\u2014 tree resumes","#e0a040"); return; }
            }
          }
          return;                                                // genuinely pending: wait
        }`);

// ---------- R3: roll-done check uses the stalled seat ----------
rep("R3-rolldone",
  "        if(lastRoll && lastRoll.s===M.seat) return;            // we already rolled this turn",
  "        if(lastRoll && lastRoll.s===seatNow) return;           // that seat already rolled this turn");

// ---------- R4: re-ask key + log use the stalled seat ----------
rep("R4-key",
  '        var key=(f.turn||0)+"/"+M.seat+"/"+mv.length;',
  '        var key=(f.turn||0)+"/"+seatNow+"/"+mv.length;');

rep("R4-log",
  `        log("re-asking the engine for P"+M.seat+"'s roll", "#caa64c");`,
  `        log("re-asking the engine for P"+seatNow+"'s roll", "#caa64c");`);

if (errs.length) {
  console.error("ABORT -- nothing written:");
  errs.forEach(function(e){ console.error("  " + e); });
  process.exit(1);
}

let out = hadCRLF ? s.replace(/\n/g, "\r\n") : s;
fs.writeFileSync(DST, out, "utf8");
const chk = fs.readFileSync(DST, "utf8");
const must = ["__KV_V246: the host shepherds its bots too", "answered bot P", "decision wedged"];
const missing = must.filter(function(x){ return chk.indexOf(x) < 0; });
if (missing.length) { console.error("POST-WRITE CHECK FAILED", missing); process.exit(1); }
console.log("OK -> " + DST + "  (" + chk.length + " chars)");
