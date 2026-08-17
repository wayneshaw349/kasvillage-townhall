// smoke_showcases.cjs — boots every showcase_*.html headlessly and asserts:
//   1. the engine script does not throw on load
//   2. no throw across N simulated frames
//   3. the frame is NOT BLACK — measured by counting real draw operations
//      issued to the canvas context during render
//
// This is the test that would have caught today's black screen in one second
// instead of a full bisecting session.
//
//   node .\smoke_showcases.cjs
//
// Exit 0 = all green, 1 = any failure.
"use strict";
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const FRAMES = 30;
const MIN_DRAWS = 25;   // a rendered scene issues far more; black issues ~0-2

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (detail != null ? "  -> " + detail : "")); }
}

// ---------------------------------------------------------------------------
// counting canvas stub: every paint-ish call increments draws
// ---------------------------------------------------------------------------
function makeCtx(counter) {
  const paint = ["fill", "stroke", "fillRect", "strokeRect", "drawImage",
                 "fillText", "strokeText", "putImageData"];
  const c = {
    canvas: { width: 640, height: 360 },
    fillStyle: "", strokeStyle: "", lineWidth: 1, font: "", globalAlpha: 1,
    globalCompositeOperation: "source-over",
    textAlign: "", textBaseline: "", imageSmoothingEnabled: false,
    shadowBlur: 0, shadowColor: "", lineJoin: "", lineCap: "", miterLimit: 10
  };
  const noop = function () { return c; };
  ["save", "restore", "beginPath", "closePath", "moveTo", "lineTo", "arc",
   "arcTo", "translate", "rotate", "scale", "setTransform", "transform",
   "resetTransform", "clip", "rect", "quadraticCurveTo", "bezierCurveTo",
   "ellipse", "clearRect", "setLineDash", "getLineDash"].forEach(function (k) {
    c[k] = noop;
  });
  paint.forEach(function (k) {
    c[k] = function () { counter.draws++; return c; };
  });
  c.createLinearGradient = function () { return { addColorStop: noop }; };
  c.createRadialGradient = function () { return { addColorStop: noop }; };
  c.createPattern = function () { return {}; };
  c.measureText = function () { return { width: 10 }; };
  c.getImageData = function () { return { data: new Uint8ClampedArray(4), width: 1, height: 1 }; };
  c.createImageData = function () { return { data: new Uint8ClampedArray(4), width: 1, height: 1 }; };
  return c;
}

function makeEl(id, counter) {
  const el = {
    id: id, style: {}, textContent: "", innerHTML: "", className: "", value: "",
    width: 640, height: 360, clientWidth: 640, clientHeight: 360,
    offsetWidth: 640, offsetHeight: 360, children: [], dataset: {},
    getContext: function () { return makeCtx(counter); },
    addEventListener: function () {}, removeEventListener: function () {},
    appendChild: function (c) { this.children.push(c); return c; },
    insertBefore: function (c) { this.children.push(c); return c; },
    removeChild: function () {}, remove: function () {},
    setAttribute: function () {}, getAttribute: function () { return null; },
    removeAttribute: function () {}, hasAttribute: function () { return false; },
    getBoundingClientRect: function () {
      return { left: 0, top: 0, width: 640, height: 360, right: 640, bottom: 360, x: 0, y: 0 };
    },
    classList: { add: function () {}, remove: function () {}, toggle: function () {},
                 contains: function () { return false; } },
    querySelector: function () { return makeEl("q", counter); },
    querySelectorAll: function () { return []; },
    focus: function () {}, blur: function () {}, click: function () {},
    scrollIntoView: function () {}
  };
  return el;
}

function buildSandbox(counter) {
  const els = {};
  function get(id) { if (!els[id]) els[id] = makeEl(id, counter); return els[id]; }
  const doc = {
    getElementById: get,
    createElement: function (t) { return makeEl(t, counter); },
    createElementNS: function (ns, t) { return makeEl(t, counter); },
    createTextNode: function () { return makeEl("#text", counter); },
    querySelector: function () { return get("view"); },
    querySelectorAll: function () { return []; },
    addEventListener: function () {}, removeEventListener: function () {},
    body: get("body"), documentElement: get("html"), head: get("head"),
    fonts: { ready: { then: function () {} } },
    hidden: false, visibilityState: "visible"
  };
  const sb = {
    console: { log: function () {}, warn: function () {}, error: function () {} },
    document: doc,
    navigator: { userAgent: "node", maxTouchPoints: 0, vibrate: function () {},
                 language: "en", platform: "node" },
    location: { href: "file:///smoke", search: "", hash: "" },
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
    localStorage: { _d: {},
      getItem: function (k) { return this._d[k] == null ? null : this._d[k]; },
      setItem: function (k, v) { this._d[k] = String(v); },
      removeItem: function (k) { delete this._d[k]; }, clear: function () { this._d = {}; } },
    devicePixelRatio: 1,
    innerWidth: 640, innerHeight: 360,
    AudioContext: function () {
      const g = function () { return { connect: function () {}, start: function () {},
        stop: function () {}, disconnect: function () {},
        gain: { value: 0, setValueAtTime: function () {}, linearRampToValueAtTime: function () {},
                exponentialRampToValueAtTime: function () {} },
        frequency: { value: 0, setValueAtTime: function () {},
                     linearRampToValueAtTime: function () {},
                     exponentialRampToValueAtTime: function () {} },
        Q: { value: 1 }, type: "sine", buffer: null, playbackRate: { value: 1 } }; };
      return { createGain: g, createOscillator: g, createBiquadFilter: g,
               createBufferSource: g, createDynamicsCompressor: g, createDelay: g,
               createConvolver: g, createStereoPanner: g, createWaveShaper: g,
               createBuffer: function () { return { getChannelData: function () { return new Float32Array(8); } }; },
               decodeAudioData: function () {}, resume: function () {},
               destination: {}, currentTime: 0, sampleRate: 44100, state: "running" };
    },
    postedMessages: []
  };
  sb.webkitAudioContext = sb.AudioContext;
  // Browsers expose any element with an id as a global (named access on
  // window). The engine relies on this for `view`, so mirror it.
  ["view", "hud", "dlg", "shop", "battle", "menu", "con"].forEach(function (id) {
    sb[id] = get(id);
  });
  sb.window = sb; sb.self = sb; sb.globalThis = sb;
  sb.window.addEventListener = function () {};
  sb.window.removeEventListener = function () {};
  sb.ReactNativeWebView = { postMessage: function (m) { sb.postedMessages.push(m); } };
  return sb;
}

// ---------------------------------------------------------------------------
// run one showcase
// ---------------------------------------------------------------------------
function smoke(file) {
  const html = fs.readFileSync(file, "utf8");

  // take the LAST script block: the engine and the scene may be split, and the
  // scene/boot call lives at the end.
  const blocks = html.match(/<script>([\s\S]*?)<\/script>/g);
  if (!blocks || !blocks.length) return { err: "no <script> block" };
  const src = blocks.map(function (b) {
    return b.replace(/^<script>/, "").replace(/<\/script>$/, "");
  }).join("\n");

  const counter = { draws: 0 };
  const sb = buildSandbox(counter);
  const ctx = vm.createContext(sb);

  try {
    vm.runInContext(src, ctx, { filename: file, timeout: 15000 });
  } catch (e) {
    return { err: "load threw: " + e.message, stack: e.stack };
  }

  // scene must actually be loaded
  let hasScene = false;
  try { hasScene = !!vm.runInContext("typeof scene !== 'undefined' && scene && scene.nodes", ctx); }
  catch (e) { hasScene = false; }
  if (!hasScene) return { err: "no scene loaded after boot" };

  // drive frames through the engine's own loop functions
  counter.draws = 0;
  try {
    vm.runInContext(
      "(function(n,h){for(var i=0;i<n;i++){" +
      "world.time+=h;" +
      "if(typeof stepSystems==='function')stepSystems(h);" +
      "if(typeof renderFrame==='function')renderFrame();" +
      "else if(typeof drawScene==='function')drawScene();" +
      "}})(" + FRAMES + "," + (1 / 60) + ")", ctx, { timeout: 20000 });
  } catch (e) {
    return { err: "frame threw: " + e.message, stack: e.stack, draws: counter.draws };
  }

  return { draws: counter.draws };
}

// ---------------------------------------------------------------------------
// regenerate showcases first so we test current output, then smoke each
// ---------------------------------------------------------------------------
const makers = fs.readdirSync(".").filter(function (f) {
  return /^make_.*_showcase\.cjs$/.test(f);
});
if (makers.length) {
  console.log("regenerating " + makers.length + " showcase(s)...");
  const cp = require("child_process");
  makers.forEach(function (m) {
    try { cp.execSync("node " + JSON.stringify(m), { stdio: "pipe" }); }
    catch (e) { console.log("  (generator failed: " + m + ")"); }
  });
}

const files = fs.readdirSync(".").filter(function (f) {
  return /^showcase_.*\.html$/.test(f) && !/_dbg\.html$/.test(f);
});

if (!files.length) { console.log("ABORT: no showcase_*.html found"); process.exit(1); }

console.log("\n== showcase smoke: loads, runs " + FRAMES + " frames, draws something ==");
files.forEach(function (f) {
  const r = smoke(f);
  if (r.err) {
    ok(f + " renders", false, r.err + (r.stack ? "\n        " + r.stack.split("\n").slice(0, 4).join("\n        ") : ""));
  } else {
    ok(f + " renders", r.draws >= MIN_DRAWS,
       "only " + r.draws + " draw ops in " + FRAMES + " frames (black screen)");
  }
});

console.log("\n" + (fail === 0 ? "ALL GREEN" : "SMOKE FAILED") + "  pass=" + pass + " fail=" + fail);
process.exit(fail === 0 ? 0 : 1);
