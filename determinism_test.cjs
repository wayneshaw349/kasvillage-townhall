// determinism_test.cjs — verifies the engine's central claim:
//   "a game is a JSON scene descriptor + seed, rendered identically on every device"
//
// Nothing in the codebase currently checks that. Replays, on-chain verification
// and any future PvP all depend on it, and determinism is far harder to add to
// a physics engine after the fact than to protect from the start.
//
//   node .\determinism_test.cjs                 run all checks
//   node .\determinism_test.cjs --emit ref.json write a reference fixture
//   node .\determinism_test.cjs --check ref.json compare against one
//
// The --emit/--check pair is the cross-platform half: emit on one machine,
// check on another (or in the phone's WebView) to catch float divergence.
"use strict";
const fs = require("fs");
const vm = require("vm");

// ---------------------------------------------------------------------------
// sandbox — instrumented to catch the classic determinism leaks
// ---------------------------------------------------------------------------
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
  c.imageSmoothingEnabled = false;
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

// counters for non-deterministic sources
const LEAKS = { random: 0, now: 0, dateNow: 0 };

function buildSandbox() {
  const els = {};
  function get(id) { if (!els[id]) els[id] = makeEl(id); return els[id]; }

  // Math with an instrumented random: any call during simulation is a leak,
  // because a deterministic engine must draw from the seeded generator.
  const M = {};
  Object.getOwnPropertyNames(Math).forEach(function (k) { M[k] = Math[k]; });
  M.random = function () { LEAKS.random++; return 0.5; };

  const FrozenDate = function () { LEAKS.dateNow++; return new Date(0); };
  FrozenDate.now = function () { LEAKS.dateNow++; return 0; };
  FrozenDate.prototype = Date.prototype;

  const doc = {
    getElementById: get,
    createElement: function (t) { return makeEl(t); },
    createElementNS: function (ns, t) { return makeEl(t); },
    querySelector: function () { return get("view"); },
    querySelectorAll: function () { return []; },
    addEventListener: function () {}, removeEventListener: function () {},
    body: get("body"), documentElement: get("html"), head: get("head"),
    fonts: { ready: { then: function () {} } },
    visibilityState: "visible"
  };

  const sb = {
    console: { log: function () {}, warn: function () {}, error: function () {} },
    document: doc,
    navigator: { userAgent: "node", maxTouchPoints: 0, vibrate: function () {} },
    location: { href: "file:///det", search: "" },
    Math: M, Date: FrozenDate, JSON: JSON, RegExp: RegExp,
    parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN, isFinite: isFinite,
    String: String, Number: Number, Object: Object, Array: Array,
    Boolean: Boolean, Error: Error, Map: Map, Set: Set, Promise: Promise,
    Uint8Array: Uint8Array, Uint8ClampedArray: Uint8ClampedArray,
    Float32Array: Float32Array, Float64Array: Float64Array, Int32Array: Int32Array,
    performance: { now: function () { LEAKS.now++; return 0; } },
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
const ENGINE = m[1];

function newCtx() {
  const sb = buildSandbox();
  const ctx = vm.createContext(sb);
  vm.runInContext(ENGINE, ctx, { filename: "scene_engine.html" });
  return { sb: sb, ctx: ctx };
}

// ---------------------------------------------------------------------------
// state hashing — quantised so we measure real divergence, not float noise
// ---------------------------------------------------------------------------
// Positions are rounded to 1e-6. Anything coarser hides bugs; anything finer
// reports last-bit differences that no gameplay could observe.
const HASH_FN = [
  "(function(){",
  "  function q(n){ if(typeof n!=='number'||!isFinite(n))return 'x';",
  "    return (Math.round(n*1e6)/1e6).toFixed(6); }",
  "  var ids=Object.keys(nodes).sort();",   // sorted: key order must not matter
  "  var out=[];",
  "  for(var i=0;i<ids.length;i++){",
  "    var n=nodes[ids[i]]; if(!n)continue;",
  "    var t=n.transform||{};",
  "    var p=t.pos||[0,0,0], r=t.rot||[0,0,0];",
  "    var row=[ids[i],q(p[0]),q(p[1]),q(p[2]),q(r[0]),q(r[1]),q(r[2])];",
  "    if(n.stats)row.push('hp'+q(n.stats.hp));",
  "    if(n._pose)row.push('pose:'+n._pose.id+':'+q(n._pose.t));",
  "    if(n._vy!=null)row.push('vy'+q(n._vy));",
  "    out.push(row.join(','));",
  "  }",
  "  out.push('time'+q(world.time));",
  "  out.push('score'+q(world.score));",
  "  if(typeof BODIES!=='undefined')out.push('bodies'+BODIES.length);",
  "  if(typeof PARTICLES!=='undefined')out.push('parts'+PARTICLES.length);",
  "  return out.join('|');",
  "})()"
].join("\n");

function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ("00000000" + h.toString(16)).slice(-8);
}

function pump(ctx, n, dt) {
  vm.runInContext(
    "(function(n,h){for(var i=0;i<n;i++){" +
    "world.time+=h;" +
    "if(typeof stepSystems==='function'){stepSystems(h);}else{" +
    "if(typeof updateRagdolls==='function')updateRagdolls();" +
    "if(typeof updatePoseClips==='function')updatePoseClips(h);" +
    "if(typeof updateAlarms==='function')updateAlarms(h);" +
    "if(typeof updatePhysics==='function')updatePhysics(h);" +
    "if(typeof updateAnims==='function')updateAnims(h);" +
    "updateTransforms(scene.nodes, matIdent());" +
    "actors.forEach(function(a){if(!a._dead)updateActor(a,h);});}" +
    "if(typeof updateAreas==='function')updateAreas();" +
    "}})(" + n + "," + dt + ")", ctx);
}

// run a scene, sampling a hash every `every` ticks
function trace(scene, ticks, every) {
  const env = newCtx();
  vm.runInContext("loadScene(" + JSON.stringify(JSON.stringify(scene)) + ")", env.ctx);
  // Purity is about the SIMULATION, not load. Boot legitimately reads the clock
  // (render-loop lastT, autosave bookkeeping, load-time budget guards); none of
  // that feeds the sim. Zero the counters here so we measure only the ticks.
  LEAKS.random = 0; LEAKS.now = 0; LEAKS.dateNow = 0;
  const out = [];
  for (let t = 0; t < ticks; t += every) {
    pump(env.ctx, every, 1 / 60);
    out.push(fnv1a(String(vm.runInContext(HASH_FN, env.ctx))));
  }
  return out;
}

// ---------------------------------------------------------------------------
// fixtures — chosen to exercise the systems most likely to drift
// ---------------------------------------------------------------------------
const FIXTURES = {
  physics: {
    kind: "kv_game_v1", engine: "scene",
    meta: { id: "det_phys", title: "d", seed: "seed-alpha" },
    render: { cameraMode: "overhead", vertexSnap: 0 },
    nodes: (function () {
      const n = [
        { id: "cam", type: "Camera3D", mode: "fixed", transform: { pos: [0, 8, 14] } },
        { id: "ground", type: "MeshInstance", mesh: "slab", material: "g",
          transform: { pos: [0, -0.12, 0] } }
      ];
      for (let i = 0; i < 10; i++) {
        n.push({ id: "b" + i, type: "MeshInstance", mesh: "box", material: "g",
                 transform: { pos: [(i % 3) * 0.4 - 0.4, 2 + i * 1.1, (i % 2) * 0.3] },
                 physics: { mass: 1 } });
      }
      return n;
    })(),
    resources: {
      meshes: { box: { type: "box", size: [1, 1, 1] }, slab: { type: "box", size: [40, 0.24, 40] } },
      materials: { g: { color: "#3a4438" } }
    }
  },

  actors: {
    kind: "kv_game_v1", engine: "scene",
    meta: { id: "det_actors", title: "d", seed: "seed-beta" },
    render: { cameraMode: "overhead", vertexSnap: 0 },
    nodes: [
      { id: "cam", type: "Camera3D", mode: "fixed", transform: { pos: [0, 8, 14] } },
      { id: "ground", type: "MeshInstance", mesh: "slab", material: "g",
        transform: { pos: [0, -0.12, 0] } },
      { id: "target", type: "Actor", mesh: "body", tags: ["player"],
        transform: { pos: [30, 0, 4] }, stats: { hp: 100, maxHp: 100 } },
      { id: "g1", type: "Actor", mesh: "body", tags: ["enemy"],
        transform: { pos: [0, 0, 0], rot: [0, 90, 0] },
        stats: { hp: 30, maxHp: 30 }, vision: { range: 40, fovDeg: 170 },
        bt: { sequence: [ { task: { type: "seek", target: "target", speed: 5 },
                            until: "distance(self, target) < 2" } ] } },
      { id: "g2", type: "Actor", mesh: "body", tags: ["enemy"],
        transform: { pos: [-4, 0, 6] }, stats: { hp: 30, maxHp: 30 },
        vision: { range: 40, fovDeg: 170 },
        bt: { sequence: [ { task: { type: "seek", target: "target", speed: 3.5 },
                            until: "distance(self, target) < 2" } ] } }
    ],
    resources: {
      meshes: { body: { type: "silhouette", generator: "humanoid" },
                slab: { type: "box", size: [80, 0.24, 80] } },
      materials: { g: { color: "#3a4438" } }
    }
  }
};

// ---------------------------------------------------------------------------
// checks
// ---------------------------------------------------------------------------
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (detail != null ? "  -> " + detail : "")); }
}
function section(t) { console.log("\n== " + t + " =="); }

const TICKS = 600, EVERY = 60;
const args = process.argv.slice(2);

// --emit / --check: the cross-platform half
if (args[0] === "--emit") {
  const ref = {};
  Object.keys(FIXTURES).forEach(function (k) { ref[k] = trace(FIXTURES[k], TICKS, EVERY); });
  ref.__meta = { node: process.version, platform: process.platform, arch: process.arch };
  fs.writeFileSync(args[1] || "determinism_ref.json", JSON.stringify(ref, null, 1));
  console.log("wrote " + (args[1] || "determinism_ref.json") + " on " +
              process.platform + "/" + process.arch + " node " + process.version);
  process.exit(0);
}

if (args[0] === "--check") {
  const ref = JSON.parse(fs.readFileSync(args[1] || "determinism_ref.json", "utf8"));
  section("cross-platform: hashes match the reference fixture");
  console.log("  reference from " + ref.__meta.platform + "/" + ref.__meta.arch +
              " node " + ref.__meta.node);
  console.log("  this run       " + process.platform + "/" + process.arch +
              " node " + process.version);
  Object.keys(FIXTURES).forEach(function (k) {
    const mine = trace(FIXTURES[k], TICKS, EVERY);
    const theirs = ref[k] || [];
    let firstDiff = -1;
    for (let i = 0; i < Math.max(mine.length, theirs.length); i++) {
      if (mine[i] !== theirs[i]) { firstDiff = i; break; }
    }
    ok(k + ": identical across platforms", firstDiff === -1,
       firstDiff >= 0 ? "diverged at tick " + (firstDiff * EVERY) +
                        " (" + theirs[firstDiff] + " vs " + mine[firstDiff] + ")" : null);
  });
  console.log("\n" + (fail === 0 ? "ALL GREEN" : "DIVERGENCE") + "  pass=" + pass + " fail=" + fail);
  process.exit(fail === 0 ? 0 : 1);
}

// 1. same seed, same result, twice in a row
section("determinism: identical runs from the same seed");
Object.keys(FIXTURES).forEach(function (k) {
  const a = trace(FIXTURES[k], TICKS, EVERY);
  const b = trace(FIXTURES[k], TICKS, EVERY);
  let firstDiff = -1;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { firstDiff = i; break; }
  ok(k + ": two runs agree over " + TICKS + " ticks", firstDiff === -1,
     firstDiff >= 0 ? "diverged at tick " + (firstDiff * EVERY) +
                      " (" + a[firstDiff] + " vs " + b[firstDiff] + ")" : null);
  ok(k + ": state actually evolves", new Set(a).size > 1,
     new Set(a).size <= 1 ? "every sample identical -- scene may be inert, test proves nothing" : null);
});

// 2. a different seed must produce a different world
section("seed sensitivity: a different seed changes the outcome");
Object.keys(FIXTURES).forEach(function (k) {
  const base = FIXTURES[k];
  const alt = JSON.parse(JSON.stringify(base));
  alt.meta.seed = base.meta.seed + "-variant";
  const a = trace(base, 180, 60);
  const b = trace(alt, 180, 60);
  const same = a.join() === b.join();
  // Not a failure: a scene with no seeded randomness legitimately matches.
  console.log("  NOTE  " + k + ": seed change " +
              (same ? "produced identical state (no seeded randomness in this fixture)"
                    : "produced different state (seeded RNG is in play)"));
});

// 3. non-deterministic sources must not be touched during simulation
section("purity: no Math.random / Date.now / performance.now in the sim");
trace(FIXTURES.physics, 300, 300);   // counters are zeroed after loadScene
ok("Math.random not called during sim", LEAKS.random === 0,
   LEAKS.random + " call(s) -- seeded rnd() must be used instead, or replays break");
ok("Date.now not called during sim", LEAKS.dateNow === 0,
   LEAKS.dateNow + " call(s) -- wall-clock in the sim makes runs unrepeatable");
ok("performance.now not called during sim", LEAKS.now === 0,
   LEAKS.now + " call(s) -- frame timing must come from world.time");

// 4. key order must not affect the outcome
section("node order: declaration order must not change physics outcome");
(function () {
  const base = FIXTURES.physics;
  const shuffled = JSON.parse(JSON.stringify(base));
  const head = shuffled.nodes.slice(0, 2);
  const rest = shuffled.nodes.slice(2).reverse();
  shuffled.nodes = head.concat(rest);
  const a = trace(base, 300, 300);
  const b = trace(shuffled, 300, 300);
  // Bodies resting on each other legitimately depend on order, so this is a
  // NOTE rather than a failure -- but a large divergence is worth knowing.
  console.log("  NOTE  reversed declaration order " +
              (a.join() === b.join() ? "gave identical state" : "gave different state"));
})();

console.log("\n" + (fail === 0 ? "ALL GREEN" : "NOT DETERMINISTIC") +
            "  pass=" + pass + " fail=" + fail);
console.log("\nCross-platform check:");
console.log("  node .\\determinism_test.cjs --emit determinism_ref.json   (here)");
console.log("  node .\\determinism_test.cjs --check determinism_ref.json  (other machine)");
process.exit(fail === 0 ? 0 : 1);
