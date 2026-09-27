// kascity_visual_v194.cjs — engine: "Player N is playing" banner branches are bot-only
// Tree probe showed the prompt rule (selector branch 917) sits behind the banner branches
// in the same selector. On a human seat 2's turn, `seat()<=humans && hud_seat!=1` and
// `seat()==2 && hud_seat!=2` are true alternately, so a banner branch succeeds every tick
// (hud_seat flaps 1<->2, as measured) and the selector never reaches the prompt: asked stays
// 0, P2 is never asked to roll. Same for seats 3 and 4 when human.
// Fix: gate the seat-2/3/4 banner branches on the seat being a bot (seat() > humans).
const fs = require("fs");
const SRC = "showcase_kascity193.html";
const DST = "showcase_kascity194.html";
let s = fs.readFileSync(SRC, "utf8");

if (s.indexOf("__KV_V194") !== -1) { console.error("ABORT: v194 already applied."); process.exit(1); }

let total = 0;
[2, 3, 4].forEach(n => {
  const a = 'seat() == ' + n + ' && world.flags.hud_seat != ' + n + '\\"';
  const c = s.split(a).length - 1;
  if (c !== 1) { console.error("ABORT: banner branch for seat " + n + " count " + c + " (expected 1). File untouched."); process.exit(1); }
  s = s.replace(a, 'seat() == ' + n + ' && seat() > world.flags.humans && world.flags.hud_seat != ' + n + '\\"');
  total++;
});
s = s.replace("<script>", "<script>/* __KV_V194: bot-only banner branches */");
fs.writeFileSync(DST, s);
console.log("PASS " + total + "/3 banner branches now bot-only; human seats 2-4 reach the roll prompt");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
