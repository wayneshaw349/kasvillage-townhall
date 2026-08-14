// scene_engine_test.cjs — headless regression for scene_engine.html
// Boots the engine script inside a vm context with DOM/canvas stubs, then
// drives fixed-dt frames and asserts against engine internals.
//
//   node .\scene_engine_test.cjs
//
// Exit code 0 = all green, 1 = any failure.
"use strict";
const fs = require("fs");
const vm = require("vm");

// ---------------------------------------------------------------------------
// assertions
// ---------------------------------------------------------------------------
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (detail != null ? "  -> " + detail : "")); }
}
function near(a, b, eps) { return Math.abs(a - b) <= (eps == null ? 0.05 : eps); }
function section(t) { console.log("\n== " + t + " =="); }

// ---------------------------------------------------------------------------
// DOM / canvas stubs
// ---------------------------------------------------------------------------
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
  const el = {
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
  return el;
}

function buildSandbox() {
  const els = {};
  ["view", "hud", "pad", "err"].forEach(function (id) { els[id] = makeEl(id); });

  const document = {
    getElementById: function (id) { return els[id] || (els[id] = makeEl(id)); },
    createElement: function () { return makeEl("dyn"); },
    addEventListener: function () {}, removeEventListener: function () {},
    body: makeEl("body"), documentElement: makeEl("html"),
    querySelector: function () { return null; }, querySelectorAll: function () { return []; }
  };

  const sandbox = {
    console: console,
    document: document,
    JSON: JSON, Math: Math, Date: Date, parseInt: parseInt, parseFloat: parseFloat,
    isNaN: isNaN, isFinite: isFinite, String: String, Number: Number,
    Object: Object, Array: Array, Boolean: Boolean, Error: Error,
    Uint8Array: Uint8Array, Uint8ClampedArray: Uint8ClampedArray,
    Float32Array: Float32Array, Int32Array: Int32Array,
    performance: { now: function () { return Date.now(); } },
    requestAnimationFrame: function () { return 0; }, // frames driven manually
    cancelAnimationFrame: function () {},
    setTimeout: function (fn) { return 0; },          // deterministic: no real timers
    clearTimeout: function () {},
    setInterval: function () { return 0; }, clearInterval: function () {},
    postedMessages: []
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.window.addEventListener = function () {};
  sandbox.window.removeEventListener = function () {};
  sandbox.ReactNativeWebView = {
    postMessage: function (m) { sandbox.postedMessages.push(m); }
  };
  return sandbox;
}

// ---------------------------------------------------------------------------
// boot engine
// ---------------------------------------------------------------------------
const html = fs.readFileSync("scene_engine.html", "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("ABORT: no <script> block found in scene_engine.html"); process.exit(1); }
const engineSrc = m[1];

const sandbox = buildSandbox();
const ctx = vm.createContext(sandbox);
try {
  vm.runInContext(engineSrc, ctx, { filename: "scene_engine.html" });
} catch (e) {
  console.error("ABORT: engine threw on load: " + e.message + "\n" + e.stack);
  process.exit(1);
}

function G(name) { return vm.runInContext(name, ctx); }
function call(expr) { return vm.runInContext(expr, ctx); }

if (typeof G("loadScene") !== "function") {
  console.error("ABORT: loadScene not exposed in engine scope");
  process.exit(1);
}

// Drive N fixed-dt frames through the engine's own systems.
function pump(frames, dt) {
  dt = dt || 1 / 60;
  vm.runInContext(
    "(function(n,h){for(var i=0;i<n;i++){" +
    "world.time+=h;" +
    "if(typeof updateAlarms==='function')updateAlarms(h);" +
    "if(typeof updatePhysics==='function')updatePhysics(h);" +
    "if(typeof updateAnims==='function')updateAnims(h);" +
    "updateTransforms(scene.nodes, matIdent());" +
    "actors.forEach(function(a){if(!a._dead)updateActor(a,h);});" +
    "if(typeof updateAreas==='function')updateAreas();" +
    "}})(" + frames + "," + dt + ")", ctx);
}

function load(scene) {
  sandbox.postedMessages.length = 0;
  call("loadScene(" + JSON.stringify(JSON.stringify(scene)) + ")");
}

const BASE_RENDER = { cameraMode: "overhead", vertexSnap: 0 };

// ---------------------------------------------------------------------------
// 1. PHYSICS
// ---------------------------------------------------------------------------
section("physics: stacking, rest, sleep");
(function () {
  const nodes = [
    { id: "hero", type: "Actor", mesh: "box", tags: ["player"], transform: { pos: [50, 0, 50] } }
  ];
  for (let i = 0; i < 8; i++) {
    nodes.push({
      id: "crate" + i, type: "MeshInstance", mesh: "box",
      transform: { pos: [0, 6 + i * 1.4, 0] },
      physics: { body: "dynamic", shape: "box", half: [0.5, 0.5, 0.5], mass: 1, restitution: 0.05, friction: 0.8 }
    });
  }
  load({
    kind: "kv_game_v1", engine: "scene", meta: { id: "phys", title: "phys", seed: "p1" },
    render: BASE_RENDER, nodes: nodes,
    resources: { meshes: { box: { type: "box" } }, materials: {} }
  });

  ok("8 bodies registered", G("BODIES.length") === 8, G("BODIES.length"));

  pump(600); // 10s

  const ys = call("BODIES.map(function(b){return b.node.transform.pos[1];})");
  const minY = Math.min.apply(null, ys);
  ok("no body fell through the floor", minY >= 0.4, "minY=" + minY.toFixed(3));

  const sorted = ys.slice().sort(function (a, b) { return a - b; });
  let overlap = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i] - sorted[i - 1];
    if (gap < 0.9) overlap++;
  }
  ok("stack is separated (no interpenetration)", overlap === 0, "overlaps=" + overlap + " ys=" + sorted.map(function (v) { return v.toFixed(2); }).join(","));

  const asleep = call("BODIES.filter(function(b){return b.asleep;}).length");
  ok("all bodies asleep after 10s", asleep === 8, "asleep=" + asleep);

  const vmax = Math.max.apply(null, call("BODIES.map(function(b){return Math.abs(b.vel.y);})"));
  ok("velocities settled", vmax < 0.05, "maxVy=" + vmax.toFixed(4));
})();

section("physics: impulse wakes, raycast finds nearest");
(function () {
  const wokeBefore = call("BODIES[0].asleep");
  call("physImpulse(nodes['crate0'], 0, 12, 0)");
  ok("impulse wakes a sleeping body", wokeBefore === true && call("BODIES[0].asleep") === false);

  pump(30);
  const hit = call("raycast({x:0,y:20,z:0},{x:0,y:-1,z:0},50)");
  ok("raycast hits a body below", hit && hit.node && hit.node.id.indexOf("crate") === 0, hit ? hit.node.id : "null");
  const miss = call("raycast({x:80,y:20,z:80},{x:0,y:-1,z:0},50)");
  ok("raycast misses empty space", miss === null, miss ? miss.node.id : "null");
})();

// ---------------------------------------------------------------------------
// 2. TAGS
// ---------------------------------------------------------------------------
section("gameplay tags: hierarchical matching");
(function () {
  load({
    kind: "kv_game_v1", engine: "scene", meta: { id: "tags", title: "t", seed: "t1" },
    render: BASE_RENDER,
    nodes: [
      { id: "hero", type: "Actor", mesh: "box", tags: ["player"], transform: { pos: [0, 0, 0] } },
      { id: "boss", type: "Actor", mesh: "box", tags: ["enemy.undead.boss"], transform: { pos: [5, 0, 0] }, stats: { hp: 50, maxHp: 50 } },
      { id: "rat", type: "Actor", mesh: "box", tags: ["enemyx"], transform: { pos: [7, 0, 0] } }
    ],
    resources: { meshes: { box: { type: "box" } }, materials: {} }
  });
  ok("exact tag matches", call("tagMatch(nodes['boss'],'enemy.undead.boss')") === true);
  ok("parent prefix matches", call("tagMatch(nodes['boss'],'enemy')") === true);
  ok("mid prefix matches", call("tagMatch(nodes['boss'],'enemy.undead')") === true);
  ok("partial word does NOT match", call("tagMatch(nodes['rat'],'enemy')") === false);
  ok("unrelated filter fails", call("tagMatch(nodes['boss'],'npc')") === false);
  ok("empty filter passes", call("tagMatch(nodes['boss'],null)") === true);
  ok("flat tag still works", call("tagMatch(nodes['hero'],'player')") === true);
})();

// ---------------------------------------------------------------------------
// 3. ALARMS
// ---------------------------------------------------------------------------
section("alarms: one-shot vs repeat");
(function () {
  load({
    kind: "kv_game_v1", engine: "scene", meta: { id: "alarm", title: "a", seed: "a1" },
    render: BASE_RENDER,
    nodes: [
      { id: "hero", type: "Actor", mesh: "box", tags: ["player"], transform: { pos: [0, 0, 0] } },
      { id: "ticker", type: "MeshInstance", mesh: "box", transform: { pos: [0, 0, 3] },
        alarms: [{ after: 0.5, repeat: true, do: { action: "addScore", amount: 1 } }] },
      { id: "oneshot", type: "MeshInstance", mesh: "box", transform: { pos: [0, 0, 6] },
        alarms: [{ after: 0.5, do: { action: "addScore", amount: 100 } }] }
    ],
    resources: { meshes: { box: { type: "box" } }, materials: {} }
  });
  ok("2 alarms registered", G("ALARMS.length") === 2, G("ALARMS.length"));

  pump(120); // 2.0s -> repeat should fire 4x (+4), one-shot once (+100)
  const score = G("world.score");
  ok("repeat fired and one-shot fired once", score === 103, "score=" + score);

  pump(120); // another 2s -> +4 only
  ok("one-shot does not refire", G("world.score") === 107, "score=" + G("world.score"));
})();

// ---------------------------------------------------------------------------
// 4. PREFABS + VARIANTS
// ---------------------------------------------------------------------------
section("prefabs: instancing, overrides, variants");
(function () {
  load({
    kind: "kv_game_v1", engine: "scene", meta: { id: "pf", title: "p", seed: "pf1" },
    render: BASE_RENDER,
    prefabs: {
      goblin: { type: "Actor", mesh: "box", tags: ["enemy.goblin"], stats: { hp: 20, maxHp: 20, speed: 3 } },
      boss: { extends: "goblin", stats: { hp: 90, maxHp: 90, speed: 2 }, tags: ["enemy.goblin.boss"] }
    },
    nodes: [
      { id: "hero", type: "Actor", mesh: "box", tags: ["player"], transform: { pos: [0, 0, 0] } },
      { id: "g1", instance: "goblin", transform: { pos: [4, 0, 0] } },
      { id: "g2", instance: "goblin", transform: { pos: [6, 0, 0] }, overrides: { "stats.hp": 5 } },
      { id: "b1", instance: "boss", transform: { pos: [9, 0, 0] } }
    ],
    resources: { meshes: { box: { type: "box" } }, materials: {} }
  });
  ok("instance inherits type", call("nodes['g1'].type") === "Actor");
  ok("instance inherits stats", call("nodes['g1'].hp") === 20, call("nodes['g1'].hp"));
  ok("instance keeps its own transform", call("nodes['g1'].transform.pos[0]") === 4);
  ok("override applied", call("nodes['g2'].hp") === 5, call("nodes['g2'].hp"));
  ok("variant inherits base type", call("nodes['b1'].type") === "Actor");
  ok("variant own stats win", call("nodes['b1'].hp") === 90, call("nodes['b1'].hp"));
  ok("variant own tags win", call("tagMatch(nodes['b1'],'enemy.goblin.boss')") === true);
  ok("variant still matches base prefix", call("tagMatch(nodes['b1'],'enemy')") === true);
  ok("instance key consumed", call("nodes['g1'].instance") === undefined);
})();

// ---------------------------------------------------------------------------
// 5. AREA3D filter + amount (v6.5 behaviour change)
// ---------------------------------------------------------------------------
section("Area3D: filter honoured, amount forwarded");
(function () {
  load({
    kind: "kv_game_v1", engine: "scene", meta: { id: "area", title: "ar", seed: "ar1" },
    render: BASE_RENDER,
    nodes: [
      { id: "hero", type: "Actor", mesh: "box", tags: ["player"], transform: { pos: [0, 0, 0] } },
      { id: "gate", type: "Area3D", transform: { pos: [0, 0, 0] }, shape: { radius: 2 },
        signals: [{ signal: "body_entered", filter: "player", to: "self", action: "addScore", amount: 10 }] },
      { id: "nogate", type: "Area3D", transform: { pos: [0, 0, 0] }, shape: { radius: 2 },
        signals: [{ signal: "body_entered", filter: "enemy", to: "self", action: "addScore", amount: 1000 }] }
    ],
    resources: { meshes: { box: { type: "box" } }, materials: {} }
  });
  pump(5);
  const s = G("world.score");
  ok("player filter fires with correct amount", s === 10, "score=" + s + " (0 = amount dropped, 1010 = filter ignored)");
  ok("enemy-filtered area did not fire on player", s !== 1010 && s !== 1000);
})();

// ---------------------------------------------------------------------------
// 6. BEHAVIOR TREES
// ---------------------------------------------------------------------------
section("behavior tree: patrol -> see -> chase -> cooldown strike");
(function () {
  load({
    kind: "kv_game_v1", engine: "scene", meta: { id: "bt", title: "b", seed: "b1" },
    render: BASE_RENDER,
    nodes: [
      { id: "player", type: "Actor", mesh: "box", tags: ["player"],
        transform: { pos: [40, 0, 0] }, stats: { hp: 100, maxHp: 100 } },
      { id: "route", type: "Path3D", closed: false, points: [[0, 0, 0], [6, 0, 0], [12, 0, 0]] },
      { id: "guard", type: "Actor", mesh: "box", tags: ["enemy.guard"],
        transform: { pos: [0, 0, 0], rot: [0, 90, 0] },
        stats: { hp: 30, maxHp: 30 },
        vision: { range: 14, fovDeg: 160 },
        bt: {
          selector: [
            { sequence: [
                { cond: "canSee(self, player)" },
                { task: { type: "seek", target: "player", speed: 8 },
                  until: "distance(self, player) < 2" },
                { cooldown: 1.0, child: { do: { action: "damage", to: "player", amount: 5 } } }
              ] },
            { sequence: [
                { invert: { cond: "canSee(self, player)" } },
                { task: { type: "patrol", path: "route", speed: 2 } }
              ] }
          ]
        } }
    ],
    resources: { meshes: { box: { type: "box" } }, materials: {} }
  });

  ok("bt node registered as actor", call("actors.filter(function(a){return a.id==='guard';}).length") === 1);

  // Player is far away -> guard patrols.
  pump(60);
  const patrolX = call("nodes['guard'].transform.pos[0]");
  ok("guard patrols when player unseen", patrolX > 0.5, "x=" + patrolX.toFixed(2));

  // Bring the player into view.
  call("nodes['player'].transform.pos[0] = 10; nodes['player'].transform.pos[2] = 0;");
  pump(120);
  const d = call("FN.distance(nodes['guard'], nodes['player'])");
  ok("guard closed on player", d < 2.5, "dist=" + d.toFixed(2));

  const hp1 = call("nodes['player'].hp");
  ok("cooldown-gated strike landed", hp1 < 100, "hp=" + hp1);

  // 2 more seconds -> cooldown 1.0s allows a bounded number of extra hits.
  pump(120);
  const hp2 = call("nodes['player'].hp");
  const hits = (100 - hp2) / 5;
  ok("cooldown limits strike rate", hits <= 6, "hits=" + hits);
  ok("strikes continued while in range", hp2 < hp1, "hp " + hp1 + " -> " + hp2);
})();

section("behavior tree: sequence resumes, invert, wait");
(function () {
  load({
    kind: "kv_game_v1", engine: "scene", meta: { id: "bt2", title: "b2", seed: "b2" },
    render: BASE_RENDER,
    nodes: [
      { id: "player", type: "Actor", mesh: "box", tags: ["player"], transform: { pos: [0, 0, 0] } },
      { id: "waiter", type: "Actor", mesh: "box", tags: ["npc"], transform: { pos: [3, 0, 0] },
        bt: { sequence: [
          { wait: 0.5 },
          { do: { action: "addScore", amount: 7 } },
          { invert: { cond: "distance(self, player) > 100" } },
          { do: { action: "addScore", amount: 3 } }
        ] } }
    ],
    resources: { meshes: { box: { type: "box" } }, materials: {} }
  });

  pump(15); // 0.25s -> still inside wait
  ok("wait blocks the sequence", G("world.score") === 0, "score=" + G("world.score"));

  pump(30); // past 0.5s -> whole sequence runs once
  const s1 = G("world.score");
  ok("sequence completed after wait (invert passed)", s1 === 10, "score=" + s1);
})();

// ---------------------------------------------------------------------------
// 7. REGRESSION: prior layers still alive
// ---------------------------------------------------------------------------
section("regression: state machines, gait, tween");
(function () {
  load({
    kind: "kv_game_v1", engine: "scene", meta: { id: "reg", title: "r", seed: "r1" },
    render: BASE_RENDER,
    nodes: [
      { id: "player", type: "Actor", mesh: "box", tags: ["player"], transform: { pos: [0, 0, 0] }, stats: { hp: 100, maxHp: 100 } },
      { id: "route", type: "Path3D", closed: false, points: [[0, 0, 5], [8, 0, 5]] },
      { id: "beast", type: "Actor", mesh: "box", tags: ["enemy"], transform: { pos: [0, 0, 5] },
        stats: { hp: 40, maxHp: 40 },
        stateMachine: {
          initial: "patrol",
          states: {
            patrol: { behavior: { type: "patrol", path: "route", speed: 2 },
                      transitions: [{ when: "distance(self, player) < 6", to: "chase" }] },
            chase: { behavior: { type: "seek", target: "player", speed: 5 },
                     transitions: [{ when: "distance(self, player) > 9", to: "patrol" }] }
          }
        } },
      { id: "door", type: "MeshInstance", mesh: "box", transform: { pos: [0, 0, -5] } },
      { id: "door_anim", type: "AnimationPlayer", target: "door",
        clips: { open: { tracks: [{ path: "transform.pos.1", ease: "outCubic", keys: [[0, 0], [0.5, 3]] }] } },
        autoplay: "open" }
    ],
    resources: { meshes: { box: { type: "box" } }, materials: {} }
  });

  ok("state machine starts in initial state", call("nodes['beast']._state") === "patrol");
  pump(60);
  call("nodes['player'].transform.pos[0] = 2; nodes['player'].transform.pos[2] = 5;");
  pump(60);
  ok("state machine transitioned to chase", call("nodes['beast']._state") === "chase", call("nodes['beast']._state"));

  pump(60); // AnimationPlayer clip is 0.5s; well past it by now
  const doorY = call("nodes['door'].transform.pos[1]");
  ok("AnimationPlayer drove the target property", near(doorY, 3, 0.01), "y=" + doorY);

  call("startTween(nodes['door'], 'transform.pos.0', 5, 0.25, 'linear');");
  pump(30);
  const doorX = call("nodes['door'].transform.pos[0]");
  ok("tween reached its target", near(doorX, 5, 0.01), "x=" + doorX);

  ok("gait bob does not accumulate on idle actors",
     Math.abs(call("nodes['door'].transform.pos[1]") - 3) < 0.01);
})();

// ---------------------------------------------------------------------------
console.log("\n" + (fail === 0 ? "ALL GREEN" : "FAILURES") + "  pass=" + pass + " fail=" + fail);
process.exit(fail === 0 ? 0 : 1);
