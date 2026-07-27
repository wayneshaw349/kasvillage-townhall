const fs=require('fs');const F='NeighborAgreement.tsx';let s=fs.readFileSync(F,'utf8');const O=s;
let n=0;const fails=[];
function rep(A,B,t){const c=s.split(A).length-1;if(c!==1){fails.push(t+' count='+c);return;}s=s.replace(A,B);n++;console.log('ok:',t);}
rep("setManualVerCode(t.toUpperCase().slice(0, 4))","setManualVerCode(t.toUpperCase().slice(0, 12))","slice");
rep('placeholder="A3E5"','placeholder="665969B73196"',"placeholder");
if(fails.length){console.error('ABORT:');fails.forEach(f=>console.error(' -',f));process.exit(1);}
fs.writeFileSync(F+'.bak_vercode',O);fs.writeFileSync(F,s);console.log('patched ok -',n);
