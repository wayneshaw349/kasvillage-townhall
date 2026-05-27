/**
 * KasVillage Patch: Add utxoTag to clipboard format
 * ==================================================
 * 1. Updates kv_proposal.ts - adds utxoTag field to generate/parse
 * 2. Updates NeighborAgreement.tsx - includes utxoTag in clipboard copy
 * 3. Generates R nonce at proposal time
 * 
 * Run: node patch_utxo_tag_clipboard.cjs
 */

const fs = require('fs');
let fixes = 0;

function log(msg) { console.log('✓ Fix ' + (fixes + 1) + ': ' + msg); fixes++; }
function skip(msg) { console.log('⊘ SKIP: ' + msg); }

// ============================================================
// PART 1: Update kv_proposal.ts
// ============================================================
{
  let kv = fs.readFileSync('kv_proposal.ts', 'utf8');

  // Add utxoTag to KVProposal interface
  if (!kv.includes('utxoTag')) {
    kv = kv.replace(
      'description: string;',
      'description: string;\n  utxoTag?: string;           // buyer\'s committed UTXO key (txId:index)'
    );

    // Add utxoTag to generateProposal params
    kv = kv.replace(
      "description: string;\n}): string {",
      "description: string;\n  utxoTag?: string;\n}): string {"
    );

    // Update generateProposal to include utxoTag
    kv = kv.replace(
      "    desc,\n  ].join('|');",
      "    desc,\n    params.utxoTag || '',\n  ].join('|');"
    );

    // Update parseProposal to extract utxoTag
    kv = kv.replace(
      "description: parts.slice(9).join('|'), // description may contain pipes",
      "description: parts.length > 11 ? parts[9] : parts.slice(9).join('|'),\n    utxoTag: parts.length > 10 ? parts[parts.length - 1] : undefined,"
    );

    // Update AGR ID verification to include utxoTag
    kv = kv.replace(
      "const expectedInput = proposal.buyerPubkey + proposal.sellerPubkey\n    + proposal.buyerAmountSompi.toString() + proposal.sellerAmountSompi.toString() + proposal.network;",
      "const expectedInput = proposal.buyerPubkey + proposal.sellerPubkey\n    + proposal.buyerAmountSompi.toString() + proposal.sellerAmountSompi.toString() + proposal.network\n    + (proposal.utxoTag || '');"
    );

    fs.writeFileSync('kv_proposal.ts', kv);
    log('Updated kv_proposal.ts with utxoTag field');
  } else {
    skip('kv_proposal.ts already has utxoTag');
  }
}

// ============================================================
// PART 2: Update NeighborAgreement.tsx clipboard copy
// ============================================================
{
  let na = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

  // Add utxoTag to the generateProposal call in the clipboard copy block
  if (na.includes('generateProposal({') && !na.includes("utxoTag:")) {
    na = na.replace(
      "description: contract.itemDescription || '',\n                          });",
      "description: contract.itemDescription || '',\n                            utxoTag: await (async () => { try { const s = await AsyncStorage.getItem('kv_utxo_ledger'); if (!s) return ''; const entries = JSON.parse(s); const committed = entries.find((e) => e.commitReason === (contract.agreementId || '')); return committed ? committed.utxoKey : ''; } catch { return ''; } })(),\n                          });"
    );
    log('Added utxoTag to clipboard generateProposal call');
  } else if (na.includes("utxoTag:")) {
    skip('utxoTag already in generateProposal call');
  } else {
    skip('generateProposal call not found in clipboard block');
  }

  // Generate R nonce at proposal time (if not already patched)
  if (!na.includes('Generated nonce R at proposal')) {
    const lines = na.split('\n');
    let inserted = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('addToFrostList({') && i > 0 && lines[i-1].includes('Proposer ledger commit skipped')) {
        lines.splice(i, 0,
          '              // Generate R nonce at proposal time for clipboard',
          '              try {',
          "                const propNonce = generateFrostNonce({ frostAddress: frostData, recipientAddress: counterpartyKaspaAddr || '', amountSompi: BigInt(Math.floor((contract.itemPriceKas + contract.sellerCommitmentKas) * 1e8)), privateKeyHex: propWallet?.privKeyHex || '' });",
          "                await AsyncStorage.setItem('kv_frost_nonce_' + agreementId, JSON.stringify({ R_hex: propNonce.R_hex, k_private: propNonce.k_private, d_tweaked: propNonce.d_tweaked, message_hex: propNonce.message_hex }));",
          "                console.log('[FROST-R] Generated nonce R at proposal:', propNonce.R_hex.slice(0,20));",
          "              } catch(e) { console.warn('[FROST-R] Proposal nonce failed:', e); }"
        );
        inserted = true;
        log('Inserted R nonce generation at proposal time');
        break;
      }
    }
    if (!inserted) skip('R nonce insert point not found');
    na = lines.join('\n');
  } else {
    skip('R nonce at proposal already exists');
  }

  fs.writeFileSync('NeighborAgreement.tsx', na);
}

// ============================================================
// PART 3: Update canonical_agreement.ts to accept utxoTag
// ============================================================
{
  let ca = fs.readFileSync('canonical_agreement.ts', 'utf8');
  
  if (!ca.includes('utxoTag')) {
    // Add utxoTag parameter
    ca = ca.replace(
      "  _daaScore?: string,\n): string {",
      "  _daaScore?: string,\n  utxoTag?: string,\n): string {"
    );
    
    // Add utxoTag to hash input
    ca = ca.replace(
      "const input = buyerPubkey + sellerPubkey + buyerAmountSompi.toString() + sellerAmountSompi.toString() + (network || 'testnet-10');",
      "const input = buyerPubkey + sellerPubkey + buyerAmountSompi.toString() + sellerAmountSompi.toString() + (network || 'testnet-10') + (utxoTag || '');"
    );
    
    fs.writeFileSync('canonical_agreement.ts', ca);
    log('Updated canonical_agreement.ts with utxoTag parameter');
  } else {
    skip('canonical_agreement.ts already has utxoTag');
  }
}

// ============================================================
// VERIFY
// ============================================================
const naFinal = fs.readFileSync('NeighborAgreement.tsx', 'utf8');
let b = 0, p = 0;
for (const ch of naFinal) { if (ch === '{') b++; if (ch === '}') b--; if (ch === '(') p++; if (ch === ')') p--; }

console.log('\n==================================================');
console.log('Applied', fixes, 'fixes');
console.log('Braces:', b === 0 ? 'OK ✓' : 'BROKEN(' + b + ') ✗');
console.log('Parens:', p === 0 ? 'OK ✓' : 'BROKEN(' + p + ') ✗');
console.log('Lines:', naFinal.split('\n').length);
console.log('==================================================');

console.log('\nVerify:');
console.log('  Select-String -Path "NeighborAgreement.tsx" -Pattern "utxoTag" | Select-Object LineNumber, Line');
console.log('  Select-String -Path "kv_proposal.ts" -Pattern "utxoTag" | Select-Object LineNumber, Line');
console.log('  Select-String -Path "canonical_agreement.ts" -Pattern "utxoTag" | Select-Object LineNumber, Line');
console.log('\nThen:');
console.log('  git add NeighborAgreement.tsx kv_proposal.ts canonical_agreement.ts');
console.log('  git commit -m "feat: utxoTag in clipboard + AGR ID + R nonce at proposal"');
console.log('  git push origin main');
console.log('  npx expo start --clear');
