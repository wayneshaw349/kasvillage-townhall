// make_weapon_workbench.cjs — writes weapon_workbench.html
// Left: weapon JSON (shapes, stats). Right: live first-person preview.
// APPLY reloads the weapon, FIRE tests recoil/flash, ADS toggles the sight.
// Four example weapons show the custom-shape vocabulary.
const fs = require("fs");
const engine = fs.readFileSync("scene_engine.html", "utf8");
const q = String.fromCharCode(39);

const EX = {};
EX.plasma = {
  shapes: [
    { poly: [[-16, 18], [16, 18], [13, -10], [-13, -10]], color: "#2a3038" },
    { rect: [-7, -96, 14, 88], color: "#333b44" },
    { rect: [-4, -104, 8, 12], color: "#9fe8ff" },
    { circle: [0, 30, 15], color: "#1d2228" },
    { circle: [0, 30, 8], color: "#5fd8ff", alpha: 0.9 },
    { line: [-14, 8, -22, 40], color: "#2a3038", width: 7 }
  ],
  muzzle: [0, -104], flashColor: "#8fe8ff", flashSize: 20,
  fireRate: 5, damage: 14, speed: 52, spread: 1.2, auto: false, ammo: 20, reloadTime: 1.5,
  recoil: [[0, -3.2], [0.5, -2.8]], projColor: "#9fe8ff"
};
EX.scoped = {
  shapes: [
    { poly: [[-15, 20], [15, 20], [12, -14], [-12, -14]], color: "#3b3229" },
    { rect: [-6, -120, 12, 108], color: "#2f2823" },
    { rect: [-14, -40, 28, 11], color: "#15181a" },
    { circle: [-16, -34, 7], color: "#0d0f10" },
    { circle: [14, -34, 7], color: "#0d0f10" },
    { rect: [-5, 20, 11, 34], color: "#4a3f33" },
    { poly: [[5, 34], [22, 58], [12, 62], [1, 44]], color: "#4a3f33" }
  ],
  adsShapes: [],
  scope: true, muzzle: [0, -120], flashSize: 12,
  fireRate: 1.1, damage: 34, speed: 90, spread: 0.3, auto: false, ammo: 5, reloadTime: 2.4,
  recoil: [[0, -8.5]], projColor: "#fff0c0"
};
EX.shotgun = {
  shapes: [
    { poly: [[-18, 22], [18, 22], [14, -8], [-14, -8]], color: "#4a3a30" },
    { rect: [-11, -78, 10, 70], color: "#2f2823" },
    { rect: [1, -78, 10, 70], color: "#2f2823" },
    { rect: [-7, 22, 14, 30], color: "#6a4a2a" },
    { circle: [0, 12, 9], color: "#c0392b" }
  ],
  muzzle: [0, -80], flashColor: "#ffb060", flashSize: 26,
  fireRate: 1.4, damage: 26, speed: 34, spread: 6, auto: false, ammo: 6, reloadTime: 2.2,
  recoil: [[0, -9.5], [1.2, -7]], projColor: "#ffcc80"
};
EX.blade = {
  shapes: [
    { poly: [[-4, 40], [4, 40], [4, -10], [-4, -10]], color: "#5a4632" },
    { poly: [[-10, -10], [10, -10], [10, -4], [-10, -4]], color: "#8a8378" },
    { poly: [[-6, -14], [6, -14], [2, -110], [-2, -110]], color: "#d8dde2" },
    { poly: [[0, -14], [6, -14], [2, -110], [0, -104]], color: "#a8b0b8" }
  ],
  muzzle: [0, -110], flashColor: "#ffffff", flashSize: 8,
  fireRate: 2.2, damage: 18, speed: 999, spread: 0, auto: false, ammo: 99, reloadTime: 0.1,
  recoil: [[0, -4]], projColor: "#ffffff"
};

const scene = {
  kind: "kv_game_v1", engine: "scene",
  meta: { id: "wbench", title: "weapon workbench", seed: "wb1" },
  render: { cameraMode: "firstPerson", vertexSnap: 1, gouraud: true, shadows: true,
    fog: { enabled: true, near: 12, far: 40, color: "#12181f" },
    post: { enabled: true, scanAlpha: 0.05 },
    viewmodel: { shape: "custom", scale: 1 } },
  nodes: [
    { id: "hero", type: "Actor", mesh: "body", tags: ["player"],
      transform: { pos: [0, 0, 6], rot: [0, 180, 0] },
      controller: { type: "firstPerson", sensitivity: 1, weapons: ["custom"] },
      stats: { hp: 100, maxHp: 100, speed: 5 } },
    { id: "ground", type: "MeshInstance", mesh: "slab", material: "ground", transform: { pos: [0, -0.12, 0] } },
    { id: "route", type: "Path3D", closed: true, points: [[-5, 0, -10], [5, 0, -10]] },
    { id: "target", type: "Actor", mesh: "orcBody", tags: ["enemy"], transform: { pos: [0, 0, -10] },
      stats: { hp: 200, maxHp: 200 }, ragdoll: { enabled: true },
      stateMachine: { initial: "walk", states: { walk: { behavior: { type: "patrol", path: "route", speed: 1.5 } } } } },
    { id: "wall", type: "MeshInstance", mesh: "wallM", material: "stone", transform: { pos: [0, 0, -16] } }
  ],
  resources: {
    meshes: {
      body: { type: "silhouette", generator: "humanoid" },
      orcBody: { type: "silhouette", generator: "humanoid", race: "orc" },
      slab: { type: "box", size: [40, 0.24, 40] },
      wallM: { type: "box", size: [20, 4, 0.6], originBottom: true }
    },
    materials: { ground: { color: "#3a4438" }, stone: { color: "#8a8378" } },
    weapons: { custom: EX.plasma }
  }
};

const inject = [
  "",
  "// ---- weapon workbench ----",
  "try {",
  "  var EXAMPLES = " + JSON.stringify(EX) + ";",
  "  loadScene(" + JSON.stringify(JSON.stringify(scene)) + ");",
  "  var ed = document.createElement(" + q + "div" + q + ");",
  "  ed.style.cssText = " + q + "position:fixed;top:0;left:0;bottom:0;width:400px;max-width:46vw;background:#14181c;z-index:9999;display:flex;flex-direction:column;font-family:monospace;border-right:2px solid #333" + q + ";",
  "  var bar = document.createElement(" + q + "div" + q + ");",
  "  bar.style.cssText = " + q + "padding:6px;display:flex;gap:4px;flex-wrap:wrap" + q + ";",
  "  var sel = document.createElement(" + q + "select" + q + ");",
  "  sel.style.cssText = " + q + "padding:6px;font-size:13px" + q + ";",
  "  Object.keys(EXAMPLES).forEach(function (k) { var o = document.createElement(" + q + "option" + q + "); o.value = k; o.textContent = k; sel.appendChild(o); });",
  "  var ta = document.createElement(" + q + "textarea" + q + ");",
  "  ta.style.cssText = " + q + "flex:1;background:#0c0f12;color:#9fe8a0;border:0;padding:8px;font-size:11px;font-family:monospace;resize:none;white-space:pre" + q + ";",
  "  ta.spellcheck = false;",
  "  var errBox = document.createElement(" + q + "div" + q + ");",
  "  errBox.style.cssText = " + q + "padding:6px;color:#6f6;background:#000;font-size:12px;min-height:16px" + q + ";",
  "  function apply() {",
  "    try {",
  "      scene.resources.weapons.custom = JSON.parse(ta.value);",
  "      WEP.ammo = {}; WEP.sprayN = 0; WEP.reloading = 0;",
  "      errBox.style.color = " + q + "#6f6" + q + "; errBox.textContent = " + q + "applied" + q + ";",
  "    } catch (e) { errBox.style.color = " + q + "#f66" + q + "; errBox.textContent = e.message; }",
  "  }",
  "  function loadEx() { ta.value = JSON.stringify(EXAMPLES[sel.value], null, 2); apply(); }",
  "  sel.onchange = loadEx;",
  "  bar.appendChild(sel);",
  "  function btn(label, fn, style) {",
  "    var b = document.createElement(" + q + "button" + q + ");",
  "    b.textContent = label;",
  "    b.style.cssText = " + q + "padding:8px 12px;font-size:13px;" + q + " + (style || " + q + "" + q + ");",
  "    b.onclick = fn;",
  "    bar.appendChild(b);",
  "    return b;",
  "  }",
  "  btn(" + q + "APPLY" + q + ", apply);",
  "  btn(" + q + "FIRE" + q + ", function () { INPUT.attack.pressed = true; setTimeout(function () { INPUT.attack.pressed = false; }, 30); }, " + q + "background:#c33;color:#fff" + q + ");",
  "  var adsB = btn(" + q + "ADS" + q + ", function () {",
  "    INPUT.interact.held = !INPUT.interact.held;",
  "    adsB.style.background = INPUT.interact.held ? " + q + "#4a4" + q + " : " + q + "" + q + ";",
  "  });",
  "  btn(" + q + "HIDE" + q + ", function () { ed.style.display = ed.style.display === " + q + "none" + q + " ? " + q + "flex" + q + " : " + q + "none" + q + "; });",
  "  ta.addEventListener(" + q + "keydown" + q + ", function (e) {",
  "    if ((e.ctrlKey || e.metaKey) && e.key === " + q + "Enter" + q + ") { e.preventDefault(); apply(); }",
  "  });",
  "  ed.appendChild(bar); ed.appendChild(ta); ed.appendChild(errBox);",
  "  document.body.appendChild(ed);",
  "  loadEx();",
  "  var keys3 = {};",
  "  window.addEventListener(" + q + "keydown" + q + ", function (e) { if (e.target === ta) return; keys3[e.code] = 1; });",
  "  window.addEventListener(" + q + "keyup" + q + ", function (e) { keys3[e.code] = 0; });",
  "  setInterval(function () {",
  "    INPUT.move.x = (keys3.KeyD ? 1 : 0) - (keys3.KeyA ? 1 : 0);",
  "    INPUT.move.y = (keys3.KeyW ? 1 : 0) - (keys3.KeyS ? 1 : 0);",
  "    INPUT.move.length = Math.sqrt(INPUT.move.x * INPUT.move.x + INPUT.move.y * INPUT.move.y);",
  "    INPUT.look.x = (keys3.ArrowRight ? 1 : 0) - (keys3.ArrowLeft ? 1 : 0);",
  "    INPUT.look.y = (keys3.ArrowDown ? 1 : 0) - (keys3.ArrowUp ? 1 : 0);",
  "    INPUT.attack.held = !!keys3.Space;",
  "    if (keys3.Space) INPUT.attack.pressed = true;",
  "  }, 16);",
  "} catch (e) {",
  "  document.title = " + q + "WORKBENCH ERROR: " + q + " + e.message;",
  "}",
  ""
].join("\n");
const marker = "</script>";
const idx = engine.lastIndexOf(marker);
if (idx < 0) { console.error("ABORT: no </scr" + "ipt>"); process.exit(1); }
fs.writeFileSync("weapon_workbench.html", engine.slice(0, idx) + inject + engine.slice(idx));
console.log("OK weapon_workbench.html — edit shapes JSON, Ctrl+Enter to apply, FIRE/ADS to test");
