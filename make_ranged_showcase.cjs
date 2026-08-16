// make_ranged_showcase.cjs — writes showcase_ranged.html
// Buttons fire each projectile type at the target dummy. A fairy hovers, a
// wolf trots (diagonal gait), a drake hovers with beating wings.
const fs = require("fs");
const engine = fs.readFileSync("scene_engine.html", "utf8");
const q = String.fromCharCode(39);
const scene = {
  kind: "kv_game_v1", engine: "scene",
  meta: { id: "ranged", title: "ranged", seed: "rg1" },
  render: { vertexSnap: 1, gouraud: true, shadows: true, supersample: 2, rim: { enabled: true },
    fog: { enabled: true, near: 16, far: 44, color: "#12181f" }, post: { enabled: true, scanAlpha: 0.05 } },
  nodes: [
    { id: "cam", type: "Camera3D", mode: "fixed", fov: 48, transform: { pos: [-2, 3.5, 14] } },
    { id: "archer", type: "Actor", mesh: "archerBody", tags: ["player"], transform: { pos: [-6, 0, 0], rot: [0, 90, 0] } },
    { id: "dummy", type: "Actor", mesh: "orcBody", tags: ["enemy"], transform: { pos: [6, 0, 0], rot: [0, -90, 0] },
      stats: { hp: 60, maxHp: 60 }, ragdoll: { enabled: true }, headLook: { target: "archer" } },
    { id: "ground", type: "MeshInstance", mesh: "slab", material: "ground", transform: { pos: [0, -0.12, 0] } },
    { id: "fairy", type: "Actor", mesh: "fairyBody", tags: ["npc"],
      transform: { pos: [-1, 1.4, 3] }, hover: { height: 1.6, bob: 0.22, speed: 2.4 }, headLook: { target: "dummy" } },
    { id: "wolfRoute", type: "Path3D", closed: true, points: [[-4, 0, -5], [4, 0, -5]] },
    { id: "wolf", type: "Actor", mesh: "wolfBody", tags: ["npc"], transform: { pos: [-4, 0, -5] },
      stateMachine: { initial: "walk", states: { walk: { behavior: { type: "patrol", path: "wolfRoute", speed: 2.4 } } } } },
    { id: "drake", type: "Actor", mesh: "drakeBody", tags: ["npc"],
      transform: { pos: [3, 2.5, -7] }, hover: { height: 3.2, bob: 0.4, speed: 1.4 } },
    { id: "tree1", type: "MeshInstance", mesh: "t", material: "leaf", transform: { pos: [-8, 0, -8] } }
  ],
  resources: {
    meshes: {
      archerBody: { type: "silhouette", generator: "humanoid", race: "elf", held: { type: "staff" } },
      orcBody: { type: "silhouette", generator: "humanoid", race: "orc" },
      fairyBody: { type: "silhouette", generator: "humanoid", height: 0.4, bulk: 0.55, limbLen: 1.2, headSize: 1.4, ears: "long", wings: true },
      wolfBody: { type: "silhouette", generator: "humanoid", race: "wolf" },
      drakeBody: { type: "silhouette", generator: "humanoid", race: "drake" },
      slab: { type: "box", size: [40, 0.24, 30] },
      t: { type: "tree" }
    },
    materials: { ground: { color: "#3c4a3e" }, leaf: { color: "#3f7a44" } }
  }
};
const inject = [
  "",
  "// ---- injected ranged ----",
  "try {",
  "  loadScene(" + JSON.stringify(JSON.stringify(scene)) + ");",
  "  var __bar = document.createElement(" + q + "div" + q + ");",
  "  __bar.style.cssText = " + q + "position:fixed;bottom:8px;left:8px;right:8px;z-index:9999;font-family:monospace" + q + ";",
  "  var __status = document.createElement(" + q + "div" + q + ");",
  "  __status.style.cssText = " + q + "color:#0f0;background:#000;padding:5px;margin-bottom:4px" + q + ";",
  "  __bar.appendChild(__status);",
  "  setInterval(function () {",
  "    var d = nodes[" + q + "dummy" + q + "];",
  "    __status.textContent = " + q + "dummy hp=" + q + " + (d ? d.hp : " + q + "?" + q + ") +",
  "      (d && d._rag ? " + q + " RAGDOLLED" + q + " : " + q + "" + q + ") + " + q + "   live shots: " + q + " + PROJECTILES.length;",
  "  }, 100);",
  "  function origin() {",
  "    var a = nodes[" + q + "archer" + q + "];",
  "    return { x: a.transform.pos[0], y: a.transform.pos[1], z: a.transform.pos[2] };",
  "  }",
  "  function btn(label, fn) {",
  "    var b = document.createElement(" + q + "button" + q + ");",
  "    b.textContent = label;",
  "    b.style.cssText = " + q + "margin:2px;padding:10px 12px;font-size:14px" + q + ";",
  "    b.onclick = fn;",
  "    __bar.appendChild(b);",
  "  }",
  "  btn(" + q + "ARROW" + q + ", function () {",
  "    shoot(origin(), { x: 1, y: 0.04, z: 0 }, { speed: 26, damage: 6, color: " + q + "#e8ddc0" + q + ",",
  "      owner: " + q + "archer" + q + ", sound: " + q + "__step" + q + " });",
  "  });",
  "  btn(" + q + "ARC LOB" + q + ", function () {",
  "    shoot(origin(), { x: 1, y: 0.55, z: 0 }, { speed: 16, damage: 9, gravity: 9, color: " + q + "#c9b48a" + q + ",",
  "      owner: " + q + "archer" + q + " });",
  "  });",
  "  btn(" + q + "FIREBALL" + q + ", function () {",
  "    shoot(origin(), { x: 1, y: 0.06, z: 0 }, { speed: 13, damage: 10, color: " + q + "#ff9a3c" + q + ",",
  "      owner: " + q + "archer" + q + ", explode: { radius: 3.5, force: 8, damage: 10 }, sound: " + q + "__jump" + q + " });",
  "  });",
  "  btn(" + q + "HOMING" + q + ", function () {",
  "    shoot(origin(), { x: 1, y: 0.6, z: -0.6 }, { speed: 12, damage: 8, homing: 3, target: " + q + "dummy" + q + ",",
  "      color: " + q + "#9fe8ff" + q + ", owner: " + q + "archer" + q + " });",
  "  });",
  "  btn(" + q + "PIERCE x3" + q + ", function () {",
  "    shoot(origin(), { x: 1, y: 0.04, z: 0 }, { speed: 30, damage: 5, pierce: 3, radius: 1.2,",
  "      color: " + q + "#d8b13a" + q + ", owner: " + q + "archer" + q + " });",
  "  });",
  "  btn(" + q + "HEAL DUMMY" + q + ", function () { var d = nodes[" + q + "dummy" + q + "]; d.hp = 60; });",
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
fs.writeFileSync("showcase_ranged.html", engine.slice(0, idx) + inject + engine.slice(idx));
console.log("OK showcase_ranged.html — 5 projectile types, hovering fairy + drake, trotting wolf");
