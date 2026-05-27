/**
 * KasVillage NeighborAgreement.tsx Comprehensive Patch
 * ====================================================
 * Run: node patch_neighbor_agreement.cjs
 * 
 * Fixes applied:
 *  1. Buyer packs full TX template (UTXOs + outputs + fee) not UTXO-only
 *  2. Split |templateB64 before encryption on buyer side
 *  3. PartialSig-Poll: split |templateB64 before decrypt, reattach for completeFrost2Round
 *  4. Seller Release Bar: split |templateB64 before decrypt, multi-s parsing, reattach template
 *  5. All Goldsky URLs → arweave.net
 *  6. Fix arResp → resp variable in seller release bar
 *  7. All dynamic require('./frost_complete') → static import (aggregateToAddress, completeFrost2Round)
 *  8. All dynamic require('./frost_encrypted_relay') → static import (decryptPartialSig)
 *  9. Seller paste auto-extracts R + SIG from buyer's Copy Release Info
 * 10. Buyer Copy Release Info includes R nonce
 * 11. Propose gated on proposeResult.success
 * 12. validPending filter accepts amt >= 0
 * 13. Arweave inbox query first:50
 * 14. Double comma fix in import line
 */

const fs = require('fs');
const path = require('path');

const FILE = 'NeighborAgreement.tsx';
if (!fs.existsSync(FILE)) {
  console.error('ERROR: ' + FILE + ' not found in current directory');
  process.exit(1);
}

let c = fs.readFileSync(FILE, 'utf8');
let fixes = 0;

function apply(name, search, replacement) {
  if (c.includes(search)) {
    c = c.replace(search, replacement);
    fixes++;
    console.log('✓ ' + name);
  } else {
    console.log('⊘ SKIP (not found): ' + name);
  }
}

function applyAll(name, search, replacement) {
  const count = (c.match(new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  if (count > 0) {
    c = c.split(search).join(replacement);
    fixes++;
    console.log('✓ ' + name + ' (' + count + ' occurrences)');
  } else {
    console.log('⊘ SKIP (not found): ' + name);
  }
}

// ============================================================
// FIX 1: Double comma in import line
// ============================================================
apply(
  'Fix 1: Double comma in frost_complete import',
  'cleanup as cleanupFrost,, aggregateToAddress',
  'cleanup as cleanupFrost, aggregateToAddress'
);

// ============================================================
// FIX 2: Ensure aggregateToAddress + completeFrost2Round in static import
// ============================================================
// Check if they're already in the import
if (!c.includes('aggregateToAddress') || !c.match(/from '\.\/frost_complete'/)) {
  console.log('⊘ SKIP: frost_complete import - needs manual check');
} else if (!c.match(/import\s*\{[^}]*aggregateToAddress[^}]*\}\s*from\s*'\.\/frost_complete'/)) {
  // Need to add aggregateToAddress to the import
  const importMatch = c.match(/import\s*\{([^}]+)\}\s*from\s*'\.\/frost_complete'/);
  if (importMatch && !importMatch[1].includes('aggregateToAddress')) {
    c = c.replace(importMatch[0], importMatch[0].replace(importMatch[1], importMatch[1].trim() + ', aggregateToAddress'));
    fixes++;
    console.log('✓ Fix 2a: Added aggregateToAddress to static import');
  }
  if (importMatch && !importMatch[1].includes('completeFrost2Round')) {
    c = c.replace(
      /import\s*\{([^}]+)\}\s*from\s*'\.\/frost_complete'/,
      (match, imports) => {
        if (imports.includes('completeFrost2Round')) return match;
        return match.replace(imports, imports.trim() + ', completeFrost2Round');
      }
    );
    fixes++;
    console.log('✓ Fix 2b: Added completeFrost2Round to static import');
  }
} else {
  console.log('✓ Fix 2: aggregateToAddress already in static import');
}

// ============================================================
// FIX 3: Remove ALL dynamic require('./frost_complete')
// ============================================================
applyAll(
  'Fix 3a: Remove dynamic require frost_complete for aggregateToAddress',
  "require('./frost_complete').aggregateToAddress",
  'aggregateToAddress'
);

apply(
  'Fix 3b: Remove dynamic require for aggregateToAddress (destructured)',
  "        const { aggregateToAddress } = require('./frost_complete');",
  "        // aggregateToAddress imported statically from frost_complete"
);

apply(
  'Fix 3c: Remove dynamic require for completeFrost2Round (PartialSig-Poll)',
  "            const { completeFrost2Round } = require('./frost_complete');",
  "            // completeFrost2Round imported statically from frost_complete"
);

apply(
  'Fix 3d: Remove dynamic require for completeFrost2Round (Seller Release)',
  "                      const { completeFrost2Round } = require('./frost_complete');",
  "                      // completeFrost2Round imported statically from frost_complete"
);

// ============================================================
// FIX 4: Remove dynamic require('./frost_encrypted_relay') in seller release bar
// ============================================================
apply(
  'Fix 4: Remove dynamic require frost_encrypted_relay in seller release bar (old completeFrostAndBroadcast path)',
  "const { completeFrostAndBroadcast } = require('./frost_complete');",
  "// completeFrostAndBroadcast imported statically from frost_complete"
);

// Also fix the inline decrypt in the old seller release bar
apply(
  'Fix 4b: Remove dynamic require frost_encrypted_relay in seller release bar decrypt',
  "const { decryptPartialSig } = require('./frost_encrypted_relay'); return decryptPartialSig({",
  "return decryptPartialSig({"
);

// ============================================================
// FIX 5: All Goldsky URLs → arweave.net
// ============================================================
applyAll(
  'Fix 5: Goldsky → arweave.net',
  'https://arweave-search.goldsky.com/graphql',
  'https://arweave.net/graphql'
);

// ============================================================
// FIX 6: Fix arResp → resp variable
// ============================================================
apply(
  'Fix 6: arResp.json() → resp.json() in seller release bar',
  'const json = await arResp.json(); const tags = json?.data?.transactions?.edges?.[0]?.node?.tags || [];',
  'const arResp2 = await resp.json(); const tags = arResp2?.data?.transactions?.edges?.[0]?.node?.tags || [];'
);

// ============================================================
// FIX 7: Buyer TX template (UTXO-only → full template with outputs)
// Line-targeted approach since whitespace varies
// ============================================================
{
  const lines = c.split('\n');
  let fixed7 = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('// Serialize UTXO snapshot so seller uses exact same inputs') ||
        lines[i].includes('// Serialize full TX template so seller builds identical TX')) {
      // Replace this line and the next 4 lines
      if (lines[i+1] && lines[i+1].includes('utxoSnapshot') && lines[i+2] && lines[i+2].includes('utxoB64')) {
        lines[i]   = '        // Serialize full TX template so seller builds identical TX';
        lines[i+1] = "        const txTemplate = { u: canonTx.utxos.map((u: any) => ({ t: u.outpoint.transactionId, i: u.outpoint.index, a: u.utxoEntry.amount, s: u.utxoEntry.scriptPublicKey.scriptPublicKey })), o: canonTx.outputs.map((o: any) => ({ v: o.value.toString(), s: b2h(o.script) })), f: canonTx.fee.toString() };";
        lines[i+2] = "        const templateB64 = btoa(JSON.stringify(txTemplate));";
        lines[i+3] = "        const sigHex = partialS.R_agg_x_hex + allPartials.join('') + '|' + templateB64;";
        lines[i+4] = "        console.log('[FROST-Canonical] Packed', allPartials.length, 's values + TX template (' + txTemplate.u.length + ' inputs,' + txTemplate.o.length + ' outputs)');";
        fixed7 = true;
        break;
      }
    }
  }
  if (fixed7) {
    c = lines.join('\n');
    fixes++;
    console.log('✓ Fix 7: Buyer packs full TX template with outputs');
  } else {
    console.log('⊘ SKIP: Fix 7 - UTXO snapshot block not found (may already be fixed)');
  }
}

// ============================================================
// FIX 8: Buyer side — split |templateB64 before encryption
// ============================================================
if (!c.includes('sigForEncrypt') && !c.includes('pipeIdx2')) {
  apply(
    'Fix 8: Split template before encrypt on buyer side',
    '        // ENCRYPT partial sig before relay\n        const encCtx = {',
    "        // Split UTXO snapshot from sig before encryption\n        let sigForEncrypt = result.partialSig;\n        let utxoSnapshotB64 = '';\n        const pipeIdx2 = sigForEncrypt.indexOf('|');\n        if (pipeIdx2 > 0) { utxoSnapshotB64 = sigForEncrypt.slice(pipeIdx2); sigForEncrypt = sigForEncrypt.slice(0, pipeIdx2); }\n        // ENCRYPT partial sig before relay\n        const encCtx = {"
  );
  apply(
    'Fix 8b: Use sigForEncrypt in encrypt call',
    '          partialSig: result.partialSig,',
    '          partialSig: sigForEncrypt,'
  );
  // Reattach after encryption
  apply(
    'Fix 8c: Reattach template after encrypt',
    "        console.log('[Neighbor] Partial sig ENCRYPTED for relay');",
    "        // Reattach UTXO snapshot to encrypted sig\n        if (utxoSnapshotB64) { encrypted.encrypted = encrypted.encrypted + utxoSnapshotB64; }\n        console.log('[Neighbor] Partial sig ENCRYPTED for relay (utxo:', utxoSnapshotB64 ? 'yes' : 'no', ')');"
  );
} else {
  console.log('✓ Fix 8: Buyer split already applied');
}

// ============================================================
// FIX 9: PartialSig-Poll — split |templateB64 before decrypt
// ============================================================
if (!c.includes('let encSig = match.signature')) {
  apply(
    'Fix 9: PartialSig-Poll split template before decrypt',
    "            const decrypted = (() => { try { const d = decryptPartialSig({ encrypted: match.signature,",
    "            // Split template from encrypted sig before decrypt\n            let encSig = match.signature || '';\n            let txTemplateB64 = '';\n            const pipePos = encSig.indexOf('|');\n            if (pipePos > 0) { txTemplateB64 = encSig.slice(pipePos + 1); encSig = encSig.slice(0, pipePos); }\n            const decrypted = (() => { try { const d = decryptPartialSig({ encrypted: encSig,"
  );
  // Reattach template to buyerSig s_hex
  apply(
    'Fix 9b: Reattach template in PartialSig-Poll buyerSig',
    "            const buyerSig = cpAllS.length > 0 ? { R_agg_x_hex: sigStr.slice(0, 64), s_hex: cpAllS.join('') } : undefined;",
    "            const buyerSig = cpAllS.length > 0 ? { R_agg_x_hex: sigStr.slice(0, 64), s_hex: cpAllS.join('') + (txTemplateB64 ? '|' + txTemplateB64 : '') } : undefined;"
  );
} else {
  console.log('✓ Fix 9: PartialSig-Poll split already applied');
}

// ============================================================
// FIX 10: Seller Release Bar — split template + multi-s + static import
// ============================================================
// The seller release bar has an older decrypt path
if (!c.includes('let encSig2 = partialSig')) {
  apply(
    'Fix 10: Seller release bar - split template before decrypt',
    "                      const decrypted = (() => { try { const { decryptPartialSig } = require('./frost_encrypted_relay'); return decryptPartialSig({ encrypted: partialSig, myPrivKeyHex: w.privKeyHex, counterpartyPubKeyHex: contract.buyerPubkey || '' }); } catch { return partialSig; } })();",
    "                      // Split template from sig before decrypt\n                      let encSig2 = partialSig || '';\n                      let txTemplateB64_2 = '';\n                      const pipePos2 = encSig2.indexOf('|');\n                      if (pipePos2 > 0) { txTemplateB64_2 = encSig2.slice(pipePos2 + 1); encSig2 = encSig2.slice(0, pipePos2); }\n                      const decrypted = (() => { try { return decryptPartialSig({ encrypted: encSig2, myPrivKeyHex: w.privKeyHex, counterpartyPubKeyHex: contract.buyerPubkey || '' }); } catch { return encSig2; } })();"
  );
}

// Fix multi-s parsing in seller release bar
apply(
  'Fix 10b: Seller release bar multi-s parsing + template reattach',
  "                      const buyerSig = sigBytes.length >= 128 ? { R_agg_x_hex: sigBytes.slice(0, 64), s_hex: sigBytes.slice(64, 128) } : undefined;",
  "                      // Parse all s values + reattach template\n                      const cpAllS2: string[] = []; for (let si = 64; si < sigBytes.length; si += 64) { cpAllS2.push(sigBytes.slice(si, si + 64)); }\n                      const buyerSig = cpAllS2.length > 0 ? { R_agg_x_hex: sigBytes.slice(0, 64), s_hex: cpAllS2.join('') + (txTemplateB64_2 ? '|' + txTemplateB64_2 : '') } : undefined;"
);

// ============================================================
// FIX 11: Seller paste auto-extracts R + SIG from multi-line paste
// ============================================================
if (!c.includes('Auto-extract R and SIG from multi-line paste')) {
  apply(
    'Fix 11: Seller paste auto-extracts R+SIG',
    "                  onChangeText={(txt) => setContract(prev => ({ ...prev, partialReleaseTx: txt.trim() }))}",
    "                  onChangeText={async (txt) => {\n                    const v = txt.trim();\n                    // Auto-extract R and SIG from multi-line paste\n                    const rMatch = v.match(/R:\\s*([0-9a-f]{60,66})/i);\n                    const sigMatch = v.match(/SIG:\\s*(.+)/i);\n                    if (rMatch && sigMatch) {\n                      const extractedR = rMatch[1].trim();\n                      const extractedSig = sigMatch[1].trim();\n                      await AsyncStorage.setItem('kv_manual_counterparty_r_' + (contract.agreementId || ''), extractedR);\n                      console.log('[Seller] Auto-extracted R:', extractedR.slice(0,20), 'SIG:', extractedSig.slice(0,20));\n                      setContract(prev => ({ ...prev, partialReleaseTx: extractedSig }));\n                    } else {\n                      setContract(prev => ({ ...prev, partialReleaseTx: v }));\n                    }\n                  }}"
  );
} else {
  console.log('✓ Fix 11: Seller paste already has auto-extract');
}

// ============================================================
// FIX 12: validPending filter accepts amt >= 0
// ============================================================
apply(
  'Fix 12: validPending accepts amt >= 0',
  "return pk.length >= 60 && (pk.startsWith('02') || pk.startsWith('03')) && amt > 0;",
  "return pk.length >= 60 && (pk.startsWith('02') || pk.startsWith('03')) && amt >= 0;"
);

// ============================================================
// FIX 13: Arweave inbox query first:50
// ============================================================
// Multiple possible patterns
apply(
  'Fix 13: Arweave inbox first:10 → first:50',
  "first: 10, tags: [{ name: \"KV-Counterparty\"",
  "first: 50, tags: [{ name: \"KV-Counterparty\""
);

// ============================================================
// FINAL: Verify brace/paren balance
// ============================================================
let b = 0, p = 0;
for (const ch of c) {
  if (ch === '{') b++;
  if (ch === '}') b--;
  if (ch === '(') p++;
  if (ch === ')') p--;
}

console.log('\n' + '='.repeat(50));
console.log('Applied ' + fixes + ' fixes');
console.log('Braces:', b === 0 ? 'OK ✓' : 'BROKEN(' + b + ') ✗');
console.log('Parens:', p === 0 ? 'OK ✓' : 'BROKEN(' + p + ') ✗');
console.log('Lines:', c.split('\n').length);
console.log('='.repeat(50));

if (b !== 0 || p !== 0) {
  console.error('\n⚠ WARNING: Brace/paren mismatch detected!');
  console.error('  Review changes before committing.');
}

// Write the patched file
fs.writeFileSync(FILE, c);
console.log('\n✓ Wrote patched ' + FILE);
console.log('\nNext steps:');
console.log('  1. Verify: $lines = Get-Content "NeighborAgreement.tsx"; $lines.Count');
console.log('  2. Commit: git add NeighborAgreement.tsx; git commit -m "fix: comprehensive patch - TX template, decrypt split, static imports"; git push origin main');
console.log('  3. Test:   npx expo start --clear');
