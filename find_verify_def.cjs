const fs=require('fs');
try{const s=fs.readFileSync('kv_proposal.ts','utf8').split(/\r?\n/);
s.forEach((l,n)=>{ if(/export.*verifyProposalForMe|export.*parseProposal|function verifyProposalForMe|valid\s*[:=]|\.valid/.test(l)) console.log((n+1)+': '+l.trim()); });
}catch(e){console.log('kv_proposal.ts not found:',e.message);}
