const s = require("fs").readFileSync("showcase_kascity220.html", "utf8").replace(/\r/g, "");
for (const pat of ["DEDUP", "\"roll\"", "'roll'"]) {
  let j = s.indexOf(pat), n = 0;
  while (j >= 0 && n < 10) {
    const ctx = s.slice(Math.max(0, j - 300), j + 400).replace(/\n/g, " ");
    if (/KV_MOVE|move\(|rec=|record/i.test(ctx)) {
      console.log("=== " + pat + " @" + j + " ===");
      console.log(ctx); n++;
    }
    j = s.indexOf(pat, j + 1);
  }
}
