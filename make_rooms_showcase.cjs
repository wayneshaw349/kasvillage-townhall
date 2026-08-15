// make_rooms_showcase.cjs — writes showcase_rooms.html
// roomA: walker + pillars. roomB: goblin + ghost. Buttons switch rooms; the
// gold slab (layer 1) always draws on top of the floor (layer 0) as a layer check.
const fs = require("fs");
const engine = fs.readFileSync("scene_engine.html", "utf8");
const q = String.fromCharCode(39);
const scene = {
  kind: "kv_game_v1", engine: "scene",
  meta: { id: "rooms", title: "rooms", seed: "r1" },
  rooms: { start: "roomA" },
  render: { vertexSnap: 1, gouraud: true, fog: { enabled: true, near: 8, far: 26, color: "#101820" } },
  nodes: [
    { id: "cam", type: "Camera3D", mode: "fixed", fov: 45, transform: { pos: [0, 2.5, 11] } },
    { id: "hero", type: "Actor", mesh: "body", tags: ["player"], transform: { pos: [0, 0, 2] } },
    { id: "floor", type: "MeshInstance", mesh: "slab", material: "ground", layer: 0, transform: { pos: [0, -0.1, -4] } },
    { id: "marker", type: "MeshInstance", mesh: "chip", material: "gold", layer: 1, transform: { pos: [0, -0.05, 1] } },

    { id: "routeA", type: "Path3D", room: "roomA", closed: true, points: [[-4, 0, 0], [4, 0, 0]] },
    { id: "walkerA", type: "Actor", mesh: "body", tags: ["npc"], room: "roomA", transform: { pos: [-4, 0, 0] },
      stateMachine: { initial: "walk", states: { walk: { behavior: { type: "patrol", path: "routeA", speed: 2 } } } } },
    { id: "pillarA1", type: "MeshInstance", mesh: "pillar", material: "stone", room: "roomA", transform: { pos: [-3, 0, -4] } },
    { id: "pillarA2", type: "MeshInstance", mesh: "pillar", material: "stone", room: "roomA", transform: { pos: [3, 0, -6] } },

    { id: "goblinB", type: "Actor", mesh: "gob", tags: ["enemy"], room: "roomB",
      transform: { pos: [1.5, 0, -1], rot: [0, -90, 0] }, stats: { hp: 20, maxHp: 20 },
      ragdoll: { enabled: true }, headLook: { target: "hero" } },
    { id: "ghostB", type: "MeshInstance", mesh: "body", material: "ghostMat", room: "roomB", transform: { pos: [-2, 0, -3] } }
  ],
  resources: {
    meshes: {
      body: { type: "silhouette", generator: "humanoid" },
      gob: { type: "silhouette", generator: "humanoid", beast: true },
      pillar: { type: "box", size: [0.8, 4, 0.8] },
      slab: { type: "box", size: [24, 0.2, 30] },
      chip: { type: "box", size: [1.4, 0.1, 1.4] }
    },
    materials: {
      ground: { color: "#3f4a42" },
      stone: { color: "#8a8378" },
      gold: { color: "#d8b13a" },
      ghostMat: { color: "#9fe8ff", opacity: 0.45 }
    }
  }
};
const inject = [
  "",
  "// ---- injected rooms showcase ----",
  "try {",
  "  loadScene(" + JSON.stringify(JSON.stringify(scene)) + ");",
  "  var __bar = document.createElement(" + q + "div" + q + ");",
  "  __bar.style.cssText = " + q + "position:fixed;bottom:8px;left:8px;z-index:9999;font-family:monospace" + q + ";",
  "  var __status = document.createElement(" + q + "div" + q + ");",
  "  __status.style.cssText = " + q + "color:#0f0;background:#000;padding:4px;margin-bottom:4px" + q + ";",
  "  __bar.appendChild(__status);",
  "  setInterval(function () { __status.textContent = " + q + "room: " + q + " + scene._room; }, 100);",
  "  [" + q + "roomA" + q + "," + q + "roomB" + q + "].forEach(function (rm) {",
  "    var b = document.createElement(" + q + "button" + q + ");",
  "    b.textContent = rm;",
  "    b.style.cssText = " + q + "margin-right:4px;padding:10px 14px;font-size:15px" + q + ";",
  "    b.onclick = function () { gotoRoom(rm); };",
  "    __bar.appendChild(b);",
  "  });",
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
fs.writeFileSync("showcase_rooms.html", engine.slice(0, idx) + inject + engine.slice(idx));
console.log("OK showcase_rooms.html — roomA: walker+pillars, roomB: goblin+ghost");
