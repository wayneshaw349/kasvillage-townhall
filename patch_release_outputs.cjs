const fs = require('fs');
let c = fs.readFileSync('canonical_agreement_steps.ts', 'utf8');

// 1. Remove 'split' from ReleaseMode type
c = c.replace(
  "export type ReleaseMode = 'release' | 'cancel' | 'split';",
  "export type ReleaseMode = 'release' | 'cancel';"
);
console.log('1. ReleaseMode: removed split');

// 2. Remove split case from computeReleaseOutputs
const splitCase = `    case 'split': {
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
    }`;
if (c.includes(splitCase)) {
  c = c.replace(splitCase, '');
  console.log('2. Removed split case');
} else { console.log('2. SKIP - split case not found'); }

// 3. Remove customPartyA_gets param from computeReleaseOutputs
c = c.replace(
  '  customPartyA_gets?: bigint,\n',
  ''
);
console.log('3. Removed customPartyA_gets param');

// 4. Remove customPartyA_gets from buildReleaseTemplate
c = c.replace(
  '  customPartyA_gets?: bigint;\n',
  ''
);
c = c.replace(
  '    params.customPartyA_gets,\n',
  ''
);
console.log('4. Cleaned buildReleaseTemplate');

// 5. Add releaseMode + sellerAmountSompi to buyerBuildTemplate params
const oldParams = `  buyerAmountSompi: bigint;
  fee?: bigint;
  agrId: string;`;
const newParams = `  buyerAmountSompi: bigint;
  sellerAmountSompi?: bigint;
  releaseMode?: ReleaseMode;
  fee?: bigint;
  agrId: string;`;
if (c.includes(oldParams)) {
  c = c.replace(oldParams, newParams);
  console.log('5. Added releaseMode + sellerAmountSompi params');
} else { console.log('5. SKIP'); }

// 6. Fix fee calc for 1 vs 2 outputs
const oldFee = `  const fee = params.fee || BigInt(params.utxos.length * 115000 + 2 * 48000 + 5000);`;
const newFee = `  const numOutputs = (params.releaseMode || 'release') === 'release' ? 1 : 2;
  const fee = params.fee || BigInt(params.utxos.length * 115000 + numOutputs * 48000 + 5000);`;
if (c.includes(oldFee)) {
  c = c.replace(oldFee, newFee);
  console.log('6. Fixed fee calc');
} else { console.log('6. SKIP'); }

// 7. Replace buildTemplate call with computeReleaseOutputs
const oldBuild = `  const template = buildTemplate({
    utxos: params.utxos,
    buyerXOnly,
    sellerXOnly,
    buyerAmountSompi: params.buyerAmountSompi,
    fee,
    buyerR_hex: nonce.R_hex,
    agrId: params.agrId,
  });`;
const newBuild = `  const mode: ReleaseMode = params.releaseMode || 'release';
  const sorted = [...params.utxos].sort((a, b) => a.txId.localeCompare(b.txId));
  const totalIn = sorted.reduce((s, u) => s + BigInt(u.amount), 0n);
  const sellerDeposit = params.sellerAmountSompi ?? (totalIn - params.buyerAmountSompi - fee);

  const { outputs } = computeReleaseOutputs(
    mode, totalIn, fee,
    params.buyerAmountSompi, sellerDeposit,
    buyerXOnly, sellerXOnly,
  );

  const template: TxTemplate = {
    u: sorted.map((u) => ({ t: u.txId, i: u.index, a: u.amount, s: u.scriptPubKey })),
    o: outputs,
    f: fee.toString(),
    R: nonce.R_hex,
    agr: params.agrId,
  };`;
if (c.includes(oldBuild)) {
  c = c.replace(oldBuild, newBuild);
  console.log('7. Replaced buildTemplate with computeReleaseOutputs');
} else { console.log('7. SKIP'); }

fs.writeFileSync('canonical_agreement_steps.ts', c);
console.log('Done');
