const fs = require('fs');

// =============================================
// 1. KaspaClient.ts — minimum fee + covenant filter
// =============================================
const kc = 'KaspaClient.ts';
let kcContent = fs.readFileSync(kc, 'utf8');

// 1a. Minimum fee rate 1 → 100 (Toccata minimum)
kcContent = kcContent.replace(
  "return 1; // Minimum relay fee",
  "return 100; // Toccata minimum: 100 sompi/gram"
);
console.log('1a. Updated minimum fee rate to 100 sompi/gram');

// 1b. Add covenant UTXO filter to getSpendableUtxos
// Standard P2PK scripts are exactly 35 bytes (70 hex chars): OP_DATA_32 <32-byte-pubkey> OP_CHECKSIG
// Covenant scripts will be longer/different
kcContent = kcContent.replace(
  "// Filter out immature coinbase UTXOs\n    return utxos.filter(utxo => {\n      if (!utxo.isCoinbase) return true;",
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
      if (!utxo.isCoinbase) return true;`
);
console.log('1b. Added covenant UTXO filter');

fs.writeFileSync(kc, kcContent);
console.log('1. KaspaClient.ts updated');

// =============================================
// 2. canonical_agreement_steps.ts — fee estimation + covenant check
// =============================================
const ca = 'canonical_agreement_steps.ts';
if (fs.existsSync(ca)) {
  let caContent = fs.readFileSync(ca, 'utf8');

  // 2a. Update MIN_FEE to include Toccata comment
  caContent = caContent.replace(
    "export const MIN_FEE_SOMPI = 300000n;         // KIP-9 safe minimum",
    "export const MIN_FEE_SOMPI = 300000n;         // KIP-9 safe minimum (above Toccata 100 sompi/gram)"
  );
  console.log('2a. Updated MIN_FEE comment');

  // 2b. Add REST API fee estimation function after MIN_FEE_SOMPI line
  const feeEstFn = `

// Toccata-compatible: fetch fee estimate from REST API
// Falls back to hardcoded formula if API unavailable
export async function fetchFeeEstimate(
  network: 'mainnet' | 'testnet-10' = 'testnet-10'
): Promise<bigint> {
  const api = network === 'mainnet' ? 'api.kaspa.org' : 'api-tn10.kaspa.org';
  try {
    const resp = await fetch(\`https://\${api}/info/fee-estimate\`);
    if (!resp.ok) throw new Error(\`Fee API: \${resp.status}\`);
    const data = await resp.json();
    // priorityBucket.feerate is sompi/gram — multiply by estimated mass
    const feeRate = data?.priorityBucket?.feerate || data?.priority_bucket?.feerate || 100;
    // Typical FROST tx: ~2500 grams (2-in, 2-out)
    const estimatedMass = 2500;
    const fee = BigInt(Math.ceil(feeRate * estimatedMass));
    return fee < MIN_FEE_SOMPI ? MIN_FEE_SOMPI : fee;
  } catch {
    return MIN_FEE_SOMPI; // Fallback to safe minimum
  }
}`;

  caContent = caContent.replace(
    "export const MIN_FEE_SOMPI = 300000n;         // KIP-9 safe minimum (above Toccata 100 sompi/gram)",
    "export const MIN_FEE_SOMPI = 300000n;         // KIP-9 safe minimum (above Toccata 100 sompi/gram)" + feeEstFn
  );
  console.log('2b. Added fetchFeeEstimate function');

  fs.writeFileSync(ca, caContent);
  console.log('2. canonical_agreement_steps.ts updated');
} else {
  console.log('2. canonical_agreement_steps.ts not found — skip');
}

console.log('\nDone. Run: cargo check && npx tsc --noEmit');
