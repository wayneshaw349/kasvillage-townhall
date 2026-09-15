// make_345.cjs — the pre-dice gate: no local roll for a seat the chain doesn't expect.
// SRC = showcase_kascity344.html  ->  OUT = showcase_kascity345.html
// Usage (layer1 root):  node src\make_345.cjs
//
// __KV_V345 — field reasoning (kc1f67d966): rotation on the chain was perfect,
// but the local drivers kept throwing dice for seats out of turn; the gate then
// dropped them, locks fired, resyncs churned, and it *felt* like skipped turns
// and lost buys. Fix at the source — three drivers now check the relay's
// expected seat BEFORE acting:
//   (1) the bot roll-ask shepherd holds instead of clicking,
//   (2) the bot-idle kicker holds instead of kicking,
//   (3) the manual ROLL button refuses politely when it isn't our turn.
// When the relay hasn't spoken (exp unknown) behavior is unchanged.

const fs = require("fs");
const SRC = "showcase_kascity344.html";
const OUT = "showcase_kascity345.html";

let html = fs.readFileSync(SRC, "utf8");
let patches = 0;

function replaceCounted(name, anchor, replacement, expected) {
  const parts = html.split(anchor);
  const found = parts.length - 1;
  if (found !== expected) {
    console.error(`ABORT [${name}]: expected ${expected}, found ${found}`);
    process.exit(1);
  }
  html = parts.join(replacement);
  patches++;
  console.log(`ok  [${name}]`);
}

// ---- (1) bot roll-ask shepherd ----
replaceCounted(
  "gate-bot-shepherd",
  "            if((f.moved||0)>0 || (f.phase||0)>0) return;   // __KV_V264: this turn already rolled / mid-turn",
  "            if((f.moved||0)>0 || (f.phase||0)>0) return;   // __KV_V264: this turn already rolled / mid-turn\n" +
  "            var __exG=(M.__relayTurn||{}).exp;                        // __KV_V345\n" +
  "            if(__exG && __exG!==seatNow){\n" +
  "              M.__holdLog=M.__holdLog||{};\n" +
  "              if(!M.__holdLog[seatNow] || Date.now()-M.__holdLog[seatNow]>12000){ M.__holdLog[seatNow]=Date.now();\n" +
  "                log(\"holding P\"+seatNow+\"'s roll \\u2014 the chain expects P\"+__exG,\"#7a8a9a\"); }\n" +
  "              return;\n" +
  "            }",
  1
);

// ---- (2) bot-idle kicker ----
replaceCounted(
  "gate-bot-idle-kick",
  "        if((f.moved||0)>0 || (f.phase||0)>0) return;   // __KV_V264: engine already mid-turn \u2014 don't re-kick",
  "        if((f.moved||0)>0 || (f.phase||0)>0) return;   // __KV_V264: engine already mid-turn \u2014 don't re-kick\n" +
  "        var __exK=(M.__relayTurn||{}).exp;                            // __KV_V345\n" +
  "        if(__exK && __exK!==seatNow) return;",
  1
);

// ---- (3) manual ROLL button ----
replaceCounted(
  "gate-roll-button",
  "      btn.onclick=function(){",
  "      btn.onclick=function(){\n" +
  "        var __exB=(M.__relayTurn||{}).exp;                            // __KV_V345\n" +
  "        if(__exB && __exB!==M.seat){\n" +
  "          log(\"not yet \\u2014 the chain expects P\"+__exB,\"#e0a040\");\n" +
  "          return;\n" +
  "        }",
  1
);

// ---- banner ----
replaceCounted(
  "banner",
  "KasCity console ready [v344: 340 + opener-aware resync + pointer-drift + 7-turn listing]",
  "KasCity console ready [v345: 344 + pre-dice gate]",
  1
);

fs.writeFileSync(OUT, html);
console.log(`\nwrote ${OUT} (${patches} patches, ${html.length} bytes)`);
