const fs = require("fs");
const P = "Workspace.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("addresses: slotAddresses }))")) { console.log("already fixed"); process.exit(0); }
const a = "      const manifestHash = bytesToHex(sha256(_u8(JSON.stringify(m))));";
const b = "      const manifestHash = bytesToHex(sha256(_u8(JSON.stringify({ ...m, addresses: slotAddresses }))));";
const f = s.split(a).length - 1;
if (f !== 1) { console.error("ABORT: anchor found " + f + " times"); process.exit(1); }
s = s.split(a).join(b);
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("manifestHash now hashes the published config (addresses filled)");
