// cell_workbench.cjs — standalone comic-cell art bench.
// Renders the six event cells with NO game around them, one per screen, with
// number-key switching. Iterate the art here; port the final ICONS table back
// into the KasCity maker when it reads.
//
// Camera is a close overhead so panel space maps ~1:1 to screen space:
// panel x -> screen x, panel `up` -> screen up (negative z).
"use strict";
const fs = require("fs");

// ---------------------------------------------------------------------------
// PANEL SPACE
//   x    : across the panel, -9 .. +9
//   up   : toward the top of the panel, -4 .. +4
//   layer: 0 back, 1 mid, 2 front (only lifts Y so shapes don't z-fight)
//   rot  : degrees about the vertical axis (in-plane rotation on screen)
// ---------------------------------------------------------------------------
const CELL = [
  { id: "deed",  cap: "DEED SECURED",  sub: "the block is yours",    sky: "#8fc9e0", gnd: "#9ab866" },
  { id: "pipes", cap: "PIPES BURST",   sub: "emergency plumbing",    sky: "#d8cdb4", gnd: "#b09a76" },
  { id: "storm", cap: "STORM DAMAGE",  sub: "the roof gave way",     sky: "#8b93a8", gnd: "#7d8a63" },
  { id: "walks", cap: "TENANT WALKS",  sub: "lease is up",           sky: "#e6b878", gnd: "#a88a5e" },
  { id: "court", cap: "COURT SUMMONS", sub: "you are being sued",    sky: "#e3c98f", gnd: "#9c7b53" },
  { id: "bust",  cap: "BANKRUPT",      sub: "the city takes it all", sky: "#c9a98c", gnd: "#8a7357" }
];

const ART = {
  deed: [
    ["house_wall", 4.2, -0.6, 0], ["house_roof", 4.2, 1.1, 0],
    ["door", 4.2, -1.2, 1],
    ["post", 0.2, -0.4, 1], ["flag", 1.3, 1.5, 1],
    ["torso", -3.4, -0.5, 1], ["head", -3.4, 1.5, 1],
    ["arm", -2.3, 0.9, 2, -40], ["arm", -4.5, 0.2, 2, 20],
    ["leg", -3.9, -2.2, 1], ["leg", -2.9, -2.2, 1]
  ],
  pipes: [
    ["pipe", -0.5, 2.6, 0], ["pipe", 2.4, 2.6, 0], ["joint", 0.95, 2.6, 1],
    ["splash", 0.95, 1.4, 1], ["drop", 0.7, 0.5, 1], ["drop", 1.3, -0.2, 1],
    ["torso", -3.6, -0.5, 1], ["head", -3.6, 1.5, 1],
    ["arm", -2.5, 1.4, 2, -60], ["arm", -4.7, 0.2, 2, 20],
    ["leg", -4.1, -2.2, 1], ["leg", -3.1, -2.2, 1],
    ["wrench", -1.4, 2.2, 2, -60]
  ],
  storm: [
    ["cloud", -3.0, 3.0, 0], ["cloud", -0.6, 3.4, 0], ["cloud", 1.9, 3.0, 0],
    ["rain", -3.2, 1.4, 1, 18], ["rain", -1.6, 0.9, 1, 18], ["rain", 0.1, 1.4, 1, 18],
    ["rain", 1.7, 0.8, 1, 18], ["rain", 3.2, 1.3, 1, 18],
    ["house_wall", 4.6, -0.8, 0], ["house_roof", 4.6, 0.9, 0, 12],
    ["torso", -3.9, -0.7, 2], ["head", -3.9, 1.1, 2, 14],
    ["arm", -4.9, 0.4, 2, 50], ["leg", -4.3, -2.3, 2], ["leg", -3.4, -2.3, 2]
  ],
  walks: [
    ["frame", -4.6, 0.2, 0], ["door", -4.6, 0.1, 1], ["knob", -3.6, 0.0, 2],
    ["torso", 0.4, -0.5, 1], ["head", 0.4, 1.5, 1],
    ["arm", 1.5, 0.5, 2, -25], ["arm", -0.7, 0.6, 2, 15],
    ["leg", 1.2, -2.2, 1, 20], ["leg", -0.3, -2.2, 1, -14],
    ["case", 2.6, -0.7, 2]
  ],
  court: [
    ["bench", 0.0, -1.8, 2],
    ["torso", 0.0, 0.4, 1], ["head", 0.0, 2.3, 1],
    ["arm", 1.3, 1.7, 1, -50], ["arm", -1.3, 1.4, 1, 30],
    ["handle", 2.6, 2.9, 1, 45], ["mallet", 3.6, 3.6, 1, 45],
    ["scales", -3.9, 0.6, 0]
  ],
  bust: [
    ["house_wall", 4.4, -0.6, 0], ["house_roof", 4.4, 1.1, 0],
    ["board", 4.4, -0.2, 1, 36], ["board", 4.4, -0.2, 1, -36],
    ["torso", -3.2, -0.7, 1], ["head", -3.2, 1.0, 1, 16],
    ["arm", -4.4, -0.4, 2, 40], ["arm", -2.0, -0.4, 2, -40],
    ["leg", -3.7, -2.3, 1], ["leg", -2.7, -2.3, 1],
    ["coin", -0.4, -2.0, 2], ["coin", 0.6, -2.3, 2]
  ]
};

// mesh table — everything is a flat slab seen from directly above
const M = {
  torso:      [1.30, 2.60], head:       [1.05, 1.05],
  arm:        [1.55, 0.42], leg:        [0.45, 1.70],
  house_wall: [2.60, 2.20], house_roof: [3.30, 0.95],
  door:       [0.85, 1.60], frame:      [2.70, 3.90],
  knob:       [0.34, 0.34], post:       [0.30, 3.20],
  flag:       [1.80, 1.05], pipe:       [2.10, 0.62],
  joint:      [0.75, 0.85], splash:     [1.20, 0.55],
  drop:       [0.42, 0.60], wrench:     [1.40, 0.36],
  cloud:      [2.60, 1.35], rain:       [0.26, 1.55],
  case:       [1.25, 0.95], bench:      [7.20, 1.60],
  handle:     [1.90, 0.34], mallet:     [1.25, 1.10],
  scales:     [2.00, 0.30], board:      [3.20, 0.42],
  coin:       [0.60, 0.60]
};

const meshes = { panel: { type: "box", size: [20.5, 0.08, 10.5] },
  sky: { type: "box", size: [19.7, 0.06, 5.6] },
  gnd: { type: "box", size: [19.7, 0.06, 4.6] },
  bar_h: { type: "box", size: [20.5, 0.12, 0.46] },
  bar_v: { type: "box", size: [0.46, 0.12, 10.5] },
  speed: { type: "box", size: [4.6, 0.08, 0.16] } };
for (const k in M) meshes["m_" + k] = { type: "box", size: [M[k][0], 0.18, M[k][1]] };

const materials = { ink: { color: "#141110" }, paper: { color: "#f4e4c1" },
  backdrop: { color: "#241d16" } };
CELL.forEach(c => { materials["sky_" + c.id] = { color: c.sky };
                    materials["gnd_" + c.id] = { color: c.gnd }; });

// lay the six cells out in a column, 14 apart; camera starts on the first
const nodes = [
  { id: "terrain", mesh: "floor", material: "backdrop", transform: { pos: [0, -0.6, 0] } },
  { id: "gamecam", type: "Camera3D", transform: { pos: [0, 16, 0.01] } }
];
meshes.floor = { type: "box", size: [60, 0.5, 140] };

CELL.forEach((c, ci) => {
  const z = ci * 15;
  const kids = [
    { id: "pn_" + c.id, mesh: "panel", material: "paper", transform: { pos: [0, 0.10, 0] } },
    { id: "sk_" + c.id, mesh: "sky", material: "sky_" + c.id, transform: { pos: [0, 0.14, -2.4] } },
    { id: "gd_" + c.id, mesh: "gnd", material: "gnd_" + c.id, transform: { pos: [0, 0.14, 2.9] } },
    { id: "b1_" + c.id, mesh: "bar_h", material: "ink", transform: { pos: [0, 0.20, -5.1] } },
    { id: "b2_" + c.id, mesh: "bar_h", material: "ink", transform: { pos: [0, 0.20, 5.1] } },
    { id: "b3_" + c.id, mesh: "bar_v", material: "ink", transform: { pos: [-10.1, 0.20, 0] } },
    { id: "b4_" + c.id, mesh: "bar_v", material: "ink", transform: { pos: [10.1, 0.20, 0] } },
    { id: "sp_" + c.id, mesh: "speed", material: "ink", transform: { pos: [-6.6, 0.30, -3.9], rot: [0, 26, 0] } }
  ];
  (ART[c.id] || []).forEach((p, k) => {
    kids.push({ id: "a" + k + "_" + c.id, mesh: "m_" + p[0], material: "ink",
      transform: { pos: [p[1], 0.24 + (p[3] || 0) * 0.05, -p[2]], rot: [0, p[4] || 0, 0] } });
  });
  nodes.push({ id: "cell_" + c.id, transform: { pos: [0, 0, z] }, children: kids });
});

nodes.push({ id: "hud", type: "CanvasLayer", children: [
  { id: "cap", type: "Label", anchor: "topCenter", pos: [0, 14], size: 22, text: CELL[0].cap },
  { id: "sub", type: "Label", anchor: "topCenter", pos: [0, 42], size: 13, text: CELL[0].sub },
  { id: "keys", type: "Label", anchor: "bottomCenter", pos: [0, -14], size: 12,
    text: "press 1-6 to switch cells" }
] });

const scene = {
  kind: "kv_game_v1", engine: "scene",
  meta: { id: "cell_workbench", name: "Comic Cell Workbench", seed: "cw1", players: 1, category: "tool" },
  debug: false, permissions: [], compliance: { maxNodes: 512 },
  render: { cameraMode: "fixed" },
  nodes: nodes,
  resources: { meshes: meshes, materials: materials, poses: {}, sounds: {} }
};

const json = JSON.stringify(scene);
fs.writeFileSync("cell_workbench.json", json);

// switching is a plain key handler in the page, not engine logic — this is a
// tool, not a game, so it may reach outside the descriptor.
const switcher = `
<script>
(function () {
  var CELLS = ${JSON.stringify(CELL.map(c => ({ id: c.id, cap: c.cap, sub: c.sub })))};
  window.addEventListener('keydown', function (e) {
    var i = parseInt(e.key, 10);
    if (!(i >= 1 && i <= CELLS.length)) return;
    var c = CELLS[i - 1];
    try {
      camera.worldPos = { x: 0, y: 16, z: (i - 1) * 15 + 0.01 };
      nodes.cap.text = c.cap; nodes.sub.text = c.sub;
    } catch (err) { console.warn(err); }
  });
})();
</script>`;

const engine = fs.readFileSync("scene_engine.html", "utf8");
const inject = "\n// ---- cell workbench ----\ntry { loadScene(" + JSON.stringify(json) +
  "); } catch (e) { console.error('workbench boot: ' + (e && e.message)); }\n";
fs.writeFileSync("cell_workbench.html",
  engine.replace("</script>", inject + "\n</script>") + switcher);

console.log("OK cell_workbench.json (" + (json.length / 1024).toFixed(1) + " KB, " +
  nodes.length + " nodes)");
console.log("OK cell_workbench.html  — open it, press 1-6");
