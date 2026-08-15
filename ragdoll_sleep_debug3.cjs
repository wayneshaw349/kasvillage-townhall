// ragdoll_sleep_debug.cjs — per-bone vel/sleep dump, 12 seconds
"use strict";
const fs = require("fs");
const vm = require("vm");

function stubCtx() {
  const noop = function () { return stubCtx.__self; };
  const c = {
    canvas: { width: 640, height: 360 },
    fillStyle: "", strokeStyle: "", lineWidth: 1, font: "", globalAlpha: 1,
    textAlign: "", textBaseline: "", imageSmoothingEnabled: false,
    save: noop, restore: noop, beginPath: noop, closePath: noop, moveTo: noop,
    lineTo: noop, fill: noop, stroke: noop, fillRect: noop, strokeRect: noop,
    clearRect: noop, arc: noop, translate: noop, rotate: noop, scale: noop,
    setTransform: noop, drawImage: noop, fillText: noop, strokeText: noop,
    createLinearGradient: function () { return { addColorStop: noop }; },
    measureText: function () { return { width: 10 }; },
    getImageData: function () { return { data: new Uint8ClampedArray(4) }; },
    putImageData: noop, createImageData: function () { return { data: new Uint8ClampedArray(4) }; },
    clip: noop, rect: noop, quadraticCurveTo: noop, bezierCurveTo: noop, ellipse: noop
  };
  stubCtx.__self = c;
  return c;
}
function makeEl(id) {
  return {
    id: id, style: {}, textContent: "", innerHTML: "", className: "",
    width: 640, height: 360, clientWidth: 640, clientHeight: 360,
    children: [], dataset: {},
    getContext: function () { return stubCtx(); },
    addEventListener: function () {}, removeEventListener: function () {},
    appendChild: function (c) { this.children.push(c); return c; },
    removeChild: function () {}, insertBefore: function (c) { this.children.push(c); return c; },
    setAttribute: function () {}, getAttribute: function () { return null; },
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 640, height: 360 }; },
    querySelector: function () { return null; }, querySelectorAll: function () { return []; },
    focus: function () {}, blur: function () {}, remove: function () {}
  };
}
const els = {};
["view", "hud", "pad", "err"].forEach(id => els[id] = makeEl(id));
const document = {
  getElementById: id => els[id] || (els[id] = makeEl(id)),
  createElement: () => makeEl("dyn"),
  addEventListener: function () {}, removeEventListener: function () {},
  body: makeEl("body"), documentElement: makeEl("html"),
  querySelector: () => null, querySelectorAll: () => []
};
const sandbox = {
  console, document, JSON, Math, Date, parseInt, parseFloat, isNaN, isFinite,
  String, Number, Object, Array, Boolean, Error,
  Uint8Array, Uint8ClampedArray, Float32Array, Int32Array,
  performance: { now: () => Date.now() },
  requestAnimationFrame: () => 0, cancelAnimationFrame: function () {},
  setTimeout: () => 0, clearTimeout: function () {},
  setInterval: () => 0, clearInterval: function () {},
  postedMessages: []
};
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
sandbox.window.addEventListener = function () {};
sandbox.window.removeEventListener = function () {};
sandbox.ReactNativeWebView = { postMessage: m => sandbox.postedMessages.push(m) };

const html = fs.readFileSync("scene_engine.html", "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("no script block"); process.exit(1); }
const ctx = vm.createContext(sandbox);
vm.runInContext(m[1], ctx, { filename: "scene_engine.html" });
const call = e => vm.runInContext(e, ctx);

const scene = {
  kind: "kv_game_v1", engine: "scene", meta: { id: "dbg", title: "dbg", seed: "r10" },
  render: { cameraMode: "overhead", vertexSnap: 0 },
  nodes: [
    { id: "hero", type: "Actor", mesh: "body", tags: ["player"], transform: { pos: [0, 0, 0] } },
    { id: "route", type: "Path3D", closed: false, points: [[3,0,0],[20,0,0]] },
    { id: "mook", type: "Actor", mesh: "body", tags: ["enemy"],
      transform: { pos: [3, 0, 0] }, stats: { hp: 20, maxHp: 20 },
      ragdoll: { enabled: true },
      stateMachine: { initial: "walk", states: { walk: { behavior: { type: "patrol", path: "route", speed: 3 } } } } }
  ],
  resources: { meshes: { body: { type: "silhouette", generator: "humanoid" } }, materials: {} }
};
call("loadScene(" + JSON.stringify(JSON.stringify(scene)) + ")");
pump(20);
call("runAction(nodes['mook'], { action:'ragdoll', target:'mook', args:[0, 6, 4] });");
console.log("PHYS: sleepVel=" + call("PHYS.sleepVel") + " sleepTime=" + call("PHYS.sleepTime") + " slop=" + call("PHYS.slop"));

function pump(frames) {
  vm.runInContext(
    "(function(n,h){for(var i=0;i<n;i++){world.time+=h;" +
    "if(typeof stepSystems==='function'){stepSystems(h);}else{" +
    "updateRagdolls();updatePhysics(h);}}})(" + frames + "," + (1 / 60) + ")", ctx);
}

for (let sec = 1; sec <= 12; sec++) {
  pump(60);
  const rows = call(
    "(function(){var rag=nodes['mook']._rag,out=[];for(var k in rag.bones){var b=rag.bones[k].body;" +
    "var v=Math.sqrt(b.vel.x*b.vel.x+b.vel.y*b.vel.y+b.vel.z*b.vel.z);" +
    "out.push(k+' y='+b.node.transform.pos[1].toFixed(3)+' v='+v.toFixed(4)+' sleep='+b.sleep.toFixed(2)+' asleep='+b.asleep);}return out.join('\\n');})()");
  const asleepN = call("(function(){var rag=nodes['mook']._rag,n=0;for(var k in rag.bones)if(rag.bones[k].body.asleep)n++;return n;})()");
  const rs = call("(function(){var r=nodes['mook']._rag;return 'settled='+r.settled+' still='+r.still+' calm='+r.calm+' age='+(r.age!=null?r.age.toFixed(1):'undef')+' hinges='+(r.hinges?r.hinges.length:'undef');})()");
  console.log("\n== t=" + sec + "s  asleep=" + asleepN + "/10  " + rs + " ==");
  console.log(rows);
  if (asleepN === 10) { console.log("\nALL ASLEEP at " + sec + "s"); break; }
}
