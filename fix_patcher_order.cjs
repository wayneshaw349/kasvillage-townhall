const fs = require("fs");
const p = "src/patch_townhall_records.js";
let s = fs.readFileSync(p, "utf8");
function grab(name) {
  const start = s.indexOf('rep("' + name + '"');
  if (start < 0) return null;
  const end = s.indexOf(", 1);", start);
  if (end < 0) return null;
  return s.slice(start, end + ", 1);".length + 1); // include trailing newline
}
const sob = grab("store-on-broadcast");
const rst = grab("records-store");
if (!sob || !rst) { console.log("blocks not found"); process.exit(1); }
if (s.indexOf(sob) < s.indexOf(rst)) { console.log("already reordered"); process.exit(0); }
s = s.replace(sob, "");
s = s.replace(rst, sob + "\n" + rst);
fs.writeFileSync(p, s);
console.log("reordered: store-on-broadcast now runs before records-store");
