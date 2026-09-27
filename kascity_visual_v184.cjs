// kascity_visual_v184.cjs — fix the v183 gun rejection
// The relay stores moves keyed by u64 index (serde v.as_u64()), so the gun published at
// i:-1 was rejected with 400 by every node ("no relay node accepted .../move").
// Fix: publish the gun at sentinel index 4000000000 (well past any real move index and
// below the u64 ceiling), and skip that index when merging so it never enters the record.
const fs = require("fs");
const SRC = "showcase_kascity183.html";
const DST = "showcase_kascity184.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V184") !== -1) { console.error("ABORT: v184 already applied."); process.exit(1); }

const A1 = `      i:-1, s:0, a:"gun", v:startDaa, t:0,`;
const A2 = `          var m=by[i];
          if(m && m.a==="gun"){ M.armGun(Number(m.v), m.seed||null, m.players||M.roster.length); return; }  // __KV_V183`;

for (const [n, a] of [["A1", A1], ["A2", A2]]) {
  const c = s.split(a).length - 1;
  if (c !== 1) { console.error("ABORT: anchor " + n + " count " + c + " (expected 1). File untouched."); process.exit(1); }
}

s = s.replace(A1, `      i:4000000000, s:0, a:"gun", v:startDaa, t:0,   /* __KV_V184: u64 sentinel, not -1 */`);

s = s.replace(A2,
`          var m=by[i];
          // __KV_V184: the gun rides at a sentinel index and never joins the move record
          if(i===4000000000 || (m && m.a==="gun")){
            if(m) M.armGun(Number(m.v), m.seed||null, m.players||M.roster.length);
            return;
          }`);

fs.writeFileSync(DST, s);
console.log("PASS anchors 2/2 — gun moved to u64 sentinel index, excluded from the record");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
