const fs=require('fs');const F='AppNaviagator.tsx';let s=fs.readFileSync(F,'utf8');
if(s.includes('onNavigateVaultRestore')){console.log('already patched');process.exit(0);}
const A="        onNavigateVaultBackup={openVaultBackup}";
if(s.split(A).length-1!==1){console.error('anchor abort');process.exit(1);}
fs.writeFileSync(F+'.bak_restorewire',s);
s=s.replace(A,A+"\n        onNavigateVaultRestore={() => setScreen('vault_recovery')}");
fs.writeFileSync(F,s);console.log('wired');
