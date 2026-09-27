// patch244_derive.cjs
// SRC showcase_kascity243.html -> DST showcase_kascity244.html
// Pairs with relay v54: turn_order asks the relay to derive the opener from the
// "first" entries on the chain. The host still publishes {a:"opener"} (client-side
// hint for the ROLL button + gate), but the relay now validates it against the chain
// and refuses a mismatched declaration or a wrong first roll.
// Count-guarded, CRLF-safe, abort-before-write.

const fs = require("fs");
const SRC = "showcase_kascity243.html";
const DST = "showcase_kascity244.html";

let raw = fs.readFileSync(SRC, "utf8");
const hadCRLF = raw.indexOf("\r\n") >= 0;
let s = hadCRLF ? raw.replace(/\r\n/g, "\n") : raw;

const OLD = 'turn_order:{ seats:4, round_robin:["roll"], follow:["buy","pass"], exempt:["first"], seed:["opener"] }';
const NEW = 'turn_order:{ seats:4, round_robin:["roll"], follow:["buy","pass"], exempt:["first"], seed:["opener"], derive_opener_from:"first" }';

const c = s.split(OLD).length - 1;
if (c !== 2) { console.error("ABORT: rules literal count " + c + ", expected 2 -- nothing written"); process.exit(1); }
s = s.split(OLD).join(NEW);

let out = hadCRLF ? s.replace(/\n/g, "\r\n") : s;
fs.writeFileSync(DST, out, "utf8");
const chk = fs.readFileSync(DST, "utf8");
if (chk.split(NEW).length - 1 !== 2) { console.error("POST-WRITE CHECK FAILED"); process.exit(1); }
console.log("OK -> " + DST);
