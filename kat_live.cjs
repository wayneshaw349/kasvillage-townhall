const fs = require("fs");
let src = fs.readFileSync("bip39_wallet.ts", "utf8");

const start = src.indexOf("const SHA512_K");
if (start === -1) { console.error("SHA512_K not found"); process.exit(1); }
const pstart = src.indexOf("function pbkdf2HmacSha512");
if (pstart === -1) { console.error("pbkdf2HmacSha512 not found"); process.exit(1); }
let depth = 0, i = src.indexOf("{", pstart), end = -1;
for (; i < src.length; i++) {
  if (src[i] === "{") depth++;
  else if (src[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
}
if (end === -1) { console.error("end not found"); process.exit(1); }
let code = src.slice(start, end);

// Robust TS annotation stripping for this file's patterns
code = code
  .replace(/\): Promise<[^>]+>/g, ")")        // ): Promise<Uint8Array>
  .replace(/: Promise<[^>]+>/g, "")
  .replace(/: bigint\[\]/g, "")
  .replace(/: bigint/g, "")
  .replace(/: Uint8Array\[\]/g, "")
  .replace(/: Uint8Array/g, "")
  .replace(/: number\[\]/g, "")
  .replace(/: number/g, "")
  .replace(/: string\[\]/g, "")
  .replace(/: string/g, "")
  .replace(/: boolean/g, "")
  .replace(/\bexport /g, "")
  .replace(/\basync function/g, "function")   // drop async (no awaits in pure fns)
  .replace(/\bawait /g, "");

try { eval(code); } catch (e) {
  // If eval still fails, print the offending region for diagnosis
  const m = String(e.stack || e).match(/<anonymous_script>:(\d+)/);
  console.error("EVAL FAILED:", String(e.message));
  if (m) {
    const ln = parseInt(m[1], 10);
    const cl = code.split("\n");
    for (let j = Math.max(0, ln - 4); j < Math.min(cl.length, ln + 3); j++)
      console.error((j + 1) + ": " + cl[j]);
  }
  process.exit(1);
}

const enc = s => new TextEncoder().encode(s);
const toHex = b => Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("");
const mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const expected = "5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4";
const seed = pbkdf2HmacSha512(enc(mnemonic.normalize("NFKD")), enc("mnemonic".normalize("NFKD")), 2048, 64);
const got = toHex(seed);
console.log("your impl:", got);
console.log("expected: ", expected);
console.log("MATCH:", got === expected ? "YES — hand-rolled stack is BIP39-correct" : "NO — MISMATCH");

const crypto = require("crypto");
let ok = true;
for (let t = 0; t < 5; t++) {
  const data = crypto.randomBytes(50 + t * 37);
  const ours = toHex(sha512(new Uint8Array(data)));
  const ref = crypto.createHash("sha512").update(data).digest("hex");
  if (ours !== ref) { ok = false; console.log("sha512 mismatch", t); }
}
console.log("sha512 random KATs:", ok ? "all pass" : "FAILED");
