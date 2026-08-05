const fs = require("fs");
let src = fs.readFileSync("bip39_wallet.ts", "utf8");
const start = src.indexOf("const SHA512_K");
const pstart = src.indexOf("function pbkdf2HmacSha512");
let depth = 0, i = src.indexOf("{", pstart), end = -1;
for (; i < src.length; i++) {
  if (src[i] === "{") depth++;
  else if (src[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
}
const snippet = src.slice(start, end).replace(/\bexport /g, "");
fs.writeFileSync("_kat_snippet.ts", snippet + "\nmodule.exports = { sha512, hmacSha512, pbkdf2HmacSha512 };\n");
console.log("snippet written");
