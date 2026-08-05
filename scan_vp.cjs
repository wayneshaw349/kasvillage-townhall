const s = require("fs").readFileSync("proposal_share.ts","utf8").split(/\r?\n/);
console.log("=== decodeProposal 236-260 ===");
for (let j=235; j<262; j++) console.log((j+1)+": "+JSON.stringify(s[j]?.slice(0,150)));
console.log("=== verifyProposal 254-295 ===");
for (let j=253; j<296; j++) console.log((j+1)+": "+JSON.stringify(s[j]?.slice(0,150)));
