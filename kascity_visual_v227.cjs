// kascity_visual_v227.cjs — the watchdog never steals this device's own turn
// v226 stepped the engine off seat N after 8s idle even when seat N was THIS
// device's human still deciding (their roll prompt vanished mid-thought). The
// watchdog now leaves the engine alone whenever it's on our own seat — a human
// may take as long as the game clock allows.
const fs = require("fs");
const SRC = "showcase_kascity226.html";
const DST = "showcase_kascity227.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V227") !== -1) { console.error("ABORT: v227 already applied."); process.exit(1); }

const A1 = `        if(seatNow!==lastSeat){ lastSeat=seatNow; lastChange=Date.now(); return; }`;
const c = s.split(A1).length - 1;
if (c !== 1) { console.error("ABORT: anchor count " + c + " (expected 1). File untouched."); process.exit(1); }

s = s.replace(A1,
`        if(seatNow!==lastSeat){ lastSeat=seatNow; lastChange=Date.now(); return; }
        if(seatNow===M.seat){ lastChange=Date.now(); return; }   // __KV_V227: our human is deciding — never steal the turn`);

fs.writeFileSync(DST, s);
console.log("PASS anchor 1/1 — watchdog respects this device's own turn");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
