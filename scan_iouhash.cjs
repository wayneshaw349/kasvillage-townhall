const s = require("fs").readFileSync("IOUBalanceSheetShare.tsx","utf8").split(/\r?\n/);
console.log("=== hashIOU + signIOUSync + verifyIOUSignature ===");
for (const fn of ["function hashIOU","function signIOUSync","function verifyIOUSignature"]) {
  const i = s.findIndex(l => l.includes(fn));
  if (i>=0) { console.log("--- @"+(i+1)); for(let j=i;j<i+12;j++) console.log((j+1)+": "+JSON.stringify(s[j]?.slice(0,150))); }
}
console.log("=== Receive IOU onPress full (1615) ===");
const i = s.findIndex(l => l.includes("const d = decodeProposal(pasteInput.trim())"));
for (let j=i-1; j<i+22; j++) console.log((j+1)+": "+JSON.stringify(s[j]?.slice(0,175)));
