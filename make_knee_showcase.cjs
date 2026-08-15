const fs = require("fs");
const engine = fs.readFileSync("scene_engine.html", "utf8");
const scene = {
  kind: "kv_game_v1", engine: "scene",
  meta: { id: "kneeshow", title: "knee showcase", seed: "k1" },
  render: { cameraMode: "overhead", vertexSnap: 0 },
  nodes: [
    { id: "hero", type: "Actor", mesh: "body", tags: ["player"], transform: { pos: [0, 0, 4] } },
    { id: "route", type: "Path3D", closed: true, points: [[-5, 0, 0], [5, 0, 0]] },
    { id: "walker", type: "Actor", mesh: "body", tags: ["npc"],
      transform: { pos: [-5, 0, 0] },
      stateMachine: { initial: "walk", states: {
        walk: { behavior: { type: "patrol", path: "route", speed: 2 } } } } },
    { id: "goblin", type: "Actor", mesh: "gob", tags: ["enemy"],
      transform: { pos: [0, 0, -3] }, stats: { hp: 10, maxHp: 10 },
      ragdoll: { enabled: true },
      stateMachine: { initial: "walk", states: {
        walk: { behavior: { type: "patrol", path: "route", speed: 3 } } } } }
  ],
  resources: {
    meshes: {
      body: { type: "silhouette", generator: "humanoid" },
      gob: { type: "silhouette", generator: "humanoid", beast: true }
    },
    materials: {}
  }
};
const inject = "\n<script>\nloadScene(" + JSON.stringify(JSON.stringify(scene)) +
  ");\nsetTimeout(function(){ if (window.nodes && nodes['goblin']) { nodes['goblin'].hp = 0; } }, 4000);\n</scr" + "ipt>\n";
let out = engine.indexOf("</body>") >= 0 ? engine.replace("</body>", inject + "</body>") : engine + inject;
fs.writeFileSync("showcase_knees.html", out);
console.log("OK showcase_knees.html");
