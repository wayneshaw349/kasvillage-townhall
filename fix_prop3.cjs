const fs=require('fs');const F='ProfileScreen.tsx';let s=fs.readFileSync(F,'utf8');
const A='onNavigateVaultRestore?: () => void }> = ({';
const c=s.split(A).length-1;
if(c!==1){console.error('anchor count '+c+' abort');process.exit(1);}
s=s.replace(A,'onNavigateVaultRestore?: () => void; onNavigateCreateVault?: () => void }> = ({');
fs.writeFileSync(F,s);console.log('fixed');
