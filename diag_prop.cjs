const fs=require('fs');
const s=fs.readFileSync('ProfileScreen.tsx','utf8').split(/\r?\n/);
const l=s[391];
const k=l.indexOf('VaultRestore');
console.log('found at',k);
console.log(JSON.stringify(l.slice(k,k+60)));
for(const ch of l.slice(k+22,k+45)) process.stdout.write(ch.charCodeAt(0)+' ');
console.log();
