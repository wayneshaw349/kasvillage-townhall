// patch273_poller_dice.cjs — the live poller's queue records carry the relay's d1/d2,
// so remote roll pins are exact (the 272 fix only covered the resync builder).
// SRC showcase_kascity272.html -> DST showcase_kascity273.html
const fs = require("fs");
const SRC = "showcase_kascity272.html";
const DST = "showcase_kascity273.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

const A = 'var m={ i:e.i, s:b2.s, a:b2.a, v:b2.v, t:b2.t, hash:b2.hash||null, snap:b2.snap||null, fx:b2.fx||null };';
const c = s.split(A).length - 1;
if (c !== 1) {
  console.error("ABORT — anchor found " + c + " times (expected 1)");
  process.exit(1);
}

s = s.replace(A,
'var m={ i:e.i, s:b2.s, a:b2.a, v:b2.v, t:b2.t, hash:b2.hash||null, snap:b2.snap||null, fx:b2.fx||null, d1:(b2.d1!=null?+b2.d1:null), d2:(b2.d2!=null?+b2.d2:null) };   // __KV_V273');

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
