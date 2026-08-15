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
  // Calls the engine's own stepSystems so the harness can never drift from the
  // real loop. Falls back to the legacy inline list on older engine builds.
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
// 8. RIG v8a: bone hierarchy, three axes, pose clips, animation events
// ---------------------------------------------------------------------------
section("rig: bone hierarchy and three-axis rotation");
(function () {
  load({
    kind: "kv_game_v1", engine: "scene", meta: { id: "rig", title: "rig", seed: "r8" },
    render: BASE_RENDER,
    nodes: [
      { id: "hero", type: "Actor", mesh: "body", tags: ["player"], transform: { pos: [0, 0, 0] } }
    ],
    resources: { meshes: { body: { type: "silhouette", generator: "humanoid" } }, materials: {} }
  });

  const g = call("nodes['hero']._geo");
  ok("humanoid mesh is rigged", call("nodes['hero']._geo.rigged") === true);
  ok("parts exist", call("Object.keys(nodes['hero']._geo.parts).length") >= 6,
     call("Object.keys(nodes['hero']._geo.parts).join(',')"));
  ok("armL parents to torso", call("nodes['hero']._geo.parts['armL'].parent") === "torso");
  ok("head parents to torso", call("nodes['hero']._geo.parts['head'].parent") === "torso");
  ok("legL has no parent (leaf at root)", call("nodes['hero']._geo.parts['legL'].parent") === undefined);

  // A vertex on the head, deformed with ONLY torso rotated: chain must carry it.
  const chained = call(
    "(function(){var g=nodes['hero']._geo;var hp=g.parts['head'].pivot;" +
    "var p=v3(hp.x, hp.y+0.2, hp.z);" +
    "var out=deformVert(p,g,'head',{torso:{rx:90}});" +
    "return [out.x.toFixed(3),out.y.toFixed(3),out.z.toFixed(3)].join(',');})()");
  const unchained = call(
    "(function(){var g=nodes['hero']._geo;var hp=g.parts['head'].pivot;" +
    "var p=v3(hp.x, hp.y+0.2, hp.z);" +
    "var out=deformVert(p,g,'legL',{torso:{rx:90}});" +
    "return [out.x.toFixed(3),out.y.toFixed(3),out.z.toFixed(3)].join(',');})()");
  ok("torso rotation carries a head vertex", chained !== unchained,
     "head=" + chained + " legL=" + unchained);

  // Z rotation must move X, proving the axis is not the old X-only path.
  const zrot = call(
    "(function(){var g=nodes['hero']._geo;var pv=g.parts['armR'].pivot;" +
    "var p=v3(pv.x, pv.y-0.5, pv.z);" +
    "var out=rotAboutAxes(p,pv,{rx:0,ry:0,rz:90});" +
    "return Math.abs(out.x-p.x)>0.1;})()");
  ok("rz rotation displaces X", zrot === true);

  const yrot = call(
    "(function(){var g=nodes['hero']._geo;var pv=g.parts['armR'].pivot;" +
    "var p=v3(pv.x+0.5, pv.y, pv.z);" +
    "var out=rotAboutAxes(p,pv,{rx:0,ry:90,rz:0});" +
    "return Math.abs(out.z-p.z)>0.1;})()");
  ok("ry rotation displaces Z", yrot === true);

  const scalar = call(
    "(function(){var pv=v3(0,1,0);var p=v3(0,0.5,0);" +
    "var a=rotAboutAxes(p,pv,poseAngles(45));var b=rotAboutX(p,pv,45);" +
    "return Math.abs(a.y-b.y)<0.001 && Math.abs(a.z-b.z)<0.001;})()");
  ok("scalar pose value still means X-only (backwards compatible)", scalar === true);
})();

section("rig: pose clips, blending, events");
(function () {
  load({
    kind: "kv_game_v1", engine: "scene", meta: { id: "rig2", title: "rig2", seed: "r9" },
    render: BASE_RENDER,
    nodes: [
      { id: "hero", type: "Actor", mesh: "body", tags: ["player"], transform: { pos: [0, 0, 0] },
        stats: { hp: 100, maxHp: 100 } },
      { id: "dummy", type: "Actor", mesh: "body", tags: ["enemy"], transform: { pos: [2, 0, 0] },
        stats: { hp: 50, maxHp: 50 } }
    ],
    resources: {
      meshes: { body: { type: "silhouette", generator: "humanoid" } }, materials: {},
      poses: {
        swing: { dur: 0.6, tracks: { armR: [[0, { rz: 0 }], [0.3, { rz: -120 }], [0.6, { rz: 20 }]] },
                 events: [{ at: 0.3, do: { action: "damage", to: "dummy", amount: 7 } }] },
        spin: { dur: 0.4, loop: true, tracks: { torso: [[0, { ry: 0 }], [0.4, { ry: 360 }]] },
                events: [{ at: 0.2, do: { action: "addScore", amount: 1 } }] }
      }
    }
  });

  ok("no pose active initially", call("nodes['hero']._pose") == null);

  call("playPose(nodes['hero'],'swing')");
  ok("playPose sets clip state", call("nodes['hero']._pose.id") === "swing");

  pump(9); // 0.15s -> midway to the -120 key
  const mid = call("(function(){var p=blendedPose(nodes['hero']);return p&&p.armR?poseAngles(p.armR).rz:null;})()");
  ok("clip interpolates between keys", mid != null && mid < -20 && mid > -120, "rz=" + mid);
  ok("event has not fired yet", call("nodes['dummy'].hp") === 50, call("nodes['dummy'].hp"));

  pump(12); // ~0.35s -> past the 0.3 event
  ok("event fired at its time", call("nodes['dummy'].hp") === 43, call("nodes['dummy'].hp"));

  pump(30); // past dur 0.6
  ok("non-looping clip clears itself", call("nodes['hero']._pose") == null);
  ok("event fired exactly once", call("nodes['dummy'].hp") === 43, call("nodes['dummy'].hp"));

  // looping clip: events refire each cycle
  call("world.score = 0; playPose(nodes['hero'],'spin');");
  pump(60); // 1.0s over a 0.4s loop -> 2 full cycles plus part of a third
  const spins = G("world.score");
  ok("looping clip refires events per cycle", spins >= 2 && spins <= 3, "fires=" + spins);
  ok("looping clip stays active", call("nodes['hero']._pose") != null);

  call("nodes['hero']._pose = null;");
})();

section("rig: clip blends over gait, unclipped bones keep walking");
(function () {
  // Give the actor gait motion, then play a clip that only touches armR.
  call("nodes['hero']._gaitAmt = 1; nodes['hero']._gaitPhase = 1.2;");
  const baseGait = call("(function(){var p=gaitPose(nodes['hero']);return p?p.legL:null;})()");
  ok("gait pose produces leg swing", baseGait != null && Math.abs(baseGait) > 0.1, "legL=" + baseGait);

  call("playPose(nodes['hero'],'swing');");
  pump(6);
  const blended = call("blendedPose(nodes['hero'])");
  const legNow = call("(function(){var p=blendedPose(nodes['hero']);return p?poseAngles(p.legL).rx:null;})()");
  const armNow = call("(function(){var p=blendedPose(nodes['hero']);return p&&p.armR?poseAngles(p.armR).rz:null;})()");
  ok("unclipped bone keeps its gait value", legNow != null && Math.abs(legNow) > 0.1, "legL=" + legNow);
  ok("clipped bone follows the clip", armNow != null && armNow < 0, "armR rz=" + armNow);
  call("nodes['hero']._pose = null; nodes['hero']._gaitAmt = 0;");
})();

// ---------------------------------------------------------------------------
// 9. ANIM v8b: blend trees, additive layers, root motion
// ---------------------------------------------------------------------------
section("anim: blend tree by speed");
(function () {
  load({
    kind: "kv_game_v1", engine: "scene", meta: { id: "tree", title: "t", seed: "t8b" },
    render: BASE_RENDER,
    nodes: [
      { id: "hero", type: "Actor", mesh: "body", tags: ["player"], transform: { pos: [0, 0, 0] } },
      { id: "route", type: "Path3D", closed: false, points: [[0, 0, 0], [30, 0, 0]] },
      { id: "runner", type: "Actor", mesh: "body", tags: ["npc"], transform: { pos: [0, 0, 4] },
        animTree: { param: "speed", clips: [["idle", 0], ["walk", 2], ["run", 6]] },
        stateMachine: { initial: "go", states: {
          go: { behavior: { type: "patrol", path: "route", speed: 4 } } } } }
    ],
    resources: {
      meshes: { body: { type: "silhouette", generator: "humanoid" } }, materials: {},
      poses: {
        idle: { dur: 1, loop: true, tracks: { legL: [[0, { rx: 0 }], [1, { rx: 0 }]] } },
        walk: { dur: 1, loop: true, tracks: { legL: [[0, { rx: -20 }], [0.5, { rx: 20 }], [1, { rx: -20 }]] } },
        run:  { dur: 0.6, loop: true, tracks: { legL: [[0, { rx: -60 }], [0.3, { rx: 60 }], [0.6, { rx: -60 }]] } }
      }
    }
  });

  pump(30);
  const spd = call("nodes['runner']._moveSpeed");
  ok("measured ground speed tracks the behaviour", spd > 3 && spd < 5, "speed=" + spd);

  const tp = call("nodes['runner']._treePose");
  ok("blend tree produced a pose", tp != null && tp.legL != null);

  const amp = call(
    "(function(){var mx=0;for(var i=0;i<60;i++){updatePoseClips(1/60);" +
    "var p=nodes['runner']._treePose;if(p&&p.legL)mx=Math.max(mx,Math.abs(p.legL.rx));}return mx;})()");
  ok("blended amplitude sits between walk and run", amp > 20 && amp < 60, "maxRx=" + amp);

  const phaseAdvances = call(
    "(function(){var a=nodes['runner']._treePhase;updatePoseClips(1/60);" +
    "return nodes['runner']._treePhase !== a;})()");
  ok("shared tree phase advances", phaseAdvances === true);

  // stationary actor blends to idle
  call("nodes['runner']._moveSpeed = 0;");
  const idleAmp = call(
    "(function(){var mx=0;for(var i=0;i<60;i++){updatePoseClips(1/60);" +
    "var p=nodes['runner']._treePose;if(p&&p.legL)mx=Math.max(mx,Math.abs(p.legL.rx));}return mx;})()");
  ok("zero speed blends to idle (no swing)", idleAmp < 1, "maxRx=" + idleAmp);
})();

section("anim: additive layer stacks on the base");
(function () {
  load({
    kind: "kv_game_v1", engine: "scene", meta: { id: "add", title: "a", seed: "a8b" },
    render: BASE_RENDER,
    nodes: [
      { id: "hero", type: "Actor", mesh: "body", tags: ["player"], transform: { pos: [0, 0, 0] } }
    ],
    resources: {
      meshes: { body: { type: "silhouette", generator: "humanoid" } }, materials: {},
      poses: {
        swing: { dur: 1, tracks: { armR: [[0, { rz: -40 }], [1, { rz: -40 }]] } },
        lean:  { dur: 1, additive: true, tracks: { armR: [[0, { rz: -10 }], [1, { rz: -10 }]] } }
      }
    }
  });

  call("playPose(nodes['hero'],'swing');");
  pump(6);
  const baseOnly = call("(function(){var p=blendedPose(nodes['hero']);return poseAngles(p.armR).rz;})()");
  ok("base clip applies", near(baseOnly, -40, 1), "rz=" + baseOnly);

  call("playPoseAdditive(nodes['hero'],'lean');");
  pump(6);
  const stacked = call("(function(){var p=blendedPose(nodes['hero']);return poseAngles(p.armR).rz;})()");
  ok("additive adds to the base rather than replacing", near(stacked, -50, 1.5), "rz=" + stacked);

  const other = call("(function(){var p=blendedPose(nodes['hero']);return p.legL?poseAngles(p.legL).rz:0;})()");
  ok("additive leaves untouched bones alone", Math.abs(other) < 0.001, "legL rz=" + other);

  pump(90); // past dur -> additive expires
  ok("non-looping additive clears", call("nodes['hero']._addPose") == null);
})();

section("anim: root motion drives position");
(function () {
  load({
    kind: "kv_game_v1", engine: "scene", meta: { id: "root", title: "r", seed: "r8b" },
    render: BASE_RENDER,
    nodes: [
      { id: "hero", type: "Actor", mesh: "body", tags: ["player"],
        transform: { pos: [0, 0, 0], rot: [0, 0, 0] } }
    ],
    resources: {
      meshes: { body: { type: "silhouette", generator: "humanoid" } }, materials: {},
      poses: {
        lunge: { dur: 0.5, tracks: { root: [[0, { z: 0 }], [0.5, { z: 3 }]] } }
      }
    }
  });

  const z0 = call("nodes['hero'].transform.pos[2]");
  call("playPose(nodes['hero'],'lunge');");
  pump(35); // past dur
  const z1 = call("nodes['hero'].transform.pos[2]");
  ok("root track moved the actor forward", near(z1 - z0, 3, 0.2), "dz=" + (z1 - z0).toFixed(3));

  // facing rotates the motion into world space
  call("nodes['hero'].transform.pos=[0,0,0];nodes['hero'].transform.rot=[0,90,0];playPose(nodes['hero'],'lunge');");
  pump(35);
  const px = call("nodes['hero'].transform.pos[0]");
  const pz = call("nodes['hero'].transform.pos[2]");
  ok("root motion respects actor yaw", near(px, 3, 0.3) && Math.abs(pz) < 0.3,
     "x=" + px.toFixed(2) + " z=" + pz.toFixed(2));
})();

// ---------------------------------------------------------------------------
// 10. RAGDOLL v9
// ---------------------------------------------------------------------------
section("ragdoll: triggers on death, bones fall and stay linked");
(function () {
  load({
    kind: "kv_game_v1", engine: "scene", meta: { id: "rag", title: "rag", seed: "r9" },
    render: BASE_RENDER,
    nodes: [
      { id: "hero", type: "Actor", mesh: "body", tags: ["player"], transform: { pos: [0, 0, 0] } },
      { id: "route", type: "Path3D", closed: false, points: [[6, 0, 0], [12, 0, 0]] },
      { id: "victim", type: "Actor", mesh: "body", tags: ["enemy"],
        transform: { pos: [6, 4, 0], rot: [0, 0, 0] },
        stats: { hp: 10, maxHp: 10 },
        ragdoll: { enabled: true, mass: 1 },
        stateMachine: { initial: "walk", states: {
          walk: { behavior: { type: "patrol", path: "route", speed: 2 } } } } }
    ],
    resources: { meshes: { body: { type: "silhouette", generator: "humanoid" } }, materials: {} }
  });

  pump(10);
  ok("alive actor is not ragdolled", call("nodes['victim']._rag") == null);
  const movedAlive = call("nodes['victim'].transform.pos[0]") > 6;
  ok("alive actor still follows its behaviour", movedAlive === true);

  const bodiesBefore = G("BODIES.length");
  call("nodes['victim'].hp = 0;");
  pump(2);
  ok("death starts a ragdoll", call("nodes['victim']._rag") != null);
  ok("one body per bone spawned", G("BODIES.length") - bodiesBefore === 6,
     "delta=" + (G("BODIES.length") - bodiesBefore));
  ok("actor is not marked dead (corpse stays visible)", call("nodes['victim']._dead") !== true);

  const yStart = call("nodes['victim']._rag.bones['torso'].body.node.transform.pos[1]");
  pump(120);
  const yEnd = call("nodes['victim']._rag.bones['torso'].body.node.transform.pos[1]");
  ok("ragdoll falls under gravity", yEnd < yStart, "y " + yStart.toFixed(2) + " -> " + yEnd.toFixed(2));
  ok("ragdoll comes to rest on the ground", yEnd > 0, "y=" + yEnd.toFixed(2));

  // links hold: every bone stays near its rest distance from its parent
  const maxStretch = call(
    "(function(){var rag=nodes['victim']._rag,worst=0;" +
    "for(var i=0;i<rag.links.length;i++){var L=rag.links[i];" +
    "var a=L.a.node.transform.pos,b=L.b.node.transform.pos;" +
    "var dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2];" +
    "var d=Math.sqrt(dx*dx+dy*dy+dz*dz);" +
    "worst=Math.max(worst,Math.abs(d-L.rest));}return worst;})()");
  ok("bone links hold near rest length", maxStretch < 0.35, "worst stretch=" + maxStretch.toFixed(3));

  const pose = call("blendedPose(nodes['victim'])");
  ok("ragdoll pose overrides animation", pose != null && Object.keys(pose).length > 0,
     pose ? Object.keys(pose).join(",") : "null");

  const posMoved = call("nodes['victim'].transform.pos[1]") < 4;
  ok("mesh node follows the torso bone", posMoved === true,
     "y=" + call("nodes['victim'].transform.pos[1]"));
})();

section("ragdoll: manual trigger with impulse, actor stops acting");
(function () {
  load({
    kind: "kv_game_v1", engine: "scene", meta: { id: "rag2", title: "rag2", seed: "r10" },
    render: BASE_RENDER,
    nodes: [
      { id: "hero", type: "Actor", mesh: "body", tags: ["player"], transform: { pos: [0, 0, 0] } },
      { id: "route", type: "Path3D", closed: false, points: [[3, 0, 0], [20, 0, 0]] },
      { id: "mook", type: "Actor", mesh: "body", tags: ["enemy"],
        transform: { pos: [3, 0, 0] }, stats: { hp: 20, maxHp: 20 },
        ragdoll: { enabled: true },
        stateMachine: { initial: "walk", states: {
          walk: { behavior: { type: "patrol", path: "route", speed: 3 } } } } }
    ],
    resources: { meshes: { body: { type: "silhouette", generator: "humanoid" } }, materials: {} }
  });

  pump(20);
  const xBefore = call("nodes['mook'].transform.pos[0]");
  ok("mook was walking", xBefore > 3);

  call("runAction(nodes['mook'], { action:'ragdoll', target:'mook', args:[0, 6, 4] });");
  ok("manual ragdoll action fires", call("nodes['mook']._rag") != null);
  ok("actor stops acting once ragdolled", call("nodes['mook']._ragStop") === true);

  const zBefore = call("nodes['mook']._rag.bones['torso'].body.node.transform.pos[2]");
  pump(20);
  const zAfter = call("nodes['mook']._rag.bones['torso'].body.node.transform.pos[2]");
  ok("death impulse carried the corpse", zAfter > zBefore, "z " + zBefore.toFixed(2) + " -> " + zAfter.toFixed(2));

  pump(180);
  const asleep = call(
    "(function(){var rag=nodes['mook']._rag,n=0,t=0;for(var k in rag.bones){t++;if(rag.bones[k].body.asleep)n++;}" +
    "return n+'/'+t;})()");
  ok("corpse settles and sleeps", asleep.split("/")[0] === asleep.split("/")[1], "asleep=" + asleep);
})();

// ---------------------------------------------------------------------------
console.log("\n" + (fail === 0 ? "ALL GREEN" : "FAILURES") + "  pass=" + pass + " fail=" + fail);
process.exit(fail === 0 ? 0 : 1);
