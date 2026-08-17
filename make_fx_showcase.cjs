// make_fx_showcase.cjs — writes showcase_fx.html
// Everything from FX1 + SYS1 in one scene: torch smoke, campfire sparks, magic
// fountain, rain toggle, blood/dust from combat, explosion scorch marks,
// SAVE/LOAD state, and a culling readout.
const fs = require("fs");
const engine = fs.readFileSync("scene_engine.html", "utf8");
const q = String.fromCharCode(39);
const scene = {
  kind: "kv_game_v1", engine: "scene",
  meta: { id: "fx", title: "fx lab", seed: "fx1" },
  render: { vertexSnap: 1, gouraud: true, rim: { enabled: true }, 
    fog: { enabled: false, near: 14, far: 42, color: "#12181f" },
    post: { enabled: true, scanAlpha: 0.06 } },
  nodes: [
    { id: "cam", type: "Camera3D", mode: "fixed", fov: 50, transform: { pos: [0, 4.5, 14] } },
    { id: "hero", type: "Actor", mesh: "heroBody", tags: ["player"],
      transform: { pos: [-2, 0, 3] }, stats: { hp: 30, maxHp: 30, speed: 4 },
      ragdoll: { enabled: true } },
    { id: "orc", type: "Actor", mesh: "orcBody", tags: ["enemy"],
      transform: { pos: [2, 0, 0], rot: [0, 180, 0] }, stats: { hp: 60, maxHp: 60 },
      ragdoll: { enabled: true }, footIK: { enabled: true }, headLook: { target: "hero" } },
    { id: "ground", type: "MeshInstance", mesh: "slab", material: "ground", transform: { pos: [0, -0.12, 0] } },

    { id: "torch1", type: "MeshInstance", mesh: "torchM", material: "wood",
      transform: { pos: [-5, 0, -2] } },
    { id: "fire", type: "MeshInstance", mesh: "rockM", material: "stone",
      transform: { pos: [4, 0, -4] } },
    { id: "fountain", type: "MeshInstance", mesh: "pillarM", material: "stone",
      transform: { pos: [0, 0, -7] } },
    { id: "tree1", type: "MeshInstance", mesh: "t", material: "leaf",
      transform: { pos: [-8, 0, -8] } },
    { id: "far1", type: "MeshInstance", mesh: "t", material: "leaf", transform: { pos: [30, 0, -50] } },
    { id: "far2", type: "MeshInstance", mesh: "houseM", material: "wood", transform: { pos: [-40, 0, -60] } }
  ],
  resources: {
    meshes: {
      heroBody: { type: "silhouette", generator: "humanoid", held: { type: "sword" } },
      orcBody: { type: "silhouette", generator: "humanoid", race: "orc" },
      slab: { type: "box", size: [40, 0.24, 40] },
      torchM: { type: "torch" }, rockM: { type: "rock" }, pillarM: { type: "pillar" },
      t: { type: "tree" }, houseM: { type: "house" }
    },
    materials: { ground: { color: "#3a4438" }, wood: { color: "#7a5a3a" },
                 stone: { color: "#8a8378" }, leaf: { color: "#3f7a44" } },
    poses: {
      slash: { dur: 0.5, loop: false, blendIn: 0.08,
        combat: { phases: { active: 0.14, recovery: 0.2 }, cancelInto: ["slash_m"],
                  hitbox: { forward: 1.1, height: 1.3, r: 0.7, damage: 9, filter: "enemy", pushback: 3 } },
        tracks: { armR: [[0, 0], [0.14, { rx: -120, rz: 30 }], [0.3, { rx: 20, rz: -40 }], [0.5, 0]],
                  torso: [[0, 0], [0.16, { ry: -40 }], [0.5, 0]] } }
    }
  }
};
const inject = [
  "",
  "// ---- injected fx lab ----",
  "try {",
  "  loadScene(" + JSON.stringify(JSON.stringify(scene)) + ");",
  "  var saved = null, raining = false;",
  "  var __bar = document.createElement(" + q + "div" + q + ");",
  "  __bar.style.cssText = " + q + "position:fixed;bottom:8px;left:8px;right:8px;z-index:9999;font-family:monospace" + q + ";",
  "  var __st = document.createElement(" + q + "div" + q + ");",
  "  __st.style.cssText = " + q + "color:#0f0;background:#000;padding:5px;margin-bottom:4px;font-size:12px" + q + ";",
  "  __bar.appendChild(__st);",
  "  setInterval(function () {",
  "    var o = nodes[" + q + "orc" + q + "];",
  "    __st.textContent = " + q + "particles: " + q + " + PARTICLES.length + " + q + "   decals: " + q + " + DECALS.length +",
  "      " + q + "   orc hp: " + q + " + (o ? o.hp : " + q + "?" + q + ") + (saved ? " + q + "   [state saved]" + q + " : " + q + "" + q + ");",
  "  }, 150);",
  "  function btn(label, fn, col) {",
  "    var b = document.createElement(" + q + "button" + q + ");",
  "    b.textContent = label;",
  "    b.style.cssText = " + q + "margin:2px;padding:9px 11px;font-size:13px;" + q + " + (col || " + q + "" + q + ");",
  "    b.onclick = fn;",
  "    __bar.appendChild(b);",
  "  }",
  "  btn(" + q + "SLASH ORC" + q + ", function () { queueAttack(nodes[" + q + "hero" + q + "], " + q + "slash" + q + "); });",
  "  btn(" + q + "BOOM" + q + ", function () { explode(2, 0.5, 0, 4, 9, 14); }, " + q + "background:#c33;color:#fff" + q + ");",
  "  btn(" + q + "DUST" + q + ", function () { emit(" + q + "dust" + q + ", -2, 0.2, 3, { scale: 2, jitter: 0.6 }); });",
  "  btn(" + q + "MAGIC" + q + ", function () { emit(" + q + "magic" + q + ", 0, 1.5, -7, { scale: 3, jitter: 0.8 }); });",
  "  btn(" + q + "RAIN" + q + ", function () {",
  "    raining = !raining;",
  "    if (raining) {",
  "      window.__rainT = setInterval(function () {",
  "        for (var i = 0; i < 6; i++) emit(" + q + "rain" + q + ", (Math.random() - 0.5) * 34, 12, (Math.random() - 0.5) * 34, { scale: 0.12 });",
  "      }, 90);",
  "    } else clearInterval(window.__rainT);",
  "  });",
  "  btn(" + q + "SAVE STATE" + q + ", function () {",
  "    saved = saveState();",
  "    console.log(JSON.stringify(saved).length + " + q + " bytes" + q + ");",
  "  }, " + q + "background:#2a6" + q + ");",
  "  btn(" + q + "LOAD STATE" + q + ", function () { if (saved) loadState(saved); }, " + q + "background:#26a" + q + ");",
  "  btn(" + q + "HEAL ORC" + q + ", function () { var o = nodes[" + q + "orc" + q + "]; o.hp = 60; });",
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
fs.writeFileSync("showcase_fx.html", engine.slice(0, idx) + inject + engine.slice(idx));
console.log("OK showcase_fx.html — smoke, sparks, magic, leaves, rain, blood, scorch, save/load");
