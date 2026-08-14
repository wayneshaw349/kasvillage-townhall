// scene_engine_debug.cjs — traces the two failing systems frame by frame.
//   node .\scene_engine_debug.cjs
// Prints: (A) per-step y/vel/sleep/contact state for the bottom two boxes and
// the top box across the settle window, (B) the guard BT's position, distance,
// canSee, running-branch and strike log across the chase.
"use strict";
const fs = require("fs");
const vm = require("vm");

// ---- stubs (same as scene_engine_test.cjs) --------------------------------
function stubCtx() {
  const noop = function () {};
  return {
    canvas: { width: 640, height: 360 }, fillStyle: "", strokeStyle: "", lineWidth: 1,
    font: "", globalAlpha: 1, textAlign: "", textBaseline: "", imageSmoothingEnabled: false,
    save: noop, restore: noop, beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
    fill: noop, stroke: noop, fillRect: noop, strokeRect: noop, clearRect: noop, arc: noop,
    translate: noop, rotate: noop, scale: noop, setTransform: noop, drawImage: noop,
    fillText: noop, strokeText: noop,
    createLinearGradient: function () { return { addColorStop: noop }; },
    measureText: function () { return { width: 10 }; },
    getImageData: function () { return { data: new Uint8ClampedArray(4) }; },
    putImageData: noop, createImageData: function () { return { data: new Uint8ClampedArray(4) }; },
    clip: noop, rect: noop, quadraticCurveTo: noop, bezierCurveTo: noop, ellipse: noop
  };
}
function makeEl(id) {
  return {
    id: id, style: {}, textContent: "", innerHTML: "", className: "", width: 640, height: 360,
    clientWidth: 640, clientHeight: 360, children: [], dataset: {},
    getContext: function () { return stubCtx(); },
    addEventListener: function () {}, removeEventListener: function () {},
    appendChild: function (c) { this.children.push(c); return c; }, removeChild: function () {},
    insertBefore: function (c) { this.children.push(c); return c; },
    setAttribute: function () {}, getAttribute: function () { return null; },
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 640, height: 360 }; },
    querySelector: function () { return null; }, querySelectorAll: function () { return []; },
    focus: function () {}, blur: function () {}, remove: function () {}
  };
}
const els = {};
const documentStub = {
  getElementById: function (id) { return els[id] || (els[id] = makeEl(id)); },
  createElement: function () { return makeEl("dyn"); },
  addEventListener: function () {}, removeEventListener: function () {},
  body: makeEl("body"), documentElement: makeEl("html"),
  querySelector: function () { return null; }, querySelectorAll: function () { return []; }
};
const sandbox = {
  console: console, document: documentStub, JSON: JSON, Math: Math, Date: Date,
  parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN, isFinite: isFinite,
  String: String, Number: Number, Object: Object, Array: Array, Boolean: Boolean,
  Error: Error, Uint8Array: Uint8Array, Uint8ClampedArray: Uint8ClampedArray,
  Float32Array: Float32Array, Int32Array: Int32Array,
  performance: { now: function () { return Date.now(); } },
  requestAnimationFrame: function () { return 0; }, cancelAnimationFrame: function () {},
  setTimeout: function () { return 0; }, clearTimeout: function () {},
  setInterval: function () { return 0; }, clearInterval: function () {}
};
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
sandbox.addEventListener = function () {}; sandbox.removeEventListener = function () {};
sandbox.ReactNativeWebView = { postMessage: function () {} };

const html = fs.readFileSync("scene_engine.html", "utf8");
const engineSrc = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const ctx = vm.createContext(sandbox);
vm.runInContext(engineSrc, ctx, { filename: "scene_engine.html" });
const call = function (e) { return vm.runInContext(e, ctx); };
const load = function (scene) { call("loadScene(" + JSON.stringify(JSON.stringify(scene)) + ")"); };
function pump(frames, dt, per) {
  dt = dt || 1 / 60;
  for (let f = 0; f < frames; f++) {
    vm.runInContext(
      "world.time+=" + dt + ";" +
      "if(typeof updatePoseClips==='function')updatePoseClips(" + dt + ");" +
      "if(typeof updateAlarms==='function')updateAlarms(" + dt + ");" +
      "if(typeof updatePhysics==='function')updatePhysics(" + dt + ");" +
      "if(typeof updateAnims==='function')updateAnims(" + dt + ");" +
      "updateTransforms(scene.nodes, matIdent());" +
      "actors.forEach(function(a){if(!a._dead)updateActor(a," + dt + ");});" +
      "if(typeof updateAreas==='function')updateAreas();", ctx);
    if (per) per(f);
  }
}

// ===========================================================================
// A. PHYSICS TRACE
// ===========================================================================
console.log("=== A. PHYSICS: 8-box column, tracing crate0 (bottom), crate1, crate7 (top) ===");
(function () {
  const nodes = [{ id: "hero", type: "Actor", mesh: "box", tags: ["player"], transform: { pos: [50, 0, 50] } }];
  for (let i = 0; i < 8; i++) {
    nodes.push({
      id: "crate" + i, type: "MeshInstance", mesh: "box",
      transform: { pos: [0, 6 + i * 1.4, 0] },
      physics: { body: "dynamic", shape: "box", half: [0.5, 0.5, 0.5], mass: 1, restitution: 0.05, friction: 0.8 }
    });
  }
  load({
    kind: "kv_game_v1", engine: "scene", meta: { id: "phys", title: "p", seed: "p1" },
    render: { cameraMode: "overhead" }, nodes: nodes,
    resources: { meshes: { box: { type: "box" } }, materials: {} }
  });

  // helper injected into the engine scope for compact per-frame reads
  call(
    "function dbgRow(){var f=function(id){var b=nodes[id]._pb;var p=b.node.transform.pos;" +
    "return p[1].toFixed(3)+'/'+b.vel.y.toFixed(3)+(b.asleep?'*S':'')+'/sl'+b.sleep.toFixed(2);};" +
    "return f('crate0')+' | '+f('crate1')+' | '+f('crate7');}");
  call(
    "function dbgContacts(){var cs=physContacts();var g=0,bb=0;for(var i=0;i<cs.length;i++){" +
    "if(cs[i].a===PB_GROUND)g++;else bb++;}return 'ground='+g+' boxbox='+bb;}");

  console.log("frame |  crate0 y/vy/sleep  |  crate1  |  crate7  | contacts");
  let last = "";
  pump(600, 1 / 60, function (f) {
    if (f < 40 || (f % 30 === 0) || f > 560) {
      const row = call("dbgRow()") + "  " + call("dbgContacts()");
      if (row !== last || f % 60 === 0) {
        console.log(String(f).padStart(5) + " | " + row);
        last = row;
      }
    }
  });
  const ys = call("BODIES.map(function(b){return b.node.transform.pos[1].toFixed(3);}).join(',')");
  console.log("final ys: " + ys);
  console.log("asleep:  " + call("BODIES.map(function(b){return b.asleep?1:0;}).join(',')"));
})();

// ===========================================================================
// B. BT GUARD TRACE
// ===========================================================================
console.log("\n=== B. BT: guard chase, tracing pos/dist/canSee/branch ===");
(function () {
  load({
    kind: "kv_game_v1", engine: "scene", meta: { id: "bt", title: "b", seed: "b1" },
    render: { cameraMode: "overhead" },
    nodes: [
      { id: "player", type: "Actor", mesh: "box", tags: ["player"], transform: { pos: [40, 0, 0] }, stats: { hp: 100, maxHp: 100 } },
      { id: "route", type: "Path3D", closed: false, points: [[0, 0, 0], [6, 0, 0], [12, 0, 0]] },
      { id: "guard", type: "Actor", mesh: "box", tags: ["enemy.guard"],
        transform: { pos: [0, 0, 0], rot: [0, 90, 0] }, stats: { hp: 30, maxHp: 30 },
        vision: { range: 14, fovDeg: 160 },
        bt: {
          selector: [
            { sequence: [
                { cond: "canSee(self, player)" },
                { task: { type: "seek", target: "player", speed: 8 }, until: "distance(self, player) < 2" },
                { cooldown: 1.0, child: { do: { action: "damage", to: "player", amount: 5 } } } ] },
            { sequence: [
                { invert: { cond: "canSee(self, player)" } },
                { task: { type: "patrol", path: "route", speed: 2 } } ] }
          ] } }
    ],
    resources: { meshes: { box: { type: "box" } }, materials: {} }
  });

  call(
    "function dbgBT(){var g=nodes['guard'],p=nodes['player'];" +
    "var d=FN.distance(g,p);var cs=canSee(g,p);" +
    "var st=g._bt&&g._bt['root']?g._bt['root'].running:'-';" +
    "var seq=g._bt&&g._bt['root.s0']?g._bt['root.s0'].running:'-';" +
    "return 'gx='+g.transform.pos[0].toFixed(2)+' gz='+g.transform.pos[2].toFixed(2)+" +
    "' d='+d.toFixed(2)+' see='+(cs?1:0)+' rootRun='+st+' seqRun='+seq+" +
    "' rot='+g.transform.rot[1].toFixed(0)+' hp='+p.hp+' status='+g._btStatus;}");

  // ---- instrumentation: late-binding wrappers log the one-tick anomalies ----
  call(
    "var DBGF=-1;" +
    "var _cs=canSee; canSee=function(a,b){var r=_cs(a,b);" +
    "if(DBGF>=0&&a&&a.id==='guard'&&!r){console.log('    [canSee FALSE] f='+DBGF+' d='+FN.distance(a,b).toFixed(2)+' rot='+a.transform.rot[1].toFixed(1));}return r;};" +
    "var _rb=runBehavior; runBehavior=function(n,b,dt){" +
    "if(DBGF>=0&&n.id==='guard'&&b.type==='patrol'){console.log('    [PATROL] f='+DBGF+' _u='+((n._u||0)).toFixed(2)+' gx='+n.transform.pos[0].toFixed(2));}return _rb(n,b,dt);};" +
    "var _bt=btTick; btTick=function(n,node,dt,key){var r=_bt(n,node,dt,key);" +
    "if(DBGF>=0&&n.id==='guard'){" +
    "if(node&&node.cooldown!=null)console.log('    [COOLDOWN] f='+DBGF+' r='+r+' readyAt='+((n._bt[key]&&n._bt[key].readyAt)||0).toFixed(2)+' t='+world.time.toFixed(2));" +
    "if(node&&node.invert)console.log('    [INVERT] f='+DBGF+' r='+r);}" +
    "return r;};");

  console.log("-- phase 1: player far (40,0), 60 frames patrol --");
  pump(60, 1 / 60, function (f) { if (f % 20 === 0) console.log(String(f).padStart(4) + " " + call("dbgBT()")); });

  console.log("-- phase 2: player moved to (10,0), 120 frames chase --");
  call("nodes['player'].transform.pos[0]=10;nodes['player'].transform.pos[2]=0;");
  pump(120, 1 / 60, function (f) {
    call("DBGF=" + f);
    if (f < 12 || f % 10 === 0) console.log(String(f).padStart(4) + " " + call("dbgBT()"));
  });

  console.log("-- phase 3: 120 more frames (cooldown strikes) --");
  pump(120, 1 / 60, function (f) {
    call("DBGF=" + (200 + f));
    if (f % 20 === 0) console.log(String(f).padStart(4) + " " + call("dbgBT()"));
  });
})();
