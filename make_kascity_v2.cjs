// make_kascity_v2.cjs — KasCity rebuilt on the REAL engine vocabulary.
// Emits kascity_v2.json (publishable descriptor) and showcase_kascity.html
// (engine + injected loadScene, so the smoke harness exercises it).
//
// Every rule below uses only shipped verbs:
//   fate deck (11 cards -> steps 2..12)   drawCard / shuffleDeck
//   movement (pos + steps) % 40           setFlagExpr + mod()
//   pass-Depot pay                        setFlagExpr sum + cond >= 40
//   buy / decline                         prompt -> claim + addSeatStat
//   rent to the owner                     ownerOf() branches per seat
//   levies, corner squares                addSeatStat / teleport
//   fate & grant card effects             drawCard + lastCard() branches
//   bankruptcy & victory                  seatStat + prompt + endGame-ish flags
//   turn rotation                         nextSeat (skips dead seats)
// Turn flow is a flag-driven phase machine (phase 0 roll, 1 resolve,
// 2 awaiting buy answer, 3 end-of-turn) so async prompts fire exactly once.
"use strict";
const fs = require("fs");

const PLAYERS = 4;
const N = 40;

// ---- board table (prices/rents from the v1 design, kinds simplified) ------
// kind: prop (buyable, rent), transit (buyable flat 60), utility (buyable
// flat 40), levy (fee), fate/grant (draw), depot/plaza (rest), jail (visit),
// toJail (teleport + fine)
const G = { kiln:"#6b4a2f", copper:"#7fb8d8", market:"#c9569a", orchard:"#d98232",
            amber:"#c0392b", beacon:"#d8c33a", cathedral:"#3f9e5a", crown:"#2f3f8e" };
// ---- v13 bot AI tunables ---------------------------------------------------
// aggr is a RESERVE multiplier: lower = keener to buy. Owning group-mates
// lowers it further (colour-set instinct); rand() adds a seeded wobble so a
// bot is not perfectly predictable, while replays stay identical.
const AI = {
  AGGR:      { 2: 1.2, 3: 1.5, 4: 2.2 },  // per bot seat; seat 1 is human
  MATE_PULL: 0.35,   // per owned group-mate
  WOBBLE:    0.40,   // rand() jitter band
  TURN_STOP: 40,     // seat-turns, not rounds: 40 = 10 rounds each at 4 players
  SELL_FLOOR: 100,   // cash below this triggers a sale
  SELL_PCT:  0.60    // refund fraction
};
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

// ---- tile positions: 11 per side around a square ---------------------------
function tilePos(i) {
  const s = 2.2, edge = 11;
  const side = Math.floor(i / 10), off = i % 10;
  if (side === 0) return [edge - off * s, 0.06, edge];
  if (side === 1) return [-edge, 0.06, edge - off * s];
  if (side === 2) return [-edge + off * s, 0.06, -edge];
  return [edge, 0.06, -edge + off * s];
}

// ---- helpers to build BT fragments -----------------------------------------
const act = (action, args, amount) => {
  const d = { action: action };
  if (args !== undefined) d.args = args;
  if (amount !== undefined) d.amount = amount;
  return { do: d };
};
const cond = (c) => ({ cond: c });
const seq = (...ch) => ({ sequence: ch });
const sel = (...ch) => ({ selector: ch });

// ---- nodes: felt, board, tiles, tokens -------------------------------------
const nodes = [
  { id: "terrain", mesh: "ground", material: "felt", collision: "mesh",
    transform: { pos: [0, -0.25, 0] } },
  { id: "board_base", mesh: "board", material: "board", transform: { pos: [0, 0, 0] } }
];
const materials = {
  felt: { color: "#1f4032" }, board: { color: "#dfd3b6" }, tile: { color: "#efe6cf" },
  corner: { color: "#cbbd9a" }, transit: { color: "#3c3c44" }, utility: { color: "#8aa0a8" },
  fate: { color: "#e08a2e" }, grant: { color: "#4f8fc0" }, levy: { color: "#8e2f2f" },
  p1: { color: "#d94f4f" }, p2: { color: "#4f7fd9" }, p3: { color: "#4fd98a" }, p4: { color: "#d9c14f" }
};
for (const g in G) materials["g_" + g] = { color: G[g] };

T.forEach((t, i) => {
  const mat = t.k === "prop" ? "tile"
    : (t.k === "depot" || t.k === "jail" || t.k === "plaza" || t.k === "toJail") ? "corner"
    : t.k;
  const node = { id: "tile_" + i, mesh: t.k.length && "depot jail plaza toJail".indexOf(t.k) >= 0 ? "corner" : "tileM",
    material: mat, tags: ["tile"], transform: { pos: tilePos(i) } };
  if (t.g) node.children = [{ id: "band_" + i, mesh: "band", material: "g_" + t.g,
    tags: ["band"], transform: { pos: [0, 0.08, -0.75] } }];
  nodes.push(node);
});

const tokenMesh = ["slim", "broad", "tall", "shorty"];
for (let s = 1; s <= PLAYERS; s++) {
  nodes.push({ id: "token_p" + s, mesh: tokenMesh[s - 1], material: "p" + s,
    tags: ["token"], footLock: true,
    transform: { pos: [11 + (s % 2) * 0.6 - 0.3, 0.2, 11 + (s > 2 ? 0.6 : 0) - 0.3], rot: [0, 180, 0] } });
}

// ---- the phase-machine behavior tree on a controller node ------------------
const bt = { selector: [] };

// SETUP: runs once. The engine ignores top-level scene.alarms (only node
// alarms are registered), so seeding has to live in the tree itself.
bt.selector.push((function () {
  const acts = [cond("world.flags.setup == 0")];
  for (let s = 1; s <= PLAYERS; s++) {
    acts.push(act("setSeatStat", [s, "cash", 1500]));
    acts.push(act("setSeatStat", [s, "alive", 1]));
    if (AI.AGGR[s] != null) acts.push(act("setSeatStat", [s, "aggr", AI.AGGR[s]]));
  }
  acts.push(act("shuffleDeck", ["fate"]));
  acts.push(act("shuffleDeck", ["cards"]));
  acts.push(act("setState", ["setup", 1]));
  return seq.apply(null, acts);
})());


// PHASE 0: offer the roll exactly once, then roll + move on the answer.
bt.selector.push(seq(
  cond("world.flags.phase == 0"),
  sel(
    seq(cond("world.flags.asked == 0"),
        act("setState", ["asked", 1]),
        act("prompt", ["go", "Your turn. Tap to roll the fate deck.", "Roll"])),
    seq(cond("world.flags.go >= 0"),
        act("drawCard", ["fate"]),
        act("playSound", ["dice"]),
        // remember where we were, land at (pos + steps) mod 40
        act("setFlagExpr", ["sum", "world.flags.pos + lastCard('fate') + 2"]),
        act("setFlagExpr", ["pos", "mod(world.flags.sum, 40)"]),
        act("setState", ["asked", 0]),
        act("setState", ["go", -1]),
        act("setState", ["phase", 1]))
  )
));

// PHASE 1: pass-Depot pay, park the token, resolve the tile by kind.
const resolve = sel();
// pass depot
const phase1 = seq(
  cond("world.flags.phase == 1"),
  sel(seq(cond("world.flags.sum >= 40"),
          act("addSeatStat", ["current", "cash"], 200),
          act("playSound", ["depot"])),
      cond("1 == 1")),
  resolve
);
bt.selector.push(phase1);

// token teleports: per seat x per tile (static args are the rule)
for (let s = 1; s <= PLAYERS; s++) {
  for (let i = 0; i < N; i++) {
    const p = tilePos(i);
    resolve.selector.push(seq(
      cond("seat() == " + s + " && world.flags.pos == " + i + " && world.flags.moved == 0"),
      act("teleport", [p[0], 0.2, p[2] + (s * 0.35 - 0.9)]),
      Object.assign(act("teleport", [p[0], 0.2, p[2] + (s * 0.35 - 0.9)]), {}),
      act("setState", ["moved", 1])
    ));
  }
}
// fix: teleport needs a target — patch the fragments above
resolve.selector.forEach((br) => {
  if (br.sequence) br.sequence.forEach((leaf) => {
    if (leaf.do && leaf.do.action === "teleport") {
      const m = /seat\(\) == (\d+)/.exec(br.sequence[0].cond);
      leaf.do.to = "token_p" + m[1];
    }
  });
});

// tile-kind resolution (fires after moved == 1)
T.forEach((t, i) => {
  const at = "world.flags.pos == " + i + " && world.flags.moved == 1";
  if (t.k === "prop" || t.k === "transit" || t.k === "utility") {
    // --- v13 bots: seats 2..N decide for themselves, no prompt ---
    const _mates = t.g
      ? T.map((x, xi) => (x.g === t.g && xi !== i) ? xi : -1).filter(x => x >= 0)
      : [];
    const _eff = "seatStat(seat(),'aggr')"
      + (_mates.length
          ? " - " + AI.MATE_PULL + " * (" +
            _mates.map(m => "(ownerOf('t" + m + "') == seat())").join(" + ") + ")"
          : "")
      + " + " + AI.WOBBLE + " * rand()";
    resolve.selector.push(seq(
      cond(at + " && ownerOf('t" + i + "') == 0 && seat() != 1"
           + " && world.flags.turn < " + AI.TURN_STOP
           + " && seatStat(seat(),'cash') >= " + t.p + " * (" + _eff + ")"),
      act("setState", ["buy_tile", i]),
      act("setState", ["buy", 0]),
      act("setState", ["phase", 2])
    ));
    resolve.selector.push(seq(
      cond(at + " && ownerOf('t" + i + "') == 0 && seat() != 1"),
      act("setState", ["phase", 3])
    ));
    // unowned -> ask to buy (phase 2)
    resolve.selector.push(seq(
      cond(at + " && ownerOf('t" + i + "') == 0 && seatStat(seat(),'cash') >= " + t.p + " && seat() == 1"),
      act("prompt", ["buy", t.n + " is unowned. Buy for " + t.p + "?", "Buy (" + t.p + ")", "Pass"]),
      act("setState", ["buy_tile", i]),
      act("setState", ["phase", 2])
    ));
    resolve.selector.push(seq(
      cond(at + " && ownerOf('t" + i + "') == 0"),
      act("setState", ["phase", 3])
    ));
    // owned by a rival -> rent, enumerated per possible owner
    for (let s = 1; s <= PLAYERS; s++) {
      resolve.selector.push(seq(
        cond(at + " && ownerOf('t" + i + "') == " + s + " && seat() != " + s),
        act("addSeatStat", ["current", "cash"], -t.r),
        act("addSeatStat", [s, "cash"], t.r),
        act("playSound", ["rent"]),
        act("setState", ["phase", 3])
      ));
    }
    // your own tile
    resolve.selector.push(seq(cond(at), act("setState", ["phase", 3])));
  } else if (t.k === "levy") {
    resolve.selector.push(seq(cond(at),
      act("addSeatStat", ["current", "cash"], -t.fee),
      act("playSound", ["rent"]),
      act("setState", ["phase", 3])));
  } else if (t.k === "fate" || t.k === "grant") {
    // draw from the shared card deck; effects keyed off lastCard('cards')
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
            act("setState", ["pos", 10]), act("setState", ["moved", 0]),
            act("addSeatStat", ["current", "cash"], -50), act("playSound", ["jail"])),
        seq(cond("lastCard('cards') == 6"), act("addSeatStat", ["current", "cash"], 45)),
        seq(cond("lastCard('cards') == 7"), act("addSeatStat", ["current", "cash"], -25))
      ),
      act("setState", ["phase", 3])));
  } else if (t.k === "toJail") {
    resolve.selector.push(seq(cond(at),
      act("setState", ["pos", 10]), act("setState", ["moved", 0]),
      act("addSeatStat", ["current", "cash"], -50),
      act("playSound", ["jail"]),
      act("setState", ["phase", 3])));
  } else {
    resolve.selector.push(seq(cond(at), act("setState", ["phase", 3])));
  }
});

// PHASE 2: the buy answer — claim per tile (static key), enumerated.
const phase2 = seq(cond("world.flags.phase == 2 && world.flags.buy >= 0"), sel());
T.forEach((t, i) => {
  if (!(t.k === "prop" || t.k === "transit" || t.k === "utility")) return;
  phase2.sequence[1].selector.push(seq(
    cond("world.flags.buy_tile == " + i + " && world.flags.buy == 0"),
    act("claim", ["t" + i]),
    act("addSeatStat", ["current", "cash"], -t.p),
    act("playSound", ["buy"]),
    act("playPose", ["cheer"]),
    act("setState", ["buy", -1]),
    act("setState", ["phase", 3])
  ));
});
phase2.sequence[1].selector.forEach((br) => {
  br.sequence.forEach((leaf) => {
    if (leaf.do && leaf.do.action === "playPose") {
      leaf.do.to = "token_p1"; // cheer target patched per turn is not expressible; cosmetic only
    }
  });
});
phase2.sequence[1].selector.push(seq(
  cond("world.flags.buy == 1"),
  act("setState", ["buy", -1]),
  act("setState", ["phase", 3])
));
bt.selector.push(phase2);

// PHASE 3: bankruptcy, victory, next seat, back to phase 0.
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
bt.selector.push(p3);

// ---- assemble the descriptor -----------------------------------------------
const scene = {
  kind: "kv_game_v1",
  engine: "scene",
  meta: { id: "kascity_v2", name: "KasCity", seed: "kc2", players: PLAYERS, category: "board" },
  debug: false,
  permissions: ["identity", "persist", "stats"],
  compliance: { maxNodes: 512 },
  input: { scheme: "tap" },
  world: { score: 0, flags: { setup: 0, phase: 0, asked: 0, pos: 0, sum: 0, moved: 1,
                              go: -1, buy: -1, buy_tile: -1, seat: 1, turn: 0 } },
  tables: { decks: { fate: 11, cards: 8 } },
  nodes: nodes.concat([{ id: "director", type: "Actor", tags: ["director"],
    transform: { pos: [0, 0, 0] }, bt: bt }]),
  resources: {
    meshes: {
      ground: { type: "box", size: [40, 0.5, 40] },
      board: { type: "box", size: [24.2, 0.12, 24.2] },
      tileM: { type: "box", size: [2.06, 0.1, 2.06] },
      corner: { type: "box", size: [2.16, 0.14, 2.16] },
      band: { type: "box", size: [2.06, 0.06, 0.57] },
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
      depot: { type: "tone", wave: "sine", freq: 784, sweep: 120, dur: 0.26, vol: 0.3 },
      jail: { type: "tone", wave: "square", freq: 150, sweep: -70, dur: 0.42, vol: 0.34 },
      bust: { type: "tone", wave: "sawtooth", freq: 400, sweep: -330, dur: 0.75, vol: 0.38 },
      win: { layers: [
        { type: "tone", wave: "sine", freq: 523, dur: 0.3, vol: 0.32 },
        { type: "tone", wave: "sine", freq: 784, dur: 0.42, vol: 0.3 } ] }
    }
  },
  // seats start alive with 1500 — seeded by first-turn setup branch
  alarms: [{ id: "boot", at: 0.1, actions: [
    { action: "setSeatStat", args: [1, "cash", 1500] }, { action: "setSeatStat", args: [1, "alive", 1] },
    { action: "setSeatStat", args: [2, "cash", 1500] }, { action: "setSeatStat", args: [2, "alive", 1] },
    { action: "setSeatStat", args: [3, "cash", 1500] }, { action: "setSeatStat", args: [3, "alive", 1] },
    { action: "setSeatStat", args: [4, "cash", 1500] }, { action: "setSeatStat", args: [4, "alive", 1] },
    { action: "shuffleDeck", args: ["fate"] }, { action: "shuffleDeck", args: ["cards"] }
  ] }]
};

// ---- emit -------------------------------------------------------------------
// ---- v13 AI: personality stats + sell-when-broke ---------------------------
(function injectAI() {
  const boot = scene.alarms.find(a => a && a.id === "boot");
  if (!boot) throw new Error("boot alarm missing");
  Object.keys(AI.AGGR).forEach(s =>
    boot.actions.push({ action: "setSeatStat", args: [+s, "aggr", AI.AGGR[s]] }));

  const p3 = bt.selector.find(b =>
    b.sequence && b.sequence[0] && b.sequence[0].cond === "world.flags.phase == 3");
  if (!p3) throw new Error("phase 3 block missing");
  const sel = p3.sequence.filter(x => Array.isArray(x.selector)).pop();
  if (!sel) throw new Error("phase 3 selector missing");

  // broke bots liquidate: first owned tile in board order, refunded at SELL_PCT
  const sells = [];
  T.forEach((t, i) => {
    if (t.k !== "prop" && t.k !== "transit" && t.k !== "utility") return;
    sells.push(seq(
      cond("seat() != 1 && seatStat(seat(),'cash') < " + AI.SELL_FLOOR
           + " && ownerOf('t" + i + "') == seat()"),
      act("release", ["t" + i]),
      act("addSeatStat", ["current", "cash"], Math.round(t.p * AI.SELL_PCT)),
      act("playSound", ["buy"])
    ));
  });
  sel.selector.unshift.apply(sel.selector, sells);
  console.log("OK v13 AI: " + sells.length + " sell branches, aggr on seats "
    + Object.keys(AI.AGGR).join(","));
})();
const json = JSON.stringify(scene);
fs.writeFileSync("kascity_v2.json", json);
console.log("OK kascity_v2.json (" + (json.length / 1024).toFixed(1) + " KB, " +
  JSON.stringify(bt).length + " bytes of BT)");

// showcase: inject into a copy of the engine so the smoke harness runs it
const engine = fs.readFileSync("scene_engine.html", "utf8");
const q = '"';
const inject = [
  "", "// ---- injected kascity showcase ----",
  "try { loadScene(" + JSON.stringify(json) + "); }",
  "catch (e) { console.error('kascity boot: ' + (e && e.message)); }", ""
].join("\n");
fs.writeFileSync("showcase_kascity.html",
  engine.replace("</script>", inject + "\n</script>"));
console.log("OK showcase_kascity.html");
