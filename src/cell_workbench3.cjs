// cell_workbench3.cjs — pixel cell bench round 3.
// * shared frame builder: comic TITLE BOX drawn into every sprite, sky/ground
//   bands, bright-earth palette
// * one carefully drawn HAND (ref: palm-up pixel hand) reused across the
//   money cells with different held items composited on top
// * new scenarios: RENT PAID, PROPERTY TAX, RENTERS TAX, HVAC OUT,
//   ELECTRICAL FAULT, APPLIANCE DOWN, plus the originals
// keys: 1..9,0,q,w cycle cells; +/- size
"use strict";
const fs = require("fs");

// ---------------------------------------------------------------------------
// helpers: grid compose
// ---------------------------------------------------------------------------
const W = 46;
function blank(h) { const r = []; for (let i = 0; i < h; i++) r.push(".".repeat(W)); return r; }
function stamp(base, art, dx, dy) {
  const out = base.slice();
  art.forEach((row, y) => {
    const ty = y + dy; if (ty < 0 || ty >= out.length) return;
    let line = out[ty].split("");
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]; if (ch === ".") continue;
      const tx = x + dx; if (tx < 0 || tx >= W) continue;
      line[tx] = ch;
    }
    out[ty] = line.join("");
  });
  return out;
}

// ---------------------------------------------------------------------------
// THE HAND — palm up, cuff left, thumb over palm, fingers right (ref study).
// Palette: K outline, f skin, F skin-light, e skin-shadow, c cuff, C cuff-lt
// 26 wide x 13 tall.
// ---------------------------------------------------------------------------
const HAND = [
"......KKKK................",
".....KffffKK..............",
"..KKKKfFFfffKKKK..........",
".KccKffFFFfffffKKKKK......",
".KcCKfffFFFffffffffKKKK...",
".KcCKffffffffffffffffffKK.",
".KcCKfffffffffffffffFFffK.",
".KcCKffefffffffffffFFffKK.",
".KccKffeeffffffffffffKKK..",
".KccKfffeeeeffffffKKKK....",
"..KKKfffffeeeeeKKKK.......",
"....KKfffffffKK...........",
"......KKKKKKK............."
];

// held items, composited above the palm
const BILL = [
"KKKKKKKKKKKKKKKK",
"KbBBBBBBBBBBBBbK",
"KbBeeBBeeBBeeBbK",
"KbBBBBeBBeBBBBbK",
"KbBeeBBeeBBeeBbK",
"KbBBBBBBBBBBBBbK",
"KKKKKKKKKKKKKKKK"
];
const COINS = [
"..KKKK...KKKK..",
".KgGGgK.KgGGgK.",
".KgGdGK.KgGdGK.",
".KgGGgK.KgGGgK.",
"..KKKK...KKKK..",
"....KKKK.......",
"...KgGGgK......",
"...KgGdGK......",
"....KKKK......."
];
const CHECK = [
"..........KK",
".........KGK",
"........KGK.",
".KK....KGK..",
"..KGK..KGK..",
"...KGKKGK...",
"....KGGK....",
".....KK....."
];
const SCROLL = [
"KKKKKKKKKKKKKK",
"KWpppppppppppK",
"KWpKKKKKKKKppK",
"KWpppppppppppK",
"KWpKKKKKKppppK",
"KWpppppppppppK",
"KWpKKKKKKKKppK",
"KKKKKKKKKKKKKK"
];
const PCT = [    // big % sign for tax
"KKK....KK",
"KgK...KK.",
"KKK..KK..",
"....KK...",
"...KK....",
"..KK..KKK",
".KK...KgK",
"KK....KKK"
];

// ---------------------------------------------------------------------------
// scenario subjects (46 x 17), authored or composed
// ---------------------------------------------------------------------------
function handScene(item, ix, iy) {
  let g = blank(17);
  g = stamp(g, HAND, 8, 4);
  g = stamp(g, item, ix, iy);
  return g;
}

const SUBJ = {};
SUBJ.deed  = handScene(SCROLL, 16, 0);
SUBJ.rent  = stamp(handScene(BILL, 15, 0), CHECK, 33, 3);
SUBJ.ptax  = stamp(handScene(COINS, 16, 0), PCT, 34, 2);
SUBJ.rtax  = stamp(stamp(handScene(COINS, 16, 0), PCT, 34, 2), [["K"],["K"],["K"]].map(r=>r[0]), 6, 1);

// storm / pipes / house reuse the round-2 drawings, trimmed to subject band
SUBJ.storm = [
"..............KKKKKKKK........................",
"...........KKKccccccccKKK.....................",
".........KKccccCCCCCCccccKK...................",
"......KKKcccCCCCCCCCCCCCcccKKK................",
"....KKccccCCCCCCCCCCCCCCCCccccKK..............",
"...KcccccCCCCCCCCCCCCCCCCCCcccccK.............",
"...KcccddddccCCCCCCCCCCccddddcccK.............",
"....KKdddddddddccccccccddddddddKK.............",
"......KKKKKddddddddddKKKKK....................",
".....r......KKLLKK.......r....................",
"...r.......KLLlKK...........r.................",
".......r..KKLLlK......r.......................",
"...r......KLLlKK..........r...................",
".....r.....KLLK......r........................",
"...........KLK............r...................",
"....r......KLK.......r........................",
"............KK................................"
];
SUBJ.pipes = [
"..KKKKKKKKKKKKK......KKKKKKKKKKKKKKK..........",
"..KmmmmmmmmmmmK......KmmmmmmmmmmmmmK..........",
"..KMMMMMMMMMMmK......KmMMMMMMMMMMMMK..........",
"..KmmmmmmmmmmmK......KmmmmmmmmmmmmmK..........",
"..KKKKKKKKKKKKK.BBBB.KKKKKKKKKKKKKK...........",
"...............BBbbBB.........................",
"..............BbbBBbbB........................",
"...............BbbbbB.........................",
"................BbbB..........................",
".................Bb...........................",
"................BbbB..........................",
".................BB...........................",
"..................B...........................",
".................Bb...........................",
"........KKKKKK....B...........................",
"......KKbbbbbbKK..............................",
"......KbbBBBBbbK.............................."
];
SUBJ.bust = [
".................KKKK.........................",
".............KKKKrrrrKKKK.....................",
".........KKKKrrrrhhhhrrrrKKKK.................",
".....KKKKrrrrrrhhhhhhhhrrrrrrKKKK.............",
"..KKKrrrrrrrrhhhhhhhhhhhhrrrrrrrrKKK..........",
".KRRrrrrrrrhhhhhhhhhhhhhhhhrrrrrrrRRK.........",
".KRRRRrrrrrrrhhhhhhhhhhhhrrrrrrRRRRRK.........",
"..KKRRRRrrrrrrrhhhhhhhhrrrrrrRRRRKKK..........",
"....KKwwwwwwwwwwwwwwwwwwwwwwwwwwKK............",
"....KwWWwwwwwwwwwwwwwwwwwwwwwwWWwK............",
"....KwWwwwKKKKwwwwwwwwwwKKKKwwwWwK............",
"....KwWwwKbbbbKwwwwwwwwKhhhhKwwWwK............",
"....KwWwwwKKKKwwwwKKwwwwKKKKwwwWwK............",
"....KwWwwwwwwwwwwKhhKwwwwwwwwwwWwK............",
"....KwWwwKKKwwwwKhhhhKwwwKKKwwwWwK............",
"....KwWwKKwKKwwwKhhhhKwwKKwKKwwWwK............",
"....KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK............"
];
// HVAC OUT — radiator with cold squiggles + snowflake
SUBJ.hvac = [
"..............................................",
"........z...........z.........................",
".......z.z....KK...z.z........................",
"........z....KssK...z.........................",
".....KKKKKKKKKKKKKKKKKKKKKKKK.................",
".....KmmmmmmmmmmmmmmmmmmmmmmK.................",
".....KmKmKmKmKmKmKmKmKmKmKmmK.................",
".....KmKmKmKmKmKmKmKmKmKmKmmK.................",
".....KmKmKmKmKmKmKmKmKmKmKmmK.................",
".....KmKmKmKmKmKmKmKmKmKmKmmK.................",
".....KmmmmmmmmmmmmmmmmmmmmmmK.................",
".....KKKKKKKKKKKKKKKKKKKKKKKK.................",
"......KK..................KK..................",
"......KK..................KK..................",
".........s....s....s..........................",
"........sss..sss..sss.........................",
".........s....s....s........................."
];
// ELECTRICAL FAULT — outlet + big bolt + sparks
SUBJ.volt = [
"..............................................",
"..........KKKKKKKKKK..........................",
".........KmmmmmmmmmmK.....*...................",
".........KmKKmmmmKKmK...*.....................",
".........KmKKmmmmKKmK.........*...............",
".........KmmmmKKmmmmK.........................",
".........KmmmmKKmmmmK...LL....................",
".........KmmmmmmmmmmK..LLl....................",
".........KKKKKKKKKKK..LLl.....................",
"......................LLl.*...................",
".....................LLLLLL...................",
"......................LLl.....................",
".....*...............LLl......................",
"....................LL........................",
"...................LL.....*...................",
"..................LL..........................",
".................L............................"
];
// APPLIANCE DOWN — fridge with crack + drip
SUBJ.appl = [
"..........KKKKKKKKKKKKKK......................",
"..........KwwwwwwwwwwwwK......................",
"..........KwWWWWWWWWWWwK......................",
"..........KwWWWWKWWWWWwK......................",
"..........KwWWWKKWWWWWwK......................",
"..........KwwwwKwwwwwwwK......................",
"..........KKKKKKKKKKKKKK......................",
"..........KwwwwwwwwwwwwK......................",
"..........KwWWWWKWWWWWwK......................",
"..........KwWWWWWKWWWWwK......................",
"..........KwWWWWWKKWWWwK......................",
"..........KwWWWWWWKWWWwK......................",
"..........KwwwwwwwwwwwwK......................",
"..........KKKKKKKKKKKKKK......................",
"...........KK........KK.......................",
"................b.............................",
"................B............................."
];
SUBJ.walks = [
"..KKKKKKKKKKKK................................",
"..KddddddddddK................................",
"..KdDDDDDDDDdK................................",
"..KdDbbbbbbDdK..........KKKK..................",
"..KdDbbbbbbDdK.........KffffK.................",
"..KdDbbbbbbDdK.........KffffK.................",
"..KdDbbbbbbDdK..........KffK..................",
"..KdDbbbbbKbdK.........KCCCCK.................",
"..KdDbbbbbKbdK........KCCCCCCK................",
"..KdDbbbbbbDdK.......KcCCCCCCcK...............",
"..KdDbbbbbbDdK......KfKcCCCCcKfK....KKK.......",
"..KdDbbbbbbDdK......KfKcCCCCcKfK...KbbbKK.....",
"..KdDbbbbbbDdK.........KccccK......KbbbbK.....",
"..KdDbbbbbbDdK........KccKKccK.....KKKKKK.....",
"..KdDbbbbbbDdK........KccK..KccK..............",
"..KddddddddddK.......KcKK....KcK..............",
"..KKKKKKKKKKKK......KKK......KKK.............."
];
SUBJ.court = [
".............KKKK.............................",
"............KwwwwKK...........................",
"...........KwWWwwwwKK.........................",
"..........KwWWggwwwwwKK.......................",
".........KwWWgGGgwwwwwwK......................",
"........KwWWgGGGGgwwwwwK......................",
".......KdwWgGGGGGGgwwwK.......................",
"........KdwwgGGGGgwwwKKKK.....................",
".........KdwwgggggwwKKwwKK....................",
"..........KdwwwwwwwKKwwwwKK...................",
"...........KKdddwwKKwwwwwwKK..................",
".............KKKKKKKKwwwwwwKK.................",
"....KKKKKKKKKKKKKKKK..KKwwwwKK................",
"...KwwwwwwwwwwwwwwwwK...KKwwdKK...............",
"..KwWWWWWWWWWWWWWWWWwK...KKKKgK...............",
"..KwgggggggggggggggwwK......KKK...............",
"..KKKKKKKKKKKKKKKKKKKK........................"
];
SUBJ.win = [
"..............KKKKKKKK........................",
"...........KKKGGGGGGGGKKK.....................",
".........KKGGGGggggggGGGGKK...................",
"........KGGGggggddddggggGGGK..................",
".......KGGggddddddddddddggGGK.................",
"......KGGgddddKKKKKKKKddddgGGK................",
"......KGgdddKKGGGGGGGGKKdddgGK................",
".....KGGgddKGGGGGGGGGGGGKddgGGK...............",
".....KGgddKGGGGKKKKKKGGGGKddgGK...............",
".....KGgddKGGGKKgGgKKKGGGKddgGK...............",
".....KGgddKGGGGKKKKKKGGGGKddgGK...............",
".....KGGgddKGGGGGGGGGGGGKddgGGK...............",
"......KGgdddKKGGGGGGGGKKdddgGK................",
"......KGGgddddKKKKKKKKddddgGGK................",
".......KGGggddddddddddddggGGK.................",
"........KGGGggggddddggggGGGK..................",
".........KKGGGGggggggGGGGKK..................."
];

// ---------------------------------------------------------------------------
// frame builder: title box (comic style, bright box + thick border) + sky +
// ground bands around a 17-row subject. Title TEXT stays a HUD label sized to
// sit inside the box.
// ---------------------------------------------------------------------------
function frame(subject, opts) {
  const rows = [];
  const bar = "T".repeat(W - 8);
  rows.push("K".repeat(W));
  rows.push("K" + "s".repeat(W - 2) + "K");
  rows.push("K.ss" + "KKKK" + "K".repeat(W - 16) + "KKKKss.K".slice(0, 8));  // rough
  // simpler: three title rows
  rows.length = 0;
  rows.push("K".repeat(W));
  rows.push("KsK" + "T".repeat(W - 6) + "KsK");
  rows.push("KsK" + "T".repeat(W - 6) + "KsK");
  rows.push("KsK" + "T".repeat(W - 6) + "KsK");
  rows.push("K".repeat(W));
  for (let i = 0; i < 3; i++) rows.push("s".repeat(W));
  subject.forEach(r => rows.push(r.replace(/\./g, "s")));
  for (let i = 0; i < 3; i++) rows.push("g".repeat(W));
  rows.push("K".repeat(W));
  // side borders
  return rows.map(r => "K" + r.slice(1, W - 1) + "K");
}

const BASE_PAL = {
  K: "#241c12", T: "#e8543a",            // border, title box (comic red-orange)
  s: "#f4e4c1", g: "#9ab866",            // paper sky, grass ground (defaults)
  f: "#e8b488", F: "#f4cca4", e: "#c89468", c: "#5a4a6a", C: "#7a6a92",
  b: "#7cb85c", B: "#9cd87c", w: "#a8845c", W: "#c8a878", d: "#8a6a48",
  D: "#b08c64", r: "#8899b8", R: "#6b4e34", h: "#3a2e20", m: "#9aa2ac",
  M: "#c8d0d8", L: "#f0c030", l: "#f8dc70", G: "#f0c860", g2: "#e0a832",
  z: "#8cc4f0", "*": "#f8dc70", p: "#f4e4c1"
};
// per-cell overrides
const CELLS = [
  { id: "deed",  cap: "DEED SECURED",     sub: "the block is yours",  pal: { T: "#3a9e5c", s: "#bfe0ee", g: "#9ab866" } },
  { id: "rent",  cap: "RENT PAID",        sub: "on time, in full",    pal: { T: "#3a9e5c", s: "#cfe8d8", g: "#9ab866" } },
  { id: "ptax",  cap: "PROPERTY TAX",     sub: "the city collects",   pal: { T: "#c8442e", s: "#e8d8b0", g: "#b09a76" } },
  { id: "rtax",  cap: "RENTERS TAX",      sub: "every door owes",     pal: { T: "#c8442e", s: "#e8d0a8", g: "#a88a5e" } },
  { id: "pipes", cap: "PIPES BURST",      sub: "emergency plumbing",  pal: { T: "#2e6ec8", s: "#d8e4ec", g: "#b09a76" } },
  { id: "storm", cap: "STORM DAMAGE",     sub: "the roof gave way",   pal: { T: "#4a5a8a", s: "#aab2c6", g: "#7d8a63", G: "#f0c860" } },
  { id: "hvac",  cap: "HEAT IS OUT",      sub: "furnace gave up",     pal: { T: "#2e8ec8", s: "#dce8f0", g: "#b0b8c0" } },
  { id: "volt",  cap: "POWER FAULT",      sub: "wiring gone bad",     pal: { T: "#e8a020", s: "#3a3a4a", g: "#2a2a36" } },
  { id: "appl",  cap: "APPLIANCE DOWN",   sub: "the fridge died",     pal: { T: "#8a5ac8", s: "#e8e0d0", g: "#b0a890" } },
  { id: "walks", cap: "TENANT WALKS",     sub: "lease is up",         pal: { T: "#c87e2e", s: "#e6c890", g: "#a88a5e" } },
  { id: "court", cap: "COURT SUMMONS",    sub: "you are being sued",  pal: { T: "#c8442e", s: "#e3c98f", g: "#9c7b53" } },
  { id: "win",   cap: "YOU WIN THE CITY", sub: "final bell",          pal: { T: "#e0a832", s: "#8fc9e0", g: "#9ab866" } }
];

function compile(rows, pal) {
  const shapes = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === "." || !pal[ch]) { x++; continue; }
      let x2 = x;
      while (x2 < row.length && row[x2] === ch) x2++;
      shapes.push({ rect: [x, y, x2 - x, 1], color: pal[ch] });
      x = x2;
    }
  });
  return { w: W, h: rows.length, frames: [shapes] };
}

const sprites = {}; let total = 0;
CELLS.forEach(c => {
  const pal = Object.assign({}, BASE_PAL, c.pal);
  const rows = frame(SUBJ[c.id], {});
  sprites[c.id] = compile(rows, pal);
  total += sprites[c.id].frames[0].length;
});

const scene = {
  kind: "kv_game_v1", engine: "scene",
  meta: { id: "cell_workbench3", name: "Pixel Cell Workbench 3", seed: "cw3", players: 1, category: "tool" },
  debug: false, permissions: [], compliance: { maxNodes: 64 },
  render: { cameraMode: "fixed" },
  nodes: [
    { id: "floor", mesh: "floor", material: "backdrop", transform: { pos: [0, -0.6, 0] } },
    { id: "gamecam", type: "Camera3D", transform: { pos: [0, 5, 9] } },
    { id: "panel", type: "Billboard", sprite: "court", spriteSize: 7,
      transform: { pos: [0, -1.5, 0] } },
    { id: "hud", type: "CanvasLayer", children: [
      { id: "cap", type: "Label", anchor: "topCenter", pos: [0, 46], size: 22, text: "COURT SUMMONS" },
      { id: "sub", type: "Label", anchor: "topCenter", pos: [0, 74], size: 12, text: "you are being sued" },
      { id: "keys", type: "Label", anchor: "bottomCenter", pos: [0, -12], size: 11,
        text: "1 deed 2 rent 3 ptax 4 rtax 5 pipes 6 storm 7 hvac 8 volt 9 appl 0 walks q court w win  +/- size" }
    ] }
  ],
  resources: { meshes: { floor: { type: "box", size: [60, 0.5, 60] } },
    materials: { backdrop: { color: "#1c1712" } },
    sprites: sprites, poses: {}, sounds: {} }
};

const json = JSON.stringify(scene);
fs.writeFileSync("cell_workbench3.json", json);

const KEYMAP = {}; "123456789".split("").forEach((k, i) => KEYMAP[k] = CELLS[i].id);
KEYMAP["0"] = CELLS[9].id; KEYMAP["q"] = CELLS[10].id; KEYMAP["w"] = CELLS[11].id;
const CAPS = {}; CELLS.forEach(c => CAPS[c.id] = { cap: c.cap, sub: c.sub });
const switcher = `
<script>
(function () {
  var KM = ${JSON.stringify(KEYMAP)}; var CAPS = ${JSON.stringify(CAPS)};
  window.addEventListener('keydown', function (e) {
    try {
      if (KM[e.key]) { var k = KM[e.key]; nodes.panel.sprite = k;
        nodes.cap.text = CAPS[k].cap; nodes.sub.text = CAPS[k].sub; }
      else if (e.key === '+' || e.key === '=') nodes.panel.spriteSize = (nodes.panel.spriteSize || 7) + 1;
      else if (e.key === '-') nodes.panel.spriteSize = Math.max(2, (nodes.panel.spriteSize || 7) - 1);
    } catch (err) { console.warn(err); }
  });
})();
</script>`;

const engine = fs.readFileSync("scene_engine.html", "utf8");
fs.writeFileSync("cell_workbench3.html",
  engine.replace("</script>", "\ntry { loadScene(" + JSON.stringify(json) +
    "); } catch (e) { console.error('wb3 boot: ' + (e && e.message)); }\n</script>") + switcher);

console.log("OK cell_workbench3.json (" + (json.length / 1024).toFixed(1) + " KB, " +
  total + " runs, " + CELLS.length + " cells)");
console.log("OK cell_workbench3.html — 1-9,0,q,w to switch; +/- size");
