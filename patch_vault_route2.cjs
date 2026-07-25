const fs=require('fs');
const F='AppNaviagator.tsx';
let s=fs.readFileSync(F,'utf8');
if(s.includes('VAULT-ROUTE')){console.log('already patched');process.exit(0);}
const A='              const res = await restoreWalletFromMnemonic(mnemonic, net);';
const cnt=s.split(A).length-1;
if(cnt!==1){console.error('ANCHOR COUNT '+cnt+' - abort');process.exit(1);}
fs.writeFileSync(F+'.bak_route2',s);
const INJ=`              // ---- VAULT-ROUTE: cards for the vault must never overwrite the main wallet ----
              const { previewAddressFromMnemonic } = await import('./wallet_registration_v2');
              const preview = await previewAddressFromMnemonic(mnemonic, net);
              const vaultAddr = (await SecureStore.getItemAsync('kv_vault_address')) || '';
              console.log('[Restore] VAULT-ROUTE preview:', preview?.address?.slice(0, 22) || 'none',
                'vault:', vaultAddr.slice(0, 22) || 'none');
              if (preview && vaultAddr && preview.address === vaultAddr) {
                await SecureStore.setItemAsync('kv_vault_mnemonic', mnemonic, {
                  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
                });
                await SecureStore.setItemAsync('kv_vault_pubkey', preview.publicKeyHex);
                Alert.alert(
                  'Vault cards detected',
                  'These cards belong to your VAULT wallet. The vault key was restored to vault storage. Your main wallet was not changed.',
                );
                setScreen('dashboard');
                return;
              }
`;
s=s.replace(A, INJ+A);
if(!s.includes('VAULT-ROUTE')){console.error('post-check failed');process.exit(1);}
fs.writeFileSync(F,s);
console.log('patched ok');
