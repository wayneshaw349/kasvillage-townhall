// kascity_visual_v192.cjs — tell the engine which seat this device controls
// Guest flags showed seat:2 but hud_seat:1 and asked:0 — the engine prompts for input on
// hud_seat, so it never asked P2 to roll and ignored both the Roll tap and go=0.
// Fix: set hud_seat = local seat at roster time and at the gun. Both clients keep
// humans = roster length (both simulate bots from the shared seed; v188's hash comparison
// verifies agreement) — the humans=4 experiment is reverted.
const fs = require("fs");
const SRC = "showcase_kascity191.html";
const DST = "showcase_kascity192.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V192") !== -1) { console.error("ABORT: v192 already applied."); process.exit(1); }

const A1 = `      if(window.KV_SETSTATE){ window.KV_SETSTATE("humans", (M.role==="host" ? n : 4)); window.KV_SETSTATE("seat", M.seat||1); }`;
const A2 = `    if(window.KV_SETSTATE){ window.KV_SETSTATE("humans", (M.role==="host" ? roster.length : 4)); window.KV_SETSTATE("seat", M.seat); }`;

for (const [n, a] of [["A1", A1], ["A2", A2]]) {
  const c = s.split(a).length - 1;
  if (c !== 1) { console.error("ABORT: anchor " + n + " count " + c + " (expected 1). File untouched."); process.exit(1); }
}

s = s.replace(A1,
`      // __KV_V192: hud_seat is the engine's "this device controls seat X"; without it the engine never asks for input
      if(window.KV_SETSTATE){ window.KV_SETSTATE("humans", n); window.KV_SETSTATE("hud_seat", M.seat||1); }`);

s = s.replace(A2,
`    if(window.KV_SETSTATE){ window.KV_SETSTATE("humans", roster.length); window.KV_SETSTATE("hud_seat", M.seat); }  // __KV_V192`);

// also: the outbound tail should send own seat only now that both clients simulate bots
const A3 = `      if(M.role==="host" && M.roster.length && seat>M.roster.length) return true;`;
if (s.split(A3).length - 1 !== 1) { console.error("ABORT: outbound mine() anchor not unique. File untouched."); process.exit(1); }
s = s.replace(A3, `      if(M.role==="host" && M.roster.length && seat>M.roster.length) return true;   // host still publishes bot moves so the guest can verify`);

fs.writeFileSync(DST, s);
console.log("PASS anchors 3/3 — hud_seat set per device; both clients simulate bots, host publishes them for verification");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
