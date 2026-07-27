const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
s.forEach((l,n)=>{ if(/Paste Kill Tx|JSON\.parse\(.*kill|_killPaste|killTx.*parse|txBody/i.test(l)) console.log((n+1)+': ['+l.trim().slice(0,130)+']'); });
