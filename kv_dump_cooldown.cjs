const s = require("fs").readFileSync("showcase_kascity230.html", "utf8").replace(/\r/g, "");
let n = 0;
for (const pat of ["cooldown", "recently", "already asked", "spacing", "resale", "resell", "flip"]) {
  let j = s.toLowerCase().indexOf(pat);
  while (j >= 0 && n < 25) {
    console.log("=== " + pat + " @" + j + " ===");
    console.log(s.slice(Math.max(0, j - 350), j + 350).replace(/\n/g, " "));
    j = s.toLowerCase().indexOf(pat, j + 1); n++;
  }
}
