// patch309_remove_composer_v2.cjs — remove the 295/296 chain composer outright.
// Located by its banner comment and its arming log line, cut as a whole block.
// 307 renders turns from chain entries, so nothing replaces it.
// SRC showcase_kascity308.html -> DST showcase_kascity309.html
const fs = require("fs");
const SRC = "showcase_kascity308.html";
const DST = "showcase_kascity309.html";

let raw = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const lines = raw.split("\n");

// find the banner and the arming line (0-based indices)
let start = -1, armed = -1;
for (let i = 0; i < lines.length; i++) {
  if (start < 0 && lines[i].indexOf("__KV_V295: chain-native turns") >= 0) start = i;
  if (start >= 0 && lines[i].indexOf("chain-native turns armed") >= 0) { armed = i; break; }
}
if (start < 0 || armed < 0) {
  console.error("ABORT — composer block not located (start=" + start + ", armed=" + armed + ")");
  process.exit(1);
}

// the IIFE closes on the first "})();" at or after the arming line
let end = -1;
for (let i = armed; i < Math.min(lines.length, armed + 10); i++) {
  if (lines[i].indexOf("})();") >= 0) { end = i; break; }
}
if (end < 0) {
  console.error("ABORT — composer close not found after line " + (armed + 1));
  process.exit(1);
}

console.log("removing lines " + (start + 1) + "-" + (end + 1) + " (" + (end - start + 1) + " lines)");

const replacement = [
  "// ---- __KV_V309: the chain composer has been removed ----",
  "// 307 renders turns from chain entries. Composing them locally duplicated the engine and left",
  "// turns unclosed. Your own seat plays through the engine; every other seat is rendered.",
  "(function(){",
  '  if (window.KV_LOG) window.KV_LOG("chain composer removed \\u2014 the chain renders turns","#7a6a58");',
  "})();"
];

const out = lines.slice(0, start).concat(replacement, lines.slice(end + 1));
fs.writeFileSync(DST, out.join("\n").replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
