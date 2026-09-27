// kascity_visual_v198.cjs — relay games: no local input for seats this device doesn't own
// Proof from the host console: local record had P2's roll/buy (made on the host), relay had
// none — both boards were hotseat games on a shared seed. The engine treats seats 1..humans
// as local humans on every client. Fix at the one place all prompts render: in a relay game,
// if the seat on turn isn't in KV_HUMANS (this device's seat), hide the dialogue. The engine
// then sits at go/buy = -1 until applyRemote delivers the peer's answer from the relay.
const fs = require("fs");
const SRC = "showcase_kascity197.html";
const DST = "showcase_kascity198.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V198") !== -1) { console.error("ABORT: v198 already applied."); process.exit(1); }

const A1 = `  dlgEl.onclick = function (e) {
    var idx = e.target && e.target.getAttribute ? e.target.getAttribute("data-i") : null;
    advanceDialogue(idx === null ? 0 : parseInt(idx, 10));
  };
  dlgEl.style.display = "block";
}`;
const c1 = s.split(A1).length - 1;
if (c1 !== 1) { console.error("ABORT: renderDialogue anchor count " + c1 + " (expected 1). File untouched."); process.exit(1); }

s = s.replace(A1,
`  dlgEl.onclick = function (e) {
    var idx = e.target && e.target.getAttribute ? e.target.getAttribute("data-i") : null;
    advanceDialogue(idx === null ? 0 : parseInt(idx, 10));
  };
  // __KV_V198: in a relay game only the seat this device owns may answer a prompt;
  // a remote human's prompt stays pending until their move arrives through the relay
  try {
    var __mp = window.KV_MP2;
    if (__mp && __mp.room && __mp.started) {
      var __seat = (world && world.flags && world.flags.seat) || 1;
      if ((window.KV_HUMANS || [1]).indexOf(__seat) < 0) { dlgEl.style.display = "none"; return; }
    }
  } catch (e) {}
  dlgEl.style.display = "block";
}`);

// belt and braces: a watchdog that hides any dialogue that slipped through for a remote seat
const A2 = `    window.KV.retry=function(){ return window.KV_RETRY2(); };`;
if (s.split(A2).length - 1 !== 1) { console.error("ABORT: KV.retry anchor not unique. File untouched."); process.exit(1); }
s = s.replace(A2,
`    window.KV.retry=function(){ return window.KV_RETRY2(); };
    // __KV_V198: remote seat -> no local dialogue, ever
    setInterval(function(){
      try{
        if(!M.room || !M.started) return;
        var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};
        if((window.KV_HUMANS||[1]).indexOf(f.seat||1)>=0) return;
        var d=[...document.querySelectorAll("div")].find(function(e){ return e.parentElement && e.parentElement.id==="hud" && /Tap to roll|buy|pass|offer/i.test(e.textContent) && getComputedStyle(e).display!=="none"; });
        if(d) d.style.display="none";
      }catch(e){}
    }, 150);`);

fs.writeFileSync(DST, s);
console.log("PASS anchors 2/2 — remote seats get no local prompt; they wait on the relay");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
