// kascity_visual_v203.cjs — host-authoritative bots: the guest never simulates them
// Guest engine: humans = 4, so no seat auto-rolls; seats 1/3/4 advance only when their
// moves arrive from the relay (host publishes its seat + bots). Host engine: humans = roster
// length, plays bots itself. Ownership for outbound/first-roll is unchanged (v202).
const fs = require("fs");
const SRC = "showcase_kascity202.html";
const DST = "showcase_kascity203.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V203") !== -1) { console.error("ABORT: v203 already applied."); process.exit(1); }

const A1 = `      if(window.KV_SETSTATE){ window.KV_SETSTATE("humans", n); window.KV_SETSTATE("hud_seat", M.seat||1); }`;
const A2 = `    if(window.KV_SETSTATE){ window.KV_SETSTATE("humans", roster.length); window.KV_SETSTATE("hud_seat", M.seat); }  // __KV_V192`;
for (const [k, a] of [["A1", A1], ["A2", A2]]) {
  const c = s.split(a).length - 1;
  if (c !== 1) { console.error("ABORT: anchor " + k + " count " + c + " (expected 1). File untouched."); process.exit(1); }
}
s = s.replace(A1, `      if(window.KV_SETSTATE){ window.KV_SETSTATE("humans", (M.role==="host" ? n : 4)); }   // __KV_V203: guest waits on every seat`);
s = s.replace(A2, `    if(window.KV_SETSTATE){ window.KV_SETSTATE("humans", (M.role==="host" ? roster.length : 4)); }   // __KV_V203`);

fs.writeFileSync(DST, s);
console.log("PASS anchors 2/2 — host plays bots; guest applies them from the relay (humans=4)");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
