// combat_debug.cjs — headless C1 check: does the hitbox ever connect?
"use strict";
const fs = require("fs");
const vm = require("vm");
function stubCtx() {
  const noop = function () { return stubCtx.__self; };
  const c = { canvas: { width: 640, height: 360 }, fillStyle: "", strokeStyle: "", lineWidth: 1, font: "", globalAlpha: 1,
    textAlign: "", textBaseline: "", imageSmoothingEnabled: false,
    save: noop, restore: noop, beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, fill: noop, stroke: noop,
    fillRect: noop, strokeRect: noop, clearRect: noop, arc: noop, translate: noop, rotate: noop, scale: noop,
    setTransform: noop, drawImage: noop, fillText: noop, strokeText: noop,
    createLinearGradient: function () { return { addColorStop: noop }; },
    measureText: function () { return { width: 10 }; },
    getImageData: function () { return { data: new Uint8ClampedArray(4) }; },
    putImageData: noop, createImageData: function () { return { data: new Uint8ClampedArray(4) }; },
    clip: noop, rect: noop, quadraticCurveTo: noop, bezierCurveTo: noop, ellipse: noop };
  stubCtx.__self = c; return c;
}
function makeEl(id) {
  return { id, style: {}, textContent: "", innerHTML: "", className: "", width: 640, height: 360,
    clientWidth: 640, clientHeight: 360, children: [], dataset: {},
    getContext: function () { return stubCtx(); },
    addEventListener: function () {}, removeEventListener: function () {},
    appendChild: function (c) { this.children.push(c); return c; },
    removeChild: function () {}, insertBefore: function (c) { this.children.push(c); return c; },
    setAttribute: function () {}, getAttribute: function () { return null; },
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 640, height: 360 }; },
    querySelector: function () { return null; }, querySelectorAll: function () { return []; },
    focus: function () {}, blur: function () {}, remove: function () {} };
}
const els = {};
["view", "hud", "pad", "err"].forEach(id => els[id] = makeEl(id));
const document = { getElementById: id => els[id] || (els[id] = makeEl(id)), createElement: () => makeEl("dyn"),
  addEventListener: function () {}, removeEventListener: function () {}, body: makeEl("body"),
  documentElement: makeEl("html"), querySelector: () => null, querySelectorAll: () => [] };
const sandbox = { console, document, JSON, Math, Date, parseInt, parseFloat, isNaN, isFinite,
  String, Number, Object, Array, Boolean, Error, Uint8Array, Uint8ClampedArray, Float32Array, Int32Array,
  performance: { now: () => Date.now() }, requestAnimationFrame: () => 0, cancelAnimationFrame() {},
  setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, postedMessages: [] };
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
sandbox.window.addEventListener = function () {}; sandbox.window.removeEventListener = function () {};
sandbox.ReactNativeWebView = { postMessage: m => sandbox.postedMessages.push(m) };
const html = fs.readFileSync("scene_engine.html", "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
const ctx = vm.createContext(sandbox);
vm.runInContext(m[1], ctx, { filename: "scene_engine.html" });
const call = e => vm.runInContext(e, ctx);

const scene = {
  kind: "kv_game_v1", engine: "scene", meta: { id: "cdbg", title: "cdbg", seed: "c1" },
  render: { cameraMode: "overhead", vertexSnap: 0 },
  nodes: [
    { id: "hero", type: "Actor", mesh: "body", tags: ["player"], transform: { pos: [0, 0, 0], rot: [0, 90, 0] } },
    { id: "dummy", type: "Actor", mesh: "body", tags: ["enemy"], transform: { pos: [1.1, 0, 0], rot: [0, -90, 0] },
      stats: { hp: 30, maxHp: 30 }, ragdoll: { enabled: true } }
  ],
  resources: { meshes: { body: { type: "silhouette", generator: "humanoid" } }, materials: {},
    poses: { punch: { dur: 0.45, loop: false,
      combat: { phases: { active: 0.12, recovery: 0.18 },
                hitbox: { forward: 1.3, height: 1.3, r: 1.0, damage: 5, filter: "enemy", level: "high", pushback: 3 } },
      tracks: { armR: [[0, 0], [0.12, { rx: 35 }], [0.15, { rx: -95 }], [0.45, 0]] } } } }
};
call("loadScene(" + JSON.stringify(JSON.stringify(scene)) + ")");
console.log("hero:", call("JSON.stringify({pos:nodes['hero'].transform.pos, rot:nodes['hero'].transform.rot})"));
console.log("dummy hp:", call("nodes['dummy'].hp"), " stats:", call("JSON.stringify(nodes['dummy'].stats)"));
console.log("actors:", call("actors.length"), " dummyIsActor:", call("actors.indexOf(nodes['dummy'])") >= 0);
console.log("poseDef punch:", call("!!poseDef('punch')"), " combat:", call("!!poseDef('punch').combat"));

call("playPose(nodes['hero'], 'punch')");
console.log("clip started:", call("!!nodes['hero']._pose"));
for (let f = 1; f <= 30; f++) {
  vm.runInContext("(function(h){world.time+=h;if(typeof stepSystems==='function')stepSystems(h);else{updateRagdolls();updatePoseClips(h);updatePhysics(h);}})(1/60)", ctx);
  const t = call("nodes['hero']._pose ? nodes['hero']._pose.t.toFixed(3) : 'done'");
  const ph = call("nodes['hero']._combatPhase || '-'");
  const hp = call("nodes['dummy'].hp");
  if (f % 3 === 0 || ph === "active") console.log("f" + f + " t=" + t + " phase=" + ph + " dummyHp=" + hp);
  if (hp < 30) { console.log("HIT CONFIRMED at frame " + f); break; }
}
console.log("final dummy hp:", call("nodes['dummy'].hp"));
