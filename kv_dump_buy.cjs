const s = require("fs").readFileSync("showcase_kascity220.html", "utf8").replace(/\r/g, "");
let n = 0;
for (const pat of ['KV_MOVE(', "KV_MOVE("]) {
  let j = s.indexOf(pat);
  while (j >= 0 && n < 40) {
    const ctx = s.slice(Math.max(0, j - 220), j + 220).replace(/\n/g, " ");
    if (/buy|pass/.test(ctx)) { console.log("--- @" + j); console.log(ctx); n++; }
    j = s.indexOf(pat, j + 1);
  }
  break;
}
