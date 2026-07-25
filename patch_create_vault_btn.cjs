const fs=require('fs');
let fails=0;
function patchFile(F,edits){
  let s=fs.readFileSync(F,'utf8');
  const orig=s;
  for(const [name,anchor,repl] of edits){
    if(s.includes(repl.slice(0,50))){console.log('skip '+name+' (present)');continue;}
    let a=anchor,r=repl,c=s.split(a).length-1;
    if(c!==1){a=anchor.replace(/\n/g,'\r\n');r=repl.replace(/\n/g,'\r\n');c=s.split(a).length-1;}
    if(c!==1){console.error('SKIP '+name+' anchor count '+c);fails++;continue;}
    s=s.replace(a,r);console.log('ok '+name);
  }
  if(s!==orig){fs.writeFileSync(F+'.bak_createvault',orig);fs.writeFileSync(F,s);}
}

// ---- ProfileScreen ----
patchFile('ProfileScreen.tsx',[
  ['prop-type',
   'onNavigateVaultBackup?: () => void; onNavigateVaultRestore?: () => void }>',
   'onNavigateVaultBackup?: () => void; onNavigateVaultRestore?: () => void; onNavigateCreateVault?: () => void }>'],
  ['prop-destructure',
   'onNavigateVaultBackup, onNavigateVaultRestore }) =>',
   'onNavigateVaultBackup, onNavigateVaultRestore, onNavigateCreateVault }) =>'],
  ['rename',
   'Vault Backup (QR cards)</Text>',
   'Backup Cards</Text>'],
  ['rename-sub',
   'Split your seed into 2-of-4 recovery cards</Text>\n            </View>\n          </TouchableOpacity>\n          <TouchableOpacity\n            style={styles.seedExportButton}\n            onPress={() => onNavigateVaultRestore?.()}',
   'Back up THIS wallet as 2-of-4 recovery cards</Text>\n            </View>\n          </TouchableOpacity>\n          <TouchableOpacity\n            style={styles.seedExportButton}\n            onPress={() => onNavigateCreateVault?.()}\n          >\n            <View style={{ flex: 1 }}>\n              <Text style={styles.seedExportText}>Create Vault</Text>\n              <Text style={styles.seedExportSub}>New cold-storage wallet, spendable only with cards</Text>\n            </View>\n          </TouchableOpacity>\n          <TouchableOpacity\n            style={styles.seedExportButton}\n            onPress={() => onNavigateVaultRestore?.()}'],
]);

// ---- AppNaviagator ----
patchFile('AppNaviagator.tsx',[
  ['wire',
   "        onNavigateVaultRestore={() => setScreen('vault_recovery')}",
   "        onNavigateVaultRestore={() => setScreen('vault_recovery')}\n        onNavigateCreateVault={() => setScreen('generate_vault')}"],
]);

if(fails>0){console.error(fails+' anchors failed - check .bak_createvault files');process.exit(1);}
console.log('all patched');
