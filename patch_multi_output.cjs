const fs = require('fs');
const f = 'canonical_agreement_steps.ts';
let s = fs.readFileSync(f, 'utf8');

const afterSeller = "export interface SellerResponse {\n  R: string;       // Seller R nonce (compressed point hex)\n  s: string[];     // Partial s values (one per input, hex)\n}";
if (!s.includes(afterSeller)) { console.log('SellerResponse anchor not found'); process.exit(1); }
if (s.includes('ReleaseMode')) { console.log('Already patched'); process.exit(0); }

s = s.replace(afterSeller, afterSeller + `

// ============================================================================
// RELEASE MODES
// ============================================================================

/** How funds leave the FROST address */
export type ReleaseMode = 'release' | 'cancel' | 'split';

/**
 * Compute outputs for each release mode.
 * 
 * release: Trade complete — all funds to seller (payment + collateral return)
 * cancel:  Mutual cancellation — each party's collateral returns to them
 * split:   Dispute resolution — custom division agreed by both parties
 */
export function computeReleaseOutputs(
  mode: ReleaseMode,
  totalIn: bigint,
  fee: bigint,
  partyA_depositSompi: bigint,
  partyB_depositSompi: bigint,
  partyA_xOnly: string,
  partyB_xOnly: string,
  customPartyA_gets?: bigint,
): { outputs: TxTemplateOutput[]; description: string } {
  const net = totalIn - fee;
  const scriptA = p2pkScript(partyA_xOnly);
  const scriptB = p2pkScript(partyB_xOnly);

  switch (mode) {
    case 'release': {
      // Trade complete: seller (party receiving payment) gets everything
      // Caller determines which party is the recipient
      // Single output avoids 0-value UTXO
      return {
        outputs: [{ v: net.toString(), s: scriptB }],
        description: 'Agreement complete: ' + (Number(net) / 1e8).toFixed(4) + ' KAS released',
      };
    }
    case 'cancel': {
      // Mutual cancellation: each gets their original collateral back
      // Fee deducted from larger deposit (or split proportionally)
      const totalDeposit = partyA_depositSompi + partyB_depositSompi;
      let aGets = 0n;
      let bGets = 0n;
      if (totalDeposit > 0n) {
        // Proportional fee split
        aGets = (net * partyA_depositSompi) / totalDeposit;
        bGets = net - aGets;
      }
      const outs: TxTemplateOutput[] = [];
      if (aGets > 0n) outs.push({ v: aGets.toString(), s: scriptA });
      if (bGets > 0n) outs.push({ v: bGets.toString(), s: scriptB });
      return {
        outputs: outs,
        description: 'Cancellation: Party A receives ' + (Number(aGets) / 1e8).toFixed(4) + ', Party B receives ' + (Number(bGets) / 1e8).toFixed(4) + ' KAS',
      };
    }
    case 'split': {
      // Dispute resolution: arbitrary split agreed by both parties
      const aGets = customPartyA_gets || 0n;
      const bGets = net - aGets;
      const outs: TxTemplateOutput[] = [];
      if (aGets > 0n) outs.push({ v: aGets.toString(), s: scriptA });
      if (bGets > 0n) outs.push({ v: bGets.toString(), s: scriptB });
      return {
        outputs: outs,
        description: 'Settlement: Party A receives ' + (Number(aGets) / 1e8).toFixed(4) + ', Party B receives ' + (Number(bGets) / 1e8).toFixed(4) + ' KAS',
      };
    }
  }
}

/**
 * Build TX template with configurable release mode.
 * Supports: release (1 output), cancel (2 outputs), split (1-2 outputs).
 * Uses the same signing ceremony as buyerBuildTemplate.
 */
export function buildReleaseTemplate(params: {
  utxos: { txId: string; index: number; amount: string; scriptPubKey: string }[];
  partyA_xOnly: string;
  partyB_xOnly: string;
  partyA_depositSompi: bigint;
  partyB_depositSompi: bigint;
  mode: ReleaseMode;
  customPartyA_gets?: bigint;
  fee?: bigint;
  R_hex: string;
  agrId: string;
}): { template: TxTemplate; description: string } {
  const sorted = [...params.utxos].sort((a, b) => a.txId.localeCompare(b.txId));
  const totalIn = sorted.reduce((s, u) => s + BigInt(u.amount), 0n);
  const numOutputs = params.mode === 'release' ? 1 : 2;
  const fee = params.fee || BigInt(sorted.length * 157000 + numOutputs * 500 + 5400);

  const { outputs, description } = computeReleaseOutputs(
    params.mode, totalIn, fee,
    params.partyA_depositSompi, params.partyB_depositSompi,
    params.partyA_xOnly, params.partyB_xOnly,
    params.customPartyA_gets,
  );

  return {
    template: {
      u: sorted.map((u) => ({ t: u.txId, i: u.index, a: u.amount, s: u.scriptPubKey })),
      o: outputs,
      f: fee.toString(),
      R: params.R_hex,
      agr: params.agrId,
    },
    description,
  };
}
`);

const afterEncode = "export function encodeTemplate(template: TxTemplate): string {\n  return btoa(JSON.stringify(template));\n}";
if (!s.includes(afterEncode)) { console.log('encodeTemplate anchor not found — already moved?'); }

fs.writeFileSync(f, s);
console.log('Added: ReleaseMode (release/cancel/split), computeReleaseOutputs, buildReleaseTemplate');
console.log('Verify ReleaseMode:', s.includes("export type ReleaseMode = 'release' | 'cancel' | 'split'"));
console.log('Verify computeReleaseOutputs:', s.includes('computeReleaseOutputs'));
console.log('Verify buildReleaseTemplate:', s.includes('buildReleaseTemplate'));
console.log('Verify no refund:', !s.includes("'refund'"));
