const fs = require("fs");
const P = "Workspace.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (!s.includes("require('@noble/hashes/utils')")) { console.log("already fixed"); process.exit(0); }
const a = "      const { sha256 } = require('@noble/hashes/sha256');\n      const { bytesToHex, utf8ToBytes } = require('@noble/hashes/utils');\n      const manifestHash = bytesToHex(sha256(utf8ToBytes(JSON.stringify(m))));";
const b = "      const _u8 = (t: string) => { const s2 = unescape(encodeURIComponent(t)); const a = new Uint8Array(s2.length); for (let i = 0; i < s2.length; i++) a[i] = s2.charCodeAt(i); return a; };\n      const manifestHash = bytesToHex(sha256(_u8(JSON.stringify(m))));";
const f = s.split(a).length - 1;
if (f !== 1) { console.error("ABORT: anchor found " + f + " times"); process.exit(1); }
s = s.split(a).join(b);
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("manifestHash now uses top-level noble imports");
