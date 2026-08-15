// make_looks_showcase.cjs — writes showcase_looks.html
// Walker, dithered ghost, props. Buttons toggle gouraud / fog / rim / post live.
const fs = require("fs");
const engine = fs.readFileSync("scene_engine.html", "utf8");
const q = String.fromCharCode(39);
const scene = {
  kind: "kv_game_v1", engine: "scene",
  meta: { id: "looks", title: "looks", seed: "g1" },
  render: { vertexSnap: 1, gouraud: true,
    fog: { enabled: true, near: 8, far: 26, color: "#101820" },
    rim: { enabled: true },
    post: { enabled: true, scanAlpha: 0.08 } },
  nodes: [
    { id: "cam", type: "Camera3D", mode: "fixed", fov: 45, transform: { pos: [0, 2.5, 11] } },
    { id: "hero", type: "Actor", mesh: "body", tags: ["player"], transform: { pos: [0, 0, 2] } },
    { id: "route", type: "Path3D", closed: true, points: [[-4, 0, 0], [4, 0, 0]] },
    { id: "walker", type: "Actor", mesh: "body", tags: ["npc"], transform: { pos: [-4, 0, 0] },
      stateMachine: { initial: "walk", states: { walk: { behavior: { type: "patrol", path: "route", speed: 2 } } } } },
    { id: "ghost", type: "MeshInstance", mesh: "body", material: "ghostMat", transform: { pos: [2.5, 0, -1] } },
    { id: "pillar1", type: "MeshInstance", mesh: "pillar", material: "stone", transform: { pos: [-3, 0, -4] } },
    { id: "pillar2", type: "MeshInstance", mesh: "pillar", material: "stone", transform: { pos: [3, 0, -8] } },
    { id: "pillar3", type: "MeshInstance", mesh: "pillar", material: "stone", transform: { pos: [-2, 0, -14] } },
    { id: "floor", type: "MeshInstance", mesh: "slab", material: "ground", transform: { pos: [0, -0.1, -4] } }
  ],
  resources: {
    meshes: {
      body: { type: "silhouette", generator: "humanoid" },
      pillar: { type: "box", size: [0.8, 4, 0.8] },
      slab: { type: "box", size: [24, 0.2, 30] }
    },
    materials: {
      ghostMat: { color: "#9fe8ff", opacity: 0.45 },
      stone: { color: "#8a8378" },
      ground: { color: "#3f4a42" }
    }
  }
};
const inject = [
  "",
  "// ---- injected looks showcase ----",
  "try {",
  "  loadScene(" + JSON.stringify(JSON.stringify(scene)) + ");",
  "  var __bar = document.createElement(" + q + "div" + q + ");",
  "  __bar.style.cssText = " + q + "position:fixed;bottom:8px;left:8px;z-index:9999;font-family:monospace" + q + ";",
  "  function tgl(label, fn) {",
  "    var b = document.createElement(" + q + "button" + q + ");",
  "    b.textContent = label;",
  "    b.style.cssText = " + q + "margin-right:4px;padding:10px 14px;font-size:14px" + q + ";",
  "    b.onclick = fn;",
  "    __bar.appendChild(b);",
  "  }",
  "  tgl(" + q + "gouraud" + q + ", function () { scene.render.gouraud = !scene.render.gouraud; });",
  "  tgl(" + q + "fog" + q + ", function () { scene.render.fog.enabled = !scene.render.fog.enabled; });",
  "  tgl(" + q + "rim" + q + ", function () { scene.render.rim.enabled = !scene.render.rim.enabled; });",
  "  tgl(" + q + "post" + q + ", function () { scene.render.post.enabled = !scene.render.post.enabled; });",
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
fs.writeFileSync("showcase_looks.html", engine.slice(0, idx) + inject + engine.slice(idx));
console.log("OK showcase_looks.html — toggle each look on/off with the buttons");
