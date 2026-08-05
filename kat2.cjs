const { sha512, hmacSha512, pbkdf2HmacSha512 } = require("./_kat_snippet.cjs");
const crypto = require("crypto");
const enc = s => new TextEncoder().encode(s);
const toHex = b => Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("");

console.log("sha512(''):", toHex(sha512(new Uint8Array(0))).slice(0,32), "| expect: cf83e1357eefb8bdf1542850d66d8007");

let ok = true;
for (let t = 0; t < 5; t++) {
  const data = crypto.randomBytes(50 + t * 37);
  if (toHex(sha512(new Uint8Array(data))) !== crypto.createHash("sha512").update(data).digest("hex")) ok = false;
}
console.log("sha512 random KATs:", ok ? "ALL PASS" : "FAILED");

const mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const expected = "5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4";
const got = toHex(pbkdf2HmacSha512(enc(mnemonic), enc("mnemonic"), 2048, 64));
console.log("BIP39 KAT:", got === expected ? "PASS — seeds are standard/portable" : "FAIL — seeds are NON-STANDARD");
if (got !== expected) console.log("got:", got);
