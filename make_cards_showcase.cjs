// make_cards_showcase.cjs — writes showcase_cards.html
// Green table, DEAL (5-card hand, seeded deck), HIT (draw one), ROLL 2 DICE (tumble + settle).
const fs = require("fs");
const engine = fs.readFileSync("scene_engine.html", "utf8");
const q = String.fromCharCode(39);
const scene = {
  kind: "kv_game_v1", engine: "scene",
  meta: { id: "cards", title: "card table", seed: "ct1" },
  render: { vertexSnap: 1, gouraud: true, post: { enabled: true, scanAlpha: 0.06 } },
  nodes: [
    { id: "cam", type: "Camera3D", mode: "fixed", fov: 50, transform: { pos: [0, 7, 7] } },
    { id: "hero", type: "Actor", mesh: "body", tags: ["player"], transform: { pos: [0, 0, 2.5] } },
    { id: "table", type: "MeshInstance", mesh: "tableTop", material: "felt", transform: { pos: [0, -0.1, -1] } }
  ],
  resources: {
    meshes: {
      body: { type: "silhouette", generator: "humanoid" },
      tableTop: { type: "box", size: [10, 0.2, 7] }
    },
    materials: { felt: { color: "#1d5c3a" } }
  }
};
const inject = [
  "",
  "// ---- injected card table ----",
  "try {",
  "  loadScene(" + JSON.stringify(JSON.stringify(scene)) + ");",
  "  var deck = newDeck(" + q + "table-1" + q + ");",
  "  var hand = [];",
  "  FRAME_HOOKS.push(function () {",
  "    var cw = Math.min(70, (W - 40) / Math.max(5, hand.length) - 8);",
  "    var total = hand.length * (cw + 8) - 8;",
  "    for (var i = 0; i < hand.length; i++)",
  "      drawCard(W / 2 - total / 2 + i * (cw + 8), H - cw * 1.45 - 12, cw, hand[i], true);",
  "    if (deck.length) drawCard(16, H - 60 * 1.45 - 12, 60, null, false);",
  "  });",
  "  var __bar = document.createElement(" + q + "div" + q + ");",
  "  __bar.style.cssText = " + q + "position:fixed;top:8px;left:8px;z-index:9999;font-family:monospace" + q + ";",
  "  var __status = document.createElement(" + q + "div" + q + ");",
  "  __status.style.cssText = " + q + "color:#0f0;background:#000;padding:5px;margin-bottom:4px" + q + ";",
  "  __status.textContent = " + q + "deck: 52" + q + ";",
  "  __bar.appendChild(__status);",
  "  function btn(label, fn) {",
  "    var b = document.createElement(" + q + "button" + q + ");",
  "    b.textContent = label;",
  "    b.style.cssText = " + q + "margin-right:4px;padding:10px 16px;font-size:15px" + q + ";",
  "    b.onclick = fn;",
  "    __bar.appendChild(b);",
  "  }",
  "  btn(" + q + "DEAL 5" + q + ", function () {",
  "    hand = deck.splice(0, 5);",
  "    playSound(" + q + "__step" + q + ");",
  "    __status.textContent = " + q + "deck: " + q + " + deck.length;",
  "  });",
  "  btn(" + q + "HIT" + q + ", function () {",
  "    if (deck.length) { hand.push(deck.shift()); playSound(" + q + "__step" + q + "); }",
  "    __status.textContent = " + q + "deck: " + q + " + deck.length;",
  "  });",
  "  btn(" + q + "ROLL 2 DICE" + q + ", function () {",
  "    rollDice(2, 6, 0, -1, function (vals) { __status.textContent = " + q + "rolled " + q + " + vals.join(" + q + " + " + q + ") + " + q + " = " + q + " + (vals[0] + vals[1]); });",
  "  });",
  "  document.body.appendChild(__bar);",
  "} catch (e) {",
  "  var __err = document.createElement(" + q + "div" + q + ");",
  "  __err.style.cssText = " + q + "position:fixed;top:8px;left:8px;color:#f00;background:#000;padding:6px;z-index:9999" + q + ";",
  "  __err.textContent = " + q + "INJECT ERROR: " + q + " + e.message;",
  "  document.body.appendChild(__err);",
  "}",
  ""
].join("\n");
const marker = "</script>";
const idx = engine.lastIndexOf(marker);
if (idx < 0) { console.error("ABORT: no </scr" + "ipt>"); process.exit(1); }
fs.writeFileSync("showcase_cards.html", engine.slice(0, idx) + inject + engine.slice(idx));
console.log("OK showcase_cards.html — DEAL, HIT, ROLL 2 DICE");
