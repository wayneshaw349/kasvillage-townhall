const fs = require('fs');
const f = 'kaspa_rest_tx.ts';
let c = fs.readFileSync(f, 'utf8');

if (c.includes('buildRefundFrostTx')) { console.error('ABORT: already patched'); process.exit(1); }

// --- 1. Add optional lockTime to CanonicalFrostTx (default undefined -> treated as 0n) ---
const ifaceAnchor = `export interface CanonicalFrostTx {
  utxos: any[];
  inputs: { txId: Uint8Array; index: number; sequence: bigint; sigOpCount: number; scriptVersion: number; scriptPubKey: Uint8Array; value: bigint }[];
  outputs: { value: bigint; scriptVersion: number; script: Uint8Array }[];
  fee: bigint;
  totalIn: bigint;
}`;
if (c.split(ifaceAnchor).length - 1 !== 1) { console.error('ABORT: CanonicalFrostTx iface anchor not unique'); process.exit(1); }
const ifaceNew = ifaceAnchor.replace('  totalIn: bigint;\n}', '  totalIn: bigint;\n  lockTime?: bigint; // 0/undefined for release/cancel; set for timelocked refund\n}');
c = c.replace(ifaceAnchor, ifaceNew);

// --- 2. canonicalSighash: honor tx.lockTime (default 0n) ---
const sigAnchor = `  return computeSighash(0, tx.inputs, tx.outputs, inputIndex, subnetId, 0n, 0n, true, new Uint8Array(0));`;
if (c.split(sigAnchor).length - 1 !== 1) { console.error('ABORT: canonicalSighash anchor not unique'); process.exit(1); }
c = c.replace(sigAnchor, `  return computeSighash(0, tx.inputs, tx.outputs, inputIndex, subnetId, tx.lockTime ?? 0n, 0n, true, new Uint8Array(0));`);

// --- 3. submitCanonicalFrostTx: final tx uses tx.lockTime (default '0') ---
const submitAnchor = `      version: 0, inputs: signedInputs, outputs,
      lockTime: '0', subnetworkId: '0000000000000000000000000000000000000000', gas: '0', payload: '',`;
if (c.split(submitAnchor).length - 1 !== 1) { console.error('ABORT: submit lockTime anchor not unique'); process.exit(1); }
c = c.replace(submitAnchor, `      version: 0, inputs: signedInputs, outputs,
      lockTime: (tx.lockTime ?? 0n).toString(), subnetworkId: '0000000000000000000000000000000000000000', gas: '0', payload: '',`);

// --- 4. Add buildRefundFrostTx: 1 predicted-escrow-UTXO in, 1 own-address out, lockTime=fundDAA+N ---
// Insert right before buildCanonicalFrostTx.
const insertAt = c.indexOf('export async function buildCanonicalFrostTx');
if (insertAt === -1) { console.error('ABORT: buildCanonicalFrostTx not found'); process.exit(1); }
const refundFn = `export interface RefundFrostTxParams {
  predictedTxId: string;      // escrow output txid predicted via computeTxId
  escrowOutputIndex: number;  // 0
  depositSompi: bigint;       // the funder's deposit sitting at the escrow
  escrowScriptHex: string;    // scriptPubKey of the escrow output (frost address script)
  ownAddress: string;         // where the refund returns funds (the funder)
  fundDAA: bigint;            // current DAA score at funding time
  N: bigint;                  // timeout window in DAA
}

// Builds a timelocked refund tx: spends the (predicted) escrow UTXO back to the funder,
// valid only after fundDAA + N. Signing uses the same FROST 2-of-2 ceremony as release.
export function buildRefundFrostTx(params: RefundFrostTxParams): CanonicalFrostTx {
  const FEE = 10000n;
  const { predictedTxId, escrowOutputIndex, depositSompi, escrowScriptHex, ownAddress, fundDAA, N } = params;
  if (depositSompi <= FEE) throw new Error('Refund: deposit too low for fee');
  const escrowScript = hexToBytes(escrowScriptHex);
  const ownScript = addressToScript(ownAddress);
  const inputs = [{
    txId: hexToBytes(predictedTxId),
    index: escrowOutputIndex,
    sequence: 0n,
    sigOpCount: 1,
    scriptVersion: 0,
    scriptPubKey: escrowScript,
    value: depositSompi,
  }];
  const outputs = [{ value: depositSompi - FEE, scriptVersion: 0, script: ownScript }];
  const utxos = [{
    outpoint: { transactionId: predictedTxId, index: escrowOutputIndex },
    utxoEntry: { amount: depositSompi.toString(), scriptPublicKey: { scriptPublicKey: escrowScriptHex } },
  }];
  return { utxos, inputs, outputs, fee: FEE, totalIn: depositSompi, lockTime: fundDAA + N };
}

`;
c = c.slice(0, insertAt) + refundFn + c.slice(insertAt);

fs.writeFileSync(f, c);
console.log('OK — buildRefundFrostTx + lockTime threading added (release/cancel unchanged, default 0)');
