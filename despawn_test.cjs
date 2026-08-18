// despawn_test.cjs — proves despawn is symmetric with spawn.
//
// The failure this guards against is a GHOST: a node removed from six tables
// but left in the seventh. Invisible on screen, still consuming CPU every
// frame, and possibly still colliding. The only way to catch it is to count
// every table before and after a spawn/despawn cycle and require exact parity.
//
//   node .\despawn_test.cjs
"use strict";
const fs = require("fs");
const vm = require("vm");

function stubCtx() {
  const c = { canvas: { width: 640, height: 360 } };
  const noop = function () { return c; };
  ["save","restore","beginPath","closePath","moveTo","lineTo","fill","stroke",
   "fillRect","strokeRect","clearRect","arc","translate","rotate","scale",
   "setTransform","drawImage","fillText","strokeText","clip","rect",
   "quadraticCurveTo","bezierCurveTo","ellipse","putImageData","setLineDash"
  ].forEach(function (k) { c[k] = noop; });
  c.fillStyle = ""; c.strokeStyle = ""; c.lineWidth = 1; c.font = "";
  c.globalAlpha = 1; c.textAlign = ""; c.textBaseline = "";
  c.createLinearGradient = function () { return { addColorStop: noop }; };
  c.measureText = function () { return { width: 10 }; };
  c.getImageData = function () { return { data: new Uint8ClampedArray(4) }; };
  c.createImageData = function () { return { data: new Uint8ClampedArray(4) }; };
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
    removeChild: function () {}, remove: function () {},
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
    body: get("body"), documentElement: get("html"), head: get("head"),
    fonts: { ready: { then: function () {} } }, visibilityState: "visible"
  };
  const sb = {
    console: { log: function () {}, warn: function () {}, error: function () {} },
    document: doc,
    navigator: { userAgent: "node", maxTouchPoints: 0, vibrate: function () {} },
    location: { href: "file:///dsp", search: "" },
    Math: Math, Date: Date, JSON: JSON, RegExp: RegExp,
    parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN, isFinite: isFinite,
    String: String, Number: Number, Object: Object, Array: Array,
    Boolean: Boolean, Error: Error, Map: Map, Set: Set, Promise: Promise,
    Uint8Array: Uint8Array, Uint8ClampedArray: Uint8ClampedArray,
    Float32Array: Float32Array, Float64Array: Float64Array, Int32Array: Int32Array,
    performance: { now: function () { return Date.now(); } },
    requestAnimationFrame: function () { return 0; },
    cancelAnimationFrame: function () {},
    setTimeout: function () { return 0; }, clearTimeout: function () {},
    setInterval: function () { return 0; }, clearInterval: function () {},
    devicePixelRatio: 1, innerWidth: 640, innerHeight: 360,
    AudioContext: function () {
      const g = function () {
        return { connect: function () {}, start: function () {}, stop: function () {},
                 gain: { value: 0, setValueAtTime: function () {},
                         linearRampToValueAtTime: function () {},
                         exponentialRampToValueAtTime: function () {} },
                 frequency: { value: 0, setValueAtTime: function () {},
                              linearRampToValueAtTime: function () {},
                              exponentialRampToValueAtTime: function () {} },
                 Q: { value: 1 }, type: "sine" };
      };
      return { createGain: g, createOscillator: g, createBiquadFilter: g,
               createBufferSource: g, createDelay: g, createConvolver: g,
               createDynamicsCompressor: g, createStereoPanner: g,
               createBuffer: function () { return { getChannelData: function () { return new Float32Array(8); } }; },
               destination: {}, currentTime: 0, sampleRate: 44100 };
    },
    postedMessages: []
  };
  sb.webkitAudioContext = sb.AudioContext;
  ["view", "hud", "dlg", "shop", "battle", "menu", "con"].forEach(function (id) { sb[id] = get(id); });
  sb.window = sb; sb.self = sb; sb.globalThis = sb;
  sb.window.addEventListener = function () {};
  sb.window.removeEventListener = function () {};
  sb.ReactNativeWebView = { postMessage: function (m) { sb.postedMessages.push(m); } };
  return sb;
}

const html = fs.readFileSync("scene_engine.html", "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("ABORT: no <script> block"); process.exit(1); }

const sb = buildSandbox();
const ctx = vm.createContext(sb);
try { vm.runInContext(m[1], ctx, { filename: "scene_engine.html" }); }
catch (e) { console.error("ABORT: engine threw on load: " + e.message); process.exit(1); }
function call(x) { return vm.runInContext(x, ctx); }

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (detail != null ? "  -> " + detail : "")); }
}
function section(t) { console.log("\n== " + t + " =="); }

if (typeof call("typeof despawn") !== "string" || call("typeof despawn") !== "function") {
  console.error("ABORT: despawn not present -- run patch_despawn_pool.cjs first");
  process.exit(1);
}

const scene = {
  kind: "kv_game_v1", engine: "scene",
  meta: { id: "dsp", title: "d", seed: "s1" },
  render: { cameraMode: "overhead", vertexSnap: 0 },
  nodes: [
    { id: "cam", type: "Camera3D", mode: "fixed", transform: { pos: [0, 8, 14] } },
    { id: "ground", type: "MeshInstance", mesh: "slab", material: "g",
      transform: { pos: [0, -0.12, 0] } },
    { id: "hero", type: "Actor", mesh: "body", tags: ["player"],
      transform: { pos: [0, 0, 0] }, stats: { hp: 30, maxHp: 30 } }
  ],
  resources: {
    meshes: { body: { type: "silhouette", generator: "humanoid" },
              box: { type: "box", size: [1, 1, 1] },
              slab: { type: "box", size: [60, 0.24, 60] } },
    materials: { g: { color: "#3a4438" } }
  }
};
call("loadScene(" + JSON.stringify(JSON.stringify(scene)) + ")");

function stats() { return JSON.parse(call("JSON.stringify(poolStats())")); }
function pump(n) {
  call("(function(n,h){for(var i=0;i<n;i++){world.time+=h;" +
       "if(typeof stepSystems==='function')stepSystems(h);}})(" + n + "," + (1 / 60) + ")");
}

// ---------------------------------------------------------------------------
section("spawn/despawn parity: every table returns to baseline");
const base = stats();

call("(function(){for(var i=0;i<50;i++){spawnNode({id:'ob'+i,type:'MeshInstance'," +
     "mesh:'box',material:'g',transform:{pos:[i*2,0,0]},physics:{mass:1}});}})()");
const afterSpawn = stats();
ok("50 spawns registered", afterSpawn.live === base.live + 50,
   "live " + base.live + " -> " + afterSpawn.live);
ok("bodies registered too", afterSpawn.bodies === base.bodies + 50,
   "bodies " + base.bodies + " -> " + afterSpawn.bodies);

pump(30);
call("(function(){for(var i=0;i<50;i++){despawn('ob'+i);}})()");
const afterDespawn = stats();

["live", "actors", "bodies", "posed", "alarms", "anims", "ragdolls"].forEach(function (k) {
  ok("table '" + k + "' back to baseline", afterDespawn[k] === base[k],
     base[k] + " -> " + afterDespawn[k] + " (leak of " + (afterDespawn[k] - base[k]) + ")");
});

// ---------------------------------------------------------------------------
section("pooling: despawned nodes are reused, not rebuilt");
const parked = stats().parked;
ok("nodes parked in pool", parked >= 50, "parked=" + parked);

call("(function(){window.__geoBefore=[];for(var i=0;i<10;i++){" +
     "var n=spawnNode({id:'re'+i,type:'MeshInstance',mesh:'box',material:'g'," +
     "transform:{pos:[i,0,5]}});window.__geoBefore.push(!!n._geo);}})()");
const reusedGeo = call("window.__geoBefore.filter(function(x){return x;}).length");
ok("reused nodes keep their geometry", reusedGeo === 10, reusedGeo + "/10 had _geo");
ok("pool shrank on reuse", stats().parked === parked - 10,
   "parked " + parked + " -> " + stats().parked);

// ---------------------------------------------------------------------------
section("actors: bt nodes unregister from the actor list");
const b2 = stats();
call("spawnNode({id:'guard',type:'Actor',mesh:'body',tags:['enemy']," +
     "transform:{pos:[10,0,0]},stats:{hp:10,maxHp:10}," +
     "bt:{sequence:[{task:{type:'seek',target:'hero',speed:3}}]}})");
ok("bt actor joined actors[]", stats().actors === b2.actors + 1,
   b2.actors + " -> " + stats().actors);
pump(30);
call("despawn('guard')");
ok("bt actor left actors[]", stats().actors === b2.actors,
   b2.actors + " -> " + stats().actors + " (ghost actor still ticking)");

// ---------------------------------------------------------------------------
section("children: despawning a parent removes its subtree");
const b3 = stats();
call("(function(){var p=spawnNode({id:'par',type:'MeshInstance',mesh:'box'," +
     "material:'g',transform:{pos:[0,0,20]}});" +
     "for(var i=0;i<5;i++)spawnNode({id:'kid'+i,type:'MeshInstance',mesh:'box'," +
     "material:'g',transform:{pos:[i,0,20]},physics:{mass:1}},p);})()");
ok("parent + 5 children live", stats().live === b3.live + 6,
   b3.live + " -> " + stats().live);
call("despawn('par')");
ok("subtree fully removed", stats().live === b3.live,
   b3.live + " -> " + stats().live + " (orphaned children)");
ok("child bodies removed too", stats().bodies === b3.bodies,
   b3.bodies + " -> " + stats().bodies);

// ---------------------------------------------------------------------------
section("churn: 2000 spawn/despawn cycles must not grow any table");
const b4 = stats();
call("(function(){for(var i=0;i<2000;i++){" +
     "spawnNode({id:'churn',type:'MeshInstance',mesh:'box',material:'g'," +
     "transform:{pos:[0,0,0]},physics:{mass:1}});despawn('churn');}})()");
const b5 = stats();
["live", "actors", "bodies", "posed", "alarms", "anims", "ragdolls"].forEach(function (k) {
  ok("no growth in '" + k + "' after 2000 cycles", b5[k] === b4[k],
     b4[k] + " -> " + b5[k]);
});
ok("pool is bounded", b5.parked <= 256 + 60, "parked=" + b5.parked);

pump(60);
ok("engine still runs after churn", true);

console.log("\n" + (fail === 0 ? "ALL GREEN" : "LEAK FOUND") + "  pass=" + pass + " fail=" + fail);
process.exit(fail === 0 ? 0 : 1);
