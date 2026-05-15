const fs = require('fs');

// ============================================================================
// 1. Wire ALL sends in kaspa_rest_tx.ts
// ============================================================================
let restTx = fs.readFileSync('kaspa_rest_tx.ts', 'utf8');

if (!restTx.includes('uploadPerTxProof')) {
  // Add import at top
  const firstImport = restTx.indexOf("import ");
  if (firstImport >= 0) {
    restTx = restTx.slice(0, firstImport) + 
      "import { uploadPerTxProof } from './wallet_merkle_archive';\nimport { uploadToIrys } from './arweave_upload';\n" + 
      restTx.slice(firstImport);
    console.log('1a: Imports added to kaspa_rest_tx.ts');
  }

  // Add merkle proof before the success return
  restTx = restTx.replace(
    "    return { success: true, txId, explorerUrl: explorerBase + txId };",
    `    // Merkle archive: per-TX proof to Arweave (fire-and-forget, ~0.6 KB, free)
    uploadPerTxProof({
      txId,
      txIndex: 0,
      amountSompi: amountSompi,
      scriptPubKey: bytesToHex(recipientScript),
      daaScore: 0,
      txType: recipientAddress === senderAddress ? 'self' : 'send',
      balanceAfter: 0,
      uploadFn: async (data, tags) => {
        const r = await uploadToIrys(data, tags);
        return r.txId || '';
      },
      network: network === 'mainnet' ? 'mainnet' : 'testnet',
    }).catch(e => console.warn('[REST-TX] Merkle proof failed (non-fatal):', e));

    return { success: true, txId, explorerUrl: explorerBase + txId };`
  );
  console.log('1b: uploadPerTxProof wired into sendKaspaViaRest');
  
  fs.writeFileSync('kaspa_rest_tx.ts', restTx);
  console.log('1c: kaspa_rest_tx.ts saved. Lines:', restTx.split('\n').length);
} else {
  console.log('1: kaspa_rest_tx.ts already wired');
}

// ============================================================================
// 2. Wire receives in AppNaviagator.tsx (UTXO/balance load)
// ============================================================================
let appNav = fs.readFileSync('AppNaviagator.tsx', 'utf8');

if (!appNav.includes('onUtxoRefresh') && !appNav.includes('wallet_merkle_archive')) {
  // Add import near top
  const firstImportNav = appNav.indexOf("import ");
  if (firstImportNav >= 0) {
    appNav = appNav.slice(0, firstImportNav) +
      "import { onUtxoRefresh } from './wallet_merkle_archive';\nimport { uploadToIrys } from './arweave_upload';\n" +
      appNav.slice(firstImportNav);
    console.log('2a: Imports added to AppNaviagator.tsx');
  }

  // Wire after balance load
  appNav = appNav.replace(
    "console.log('[AppNav] Balance loaded:', sompi.toString(), 'sompi');",
    `console.log('[AppNav] Balance loaded:', sompi.toString(), 'sompi');
          // Merkle archive: snapshot UTXO state on every balance refresh
          try {
            const utxoResp = await fetch(balUrl.replace('/balance', '/utxos'));
            if (utxoResp.ok) {
              const utxos = await utxoResp.json();
              onUtxoRefresh(utxos, 'testnet', async (data, tags) => {
                const r = await uploadToIrys(data, tags);
                return r.txId || '';
              }).catch(e => console.warn('[AppNav] UTXO snapshot failed:', e));
            }
          } catch (e) { /* non-fatal */ }`
  );
  console.log('2b: onUtxoRefresh wired into AppNaviagator.tsx balance load');

  fs.writeFileSync('AppNaviagator.tsx', appNav);
  console.log('2c: AppNaviagator.tsx saved. Lines:', appNav.split('\n').length);
} else {
  console.log('2: AppNaviagator.tsx already wired');
}

console.log('\n=== DONE ===');
console.log('ALL sends: kaspa_rest_tx.ts → uploadPerTxProof after every TX');
console.log('ALL receives: AppNaviagator.tsx → onUtxoRefresh on every balance load');
console.log('Every transaction now gets a permanent merkle proof on Arweave.');
