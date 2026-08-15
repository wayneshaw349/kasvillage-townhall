// make_fight_showcase2.cjs — writes showcase_boom.html
// Buttons: punchR / punchL / kickR / kickL (L = auto-mirrored _m). Mash them —
// queueAttack buffers during a swing and chains on recovery. Dummy staggers on
// kicks (dmg 8), flinches on punches, launches on the kill.
const fs = require("fs");
const engine = fs.readFileSync("scene_engine.html", "utf8");
const q = String.fromCharCode(39);
const CHAIN = ["punch", "punch_m", "kick", "kick_m"];
const scene = {
  kind: "kv_game_v1", engine: "scene",
  meta: { id: "boom", title: "boom", seed: "e1" },
  rooms: { start: "arena", defs: { arena: { soundscape: { filter: 350, vol: 0.1 } } } },
  render: { vertexSnap: 0 },
  nodes: [
    { id: "route", type: "Path3D", closed: true, points: [[-4, 0, -3], [4, 0, -3]] },
    { id: "walker", type: "Actor", mesh: "body", tags: ["npc"], transform: { pos: [-4, 0, -3] },
      stateMachine: { initial: "walk", states: { walk: { behavior: { type: "patrol", path: "route", speed: 2 } } } } },
    { id: "barrel", type: "MeshInstance", mesh: "barrel", material: "barrelMat",
      physics: { body: "dynamic", shape: "box", half: [0.35, 0.5, 0.35], mass: 2, restitution: 0.2, friction: 0.7 },
      transform: { pos: [3, 0.5, -2] } },
    { id: "cam", type: "Camera3D", mode: "fixed", fov: 40, transform: { pos: [1, 1.8, 10] } },
    { id: "hero", type: "Actor", mesh: "body", tags: ["player"],
      transform: { pos: [0, 0, 0], rot: [0, 90, 0] } },
    { id: "dummy", type: "Actor", mesh: "gob", tags: ["enemy"],
      transform: { pos: [1.2, 0, 0], rot: [0, -90, 0] },
      stats: { hp: 40, maxHp: 40 },
      ragdoll: { enabled: true }, headLook: { target: "hero" } }
  ],
  resources: {
    meshes: {
      body: { type: "silhouette", generator: "humanoid" },
      gob: { type: "silhouette", generator: "humanoid", beast: true },
      barrel: { type: "box", size: [0.7, 1, 0.7] }
    },
    materials: { barrelMat: { color: "#8a3d2a" } },
    poses: {
      punch: { dur: 0.45, loop: false,
        combat: { phases: { active: 0.12, recovery: 0.18 }, cancelInto: CHAIN,
                  hitbox: { forward: 0.95, height: 1.3, r: 0.45, damage: 5, filter: "enemy", level: "high", pushback: 3 } },
        tracks: {
          armR:  [[0, 0], [0.12, { rx: 35, ry: 10 }], [0.15, { rx: -95 }], [0.28, { rx: -95 }], [0.45, 0]],
          foreR: [[0, 0], [0.12, { rx: -100 }], [0.15, { rx: 0 }], [0.28, { rx: 0 }], [0.45, 0]],
          torso: [[0, 0], [0.12, { ry: 25 }], [0.15, { ry: -35 }], [0.28, { ry: -35 }], [0.45, 0]]
        } },
      kick: { dur: 0.55, loop: false,
        combat: { phases: { active: 0.16, recovery: 0.26 }, cancelInto: CHAIN,
                  hitbox: { forward: 1.25, height: 1.0, r: 0.5, damage: 8, filter: "enemy", level: "mid", pushback: 5, launch: 6 } },
        tracks: {
          legR:  [[0, 0], [0.16, { rx: 40 }], [0.20, { rx: -100 }], [0.34, { rx: -100 }], [0.55, 0]],
          shinR: [[0, 0], [0.16, { rx: 100 }], [0.20, { rx: -5 }], [0.34, { rx: -5 }], [0.55, 0]],
          torso: [[0, 0], [0.20, { rx: 14, ry: 12 }], [0.55, 0]],
          armL:  [[0, 0], [0.20, { rx: -55 }], [0.55, 0]]
        } }
    }
  }
};
const inject = [
  "",
  "// ---- injected fight showcase v2 ----",
  "try {",
  "  loadScene(" + JSON.stringify(JSON.stringify(scene)) + ");",
  "  var __bar = document.createElement(" + q + "div" + q + ");",
  "  __bar.style.cssText = " + q + "position:fixed;bottom:8px;left:8px;z-index:9999;font-family:monospace" + q + ";",
  "  var __status = document.createElement(" + q + "div" + q + ");",
  "  __status.style.cssText = " + q + "color:#0f0;background:#000;padding:4px;margin-bottom:4px" + q + ";",
  "  __bar.appendChild(__status);",
  "  setInterval(function () {",
  "    var d = nodes[" + q + "dummy" + q + "], h = nodes[" + q + "hero" + q + "];",
  "    if (d && h) __status.textContent = " + q + "hp=" + q + " + d.hp + (d._rag ? " + q + " RAG" + q + " : " + q + "" + q + ") +",
  "      " + q + " phase=" + q + " + (h._combatPhase || " + q + "-" + q + ") + " + q + " buffered=" + q + " + (h._nextAttack || " + q + "-" + q + ");",
  "  }, 80);",
  "  [[" + q + "punchR" + q + "," + q + "punch" + q + "],[" + q + "punchL" + q + "," + q + "punch_m" + q + "],[" + q + "kickR" + q + "," + q + "kick" + q + "],[" + q + "kickL" + q + "," + q + "kick_m" + q + "]].forEach(function (mv) {",
  "    var b = document.createElement(" + q + "button" + q + ");",
  "    b.textContent = mv[0];",
  "    b.style.cssText = " + q + "margin-right:4px;padding:10px 14px;font-size:15px" + q + ";",
  "    b.onclick = function () { queueAttack(nodes[" + q + "hero" + q + "], mv[1]); };",
  "    __bar.appendChild(b);",
  "  });",
  "  var bb = document.createElement(" + q + "button" + q + ");",
  "  bb.textContent = " + q + "BOOM" + q + ";",
  "  bb.style.cssText = " + q + "margin-right:4px;padding:10px 14px;font-size:15px;background:#c33;color:#fff" + q + ";",
  "  bb.onclick = function () { explode(1.5, 0, -1, 4, 9, 12); };",
  "  __bar.appendChild(bb);",
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
fs.writeFileSync("showcase_boom.html", engine.slice(0, idx) + inject + engine.slice(idx));
console.log("OK showcase_boom.html — mash the 4 buttons: chains + alternating limbs");
