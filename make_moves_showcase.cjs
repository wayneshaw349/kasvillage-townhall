// make_moves_showcase.cjs — writes showcase_moves.html
// Keys: 1=punch 2=kick 3=roll 4=flip 5=cartwheel. Side camera. Regenerate after engine patches.
const fs = require("fs");
const engine = fs.readFileSync("scene_engine.html", "utf8");
const scene = {
  kind: "kv_game_v1", engine: "scene",
  meta: { id: "moves", title: "move set", seed: "m1" },
  render: { vertexSnap: 0 },
  nodes: [
    { id: "cam", type: "Camera3D", mode: "fixed", fov: 40, transform: { pos: [6, 2.0, 9] } },
    { id: "hero", type: "Actor", mesh: "body", tags: ["player"], transform: { pos: [0, 0, 0], rot: [0, 90, 0] } }
  ],
  resources: {
    meshes: { body: { type: "silhouette", generator: "humanoid" } },
    materials: {},
    poses: {
      punch: { duration: 0.35, loop: false, tracks: {
        armR:  [[0, 0], [0.08, { rx: 25 }], [0.16, { rx: -85 }], [0.35, 0]],
        foreR: [[0, 0], [0.08, { rx: -75 }], [0.16, { rx: -5 }], [0.35, 0]],
        torso: [[0, 0], [0.16, { ry: -20 }], [0.35, 0]]
      } },
      kick: { duration: 0.45, loop: false, tracks: {
        legR:  [[0, 0], [0.10, { rx: 30 }], [0.22, { rx: -95 }], [0.45, 0]],
        shinR: [[0, 0], [0.10, { rx: 85 }], [0.22, { rx: -5 }], [0.45, 0]],
        torso: [[0, 0], [0.22, { rx: 12, ry: 10 }], [0.45, 0]],
        armL:  [[0, 0], [0.22, { rx: -50 }], [0.45, 0]]
      } },
      roll: { duration: 0.5, loop: false, tracks: {
        torso: [[0, 0], [0.25, { rx: 180 }], [0.5, { rx: 360 }]],
        legL:  [[0, 0], [0.15, { rx: -100 }], [0.4, { rx: -100 }], [0.5, 0]],
        legR:  [[0, 0], [0.15, { rx: -100 }], [0.4, { rx: -100 }], [0.5, 0]],
        shinL: [[0, 0], [0.15, { rx: 110 }], [0.4, { rx: 110 }], [0.5, 0]],
        shinR: [[0, 0], [0.15, { rx: 110 }], [0.4, { rx: 110 }], [0.5, 0]],
        armL:  [[0, 0], [0.15, { rx: -120 }], [0.4, { rx: -120 }], [0.5, 0]],
        armR:  [[0, 0], [0.15, { rx: -120 }], [0.4, { rx: -120 }], [0.5, 0]]
      } },
      flip: { duration: 0.6, loop: false, tracks: {
        torso: [[0, 0], [0.3, { rx: -180 }], [0.6, { rx: -360 }]],
        legL:  [[0, 0], [0.2, { rx: -110 }], [0.45, { rx: -110 }], [0.6, 0]],
        legR:  [[0, 0], [0.2, { rx: -110 }], [0.45, { rx: -110 }], [0.6, 0]],
        shinL: [[0, 0], [0.2, { rx: 120 }], [0.45, { rx: 120 }], [0.6, 0]],
        shinR: [[0, 0], [0.2, { rx: 120 }], [0.45, { rx: 120 }], [0.6, 0]]
      } },
      cartwheel: { duration: 0.7, loop: false, tracks: {
        torso: [[0, 0], [0.35, { rz: 180 }], [0.7, { rz: 360 }]],
        armL:  [[0, 0], [0.15, { rz: 160 }], [0.55, { rz: 160 }], [0.7, 0]],
        armR:  [[0, 0], [0.15, { rz: -160 }], [0.55, { rz: -160 }], [0.7, 0]],
        legL:  [[0, 0], [0.35, { rz: 60 }], [0.7, 0]],
        legR:  [[0, 0], [0.35, { rz: -60 }], [0.7, 0]]
      } }
    }
  }
};
const q = String.fromCharCode(39);
const inject =
  "\n<script>\n" +
  "loadScene(" + JSON.stringify(JSON.stringify(scene)) + ");\n" +
  "var MOVES = { Digit1: " + q + "punch" + q + ", Digit2: " + q + "kick" + q + ", Digit3: " + q + "roll" + q + ", Digit4: " + q + "flip" + q + ", Digit5: " + q + "cartwheel" + q + " };\n" +
  "window.addEventListener(" + q + "keydown" + q + ", function(e){ var id = MOVES[e.code]; if (id && window.nodes && nodes[" + q + "hero" + q + "]) playPose(nodes[" + q + "hero" + q + "], id); });\n" +
  "</scr" + "ipt>\n";
let out = engine.indexOf("</body>") >= 0 ? engine.replace("</body>", inject + "</body>") : engine + inject;
fs.writeFileSync("showcase_moves.html", out);
console.log("OK showcase_moves.html — keys 1=punch 2=kick 3=roll 4=flip 5=cartwheel");
