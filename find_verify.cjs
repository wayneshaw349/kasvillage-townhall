const fs = require("fs");
for (const f of fs.readdirSync(".").filter(f => /\.(ts|tsx)$/.test(f))) {
  const s = fs.readFileSync(f, "utf8").split(/\r?\n/);
  s.forEach((l,i)=>{ if(/Invalid proposal|kv1:|Verify Proposal|verifyProposal|decodeProposal|handleVerifyProposal|Receive IOU|handleReceiveIOU/.test(l)) console.log(f+":"+(i+1)+": "+l.trim().slice(0,120)); });
}
