const fs=require('fs');const F='VaultBackupScreen.tsx';let s=fs.readFileSync(F,'utf8');
const A="body: { flex: 1, paddingHorizontal: rs(16), alignItems: 'center' },";
if(s.split(A).length-1!==1){console.error('anchor abort');process.exit(1);}
s=s.replace(A,"body: { paddingHorizontal: rs(16), alignItems: 'center', paddingBottom: rs(40) },");
fs.writeFileSync(F,s);console.log('fixed');
