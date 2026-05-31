const fs = require('fs');
let f = fs.readFileSync('NeighborAgreement.tsx', 'utf8');
let fixes = 0;

// === FIX 1: Replace "Already sent to FROST" check with L1 balance check ===
const oldGuard = "Already sent to FROST for";
const guardIdx = f.indexOf(oldGuard);
if (guardIdx >= 0) {
  // Find the full if block: "if (...kv_frost_sent...) { ... Already sent ... skipping ... return; }"
  // Walk backward to find the if statement
  let ifStart = f.lastIndexOf('if (', guardIdx);
  // Make sure this is the right if (within ~500 chars)
  if (guardIdx - ifStart < 500) {
    // Find the closing of this if block
    let depth = 0, ifEnd = -1;
    const ifBody = f.indexOf('{', ifStart);
    for (let i = ifBody; i < f.length; i++) {
      if (f[i] === '{') depth++;
      if (f[i] === '}') { depth--; if (depth === 0) { ifEnd = i + 1; break; } }
    }
    
    if (ifEnd > ifStart && ifEnd - ifStart < 1000) {
      const oldBlock = f.substring(ifStart, ifEnd);
      const indent = '        ';
      
      // New guard: check L1 FROST balance instead of AsyncStorage flag
      const newGuard = `// L1 IDEMPOTENT GUARD: check actual FROST balance instead of stale AsyncStorage flag
${indent}const _frostAddr = contract.multisigAddress || contract.frostData?.address || '';
${indent}if (_frostAddr && _frostAddr.length > 20) {
${indent}  try {
${indent}    const _apiBase = (contract.frostData?.network || 'testnet-10').includes('testnet') ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
${indent}    const _balResp = await fetch(_apiBase + '/addresses/' + _frostAddr + '/balance');
${indent}    if (_balResp.ok) {
${indent}      const _balData = await _balResp.json();
${indent}      const _frostBal = Number(_balData.balance || '0') / 1e8;
${indent}      const _myAmt = role === 'seller' ? contract.sellerCommitmentKas : contract.itemPriceKas;
${indent}      if (_frostBal >= _myAmt) {
${indent}        console.log('[L1-Guard] FROST already has', _frostBal, 'KAS >= my', _myAmt, '— skip send');
${indent}        // Don't return — let polling continue to detect full funding
${indent}      } else {
${indent}        console.log('[L1-Guard] FROST has', _frostBal, 'KAS < my', _myAmt, '— will send');
${indent}      }
${indent}    }
${indent}  } catch (e) { console.warn('[L1-Guard] Balance check failed, proceeding:', e); }
${indent}}`;
      
      f = f.substring(0, ifStart) + newGuard + f.substring(ifEnd);
      fixes++;
      console.log('FIX 1: Replaced kv_frost_sent_ check with L1 balance guard (' + oldBlock.length + ' chars replaced)');
    }
  }
}

// === FIX 2: Also fix the "Already sent" check that uses kv_frost_sent_ key ===
// Find all instances of kv_frost_sent_ and replace with L1 check
const sentKeyPattern = /await AsyncStorage\.getItem\([`'"]kv_frost_sent_/g;
let match;
let fix2count = 0;
while ((match = sentKeyPattern.exec(f)) !== null) {
  // Find the full if block containing this
  const lineStart = f.lastIndexOf('\n', match.index);
  const lineEnd = f.indexOf('\n', match.index);
  const line = f.substring(lineStart, lineEnd);
  
  if (line.includes('if') && !line.includes('L1-Guard')) {
    // Comment out this line
    f = f.substring(0, lineStart + 1) + '        // DISABLED: kv_frost_sent_ replaced by L1 balance guard\n        // ' + f.substring(lineStart + 1, lineEnd).trim() + f.substring(lineEnd);
    fix2count++;
  }
}
if (fix2count > 0) {
  fixes++;
  console.log('FIX 2: Commented out', fix2count, 'kv_frost_sent_ AsyncStorage checks');
}

// === FIX 3: Remove the kv_frost_sent_ SET calls (no longer needed) ===
const setSentPattern = /await AsyncStorage\.setItem\([`'"]kv_frost_sent_[^;]+;/g;
let setMatch;
let fix3count = 0;
while ((setMatch = setSentPattern.exec(f)) !== null) {
  const setLine = f.substring(setMatch.index, setMatch.index + setMatch[0].length);
  f = f.replace(setLine, '// DISABLED: ' + setLine.trim() + ' // L1 is source of truth');
  fix3count++;
}
if (fix3count > 0) {
  fixes++;
  console.log('FIX 3: Disabled', fix3count, 'kv_frost_sent_ SET calls');
}

fs.writeFileSync('NeighborAgreement.tsx', f);
console.log('\nTotal fixes:', fixes);
console.log('Emojis:', (f.match(/[\u{1F000}-\u{1FFFF}]/gu) || []).length);

// Verify
console.log('\n--- Verification ---');
console.log('L1-Guard present:', f.includes('[L1-Guard]'));
console.log('Old kv_frost_sent_ checks disabled:', !f.includes("getItem('kv_frost_sent_") || f.includes('DISABLED: kv_frost_sent_'));
