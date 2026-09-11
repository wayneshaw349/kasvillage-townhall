// patch303_relay2_firsts.cjs — KV_RELAY2 never published the opening roll-off, so there were no
// "first" entries, no derived opener, and therefore no actor: the game could not begin.
// Each client now posts a first for every seat it owns, once, after the roster is known. The
// values come from the relay's derive oracle so every board agrees without trusting anyone.
// SRC showcase_kascity302.html -> DST showcase_kascity303.html
const fs = require("fs");
const SRC = "showcase_kascity302.html";
const DST = "showcase_kascity303.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

const A = '  R.applyRoster = function () {';
const c = s.split(A).length - 1;
if (c !== 1) {
  console.error("ABORT — anchor found " + c + " times (expected 1)");
  process.exit(1);
}

s = s.replace(A,
'  // ------------------------------------------------------------- opening --\n' +
'  // Every client posts a "first" for each seat it owns. Values come from the relay derive\n' +
'  // oracle (tag "first"), so all boards see the same roll-off and derive the same opener.\n' +
'  R.postedFirsts = false;\n' +
'  R.postFirsts = async function () {\n' +
'    if (R.postedFirsts || !R.started || !R.room) return;\n' +
'    R.postedFirsts = true;\n' +
'    var seats = [];\n' +
'    for (var p = 1; p <= R.SEATS; p++) if (R.owns(p)) seats.push(p);\n' +
'    for (var i = 0; i < seats.length; i++) {\n' +
'      var seat = seats[i];\n' +
'      var v = null;\n' +
'      var o = await jget(api("/derive?tag=first&i=" + seat));\n' +
'      if (o && o.u32s && o.u32s.length) v = 2 + (o.u32s[0] % 11);      // 2..12\n' +
'      if (v == null) v = 2 + Math.floor(Math.random() * 11);\n' +
'      await R.post(seat, "first", v);\n' +
'      log("P" + seat + " opening roll " + v, "#caa64c");\n' +
'    }\n' +
'  };\n\n' + A);

// kick it off once the roster lands, and again from the tick until it takes
const B = '    log("you are P" + R.seat + " of " + R.roster.length, "#caa64c");\n  };';
if (s.split(B).length - 1 === 1) {
  s = s.replace(B,
'    log("you are P" + R.seat + " of " + R.roster.length, "#caa64c");\n' +
'    setTimeout(function () { R.postFirsts(); }, 800);\n' +
'  };');
}

// safety: if firsts are still missing after the gun, post them from the tick
const C = '        if (R.left() <= 0) { R.finish(false); return; }\n        R.act();';
if (s.split(C).length - 1 === 1) {
  s = s.replace(C,
'        if (R.left() <= 0) { R.finish(false); return; }\n' +
'        if (!R.postedFirsts) { R.postFirsts(); return; }\n' +
'        R.act();');
}

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
