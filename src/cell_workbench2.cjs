// cell_workbench2.cjs — pixel-art comic cell bench, round 2.
// Uses the new Billboard.sprite engine path. Each cell is ONE sprite authored
// as ASCII pixel rows (reference style: pixel outlines, interior shading),
// compiled to run-length rects. One Billboard shows the active cell; keys 1-6
// switch, +/- resizes.
"use strict";
const fs = require("fs");

// ---------------------------------------------------------------------------
// ASCII pixel art. '.' = transparent. Each scene carries its own palette.
// ~46 x 30 — small enough to author, big enough to read like the references.
// ---------------------------------------------------------------------------

const SCENES = {};

// ---- COURT: gavel over sounding block (ref: pixel gavel) -------------------
SCENES.court = { cap: "COURT SUMMONS", sub: "you are being sued",
pal: { K:"#1a1512", w:"#8a6248", W:"#a87e5c", d:"#6b4a34", g:"#e0a832", G:"#f0c860", p:"#f4e4c1", s:"#e3c98f" },
rows: [
"ssssssssssssssssssssssssssssssssssssssssssssss",
"ssssssssssssssssssssssssssssssssssssssssssssss",
"pppppppppppppKKKKpppppppppppppppppppppppppppp p".replace(/ /g,""),
"ppppppppppppKwwwwKKppppppppppppppppppppppppppp",
"pppppppppppKwWWwwwwKKpppppppppppppppppppppppppp".slice(0,46),
"ppppppppppKwWWggwwwwwKKppppppppppppppppppppppp",
"pppppppppKwWWgGGgwwwwwwKppppppppppppppppppppppp".slice(0,46),
"ppppppppKwWWgGGGGgwwwwwKpppppppppppppppppppppp",
"pppppppKdwWgGGGGGGgwwwKppppppppppppppppppppppp",
"ppppppppKdwwgGGGGgwwwKKKKppppppppppppppppppppp",
"pppppppppKdwwgggggwwKKwwKKpppppppppppppppppppp",
"ppppppppppKdwwwwwwwKKwwwwKKppppppppppppppppppp",
"pppppppppppKddwwwwKKwwwwwwKKpppppppppppppppppp",
"ppppppppppppKKdddKKKKwwwwwwKKppppppppppppppppp",
"ppppppppppppppKKKppppKKwwwwwKKpppppppppppppppp",
"pppppppppppppppppppppppKKwwwwKKppppppppppppppp",
"ppppppppppppppppppppppppKKwwwwKKpppppppppppppp",
"pppppppppppppppppppppppppKKwwwwKKppppppppppppp",
"ppppppppppppppppppppppppppKKwwwwKKpppppppppppp",
"pppppppppppppppppppppppppppKKwwdKKKppppppppppp",
"ppppppppppppppppppppppppppppKKKKKgKKpppppppppp",
"pppppppppppppppppppppppppppppppKKKKppppppppppp",
"ppppKKKKKKKKKKKKKKKKKKpppppppppppppppppppppppp",
"pppKwwwwwwwwwwwwwwwwwwKppppppppppppppppppppppp",
"ppKwWWWWWWWWWWWWWWWWWWwKpppppppppppppppppppppp",
"ppKwggggggggggggggggggwKpppppppppppppppppppppp",
"ppKwGGGGGGGGGGGGGGGGGGwKpppppppppppppppppppppp",
"pKwwddddddddddddddddddwwKppppppppppppppppppppp",
"pKKKKKKKKKKKKKKKKKKKKKKKKppppppppppppppppppppp",
"ssssssssssssssssssssssssssssssssssssssssssssss"
]};

// ---- DEED: open hand receiving a banknote (ref: hand + bill) ---------------
SCENES.deed = { cap: "DEED SECURED", sub: "the block is yours",
pal: { K:"#1a1512", h:"#e0b088", H:"#caa078", c:"#5a4a6a", b:"#7cb85c", B:"#9cd87c", e:"#3a6a2c", p:"#f4e4c1", s:"#8fc9e0", g:"#9ab866" },
rows: [
"ssssssssssssssssssssssssssssssssssssssssssssss",
"ssssssssssssssssssssssssssssssssssssssssssssss",
"pppppppppppKKKKKKKKKKKKKKKKKKKppppppppppppppp p".replace(/ /g,""),
"ppppppppppKbBBBBBBBBBBBBBBBBBbKpppppppppppppp p".replace(/ /g,""),
"pppppppppKbBeeBBBBBeeeBBBBBeeBbKppppppppppppppp".slice(0,46),
"pppppppppKbBeeBBBeeBBBeeBBBeeBbKppppppppppppppp".slice(0,46),
"pppppppppKbBBBBBeeBBBBBeeBBBBBbKppppppppppppppp".slice(0,46),
"pppppppppKbBeeBBBeeBBBeeBBBeeBbKppppppppppppppp".slice(0,46),
"ppppppppppKbBBBBBBBeeeBBBBBBBbKppppppppppppppp p".replace(/ /g,""),
"pppppppppppKKKKKKKKKKKKKKKKKKKpppppppppppppppp",
"pppppppppppppppppppppppppppppppppppppppppppppp",
"ppppppppppppppppppppKKKKpppppppppppppppppppppp",
"ppppppppppppppppKKKKhhhhKKKKpppppppppppppppppp",
"ppppppppppppKKKKhhhhhhhhhhhhKKKKpppppppppppppp",
"ppppppppKKKKhhhhhhhhhhhhhhhhhhhhKKKppppppppppp",
"ppppppKKhhhhhhhhhhhhhhhhhhhhhhhhhhhKKppppppppp",
"pppppKhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhKKpppppp p".replace(/ /g,""),
"ppppKhHhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhKpppppp",
"pppKchHHhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhKKpppppp",
"pppKcchHHHHhhhhhhhhhhhhhhhhhhhhhhhhKKKppppppp p".replace(/ /g,""),
"pppKccchHHHHHHHHhhhhhhhhhhhhhhhKKKKpppppppppp p".replace(/ /g,""),
"pppKccccKKKHHHHHHHHHHHHHHHKKKKKppppppppppppppp",
"pppKcccccKppKKKKKKKKKKKKKKpppppppppppppppppppp",
"pppKccccKppppppppppppppppppppppppppppppppppppp",
"ppppKKKKpppppppppppppppppppppppppppppppppppppp",
"gggggggggggggggggggggggggggggggggggggggggggggg",
"gggggggggggggggggggggggggggggggggggggggggggggg",
"gggggggggggggggggggggggggggggggggggggggggggggg",
"gggggggggggggggggggggggggggggggggggggggggggggg",
"gggggggggggggggggggggggggggggggggggggggggggggg"
]};

// ---- STORM: cloud + lightning + rain (ref: pixel storm) --------------------
SCENES.storm = { cap: "STORM DAMAGE", sub: "the roof gave way",
pal: { K:"#3a4252", c:"#b8bcc8", C:"#d8dce4", d:"#8a93a8", L:"#f0c030", l:"#f8dc70", r:"#7c93b8", p:"#8b93a8", g:"#7d8a63" },
rows: [
"pppppppppppppppppppppppppppppppppppppppppppppp",
"ppppppppppppppKKKKKKKKpppppppppppppppppppppppp",
"pppppppppppKKKccccccccKKKppppppppppppppppppppp",
"pppppppppKKccccCCCCCCccccKKppppppppppppppppppp",
"ppppppKKKcccCCCCCCCCCCCCcccKKKpppppppppppppppp",
"ppppKKccccCCCCCCCCCCCCCCCCccccKKpppppppppppppp",
"pppKcccccCCCCCCCCCCCCCCCCCCcccccKppppppppppppp",
"ppKccccccCCCCCCCCCCCCCCCCCCccccccKpppppppppppp",
"ppKcccddddccCCCCCCCCCCCCccddddcccKpppppppppppp",
"pppKKdddddddddccccccccdddddddddKKppppppppppppp",
"ppppKKKdddddddddddddddddddddKKKppppppppppppppp",
"pppppppKKKKKddddddddddKKKKKpppppppppppppppppp p".replace(/ /g,""),
"ppppppppppppKKKKKKKKKKpppppppppppppppppppppppp",
"pppppr pppppppKLLKpppppppr pppppppppppppppppppp".replace(/ /g,"").padEnd(46,"p").slice(0,46),
"ppprpppppppppKLLlKppppppppprpppppppppppppppppp",
"pppppppr ppppKLLlKppppr pppppppppppppppppppppp p".replace(/ /g,"").padEnd(46,"p").slice(0,46),
"pprppppppppKKLLlKKpppppppppprppppppppppppppppp",
"ppppppr pppKLLlKKppppppr pppppppppppppppppppp pp".replace(/ /g,"").padEnd(46,"p").slice(0,46),
"pprpppppppppKLLlKppppppppprppppppppppppppppppp",
"ppppppppppppKLLKppppppppppppppppppppppppppppp p".replace(/ /g,""),
"pppr ppppppppKLKpppppppr pppppppppppppppppppp pp".replace(/ /g,"").padEnd(46,"p").slice(0,46),
"ppppppppppppKLKppppppppppppppppppppppppppppppp".slice(0,46),
"pprppppppr ppKKpppppr ppppppr ppppppppppppppp ppp".replace(/ /g,"").padEnd(46,"p").slice(0,46),
"pppppppppppppKpppppppppppppppppppppppppppppppp".slice(0,46),
"gggggggggggggggggggggggggggggggggggggggggggggg",
"gggggggggggggggggggggggggggggggggggggggggggggg",
"gggggggggggggggggggggggggggggggggggggggggggggg",
"gggggggggggggggggggggggggggggggggggggggggggggg",
"gggggggggggggggggggggggggggggggggggggggggggggg",
"gggggggggggggggggggggggggggggggggggggggggggggg"
]};

// ---- BUST: broken house, holed roof (ref: ruined cabin) --------------------
SCENES.bust = { cap: "BANKRUPT", sub: "the city takes it all",
pal: { K:"#241c14", w:"#a8845c", W:"#c0a070", r:"#8a6a48", R:"#6b4e34", h:"#3a2e20", b:"#5c789c", p:"#c9a98c", g:"#8a7357" },
rows: [
"pppppppppppppppppppppppppppppppppppppppppppppp",
"pppppppppppppppppppppppppppppppppppppppppppppp",
"pppppppppppppppppKKKKppppppppppppppppppppppppp",
"pppppppppppppKKKKrrrrKKKKppppppppppppppppppppp",
"pppppppppKKKKrrrrhhhhrrrrKKKKppppppppppppppppp",
"pppppKKKKrrrrrrhhhhhhhhrrrrrrKKKKppppppppppppp",
"ppKKKrrrrrrrrhhhhhhhhhhhhrrrrrrrrKKKpppppppppp",
"pKRRrrrrrrrhhhhhhhhhhhhhhhhrrrrrrrRRKppppppppp",
"pKRRRRrrrrrrrhhhhhhhhhhhhrrrrrrRRRRRKppppppppp",
"ppKKRRRRrrrrrrrhhhhhhhhrrrrrrRRRRKKKpppppppppp",
"ppppKKwwwwwwwwwwwwwwwwwwwwwwwwwwKKpppppppppppp",
"ppppKwWWwwwwwwwwwwwwwwwwwwwwwwWWwKpppppppppppp",
"ppppKwWwwwKKKKwwwwwwwwwwKKKKwwwWwKpppppppppppp",
"ppppKwWwwKbbbbKwwwwwwwwKhhhhKwwWwKpppppppppppp",
"ppppKwWwwKbbbbKwwwwwwwwKhhhhKwwWwKpppppppppppp",
"ppppKwWwwwKKKKwwwwwwwwwwKhhKwwwWwKpppppppppppp",
"ppppKwWwwwwwwwwwwKKKKwwwwKKwwwwWwKpppppppppppp",
"ppppKwWwwwwwwwwwKhhhhKwwwwwwwwwWwKpppppppppppp",
"ppppKwWwwwwwwwwwKhhhhKwwwwwwwwwWwKpppppppppppp",
"ppppKwWwwwwwwwwwKhhhhKwwwKKKwwwWwKpppppppppppp",
"ppppKwWwwKKKwwwwKhhhhKwwKKwKKwwWwKpppppppppppp",
"ppppKwWwKKwKKwwwKhhhhKwwwKKKwwwWwKpppppppppppp",
"ppppKwWwwKKKwwwwKhhhhKwwwwwwwwwWwKpppppppppppp",
"ppppKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKpppppppppppp",
"gggggggggggggggggggggggggggggggggggggggggggggg",
"gggggggggggggggggggggggggggggggggggggggggggggg",
"gggggggggggggggggggggggggggggggggggggggggggggg",
"gggggggggggggggggggggggggggggggggggggggggggggg",
"gggggggggggggggggggggggggggggggggggggggggggggg",
"gggggggggggggggggggggggggggggggggggggggggggggg"
]};

// ---- PIPES: burst pipe spraying (kept simple, same language) ---------------
SCENES.pipes = { cap: "PIPES BURST", sub: "emergency plumbing",
pal: { K:"#1a1512", m:"#8a929c", M:"#b0b8c0", b:"#5c9cd8", B:"#8cc4f0", p:"#d8cdb4", g:"#b09a76" },
rows: [
"pppppppppppppppppppppppppppppppppppppppppppppp",
"pppppppppppppppppppppppppppppppppppppppppppppp",
"ppKKKKKKKKKKKKKKKppppppKKKKKKKKKKKKKKKpppppppp",
"ppKmmmmmmmmmmmmmKppppppKmmmmmmmmmmmmmKpppppppp",
"ppKMMMMMMMMMMMMmKppppppKmMMMMMMMMMMMMKpppppppp",
"ppKmmmmmmmmmmmmmKppppppKmmmmmmmmmmmmmKpppppppp",
"ppKKKKKKKKKKKKKKKppBBppKKKKKKKKKKKKKKKpppppppp",
"pppppppppppppppppBBbbBBppppppppppppppppppppppp",
"ppppppppppppppppBbbBBbbBpppppppppppppppppppppp",
"pppppppppppppppppBbbbbBppppppppppppppppppppppp",
"ppppppppppppppppppBbbBppppppppppppppppppppppp p".replace(/ /g,""),
"pppppppppppppppppppBbppppppppppppppppppppppppp",
"ppppppppppppppppppBbbBpppppppppppppppppppppppp",
"pppppppppppppppppppBBppppppppppppppppppppppppp",
"ppppppppppppppppppppBppppppppppppppppppppppppp",
"pppppppppppppppppppBbppppppppppppppppppppppppp",
"ppppppppppppppppppppBppppppppppppppppppppppppp",
"pppppppppppppppppppppppppppppppppppppppppppppp",
"ppppppppppppppppppKKKKKKpppppppppppppppppppppp",
"ppppppppppppppppKKbbbbbbKKpppppppppppppppppppp",
"pppppppppppppppKbbBBBBBBbbKppppppppppppppppppp",
"pppppppppppppppKbbbbbbbbbbKppppppppppppppppppp",
"ppppppppppppppppKKbbbbbbKKpppppppppppppppppppp",
"ppppppppppppppppppKKKKKKpppppppppppppppppppppp",
"gggggggggggggggggggggggggggggggggggggggggggggg",
"gggggggggggggggggggggggggggggggggggggggggggggg",
"gggggggggggggggggggggggggggggggggggggggggggggg",
"gggggggggggggggggggggggggggggggggggggggggggggg",
"gggggggggggggggggggggggggggggggggggggggggggggg",
"gggggggggggggggggggggggggggggggggggggggggggggg"
]};

// ---- WALKS: door + departing figure ---------------------------------------
SCENES.walks = { cap: "TENANT WALKS", sub: "lease is up",
pal: { K:"#1a1512", d:"#8a6a48", D:"#a8845c", f:"#e0b088", c:"#5a6a8a", C:"#7a8aa8", s:"#e6b878", g:"#a88a5e", b:"#6b4e34" },
rows: [
"ssssssssssssssssssssssssssssssssssssssssssssss",
"ssssssssssssssssssssssssssssssssssssssssssssss",
"ppKKKKKKKKKKKKpppppppppppppppppppppppppppppp pp".replace(/ /g,""),
"ppKddddddddddKppppppppppppppppppppppppppppppp p".replace(/ /g,""),
"ppKdDDDDDDDDdKpppppppppppppppppppppppppppppppp".slice(0,46),
"ppKdDbbbbbbDdKpppppppppppppppppppppppppppppppp".slice(0,46),
"ppKdDbbbbbbDdKppppppppppKKKKpppppppppppppppppp",
"ppKdDbbbbbbDdKpppppppppKffffKppppppppppppppppp",
"ppKdDbbbbbbDdKpppppppppKffffKppppppppppppppppp",
"ppKdDbbbbbbDdKppppppppppKffKpppppppppppppppppp",
"ppKdDbbbbbKbdKpppppppppKCCCCKppppppppppppppppp",
"ppKdDbbbbbKbdKppppppppKCCCCCCKpppppppppppppppp",
"ppKdDbbbbbbDdKpppppppKcCCCCCCcKppppppppppppppp",
"ppKdDbbbbbbDdKpppppppKcCCCCCCcKppppppppppppppp",
"ppKdDbbbbbbDdKppppppKfKcCCCCcKfKpppppppppppppp",
"ppKdDbbbbbbDdKppppppKfKcCCCCcKfKppppKKKppppppp",
"ppKdDbbbbbbDdKpppppppppKccccKppppppKbbbKKppppp",
"ppKdDbbbbbbDdKpppppppppKccccKppppppKbbbbKppppp",
"ppKdDbbbbbbDdKppppppppKccKKccKpppppKKKKKKppppp",
"ppKdDbbbbbbDdKppppppppKccKppKccKpppppppppppppp",
"ppKdDbbbbbbDdKpppppppKccKppppKccKppppppppppppp",
"ppKddddddddddKpppppppKcKppppppKcKppppppppppppp",
"ppKKKKKKKKKKKKppppppKKKppppppppKKKpppppppppppp",
"gggggggggggggggggggggggggggggggggggggggggggggg",
"gggggggggggggggggggggggggggggggggggggggggggggg",
"gggggggggggggggggggggggggggggggggggggggggggggg",
"gggggggggggggggggggggggggggggggggggggggggggggg",
"gggggggggggggggggggggggggggggggggggggggggggggg",
"gggggggggggggggggggggggggggggggggggggggggggggg",
"gggggggggggggggggggggggggggggggggggggggggggggg"
]};

// ---- TAXES/WINNER placeholder reuses court block for now — sixth slot is
// the winner card: laurel + coin
SCENES.win = { cap: "YOU WIN THE CITY", sub: "final bell",
pal: { K:"#1a1512", G:"#f0c860", g:"#e0a832", d:"#a87820", p:"#f4e4c1", s:"#8fc9e0" },
rows: [
"ssssssssssssssssssssssssssssssssssssssssssssss",
"ssssssssssssssssssssssssssssssssssssssssssssss",
"pppppppppppppppppKKKKKKKKppppppppppppppppppppp",
"ppppppppppppppKKKGGGGGGGGKKKpppppppppppppppppp",
"ppppppppppppKKGGGGggggggGGGGKKpppppppppppppppp",
"pppppppppppKGGGggggddddggggGGGKppppppppppppppp",
"ppppppppppKGGggddddddddddddggGGKpppppppppppppp",
"pppppppppKGGgddddKKKKKKKKddddgGGKppppppppppppp",
"pppppppppKGgdddKKGGGGGGGGKKdddgGKppppppppppppp",
"ppppppppKGGgddKGGGGGGGGGGGGKddgGGKpppppppppppp",
"ppppppppKGgddKGGGGKKKKKKGGGGKddgGKpppppppppppp",
"ppppppppKGgddKGGGKppppppKGGGKddgGKpppppppppppp",
"ppppppppKGgddKGGGKppppppKGGGKddgGKpppppppppppp",
"ppppppppKGgddKGGGGKKKKKKGGGGKddgGKpppppppppppp",
"ppppppppKGGgddKGGGGGGGGGGGGKddgGGKpppppppppppp",
"pppppppppKGgdddKKGGGGGGGGKKdddgGKppppppppppppp",
"pppppppppKGGgddddKKKKKKKKddddgGGKppppppppppppp",
"ppppppppppKGGggddddddddddddggGGKpppppppppppppp",
"pppppppppppKGGGggggddddggggGGGKppppppppppppppp",
"ppppppppppppKKGGGGggggggGGGGKKpppppppppppppppp",
"ppppppppppppppKKKGGGGGGGGKKKpppppppppppppppppp",
"pppppppppppppppppKKKKKKKKppppppppppppppppppppp",
"pppppppppppppppppppppppppppppppppppppppppppppp",
"pppppppppppppppppppppppppppppppppppppppppppppp",
"pppppppppppppppppppppppppppppppppppppppppppppp",
"pppppppppppppppppppppppppppppppppppppppppppppp",
"pppppppppppppppppppppppppppppppppppppppppppppp",
"pppppppppppppppppppppppppppppppppppppppppppppp",
"pppppppppppppppppppppppppppppppppppppppppppppp",
"pppppppppppppppppppppppppppppppppppppppppppppp"
]};

// ---------------------------------------------------------------------------
// COMPILER: rows -> run-length rects per row. '.' transparent.
// ---------------------------------------------------------------------------
function compile(scene, name) {
  const pal = scene.pal;
  const W = Math.max(...scene.rows.map(r => r.length));
  const rows = scene.rows.map(r => (r + "p".repeat(W)).slice(0, W));
  const shapes = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.' || !pal[ch]) { x++; continue; }
      let x2 = x;
      while (x2 < row.length && row[x2] === ch) x2++;
      shapes.push({ rect: [x, y, x2 - x, 1], color: pal[ch] });
      x = x2;
    }
  });
  return { w: W, h: rows.length, frames: [shapes] };
}

const sprites = {};
const ORDER = ["deed", "pipes", "storm", "walks", "court", "win"];
let totalShapes = 0;
ORDER.forEach(k => { sprites[k] = compile(SCENES[k], k); totalShapes += sprites[k].frames[0].length; });

// ---------------------------------------------------------------------------
// SCENE: one Billboard at origin, fixed camera above-and-back so the sprite
// faces us; keys switch sprite id.
// ---------------------------------------------------------------------------
const scene = {
  kind: "kv_game_v1", engine: "scene",
  meta: { id: "cell_workbench2", name: "Pixel Cell Workbench", seed: "cw2", players: 1, category: "tool" },
  debug: false, permissions: [], compliance: { maxNodes: 64 },
  render: { cameraMode: "fixed" },
  nodes: [
    { id: "floor", mesh: "floor", material: "backdrop", transform: { pos: [0, -0.6, 0] } },
    { id: "gamecam", type: "Camera3D", transform: { pos: [0, 6, 10] } },
    { id: "panel", type: "Billboard", sprite: "court", spriteSize: 9,
      transform: { pos: [0, 0, 0] } },
    { id: "hud", type: "CanvasLayer", children: [
      { id: "cap", type: "Label", anchor: "topCenter", pos: [0, 14], size: 22, text: SCENES.court.cap },
      { id: "sub", type: "Label", anchor: "topCenter", pos: [0, 42], size: 13, text: SCENES.court.sub },
      { id: "keys", type: "Label", anchor: "bottomCenter", pos: [0, -14], size: 12,
        text: "1 deed  2 pipes  3 storm  4 walks  5 court  6 win   +/- size" }
    ] }
  ],
  resources: {
    meshes: { floor: { type: "box", size: [60, 0.5, 60] } },
    materials: { backdrop: { color: "#241d16" } },
    sprites: sprites, poses: {}, sounds: {}
  }
};

const json = JSON.stringify(scene);
fs.writeFileSync("cell_workbench2.json", json);

const CAPS = {};
ORDER.forEach(k => CAPS[k] = { cap: SCENES[k].cap, sub: SCENES[k].sub });
const switcher = `
<script>
(function () {
  var ORDER = ${JSON.stringify(ORDER)};
  var CAPS = ${JSON.stringify(CAPS)};
  window.addEventListener('keydown', function (e) {
    try {
      var i = parseInt(e.key, 10);
      if (i >= 1 && i <= ORDER.length) {
        var k = ORDER[i - 1];
        nodes.panel.sprite = k;
        nodes.cap.text = CAPS[k].cap; nodes.sub.text = CAPS[k].sub;
      } else if (e.key === '+' || e.key === '=') {
        nodes.panel.spriteSize = (nodes.panel.spriteSize || 9) + 1;
      } else if (e.key === '-') {
        nodes.panel.spriteSize = Math.max(2, (nodes.panel.spriteSize || 9) - 1);
      }
    } catch (err) { console.warn(err); }
  });
})();
</script>`;

const engine = fs.readFileSync("scene_engine.html", "utf8");
const inject = "\n// ---- pixel cell workbench ----\ntry { loadScene(" + JSON.stringify(json) +
  "); } catch (e) { console.error('workbench2 boot: ' + (e && e.message)); }\n";
fs.writeFileSync("cell_workbench2.html", engine.replace("</script>", inject + "\n</script>") + switcher);

console.log("OK cell_workbench2.json (" + (json.length / 1024).toFixed(1) + " KB, " +
  totalShapes + " rect runs across " + ORDER.length + " sprites)");
console.log("OK cell_workbench2.html — open, press 1-6, +/- to size");
