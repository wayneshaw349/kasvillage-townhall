/**
 * KasVillage Combined Patch
 * =========================
 * 1. Add generateFrostNonce to import
 * 2. Add global type declaration
 * 3. Fix wallet -> w2 reference in PartialSig-Poll
 * 4. Add syncLedger to utxo_ledger import
 * 5. Add UTXO tag to AGR ID computation (unique proposals)
 * 
 * Run: node patch_combined.cjs
 */

const fs = require('fs');
let c = fs.readFileSync('NeighborAgreement.tsx', 'utf8');
let fixes = 0;

function log(msg) { console.log('✓ Fix ' + (fixes + 1) + ': ' + msg); fixes++; }
function skip(msg) { console.log('⊘ SKIP: ' + msg); }

// === Fix 1: Add generateFrostNonce to frost_complete import ===
if (!c.includes('generateFrostNonce,') && !c.includes('generateFrostNonce }') && !c.includes('generateFrostNonce\n')) {
  if (c.includes('aggregatePartialSigs,')) {
    c = c.replace('aggregatePartialSigs,', 'aggregatePartialSigs,\n  generateFrostNonce,');
    log('Added generateFrostNonce to frost_complete import');
  } else { skip('aggregatePartialSigs not found in imports'); }
} else { skip('generateFrostNonce already imported'); }

// === Fix 2: Add global type declaration ===
if (!c.includes('declare var global')) {
  if (c.includes("const AGR_SESSION_KEY = 'kv_agreement_session';")) {
    c = c.replace(
      "const AGR_SESSION_KEY = 'kv_agreement_session';",
      "declare var global: any;\nconst AGR_SESSION_KEY = 'kv_agreement_session';"
    );
    log('Added global type declaration');
  } else { skip('AGR_SESSION_KEY not found'); }
} else { skip('global already declared'); }

// === Fix 3: Fix wallet -> w2 in PartialSig-Poll ===
const walletBug = 'return decryptPartialSig({ encrypted: partialSig, myPrivKeyHex: wallet.privKeyHex,';
if (c.includes(walletBug)) {
  c = c.replace(walletBug, 'return decryptPartialSig({ encrypted: partialSig, myPrivKeyHex: w2.privKeyHex,');
  log('Fixed wallet -> w2 in PartialSig-Poll');
} else { skip('wallet.privKeyHex reference already fixed or not found'); }

// === Fix 4: Add syncLedger to utxo_ledger import ===
if (!c.includes('syncLedger')) {
  // Try with isAlreadyCommitted (from our earlier patch)
  if (c.includes('markLocked, isAlreadyCommitted }')) {
    c = c.replace('markLocked, isAlreadyCommitted }', 'markLocked, isAlreadyCommitted, syncLedger }');
    log('Added syncLedger to utxo_ledger import (after isAlreadyCommitted)');
  } else if (c.includes('markLocked }')) {
    c = c.replace('markLocked }', 'markLocked, syncLedger }');
    log('Added syncLedger to utxo_ledger import (after markLocked)');
  } else if (c.includes("from './utxo_ledger'")) {
    c = c.replace(
      /import \{([^}]+)\} from '\.\/utxo_ledger'/,
      (match, imports) => "import {" + imports.trim() + ", syncLedger } from './utxo_ledger'"
    );
    log('Added syncLedger to utxo_ledger import (regex)');
  } else { skip('utxo_ledger import not found'); }
} else { skip('syncLedger already imported'); }

// === Fix 5: Add UTXO tag to AGR ID computation ===
// Strategy: find the agrInput line, insert UTXO tag fetch before it, add utxoTag to hash
const lines = c.split('\n');
let agrInputLine = -1;
let networkLine = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const agrInput = new TextEncoder().encode(') && 
      lines[i+1] && lines[i+1].includes('contract.buyerPubkey')) {
    agrInputLine = i;
    // Find the 'network' line that closes the hash input
    for (let j = i; j < i + 15; j++) {
      if (lines[j] && lines[j].trim() === 'network') {
        networkLine = j;
        break;
      }
    }
    break;
  }
}

if (agrInputLine >= 0 && !c.includes('utxoTag')) {
  // Insert UTXO tag fetch before agrInput
  const tagBlock = [
    '          // Get UTXO tag for unique AGR ID',
    '          const propWalletForTag = await loadMainWallet();',
    "          let utxoTag = 'no-utxo';",
    '          if (propWalletForTag) {',
    '            try {',
    '              const ledgerResult = await syncLedger(propWalletForTag.address);',
    "              const firstFree = ledgerResult.utxos.find((u: any) => u.status === 'free');",
    "              if (firstFree) { utxoTag = firstFree.utxoKey; console.log('[AGR-ID] UTXO tag:', utxoTag); }",
    "            } catch (e) { console.warn('[AGR-ID] Ledger sync failed:', e); }",
    '          }',
  ];
  
  lines.splice(agrInputLine, 0, ...tagBlock);
  
  // Adjust networkLine since we inserted lines
  networkLine += tagBlock.length;
  
  // Find network line again (it may have shifted)
  for (let j = agrInputLine + tagBlock.length; j < agrInputLine + tagBlock.length + 20; j++) {
    if (lines[j] && lines[j].trim() === 'network') {
      networkLine = j;
      break;
    }
  }
  
  if (networkLine >= 0 && lines[networkLine] && lines[networkLine].trim() === 'network') {
    // Replace 'network' with 'network + utxoTag' 
    lines[networkLine] = lines[networkLine].replace('network', 'network +\n            utxoTag');
    log('Added UTXO tag to AGR ID computation');
  } else {
    // Fallback: try to find network in the encode block
    for (let j = agrInputLine + tagBlock.length; j < agrInputLine + tagBlock.length + 20; j++) {
      if (lines[j] && lines[j].trim().startsWith('network') && !lines[j].includes('utxoTag')) {
        lines[j] = lines[j].replace(/network\s*$/, 'network +\n            utxoTag');
        log('Added UTXO tag to AGR ID (fallback)');
        break;
      }
    }
  }
  
  c = lines.join('\n');
} else if (c.includes('utxoTag')) {
  skip('utxoTag already in AGR ID computation');
} else {
  skip('agrInput line not found for UTXO tag insertion');
}

// === Verify ===
let b = 0, p = 0;
for (const ch of c) { if (ch === '{') b++; if (ch === '}') b--; if (ch === '(') p++; if (ch === ')') p--; }

console.log('\n==================================================');
console.log('Applied', fixes, 'fixes');
console.log('Braces:', b === 0 ? 'OK ✓' : 'BROKEN(' + b + ') ✗');
console.log('Parens:', p === 0 ? 'OK ✓' : 'BROKEN(' + p + ') ✗');
console.log('Lines:', c.split('\n').length);
console.log('==================================================');

fs.writeFileSync('NeighborAgreement.tsx', c);

console.log('\nVerify:');
console.log('  Select-String -Path "NeighborAgreement.tsx" -Pattern "utxoTag|AGR-ID|generateFrostNonce|syncLedger|declare var global" | Select-Object LineNumber, Line');
console.log('\nThen:');
console.log('  git add NeighborAgreement.tsx; git commit -m "fix: missing imports + UTXO tag in AGR ID"; git push origin main');
console.log('  npx expo start --clear');
