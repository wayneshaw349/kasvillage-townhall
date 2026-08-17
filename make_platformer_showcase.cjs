// make_platformer_showcase.cjs — writes showcase_2d.html
// Side-scrolling platformer: animated procedural hero, solid platforms,
// parallax hills, following camera. A/D move, Space jump (hold = higher).
const fs = require("fs");
const engine = fs.readFileSync("scene_engine.html", "utf8");
const q = String.fromCharCode(39);

const skin = "#e8c9a0", cloth = "#3f6f9a", boot = "#3a3028", hair = "#4a3428";
function heroFrame(legA, legB, armA, armB) {
  return [
    { rect: [-3, -16, 6, 6], color: skin },
    { rect: [-4, -18, 8, 3], color: hair },
    { rect: [-4, -10, 8, 7], color: cloth },
    { rect: [-6, -10 + armA, 2, 6], color: skin },
    { rect: [4, -10 + armB, 2, 6], color: skin },
    { rect: [-3, -3 + legA, 2, 4], color: boot },
    { rect: [1, -3 + legB, 2, 4], color: boot }
  ];
}
const scene = {
  kind: "kv_game_v1", engine: "scene",
  meta: { id: "plat2d", title: "2d platformer", seed: "p2d" },
  render: { mode: "2d", zoom: 4, bg: "#141c26", post: { enabled: true, scanAlpha: 0.05 } },
  nodes: [
    { id: "sky", type: "Parallax2D", sprite: "hills", factor: 0.25, layer: 0, transform: { pos: [0, 10] } },
    { id: "cam2", type: "Camera2D", follow: "hero", smooth: 0.1 },
    { id: "hero", type: "Sprite2D", sprite: "hero", tags: ["player"], layer: 5,
      transform: { pos: [0, -40] },
      controller: { type: "platformer2d", speed: 95, jumpVelocity: 300, gravity: 900,
                    coyote: 0.1, buffer: 0.12, cornerCorrect: 4, width: 8, height: 18 } },
    { id: "ground", type: "Solid2D", size: [200, 20], color: "#3f5a3c", layer: 3, transform: { pos: [-40, 0] } },
    { id: "p1", type: "Solid2D", size: [40, 8], color: "#4a5560", layer: 3, transform: { pos: [50, -30] } },
    { id: "p2", type: "Solid2D", size: [30, 8], color: "#4a5560", layer: 3, transform: { pos: [110, -55] } },
    { id: "p3", type: "Solid2D", size: [26, 8], color: "#4a5560", layer: 3, transform: { pos: [160, -80] } },
    { id: "wall", type: "Solid2D", size: [10, 60], color: "#59636e", layer: 3, transform: { pos: [-45, -60] } },
    { id: "coin1", type: "Sprite2D", sprite: "coin", layer: 4, transform: { pos: [60, -44] } },
    { id: "coin2", type: "Sprite2D", sprite: "coin", layer: 4, transform: { pos: [118, -69] } }
  ],
  resources: {
    sprites: {
      hero: { w: 12, h: 20, origin: [0.5, 1], fps: 10,
        frames: [heroFrame(0, 0, 0, 0), heroFrame(-1, 1, 1, -1), heroFrame(0, 0, 0, 0), heroFrame(1, -1, -1, 1)] },
      coin: { w: 8, h: 8, origin: [0.5, 0.5], fps: 8,
        frames: [
          [{ circle: [0, 0, 4], color: "#d8b13a" }],
          [{ rect: [-2, -4, 4, 8], color: "#d8b13a" }],
          [{ rect: [-1, -4, 2, 8], color: "#b8912a" }],
          [{ rect: [-2, -4, 4, 8], color: "#d8b13a" }]
        ] },
      hills: { w: 120, h: 60, origin: [0, 0], frames: [[
        { poly: [[0, 60], [30, 10], [60, 60]], color: "#26323f" },
        { poly: [[45, 60], [80, 0], [120, 60]], color: "#2e3b4a" }
      ]] }
    },
    meshes: {}, materials: {}
  }
};
const inject = [
  "",
  "// ---- injected 2d platformer ----",
  "try {",
  "  loadScene(" + JSON.stringify(JSON.stringify(scene)) + ");",
  "  var __st = document.createElement(" + q + "div" + q + ");",
  "  __st.style.cssText = " + q + "position:fixed;top:8px;left:8px;z-index:9999;color:#0f0;background:#000;padding:5px;font-family:monospace;font-size:12px" + q + ";",
  "  document.body.appendChild(__st);",
  "  setInterval(function () {",
  "    var h = nodes[" + q + "hero" + q + "];",
  "    if (h) __st.textContent = " + q + "A/D move  SPACE jump (hold=higher)   x=" + q + " + h.transform.pos[0].toFixed(0) +",
  "      " + q + " y=" + q + " + h.transform.pos[1].toFixed(0) + " + q + " grounded=" + q + " + !!h._grounded;",
  "  }, 100);",
  "  var k2 = {};",
  "  window.addEventListener(" + q + "keydown" + q + ", function (e) { if (!k2[e.code]) { k2[e.code] = 1; if (e.code === " + q + "Space" + q + ") INPUT.attack.pressed = true; } });",
  "  window.addEventListener(" + q + "keyup" + q + ", function (e) { k2[e.code] = 0; });",
  "  setInterval(function () {",
  "    INPUT.move.x = (k2.KeyD ? 1 : 0) - (k2.KeyA ? 1 : 0);",
  "    INPUT.move.length = Math.abs(INPUT.move.x);",
  "    INPUT.attack.held = !!k2.Space;",
  "    setTimeout(function () { INPUT.attack.pressed = false; }, 20);",
  "  }, 16);",
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
fs.writeFileSync("showcase_2d.html", engine.slice(0, idx) + inject + engine.slice(idx));
console.log("OK showcase_2d.html — A/D move, SPACE jump; parallax hills, animated sprites");
