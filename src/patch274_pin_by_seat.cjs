// patch274_pin_by_seat.cjs — pinroll consumes the pin keyed to the seat currently rolling
// (was: first key in the object — seats ate each other's pins, so every roll got relay-corrected)
// SRC showcase_kascity273.html -> DST showcase_kascity274.html
const fs = require("fs");
const SRC = "showcase_kascity273.html";
const DST = "showcase_kascity274.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

const A = "      var ks = Object.keys(P).filter(function(k){ return k !== '__a'; });\n" +
"      if (ks.length) {\n" +
"        var k = ks[0], pv = P[k];";

const c = s.split(A).length - 1;
if (c !== 1) {
  console.error("ABORT — anchor found " + c + " times (expected 1)");
  process.exit(1);
}

const B = "      var fPin=(window.KV_FLAGS&&window.KV_FLAGS())||{};\n" +
"      var k=String(fPin.seat||\"\");\n" +
"      var pv=P[k];\n" +
"      if (pv!=null) {";

s = s.replace(A, B);
fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
