// make_roster_showcase.cjs — writes showcase_roster.html
// Every race preset side by side, walking in place, plus live sliders on the
// front-and-center custom character.
const fs = require("fs");
const engine = fs.readFileSync("scene_engine.html", "utf8");
const q = String.fromCharCode(39);
const races = ["human", "orc", "elf", "dwarf", "halfling", "troll", "goblin", "beast", "wolf", "drake"];
const nodes = [
  { id: "cam", type: "Camera3D", mode: "fixed", fov: 52, transform: { pos: [0, 3.4, 17] } },
  { id: "hero", type: "Actor", mesh: "custom", tags: ["player"], transform: { pos: [0, 0, 5.5] } },
  { id: "ground", type: "MeshInstance", mesh: "slab", material: "ground", transform: { pos: [0, -0.12, 0] } }
];
const meshes = {
  slab: { type: "box", size: [40, 0.24, 26] },
  custom: { type: "silhouette", generator: "humanoid", race: "human" }
};
races.forEach((r, i) => {
  const x = (i - (races.length - 1) / 2) * 2.6;
  nodes.push({ id: "route_" + r, type: "Path3D", closed: true, points: [[x, 0, -1.2], [x, 0, 1.2]] });
  nodes.push({ id: r, type: "Actor", mesh: "m_" + r, tags: ["npc"], transform: { pos: [x, 0, -1.2] },
    headLook: { target: "hero" },
    stateMachine: { initial: "walk", states: { walk: { behavior: { type: "patrol", path: "route_" + r, speed: 1.4 } } } } });
  meshes["m_" + r] = { type: "silhouette", generator: "humanoid", race: r };
});
const scene = {
  kind: "kv_game_v1", engine: "scene",
  meta: { id: "roster", title: "roster", seed: "rs1" },
  render: { vertexSnap: 1, gouraud: true, shadows: true, supersample: 2, rim: { enabled: true },
    fog: { enabled: true, near: 18, far: 46, color: "#12181f" }, post: { enabled: true, scanAlpha: 0.05 } },
  nodes: nodes,
  resources: { meshes: meshes, materials: { ground: { color: "#3c4a3e" } } }
};
const inject = [
  "",
  "// ---- injected roster ----",
  "try {",
  "  loadScene(" + JSON.stringify(JSON.stringify(scene)) + ");",
  "  var RACES = " + JSON.stringify(races) + ";",
  "  var cfg = { race: " + q + "human" + q + ", height: 1, bulk: 1, limbLen: 1, headSize: 1, shoulderW: 1, hipW: 1 };",
  "  var __bar = document.createElement(" + q + "div" + q + ");",
  "  __bar.style.cssText = " + q + "position:fixed;top:8px;left:8px;z-index:9999;font-family:monospace;background:rgba(0,0,0,0.8);padding:8px;color:#0f0;max-width:280px" + q + ";",
  "  var lbl = document.createElement(" + q + "div" + q + ");",
  "  lbl.textContent = " + q + "CUSTOM (front figure)" + q + ";",
  "  lbl.style.cssText = " + q + "margin-bottom:6px;font-size:13px" + q + ";",
  "  __bar.appendChild(lbl);",
  "  function rebuild() {",
  "    var spec = { type: " + q + "silhouette" + q + ", generator: " + q + "humanoid" + q + " }, k;",
  "    for (k in cfg) spec[k] = cfg[k];",
  "    scene.resources.meshes.custom = spec;",
  "    delete meshCache[" + q + "custom" + q + "];",
  "    var h = nodes[" + q + "hero" + q + "];",
  "    h._geo = buildMesh(" + q + "custom" + q + ", spec);",
  "  }",
  "  var rsel = document.createElement(" + q + "select" + q + ");",
  "  rsel.style.cssText = " + q + "width:100%;padding:5px;margin-bottom:6px" + q + ";",
  "  RACES.forEach(function (r) { var o = document.createElement(" + q + "option" + q + "); o.value = r; o.textContent = r; rsel.appendChild(o); });",
  "  rsel.onchange = function () { cfg.race = rsel.value; rebuild(); };",
  "  __bar.appendChild(rsel);",
  "  [[" + q + "height" + q + ", 0.5, 2], [" + q + "bulk" + q + ", 0.5, 2.5], [" + q + "limbLen" + q + ", 0.6, 1.5],",
  "   [" + q + "headSize" + q + ", 0.6, 1.8], [" + q + "shoulderW" + q + ", 0.7, 1.8], [" + q + "hipW" + q + ", 0.7, 1.5]].forEach(function (sl) {",
  "    var row = document.createElement(" + q + "div" + q + ");",
  "    row.style.cssText = " + q + "font-size:11px;margin-bottom:3px" + q + ";",
  "    var t = document.createElement(" + q + "span" + q + ");",
  "    t.textContent = sl[0];",
  "    var inp = document.createElement(" + q + "input" + q + ");",
  "    inp.type = " + q + "range" + q + "; inp.min = sl[1]; inp.max = sl[2]; inp.step = 0.05; inp.value = 1;",
  "    inp.style.cssText = " + q + "width:100%" + q + ";",
  "    inp.oninput = function () { cfg[sl[0]] = parseFloat(inp.value); rebuild(); };",
  "    row.appendChild(t); row.appendChild(inp);",
  "    __bar.appendChild(row);",
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
fs.writeFileSync("showcase_roster.html", engine.slice(0, idx) + inject + engine.slice(idx));
console.log("OK showcase_roster.html — ten races walking; sliders rebuild the front character live");
