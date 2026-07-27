const fs=require('fs');
const F='SendKAS.tsx';
let s=fs.readFileSync(F,'utf8');
if(s.includes('Return vault to cold')){console.log('already patched');process.exit(0);}
fs.writeFileSync(F+'.bak_recold',s);
let fails=0;
function ap(name,a,b){
  let A=a,B=b,c=s.split(A).length-1;
  if(c!==1){A=a.replace(/\n/g,'\r\n');B=b.replace(/\n/g,'\r\n');c=s.split(A).length-1;}
  if(c!==1){console.error('SKIP '+name+' count '+c);fails++;return;}
  s=s.replace(A,B);console.log('ok '+name);
}

// 1. import vaultGoCold alongside sendKASFromVault
ap('import',
"  sendKASFromVault,",
"  sendKASFromVault,\n  vaultGoCold,");

// 2. re-cold prompt in success branch, vault sends only
ap('prompt',
"        if (onSuccess) onSuccess(result.kaspaTxId);\n        // Refresh balance after successful send\n        setTimeout(() => { onBalanceRefresh?.(); }, 2000);",
"        if (onSuccess) onSuccess(result.kaspaTxId);\n        // Refresh balance after successful send\n        setTimeout(() => { onBalanceRefresh?.(); }, 2000);\n        if (sendSource === 'vault') {\n          setTimeout(() => {\n            Alert.alert(\n              'Return vault to cold?',\n              'Remove the vault key from this phone again. Your cards stay the only key.',\n              [\n                { text: 'Stay warm', style: 'cancel' },\n                { text: 'Go Cold', onPress: async () => { await vaultGoCold(); } },\n              ],\n            );\n          }, 800);\n        }");

if(fails>0){console.error('restoring bak');fs.writeFileSync(F,fs.readFileSync(F+'.bak_recold','utf8'));process.exit(1);}
fs.writeFileSync(F,s);
console.log('patched ok');
