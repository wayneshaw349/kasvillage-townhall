// fx_debug.cjs — loads the fx scene headlessly and reports what happens.
// Uses the same harness approach as scene_engine_test.cjs.
const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync("scene_engine.html", "utf8");
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.error("no script tag"); process.exit(1); }
const code = m[1];

function stubCanvas() {
  const noop = function () {};
  const ctx = new Proxy({}, {
    get(t, k) {
      if (k === "canvas") return { width: 320, height: 240 };
      if (k === "measureText") return function () { return { width: 10 }; };
      if (k === "createLinearGradient" || k === "createRadialGradient")
        return function () { return { addColorStop: noop }; };
      if (k === "getImageData") return function () { return { data: new Uint8ClampedArray(4) }; };
      if (k === "createImageData") return function () { return { data: new Uint8ClampedArray(4) }; };
      return typeof t[k] === "undefined" ? noop : t[k];
    },
    set() { return true; }
  });
  return {
    width: 320, height: 240, style: {},
    getContext: function () { return ctx; },
    addEventListener: noop, getBoundingClientRect: function () { return { left: 0, top: 0, width: 320, height: 240 }; }
  };
}

const els = {};
function mkEl(id) {
  if (els[id]) return els[id];
  const c = stubCanvas();
  c.id = id;
  c.appendChild = function () {};
  c.innerHTML = "";
  c.textContent = "";
  c.classList = { add: function () {}, remove: function () {} };
  els[id] = c;
  return c;
}

const sandbox = {
  console: console,
  document: {
    getElementById: mkEl,
    createElement: function () { return mkEl("tmp" + Math.random()); },
    body: { appendChild: function () {}, style: {} },
    addEventListener: function () {}
  },
  window: { addEventListener: function () {}, devicePixelRatio: 1,
            innerWidth: 320, innerHeight: 240 },
  requestAnimationFrame: function () { return 0; },
  performance: { now: function () { return Date.now(); } },
  setTimeout: setTimeout, clearTimeout: clearTimeout,
  setInterval: function () { return 0; }, clearInterval: function () {},
  Math: Math, Date: Date, JSON: JSON, Float32Array: Float32Array,
  Uint8ClampedArray: Uint8ClampedArray, Object: Object, Array: Array,
  String: String, Number: Number, Boolean: Boolean, Error: Error,
  isNaN: isNaN, parseFloat: parseFloat, parseInt: parseInt
};
sandbox.window.AudioContext = null;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

try {
  vm.runInContext(code, sandbox, { filename: "scene_engine.html" });
  console.log("engine loaded OK");
} catch (e) {
  console.error("LOAD ERROR: " + e.message);
  process.exit(1);
}

// Build the same scene the fx showcase uses (minimal version)
const scene = {
  kind: "kv_game_v1", engine: "scene",
  meta: { id: "fx", title: "fx lab", seed: "fx1" },
  render: { vertexSnap: 1, gouraud: true, shadows: true,
            cull: { distance: 70, fadeAt: 45 } },
  nodes: [
    { id: "cam", type: "Camera3D", mode: "fixed", fov: 50, transform: { pos: [0, 4.5, 14] } },
    { id: "hero", type: "Actor", mesh: "b", tags: ["player"], transform: { pos: [-2, 0, 3] },
      stats: { hp: 30, maxHp: 30, speed: 4 } },
    { id: "ground", type: "MeshInstance", mesh: "slab", material: "g", transform: { pos: [0, -0.12, 0] } },
    { id: "torch1", type: "MeshInstance", mesh: "tr", material: "g", transform: { pos: [-5, 0, -2] },
      emitter: { particle: "smoke", rate: 3, height: 1.5, scale: 0.3 } }
  ],
  resources: {
    meshes: { b: { type: "silhouette", generator: "humanoid" },
              slab: { type: "box", size: [40, 0.24, 40] }, tr: { type: "torch" } },
    materials: { g: { color: "#3a4438" } }
  }
};

try {
  sandbox.loadScene(JSON.stringify(scene));
  console.log("scene loaded OK, nodes=" + Object.keys(sandbox.nodes).length);
} catch (e) {
  console.error("SCENE ERROR: " + e.message + "\n" + (e.stack || "").split("\n").slice(0, 4).join("\n"));
  process.exit(1);
}

// step + render a few frames
for (let i = 0; i < 5; i++) {
  try {
    if (sandbox.stepSystems) sandbox.stepSystems(1 / 60);
  } catch (e) {
    console.error("STEP ERROR frame " + i + ": " + e.message + "\n" + (e.stack || "").split("\n").slice(0, 5).join("\n"));
    process.exit(1);
  }
  try {
    sandbox.renderFrame();
  } catch (e) {
    console.error("RENDER ERROR frame " + i + ": " + e.message + "\n" + (e.stack || "").split("\n").slice(0, 5).join("\n"));
    process.exit(1);
  }
}
console.log("5 frames stepped + rendered with no exception");
console.log("particles=" + (sandbox.PARTICLES ? sandbox.PARTICLES.length : "n/a") +
            " decals=" + (sandbox.DECALS ? sandbox.DECALS.length : "n/a"));
console.log("CAM.eye=" + JSON.stringify(sandbox.CAM ? sandbox.CAM.eye : null));
const drawn = [];
Object.keys(sandbox.nodes).forEach(function (id) {
  const n = sandbox.nodes[id];
  drawn.push(id + ":lod=" + (n._lod === undefined ? "unset" : n._lod) + " geo=" + (n._geo ? "yes" : "NO"));
});
console.log(drawn.join("\n"));
