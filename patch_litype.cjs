const fs=require('fs');const F='NeighborAgreement.tsx';let s=fs.readFileSync(F,'utf8');const O=s;
const A="      let _localItems = [];";
const B="      let _localItems: any[] = [];";
if(s.includes(B)){console.log('already');process.exit(0);}
const c=s.split(A).length-1;
if(c!==1){console.error('count='+c+' abort');process.exit(1);}
fs.writeFileSync(F+'.bak_litype',O);fs.writeFileSync(F,s.replace(A,B));console.log('patched ok');
