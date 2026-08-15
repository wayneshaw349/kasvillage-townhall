// make_monopoly_showcase.cjs — writes showcase_monopoly.html
// 20-tile square board, ROLL button = dice, token hops tile to tile.
// Tiles: GO (+100 on pass), gold (+50), tax (-30), BOMB (explosion!), jail (skip a turn).
// Coin chime, boom, win jingle at 500 gold. The full-stack data test.
const fs = require("fs");
const engine = fs.readFileSync("scene_engine.html", "utf8");
const q = String.fromCharCode(39);

// board geometry: 20 tiles around a square, 6 per side (corners shared)
const tiles = [];
const S = 2.2; // tile spacing
for (let i = 0; i < 6; i++) tiles.push([i * S - 5.5, -5.5]);        // bottom, left->right
for (let i = 1; i < 6; i++) tiles.push([5.5 + 0, i * S - 5.5]);     // right, up
for (let i = 1; i < 6; i++) tiles.push([5.5 - i * S, 5.5]);         // top, right->left
for (let i = 1; i < 5; i++) tiles.push([-5.5, 5.5 - i * S]);        // left, down
// tile types by index
const kinds = tiles.map((_, i) => i === 0 ? "go" : (i === 5 ? "jail" : (i === 10 ? "bomb" : (i % 3 === 0 ? "gold" : (i % 4 === 0 ? "tax" : "plain")))));
const kindColor = { go: "#3fae5a", jail: "#666e78", bomb: "#c0392b", gold: "#d8b13a", tax: "#7a4fae", plain: "#8a8378" };

const nodes = [
  { id: "cam", type: "Camera3D", mode: "fixed", fov: 50, transform: { pos: [0, 14, 12] } },
  { id: "hero", type: "Actor", mesh: "body", tags: ["player"], transform: { pos: [tiles[0][0], 0, tiles[0][1]] } },
  { id: "board", type: "MeshInstance", mesh: "boardSlab", material: "boardMat", layer: 0, transform: { pos: [0, -0.15, 0] } }
];
tiles.forEach((t, i) => {
  nodes.push({ id: "tile" + i, type: "MeshInstance", mesh: "tile", material: "m_" + kinds[i], layer: 1,
    transform: { pos: [t[0], -0.05, t[1]] } });
});
const materials = { boardMat: { color: "#2c3438" }, body: {} };
Object.keys(kindColor).forEach(k => materials["m_" + k] = { color: kindColor[k] });

const scene = {
  kind: "kv_game_v1", engine: "scene",
  meta: { id: "monopoly", title: "kas-opoly", seed: "mp1" },
  render: { vertexSnap: 1, gouraud: true, post: { enabled: true, scanAlpha: 0.06 } },
  nodes: nodes,
  resources: {
    meshes: {
      body: { type: "silhouette", generator: "humanoid" },
      tile: { type: "box", size: [1.8, 0.12, 1.8] },
      boardSlab: { type: "box", size: [15, 0.2, 15] }
    },
    materials: materials,
    sounds: {
      coin: { type: "seq", wave: "square", notes: [[880, 0.07], [1320, 0.12]], vol: 0.35 },
      tax: { type: "seq", wave: "square", notes: [[300, 0.1], [220, 0.18]], vol: 0.35 },
      hop: { type: "tone", wave: "sine", freq: 300, sweep: 120, dur: 0.07, vol: 0.2 },
      win: { type: "seq", wave: "square", notes: [[523, 0.12], [659, 0.12], [784, 0.12], [1046, 0.3], [784, 0.1], [1046, 0.4]], vol: 0.4 }
    }
  }
};

const inject = [
  "",
  "// ---- injected monopoly ----",
  "try {",
  "  loadScene(" + JSON.stringify(JSON.stringify(scene)) + ");",
  "  var TILES = " + JSON.stringify(tiles) + ";",
  "  var KINDS = " + JSON.stringify(kinds) + ";",
  "  var pos = 0, gold = 200, jailed = false, rolling = false, won = false;",
  "  var __bar = document.createElement(" + q + "div" + q + ");",
  "  __bar.style.cssText = " + q + "position:fixed;bottom:8px;left:8px;z-index:9999;font-family:monospace" + q + ";",
  "  var __status = document.createElement(" + q + "div" + q + ");",
  "  __status.style.cssText = " + q + "color:#0f0;background:#000;padding:6px;margin-bottom:4px;font-size:15px" + q + ";",
  "  __bar.appendChild(__status);",
  "  function show(msg) { __status.textContent = " + q + "gold: " + q + " + gold + " + q + "   " + q + " + (msg || " + q + "" + q + "); }",
  "  show(" + q + "ROLL to start. 500 gold wins." + q + ");",
  "  function land() {",
  "    var k = KINDS[pos];",
  "    if (k === " + q + "gold" + q + ") { gold += 50; playSound(" + q + "coin" + q + "); show(" + q + "+50 gold!" + q + "); }",
  "    else if (k === " + q + "tax" + q + ") { gold -= 30; playSound(" + q + "tax" + q + "); show(" + q + "-30 tax" + q + "); }",
  "    else if (k === " + q + "bomb" + q + ") { explode(TILES[pos][0], 0, TILES[pos][1], 4, 8, 0); gold -= 20; show(" + q + "BOOM! -20" + q + "); }",
  "    else if (k === " + q + "jail" + q + ") { jailed = true; show(" + q + "JAIL — skip next turn" + q + "); }",
  "    else show(" + q + "landed on tile " + q + " + pos);",
  "    if (gold >= 500 && !won) { won = true; playSound(" + q + "win" + q + "); show(" + q + "*** YOU WIN ***" + q + "); }",
  "  }",
  "  function hopTo(step, target, doneFn) {",
  "    var h = nodes[" + q + "hero" + q + "];",
  "    var fx = h.transform.pos[0], fz = h.transform.pos[2];",
  "    var tx = TILES[target][0], tz = TILES[target][1];",
  "    var t0 = performance.now();",
  "    playSound(" + q + "hop" + q + ");",
  "    function anim() {",
  "      var u = Math.min(1, (performance.now() - t0) / 220);",
  "      h.transform.pos[0] = fx + (tx - fx) * u;",
  "      h.transform.pos[2] = fz + (tz - fz) * u;",
  "      h.transform.pos[1] = Math.sin(u * Math.PI) * 0.8;",
  "      if (u < 1) requestAnimationFrame(anim); else { h.transform.pos[1] = 0; doneFn(); }",
  "    }",
  "    anim();",
  "  }",
  "  function moveSteps(n2) {",
  "    if (n2 <= 0) { rolling = false; land(); return; }",
  "    var next = (pos + 1) % TILES.length;",
  "    if (next === 0) { gold += 100; playSound(" + q + "coin" + q + "); }",
  "    hopTo(0, next, function () { pos = next; moveSteps(n2 - 1); });",
  "  }",
  "  var rb = document.createElement(" + q + "button" + q + ");",
  "  rb.textContent = " + q + "ROLL" + q + ";",
  "  rb.style.cssText = " + q + "padding:14px 26px;font-size:18px;background:#2a7;color:#fff" + q + ";",
  "  rb.onclick = function () {",
  "    if (rolling || won) return;",
  "    if (jailed) { jailed = false; show(" + q + "released from jail — roll again next turn" + q + "); return; }",
  "    var d = 1 + Math.floor(Math.random() * 6);",
  "    show(" + q + "rolled " + q + " + d);",
  "    rolling = true;",
  "    moveSteps(d);",
  "  };",
  "  __bar.appendChild(rb);",
  "  document.body.appendChild(__bar);",
  "} catch (e) {",
  "  var __err = document.createElement(" + q + "div" + q + ");",
  "  __err.style.cssText = " + q + "position:fixed;top:8px;left:8px;color:#f00;background:#000;padding:6px;z-index:9999" + q + ";",
  "  __err.textContent = " + q + "INJECT ERROR: " + q + " + e.message;",
  "  document.body.appendChild(__err);",
  "}",
  ""
].join("\n");
const marker = "</script>";
const idx = engine.lastIndexOf(marker);
if (idx < 0) { console.error("ABORT: no </scr" + "ipt>"); process.exit(1); }
fs.writeFileSync("showcase_monopoly.html", engine.slice(0, idx) + inject + engine.slice(idx));
console.log("OK showcase_monopoly.html — ROLL, hop the ring, hit the BOMB tile at index 10");
