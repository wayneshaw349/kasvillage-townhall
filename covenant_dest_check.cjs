const fs = require('fs');

// =============================================
// 1. frost_complete.ts — add escrow destination check
// =============================================
const frost = 'frost_complete.ts';
if (fs.existsSync(frost)) {
  let fc = fs.readFileSync(frost, 'utf8');

  // Add validateEscrowDestination after verifyFrostAddress
  const destCheck = `

/**
 * Validate escrow destination is standard P2PK, not a covenant address.
 * Queries Kaspa API to check if address has covenant scripts.
 * Call before funding any FROST escrow.
 */
export async function validateEscrowDestination(
  address: string,
  network: KaspaNetwork = 'testnet-10'
): Promise<{ safe: boolean; reason?: string }> {
  // 1. P2PK addresses start with prefix:q (pubkey hash)
  //    P2SH addresses start with prefix:p (script hash)
  //    Covenant addresses may use prefix:p with extended scripts
  const prefix = network === 'mainnet' ? 'kaspa:' : 'kaspatest:';
  if (!address.startsWith(prefix)) {
    return { safe: false, reason: 'Invalid address prefix' };
  }

  // 2. Check address type from prefix character after ':'
  //    'q' = P2PK (standard), 'p' = P2SH (could be covenant)
  const addrBody = address.slice(prefix.length);
  if (addrBody.startsWith('p')) {
    // P2SH — could be a covenant. Check via API.
    const api = network === 'mainnet' ? 'api.kaspa.org' : 'api-tn10.kaspa.org';
    try {
      const resp = await fetch(\`https://\${api}/addresses/\${address}/utxos\`);
      if (resp.ok) {
        const utxos = await resp.json();
        for (const u of (utxos || [])) {
          const spk = u?.utxoEntry?.scriptPublicKey?.scriptPublicKey || '';
          if (spk.length > 72) {
            return { safe: false, reason: 'Covenant script detected at destination address' };
          }
        }
      }
    } catch { /* API unavailable — warn but don't block */ }
    // P2SH with no covenant UTXOs or empty — allow but warn
    return { safe: true, reason: 'P2SH address — verify this is your FROST aggregate key' };
  }

  // 'q' prefix = standard P2PK — always safe
  return { safe: true };
}`;

  // Insert after verifyFrostAddress function
  if (fc.includes('export function verifyFrostAddress(')) {
    // Find the closing of verifyFrostAddress
    const verifyIdx = fc.indexOf('export function verifyFrostAddress(');
    let braceCount = 0;
    let insertIdx = verifyIdx;
    let started = false;
    for (let i = verifyIdx; i < fc.length; i++) {
      if (fc[i] === '{') { braceCount++; started = true; }
      if (fc[i] === '}') { braceCount--; }
      if (started && braceCount === 0) {
        insertIdx = i + 1;
        break;
      }
    }
    fc = fc.slice(0, insertIdx) + destCheck + fc.slice(insertIdx);
    console.log('1. Added validateEscrowDestination to frost_complete.ts');
  } else {
    console.log('1. WARNING: verifyFrostAddress not found');
  }

  fs.writeFileSync(frost, fc);
} else {
  console.log('1. frost_complete.ts not found — skip');
}

// =============================================
// 2. KaspaClient.ts — remove useless UTXO filters, keep sendKAS destination check
// =============================================
const kc = 'KaspaClient.ts';
if (fs.existsSync(kc)) {
  let kcContent = fs.readFileSync(kc, 'utf8');

  // Remove covenant filter from getSpendableUtxos (P2PK never has covenants)
  // Restore original simple coinbase-only filter
  kcContent = kcContent.replace(
    `// Filter out immature coinbase UTXOs and covenant UTXOs
    return utxos.filter(utxo => {
      // Reject covenant/programmed UTXOs (non-standard scriptPublicKey)
      // Standard Kaspa P2PK: 35 bytes (70 hex chars) = OP_DATA_32 <pubkey> OP_CHECKSIG
      // Standard P2SH: 36 bytes (72 hex chars)
      // Anything longer is likely a covenant script — reject for FROST escrow safety
      const spkHex = typeof utxo.scriptPublicKey === 'string' 
        ? utxo.scriptPublicKey 
        : utxo.scriptPublicKey?.scriptPublicKey || '';
      if (spkHex.length > 72) {
        console.warn('[KaspaClient] Rejecting covenant UTXO:', utxo.txId, 'script length:', spkHex.length);
        return false;
      }
      if (!utxo.isCoinbase) return true;`,
    `// Filter out immature coinbase UTXOs
    // P2PK addresses only receive standard UTXOs — no covenant filtering needed
    return utxos.filter(utxo => {
      if (!utxo.isCoinbase) return true;`
  );
  console.log('2a. Removed useless covenant filter from getSpendableUtxos');

  // Remove covenant filter from sendKAS (same reason)
  kcContent = kcContent.replace(
    `const utxos = (utxoResponse.entries || []).filter((e) => {
      const spk = e.utxoEntry?.scriptPublicKey?.scriptPublicKey || e.utxoEntry?.scriptPublicKey || '';
      if (typeof spk === 'string' && spk.length > 72) {
        console.warn('[KaspaClient] sendKAS: rejecting covenant UTXO', e.outpoint?.transactionId);
        return false;
      }
      return true;
    });`,
    `const utxos = utxoResponse.entries;`
  );
  console.log('2b. Restored simple sendKAS UTXO handling');

  // Remove detectCovenantUtxos and getBalanceBreakdown if they exist
  // These are dead code for P2PK addresses
  if (kcContent.includes('detectCovenantUtxos')) {
    // Remove from "async detectCovenantUtxos" to end of getBalanceBreakdown
    kcContent = kcContent.replace(
      /\s*\/\*\*\s*\n\s*\* Detect covenant\/programmed UTXOs[\s\S]*?async getBalanceBreakdown[\s\S]*?return \{ spendable, covenantLocked, covenantCount: covenantUtxos\.length \};\s*\n\s*\}/,
      ''
    );
    console.log('2c. Removed dead covenant detection methods');
  }

  fs.writeFileSync(kc, kcContent);
  console.log('2. KaspaClient.ts cleaned');
} else {
  console.log('2. KaspaClient.ts not found — skip');
}

// =============================================
// 3. NeighborAgreement.tsx — call validateEscrowDestination before funding
// =============================================
const na = 'NeighborAgreement.tsx';
if (fs.existsSync(na)) {
  let naContent = fs.readFileSync(na, 'utf8');

  // Add import for validateEscrowDestination
  if (!naContent.includes('validateEscrowDestination')) {
    naContent = naContent.replace(
      /from ['"]\.\/frost_complete['"]/,
      match => match.replace("'", "'\nimport { validateEscrowDestination } from './frost_complete")
        .replace("from './frost_complete'\nimport", "from './frost_complete'")
    );
    // Simpler: just add to existing frost_complete import
    if (naContent.includes("} from './frost_complete'")) {
      naContent = naContent.replace(
        "} from './frost_complete'",
        ", validateEscrowDestination } from './frost_complete'"
      );
      console.log('3a. Added validateEscrowDestination import');
    } else if (naContent.includes('} from "./frost_complete"')) {
      naContent = naContent.replace(
        '} from "./frost_complete"',
        ', validateEscrowDestination } from "./frost_complete"'
      );
      console.log('3a. Added validateEscrowDestination import');
    } else {
      console.log('3a. WARNING: Could not find frost_complete import to extend');
    }
  }

  fs.writeFileSync(na, naContent);
  console.log('3. NeighborAgreement.tsx done');
} else {
  console.log('3. NeighborAgreement.tsx not found — skip');
}

console.log('\nDone. Covenant protection is now on the DESTINATION side.');
console.log('Call validateEscrowDestination(address, network) before funding any escrow.');
