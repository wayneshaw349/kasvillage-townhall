const fs = require("fs");
const P = "EntertainmentCenter.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("stakeKas: 0, // installed")) { console.log("already fixed"); process.exit(0); }
const a = "          category: 'On-Chain',\n          board: 'Main',\n          description: 'Downloaded from Kaspa \u2014 hash-verified',\n          url: '',";
const b = "          category: 'On-Chain',\n          board: 'Main',\n          url: '',\n          stakeKas: 0, // installed locally; no stake concept\n          lockStart: '', lockEnd: '',\n          trustScore: 0,\n          ownerApt: '',\n          verified: true,\n          price: 0,";
const f = s.split(a).length - 1;
if (f !== 1) { console.error("ABORT: anchor found " + f + " times"); process.exit(1); }
s = s.split(a).join(b);
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("chain-game cards now carry full DApp fields");
