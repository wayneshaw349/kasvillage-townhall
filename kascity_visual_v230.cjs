// kascity_visual_v230.cjs — a lapsed or refused tile goes on bid embargo
// Bots alternated bids on the same human-owned tile forever (bid:12 -> lapse ->
// bid:12 -> lapse, six cycles), eating the game. Now any lapse:/refuse: on a tile
// starts a 3-minute embargo recorded at the move choke point (so adopted remote
// lapses count too), and the bot offer generator skips embargoed tiles.
const fs = require("fs");
const SRC = "showcase_kascity229.html";
const DST = "showcase_kascity230.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V230") !== -1) { console.error("ABORT: v230 already applied."); process.exit(1); }

const A1 = `      if(/^(p2pbuy$|buy$|renovate$|cash:|pass$)/.test(action)){`;
const A2 = `    last=Date.now(); tried[bot+":"+tile]=Date.now();`;
for (const [k, a] of [["A1", A1], ["A2", A2]]) {
  const c = s.split(a).length - 1;
  if (c !== 1) { console.error("ABORT: anchor " + k + " count " + c + " (expected 1). File untouched."); process.exit(1); }
}

s = s.replace(A1,
`      // __KV_V230: lapse/refuse puts the tile on a 3-minute bid embargo
      if(/^(lapse:|refuse:)/.test(action)){
        try{ var __bt=+String(action).split(":")[1];
          if(isFinite(__bt)){ window.__KV_BIDBLOCK=window.__KV_BIDBLOCK||{}; window.__KV_BIDBLOCK[__bt]=Date.now(); } }catch(e){}
      }
      if(/^(p2pbuy$|buy$|renovate$|cash:|pass$)/.test(action)){`);

s = s.replace(A2,
`    // __KV_V230: skip tiles under bid embargo
    try{ var __bb=(window.__KV_BIDBLOCK||{})[tile];
      if(__bb && Date.now()-__bb < 180000){ return; } }catch(e){}
    last=Date.now(); tried[bot+":"+tile]=Date.now();`);

fs.writeFileSync(DST, s);
console.log("PASS anchors 2/2 — lapsed/refused tiles embargoed from bot bids for 3 minutes");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
