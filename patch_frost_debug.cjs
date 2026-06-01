const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');

// Add logging after buyerAggregate call
const anchor = "if ('error' in aggResult) { Alert.alert('Aggregation Failed', aggResult.error); return; }";
if (!s.includes(anchor)) { console.log('Anchor not found'); process.exit(1); }
if (s.includes('FROST-DEBUG-AGG')) { console.log('Already patched'); process.exit(0); }

const logging = `
      // [FROST-DEBUG-AGG] Granular ceremony logging (testnet only)
      console.log('[FROST-DEBUG-AGG] Inputs:', aggResult.txBody?.transaction?.inputs?.length);
      console.log('[FROST-DEBUG-AGG] Outputs:', aggResult.txBody?.transaction?.outputs?.length);
      for (let di = 0; di < (aggResult.signatures || []).length; di++) {
        const sig = aggResult.signatures[di];
        console.log('[FROST-DEBUG-AGG] Sig[' + di + ']:', sig?.slice(0, 40) + '...');
      }
      // Log each input's script and sig
      const txInputs = aggResult.txBody?.transaction?.inputs || [];
      for (let di = 0; di < txInputs.length; di++) {
        const inp = txInputs[di];
        console.log('[FROST-DEBUG-AGG] Input[' + di + '] prevTx:', inp?.previousOutpoint?.transactionId?.slice(0, 16));
        console.log('[FROST-DEBUG-AGG] Input[' + di + '] sigScript:', inp?.signatureScript?.slice(0, 40));
        console.log('[FROST-DEBUG-AGG] Input[' + di + '] sigLen:', (inp?.signatureScript || '').length / 2, 'bytes');
      }
      const txOutputs = aggResult.txBody?.transaction?.outputs || [];
      for (let di = 0; di < txOutputs.length; di++) {
        const out = txOutputs[di];
        console.log('[FROST-DEBUG-AGG] Output[' + di + '] amount:', out?.amount, 'script:', out?.scriptPublicKey?.scriptPublicKey?.slice(0, 20));
      }
      console.log('[FROST-DEBUG-AGG] Template R:', template?.R?.slice(0, 40));
      console.log('[FROST-DEBUG-AGG] Seller R:', resp?.R?.slice(0, 40));
      console.log('[FROST-DEBUG-AGG] Buyer pubkey:', contract.buyerPubkey?.slice(0, 20));
      console.log('[FROST-DEBUG-AGG] Seller pubkey:', contract.sellerPubkey?.slice(0, 20));
      console.log('[FROST-DEBUG-AGG] FROST addr:', contract.frostData?.address?.slice(0, 30));
`;

s = s.replace(anchor, anchor + logging);

// Also log the L1 rejection details
const l1Anchor = "Alert.alert('L1 Failed', (await submitResp.text()).slice(0, 200));";
if (s.includes(l1Anchor)) {
  s = s.replace(l1Anchor, `const l1Error = await submitResp.text(); console.log('[FROST-L1-REJECT]', l1Error.slice(0, 500)); Alert.alert('L1 Failed', l1Error.slice(0, 300));`);
}

fs.writeFileSync(f, s);
console.log('Done: granular FROST ceremony logging');
console.log('Verify:', s.includes('FROST-DEBUG-AGG'));
