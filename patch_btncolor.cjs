const fs=require('fs');const F='NeighborAgreement.tsx';let s=fs.readFileSync(F,'utf8');const O=s;
const A="(acceptingId || manualVerCode.length !== 4) ? '#888' : '#059669'";
const B="(acceptingId || manualVerCode.length !== 12) ? '#888' : '#059669'";
const c=s.split(A).length-1;if(c!==1){console.error('count='+c);process.exit(1);}
fs.writeFileSync(F+'.bak_btncolor',O);fs.writeFileSync(F,s.replace(A,B));console.log('ok');
