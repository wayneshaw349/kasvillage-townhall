// make_fps_showcase.cjs — writes showcase_fps.html
// First-person arena: on-screen look/move pads, viewmodel with bob/punch/sway,
// FIRE button, ADS toggle, weapon switch (rifle/pistol/bow/staff), orc targets.
const fs = require("fs");
const engine = fs.readFileSync("scene_engine.html", "utf8");
const q = String.fromCharCode(39);
const nodes = [
  { id: "hero", type: "Actor", mesh: "body", tags: ["player"],
    transform: { pos: [0, 0, 6], rot: [0, 180, 0] },
    controller: { type: "firstPerson", sensitivity: 1, weapon: { speed: 45, damage: 9, color: "#ffd88a" } },
    stats: { hp: 100, maxHp: 100, speed: 5 } },
  { id: "ground", type: "MeshInstance", mesh: "slab", material: "ground", transform: { pos: [0, -0.12, 0] } },
  { id: "wall1", type: "MeshInstance", mesh: "wall", material: "stone", transform: { pos: [-8, 0, -6] } },
  { id: "wall2", type: "MeshInstance", mesh: "wall", material: "stone", transform: { pos: [8, 0, -10] } },
  { id: "crate1", type: "MeshInstance", mesh: "crateM", material: "wood",
    physics: { body: "dynamic", shape: "box", half: [0.5, 0.5, 0.5], mass: 2, restitution: 0.2, friction: 0.7 },
    transform: { pos: [2, 0.5, -3] } },
  { id: "pillarA", type: "MeshInstance", mesh: "pillarM", material: "stone", transform: { pos: [-3, 0, -8] } },
  { id: "tree1", type: "MeshInstance", mesh: "t", material: "leaf", transform: { pos: [10, 0, -4] } }
];
for (let i = 0; i < 4; i++) {
  const x = -6 + i * 4;
  nodes.push({ id: "route" + i, type: "Path3D", closed: true, points: [[x, 0, -14], [x, 0, -8]] });
  nodes.push({ id: "orc" + i, type: "Actor", mesh: "orcBody", tags: ["enemy"],
    transform: { pos: [x, 0, -14] }, stats: { hp: 24, maxHp: 24 },
    ragdoll: { enabled: true }, headLook: { target: "hero" },
    stateMachine: { initial: "walk", states: { walk: { behavior: { type: "patrol", path: "route" + i, speed: 1.6 } } } } });
}
const scene = {
  kind: "kv_game_v1", engine: "scene",
  meta: { id: "fps", title: "fps", seed: "fp1" },
  render: { cameraMode: "firstPerson", vertexSnap: 1, gouraud: true, shadows: true,
    rim: { enabled: true }, fog: { enabled: true, near: 12, far: 40, color: "#12181f" },
    post: { enabled: true, scanAlpha: 0.06 },
    viewmodel: { shape: "rifle", color: "#3a3f45", scale: 1 } },
  nodes: nodes,
  resources: {
    meshes: {
      body: { type: "silhouette", generator: "humanoid" },
      orcBody: { type: "silhouette", generator: "humanoid", race: "orc" },
      slab: { type: "box", size: [44, 0.24, 44] },
      wall: { type: "box", size: [6, 3.2, 0.5], originBottom: true },
      crateM: { type: "crate" }, pillarM: { type: "pillar" }, t: { type: "tree" }
    },
    materials: { ground: { color: "#3a4438" }, stone: { color: "#8a8378" },
                 wood: { color: "#7a5a3a" }, leaf: { color: "#3f7a44" } }
  }
};
const inject = [
  "",
  "// ---- injected fps ----",
  "try {",
  "  loadScene(" + JSON.stringify(JSON.stringify(scene)) + ");",
  "  var __bar = document.createElement(" + q + "div" + q + ");",
  "  __bar.style.cssText = " + q + "position:fixed;top:8px;left:8px;z-index:9999;font-family:monospace" + q + ";",
  "  var __status = document.createElement(" + q + "div" + q + ");",
  "  __status.style.cssText = " + q + "color:#0f0;background:#000;padding:5px;margin-bottom:4px;font-size:12px" + q + ";",
  "  __bar.appendChild(__status);",
  "  setInterval(function () {",
  "    var alive = 0;",
  "    for (var i = 0; i < 4; i++) { var o = nodes[" + q + "orc" + q + " + i]; if (o && !o._rag) alive++; }",
  "    __status.textContent = " + q + "orcs alive: " + q + " + alive + " + q + "   shots: " + q + " + PROJECTILES.length;",
  "  }, 150);",
  "  [" + q + "rifle" + q + "," + q + "pistol" + q + "," + q + "bow" + q + "," + q + "staff" + q + "].forEach(function (wp) {",
  "    var b = document.createElement(" + q + "button" + q + ");",
  "    b.textContent = wp;",
  "    b.style.cssText = " + q + "margin-right:3px;padding:7px 10px;font-size:13px" + q + ";",
  "    b.onclick = function () { scene.render.viewmodel.shape = wp; };",
  "    __bar.appendChild(b);",
  "  });",
  "  document.body.appendChild(__bar);",
  "  // touch/keyboard controls: left half = move, right half = look, FIRE button",
  "  var fire = document.createElement(" + q + "button" + q + ");",
  "  fire.textContent = " + q + "FIRE" + q + ";",
  "  fire.style.cssText = " + q + "position:fixed;right:16px;bottom:90px;z-index:9999;padding:22px 26px;font-size:16px;border-radius:50%;background:#c33;color:#fff" + q + ";",
  "  fire.onclick = function () { INPUT.attack.pressed = true; setTimeout(function () { INPUT.attack.pressed = false; }, 30); };",
  "  document.body.appendChild(fire);",
  "  var ads = document.createElement(" + q + "button" + q + ");",
  "  ads.textContent = " + q + "ADS" + q + ";",
  "  ads.style.cssText = " + q + "position:fixed;right:100px;bottom:96px;z-index:9999;padding:14px 16px;font-size:14px" + q + ";",
  "  ads.onclick = function () { INPUT.interact.held = !INPUT.interact.held; ads.style.background = INPUT.interact.held ? " + q + "#4a4" + q + " : " + q + "" + q + "; };",
  "  document.body.appendChild(ads);",
  "  var keys2 = {};",
  "  window.addEventListener(" + q + "keydown" + q + ", function (e) { keys2[e.code] = 1; });",
  "  window.addEventListener(" + q + "keyup" + q + ", function (e) { keys2[e.code] = 0; });",
  "  setInterval(function () {",
  "    INPUT.move.x = (keys2.KeyD ? 1 : 0) - (keys2.KeyA ? 1 : 0);",
  "    INPUT.move.y = (keys2.KeyW ? 1 : 0) - (keys2.KeyS ? 1 : 0);",
  "    INPUT.move.length = Math.sqrt(INPUT.move.x * INPUT.move.x + INPUT.move.y * INPUT.move.y);",
  "    INPUT.look.x = (keys2.ArrowRight ? 1 : 0) - (keys2.ArrowLeft ? 1 : 0);",
  "    INPUT.look.y = (keys2.ArrowDown ? 1 : 0) - (keys2.ArrowUp ? 1 : 0);",
  "    if (keys2.Space) { INPUT.attack.pressed = true; setTimeout(function () { INPUT.attack.pressed = false; }, 20); }",
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
fs.writeFileSync("showcase_fps.html", engine.slice(0, idx) + inject + engine.slice(idx));
console.log("OK showcase_fps.html — WASD move, arrows look, Space/FIRE shoot, ADS toggle, weapon buttons");
