// patch258_no_landing_offer.cjs — remove "Make offer" prompt on landing (property-tap negotiate stays)
// SRC showcase_kascity257.html -> DST showcase_kascity258.html
const fs = require("fs");
const SRC = "showcase_kascity257.html";
const DST = "showcase_kascity258.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

const A = "world.flags.oq == 0 && world.flags.offer_tile == -1 && seatStat(seat(),'cash') >=";
const B = "world.flags.oq == 999 && world.flags.offer_tile == -1 && seatStat(seat(),'cash') >=";

const c = s.split(A).length - 1;
if (c < 10) {
  console.error("ABORT — trigger cond found " + c + " times (expected 10+)");
  process.exit(1);
}

s = s.split(A).join(B);
fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST + " (" + c + " landing-offer triggers disabled)");
