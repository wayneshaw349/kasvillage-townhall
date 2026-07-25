const fs=require('fs');

// ---- PART 1: add previewAddressFromMnemonic to wallet_registration_v2.ts ----
{
  const F='wallet_registration_v2.ts';
  let s=fs.readFileSync(F,'utf8');
  if(s.includes('previewAddressFromMnemonic')){console.log('part1: already present, skipping');}
  else{
    const A='export async function restoreWalletFromMnemonic(';
    if(s.split(A).length-1!==1){console.error('part1 ANCHOR abort');process.exit(1);}
    fs.writeFileSync(F+'.bak_route',s);
    const H=`// Derive the address a mnemonic WOULD restore to, without writing anything.
export async function previewAddressFromMnemonic(
  mnemonic: string,
  network: 'mainnet' | 'testnet-10' | 'testnet-11' = 'testnet-10',
): Promise<{ address: string; publicKeyHex: string } | null> {
  try {
    if (!mnemonic || mnemonic.trim().split(/\\s+/).length !== 12) return null;
    const { mnemonicToSeed, deriveKaspaHDKey } = await import('./bip39_wallet');
    const seed = await mnemonicToSeed(mnemonic, '');
    const hdKey = deriveKaspaHDKey(seed);
    const pubBytes = getPublicKey(hdKey.privateKey, true);
    const xOnly = pubBytes.slice(1);
    const hrp = network.startsWith('testnet') ? 'kaspatest' : 'kaspa';
    return { address: kaspaAddressFromXOnly(xOnly, hrp), publicKeyHex: bytesToHex(pubBytes) };
  } catch { return null; }
}

`;
    s=s.replace(A,H+A);
    fs.writeFileSync(F,s);
    console.log('part1: patched');
  }
}

// ---- PART 2: route in AppNaviagator.tsx onRecovered callback ----
{
  const F='AppNaviagator.tsx';
  let s=fs.readFileSync(F,'utf8');
  if(s.includes('VAULT-ROUTE')){console.log('part2: already present, skipping');process.exit(0);}
  const A=`              console.log('[Restore] network:', net, 'from addr:', knownAddr.slice(0, 12) || 'none');
              const res = await restoreWalletFromMnemonic(mnemonic, net);`;
  if(s.split(A).length-1!==1){console.error('part2 ANCHOR abort');process.exit(1);}
  fs.writeFileSync(F+'.bak_route',s);
  const B=`              console.log('[Restore] network:', net, 'from addr:', knownAddr.slice(0, 12) || 'none');
              // ---- VAULT-ROUTE: cards for the vault must never overwrite the main wallet ----
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
              const res = await restoreWalletFromMnemonic(mnemonic, net);`;
  s=s.replace(A,B);
  fs.writeFileSync(F,s);
  console.log('part2: patched');
}
