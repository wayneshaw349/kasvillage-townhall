const s = require("fs").readFileSync("showcase_kascity219.html", "utf8").replace(/\r/g, "");
let j = s.indexOf("__KV_UNLOCK"), n = 0;
while (j >= 0 && n < 8) {
  console.log("=== @" + j + " ===");
  console.log(s.slice(Math.max(0, j - 700), j + 500));
  j = s.indexOf("__KV_UNLOCK", j + 1); n++;
}
// also the v199 marker
j = s.indexOf("__KV_V199"); n = 0;
while (j >= 0 && n < 6) {
  console.log("=== V199 @" + j + " ===");
  console.log(s.slice(Math.max(0, j - 600), j + 800));
  j = s.indexOf("__KV_V199", j + 1); n++;
}
