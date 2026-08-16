// make_slope_showcase.cjs — writes showcase_slope.html
// Rolling heightmap terrain. Two identical walkers patrol the same hills:
// LEFT has footIK (feet plant, pelvis dips), RIGHT does not (feet float/sink).
// Direct A/B of V4.
const fs = require("fs");
const engine = fs.readFileSync("scene_engine.html", "utf8");
const q = String.fromCharCode(39);
const scene = {
  kind: "kv_game_v1", engine: "scene",
  meta: { id: "slope", title: "slopes", seed: "sl1" },
  render: { vertexSnap: 1, gouraud: true, shadows: true, supersample: 2,
    rim: { enabled: true }, fog: { enabled: true, near: 16, far: 44, color: "#12181f" },
    post: { enabled: true, scanAlpha: 0.05 } },
  nodes: [
    { id: "cam", type: "Camera3D", mode: "fixed", fov: 46, transform: { pos: [0, 4.5, 16] } },
    { id: "hero", type: "Actor", mesh: "body", tags: ["player"], transform: { pos: [0, 0, 6] } },
    { id: "terrain", type: "MeshInstance", mesh: "hills", material: "grass", collision: "mesh",
      transform: { pos: [0, 0, 0] } },
    { id: "routeL", type: "Path3D", closed: true, points: [[-7, 0, -4], [-2, 0, -4], [-2, 0, 2], [-7, 0, 2]] },
    { id: "routeR", type: "Path3D", closed: true, points: [[2, 0, -4], [7, 0, -4], [7, 0, 2], [2, 0, 2]] },
    { id: "walkIK", type: "Actor", mesh: "body", tags: ["npc"], transform: { pos: [-7, 0, -4] },
      footIK: { enabled: true, pelvisDrop: true, weight: 0.8 },
      stateMachine: { initial: "walk", states: { walk: { behavior: { type: "patrol", path: "routeL", speed: 1.8 } } } } },
    { id: "walkPlain", type: "Actor", mesh: "body", tags: ["npc"], transform: { pos: [2, 0, -4] },
      stateMachine: { initial: "walk", states: { walk: { behavior: { type: "patrol", path: "routeR", speed: 1.8 } } } } },
    { id: "tree1", type: "MeshInstance", mesh: "t", material: "leaf", transform: { pos: [-9, 0, -8] } },
    { id: "tree2", type: "MeshInstance", mesh: "t", material: "leaf", transform: { pos: [9, 0, -9] } }
  ],
  resources: {
    meshes: {
      body: { type: "silhouette", generator: "humanoid" },
      hills: { type: "plane", size: [40, 30], subdiv: 26, heightNoise: { scale: 0.12, amp: 1.1 } },
      t: { type: "tree" }
    },
    materials: { grass: { color: "#3f5a3c" }, leaf: { color: "#3f7a44" } }
  }
};
const inject = [
  "",
  "// ---- injected slope test ----",
  "try {",
  "  loadScene(" + JSON.stringify(JSON.stringify(scene)) + ");",
  "  var __bar = document.createElement(" + q + "div" + q + ");",
  "  __bar.style.cssText = " + q + "position:fixed;bottom:8px;left:8px;z-index:9999;font-family:monospace" + q + ";",
  "  var __status = document.createElement(" + q + "div" + q + ");",
  "  __status.style.cssText = " + q + "color:#0f0;background:#000;padding:5px;margin-bottom:4px" + q + ";",
  "  __status.textContent = " + q + "LEFT walker = footIK ON   |   RIGHT walker = OFF" + q + ";",
  "  __bar.appendChild(__status);",
  "  var b = document.createElement(" + q + "button" + q + ");",
  "  b.textContent = " + q + "TOGGLE LEFT IK" + q + ";",
  "  b.style.cssText = " + q + "padding:10px 14px;font-size:15px" + q + ";",
  "  b.onclick = function () {",
  "    var w = nodes[" + q + "walkIK" + q + "];",
  "    w.footIK.enabled = !w.footIK.enabled;",
  "    __status.textContent = " + q + "LEFT footIK: " + q + " + (w.footIK.enabled ? " + q + "ON" + q + " : " + q + "OFF" + q + ") + " + q + "   |   RIGHT: always OFF" + q + ";",
  "  };",
  "  __bar.appendChild(b);",
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
fs.writeFileSync("showcase_slope.html", engine.slice(0, idx) + inject + engine.slice(idx));
console.log("OK showcase_slope.html — left walker plants feet on the hills, right one doesn't");
