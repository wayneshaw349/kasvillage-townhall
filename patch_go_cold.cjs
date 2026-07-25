const fs=require('fs');
let fails=0;
function patchFile(F,bak,edits){
  let s=fs.readFileSync(F,'utf8');
  const orig=s;
  for(const [name,anchor,repl] of edits){
    if(s.includes(repl.slice(0,45))){console.log('skip '+name);continue;}
    let a=anchor,r=repl,c=s.split(a).length-1;
    if(c!==1){a=anchor.replace(/\n/g,'\r\n');r=repl.replace(/\n/g,'\r\n');c=s.split(a).length-1;}
    if(c!==1){console.error('SKIP '+name+' count '+c);fails++;continue;}
    s=s.replace(a,r);console.log('ok '+name);
  }
  if(s!==orig){fs.writeFileSync(F+bak,orig);fs.writeFileSync(F,s);}
}

// ---- 1. cold_wallet: exports for cold mode ----
patchFile('kasvillage_cold_wallet.tsx','.bak_cold',[
  ['gocold-fn',
`// ============================================================================
// SEND FROM VAULT (cards vault - key derived from kv_vault_mnemonic at sign time,`,
`// ============================================================================
// VAULT COLD MODE - remove the vault key from this device. The vault becomes
// watch-only; spending requires restoring from cards (Profile > Restore from
// Cards), then optionally going cold again.
// ============================================================================

export async function vaultGoCold(): Promise<{ success: boolean; error?: string }> {
  const mn = await SecureStore.getItemAsync('kv_vault_mnemonic');
  if (!mn) return { success: false, error: 'Vault is already cold (no key on device).' };
  const authOk = await biometricAuth.authenticate('Remove vault key from this device');
  if (!authOk) return { success: false, error: 'Authentication failed' };
  await SecureStore.deleteItemAsync('kv_vault_mnemonic');
  console.log('[VaultCold] vault key removed from device - cards are now the only key');
  return { success: true };
}

export async function vaultIsWarm(): Promise<boolean> {
  return !!(await SecureStore.getItemAsync('kv_vault_mnemonic'));
}

// ============================================================================
// SEND FROM VAULT (cards vault - key derived from kv_vault_mnemonic at sign time,`],
  ['cold-error',
`  const mnemonic = await SecureStore.getItemAsync('kv_vault_mnemonic');
  if (!mnemonic) {
    return { success: false, error: 'No vault key on this device. Scan your vault cards first.' };
  }`,
`  const mnemonic = await SecureStore.getItemAsync('kv_vault_mnemonic');
  if (!mnemonic) {
    return { success: false, error: 'Vault is COLD: key is not on this device. Use Profile > Restore from Cards to load it, send, then Go Cold again.' };
  }`],
]);

// ---- 2. Profile: Go Cold button (after Restore from Cards) ----
patchFile('ProfileScreen.tsx','.bak_cold',[
  ['import',
"import * as SecureStore from 'expo-secure-store';",
"import * as SecureStore from 'expo-secure-store';\nimport { vaultGoCold } from './kasvillage_cold_wallet';"],
  ['button',
`              <Text style={styles.seedExportText}>Restore from Cards</Text>
              <Text style={styles.seedExportSub}>Scan 2 backup cards to load a wallet or vault key</Text>
            </View>
          </TouchableOpacity>`,
`              <Text style={styles.seedExportText}>Restore from Cards</Text>
              <Text style={styles.seedExportSub}>Scan 2 backup cards to load a wallet or vault key</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.seedExportButton}
            onPress={async () => {
              const r = await vaultGoCold();
              Alert.alert(r.success ? 'Vault is now cold' : 'Go Cold', r.success
                ? 'The vault key was removed from this device. Your cards are now the only way to spend from the vault. It can still receive and show its balance.'
                : (r.error || 'Failed'));
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.seedExportText}>Go Cold (Vault)</Text>
              <Text style={styles.seedExportSub}>Remove the vault key from this phone - cards become the only key</Text>
            </View>
          </TouchableOpacity>`],
]);

if(fails>0){console.error(fails+' failures - check baks');process.exit(1);}
console.log('all patched');
