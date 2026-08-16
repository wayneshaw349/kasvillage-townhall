// make_acro_showcase.cjs — writes showcase_acro.html
// Traversal moves that MOVE the character: run-jump gap clear, dive roll,
// back flip, forward somersault (full 360 + travel), cartwheel, wall-hop.
// Platforms are spaced so each move lands the hero somewhere new.
const fs = require("fs");
const engine = fs.readFileSync("scene_engine.html", "utf8");
const q = String.fromCharCode(39);
const scene = {
  kind: "kv_game_v1", engine: "scene",
  meta: { id: "acro", title: "acrobatics", seed: "ac1" },
  render: { vertexSnap: 1, gouraud: true, shadows: true, supersample: 2,
    rim: { enabled: true }, fog: { enabled: true, near: 14, far: 40, color: "#12181f" },
    post: { enabled: true, scanAlpha: 0.06 } },
  nodes: [
    { id: "cam", type: "Camera3D", mode: "fixed", fov: 46, transform: { pos: [0, 3.2, 15] } },
    { id: "hero", type: "Actor", mesh: "body", tags: ["player"], transform: { pos: [-6, 0, 0], rot: [0, 90, 0] } },
    { id: "ground", type: "MeshInstance", mesh: "slab", material: "ground", transform: { pos: [0, -0.12, 0] } },
    { id: "padA", type: "MeshInstance", mesh: "pad", material: "padMat", transform: { pos: [-6, 0, 0] } },
    { id: "padB", type: "MeshInstance", mesh: "pad", material: "padMat", transform: { pos: [-2, 0, 0] } },
    { id: "padC", type: "MeshInstance", mesh: "pad", material: "padMat", transform: { pos: [2, 0, 0] } },
    { id: "padD", type: "MeshInstance", mesh: "pad", material: "padMat", transform: { pos: [6, 0, 0] } },
    { id: "tree1", type: "MeshInstance", mesh: "t", material: "leaf", transform: { pos: [-9, 0, -6] } },
    { id: "tree2", type: "MeshInstance", mesh: "t", material: "leaf", transform: { pos: [8, 0, -7] } },
    { id: "rock1", type: "MeshInstance", mesh: "rk", material: "stone", transform: { pos: [0, 0, -5] } }
  ],
  resources: {
    meshes: {
      body: { type: "silhouette", generator: "humanoid" },
      slab: { type: "box", size: [40, 0.24, 20] },
      pad: { type: "box", size: [2.6, 0.16, 2.6] },
      t: { type: "tree" }, rk: { type: "rock" }
    },
    materials: {
      ground: { color: "#3c4a3e" }, padMat: { color: "#6c7a5a" },
      leaf: { color: "#3f7a44" }, stone: { color: "#8a8378" }
    },
    poses: {
      runjump: { dur: 0.85, loop: false, blendIn: 0.08, tracks: {
        root:  [[0, { z: 0, y: 0 }], [0.2, { z: 0.9, y: 1.5 }], [0.5, { z: 2.6, y: 2.0 }], [0.8, { z: 4.0, y: 0 }], [0.85, { z: 4.0, y: 0 }]],
        legL:  [[0, 0], [0.15, { rx: -70 }], [0.45, { rx: 30 }], [0.7, { rx: -40 }], [0.85, 0]],
        legR:  [[0, 0], [0.15, { rx: 40 }], [0.45, { rx: -60 }], [0.7, { rx: 25 }], [0.85, 0]],
        shinL: [[0, 0], [0.15, { rx: 80 }], [0.5, { rx: 20 }], [0.85, 0]],
        shinR: [[0, 0], [0.2, { rx: 60 }], [0.6, { rx: 30 }], [0.85, 0]],
        armL:  [[0, 0], [0.2, { rx: -110 }], [0.6, { rx: -40 }], [0.85, 0]],
        armR:  [[0, 0], [0.2, { rx: 60 }], [0.6, { rx: -30 }], [0.85, 0]],
        torso: [[0, 0], [0.2, { rx: -12 }], [0.6, { rx: 14 }], [0.85, 0]]
      } },
      diveroll: { dur: 0.9, loop: false, blendIn: 0.06,
        combat: { dodge: true, phases: { active: 0.08, recovery: 0.6 } },
        tracks: {
          root:  [[0, { z: 0, y: 0 }], [0.22, { z: 1.4, y: 0.9 }], [0.45, { z: 2.6, y: 0.25 }], [0.85, { z: 4.2, y: 0 }], [0.9, { z: 4.2, y: 0 }]],
          torso: [[0, 0], [0.2, { rx: 40 }], [0.5, { rx: 260 }], [0.8, { rx: 360 }], [0.9, { rx: 360 }]],
          legL:  [[0, 0], [0.2, { rx: -60 }], [0.5, { rx: -120 }], [0.85, 0]],
          legR:  [[0, 0], [0.2, { rx: -60 }], [0.5, { rx: -120 }], [0.85, 0]],
          shinL: [[0, 0], [0.4, { rx: 130 }], [0.85, 0]],
          shinR: [[0, 0], [0.4, { rx: 130 }], [0.85, 0]],
          armL:  [[0, 0], [0.15, { rx: -160 }], [0.5, { rx: -100 }], [0.9, 0]],
          armR:  [[0, 0], [0.15, { rx: -160 }], [0.5, { rx: -100 }], [0.9, 0]]
        } },
      backflip: { dur: 0.95, loop: false, blendIn: 0.06,
        combat: { dodge: true, phases: { active: 0.1, recovery: 0.7 } },
        tracks: {
          root:  [[0, { z: 0, y: 0 }], [0.15, { z: -0.4, y: 0.6 }], [0.45, { z: -1.8, y: 2.6 }], [0.8, { z: -3.4, y: 0 }], [0.95, { z: -3.6, y: 0 }]],
          torso: [[0, 0], [0.12, { rx: 25 }], [0.45, { rx: -170 }], [0.78, { rx: -350 }], [0.95, { rx: -360 }]],
          legL:  [[0, 0], [0.12, { rx: 45 }], [0.4, { rx: -120 }], [0.75, { rx: -40 }], [0.95, 0]],
          legR:  [[0, 0], [0.12, { rx: 45 }], [0.4, { rx: -120 }], [0.75, { rx: -40 }], [0.95, 0]],
          shinL: [[0, 0], [0.4, { rx: 140 }], [0.8, { rx: 30 }], [0.95, 0]],
          shinR: [[0, 0], [0.4, { rx: 140 }], [0.8, { rx: 30 }], [0.95, 0]],
          armL:  [[0, 0], [0.15, { rx: 80 }], [0.45, { rx: -150 }], [0.95, 0]],
          armR:  [[0, 0], [0.15, { rx: 80 }], [0.45, { rx: -150 }], [0.95, 0]]
        } },
      somersault: { dur: 1.05, loop: false, blendIn: 0.06,
        combat: { dodge: true, phases: { active: 0.1, recovery: 0.8 } },
        tracks: {
          root:  [[0, { z: 0, y: 0 }], [0.18, { z: 1.0, y: 1.3 }], [0.5, { z: 2.6, y: 2.9 }], [0.85, { z: 4.4, y: 0 }], [1.05, { z: 4.8, y: 0 }]],
          torso: [[0, 0], [0.15, { rx: 40 }], [0.5, { rx: 200 }], [0.85, { rx: 360 }], [1.05, { rx: 360 }]],
          legL:  [[0, 0], [0.2, { rx: -130 }], [0.6, { rx: -130 }], [0.9, { rx: -30 }], [1.05, 0]],
          legR:  [[0, 0], [0.2, { rx: -130 }], [0.6, { rx: -130 }], [0.9, { rx: -30 }], [1.05, 0]],
          shinL: [[0, 0], [0.2, { rx: 150 }], [0.6, { rx: 150 }], [1.05, 0]],
          shinR: [[0, 0], [0.2, { rx: 150 }], [0.6, { rx: 150 }], [1.05, 0]],
          armL:  [[0, 0], [0.2, { rx: -150 }], [0.6, { rx: -120 }], [1.05, 0]],
          armR:  [[0, 0], [0.2, { rx: -150 }], [0.6, { rx: -120 }], [1.05, 0]]
        } },
      cartwheel: { dur: 1.0, loop: false, blendIn: 0.06,
        combat: { dodge: true, phases: { active: 0.1, recovery: 0.75 } },
        tracks: {
          root:  [[0, { x: 0, y: 0 }], [0.3, { x: 1.3, y: 0.7 }], [0.6, { x: 2.7, y: 0.7 }], [0.9, { x: 4.0, y: 0 }], [1.0, { x: 4.2, y: 0 }]],
          torso: [[0, 0], [0.3, { rz: 110 }], [0.6, { rz: 250 }], [1.0, { rz: 360 }]],
          armL:  [[0, 0], [0.2, { rz: 165, rx: -30 }], [0.7, { rz: 165 }], [1.0, 0]],
          armR:  [[0, 0], [0.2, { rz: -165, rx: -30 }], [0.7, { rz: -165 }], [1.0, 0]],
          legL:  [[0, 0], [0.35, { rz: 75, rx: -20 }], [1.0, 0]],
          legR:  [[0, 0], [0.35, { rz: -75, rx: 20 }], [1.0, 0]]
        } },
      wallhop: { dur: 0.8, loop: false, blendIn: 0.06, tracks: {
        root:  [[0, { z: 0, y: 0 }], [0.25, { z: 1.2, y: 2.2 }], [0.45, { z: 1.4, y: 2.6 }], [0.75, { z: 0.2, y: 0 }], [0.8, { z: 0, y: 0 }]],
        torso: [[0, 0], [0.3, { rx: -20 }], [0.5, { rx: 25 }], [0.8, 0]],
        legL:  [[0, 0], [0.25, { rx: -80 }], [0.5, { rx: -20 }], [0.8, 0]],
        legR:  [[0, 0], [0.25, { rx: -40 }], [0.5, { rx: -70 }], [0.8, 0]],
        shinL: [[0, 0], [0.3, { rx: 90 }], [0.8, 0]],
        shinR: [[0, 0], [0.3, { rx: 60 }], [0.8, 0]],
        armL:  [[0, 0], [0.3, { rx: -120 }], [0.8, 0]],
        armR:  [[0, 0], [0.3, { rx: -60 }], [0.8, 0]]
      } }
    }
  }
};
const inject = [
  "",
  "// ---- injected acrobatics ----",
  "try {",
  "  loadScene(" + JSON.stringify(JSON.stringify(scene)) + ");",
  "  var __bar = document.createElement(" + q + "div" + q + ");",
  "  __bar.style.cssText = " + q + "position:fixed;bottom:8px;left:8px;right:8px;z-index:9999;font-family:monospace" + q + ";",
  "  var __status = document.createElement(" + q + "div" + q + ");",
  "  __status.style.cssText = " + q + "color:#0f0;background:#000;padding:5px;margin-bottom:4px" + q + ";",
  "  __bar.appendChild(__status);",
  "  setInterval(function () {",
  "    var h = nodes[" + q + "hero" + q + "];",
  "    if (h) __status.textContent = " + q + "x=" + q + " + h.transform.pos[0].toFixed(1) +",
  "      " + q + "  y=" + q + " + h.transform.pos[1].toFixed(1) + " + q + "  z=" + q + " + h.transform.pos[2].toFixed(1) +",
  "      " + q + "   facing=" + q + " + Math.round(h.transform.rot[1] || 0);",
  "  }, 100);",
  "  [[" + q + "RUN JUMP" + q + "," + q + "runjump" + q + "],[" + q + "DIVE ROLL" + q + "," + q + "diveroll" + q + "],",
  "   [" + q + "BACK FLIP" + q + "," + q + "backflip" + q + "],[" + q + "SOMERSAULT" + q + "," + q + "somersault" + q + "],",
  "   [" + q + "CARTWHEEL" + q + "," + q + "cartwheel" + q + "],[" + q + "WALL HOP" + q + "," + q + "wallhop" + q + "]].forEach(function (mv) {",
  "    var b = document.createElement(" + q + "button" + q + ");",
  "    b.textContent = mv[0];",
  "    b.style.cssText = " + q + "margin:2px;padding:10px 12px;font-size:14px" + q + ";",
  "    b.onclick = function () { playPose(nodes[" + q + "hero" + q + "], mv[1]); };",
  "    __bar.appendChild(b);",
  "  });",
  "  var tb = document.createElement(" + q + "button" + q + ");",
  "  tb.textContent = " + q + "TURN 180" + q + ";",
  "  tb.style.cssText = " + q + "margin:2px;padding:10px 12px;font-size:14px" + q + ";",
  "  tb.onclick = function () { var h = nodes[" + q + "hero" + q + "]; h.transform.rot[1] = (h.transform.rot[1] || 0) + 180; };",
  "  __bar.appendChild(tb);",
  "  var rb = document.createElement(" + q + "button" + q + ");",
  "  rb.textContent = " + q + "RESET" + q + ";",
  "  rb.style.cssText = " + q + "margin:2px;padding:10px 12px;font-size:14px;background:#c33;color:#fff" + q + ";",
  "  rb.onclick = function () { var h = nodes[" + q + "hero" + q + "]; h.transform.pos = [-6, 0, 0]; h.transform.rot = [0, 90, 0]; };",
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
fs.writeFileSync("showcase_acro.html", engine.slice(0, idx) + inject + engine.slice(idx));
console.log("OK showcase_acro.html — each move carries the hero to a new pad; TURN 180 to come back");
