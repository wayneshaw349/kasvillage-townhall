const fs=require('fs');const F='NeighborAgreement.tsx';let s=fs.readFileSync(F,'utf8');const O=s;
const A="                          maxLength={4}";
const B="                          maxLength={12}";
const c=s.split(A).length-1;
if(c!==1){console.error('count='+c+' - trying loose');
  const A2="maxLength={4}";const c2=s.split(A2).length-1;
  if(c2!==1){console.error('loose count='+c2+' abort (multiple maxLength=4 — need context)');process.exit(1);}
  fs.writeFileSync(F+'.bak_maxlen',O);fs.writeFileSync(F,s.replace(A2,"maxLength={12}"));console.log('ok (loose)');process.exit(0);
}
fs.writeFileSync(F+'.bak_maxlen',O);fs.writeFileSync(F,s.replace(A,B));console.log('ok');
