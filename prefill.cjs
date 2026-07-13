const fs=require('fs');let q=fs.readFileSync('QRPayNearby.tsx','utf8');
q=q.replace("if (parsed.requestAmountKAS > 0) setRequestedAmt(parsed.requestAmountKAS);","if (parsed.requestAmountKAS > 0) { setRequestedAmt(parsed.requestAmountKAS); setProposalAmount(String(parsed.requestAmountKAS)); }");
fs.writeFileSync('QRPayNearby.tsx',q);console.log('done');
