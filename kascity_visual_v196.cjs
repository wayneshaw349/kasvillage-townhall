// kascity_visual_v196.cjs — engine: remaining seat-1 rules gated on seat 1
// Audit found two more families of seat-1 logic guarded by "any human on turn":
//   28x buy execution: buy_tile == N && buy == 0 && seat() <= humans -> shows own_N_1, poses token_p1
//    7x holding cell:  seat() <= humans -> setState p1 = 10
// Seats 2-4 use seat() == N for the same rules. Fix both families to seat() == 1.
const fs = require("fs");
const SRC = "showcase_kascity195.html";
const DST = "showcase_kascity196.html";
let s = fs.readFileSync(SRC, "utf8");

if (s.indexOf("__KV_V196") !== -1) { console.error("ABORT: v196 already applied."); process.exit(1); }

const BUY = "world.flags.buy == 0 && seat() <= world.flags.humans";
const nb = s.split(BUY).length - 1;
if (nb < 20 || nb > 36) { console.error("ABORT: expected ~28 buy rules, found " + nb + ". File untouched."); process.exit(1); }
s = s.split(BUY).join("world.flags.buy == 0 && seat() == 1");

const HOLD = '{\\"cond\\":\\"seat() <= world.flags.humans\\"},{\\"do\\":{\\"action\\":\\"setState\\",\\"args\\":[\\"p1\\",10]}}';
const nh = s.split(HOLD).length - 1;
if (nh !== 7) { console.error("ABORT: expected 7 holding rules, found " + nh + ". File untouched."); process.exit(1); }
s = s.split(HOLD).join('{\\"cond\\":\\"seat() == 1\\"},{\\"do\\":{\\"action\\":\\"setState\\",\\"args\\":[\\"p1\\",10]}}');

s = s.replace("<script>", "<script>/* __KV_V196: seat-1 buy + holding rules gated on seat()==1 */");
fs.writeFileSync(DST, s);
console.log("PASS buy rules fixed: " + nb + " | holding rules fixed: " + nh);
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
