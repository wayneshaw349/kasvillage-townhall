const fs=require('fs');const F='NeighborAgreement.tsx';let s=fs.readFileSync(F,'utf8');const O=s;
let n=0;const fails=[];
function rep(A,B,t){const c=s.split(A).length-1;if(c!==1){fails.push(t+' count='+c);return;}s=s.split(A).join(B);n++;console.log('ok:',t);}
rep("if (manualVerCode.length !== 4) { Alert.alert('Verification', 'Enter the 4-character verification code'); return; }","if (manualVerCode.length !== 12) { Alert.alert('Verification', 'Enter the 12-character verification code'); return; }","gate-msg");
rep("disabled={!!acceptingId || manualVerCode.length !== 4}","disabled={!!acceptingId || manualVerCode.length !== 12}","disabled");
rep("{manualVerCode.length !== 4 ? 'Enter Code to Unlock' : 'Accept This Agreement'}","{manualVerCode.length !== 12 ? 'Enter Code to Unlock' : 'Accept This Agreement'}","btn-label");
rep("manualVerCode.length === 4 ? '#16a34a' : '#fbbf24'","manualVerCode.length === 12 ? '#16a34a' : '#fbbf24'","border");
if(fails.length){console.error('ABORT:');fails.forEach(f=>console.error(' -',f));process.exit(1);}
fs.writeFileSync(F+'.bak_vercode12',O);fs.writeFileSync(F,s);console.log('patched ok -',n);
