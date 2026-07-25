const fs=require('fs');const F='AppNaviagator.tsx';let s=fs.readFileSync(F,'utf8');
if(s.includes('onNavigateCreateVault')){console.log('already wired');process.exit(0);}
const A="        onNavigateVaultRestore={() => setScreen('vault_recovery')}";
const c=s.split(A).length-1;
if(c!==1){console.error('anchor count '+c+' abort');process.exit(1);}
s=s.replace(A,A+"\n        onNavigateCreateVault={() => setScreen('generate_vault')}");
fs.writeFileSync(F,s);console.log('wired');
