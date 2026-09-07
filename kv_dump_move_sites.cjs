const s = require("fs").readFileSync("showcase_kascity220.html", "utf8").replace(/\r/g, "");
let j = s.indexOf("KV_MOVE("), n = 0;
while (j >= 0 && n < 60) {
  console.log("--- @" + j);
  console.log(s.slice(Math.max(0, j - 160), j + 160).replace(/\n/g, " "));
  j = s.indexOf("KV_MOVE(", j + 1); n++;
}
