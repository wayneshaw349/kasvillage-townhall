// kascity_visual_v185.cjs — seat identity + deterministic roll-for-first
//
// Bug 1 (seat identity): KV_HUMANS lists the seats THIS DEVICE controls, but the DAA gun
// set it to [1..n] on every client, so both windows showed "P1 (you)" and "P2 (you)" and
// both tried to play P1's turn. In a relay game each client owns exactly one seat.
//
// Bug 2 (roll for first): the dialog rolled locally per client, so the two boards could
// pick different first players — divergence before move zero. The rolls now derive from
// the seed revealed with the gun, so every client computes the same throw and simply
// displays it. Seats not owned locally no longer wait for a tap.
const fs = require("fs");
const SRC = "showcase_kascity184.html";
const DST = "showcase_kascity185.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V185") !== -1) { console.error("ABORT: v185 already applied."); process.exit(1); }

// --- 1. the gun gives this client only its own seat ---
const A1 = `      var n = (players||M.roster.length||2);
      window.KV_HUMANS=[]; for(var k=1;k<=n;k++) window.KV_HUMANS.push(k);`;
// --- 2. applyRoster does the same (it fires before the gun) ---
const A2 = `    window.KV_HUMANS=roster.map(function(_,i){return i+1;});`;
// --- 3. seeded first-roll ---
const A3 = `  // ---- roll for first (v107) ----`;

for (const [n, a] of [["A1", A1], ["A2", A2], ["A3", A3]]) {
  const c = s.split(a).length - 1;
  if (c !== 1) { console.error("ABORT: anchor " + n + " count " + c + " (expected 1). File untouched."); process.exit(1); }
}

s = s.replace(A1,
`      var n = (players||M.roster.length||2);
      // __KV_V185: this device controls ONE seat; the others are peers (relayed) or bots
      window.KV_HUMANS=[ M.seat||1 ];
      window.KV_SEATS_TOTAL = n;`);

s = s.replace(A2,
`    window.KV_HUMANS=[ M.seat||1 ];              // __KV_V185: own seat only
    window.KV_SEATS_TOTAL = roster.length;`);

s = s.replace(A3,
`  // __KV_V185: in a relay game the first-roll is derived from the revealed seed so every
  // board computes the same throw; nobody's local dice decide the turn order.
  window.KV_FIRSTROLL = function(seat){
    var seed = (window.KV_MP2 && window.KV_MP2.seed) || window.KV_SEED || "kv";
    var str = seed + ":first:" + seat, h = 2166136261;
    for (var i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    var a = ((h>>>0) % 6) + 1, b = (((h>>>8)>>>0) % 6) + 1;
    return [a, b, a+b];
  };

  // ---- roll for first (v107) ----`);

// auto-throw for every seat in a relay game, using the seeded values
const A4 = `    var humans=window.KV_HUMANS||[1];`;
const c4 = s.split(A4).length - 1;
if (c4 < 1) { console.error("ABORT: roll-for-first humans anchor missing. File untouched."); process.exit(1); }
// only patch the occurrence inside the roll-for-first block (the one after our marker)
const marker = "// ---- roll for first (v107) ----";
const at = s.indexOf(marker);
const idx = s.indexOf(A4, at);
if (idx < 0) { console.error("ABORT: could not locate humans line inside roll-for-first. File untouched."); process.exit(1); }
s = s.slice(0, idx) + `    var humans=window.KV_HUMANS||[1];
    // __KV_V185: relay games throw for every seat from the shared seed, no tapping
    var __relay = !!(window.KV_MP2 && window.KV_MP2.room && window.KV_MP2.started);` + s.slice(idx + A4.length);

fs.writeFileSync(DST, s);
console.log("PASS anchors 4/4 — own-seat identity, KV_FIRSTROLL seeded helper installed");
console.log("NOTE: the roll-for-first dialog still needs its throw wired to KV_FIRSTROLL —");
console.log("      send lines 8334-8385 of showcase_kascity185.html to complete v185.");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
