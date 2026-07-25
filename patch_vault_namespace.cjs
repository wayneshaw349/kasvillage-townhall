const fs=require('fs');
const F='GenerateVaultScreen.tsx';
let s=fs.readFileSync(F,'utf8');
if(s.includes('VAULT-NAMESPACED')){console.log('already patched');process.exit(0);}
fs.writeFileSync(F+'.bak_namespace',s);
let fails=0;
function apply(name,anchor,repl){
  let a=anchor, r=repl;
  let c=s.split(a).length-1;
  if(c!==1){ a=anchor.replace(/\n/g,'\r\n'); r=repl.replace(/\n/g,'\r\n'); c=s.split(a).length-1; }
  if(c!==1){console.error('SKIP '+name+' anchor count '+c);fails++;return;}
  s=s.replace(a,r);
  console.log('ok '+name);
}

// 1. Replace activation with vault-namespaced storage
apply('activate',
`      // 3) activate: persist keys + kv_mnemonic (same path createWallet uses)
      const res = await restoreWalletFromMnemonic(w.mnemonic, network);
      if (!res.success) throw new Error(res.error || 'activation failed');

      const vaultAddr = res.kaspaAddress || w.kaspaAddress;
      try { await SecureStore.setItemAsync('kv_vault_address', vaultAddr); } catch {}`,
`      // 3) VAULT-NAMESPACED: store in vault slots ONLY - never touches the
      //    active (hot) wallet. Spending uses sendKASFromVault, which derives
      //    the key from kv_vault_mnemonic at sign time.
      const vaultAddr = w.kaspaAddress;
      await SecureStore.setItemAsync('kv_vault_mnemonic', w.mnemonic, {
        keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
      });
      await SecureStore.setItemAsync('kv_vault_pubkey', w.publicKeyHex);
      await SecureStore.setItemAsync('kv_vault_address', vaultAddr);`);

// 2. Banner text
apply('banner',
'<Text style={styles.bannerText}>New wallet active</Text>',
'<Text style={styles.bannerText}>Vault created</Text>');

// 3. Explainer bullets
apply('bullet',
"<Text style={styles.li}>\u2022 It becomes your active wallet (new address).</Text>",
"<Text style={styles.li}>\u2022 It becomes your VAULT (separate from your hot wallet).</Text>");

// 4. Warning text
apply('warn',
'Your previous wallet stays intact but this new one becomes active.',
'Your hot wallet is untouched; the vault is a separate cold wallet.');

if(fails>0){console.error(fails+' anchors failed - restoring bak');fs.writeFileSync(F,fs.readFileSync(F+'.bak_namespace','utf8'));process.exit(1);}
if(!s.includes('VAULT-NAMESPACED')){console.error('post-check failed - restoring');fs.writeFileSync(F,fs.readFileSync(F+'.bak_namespace','utf8'));process.exit(1);}
fs.writeFileSync(F,s);
console.log('patched ok');
