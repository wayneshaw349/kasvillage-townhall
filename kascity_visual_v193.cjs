// kascity_visual_v193.cjs — engine: seat 1's roll rule must be gated on seat 1
// Blob analysis: the roll rules are, in order,
//   go >= 0 && seat() <= humans  -> dice, moves p1, clears go, phase=1   (seat 1's logic)
//   go >= 0 && seat() == 2       -> dice, moves p2
//   (and == 3, == 4)
// Rule 1 is guarded by "a human is on turn" instead of "seat 1 is on turn". Solo never
// notices (humans=1 => only seat 1 is human). With humans=2, seat 2's turn matches rule 1
// first, which consumes go — seat 2 can never roll. This broke 2-player hotseat and every
// relay game alike. Fix: gate rule 1 on seat() == 1.
const fs = require("fs");
const SRC = "showcase_kascity192.html";
const DST = "showcase_kascity193.html";
let s = fs.readFileSync(SRC, "utf8");

if (s.indexOf("__KV_V193") !== -1) { console.error("ABORT: v193 already applied."); process.exit(1); }

// exact on-disk form inside the loadScene("...") string: quotes are backslash-escaped
const A1 = '{\\"cond\\":\\"world.flags.go >= 0 && seat() <= world.flags.humans\\"},{\\"do\\":{\\"action\\":\\"drawCard\\"';
const c1 = s.split(A1).length - 1;
if (c1 !== 1) { console.error("ABORT: roll-rule anchor count " + c1 + " (expected 1). File untouched."); process.exit(1); }

s = s.replace(A1, '{\\"cond\\":\\"world.flags.go >= 0 && seat() == 1\\"},{\\"do\\":{\\"action\\":\\"drawCard\\"');

// marker so re-application aborts (outside the blob, harmless)
s = s.replace("<script>", "<script>/* __KV_V193: engine roll rule 1 gated on seat()==1 */");

// sanity: seat-2..4 rules still present and now reachable
const n2 = (s.match(/world\.flags\.go >= 0 &&seat\(\) == 2/g) || []).length;
fs.writeFileSync(DST, s);
console.log("PASS anchor 1/1 — rule 1 now seat()==1; seat-2 rule present: " + (n2 ? "yes" : "NO — check"));
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
