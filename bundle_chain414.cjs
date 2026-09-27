// bundle_chain414.cjs — packs chain414/ into one chain414_bundle.json for the
// PublishGameScreen (metro can require a single JSON; 68 loose files it can't).
// Run from the layer1 root AFTER make_chain414.cjs:
//   node src\bundle_chain414.cjs
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const DIR = "chain414";
const sha = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex");
const manifest = JSON.parse(fs.readFileSync(path.join(DIR, "manifest.json"), "utf8"));
const frags = [];
let prev = "0".repeat(64);
for (const fr of manifest.frags) {
  const body = JSON.parse(fs.readFileSync(path.join(DIR, "frag_" + String(fr.i).padStart(3, "0") + ".json"), "utf8"));
  if (sha(body.text) !== fr.h || body.prev !== prev || sha(prev + body.h) !== fr.link) {
    console.error("ABORT: chain broken at fragment " + fr.i); process.exit(1);
  }
  prev = fr.link; frags.push(body);
}
if (prev !== manifest.head) { console.error("ABORT: HEAD mismatch"); process.exit(1); }
fs.writeFileSync("chain414_bundle.json", JSON.stringify({ manifest, frags }));
const kb = Math.round(fs.statSync("chain414_bundle.json").size / 1024);
console.log("wrote chain414_bundle.json  (" + frags.length + " fragments, " + kb + " KB, HEAD " + manifest.head.slice(0, 12) + "…)");
