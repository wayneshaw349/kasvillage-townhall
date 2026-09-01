// kascity_visual_v195.cjs — engine: seat 1's token-move rules gated on seat 1
// Seat 1's 40 per-square token tweens are guarded `seat() <= humans && pos == N && moved == 0`
// (any human on turn) while seats 2-4 use `seat() == N`. On a human P2's turn seat 1's rule
// wins, moves token_p1 to P2's square, sets moved=1, and P2's own rule never fires — P2's
// figure never moves and P1's wanders. Same defect class as the roll rule fixed in v193.
// Fix: every `seat() <= world.flags.humans && world.flags.pos == ` becomes `seat() == 1 && world.flags.pos == `.
const fs = require("fs");
const SRC = "showcase_kascity194.html";
const DST = "showcase_kascity195.html";
let s = fs.readFileSync(SRC, "utf8");

if (s.indexOf("__KV_V195") !== -1) { console.error("ABORT: v195 already applied."); process.exit(1); }

const A = "seat() <= world.flags.humans && world.flags.pos == ";
const before = s.split(A).length - 1;
if (before < 30 || before > 48) { console.error("ABORT: expected ~40 token-move rules, found " + before + ". File untouched."); process.exit(1); }
s = s.split(A).join("seat() == 1 && world.flags.pos == ");
const after = s.split(A).length - 1;
const seat2 = (s.match(/seat\(\) ==\s?2\s?&& world\.flags\.pos == /g) || []).length;

s = s.replace("<script>", "<script>/* __KV_V195: seat-1 token moves gated on seat()==1 */");
fs.writeFileSync(DST, s);
console.log("PASS rewrote " + before + " seat-1 token rules (remaining old-form: " + after + "); seat-2 token rules present: " + seat2);
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
