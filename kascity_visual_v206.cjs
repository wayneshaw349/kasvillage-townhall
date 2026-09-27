// kascity_visual_v206.cjs — remote inputs answer the engine's prompt, not just the flag
// Guest KV.why(): seat 3, go 0, buy 0, asked 1, phase 0 — and no roll. The engine pauses its
// tree while a dialogue (prompt) is pending; own-seat clicks call advanceDialogue which sets
// the flag AND closes the prompt. Remote inputs only set the flag, so the hidden prompt kept
// the tree paused. Now the drain loop also "clicks" the hidden prompt's matching choice:
// roll -> choice 0, buy -> 0, pass -> 1 (the engine's own onclick handles it).
const fs = require("fs");
const SRC = "showcase_kascity205.html";
const DST = "showcase_kascity206.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V206") !== -1) { console.error("ABORT: v206 already applied."); process.exit(1); }

const A1 = `    M.assertN=(M.assertN||0)+1;
    if(M.assertN===1 || M.assertN%3===0) applyRemote(m);                 // re-assert every ~1.2s`;
const c1 = s.split(A1).length - 1;
if (c1 !== 1) { console.error("ABORT: drain anchor count " + c1 + " (expected 1). File untouched."); process.exit(1); }

s = s.replace(A1,
`    M.assertN=(M.assertN||0)+1;
    if(M.assertN===1 || M.assertN%3===0) applyRemote(m);                 // re-assert every ~1.2s
    // __KV_V206: answer the pending (hidden) prompt like a click would, so the tree resumes
    try{
      var a=String(m.a||""), choice=null;
      if(a==="roll"||a==="buy") choice=0; else if(a==="pass") choice=1;
      if(choice!==null){
        var el=document.querySelector("#hud div[data-i='"+choice+"']") || document.querySelector("div[data-i='"+choice+"']");
        if(el){
          var txt=(el.parentElement&&el.parentElement.parentElement)?el.parentElement.parentElement.textContent:"";
          var fits = (a==="roll") ? /Tap to roll/.test(txt) : /buy|pass|deed|block/i.test(txt);
          if(fits){ el.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true})); }
        }
      }
    }catch(e){}`);

fs.writeFileSync(DST, s);
console.log("PASS anchor 1/1 — remote roll/buy/pass now answer the engine prompt (tree resumes)");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
