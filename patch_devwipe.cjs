const fs=require('fs');
const F='AppNaviagator.tsx';
let s=fs.readFileSync(F,'utf8');
if(s.includes('DEV-WIPE-ONCE')){console.log('already patched');process.exit(0);}
const A="        const kvVerified: string = (await SecureStore.getItemAsync('kv_verified')) || '';";
const cnt=s.split(A).length-1;
if(cnt!==1){console.error('ANCHOR COUNT '+cnt+' - abort');process.exit(1);}
fs.writeFileSync(F+'.bak_devwipe',s);
const INJ=`
        // DEV-WIPE-ONCE: clear main wallet slots exactly one time (guarded by sentinel).
        // Vault cards + A7 cards are the backups. REMOVE THIS BLOCK after it runs.
        if (!(await SecureStore.getItemAsync('kv_dev_wiped_v1'))) {
          for (const k of ['kv_private_key','kv_public_key','kv_kaspa_address','kv_master_seed',
            'kv_mnemonic','kv_l1_privkey_enc','kaspa_address','kaspa_pubkey','kv_verified',
            'kaspa_address_tutorial','kaspa_address_real','kaspa_active_mode',
            'kv_registration_status','kv_verification_status']) {
            try { await SecureStore.deleteItemAsync(k); } catch {}
          }
          await SecureStore.setItemAsync('kv_dev_wiped_v1', String(Date.now()));
          console.log('[AppNav] DEV-WIPE-ONCE: main wallet slots cleared');
          setScreen('welcome');
          return;
        }
`;
s=s.replace(A, A+INJ);
if(!s.includes('DEV-WIPE-ONCE')){console.error('post-check failed');process.exit(1);}
fs.writeFileSync(F,s);
console.log('patched ok');
