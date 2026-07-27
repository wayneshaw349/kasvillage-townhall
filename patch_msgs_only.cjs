const fs=require('fs');const F='NeighborAgreement.tsx';let s=fs.readFileSync(F,'utf8');const O=s;
if(s.includes("nextActionMsg(_exPh.phase")){console.log('already');process.exit(0);}
const fails=[];let n=0;
function rep(A,B,t){const c=s.split(A).length-1;if(c!==1){fails.push(t+' count='+c);return;}s=s.replace(A,B);n++;console.log('ok:',t);}
rep(
"setStep(4); Alert.alert('Resuming Agreement', 'You already hold this agreement (' + _exPh.phase + '). Continuing where it is - not re-accepting.'); return;",
"setStep(4); Alert.alert('Resuming - ' + _exPh.phase.replace('_',' '), nextActionMsg(_exPh.phase, _exRec.role || 'seller')); return;",
"accept-msg");
rep(
"setStep(4); Alert.alert(\"Resuming Agreement\", \"You already hold this agreement (\" + _exPh.phase + \"). Not re-accepting - continuing where it is.\"); return;",
"setStep(4); Alert.alert('Resuming - ' + _exPh.phase.replace('_',' '), nextActionMsg(_exPh.phase, _exRec.role || 'seller')); return;",
"paste-msg");
if(fails.length){console.error('ABORT:');fails.forEach(f=>console.error('  -',f));process.exit(1);}
fs.writeFileSync(F+'.bak_msgs',O);fs.writeFileSync(F,s);console.log('patched ok -',n);
