const fs=require('fs');
const F='wallet_registration_v2.ts';
let s=fs.readFileSync(F,'utf8');
const A=`    // Stealth keys from the same 32-byte seed slice (as createWallet).
    await generateStealthKeys(wallet.seed);`;
const cnt=s.split(A).length-1;
if(cnt!==1){console.error('ANCHOR COUNT '+cnt+' - abort (expected 1)');process.exit(1);}
if(s.includes('STASH-GUARD v2')){console.error('already patched - abort');process.exit(1);}
fs.writeFileSync(F+'.bak_stashguard',s);
const INJ=`
    // ---- STASH GUARD v2: address-based, saves BOTH key slots ----
    // Compares derived address vs stored address (pubkey slot can be stale).
    const prevAddr = (await SecureStore.getItemAsync(STORE_KEYS.KASPA_ADDRESS)) || '';
    if (prevAddr && prevAddr !== wallet.kaspaAddress) {
      const prevPriv = await SecureStore.getItemAsync(STORE_KEYS.PRIVATE_KEY);
      const prevPrivEnc = await SecureStore.getItemAsync('kv_l1_privkey_enc');
      const prevMnemonic = await SecureStore.getItemAsync('kv_mnemonic');
      const prevPub = await SecureStore.getItemAsync(STORE_KEYS.PUBLIC_KEY);
      if (prevPriv) await SecureStore.setItemAsync('kv_prev_wallet_priv', prevPriv, {
        keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
      });
      if (prevPrivEnc) await SecureStore.setItemAsync('kv_prev_wallet_priv_enc', prevPrivEnc, {
        keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
      });
      if (prevMnemonic) await SecureStore.setItemAsync('kv_prev_wallet_mnemonic', prevMnemonic, {
        keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
      });
      await SecureStore.setItemAsync('kv_prev_wallet_meta', JSON.stringify({
        address: prevAddr, pubkey: prevPub || '', stashedAt: Date.now(),
      }));
      console.log('[Restore] STASH-GUARD v2: stashed', prevAddr.slice(0, 22));
    }`;
s=s.replace(A, A+INJ);
if((s.match(/STASH-GUARD v2/g)||[]).length!==2){console.error('post-check failed - abort');process.exit(1);}
fs.writeFileSync(F,s);
console.log('patched ok');
