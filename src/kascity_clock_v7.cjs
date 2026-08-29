// make_kascity_v3.cjs — KasCity v3. Emits kascity_v7.json + showcase_kascity7.html.
//
// Fixes over v2 (per manual: engine ignores top-level world/alarms):
//   * boot alarm lives ON the director node; seeds EVERY flag; sets ready last
//   * BT root gated on world.flags.ready == 1
//   * render.cameraMode "fixed" + overhead Camera3D (v2 defaulted to follow)
//   * lighting block -> baked AO
// New economy (all shipped verbs; claim(key, owner) transfers deeds):
//   * lap tax at Depot: 6 KAS per owned property (props seat-stat, bucketed)
//   * counter-offers: land on rival's tile -> offer 90% of list; owner answers
//     at the start of their own turn; claim(key, fromSeat) transfers
//   * hazards on your own property: plumbing/maintenance/roof/hurricane costs,
//     tenant-won't-pay, lawsuit card
//   * tenant dispute at owner's turn: Evict (12 turns = 3 rounds, no rent,
//     25% wrongful-eviction suit), Lower rent (halved forever), Sell to bank 60%
//   * lawsuit card: Settle -75 or Fight (seeded rand: win 0 / lose -150)
//   * rent gates: no rent while tenant striking or eviction window active
// Visuals: ownership flags per tile per seat (show/hide), buildings on props,
// corner monuments, center emblem, richer palette.
"use strict";
const fs = require("fs");

const PLAYERS = 4;
const N = 40;
const MAXPROPS = 12; // tax bucket cap

const G = { kiln:"#6b4a2f", copper:"#7fb8d8", market:"#c9569a", orchard:"#d98232",
            amber:"#c0392b", beacon:"#d8c33a", cathedral:"#3f9e5a", crown:"#2f3f8e" };
const T = [
  { n:"The Depot", k:"depot" },
  { n:"Riverbend Row", k:"prop", g:"kiln", p:60, r:8 },
  { n:"Grant Office", k:"grant" },
  { n:"Kiln Street", k:"prop", g:"kiln", p:80, r:10 },
  { n:"Ward Levy", k:"levy", fee:200 },
  { n:"North Transit", k:"transit", p:200, r:60 },
  { n:"Copper Lane", k:"prop", g:"copper", p:120, r:14 },
  { n:"Signal Post", k:"fate" },
  { n:"Foundry Way", k:"prop", g:"copper", p:130, r:15 },
  { n:"Lantern Court", k:"prop", g:"copper", p:150, r:18 },
  { n:"Holding Cell", k:"jail" },
  { n:"Market Bridge", k:"prop", g:"market", p:170, r:20 },
  { n:"Power Station", k:"utility", p:150, r:40 },
  { n:"Cobbler Alley", k:"prop", g:"market", p:180, r:21 },
  { n:"Tanner Street", k:"prop", g:"market", p:200, r:24 },
  { n:"East Transit", k:"transit", p:200, r:60 },
  { n:"Orchard Gate", k:"prop", g:"orchard", p:220, r:26 },
  { n:"Grant Office", k:"grant" },
  { n:"Millrace Road", k:"prop", g:"orchard", p:230, r:27 },
  { n:"Cinder Row", k:"prop", g:"orchard", p:250, r:30 },
  { n:"The Plaza", k:"plaza" },
  { n:"Amber Quay", k:"prop", g:"amber", p:270, r:32 },
  { n:"Signal Post", k:"fate" },
  { n:"Vellum Street", k:"prop", g:"amber", p:280, r:33 },
  { n:"Ironworks Row", k:"prop", g:"amber", p:300, r:36 },
  { n:"South Transit", k:"transit", p:200, r:60 },
  { n:"Beacon Avenue", k:"prop", g:"beacon", p:320, r:38 },
  { n:"Harbor Light", k:"prop", g:"beacon", p:330, r:39 },
  { n:"Water Works", k:"utility", p:150, r:40 },
  { n:"Saltmarsh Drive", k:"prop", g:"beacon", p:350, r:42 },
  { n:"Report to Holding", k:"toJail" },
  { n:"Cathedral Walk", k:"prop", g:"cathedral", p:370, r:44 },
  { n:"Observatory Rise", k:"prop", g:"cathedral", p:380, r:45 },
  { n:"Grant Office", k:"grant" },
  { n:"Emerald Terrace", k:"prop", g:"cathedral", p:400, r:48 },
  { n:"West Transit", k:"transit", p:200, r:60 },
  { n:"Signal Post", k:"fate" },
  { n:"Summit Row", k:"prop", g:"crown", p:440, r:53 },
  { n:"Luxury Levy", k:"levy", fee:100 },
  { n:"Crown Heights", k:"prop", g:"crown", p:500, r:60 }
];
const buyable = (t) => t.k === "prop" || t.k === "transit" || t.k === "utility";

function tilePos(i) {
  const s = 2.2, edge = 11;
  const side = Math.floor(i / 10), off = i % 10;
  if (side === 0) return [edge - off * s, 0.06, edge];
  if (side === 1) return [-edge, 0.06, edge - off * s];
  if (side === 2) return [-edge + off * s, 0.06, -edge];
  return [edge, 0.06, -edge + off * s];
}

const act = (action, args, amount) => {
  const d = { action };
  if (args !== undefined) d.args = args;
  if (amount !== undefined) d.amount = amount;
  return { do: d };
};
const actTo = (action, to, args, amount) => { const a = act(action, args, amount); a.do.to = to; return a; };
const cond = (c) => ({ cond: c });
const seq = (...ch) => ({ sequence: ch });
const sel = (...ch) => ({ selector: ch });

// ---------------------------------------------------------------------------
// NODES
// ---------------------------------------------------------------------------
const nodes = [
  { id: "terrain", mesh: "ground", material: "felt", collision: "mesh",
    transform: { pos: [0, -0.25, 0] } },
  { id: "board_base", mesh: "board", material: "board", transform: { pos: [0, 0, 0] } },
  { id: "board_inlay", mesh: "inlay", material: "inlay", transform: { pos: [0, 0.065, 0] } },
  { id: "emblem", mesh: "emblem", material: "emblem", transform: { pos: [0, 0.13, 0], rot: [0, 45, 0] } },
  { id: "gamecam", type: "Camera3D", transform: { pos: [0, 33, 0.01], rot: [-89, 0, 0] } }
];
const materials = {
  felt: { color: "#173a2c" }, board: { color: "#e6dabb" }, inlay: { color: "#123227" },
  emblem: { color: "#caa64c" }, tile: { color: "#f2ead5" },
  corner: { color: "#cbbd9a" }, transit: { color: "#3c3c44" }, utility: { color: "#8aa0a8" },
  fate: { color: "#e08a2e" }, grant: { color: "#4f8fc0" }, levy: { color: "#8e2f2f" },
  bldg: { color: "#fdf6e3" }, you: { color: "#ffe14d" }, roof: { color: "#a03d2e" }, monu: { color: "#b8a878" },
  p1: { color: "#d94f4f" }, p2: { color: "#4f7fd9" }, p3: { color: "#4fd98a" }, p4: { color: "#d9c14f" }
};
for (const g in G) materials["g_" + g] = { color: G[g] };

T.forEach((t, i) => {
  const isCorner = "depot jail plaza toJail".indexOf(t.k) >= 0;
  const mat = t.k === "prop" ? "tile" : isCorner ? "corner" : t.k;
  const node = { id: "tile_" + i, mesh: isCorner ? "cornerM" : "tileM",
    material: mat, tags: ["tile"], transform: { pos: tilePos(i) } };
  const kids = [];
  if (t.g) kids.push({ id: "band_" + i, mesh: "band", material: "g_" + t.g,
    tags: ["band"], transform: { pos: [0, 0.08, -0.75] } });
  if (t.k === "prop") {
    kids.push({ id: "bld_" + i, mesh: "bldg", material: "bldg",
      transform: { pos: [0, 0.32, 0.28] } });
    kids.push({ id: "roof_" + i, mesh: "roofM", material: "roof",
      transform: { pos: [0, 0.62, 0.28], rot: [0, 45, 0] } });
  }
  if (isCorner) kids.push({ id: "mon_" + i, mesh: "monu", material: "monu",
    transform: { pos: [0, 0.5, 0] } });
  // ownership flags: one small post per seat, hidden until claimed
  if (buyable(t)) for (let s = 1; s <= PLAYERS; s++) {
    kids.push({ id: "own_" + i + "_" + s, mesh: "ownFlag", material: "p" + s,
      hidden: true, transform: { pos: [-0.75 + (s - 1) * 0.5, 0.3, 0.8] } });
  }
  if (kids.length) node.children = kids;
  nodes.push(node);
});

// [HUD] CanvasLayer children are Label / ProgressBar nodes with anchor + pos.
// Bound by hand each turn via setText — the engine has no template binding for
// arbitrary text, only ProgressBar.bind.
nodes.push({
  id: "hud", type: "CanvasLayer", children: [
    { id: "banner", type: "Label", anchor: "topCenter", pos: [0, 10], size: 18, text: "" },
    { id: "sub", type: "Label", anchor: "topCenter", pos: [0, 34], size: 12, text: "" },
    { id: "s1", type: "Label", anchor: "topLeft", pos: [10, 8], size: 12, text: "P1 (you)" },
    { id: "b1", type: "ProgressBar", anchor: "topLeft", pos: [10, 24], size: [90, 6], color: "#d94f4f", bind: "seats.1.cash", max: 4000 },
    { id: "s2", type: "Label", anchor: "topLeft", pos: [10, 36], size: 12, text: "P2" },
    { id: "b2", type: "ProgressBar", anchor: "topLeft", pos: [10, 52], size: [90, 6], color: "#4f7fd9", bind: "seats.2.cash", max: 4000 },
    { id: "s3", type: "Label", anchor: "topLeft", pos: [10, 64], size: 12, text: "P3" },
    { id: "b3", type: "ProgressBar", anchor: "topLeft", pos: [10, 80], size: [90, 6], color: "#4fd98a", bind: "seats.3.cash", max: 4000 },
    { id: "s4", type: "Label", anchor: "topLeft", pos: [10, 92], size: 12, text: "P4" },
    { id: "b4", type: "ProgressBar", anchor: "topLeft", pos: [10, 108], size: [90, 6], color: "#d9c14f", bind: "seats.4.cash", max: 4000 },
    { id: "tile_label", type: "Label", anchor: "bottomCenter", pos: [0, -46], size: 14, text: "" },
    { id: "clock_m", type: "Label", anchor: "topRight", pos: [-34, 10], size: 14, text: "10:" },
    { id: "clock_s", type: "Label", anchor: "topRight", pos: [-10, 10], size: 14, text: "00" },
    { id: "final", type: "Label", anchor: "topCenter", pos: [0, 120], size: 22, text: "", visible: false }
  ]
});

const tokenMesh = ["slim", "broad", "tall", "shorty"];
for (let s = 1; s <= PLAYERS; s++) {
  const tok = { id: "token_p" + s, mesh: tokenMesh[s - 1], material: "p" + s,
    tags: ["token"], footLock: true,
    transform: { pos: [11 + (s % 2) * 0.6 - 0.3, 0.2, 11 + (s > 2 ? 0.6 : 0) - 0.3], rot: [0, 180, 0] } };
  // [YOU] a floating pip over seat 1 so the human can find their piece at a glance.
  if (s === 1) tok.children = [{ id: "you_pip", mesh: "pip", material: "you",
    transform: { pos: [0, 1.5, 0], rot: [0, 45, 0] } }];
  nodes.push(tok);
}

// Jail move: set the shared mirror AND the moving seat's own position.
const toJail = () => sel.apply(null, [1, 2, 3, 4].map(function (s) {
  return seq(cond("seat() == " + s), act("setState", ["p" + s, 10]));
}));
// ---------------------------------------------------------------------------
// BEHAVIOR TREE — phase machine
// phase 0 pre-roll (owner answers pending offer -> tenant disputes -> roll)
// phase 1 move + resolve tile
// phase 2 buy answer            phase 21 offer answer (visitor)
// phase 22 offer answer (owner) phase 23 tenant answer
// phase 24 lawsuit answer       phase 3 end of turn
// ---------------------------------------------------------------------------
const bt = { sequence: [cond("world.flags.ready == 1"), { selector: [] }] };
const ROOT = bt.sequence[1].selector;

// ---------------------------------------------------------------------------
// [MATCH CLOCK] 10 minutes from the first tick. world.time is engine seconds
// and is exposed to conditions, so the clock needs no alarm — it is read, not
// counted. `t0` is stamped once, on the first frame after ready.
// ---------------------------------------------------------------------------
ROOT.push(seq(
  cond("world.flags.t0 == 0"),
  act("setFlagExpr", ["t0", "world.time"])
));
ROOT.push(seq(
  cond("world.flags.t0 > 0 && world.flags.over == 0"),
  act("setFlagExpr", ["left", "600 - floor(world.time - world.flags.t0)"]),
  cond("1 == 0")            // never succeeds: this branch only updates the clock
));

// Countdown readout: one branch per whole second remaining is impossible
// (600 branches), so the label is driven by two flags — minutes and seconds —
// each enumerated over its small domain. `mark` guards so setText fires only
// when the displayed second actually changes.
ROOT.push(seq(
  cond("world.flags.over == 0 && world.flags.left != world.flags.mark"),
  act("setFlagExpr", ["mark", "world.flags.left"]),
  act("setFlagExpr", ["cmin", "floor(world.flags.left / 60)"]),
  act("setFlagExpr", ["csec", "mod(world.flags.left, 60)"]),
  cond("1 == 0")
));
// minutes 10..0 x seconds 0..59 as text is 660 branches; instead show M:SS by
// composing two labels side by side — each enumerated over its own small range.
for (let m = 0; m <= 10; m++) {
  ROOT.push(seq(
    cond("world.flags.over == 0 && world.flags.cmin == " + m + " && world.flags.shown_m != " + m),
    act("setState", ["shown_m", m]),
    actTo("setText", "clock_m", [m + ":"])
  ));
}
for (let s = 0; s < 60; s++) {
  ROOT.push(seq(
    cond("world.flags.over == 0 && world.flags.csec == " + s + " && world.flags.shown_s != " + s),
    act("setState", ["shown_s", s]),
    actTo("setText", "clock_s", [(s < 10 ? "0" + s : "" + s)]),
    (s === 0 ? act("playSound", ["tick"]) : cond("1 == 1"))
  ));
}

// ---------------------------------------------------------------------------
// [FINAL BELL] richest seat wins. Enumerated comparisons — no max() verb.
// ---------------------------------------------------------------------------
const bell = seq(cond("world.flags.left <= 0 && world.flags.over == 0"), sel());
for (let s = 1; s <= PLAYERS; s++) {
  const others = [1, 2, 3, 4].filter(o => o !== s);
  const wins = others.map(o => "seatStat(" + s + ",'cash') >= seatStat(" + o + ",'cash')").join(" && ");
  bell.sequence[1].selector.push(seq(
    cond(wins),
    act("setState", ["over", 1]),
    actTo("setText", "final", [s === 1 ? "YOU WIN THE CITY" : "Player " + s + " wins the city"]),
    actTo("show", "final", []),
    actTo("setText", "banner", ["TIME"]),
    actTo("setText", "sub", ["final bell"]),
    actTo("setText", "clock_m", ["0:"]), actTo("setText", "clock_s", ["00"]),
    act("playSound", ["win"])
  ));
}
ROOT.push(bell);
// Nothing else runs once the bell has rung.
ROOT.push(seq(cond("world.flags.over == 1"), cond("1 == 1")));

// ---- PHASE 0 --------------------------------------------------------------
const p0 = seq(cond("world.flags.phase == 0"), sel());
ROOT.push(p0);
const p0sel = p0.sequence[1].selector;

// [HUD-BANNER] whose turn it is, refreshed once per turn (guarded by `hud_seat`
// so it fires on change, not every tick).
for (let s = 1; s <= PLAYERS; s++) {
  p0sel.push(seq(
    cond("seat() == " + s + " && world.flags.hud_seat != " + s),
    act("setState", ["hud_seat", s]),
    actTo("setText", "banner", [s === 1 ? "YOUR TURN" : "Player " + s + " is playing"]),
    actTo("setText", "sub", [s === 1 ? "tap Roll below" : "thinking..."])
  ));
}


// 0a. pending offer addressed to me (I own the tile someone offered on)
T.forEach((t, i) => {
  if (!buyable(t)) return;
  const price = Math.round(t.p * 0.9);
  // [NPC] bots hold their property — a winner doesn't sell cheap.
  p0sel.push(seq(
    cond("world.flags.offer_tile == " + i + " && ownerOf('t" + i + "') == seat() && seat() != 1"),
    act("setState", ["oans", 1])
  ));
  p0sel.push(seq(
    cond("world.flags.offer_tile == " + i + " && ownerOf('t" + i + "') == seat() && world.flags.oask == 0"),
    act("setState", ["oask", 1]),
    act("prompt", ["oans", "A rival offers " + price + " for " + t.n + ". Sell?", "Sell (" + price + ")", "Keep it"])
  ));
});
// owner's answer: transfer deed to the offering seat (static per tile x from-seat)
T.forEach((t, i) => {
  if (!buyable(t)) return;
  const price = Math.round(t.p * 0.9);
  for (let f = 1; f <= PLAYERS; f++) {
    p0sel.push(seq(
      cond("world.flags.offer_tile == " + i + " && world.flags.oans == 0 && world.flags.offer_from == " + f),
      act("claim", ["t" + i, f]),
      act("addSeatStat", ["current", "cash"], price),
      act("addSeatStat", ["current", "props"], -1),
      act("addSeatStat", [f, "cash"], -price),
      act("addSeatStat", [f, "props"], 1),
      actTo("hide", "own_" + i + "_" + 0, []), // placeholder fixed below
      actTo("show", "own_" + i + "_" + f, []),
      act("playSound", ["buy"]),
      act("setState", ["offer_tile", -1]), act("setState", ["oans", -1]), act("setState", ["oask", 0])
    ));
  }
  p0sel.push(seq(
    cond("world.flags.offer_tile == " + i + " && world.flags.oans == 1"),
    act("setState", ["offer_tile", -1]), act("setState", ["oans", -1]), act("setState", ["oask", 0])
  ));
});
// fix the hide target: previous owner's flag = the CURRENT seat answering; we
// cannot address it dynamically, so hide all four (harmless: only one shows)
p0sel.forEach((br) => {
  if (!br.sequence) return;
  const idx = br.sequence.findIndex((l) => l.do && l.do.action === "hide");
  if (idx < 0) return;
  const m = /offer_tile == (\d+)/.exec(br.sequence[0].cond);
  const i = m[1];
  const hides = [];
  for (let s = 1; s <= PLAYERS; s++) hides.push(actTo("hide", "own_" + i + "_" + s, []));
  br.sequence.splice(idx, 1, ...hides);
});

// 0b. tenant disputes on my tiles
T.forEach((t, i) => {
  if (t.k !== "prop") return;
  const half = Math.max(1, Math.floor(t.r / 2));
  const sale = Math.round(t.p * 0.6);
  // [NPC] flush bots convert to Airbnb (premium rent); tight bots cut rent.
  p0sel.push(seq(
    cond("ownerOf('t" + i + "') == seat() && world.flags.tenant_t" + i + " == 1 && seat() != 1 && seatStat(seat(),'cash') > 800"),
    act("setState", ["ttile", i]), act("setState", ["tans", 3])
  ));
  p0sel.push(seq(
    cond("ownerOf('t" + i + "') == seat() && world.flags.tenant_t" + i + " == 1 && seat() != 1"),
    act("setState", ["ttile", i]), act("setState", ["tans", 1])
  ));
  p0sel.push(seq(
    cond("ownerOf('t" + i + "') == seat() && world.flags.tenant_t" + i + " == 1 && world.flags.task == 0"),
    act("setState", ["task", 1]),
    act("prompt", ["tans", "Tenant at " + t.n + " refuses to pay rent.",
      "Evict (3 rounds, no rent)", "Lower rent to " + half + " (4 rounds)", "Sell to bank (" + sale + ")", "Convert to Airbnb"]),
    act("setState", ["ttile", i])
  ));
  // answers (static per tile)
  p0sel.push(seq(
    cond("world.flags.ttile == " + i + " && world.flags.tans == 0"),
    act("setFlagExpr", ["ev_t" + i, "world.flags.turn + 12"]),
    act("setState", ["tenant_t" + i, 0]),
    // 25% wrongful-eviction lawsuit, seeded
    act("setFlagExpr", ["coin", "rand()"]),
    sel(seq(cond("world.flags.coin < 0.25"),
            act("addSeatStat", ["current", "cash"], -100),
            act("playSound", ["gavel"])),
        cond("1 == 1")),
    act("playSound", ["evict"]),
    act("setState", ["ttile", -1]), act("setState", ["tans", -1]), act("setState", ["task", 0])
  ));
  p0sel.push(seq(
    cond("world.flags.ttile == " + i + " && world.flags.tans == 1"),
    act("setFlagExpr", ["lr_t" + i, "world.flags.turn + 16"]),   // reduced rent for 4 rounds, then reverts
    act("setState", ["tenant_t" + i, 0]),
    act("setState", ["ttile", -1]), act("setState", ["tans", -1]), act("setState", ["task", 0])
  ));
  p0sel.push(seq(
    cond("world.flags.ttile == " + i + " && world.flags.tans == 3"),
    act("setState", ["bnb_t" + i, 1]),
    act("setState", ["tenant_t" + i, 0]),
    act("addSeatStat", ["current", "cash"], -30),   // furnishing cost
    act("playSound", ["bnb"]),
    act("setState", ["ttile", -1]), act("setState", ["tans", -1]), act("setState", ["task", 0])
  ));
  p0sel.push(seq(
    cond("world.flags.ttile == " + i + " && world.flags.tans == 2"),
    act("release", ["t" + i]),
    act("addSeatStat", ["current", "cash"], sale),
    act("addSeatStat", ["current", "props"], -1),
    act("setState", ["tenant_t" + i, 0]),
    act("setState", ["lr_t" + i, 0]),
    act("setState", ["bnb_t" + i, 0]),
    act("setState", ["vac_t" + i, 0]),
    act("playSound", ["rent"]),
    act("setState", ["ttile", -1]), act("setState", ["tans", -1]), act("setState", ["task", 0])
  ));
});
// hide ownership flags on bank sale (all four; only one was showing)
p0sel.forEach((br) => {
  if (!br.sequence) return;
  const rel = br.sequence.find((l) => l.do && l.do.action === "release");
  if (!rel) return;
  const i = rel.do.args[0].slice(1);
  const at = br.sequence.findIndex((l) => l.do && l.do.action === "release");
  const hides = [];
  for (let s = 1; s <= PLAYERS; s++) hides.push(actTo("hide", "own_" + i + "_" + s, []));
  br.sequence.splice(at + 1, 0, ...hides);
});

// 0c. roll
// NPC seats (2-4) roll themselves — no prompt, no waiting.
p0sel.push(seq(cond("world.flags.asked == 0 && seat() != 1"),
  act("setState", ["asked", 1]),
  act("setState", ["go", 0])));
p0sel.push(seq(cond("world.flags.asked == 0"),
  act("setState", ["asked", 1]),
  act("prompt", ["go", "Your turn. Tap to roll the fate deck.", "Roll"])));
// [PER-SEAT-POS] each seat keeps its own p<seat>; `pos` mirrors the seat that
// is moving, so every downstream tile rule reads `pos` unchanged.
for (let s = 1; s <= PLAYERS; s++) {
  p0sel.push(seq(cond("world.flags.go >= 0 && seat() == " + s),
    act("drawCard", ["fate"]),
    act("playSound", ["dice"]),
    act("setFlagExpr", ["sum", "world.flags.p" + s + " + lastCard('fate') + 2"]),
    act("setFlagExpr", ["p" + s, "mod(world.flags.sum, 40)"]),
    act("setFlagExpr", ["pos", "world.flags.p" + s]),
    act("setState", ["asked", 0]),
    act("setState", ["go", -1]),
    act("setState", ["phase", 1])));
}

// ---- PHASE 1 --------------------------------------------------------------
const resolve = sel();
const taxSel = sel();
// lap: +200 depot pay, then property tax 6/owned (bucketed)
for (let k = MAXPROPS; k >= 1; k--) {
  taxSel.selector.push(seq(
    cond("seatStat(seat(),'props') >= " + k),
    act("addSeatStat", ["current", "cash"], -(6 * k)),
    act("playSound", ["tax"])
  ));
}
taxSel.selector.push(cond("1 == 1"));
ROOT.push(seq(
  cond("world.flags.phase == 1"),
  sel(seq(cond("world.flags.sum >= 40"),
          act("addSeatStat", ["current", "cash"], 200),
          act("playSound", ["depot"]),
          taxSel),
      cond("1 == 1")),
  resolve
));

// token teleports: seat x tile
for (let s = 1; s <= PLAYERS; s++) {
  for (let i = 0; i < N; i++) {
    const p = tilePos(i);
    resolve.selector.push(seq(
      cond("seat() == " + s + " && world.flags.pos == " + i + " && world.flags.moved == 0"),
      // [GLIDE] tween x and z so the piece travels instead of blinking.
      actTo("tween", "token_p" + s, ["transform.pos.0", p[0], 0.55, "outQuad"]),
      actTo("tween", "token_p" + s, ["transform.pos.2", p[2] + (s * 0.35 - 0.9), 0.55, "outQuad"]),
      act("setState", ["moved", 1])
    ));
  }
}

// [TILE-LABEL] name the square the mover landed on.
T.forEach((t, i) => {
  resolve.selector.push(seq(
    cond("world.flags.pos == " + i + " && world.flags.moved == 1 && world.flags.shown != " + i),
    act("setState", ["shown", i]),
    actTo("setText", "tile_label", [t.n])
  ));
});

// tile resolution
T.forEach((t, i) => {
  const at = "world.flags.pos == " + i + " && world.flags.moved == 1";
  if (buyable(t)) {
    // [NPC] seats 2-4 decide without a prompt: buy when a 150 reserve survives.
    resolve.selector.push(seq(
      cond(at + " && seat() != 1 && ownerOf('t" + i + "') == 0 && seatStat(seat(),'cash') >= " + (t.p + 150)),
      act("setState", ["buy_tile", i]),
      act("setState", ["buy", 0]),
      act("setState", ["phase", 2])
    ));
    resolve.selector.push(seq(
      cond(at + " && seat() != 1 && ownerOf('t" + i + "') == 0"),
      act("setState", ["phase", 3])
    ));
    // unowned -> buy prompt
    resolve.selector.push(seq(
      cond(at + " && ownerOf('t" + i + "') == 0 && seatStat(seat(),'cash') >= " + t.p),
      act("prompt", ["buy", t.n + " is unowned. Buy for " + t.p + "?", "Buy (" + t.p + ")", "Pass"]),
      act("setState", ["buy_tile", i]),
      act("setState", ["phase", 2])
    ));
    resolve.selector.push(seq(cond(at + " && ownerOf('t" + i + "') == 0"),
      act("setState", ["phase", 3])));
    // rival-owned -> rent (gated on tenant strike + eviction window), then offer chance
    for (let s = 1; s <= PLAYERS; s++) {
      const base = "ownerOf('t" + i + "') == " + s + " && seat() != " + s;
      const open = " && world.flags.tenant_t" + i + " == 0 && world.flags.ev_t" + i + " <= world.flags.turn && world.flags.vac_t" + i + " <= world.flags.turn";
      const half = Math.max(1, Math.floor(t.r / 2));
      if (t.k === "prop") {
        // reduced-rent window still open
        resolve.selector.push(seq(
          cond(at + " && " + base + open + " && world.flags.turn < world.flags.lr_t" + i),
          act("addSeatStat", ["current", "cash"], -half),
          act("addSeatStat", [s, "cash"], half),
          act("playSound", ["rent"]),
          act("setState", ["phase", 21]), act("setState", ["offer_ask", i])
        ));
        // Airbnb: premium nightly rate (1.5x) while listed
        resolve.selector.push(seq(
          cond(at + " && " + base + open + " && world.flags.bnb_t" + i + " == 1"),
          act("addSeatStat", ["current", "cash"], -Math.round(t.r * 1.5)),
          act("addSeatStat", [s, "cash"], Math.round(t.r * 1.5)),
          act("playSound", ["bnb"]),
          act("setState", ["phase", 21]), act("setState", ["offer_ask", i])
        ));
      }
      resolve.selector.push(seq(
        cond(at + " && " + base + open),
        act("addSeatStat", ["current", "cash"], -t.r),
        act("addSeatStat", [s, "cash"], t.r),
        act("playSound", ["rent"]),
        act("setState", ["phase", 21]), act("setState", ["offer_ask", i])
      ));
      // rent suspended (strike or eviction window): still may offer
      resolve.selector.push(seq(
        cond(at + " && " + base),
        act("setState", ["phase", 21]), act("setState", ["offer_ask", i])
      ));
    }
    // my own tile: hazards (props only)
    if (t.k === "prop") {
      // [NPC] same hazards, but a lawsuit auto-settles (no dialogue for bots).
      resolve.selector.push(seq(
        cond(at + " && seat() != 1 && ownerOf('t" + i + "') == seat()"),
        act("drawCard", ["hazard"]),
        sel(
          seq(cond("lastCard('hazard') == 0"), act("addSeatStat", ["current", "cash"], -40), act("playSound", ["hazard"])),
          seq(cond("lastCard('hazard') == 1"), act("addSeatStat", ["current", "cash"], -25), act("playSound", ["hazard"])),
          seq(cond("lastCard('hazard') == 2"), act("addSeatStat", ["current", "cash"], -60), act("playSound", ["hazard"])),
          seq(cond("lastCard('hazard') == 3"), act("addSeatStat", ["current", "cash"], -100), act("playSound", ["storm"])),
          seq(cond("lastCard('hazard') == 4"), act("setState", ["tenant_t" + i, 1]), act("playSound", ["knock"])),
          seq(cond("lastCard('hazard') == 5"), act("addSeatStat", ["current", "cash"], -75), act("playSound", ["gavel"])),
          seq(cond("lastCard('hazard') == 6"), act("setFlagExpr", ["vac_t" + i, "world.flags.turn + 8"]), act("playSound", ["knock"])),
          cond("1 == 1")
        ),
        act("setState", ["phase", 3])
      ));
      resolve.selector.push(seq(
        cond(at + " && ownerOf('t" + i + "') == seat()"),
        act("drawCard", ["hazard"]),
        act("playSound", ["card"]),
        sel(
          seq(cond("lastCard('hazard') == 0"),
              act("addSeatStat", ["current", "cash"], -40), act("playSound", ["hazard"])),   // burst plumbing
          seq(cond("lastCard('hazard') == 1"),
              act("addSeatStat", ["current", "cash"], -25), act("playSound", ["hazard"])),   // maintenance
          seq(cond("lastCard('hazard') == 2"),
              act("addSeatStat", ["current", "cash"], -60), act("playSound", ["hazard"])),   // roof repair
          seq(cond("lastCard('hazard') == 3"),
              act("addSeatStat", ["current", "cash"], -100), act("playSound", ["storm"])),   // hurricane rough fix
          seq(cond("lastCard('hazard') == 4"),
              act("setState", ["tenant_t" + i, 1]), act("playSound", ["knock"])),            // tenant won't pay
          seq(cond("lastCard('hazard') == 5"),
              act("prompt", ["lans", "A tenant files a lawsuit over conditions at " + t.n + ".",
                "Settle (-75)", "Fight it in court"]),
              act("setState", ["phase", 24]), act("setState", ["moved", 2])),                // lawsuit
          seq(cond("lastCard('hazard') == 6"),
              act("setFlagExpr", ["vac_t" + i, "world.flags.turn + 8"]),                     // lease up — tenant leaving: 2 rounds vacant
              act("prompt", ["lup", "Lease is up at " + t.n + " — tenant is leaving. Two rounds to re-let.", "OK"]),
              act("playSound", ["knock"])),
          cond("1 == 1")                                                                     // 7: quiet lap
        ),
        sel(cond("world.flags.phase == 24"), act("setState", ["phase", 3]))
      ));
    } else {
      resolve.selector.push(seq(cond(at + " && ownerOf('t" + i + "') == seat()"),
        act("setState", ["phase", 3])));
    }
  } else if (t.k === "levy") {
    resolve.selector.push(seq(cond(at),
      act("addSeatStat", ["current", "cash"], -t.fee),
      act("playSound", ["rent"]),
      act("setState", ["phase", 3])));
  } else if (t.k === "fate" || t.k === "grant") {
    resolve.selector.push(seq(cond(at),
      act("drawCard", ["cards"]),
      act("playSound", ["card"]),
      sel(
        seq(cond("lastCard('cards') == 0"), act("addSeatStat", ["current", "cash"], 120)),
        seq(cond("lastCard('cards') == 1"), act("addSeatStat", ["current", "cash"], 75)),
        seq(cond("lastCard('cards') == 2"), act("addSeatStat", ["current", "cash"], -60)),
        seq(cond("lastCard('cards') == 3"), act("addSeatStat", ["current", "cash"], -90)),
        seq(cond("lastCard('cards') == 4"), act("addSeatStat", ["current", "cash"], 200)),
        seq(cond("lastCard('cards') == 5"),
            act("setState", ["pos", 10]), toJail(), act("setState", ["moved", 0]),
            act("addSeatStat", ["current", "cash"], -50), act("playSound", ["jail"])),
        seq(cond("lastCard('cards') == 6"), act("addSeatStat", ["current", "cash"], 45)),
        seq(cond("lastCard('cards') == 7"), act("addSeatStat", ["current", "cash"], -25))
      ),
      act("setState", ["phase", 3])));
  } else if (t.k === "toJail") {
    resolve.selector.push(seq(cond(at),
      act("setState", ["pos", 10]), toJail(), act("setState", ["moved", 0]),
      act("addSeatStat", ["current", "cash"], -50),
      act("playSound", ["jail"]),
      act("setState", ["phase", 3])));
  } else {
    resolve.selector.push(seq(cond(at), act("setState", ["phase", 3])));
  }
});

// ---- PHASE 2: buy answer (per tile; marker shown per seat) ----------------
const p2 = seq(cond("world.flags.phase == 2 && world.flags.buy >= 0"), sel());
T.forEach((t, i) => {
  if (!buyable(t)) return;
  for (let s = 1; s <= PLAYERS; s++) {
    p2.sequence[1].selector.push(seq(
      cond("world.flags.buy_tile == " + i + " && world.flags.buy == 0 && seat() == " + s),
      act("claim", ["t" + i]),
      act("addSeatStat", ["current", "cash"], -t.p),
      act("addSeatStat", ["current", "props"], 1),
      actTo("show", "own_" + i + "_" + s, []),
      actTo("playPose", "token_p" + s, ["cheer"]),
      act("playSound", ["buy"]),
      act("setState", ["buy", -1]),
      act("setState", ["phase", 3])
    ));
  }
});
p2.sequence[1].selector.push(seq(cond("world.flags.buy == 1"),
  act("setState", ["buy", -1]), act("setState", ["phase", 3])));
ROOT.push(p2);

// ---- PHASE 21: visitor may lodge a counter-offer --------------------------
const p21 = seq(cond("world.flags.phase == 21"), sel());
// [NPC] bots don't lodge counter-offers — they buy from the bank instead.
p21.sequence[1].selector.push(seq(cond("seat() != 1"),
  act("setState", ["offer_ask", -1]), act("setState", ["phase", 3])));
T.forEach((t, i) => {
  if (!buyable(t)) return;
  const price = Math.round(t.p * 0.9);
  p21.sequence[1].selector.push(seq(
    cond("world.flags.offer_ask == " + i + " && world.flags.oq == 0 && world.flags.offer_tile == -1 && seatStat(seat(),'cash') >= " + price),
    act("setState", ["oq", 1]),
    act("prompt", ["mkoffer", "Offer to buy " + t.n + " for " + price + "? The owner decides on their turn.",
      "Make offer", "No"])
  ));
  p21.sequence[1].selector.push(seq(
    cond("world.flags.offer_ask == " + i + " && world.flags.mkoffer == 0"),
    act("setState", ["offer_tile", i]),
    act("setFlagExpr", ["offer_from", "seat()"]),
    act("playSound", ["card"]),
    act("setState", ["mkoffer", -1]), act("setState", ["oq", 0]),
    act("setState", ["offer_ask", -1]), act("setState", ["phase", 3])
  ));
});
p21.sequence[1].selector.push(seq(cond("world.flags.mkoffer == 1"),
  act("setState", ["mkoffer", -1]), act("setState", ["oq", 0]),
  act("setState", ["offer_ask", -1]), act("setState", ["phase", 3])));
// no offer possible (already one pending, or can't afford): move on
p21.sequence[1].selector.push(seq(cond("world.flags.oq == 0"),
  act("setState", ["offer_ask", -1]), act("setState", ["phase", 3])));
ROOT.push(p21);

// ---- PHASE 24: lawsuit answer ---------------------------------------------
ROOT.push(seq(cond("world.flags.phase == 24 && world.flags.lans >= 0"), sel(
  seq(cond("world.flags.lans == 0"),
    act("addSeatStat", ["current", "cash"], -75),
    act("playSound", ["gavel"]),
    act("setState", ["lans", -1]), act("setState", ["phase", 3])),
  seq(cond("world.flags.lans == 1"),
    act("setFlagExpr", ["coin", "rand()"]),
    sel(
      seq(cond("world.flags.coin < 0.5"), act("playSound", ["win"])),
      seq(cond("1 == 1"),
        act("addSeatStat", ["current", "cash"], -150),
        act("playSound", ["gavel"]))
    ),
    act("setState", ["lans", -1]), act("setState", ["phase", 3]))
)));

// ---- PHASE 3: bankruptcy, victory, rotation -------------------------------
const p3 = seq(cond("world.flags.phase == 3"), sel());
for (let s = 1; s <= PLAYERS; s++) {
  p3.sequence[1].selector.push(seq(
    cond("seatStat(" + s + ",'cash') < 0 && seatStat(" + s + ",'alive') == 1"),
    act("setSeatStat", [s, "alive", 0]),
    act("playSound", ["bust"])
  ));
}
p3.sequence[1].selector.push(seq(
  cond("seatStat(1,'alive') + seatStat(2,'alive') + seatStat(3,'alive') + seatStat(4,'alive') <= 1"),
  act("prompt", ["fin", "The city has one landlord left. Game over.", "OK"]),
  act("setState", ["phase", 9]),
  act("playSound", ["win"])
));
p3.sequence[1].selector.push(seq(
  cond("1 == 1"),
  act("nextSeat"),
  act("setState", ["moved", 0]),
  act("setState", ["sum", 0]),
  act("setState", ["phase", 0])
));
ROOT.push(p3);

// ---------------------------------------------------------------------------
// BOOT — on the director node (top-level alarms are ignored by the engine)
// ---------------------------------------------------------------------------
const bootActions = [];
const flagSeed = { phase: 0, asked: 0, pos: 0, sum: 0, moved: 1, seat: 1, turn: 0,
  p1: 0, p2: 0, p3: 0, p4: 0, hud_seat: 0, shown: -1,
  t0: 0, left: 600, mark: 9999, over: 0, cmin: 10, csec: 0, shown_m: -1, shown_s: -1,
  go: -1, buy: -1, buy_tile: -1, offer_tile: -1, offer_from: 0, offer_ask: -1,
  oans: -1, oask: 0, oq: 0, mkoffer: -1, tans: -1, ttile: -1, task: 0,
  lans: -1, lup: -1, coin: 0 };
for (const k in flagSeed) bootActions.push({ action: "setState", args: [k, flagSeed[k]] });
for (let s = 1; s <= PLAYERS; s++) {
  bootActions.push({ action: "setSeatStat", args: [s, "cash", 2000] });
  bootActions.push({ action: "setSeatStat", args: [s, "alive", 1] });
  bootActions.push({ action: "setSeatStat", args: [s, "props", 0] });
}
bootActions.push({ action: "shuffleDeck", args: ["fate"] });
bootActions.push({ action: "shuffleDeck", args: ["cards"] });
bootActions.push({ action: "shuffleDeck", args: ["hazard"] });
bootActions.push({ action: "setState", args: ["ready", 1] }); // LAST

// Engine alarm schema (v6.5): one { after, repeat, do } per entry, fired in
// registration order within a tick — so "ready" last still lands last.
nodes.push({ id: "director", type: "Actor", tags: ["director"],
  transform: { pos: [0, 0, 0] }, bt: bt,
  alarms: bootActions.map(function (a) { return { after: 0.1, do: a }; }) });

// ---------------------------------------------------------------------------
// DESCRIPTOR
// ---------------------------------------------------------------------------
const scene = {
  kind: "kv_game_v1",
  engine: "scene",
  meta: { id: "kascity_v7", name: "KasCity", seed: "kc7", players: PLAYERS, category: "board" },
  debug: false,
  permissions: ["identity", "persist", "stats"],
  compliance: { maxNodes: 512 },
  input: { scheme: "tap" },
  render: { cameraMode: "fixed" },
  tables: { decks: { fate: 11, cards: 8, hazard: 8 } },
  nodes: nodes,
  resources: {
    meshes: {
      ground: { type: "box", size: [40, 0.5, 40] },
      board: { type: "box", size: [24.2, 0.12, 24.2] },
      inlay: { type: "box", size: [18.2, 0.02, 18.2] },
      emblem: { type: "box", size: [3.6, 0.12, 3.6] },
      tileM: { type: "box", size: [2.06, 0.1, 2.06] },
      cornerM: { type: "box", size: [2.16, 0.14, 2.16] },
      band: { type: "box", size: [2.06, 0.06, 0.57] },
      bldg: { type: "box", size: [0.85, 0.5, 0.62] },
      roofM: { type: "box", size: [0.62, 0.24, 0.62] },
      monu: { type: "box", size: [0.55, 0.85, 0.55] },
      ownFlag: { type: "box", size: [0.2, 0.5, 0.06] },
      pip: { type: "box", size: [0.34, 0.34, 0.34] },
      slim: { type: "humanoid", bulk: 0.8, limbLen: 1.05 },
      broad: { type: "humanoid", bulk: 1.25, limbLen: 0.92 },
      tall: { type: "humanoid", bulk: 0.95, limbLen: 1.18 },
      shorty: { type: "humanoid", bulk: 1.1, limbLen: 0.82 }
    },
    materials: materials,
    poses: {
      cheer: { dur: 0.9, loop: false, tracks: {
        armL: [[0, 0], [0.28, { rx: -155, rz: -18 }], [0.9, 0]],
        armR: [[0, 0], [0.28, { rx: -155, rz: 18 }], [0.9, 0]],
        handL: [[0, 0], [0.34, { rz: -22 }], [0.55, { rz: 18 }], [0.9, 0]],
        handR: [[0, 0], [0.34, { rz: 22 }], [0.55, { rz: -18 }], [0.9, 0]]
      } }
    },
    sounds: {
      dice: { type: "noise", filter: 2600, dur: 0.38, vol: 0.5 },
      card: { type: "noise", filter: 4200, dur: 0.16, vol: 0.35 },
      buy: { layers: [
        { type: "tone", wave: "sine", freq: 660, sweep: 220, dur: 0.14, vol: 0.35 },
        { type: "tone", wave: "sine", freq: 990, sweep: 320, dur: 0.2, vol: 0.25 } ] },
      rent: { type: "tone", wave: "sawtooth", freq: 340, sweep: -180, dur: 0.28, vol: 0.32 },
      tax: { type: "tone", wave: "square", freq: 260, sweep: -120, dur: 0.3, vol: 0.3 },
      depot: { type: "tone", wave: "sine", freq: 784, sweep: 120, dur: 0.26, vol: 0.3 },
      jail: { type: "tone", wave: "square", freq: 150, sweep: -70, dur: 0.42, vol: 0.34 },
      bust: { type: "tone", wave: "sawtooth", freq: 400, sweep: -330, dur: 0.75, vol: 0.38 },
      hazard: { type: "noise", filter: 900, dur: 0.5, vol: 0.4 },
      storm: { layers: [
        { type: "noise", filter: 500, dur: 1.1, vol: 0.45 },
        { type: "tone", wave: "sawtooth", freq: 90, sweep: -40, dur: 1.0, vol: 0.25 } ] },
      knock: { layers: [
        { type: "noise", filter: 1400, dur: 0.09, vol: 0.4 },
        { type: "noise", filter: 1400, dur: 0.09, vol: 0.4 } ] },
      evict: { type: "tone", wave: "square", freq: 220, sweep: -110, dur: 0.5, vol: 0.32 },
      bnb: { layers: [
        { type: "tone", wave: "sine", freq: 880, sweep: 140, dur: 0.12, vol: 0.3 },
        { type: "tone", wave: "sine", freq: 1175, sweep: 90, dur: 0.16, vol: 0.22 } ] },
      gavel: { type: "noise", filter: 700, dur: 0.22, vol: 0.5 },
      tick: { type: "tone", wave: "square", freq: 1200, dur: 0.06, vol: 0.22 },
      win: { layers: [
        { type: "tone", wave: "sine", freq: 523, dur: 0.3, vol: 0.32 },
        { type: "tone", wave: "sine", freq: 784, dur: 0.42, vol: 0.3 } ] }
    }
  }
};

// ---------------------------------------------------------------------------
// EMIT + SELF-CHECKS
// ---------------------------------------------------------------------------
const json = JSON.stringify(scene);
// boot correctness self-checks (the v2 lesson)
const checks = [
  ["boot on director node", /"id":"director"[^]*?"alarms"/.test(json)],
  ["ready set last", json.lastIndexOf('["ready",1]') > json.lastIndexOf('"shuffleDeck"')],
  ["ready gate on BT root", json.indexOf('world.flags.ready == 1') >= 0],
  ["cameraMode fixed", json.indexOf('"cameraMode":"fixed"') >= 0],
  ["no top-level world block", !/^\{"kind[^]*?"world":\{/.test(json.slice(0, 400))],
  ["node count <= 512", (json.match(/"id":"/g) || []).length <= 512],
  ["per-seat positions seeded", /"p1",0/.test(json) && /"p4",0/.test(json)],
  ["per-seat roll branches", (json.match(/world\.flags\.p[1-4] \+ lastCard/g) || []).length === 4],
  ["npc branches present", (json.match(/seat\(\) != 1/g) || []).length > 50],
  ["npc roll claims asked", /asked == 0 && seat\(\) != 1[^]{0,200}?"asked",1/.test(json)],
  ["hud layer present", json.indexOf('"CanvasLayer"') >= 0 && json.indexOf('"banner"') >= 0],
  ["turn banner branches", (json.match(/hud_seat != [1-4]/g) || []).length === 4],
  ["glide tweens", (json.match(/transform\.pos\.0/g) || []).length === 160],
  ["you pip on seat 1", json.indexOf('"you_pip"') >= 0],
  ["match clock wired", json.indexOf('600 - floor(world.time - world.flags.t0)') >= 0],
  ["final bell per seat", (json.match(/"over",1/g) || []).length === 4],
  ["equal 2000 start", (json.match(/"cash",2000/g) || []).length === 4],
  ["clock labels split", json.indexOf('"clock_m"') >= 0 && json.indexOf('"clock_s"') >= 0],
  ["per-second seconds branches", (json.match(/csec == \d+/g) || []).length === 60],
  ["minute branches", (json.match(/cmin == \d+/g) || []).length === 11],
  ["cash bars bound", (json.match(/seats\.[1-4]\.cash/g) || []).length === 4]
];
let bad = 0;
for (const [name, ok] of checks) { console.log((ok ? "PASS " : "FAIL ") + name); if (!ok) bad++; }
if (bad) { console.error("ABORT: " + bad + " self-check(s) failed — nothing written."); process.exit(1); }

fs.writeFileSync("kascity_v7.json", json);
console.log("OK kascity_v7.json (" + (json.length / 1024).toFixed(1) + " KB, BT " +
  (JSON.stringify(bt).length / 1024).toFixed(1) + " KB, nodes " + nodes.length + ")");

const engine = fs.readFileSync("scene_engine.html", "utf8");
const inject = [
  "", "// ---- injected kascity v7 showcase ----",
  "try { loadScene(" + JSON.stringify(json) + "); }",
  "catch (e) { console.error('kascity7 boot: ' + (e && e.message)); }", ""
].join("\n");
fs.writeFileSync("showcase_kascity7.html",
  engine.replace("</script>", inject + "\n</script>"));
console.log("OK showcase_kascity7.html");
