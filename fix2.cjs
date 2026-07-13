const fs=require('fs');let s=fs.readFileSync('IOUBalanceSheetShare.tsx','utf8');
// remove duplicate state (first patch's line)
s=s.replace("\n  const [pendingIOU, setPendingIOU] = useState<any>(null);","");
// shareProposal arg
s=s.replace("await shareProposal(p.encoded);","await shareProposal(p.encoded, parseFloat(proposalAmount)||0);");
// decode/verify types
s=s.replace("const d = decodeProposal(pasteInput.trim()); const v = await verifyProposal(d); setIncomingProposal(d); setProposalVerified(v);","const d = decodeProposal(pasteInput.trim()); if(!d) throw new Error('Invalid proposal'); const v = await verifyProposal(d); setIncomingProposal(d); setProposalVerified(v.valid);");
// shareAcceptance arg
s=s.replace("await shareAcceptance(a);","await shareAcceptance(a, parseFloat(incomingProposal?.amountKAS||incomingProposal?.amount||'0')||0);");
fs.writeFileSync('IOUBalanceSheetShare.tsx',s);
let q=fs.readFileSync('QRPayNearby.tsx','utf8');
q=q.replace("import { IOUBalanceSheetShare } from './IOUBalanceSheetShare';","import { IOUBalanceSheetModal as IOUBalanceSheetShare } from './IOUBalanceSheetShare';");
fs.writeFileSync('QRPayNearby.tsx',q);console.log('done');
