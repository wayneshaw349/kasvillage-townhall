const s = require("fs").readFileSync("showcase_kascity217.html", "utf8").replace(/\r/g, "");
for (const pat of ["stored", "tail", "fanPost(\"/api/game/room/\"+M.room+\"/move\"", "outbound tails"]) {
  let j = s.indexOf(pat), n = 0;
  while (j >= 0 && n < 8) {
    console.log("=== " + pat + " @" + j + " ===");
    console.log(s.slice(Math.max(0, j - 500), j + 700));
    j = s.indexOf(pat, j + 1); n++;
  }
}
