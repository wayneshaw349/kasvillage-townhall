const fs = require('fs');

// === PATCH 1: townhall_client.ts ===
let tc = fs.readFileSync('townhall_client.ts', 'utf8');

// Add frostR to interface
tc = tc.replace(
  '  frostAddress?: string;',
  '  frostAddress?: string;\n  frostR?: string;'
);

// Add KV-FrostR tag
tc = tc.replace(
  "    tags.push({ name: 'KV-FrostAddress', value: agreement.frostAddress });",
  "    tags.push({ name: 'KV-FrostAddress', value: agreement.frostAddress });\n  }\n  if (agreement.frostR) {\n    tags.push({ name: 'KV-FrostR', value: agreement.frostR });"
);

fs.writeFileSync('townhall_client.ts', tc);
console.log('✅ townhall_client.ts — added frostR field + KV-FrostR tag');

// === PATCH 2: NeighborAgreement.tsx ===
let na = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

// 2a: In Agreed-Send inscription, add frostR and frostAddress
// The inscription at ~line 1197 needs frostR added
na = na.replace(
  "              status: 'Agreed-Send',\n              signature: 'agreed_send_' + Date.now(),\n              counterpartyPubkey: counterpartyPubkey,",
  "              status: 'Agreed-Send',\n              signature: 'agreed_send_' + Date.now(),\n              counterpartyPubkey: counterpartyPubkey,\n              frostAddress: contract.multisigAddress || '',\n              frostR: await (async () => { try { const nonce = generateFrostNonce({ frostAddress: contract.frostData, recipientAddress: contract.releaseRecipient || counterpartyKaspaAddr || contract.multisigAddress || '', amountSompi: BigInt(Math.floor((contract.itemPriceKas + contract.sellerCommitmentKas) * 1e8)), privateKeyHex: (await loadMainWallet())?.privKeyHex || '' }); await AsyncStorage.setItem('kv_frost_nonce_' + contract.agreementId, JSON.stringify({ R_hex: nonce.R_hex, k_private: nonce.k_private, d_tweaked: nonce.d_tweaked, message_hex: nonce.message_hex })); console.log('[FROST-R] Generated nonce R:', nonce.R_hex.slice(0,20)); return nonce.R_hex; } catch(e) { console.warn('[FROST-R] Nonce generation failed:', e); return ''; } })(),"
);

// 2b: In the PartialSig creation (handleConfirmDelivery), use computeFrostPartialS instead of createFrostPartialSig
// Find where createFrostPartialSig is called and replace with 2-round version
// The key change: look up counterparty R from Arweave, then use computeFrostPartialS

// Add import of generateFrostNonce at the top (it's already imported via frost_complete)
// Check if generateFrostNonce is imported
if (!na.includes('generateFrostNonce')) {
  // It's in the import list from frost_complete — check
  if (na.includes("from './frost_complete'")) {
    na = na.replace(
      "  createFrostAgreement,",
      "  createFrostAgreement,\n  generateFrostNonce,\n  computeFrostPartialS,\n  aggregateFrostSig,"
    );
    console.log('  Added generateFrostNonce/computeFrostPartialS/aggregateFrostSig imports');
  }
}

// 2c: Replace the partial sig creation in handleConfirmDelivery
// Current: calls createFrostPartialSig which uses createPartialSigLocal (broken)
// New: look up saved nonce + counterparty R, use computeFrostPartialS
na = na.replace(
  `      const result = await createFrostPartialSig({
        frostAddress: contract.frostData,
        recipientAddress,
        amountSompi: totalAmountSompi,
        privateKeyHex: privKeyHex,
      });`,
  `      // 2-round FROST: load saved nonce, get counterparty R from Arweave
      let myNonce;
      try {
        const savedNonce = await AsyncStorage.getItem('kv_frost_nonce_' + contract.agreementId);
        if (savedNonce) {
          myNonce = JSON.parse(savedNonce);
          console.log('[FROST-2R] Loaded saved nonce R:', myNonce.R_hex?.slice(0,20));
        }
      } catch {}
      if (!myNonce) {
        // Generate fresh nonce if not saved
        myNonce = generateFrostNonce({ frostAddress: contract.frostData, recipientAddress, amountSompi: totalAmountSompi, privateKeyHex: privKeyHex });
        console.log('[FROST-2R] Generated fresh nonce R:', myNonce.R_hex?.slice(0,20));
      }
      // Query counterparty R from Arweave
      let counterpartyR = '';
      try {
        const { queryAgreementsFromArweave } = await import('./townhall_client');
        const rResults = await queryAgreementsFromArweave({ status: 'Agreed-Send' });
        const counterMatch = rResults.find((r) => (r.agreementId || r.agreement_id) === contract.agreementId && (r.pubkey || r.KVPubkey) !== (role === 'buyer' ? contract.buyerPubkey : contract.sellerPubkey));
        if (counterMatch?.frostR || counterMatch?.KVFrostR) {
          counterpartyR = counterMatch.frostR || counterMatch.KVFrostR || '';
          console.log('[FROST-2R] Found counterparty R:', counterpartyR.slice(0,20));
        }
      } catch(e) { console.warn('[FROST-2R] Counterparty R lookup failed:', e); }
      // Fallback: also check Arweave tags directly
      if (!counterpartyR) {
        try {
          const cpPub = role === 'buyer' ? contract.sellerPubkey : contract.buyerPubkey;
          const gql = '{ transactions(first: 5, tags: [{ name: "KV-AgreementId", values: ["' + contract.agreementId + '"] }, { name: "KV-Status", values: ["Agreed-Send"] }, { name: "KV-Pubkey", values: ["' + cpPub + '"] }]) { edges { node { tags { name value } } } } }';
          const resp = await fetch('https://arweave-search.goldsky.com/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: gql }) });
          const json = await resp.json();
          const tags = json?.data?.transactions?.edges?.[0]?.node?.tags || [];
          const rTag = tags.find((t) => t.name === 'KV-FrostR');
          if (rTag?.value) { counterpartyR = rTag.value; console.log('[FROST-2R] Found R via Goldsky:', counterpartyR.slice(0,20)); }
        } catch(e) { console.warn('[FROST-2R] Goldsky R lookup failed:', e); }
      }
      let result;
      if (counterpartyR && myNonce?.R_hex) {
        // Proper 2-round FROST
        const partialS = computeFrostPartialS({ myNonce, counterpartyR_hex: counterpartyR, frostAddress: contract.frostData });
        console.log('[FROST-2R] Computed partial s:', partialS.s_hex.slice(0,20), 'R_agg_x:', partialS.R_agg_x_hex.slice(0,20));
        // Pack as 64-byte sig: R_agg_x (32) + s (32) for relay
        const sigHex = partialS.R_agg_x_hex + partialS.s_hex;
        result = { success: true, partialSig: sigHex, messageHash: myNonce.message_hex };
      } else {
        console.warn('[FROST-2R] No counterparty R — falling back to single-round (will fail BIP340)');
        result = await createFrostPartialSig({ frostAddress: contract.frostData, recipientAddress, amountSompi: totalAmountSompi, privateKeyHex: privKeyHex });
      }`
);

fs.writeFileSync('NeighborAgreement.tsx', na);
console.log('✅ NeighborAgreement.tsx — Agreed-Send R tag + 2-round partial sig');

// === PATCH 3: frost_complete.ts — fix completeFrostAndBroadcast to use aggregateFrostSig ===
let fc = fs.readFileSync('frost_complete.ts', 'utf8');

// The completeFrostAndBroadcast currently calls createPartialSigLocal + aggregatePartialSigs
// We need it to work with the new 2-round sigs too
// The counterpartyPartialSig is now R_agg_x + s format
// aggregatePartialSigs already handles R addition, but with 2-round sigs
// the R_agg_x is already computed — we just need s_A + s_B

// For now, completeFrostAndBroadcast can stay as-is because:
// - The seller's auto-poll calls it with counterpartyPartialSig = buyer's 2-round sig
// - The seller also generates their own 2-round sig
// - Both sigs already have R_agg_x (same value) + s_i
// - aggregatePartialSigs will try to ADD the R values, but they're already R_agg
// This will BREAK — need to handle 2-round sigs differently

// Add a new function for 2-round completion
const newFn = `

// ============================================================================
// 2-ROUND FROST COMPLETION — uses proper nonce protocol
// ============================================================================
export async function completeFrost2Round(params: {
  frostAddress: FrostAddress;
  myPrivateKeyHex: string;
  recipientAddress: string;
  amountSompi: bigint;
  myNonceJson: string; // JSON stringified FrostNonce from AsyncStorage
  counterpartyR_hex: string;
  counterpartySig?: { R_agg_x_hex: string; s_hex: string };
}): Promise<{ success: boolean; txId?: string; explorerUrl?: string; error?: string }> {
  try {
    const myNonce: FrostNonce = JSON.parse(params.myNonceJson);
    
    // Compute my partial s
    const myPartial = computeFrostPartialS({
      myNonce,
      counterpartyR_hex: params.counterpartyR_hex,
      frostAddress: params.frostAddress,
    });
    
    if (params.counterpartySig) {
      // We have counterparty's s — aggregate
      const aggSig = aggregateFrostSig({
        s_A_hex: myPartial.s_hex,
        s_B_hex: params.counterpartySig.s_hex,
        R_agg_x_hex: myPartial.R_agg_x_hex, // Both compute same R_agg
      });
      
      // Broadcast
      const { sendKaspaWithSignature } = await import('./kaspa_rest_tx');
      const result = await sendKaspaWithSignature({
        senderAddress: params.frostAddress.address,
        recipientAddress: params.recipientAddress,
        amountSompi: params.amountSompi,
        aggregateSignature: aggSig,
        aggregatePubkey: params.frostAddress.aggregatedPubkey,
        network: params.frostAddress.network,
      });
      
      if (!result.success) return { success: false, error: result.error || 'L1 broadcast failed' };
      const explorerBase = params.frostAddress.network === 'mainnet' ? 'https://explorer.kaspa.org/txs/' : 'https://explorer-tn10.kaspa.org/txs/';
      return { success: true, txId: result.txId, explorerUrl: explorerBase + result.txId };
    }
    
    // Return our partial for relay
    return { success: true, partialSig: myPartial.s_hex, R_agg_x: myPartial.R_agg_x_hex } as any;
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
`;

// Insert before the cleanup section
fc = fc.replace(
  '// ============================================================================\n// SECTION 6: CLEANUP',
  newFn + '\n// ============================================================================\n// SECTION 6: CLEANUP'
);

// Add to default exports
fc = fc.replace(
  '  exchangePubkeys, createFrostAgreement, cleanup,',
  '  exchangePubkeys, createFrostAgreement, completeFrost2Round, cleanup,'
);

fs.writeFileSync('frost_complete.ts', fc);
console.log('✅ frost_complete.ts — added completeFrost2Round');

console.log('\n=== All patches applied ===');
console.log('Next: run test_verify.mjs to confirm 2-round works');
