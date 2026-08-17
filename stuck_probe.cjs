// stuck_probe.cjs — reproduces "press heal, then slash" freeze headlessly.
// Boots scene_engine.html exactly like scene_engine_test.cjs, then drives a
// heal clip, interrupts it with slash mid-flight, and runs four detectors:
//   1 ANIM   pose latched (bones byte-identical while clip should have ended)
//   2 MOVE   actor has speed but position frozen
//   3 INPUT  action/combat flags latched true and never clear
//   4 FRAME  a tick throws or blows a time budget
//
//   node .\stuck_probe.cjs
"use strict";
const fs = require("fs");
const vm = require("vm");

// --------------------------------------------------------------------------
// sandbox (mirrors scene_engine_test.cjs)
// --------------------------------------------------------------------------
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
    putImageData: noop,
    createImageData: function () { return { data: new Uint8ClampedArray(4) }; },
    clip: noop, rect: noop, quadraticCurveTo: noop, bezierCurveTo: noop, ellipse: noop
  };
  stubCtx.__self = c;
  return c;
}

function makeEl(id) {
  const el = {
    id: id, style: {}, textContent: "", innerHTML: "", className: "",
    width: 640, height: 360, clientWidth: 640, clientHeight: 360,
    children: [], dataset: {},
    getContext: function () { return stubCtx(); },
    addEventListener: function () {}, removeEventListener: function () {},
    appendChild: function (c) { this.children.push(c); return c; },
    removeChild: function () {},
    remove: function () {},
    setAttribute: function () {}, getAttribute: function () { return null; },
    getBoundingClientRect: function () {
      return { left: 0, top: 0, width: 640, height: 360, right: 640, bottom: 360 };
    },
    classList: { add: function () {}, remove: function () {}, toggle: function () {},
                 contains: function () { return false; } },
    querySelector: function () { return makeEl("q"); },
    querySelectorAll: function () { return []; },
    focus: function () {}, blur: function () {}, click: function () {}
  };
  return el;
}

function buildSandbox() {
  const els = {};
  function get(id) { if (!els[id]) els[id] = makeEl(id); return els[id]; }
  const doc = {
    getElementById: get,
    createElement: function (t) { return makeEl(t); },
    createElementNS: function (ns, t) { return makeEl(t); },
    querySelector: function () { return get("view"); },
    querySelectorAll: function () { return []; },
    addEventListener: function () {}, removeEventListener: function () {},
    body: get("body"), documentElement: get("html"),
    head: get("head"), fonts: { ready: { then: function () {} } }
  };
  const sandbox = {
    console: console, document: doc,
    navigator: { userAgent: "node", maxTouchPoints: 0, vibrate: function () {} },
    location: { href: "file:///probe", search: "" },
    Math: Math, Date: Date, parseInt: parseInt, parseFloat: parseFloat,
    isNaN: isNaN, isFinite: isFinite, String: String, Number: Number,
    Object: Object, Array: Array, Boolean: Boolean, Error: Error,
    JSON: JSON, Map: Map, Set: Set, Promise: Promise, RegExp: RegExp,
    Uint8Array: Uint8Array, Uint8ClampedArray: Uint8ClampedArray,
    Float32Array: Float32Array, Int32Array: Int32Array,
    performance: { now: function () { return Date.now(); } },
    requestAnimationFrame: function () { return 0; },
    cancelAnimationFrame: function () {},
    setTimeout: function () { return 0; }, clearTimeout: function () {},
    setInterval: function () { return 0; }, clearInterval: function () {},
    localStorage: {
      _d: {},
      getItem: function (k) { return this._d[k] == null ? null : this._d[k]; },
      setItem: function (k, v) { this._d[k] = String(v); },
      removeItem: function (k) { delete this._d[k]; }
    },
    AudioContext: function () {
      return { createGain: function () { return { connect: function () {}, gain: { value: 0, setValueAtTime: function () {} } }; },
               createOscillator: function () { return { connect: function () {}, start: function () {}, stop: function () {}, frequency: { value: 0, setValueAtTime: function () {} } }; },
               createBiquadFilter: function () { return { connect: function () {}, frequency: { value: 0 } }; },
               destination: {}, currentTime: 0, sampleRate: 44100,
               createBuffer: function () { return { getChannelData: function () { return new Float32Array(8); } }; },
               createBufferSource: function () { return { connect: function () {}, start: function () {}, stop: function () {} }; } };
    },
    postedMessages: []
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.window.addEventListener = function () {};
  sandbox.window.removeEventListener = function () {};
  sandbox.ReactNativeWebView = { postMessage: function (m) { sandbox.postedMessages.push(m); } };
  return sandbox;
}

// --------------------------------------------------------------------------
// boot
// --------------------------------------------------------------------------
const html = fs.readFileSync("scene_engine.html", "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("ABORT: no <script> block in scene_engine.html"); process.exit(1); }

const sandbox = buildSandbox();
const ctx = vm.createContext(sandbox);
try {
  vm.runInContext(m[1], ctx, { filename: "scene_engine.html" });
} catch (e) {
  console.error("ABORT: engine threw on load: " + e.message + "\n" + e.stack);
  process.exit(1);
}
function call(expr) { return vm.runInContext(expr, ctx); }

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (detail != null ? "  -> " + detail : "")); }
}
function section(t) { console.log("\n== " + t + " =="); }

// one tick, guarded + timed. Returns {err, ms}
function tick(dt) {
  const t0 = Date.now();
  let err = null;
  try {
    call(
      "(function(h){world.time+=h;" +
      "if(typeof stepSystems==='function'){stepSystems(h);}else{" +
      "if(typeof updateRagdolls==='function')updateRagdolls();" +
      "if(typeof updatePoseClips==='function')updatePoseClips(h);" +
      "if(typeof updateAlarms==='function')updateAlarms(h);" +
      "if(typeof updatePhysics==='function')updatePhysics(h);" +
      "if(typeof updateAnims==='function')updateAnims(h);" +
      "updateTransforms(scene.nodes, matIdent());" +
      "actors.forEach(function(a){if(!a._dead)updateActor(a,h);});}" +
      "if(typeof updateAreas==='function')updateAreas();" +
      "})(" + dt + ")");
  } catch (e) { err = e; }
  return { err: err, ms: Date.now() - t0 };
}

// engine may not expose nodeById — define our own finder inside the sandbox
call("var __nb=function(id){var r=null;(function w(a){for(var i=0;i<a.length;i++){" +
     "if(a[i].id===id){r=a[i];return;}if(a[i].children)w(a[i].children);}})(scene.nodes);" +
     "if(!r&&typeof actors!=='undefined'){for(var j=0;j<actors.length;j++)if(actors[j].id===id)r=actors[j];}" +
     "return r;};");

function snap(id) {
  return call(
    "(function(){var n=__nb('" + id + "');if(!n)return null;" +
    "var p=null;try{p=typeof blendedPose==='function'?blendedPose(n):null;}catch(e){p={__err:String(e.message)};}" +
    "return JSON.stringify({pos:n.transform.pos.slice(),clip:n._clip?{name:n._clip.name||n._clip.id||'?',t:n._clip.t,done:!!n._clip.done}:null," +
    "queue:n._clipQueue?n._clipQueue.length:0,combat:n._combat?{phase:n._combat.phase,t:n._combat.t}:null," +
    "busy:!!n._busy,lock:!!n._actionLock,hitDone:!!n._hitDone,pose:p});})()");
}
function parse(s) { try { return JSON.parse(s); } catch (e) { return null; } }
function poseKey(p) { return p ? JSON.stringify(p) : "null"; }

// --------------------------------------------------------------------------
// scene: heal (non-looping, no cancelInto) then slash interrupt
// --------------------------------------------------------------------------
const scene = {
  kind: "kv_game_v1", engine: "scene",
  meta: { id: "probe", title: "stuck probe", seed: "p1" },
  render: { cameraMode: "overhead", vertexSnap: 0 },
  nodes: [
    { id: "cam", type: "Camera3D", mode: "fixed", fov: 50, transform: { pos: [0, 6, 12] } },
    { id: "hero", type: "Actor", mesh: "body", tags: ["player"],
      transform: { pos: [0, 0, 0] }, stats: { hp: 20, maxHp: 40, speed: 4 } },
    { id: "orc", type: "Actor", mesh: "body", tags: ["enemy"],
      transform: { pos: [2, 0, 0] }, stats: { hp: 60, maxHp: 60, speed: 3 } },
    { id: "ground", type: "MeshInstance", mesh: "slab", material: "g",
      transform: { pos: [0, -0.12, 0] } }
  ],
  resources: {
    meshes: { body: { type: "silhouette", generator: "humanoid" },
              slab: { type: "box", size: [40, 0.24, 40] } },
    materials: { g: { color: "#3a4438" } },
    poses: {
      heal: { dur: 1.2, loop: false, blendIn: 0.1,
        tracks: { armL: [[0, 0], [0.6, { rx: -100 }], [1.2, 0]],
                  armR: [[0, 0], [0.6, { rx: -100 }], [1.2, 0]] } },
      slash: { dur: 0.5, loop: false, blendIn: 0.08,
        combat: { phases: { active: 0.14, recovery: 0.2 },
                  hitbox: { forward: 1.1, height: 1.3, r: 0.7, damage: 9,
                            filter: "enemy", pushback: 3 } },
        tracks: { armR: [[0, 0], [0.14, { rx: -120, rz: 30 }], [0.3, { rx: 20, rz: -40 }], [0.5, 0]] } }
    }
  }
};

call("loadScene(" + JSON.stringify(JSON.stringify(scene)) + ")");

const DT = 1 / 60;
const budgetMs = 250;
let frameErr = null, slowest = 0, slowestAt = -1;

function run(frames, label) {
  for (let i = 0; i < frames; i++) {
    const r = tick(DT);
    if (r.ms > slowest) { slowest = r.ms; slowestAt = label + "+" + i; }
    if (r.err && !frameErr) { frameErr = { at: label + "+" + i, e: r.err }; return false; }
  }
  return true;
}

function play(id, pose) {
  try {
    call("(function(){var n=__nb('" + id + "');" +
         "if(typeof playPose==='function')playPose(n,'" + pose + "');" +
         "else if(typeof playClip==='function')playClip(n,'" + pose + "');})()");
    return true;
  } catch (e) { return String(e.message); }
}

// --------------------------------------------------------------------------
// 4. FRAME — throw / budget, checked continuously
// --------------------------------------------------------------------------
section("frame: heal then slash interrupt, no throw");
run(12, "warm");
play("hero", "heal");
run(20, "heal");                      // mid-heal (0.33s of 1.2s)
const midHeal = parse(snap("hero"));
play("hero", "slash");                // INTERRUPT — the reported repro
const okFrames = run(240, "post");    // 4s
ok("no throw during interrupt", frameErr === null,
   frameErr ? frameErr.at + ": " + frameErr.e.message + "\n" + frameErr.e.stack : null);
ok("no tick over budget", slowest < budgetMs, "slowest " + slowest + "ms at " + slowestAt);

// --------------------------------------------------------------------------
// 1. ANIM — clip should have ended long ago
// --------------------------------------------------------------------------
section("anim: clip clears after interrupt");
const after = parse(snap("hero"));
ok("mid-heal clip was active", midHeal && midHeal.clip != null,
   midHeal ? JSON.stringify(midHeal.clip) : "no snapshot");
ok("clip cleared 4s after a 0.5s slash", after && after.clip == null,
   after ? "still active: " + JSON.stringify(after.clip) : "no snapshot");

const p1 = after ? poseKey(after.pose) : "a";
run(60, "settle");
const later = parse(snap("hero"));
const p2 = later ? poseKey(later.pose) : "b";
ok("pose not frozen byte-identical over 1s", !(p1 === p2 && p1 !== "null"),
   p1 === p2 ? "latched pose: " + p1.slice(0, 220) : null);

// --------------------------------------------------------------------------
// 3. INPUT — action flags must clear
// --------------------------------------------------------------------------
section("input: action flags clear after clip");
ok("combat state cleared", !later || later.combat == null,
   later && later.combat ? JSON.stringify(later.combat) : null);
ok("no latched busy/action lock", !later || (!later.busy && !later.lock),
   later ? "busy=" + later.busy + " lock=" + later.lock : null);
ok("clip queue drained", !later || later.queue === 0,
   later ? "queue=" + later.queue : null);

// --------------------------------------------------------------------------
// 2. MOVE — actor with speed must still be able to move
// --------------------------------------------------------------------------
section("move: actor still moves after the interrupt");
const before = parse(snap("hero"));
call("(function(){var n=__nb('hero');" +
     "if(typeof moveActor==='function'){n._probeMove=1;}" +
     "n._vel=n._vel||{x:0,y:0,z:0};n._vel.x=4;" +
     "if(n.stats)n.stats.speed=4;" +
     "if(typeof setActorIntent==='function')setActorIntent(n,{x:1,z:0});" +
     "else{n._intent={x:1,z:0};n._moveX=1;n._moveZ=0;}})()");
run(60, "move");
const moved = parse(snap("hero"));
const dx = (before && moved) ? Math.abs(moved.pos[0] - before.pos[0]) : 0;
ok("position changed when driven", dx > 0.01, "dx=" + dx.toFixed(4) +
   " (if 0, movement is gated by a flag that never cleared)");

// --------------------------------------------------------------------------
// raw dump on any failure — tells me exactly what latched
// --------------------------------------------------------------------------
if (fail > 0) {
  console.log("\n-- raw hero state --");
  console.log(call(
    "(function(){var n=__nb('hero');var o={};for(var k in n){" +
    "if(k.charAt(0)!=='_')continue;var v=n[k];var t=typeof v;" +
    "if(v==null){o[k]=null;}else if(t==='number'||t==='boolean'||t==='string'){o[k]=v;}" +
    "else if(t==='object'){try{o[k]=JSON.stringify(v).slice(0,180);}catch(e){o[k]='[obj]';}}" +
    "else{o[k]='['+t+']';}}return JSON.stringify(o,null,1);})()"));
}

console.log("\n" + (fail === 0 ? "ALL GREEN" : "STUCK FOUND") + "  pass=" + pass + " fail=" + fail);
process.exit(fail === 0 ? 0 : 1);
