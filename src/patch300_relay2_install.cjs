// patch300_relay2_install.cjs — Option A install.
// Appends KV_RELAY2 (kv_relay2.js, same folder) and puts the old multiplayer glue to sleep:
// KV_MP2.started stays false, so every legacy loop, stepper, gate and funnel no-ops, and the new
// module owns the room. Solo play is untouched. Old builds remain playable on disk.
// SRC showcase_kascity296.html -> DST showcase_kascity300.html
const fs = require("fs");
const SRC = "showcase_kascity296.html";
const DST = "showcase_kascity300.html";
const MOD = "kv_relay2.js";

if (!fs.existsSync(MOD)) {
  console.error("ABORT — put kv_relay2.js in this folder first");
  process.exit(1);
}

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const mod = fs.readFileSync(MOD, "utf8").replace(/\r\n/g, "\n");

// the legacy module hands the room over: it never marks itself started
const A = "  function applyRoster(roster){\n    M.roster=roster; M.started=true;";
if (s.split(A).length - 1 !== 1) {
  console.error("ABORT — legacy applyRoster not found");
  process.exit(1);
}
s = s.replace(A,
'  function applyRoster(roster){\n' +
'    // __KV_V300: KV_RELAY2 owns relay games; the legacy path stays dormant\n' +
'    if(window.KV_RELAY2){ M.roster=roster; M.started=false; return; }\n' +
'    M.roster=roster; M.started=true;');

s = s + "\n<script>\n" + mod + "\n</script>\n";

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
console.log("Use KV2.host() / KV2.join('kcXXXX') / KV2.start() — the old KV.host()/KV.join() path is dormant.");
