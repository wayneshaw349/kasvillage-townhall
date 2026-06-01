const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');

// Re-disable auto-restore (keep if false)
if (s.includes('if (bestMatch && bestStep >= 4)')) {
  s = s.replace('if (bestMatch && bestStep >= 4)', 'if (false && bestMatch && bestStep >= 4)');
  console.log('FIX 1: Auto-restore re-disabled');
}

// Find the "No funded agreements" log line and add list population BEFORE it
const anchor = "console.log('[Arweave-Restore] No funded agreements — start fresh, use inbox');";
const idx = s.indexOf(anchor);
if (idx < 0) { console.log('Anchor not found'); process.exit(1); }

// Check if already patched
if (s.includes('Arweave-List] Populating')) { console.log('Already patched'); process.exit(0); }

// Insert list population code before the "No funded" log
// This runs AFTER the Arweave scan loop, so myActive has all agreements
const listCode = `
        // Populate Active Agreements list from Arweave scan (no auto-restore)
        const arweaveEntries = [];
        for (const agr of myActive) {
          const agrId = agr.agreementId || agr.agreement_id || '';
          const frostAddr = agr.frostAddress || '';
          const proposerPk = agr.pubkey || agr.partyA?.pubkey || '';
          const iAmProposer = proposerPk.startsWith(myPubkey.slice(0, 16));
          const buyerAmt = (agr.buyerAmountSompi || 0) / 1e8;
          const sellerAmt = (agr.sellerAmountSompi || 0) / 1e8;
          
          // Check L1 balance to determine step
          let derivedStep = 3;
          let bal = 0;
          if (frostAddr && frostAddr.length > 20) {
            try {
              const bResp = await fetch(apiBase + '/addresses/' + frostAddr + '/balance');
              if (bResp.ok) {
                bal = Number((await bResp.json()).balance || '0') / 1e8;
                if (bal >= (buyerAmt + sellerAmt) && (buyerAmt + sellerAmt) > 0) derivedStep = 4;
              }
            } catch {}
          }
          
          arweaveEntries.push({
            agrId,
            frostAddr,
            role: iAmProposer ? 'buyer' : 'seller',
            step: derivedStep,
            buyerAmount: buyerAmt,
            sellerAmount: sellerAmt,
            buyerPubkey: iAmProposer ? myPubkey : proposerPk,
            sellerPubkey: iAmProposer ? (agr.counterpartyPubkey || '') : myPubkey,
            description: agr.description || agrId.slice(0, 12),
            createdAt: Date.now(),
          });
        }
        if (arweaveEntries.length > 0) {
          console.log('[Arweave-List] Populating', arweaveEntries.length, 'active agreements');
          setFrostActiveList(arweaveEntries);
        }
`;

s = s.slice(0, idx) + listCode + '\n        ' + s.slice(idx);
fs.writeFileSync(f, s);
console.log('FIX 2: Active Agreements list populated from Arweave');
console.log('Verify:', s.includes('Arweave-List] Populating'));
