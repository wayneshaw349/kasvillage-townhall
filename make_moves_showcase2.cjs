// make_moves_showcase2.cjs — writes showcase_moves2.html
// On-screen buttons trigger moves; status bar reports errors. No devtools needed.
// Injects INSIDE the engine's script tag so scoping can't break it.
const fs = require("fs");
const engine = fs.readFileSync("scene_engine.html", "utf8");
const q = String.fromCharCode(39);
const scene = {
  kind: "kv_game_v1", engine: "scene",
  meta: { id: "moves", title: "move set", seed: "m1" },
  render: { vertexSnap: 0 },
  nodes: [
    { id: "cam", type: "Camera3D", mode: "fixed", fov: 40, transform: { pos: [6, 2.0, 9] } },
    { id: "hero", type: "Actor", mesh: "body", tags: ["player"], transform: { pos: [0, 0, 0], rot: [0, 90, 0] } }
  ],
  resources: {
    meshes: { body: { type: "silhouette", generator: "humanoid" } },
    materials: {},
    poses: {
      punch: { duration: 0.35, loop: false, tracks: {
        armR:  [[0, 0], [0.08, { rx: 25 }], [0.16, { rx: -85 }], [0.35, 0]],
        foreR: [[0, 0], [0.08, { rx: -75 }], [0.16, { rx: -5 }], [0.35, 0]],
        torso: [[0, 0], [0.16, { ry: -20 }], [0.35, 0]]
      } },
      kick: { duration: 0.45, loop: false, tracks: {
        legR:  [[0, 0], [0.10, { rx: 30 }], [0.22, { rx: -95 }], [0.45, 0]],
        shinR: [[0, 0], [0.10, { rx: 85 }], [0.22, { rx: -5 }], [0.45, 0]],
        torso: [[0, 0], [0.22, { rx: 12, ry: 10 }], [0.45, 0]],
        armL:  [[0, 0], [0.22, { rx: -50 }], [0.45, 0]]
      } },
      roll: { duration: 0.5, loop: false, tracks: {
        torso: [[0, 0], [0.25, { rx: 180 }], [0.5, { rx: 360 }]],
        legL:  [[0, 0], [0.15, { rx: -100 }], [0.4, { rx: -100 }], [0.5, 0]],
        legR:  [[0, 0], [0.15, { rx: -100 }], [0.4, { rx: -100 }], [0.5, 0]],
        shinL: [[0, 0], [0.15, { rx: 110 }], [0.4, { rx: 110 }], [0.5, 0]],
        shinR: [[0, 0], [0.15, { rx: 110 }], [0.4, { rx: 110 }], [0.5, 0]],
        armL:  [[0, 0], [0.15, { rx: -120 }], [0.4, { rx: -120 }], [0.5, 0]],
        armR:  [[0, 0], [0.15, { rx: -120 }], [0.4, { rx: -120 }], [0.5, 0]]
      } },
      flip: { duration: 0.6, loop: false, tracks: {
        torso: [[0, 0], [0.3, { rx: -180 }], [0.6, { rx: -360 }]],
        legL:  [[0, 0], [0.2, { rx: -110 }], [0.45, { rx: -110 }], [0.6, 0]],
        legR:  [[0, 0], [0.2, { rx: -110 }], [0.45, { rx: -110 }], [0.6, 0]],
        shinL: [[0, 0], [0.2, { rx: 120 }], [0.45, { rx: 120 }], [0.6, 0]],
        shinR: [[0, 0], [0.2, { rx: 120 }], [0.45, { rx: 120 }], [0.6, 0]]
      } },
      cartwheel: { duration: 0.7, loop: false, tracks: {
        torso: [[0, 0], [0.35, { rz: 180 }], [0.7, { rz: 360 }]],
        armL:  [[0, 0], [0.15, { rz: 160 }], [0.55, { rz: 160 }], [0.7, 0]],
        armR:  [[0, 0], [0.15, { rz: -160 }], [0.55, { rz: -160 }], [0.7, 0]],
        legL:  [[0, 0], [0.35, { rz: 60 }], [0.7, 0]],
        legR:  [[0, 0], [0.35, { rz: -60 }], [0.7, 0]]
      } }
    }
  }
};
const inject = [
  "",
  "// ---- injected move showcase ----",
  "try {",
  "  loadScene(" + JSON.stringify(JSON.stringify(scene)) + ");",
  "  var __bar = document.createElement(" + q + "div" + q + ");",
  "  __bar.style.cssText = " + q + "position:fixed;bottom:8px;left:8px;z-index:9999;font-family:monospace" + q + ";",
  "  var __status = document.createElement(" + q + "div" + q + ");",
  "  __status.style.cssText = " + q + "color:#0f0;background:#000;padding:4px;margin-bottom:4px" + q + ";",
  "  __status.textContent = " + q + "ready — hero: " + q + " + (nodes[" + q + "hero" + q + "] ? " + q + "OK" + q + " : " + q + "MISSING" + q + ");",
  "  __bar.appendChild(__status);",
  "  [" + q + "punch" + q + "," + q + "kick" + q + "," + q + "roll" + q + "," + q + "flip" + q + "," + q + "cartwheel" + q + "].forEach(function (mv) {",
  "    var b = document.createElement(" + q + "button" + q + ");",
  "    b.textContent = mv;",
  "    b.style.cssText = " + q + "margin-right:4px;padding:8px 12px;font-size:14px" + q + ";",
  "    b.onclick = function () {",
  "      try {",
  "        if (!poseDef(mv)) { __status.textContent = " + q + "NO POSE DEF: " + q + " + mv; return; }",
  "        playPose(nodes[" + q + "hero" + q + "], mv);",
  "        __status.textContent = " + q + "playing " + q + " + mv + (nodes[" + q + "hero" + q + "]._pose ? " + q + " (clip active)" + q + " : " + q + " (CLIP DID NOT START)" + q + ");",
  "      } catch (e) { __status.textContent = " + q + "ERROR: " + q + " + e.message; }",
  "    };",
  "    __bar.appendChild(b);",
  "  });",
  "  document.body.appendChild(__bar);",
  "} catch (e) {",
  "  document.title = " + q + "INJECT ERROR: " + q + " + e.message;",
  "  var __err = document.createElement(" + q + "div" + q + ");",
  "  __err.style.cssText = " + q + "position:fixed;top:8px;left:8px;color:#f00;background:#000;padding:6px;z-index:9999" + q + ";",
  "  __err.textContent = " + q + "INJECT ERROR: " + q + " + e.message;",
  "  document.body.appendChild(__err);",
  "}",
  ""
].join("\n");
const marker = "</script>";
const idx = engine.lastIndexOf(marker);
if (idx < 0) { console.error("ABORT: no </scr" + "ipt> in engine"); process.exit(1); }
const out = engine.slice(0, idx) + inject + engine.slice(idx);
fs.writeFileSync("showcase_moves2.html", out);
console.log("OK showcase_moves2.html — click the buttons; green status line reports state");
