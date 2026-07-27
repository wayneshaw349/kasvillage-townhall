const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
s.forEach((l,n)=>{ if(/setStep\(5\)|setStep\(4\)|step === 5|step===5|step >= 5|Release Funds|buildReleaseTemplate|releaseMode|ReleaseMode|advancing to step 4/.test(l)) console.log((n+1)+': '+l.trim().slice(0,130)); });
