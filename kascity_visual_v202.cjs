// kascity_visual_v202.cjs — symmetric opening: each client throws for the seats it owns
// Host owns itself + the bots; each guest owns itself. Every client throws (seeded) for its
// own seats and publishes; for every other seat it waits for that owner's throw from the relay.
// Once all four `first` values are present the opener is decided identically on every board.
const fs = require("fs");
const SRC = "showcase_kascity201.html";
const DST = "showcase_kascity202.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V202") !== -1) { console.error("ABORT: v202 already applied."); process.exit(1); }

// 1. outbound: back to "seats I own" only (v201 had the host publishing all four)
const A1 = `        if(!(mine(rec.s) || (rec.a==="first" && M.role==="host"))) continue;   // __KV_V201: host publishes the opening`;
// 2. expose ownership to the dialog
const A2 = `  window.KV_MP2 = M;`;
// 3. the dialog: own seat -> throw; other seat -> wait for the relay
const A3 = `        if(relay() && window.KV_MP2.role!=="host"){`;
for (const [n, a] of [["A1", A1], ["A2", A2], ["A3", A3]]) {
  const c = s.split(a).length - 1;
  if (c !== 1) { console.error("ABORT: anchor " + n + " count " + c + " (expected 1). File untouched."); process.exit(1); }
}

s = s.replace(A1, `        if(!mine(rec.s)) continue;   // __KV_V202: publish only the seats this client owns`);

s = s.replace(A2, `  window.KV_MP2 = M;
  M.owns = function(seat){ return seat===M.seat || (M.role==="host" && M.roster.length>0 && seat>M.roster.length); };   // __KV_V202`);

s = s.replace(A3, `        if(relay() && !window.KV_MP2.owns(s)){   // __KV_V202: not my seat -> its owner throws, I read`);

fs.writeFileSync(DST, s);
console.log("PASS anchors 3/3 — each client throws for owned seats, reads the rest from the relay");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
