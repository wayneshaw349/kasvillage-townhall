const s = require("fs").readFileSync("IOUBalanceSheetShare.tsx","utf8").split(/\r?\n/);
console.log("=== computeIOUHash ===");
let i = s.findIndex(l => l.includes("function computeIOUHash"));
for (let j=i; j<i+18; j++) console.log((j+1)+": "+JSON.stringify(s[j]?.slice(0,160)));
console.log("=== SignedIOU interface ===");
i = s.findIndex(l => /interface SignedIOU/.test(l));
for (let j=i; j<i+22; j++) console.log((j+1)+": "+JSON.stringify(s[j]?.slice(0,120)));
console.log("=== createIOU: what gets encoded/shared (find kv1 or share) ===");
s.forEach((l,k)=>{ if(/createIOU|export async function createIOU|const blob|kv1:|shareIOU|type: 'iou'|encodeIOU/.test(l)) console.log((k+1)+": "+l.trim().slice(0,150)); });
