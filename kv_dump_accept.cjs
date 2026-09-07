const s = require("fs").readFileSync("showcase_kascity221.html", "utf8").replace(/\r/g, "");
for (const pat of ["NOT EXECUTED", "ACCEPT DEBUG", "TRANSFER DID NOT LAND", "tr_state"]) {
  let j = s.indexOf(pat), n = 0;
  while (j >= 0 && n < 6) {
    console.log("=== " + pat + " @" + j + " ===");
    console.log(s.slice(Math.max(0, j - 900), j + 700));
    j = s.indexOf(pat, j + 1); n++;
  }
}
