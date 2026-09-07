// kascity_visual_v210.cjs — commit snapshots are captured at record time, not hash time
// move() captures snapshot() synchronously when the record is created (rec.snap); the
// chain hashes that captured string, so both boards hash the same logical instant.
const fs = require("fs");
const SRC = "showcase_kascity209.html";
const DST = "showcase_kascity210.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V210") !== -1) { console.error("ABORT: v210 already applied."); process.exit(1); }

const A1 = `      var rec={i:__idx, s:seat, a:action, v:arg, t:left};`;
const A2 = `            rec.hash = await window.KV_COMMIT.add(rec.i, rec.s, rec.a, rec.v);`;
const A3 = `window.KV_COMMIT = {`;
const A4 = `  async function commitMove(index, seat, action, value){
    var body = [chain, index, seat, action, value, snapshot()].join("~");`;
for (const [k, a] of [["A1", A1], ["A2", A2], ["A3", A3], ["A4", A4]]) {
  const c = s.split(a).length - 1;
  if (c !== 1) { console.error("ABORT: anchor " + k + " count " + c + " (expected 1). File untouched."); process.exit(1); }
}

// commitMove accepts optional captured snapshot
s = s.replace(A4,
`  async function commitMove(index, seat, action, value, __snap){   // __KV_V210
    var body = [chain, index, seat, action, value, (__snap != null ? __snap : snapshot())].join("~");`);

// expose snapshot globally
s = s.replace(A3, `window.KV_SNAPSHOT = snapshot;   // __KV_V210
  window.KV_COMMIT = {`);

// capture at record time
s = s.replace(A1,
`      var rec={i:__idx, s:seat, a:action, v:arg, t:left};
      try{ if(window.KV_SNAPSHOT) rec.snap = window.KV_SNAPSHOT(); }catch(e){}   // __KV_V210: state at record time`);

// pass it into the chain hash
s = s.replace(A2, `            rec.hash = await window.KV_COMMIT.add(rec.i, rec.s, rec.a, rec.v, rec.snap);   // __KV_V210`);

fs.writeFileSync(DST, s);
console.log("PASS anchors 4/4 — snapshots captured at record time; chain hashes the captured state");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
