const fs=require('fs');const F='SendKAS.tsx';let s=fs.readFileSync(F,'utf8');
if(s.includes('effectiveSender')){console.log('already patched');process.exit(0);}
fs.writeFileSync(F+'.bak_self',s);
const A='const isSelf = addr === myAddress;';
const c=s.split(A).length-1;
if(c!==1){console.error('anchor count '+c+' abort');process.exit(1);}
s=s.replace(A,"const effectiveSender = sendSource === 'vault' ? vaultAddr : myAddress;\n                    const isSelf = addr === effectiveSender;");
fs.writeFileSync(F,s);console.log('fixed');
