const fs=require('fs');const F='ProfileScreen.tsx';let s=fs.readFileSync(F,'utf8');
const A='onNavigateVaultRestore?: () => void}>';
if(s.split(A).length-1!==1){console.error('anchor abort');process.exit(1);}
s=s.replace(A,'onNavigateVaultRestore?: () => void; onNavigateCreateVault?: () => void}>');
fs.writeFileSync(F,s);console.log('fixed');
