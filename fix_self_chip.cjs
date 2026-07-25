const fs=require('fs');const F='SendKAS.tsx';let s=fs.readFileSync(F,'utf8');
if(s.includes('effectiveSender')){console.log('already patched');process.exit(0);}
fs.writeFileSync(F+'.bak_self',s);
const A="                    if (!addr) return null;
                    const isSelf = addr === myAddress;";
const Acr=A.replace(/\n/g,'\r\n');
const B="                    if (!addr) return null;
                    const effectiveSender = sendSource === 'vault' ? vaultAddr : myAddress;
                    const isSelf = addr === effectiveSender;";
const Bcr=B.replace(/\n/g,'\r\n');
if(s.includes(A)) s=s.replace(A,B);
else if(s.includes(Acr)) s=s.replace(Acr,Bcr);
else {console.error('anchor abort');process.exit(1);}
fs.writeFileSync(F,s);console.log('fixed');
