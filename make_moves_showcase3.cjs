// make_moves_showcase3.cjs — writes showcase_moves3.html
// roll: forward displacement + i-frames; flip: back arc; cartwheel: lateral travel.
const fs = require("fs");
const engine = fs.readFileSync("scene_engine.html", "utf8");
const q = String.fromCharCode(39);
const scene = {
  kind: "kv_game_v1", engine: "scene",
  meta: { id: "moves3", title: "moves3", seed: "m3" },
  render: { vertexSnap: 0 },
  nodes: [
    { id: "cam", type: "Camera3D", mode: "fixed", fov: 45, transform: { pos: [0, 2.2, 12] } },
    { id: "hero", type: "Actor", mesh: "body", tags: ["player"], transform: { pos: [-3, 0, 0], rot: [0, 90, 0] } }
  ],
  resources: {
    meshes: { body: { type: "silhouette", generator: "humanoid" } },
    materials: {},
    poses: {
      roll: { dur: 0.5, loop: false,
        combat: { dodge: true, phases: { active: 0.05, recovery: 0.38 } },
        tracks: {
          root:  [[0, { z: 0 }], [0.45, { z: 2.4 }], [0.5, { z: 2.4 }]],
          torso: [[0, 0], [0.25, { rx: 180 }], [0.5, { rx: 360 }]],
          legL:  [[0, 0], [0.12, { rx: -100 }], [0.38, { rx: -100 }], [0.5, 0]],
          legR:  [[0, 0], [0.12, { rx: -100 }], [0.38, { rx: -100 }], [0.5, 0]],
          shinL: [[0, 0], [0.12, { rx: 110 }], [0.38, { rx: 110 }], [0.5, 0]],
          shinR: [[0, 0], [0.12, { rx: 110 }], [0.38, { rx: 110 }], [0.5, 0]],
          armL:  [[0, 0], [0.12, { rx: -120 }], [0.38, { rx: -120 }], [0.5, 0]],
          armR:  [[0, 0], [0.12, { rx: -120 }], [0.38, { rx: -120 }], [0.5, 0]]
        } },
      flip: { dur: 0.6, loop: false,
        combat: { dodge: true, phases: { active: 0.1, recovery: 0.45 } },
        tracks: {
          root:  [[0, { y: 0, z: 0 }], [0.3, { y: 1.4, z: -0.8 }], [0.55, { y: 0, z: -1.6 }], [0.6, { y: 0, z: -1.6 }]],
          torso: [[0, 0], [0.3, { rx: -180 }], [0.6, { rx: -360 }]],
          legL:  [[0, 0], [0.2, { rx: -110 }], [0.45, { rx: -110 }], [0.6, 0]],
          legR:  [[0, 0], [0.2, { rx: -110 }], [0.45, { rx: -110 }], [0.6, 0]],
          shinL: [[0, 0], [0.2, { rx: 120 }], [0.45, { rx: 120 }], [0.6, 0]],
          shinR: [[0, 0], [0.2, { rx: 120 }], [0.45, { rx: 120 }], [0.6, 0]]
        } },
      cartwheel: { dur: 0.7, loop: false,
        combat: { dodge: true, phases: { active: 0.1, recovery: 0.55 } },
        tracks: {
          root:  [[0, { x: 0 }], [0.35, { x: 1.1, y: 0.5 }], [0.65, { x: 2.2, y: 0 }], [0.7, { x: 2.2 }]],
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
  "// ---- injected moves showcase v3 ----",
  "try {",
  "  loadScene(" + JSON.stringify(JSON.stringify(scene)) + ");",
  "  var __bar = document.createElement(" + q + "div" + q + ");",
  "  __bar.style.cssText = " + q + "position:fixed;bottom:8px;left:8px;z-index:9999;font-family:monospace" + q + ";",
  "  var __status = document.createElement(" + q + "div" + q + ");",
  "  __status.style.cssText = " + q + "color:#0f0;background:#000;padding:4px;margin-bottom:4px" + q + ";",
  "  __bar.appendChild(__status);",
  "  setInterval(function () {",
  "    var h = nodes[" + q + "hero" + q + "];",
  "    if (h) __status.textContent = " + q + "x=" + q + " + h.transform.pos[0].toFixed(1) + " + q + " z=" + q + " + h.transform.pos[2].toFixed(1) +",
  "      " + q + " phase=" + q + " + (h._combatPhase || " + q + "-" + q + ");",
  "  }, 80);",
  "  [" + q + "roll" + q + "," + q + "flip" + q + "," + q + "cartwheel" + q + "].forEach(function (mv) {",
  "    var b = document.createElement(" + q + "button" + q + ");",
  "    b.textContent = mv;",
  "    b.style.cssText = " + q + "margin-right:4px;padding:10px 14px;font-size:15px" + q + ";",
  "    b.onclick = function () { playPose(nodes[" + q + "hero" + q + "], mv); };",
  "    __bar.appendChild(b);",
  "  });",
  "  var rb = document.createElement(" + q + "button" + q + ");",
  "  rb.textContent = " + q + "reset pos" + q + ";",
  "  rb.style.cssText = " + q + "margin-right:4px;padding:10px 14px;font-size:15px" + q + ";",
  "  rb.onclick = function () { nodes[" + q + "hero" + q + "].transform.pos = [-3, 0, 0]; };",
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
fs.writeFileSync("showcase_moves3.html", engine.slice(0, idx) + inject + engine.slice(idx));
console.log("OK showcase_moves3.html — roll travels forward, flip arcs back, cartwheel goes sideways");
