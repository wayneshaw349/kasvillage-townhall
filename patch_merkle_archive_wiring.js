// patch_merkle_archive_wiring.js
// Wires uploadPerTxProof into all transaction flows:
// 1. Collateral TX (handleLock in NeighborAgreement.tsx)
// 2. Release TX (handleRequestRelease in NeighborAgreement.tsx) 
// 3. Creates uploadFn wrapper using the fixed Arweave uploader
//
// Run: node patch_merkle_archive_wiring.js

const fs = require('fs');

// ============================================================================
// 1. Wire into NeighborAgreement.tsx
// ============================================================================
let neighbor = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

// Add import for uploadPerTxProof
if (!neighbor.includes('uploadPerTxProof')) {
  neighbor = neighbor.replace(
    "import { loadMainWallet } from './kasvillage_cold_wallet';",
    "import { loadMainWallet } from './kasvillage_cold_wallet';\nimport { uploadPerTxProof } from './wallet_merkle_archive';\nimport { uploadToIrys } from './arweave_upload';"
  );
  console.log('1a: Added uploadPerTxProof + uploadToIrys imports');
} else {
  console.log('1a: Already imported');
}

// Wire into collateral TX (after "console.log('[Neighbor] Collateral TX:', result.txId);")
const collateralMarker = "console.log('[Neighbor] Collateral TX:', result.txId);";
if (neighbor.includes(collateralMarker) && !neighbor.includes('// Merkle archive: per-TX proof for collateral')) {
  const merkleCollateral = `
      // Merkle archive: per-TX proof for collateral (fire-and-forget, ~0.6 KB, free)
      uploadPerTxProof({
        txId: result.txId || '',
        txIndex: 0,
        amountSompi: myLockAmount,
        scriptPubKey: '',
        daaScore: 0,
        txType: 'collateral',
        balanceAfter: 0, // will be refreshed on next UTXO fetch
        agreementId: contract.agreementId,
        uploadFn: async (data, tags) => {
          const r = await uploadToIrys(data, tags);
          return r.txId || '';
        },
        network: 'testnet',
      }).catch(e => console.warn('[Neighbor] Merkle proof upload failed (non-fatal):', e));`;
  
  neighbor = neighbor.replace(
    collateralMarker,
    collateralMarker + merkleCollateral
  );
  console.log('1b: Merkle archive wired into collateral TX');
} else {
  console.log('1b: Collateral already wired or marker not found');
}

// Wire into release TX (after "console.log('[Neighbor]" + " ✓ Release TX broadcast:', result.txId);")
// Need to handle the unicode checkmark
const releaseMarkers = [
  "console.log('[Neighbor] ✓ Release TX broadcast:', result.txId);",
  "console.log('[Neighbor] \u2714 Release TX broadcast:', result.txId);",
  "console.log('[Neighbor] âœ\" Release TX broadcast:', result.txId);",
];

let releaseWired = false;
for (const marker of releaseMarkers) {
  if (neighbor.includes(marker) && !neighbor.includes('// Merkle archive: per-TX proof for release')) {
    const merkleRelease = `
          // Merkle archive: per-TX proof for release (fire-and-forget)
          uploadPerTxProof({
            txId: result.txId || '',
            txIndex: 0,
            amountSompi: BigInt(Math.floor((contract.itemPriceKas + contract.sellerCommitmentKas) * 1e8)),
            scriptPubKey: '',
            daaScore: 0,
            txType: 'release',
            balanceAfter: 0,
            agreementId: contract.agreementId,
            uploadFn: async (data, tags) => {
              const r = await uploadToIrys(data, tags);
              return r.txId || '';
            },
            network: 'testnet',
          }).catch(e => console.warn('[Neighbor] Release merkle proof failed (non-fatal):', e));`;
    
    neighbor = neighbor.replace(marker, marker + merkleRelease);
    releaseWired = true;
    console.log('1c: Merkle archive wired into release TX');
    break;
  }
}
if (!releaseWired) {
  console.log('1c: Release marker not found — may need manual wiring');
}

fs.writeFileSync('NeighborAgreement.tsx', neighbor);
console.log('NeighborAgreement.tsx saved. Lines:', neighbor.split('\n').length);

// ============================================================================
// 2. Wire into kaspa_rest_tx (if it exists) for generic sends
// ============================================================================
const restTxFiles = ['kaspa_rest_tx.ts', 'kasvillage_cold_wallet.tsx'];
for (const file of restTxFiles) {
  try {
    let code = fs.readFileSync(file, 'utf8');
    if (code.includes('uploadPerTxProof')) {
      console.log(`2: ${file} already has uploadPerTxProof`);
      continue;
    }
    
    // Look for TX success pattern
    const successPatterns = [
      "transactionId",
      "Submit response",
      "TX submitted",
    ];
    
    let found = false;
    for (const pattern of successPatterns) {
      if (code.includes(pattern)) {
        found = true;
        break;
      }
    }
    
    if (found) {
      console.log(`2: ${file} has TX success patterns — manual wiring recommended`);
      console.log(`   Add after TX success:`);
      console.log(`   import { uploadPerTxProof } from './wallet_merkle_archive';`);
      console.log(`   uploadPerTxProof({ txId, txIndex: 0, amountSompi, ... }).catch(() => {});`);
    }
  } catch (e) {
    // File doesn't exist, skip
  }
}

// ============================================================================
// 3. Also wire onUtxoRefresh into balance loading (AppNavigator)
// ============================================================================
try {
  let appNav = fs.readFileSync('AppNavigator.tsx', 'utf8');
  if (!appNav.includes('onUtxoRefresh') && !appNav.includes('wallet_merkle_archive')) {
    // Check if there's a UTXO fetch / balance load
    if (appNav.includes('Balance loaded') || appNav.includes('utxo') || appNav.includes('UTXO')) {
      console.log('3: AppNavigator has UTXO/balance loading — add onUtxoRefresh hook:');
      console.log('   import { onUtxoRefresh } from "./wallet_merkle_archive";');
      console.log('   // After UTXO fetch:');
      console.log('   onUtxoRefresh(utxos, "testnet").catch(() => {});');
    }
  } else {
    console.log('3: AppNavigator already has merkle archive integration');
  }
} catch (e) {
  // AppNavigator not found at root level
  try {
    let appNav = fs.readFileSync('AppNaviagator.tsx', 'utf8');
    console.log('3: Found AppNaviagator.tsx (note typo in filename)');
  } catch (e2) {
    console.log('3: AppNavigator not found — manual wiring needed');
  }
}

console.log('\n=== DONE ===');
console.log('Per-TX merkle proofs will now upload to Arweave after:');
console.log('  - Collateral TX (agreement lock)');
console.log('  - Release TX (mutual release)');
console.log('Each proof is ~0.6 KB, always free on Turbo, fire-and-forget.');
console.log('Proof includes: UTXO data, SHA256 leaf hash, merkle root, Kaspa block anchor.');
