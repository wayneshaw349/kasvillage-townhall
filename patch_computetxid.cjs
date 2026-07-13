const fs = require('fs');
const f = 'kaspa_rest_tx.ts';
let c = fs.readFileSync(f, 'utf8');

if (c.includes('export function computeTxId')) { console.error('ABORT: already has computeTxId'); process.exit(1); }

// Anchor: insert right after the hashBlake2b function (known unique).
const anchor = 'function hashBlake2b(data: Uint8Array): Uint8Array {';
if (c.split(anchor).length - 1 !== 1) { console.error('ABORT: hashBlake2b anchor not unique'); process.exit(1); }

// Find the end of hashBlake2b (its closing brace) to insert after it.
const startIdx = c.indexOf(anchor);
const braceStart = c.indexOf('{', startIdx);
// naive brace match for this short fn
let depth = 0, endIdx = -1;
for (let i = braceStart; i < c.length; i++) {
  if (c[i] === '{') depth++;
  else if (c[i] === '}') { depth--; if (depth === 0) { endIdx = i + 1; break; } }
}
if (endIdx === -1) { console.error('ABORT: could not find end of hashBlake2b'); process.exit(1); }

const TXID_KEY = "new TextEncoder().encode('TransactionID')";

const block = `

// ============================================================================
// TRANSACTION ID (v0) — verified against rusty-kaspa consensus test vectors
// Serialize: version u16 | inputs_len u64 | per-input[outpoint 32 + index u32 +
//   empty-var-bytes(sig excluded) + sequence u64] | outputs_len u64 |
//   per-output[value u64 + spk_version u16 + script var-bytes] | lockTime u64 |
//   subnetwork 20b | gas u64 | payload var-bytes.  (mass + sig_op_count excluded)
// Hash: blake2b-256 keyed with utf8 "TransactionID".
// ============================================================================
const TXID_HASH_KEY = ${TXID_KEY};
function _varBytes(b: Uint8Array): Uint8Array { return concat(writeU64LE(BigInt(b.length)), b); }

export interface TxIdInput { prevTxId: string; prevIndex: number; sequence: bigint; }
export interface TxIdOutput { amount: bigint; scriptVersion: number; scriptHex: string; }
export interface TxIdTx {
  version: number;
  inputs: TxIdInput[];
  outputs: TxIdOutput[];
  lockTime: bigint;
  subnetworkId: string; // 40-hex (20 bytes)
  gas: bigint;
  payloadHex: string;   // '' for empty
}

export function computeTxId(tx: TxIdTx): string {
  if (tx.version !== 0) throw new Error('computeTxId: only v0 supported');
  const parts: Uint8Array[] = [];
  parts.push(writeU16LE(tx.version));
  parts.push(writeU64LE(BigInt(tx.inputs.length)));
  for (const inp of tx.inputs) {
    parts.push(hexToBytes(inp.prevTxId));
    parts.push(writeU32LE(inp.prevIndex));
    parts.push(_varBytes(new Uint8Array(0)));      // signature script excluded
    parts.push(writeU64LE(inp.sequence));          // sig_op_count excluded (inside excluded block)
  }
  parts.push(writeU64LE(BigInt(tx.outputs.length)));
  for (const out of tx.outputs) {
    parts.push(writeU64LE(out.amount));
    parts.push(writeU16LE(out.scriptVersion));
    parts.push(_varBytes(hexToBytes(out.scriptHex)));
  }
  parts.push(writeU64LE(tx.lockTime));
  parts.push(hexToBytes(tx.subnetworkId));
  parts.push(writeU64LE(tx.gas));
  parts.push(_varBytes(tx.payloadHex ? hexToBytes(tx.payloadHex) : new Uint8Array(0)));
  const preimage = concat(...parts);
  return bytesToHex(blake2b(preimage, { dkLen: 32, key: TXID_HASH_KEY } as any));
}
`;

c = c.slice(0, endIdx) + block + c.slice(endIdx);
fs.writeFileSync(f, c);
console.log('OK — computeTxId added after hashBlake2b');
