const fs = require('fs');
let c = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

// After seller signs successfully, inscribe to Arweave with tracking
const signedLog = "console.log('[Ceremony-Seller] Signed! Response:', result.responseB64.length, 'chars');";
const signedIdx = c.indexOf(signedLog);
if (signedIdx > -1) {
  const arweaveInscription = `
                            // Inscribe signed + tracking to Arweave (dispute evidence)
                            try {
                              const _sWallet = await loadMainWallet();
                              if (_sWallet) {
                                const _sPk = (await SecureStore.getItemAsync('kv_public_key')) || '';
                                await inscribeAgreementToArweave({
                                  agreementId: contract.agreementId || '',
                                  pubkey: _sPk,
                                  amount_sompi: Math.floor((contract.itemPriceKas + contract.sellerCommitmentKas) * 1e8),
                                  description: (contract.itemDescription || '') + (sellerTrackingNum.trim() ? ' | Tracking: ' + sellerTrackingNum.trim() : ''),
                                  network: _sWallet.network || 'testnet-10',
                                  status: 'Signed',
                                  frostAddress: contract.multisigAddress || '',
                                  signature: 'seller_signed_' + Date.now(),
                                  counterpartyPubkey: contract.buyerPubkey || '',
                                  buyerAmountSompi: Math.floor(contract.itemPriceKas * 1e8),
                                  sellerAmountSompi: Math.floor(contract.sellerCommitmentKas * 1e8),
                                  trackingNumber: sellerTrackingNum.trim() || undefined,
                                });
                                console.log('[Ceremony-Seller] Inscribed to Arweave' + (sellerTrackingNum.trim() ? ' with tracking: ' + sellerTrackingNum.trim() : ''));
                              }
                            } catch (e) { console.warn('[Ceremony-Seller] Arweave inscription failed (non-fatal):', e); }
`;
  c = c.substring(0, signedIdx + signedLog.length) + arweaveInscription + c.substring(signedIdx + signedLog.length);
  console.log('1. Added Arweave inscription after seller signs');
} else {
  console.log('1. Signed log marker not found');
}

// Add trackingNumber to the inscribeAgreementToArweave tag builder in townhall_client.ts
let tc = fs.readFileSync('townhall_client.ts', 'utf8');
// Find the tag builder in inscribeAgreementToArweave
const tagBuilder = "{ name: 'KV-SellerAmount', value: String(params.sellerAmountSompi";
const tagIdx = tc.indexOf(tagBuilder);
if (tagIdx > -1) {
  const lineEnd = tc.indexOf("},", tagIdx) + 2;
  const trackingTag = `\n    ...(params.trackingNumber ? [{ name: 'KV-TrackingNumber', value: params.trackingNumber }] : []),`;
  // Check if already added
  if (!tc.includes("KV-TrackingNumber")) {
    tc = tc.substring(0, lineEnd) + trackingTag + tc.substring(lineEnd);
    console.log('2. Added KV-TrackingNumber tag to townhall_client.ts');
    fs.writeFileSync('townhall_client.ts', tc);
  } else {
    console.log('2. KV-TrackingNumber tag already exists');
  }
} else {
  console.log('2. Tag builder not found — add trackingNumber to inscribeAgreementToArweave params manually');
}

// Also add trackingNumber to the function's type/params
const paramType = "counterpartyPubkey?: string;";
const paramIdx = tc.indexOf(paramType, tc.indexOf("inscribeAgreementToArweave"));
if (paramIdx > -1 && !tc.includes("trackingNumber?: string")) {
  tc = tc.substring(0, paramIdx + paramType.length) + "\n  trackingNumber?: string;" + tc.substring(paramIdx + paramType.length);
  console.log('3. Added trackingNumber to params type');
  fs.writeFileSync('townhall_client.ts', tc);
}

fs.writeFileSync('NeighborAgreement.tsx', c);
console.log('Done');
