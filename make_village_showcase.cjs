// make_village_showcase.cjs — writes showcase_village.html
// The vocabulary test: trees, rocks, houses, fence, torches, barrels + three
// parameterized characters (bulky orc w/ club, slim elf w/ staff, block-head
// brute w/ sword) walking a village. Gouraud + fog + rim + post + ambience.
const fs = require("fs");
const engine = fs.readFileSync("scene_engine.html", "utf8");
const q = String.fromCharCode(39);
const scene = {
  kind: "kv_game_v1", engine: "scene",
  meta: { id: "village", title: "village", seed: "v1" },
  rooms: { start: "main", defs: { main: { soundscape: { filter: 380, vol: 0.1 } } } },
  render: { vertexSnap: 1, gouraud: true, rim: { enabled: true },
    fog: { enabled: true, near: 10, far: 34, color: "#12181f" },
    post: { enabled: true, scanAlpha: 0.06 } },
  nodes: [
    { id: "cam", type: "Camera3D", mode: "fixed", fov: 50, transform: { pos: [0, 5, 14] } },
    { id: "hero", type: "Actor", mesh: "body", tags: ["player"], transform: { pos: [0, 0, 5] } },
    { id: "ground", type: "MeshInstance", mesh: "ground", material: "grass", layer: 0, transform: { pos: [0, -0.1, -2] } },

    { id: "house1", type: "MeshInstance", mesh: "houseM", material: "wood", transform: { pos: [-6, 0, -6], rot: [0, 15, 0] } },
    { id: "house2", type: "MeshInstance", mesh: "houseM", material: "stone", transform: { pos: [6.5, 0, -8], rot: [0, -20, 0] } },
    { id: "tree1", type: "MeshInstance", mesh: "treeM", material: "leaf", transform: { pos: [-3, 0, -12] } },
    { id: "tree2", type: "MeshInstance", mesh: "treeBig", material: "leaf", transform: { pos: [4, 0, -13] } },
    { id: "tree3", type: "MeshInstance", mesh: "treeM", material: "leaf", transform: { pos: [9, 0, -3] } },
    { id: "rock1", type: "MeshInstance", mesh: "rockM", material: "stone", transform: { pos: [-8, 0, -1], rot: [0, 40, 0] } },
    { id: "rock2", type: "MeshInstance", mesh: "rockSmall", material: "stone", transform: { pos: [-7, 0, 0.2], rot: [0, 160, 0] } },
    { id: "fence1", type: "MeshInstance", mesh: "fenceM", material: "wood", transform: { pos: [-2, 0, -3.5] } },
    { id: "fence2", type: "MeshInstance", mesh: "fenceM", material: "wood", transform: { pos: [0.2, 0, -3.5] } },
    { id: "barrel1", type: "MeshInstance", mesh: "barrelM", material: "wood", transform: { pos: [-4.6, 0, -4.6] } },
    { id: "torch1", type: "MeshInstance", mesh: "torchM", material: "wood", transform: { pos: [1.5, 0, -3.2] } },
    { id: "pillar1", type: "MeshInstance", mesh: "pillarM", material: "stone", transform: { pos: [3.5, 0, -5.5] } },
    { id: "bush1", type: "MeshInstance", mesh: "bushM", material: "leaf", transform: { pos: [2.2, 0, -1.5] } },

    { id: "walkRoute", type: "Path3D", closed: true, points: [[-5, 0, 1], [5, 0, 1], [5, 0, -2], [-5, 0, -2]] },
    { id: "orc", type: "Actor", mesh: "orcBody", tags: ["npc"], transform: { pos: [-5, 0, 1] },
      headLook: { target: "hero" },
      stateMachine: { initial: "walk", states: { walk: { behavior: { type: "patrol", path: "walkRoute", speed: 1.6 } } } } },
    { id: "elf", type: "Actor", mesh: "elfBody", tags: ["npc"], transform: { pos: [5, 0, -2] },
      headLook: { target: "hero" },
      stateMachine: { initial: "walk", states: { walk: { behavior: { type: "patrol", path: "walkRoute", speed: 2.2 } } } } },
    { id: "brute", type: "Actor", mesh: "bruteBody", tags: ["npc"], transform: { pos: [0, 0, -2] },
      headLook: { target: "hero" },
      stateMachine: { initial: "walk", states: { walk: { behavior: { type: "patrol", path: "walkRoute", speed: 1.2 } } } } }
  ],
  resources: {
    meshes: {
      body: { type: "silhouette", generator: "humanoid" },
      orcBody: { type: "silhouette", generator: "humanoid", beast: true, bulk: 1.7, limbLen: 0.95, held: { type: "club" } },
      elfBody: { type: "silhouette", generator: "humanoid", bulk: 0.7, limbLen: 1.15, held: { type: "staff" } },
      bruteBody: { type: "silhouette", generator: "humanoid", headShape: "block", bulk: 1.4, held: { type: "sword" } },
      ground: { type: "box", size: [30, 0.2, 34] },
      houseM: { type: "house" },
      treeM: { type: "tree" },
      treeBig: { type: "tree", meshScale: 1.5 },
      rockM: { type: "rock" },
      rockSmall: { type: "rock", meshScale: 0.5 },
      fenceM: { type: "fence" },
      barrelM: { type: "barrel" },
      torchM: { type: "torch" },
      pillarM: { type: "pillar" },
      bushM: { type: "bush" }
    },
    materials: {
      grass: { color: "#3c5a3a" },
      wood: { color: "#7a5a3a" },
      stone: { color: "#8a8378" },
      leaf: { color: "#3f7a44" }
    }
  }
};
const inject = [
  "",
  "// ---- injected village ----",
  "try {",
  "  loadScene(" + JSON.stringify(JSON.stringify(scene)) + ");",
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
fs.writeFileSync("showcase_village.html", engine.slice(0, idx) + inject + engine.slice(idx));
console.log("OK showcase_village.html — houses, trees, rocks, fence, torch + orc/elf/brute with weapons");
