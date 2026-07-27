const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
s.forEach((l,n)=>{ if(/setInbox|setProposals|useState.*[Pp]roposal|inbox\.map|proposals\.map|Inbox: /.test(l)) console.log((n+1)+': '+l.trim()); });
