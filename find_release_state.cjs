const s=require('fs').readFileSync('NeighborAgreement.tsx','utf8').split(/\r?\n/);
s.forEach((l,n)=>{ if(/contract\.frostData|contract\.agreementId|contract\.multisigAddress|totalAmount|contract\.itemPriceKas|contract\.sellerCommitmentKas|kv_frost_nonce_|kv_frost_template_|contract\.buyerPubkey|contract\.sellerPubkey/.test(l) && /release|Release|step 5|partialRelease|buildRelease/.test(l)) console.log((n+1)+': '+l.trim().slice(0,130)); });
console.log('--- if empty, dump the release builder region instead ---');
