// patch309_remove_composer.cjs — the 295/296 chain-native composer is gone, not guarded.
// 307 renders turns from chain entries, so the composer is redundant; it was still generating rolls
// that no one asked for ("turn: PN rolls X (chain)") and leaving turns unclosed.
// This replaces its interval body with a no-op so nothing remains to misfire.
// SRC showcase_kascity308.html -> DST showcase_kascity309.html
const fs = require("fs");
const SRC = "showcase_kascity308.html";
const DST = "showcase_kascity309.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

// the composer announces itself; find its IIFE and neutralise the whole block
const MARK = '// ---- __KV_V295: chain-native turns ----';
if (s.split(MARK).length - 1 !== 1) {
  console.error("ABORT — composer marker not found");
  process.exit(1);
}

const start = s.indexOf(MARK);
// the composer ends at its own closing line, which logs the arming message
const END = 'if (window.KV_LOG) window.KV_LOG("chain-native turns armed","#9cd87c");';
const endPos = s.indexOf(END, start);
if (endPos < 0) {
  console.error("ABORT — composer end not found");
  process.exit(1);
}
const endOfBlock = s.indexOf('})();', endPos);
if (endOfBlock < 0) {
  console.error("ABORT — composer IIFE close not found");
  process.exit(1);
}

const before = s.slice(0, start);
const after = s.slice(endOfBlock + '})();'.length);

const REPLACEMENT =
'// ---- __KV_V309: the chain composer has been removed ----\n' +
'// 307 renders turns from chain entries; composing them locally duplicated the engine\n' +
'// and left turns unclosed. Nothing replaces it: your own seat plays through the engine,\n' +
'// every other seat is rendered from the chain.\n' +
'(function(){\n' +
'  if (window.KV_LOG) window.KV_LOG("chain composer removed \\u2014 the chain renders turns","#7a6a58");\n' +
'})();';

s = before + REPLACEMENT + after;

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
