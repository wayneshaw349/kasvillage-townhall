const fs=require('fs');const F='ProfileScreen.tsx';
const lines=fs.readFileSync(F,'utf8').split(/(\r?\n)/);
// split with capture keeps separators; actual line i is at index i*2
let s=fs.readFileSync(F,'utf8').split(/\r?\n/);
const i=391;
if(!/onNavigateVaultRestore\?: \(\) => void}>/.test(s[i])){console.error('line 392 unexpected:');console.error(s[i].slice(300,480));process.exit(1);}
s[i]=s[i].replace('onNavigateVaultRestore?: () => void}>','onNavigateVaultRestore?: () => void; onNavigateCreateVault?: () => void}>');
fs.writeFileSync(F,s.join('\n'));
console.log('fixed');
