const fs=require('fs');
const F='kasvillage_cold_wallet.tsx';
let s=fs.readFileSync(F,'utf8');
if(s.includes('sendKASFromVault')){console.log('already patched');process.exit(0);}

// Anchor: end of sendKASWithHybridSig — the comment header of the NEXT section
const A='// SEND INSCRIPTION TX (REST API';
const cnt=s.split(A).length-1;
if(cnt!==1){console.error('ANCHOR COUNT '+cnt+' - abort');process.exit(1);}
fs.writeFileSync(F+'.bak_vaultsend',s);

const INJ=`// ============================================================================
// SEND FROM VAULT (cards vault - key derived from kv_vault_mnemonic at sign time,
// never persisted to main slots; buffer zeroed after use)
// ============================================================================

export async function sendKASFromVault(
  recipientAddress: string, amountSompi: bigint, memo?: string
): Promise<TransactionResult> {
  const authOk = await biometricAuth.authenticate('Vault: send ' + formatKAS(amountSompi) + ' KASPA');
  if (!authOk) return { success: false, error: 'Authentication failed' };

  const mnemonic = await SecureStore.getItemAsync('kv_vault_mnemonic');
  if (!mnemonic) {
    return { success: false, error: 'No vault key on this device. Scan your vault cards first.' };
  }

  let hdPriv: Uint8Array | null = null;
  try {
    const { mnemonicToSeed, deriveKaspaHDKey } = await import('./bip39_wallet');
    const { previewAddressFromMnemonic } = await import('./wallet_registration_v2');

    const storedVaultAddr = (await SecureStore.getItemAsync('kv_vault_address')) || '';
    const network: KaspaNetwork = storedVaultAddr.startsWith('kaspa:') ? 'mainnet' : 'testnet-10';

    const preview = await previewAddressFromMnemonic(mnemonic, network);
    if (!preview) return { success: false, error: 'Vault key derivation failed' };
    if (storedVaultAddr && preview.address !== storedVaultAddr) {
      return { success: false, error: 'Vault key does not match stored vault address. Re-scan cards.' };
    }

    const seed = await mnemonicToSeed(mnemonic, '');
    const hdKey = deriveKaspaHDKey(seed);
    hdPriv = hdKey.privateKey;
    const privKeyHex = bytesToHex(hdPriv);

    console.log('[VaultSend] Sending from vault', preview.address.slice(0, 22), 'via REST...');
    const restResult = await sendKaspaViaRest({
      senderAddress: preview.address,
      recipientAddress,
      amountSompi,
      privateKeyHex: privKeyHex,
      network,
    });

    if (!restResult.success) {
      return { success: false, error: restResult.error || 'Vault transaction failed' };
    }

    const txId = restResult.txId || '';
    console.log('[VaultSend] TX broadcast:', txId);

    await storeTransaction({
      txId, type: 'send', toAddress: recipientAddress, amountSompi,
      timestamp: Date.now(), status: 'pending', lamportIndex: -1,
    });

    return {
      success: true, kaspaTxId: txId,
      explorerUrl: EXPLORER_URLS[network] + txId,
    };
  } catch (e: any) {
    console.error('[VaultSend] Error:', e?.message);
    return { success: false, error: e?.message || 'Vault send failed' };
  } finally {
    if (hdPriv) hdPriv.fill(0);
  }
}

// ============================================================================
`;
s=s.replace(A, INJ+A);

// export it alongside sendKASWithHybridSig in the export block
const E='  sendKASWithHybridSig,';
if(s.split(E).length-1===1){
  s=s.replace(E, E+'\n  sendKASFromVault,');
} else {
  console.log('note: export-block anchor not unique; sendKASFromVault is exported inline anyway');
}

if(!s.includes('sendKASFromVault')){console.error('post-check failed');process.exit(1);}
fs.writeFileSync(F,s);
console.log('patched ok');
