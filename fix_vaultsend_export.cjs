const fs=require('fs');const F='kasvillage_cold_wallet.tsx';let s=fs.readFileSync(F,'utf8');
const A='export async function sendKASFromVault(';
if(s.split(A).length-1!==1){console.error('anchor abort');process.exit(1);}
s=s.replace(A,'async function sendKASFromVault(');
fs.writeFileSync(F,s);console.log('fixed');
