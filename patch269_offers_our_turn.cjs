// patch269_offers_our_turn.cjs — relay games: bot-offer scheduler fires only when it's our human's
// turn and no remote moves are queued, so offer modals never block remote replays.
// SRC showcase_kascity268.html -> DST showcase_kascity269.html
const fs = require("fs");
const SRC = "showcase_kascity268.html";
const DST = "showcase_kascity269.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

const A = '    if(dialogOpen()){ why("a dialog is open"); return; }';
const c = s.split(A).length - 1;
if (c !== 1) {
  console.error("ABORT — anchor found " + c + " times (expected 1)");
  process.exit(1);
}

s = s.replace(A, A + "\n" +
'    // __KV_V269: in a relay game, offers only during our own turn with an empty apply queue\n' +
'    var __mpO=window.KV_MP2;\n' +
'    if(__mpO && __mpO.room && __mpO.started){\n' +
'      if((__mpO.queue||[]).length){ why("remote moves pending"); return; }\n' +
'      if((f.seat||1)!==__mpO.seat){ why("not our turn"); return; }\n' +
'    }');

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
