const fs = require('fs');
let f = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

const marker = "console.log('[Background-FROST] Restoring active session');";
const idx = f.indexOf(marker);
if (idx < 0) { console.log('Marker not found'); process.exit(1); }

// Find the if block: "if (bal > 0n || session.step >= 3) {"
const ifSearch = f.lastIndexOf('if (', idx);
const ifLine = f.substring(ifSearch, f.indexOf('{', ifSearch) + 1);
console.log('Found guard:', ifLine.trim());

// Find the closing brace of the if block
let depth = 0, blockEnd = -1;
for (let i = f.indexOf('{', ifSearch); i < f.length; i++) {
  if (f[i] === '{') depth++;
  if (f[i] === '}') { depth--; if (depth === 0) { blockEnd = i + 1; break; } }
}

const oldBlock = f.substring(ifSearch, blockEnd);
console.log('Old block:', oldBlock.length, 'chars');

// New block: verify Arweave acceptance before restoring
const newBlock = `if (bal > 0n || session.step >= 3) {
          // CANONICAL: verify Arweave acceptance before restoring
          let arweaveVerified = false;
          try {
            const myPub = session.contract?.buyerPubkey || session.contract?.sellerPubkey || '';
            const agrId = session.contract?.agreementId || '';
            if (agrId && myPub) {
              const arResults = await queryAgreementsFromArweave({ status: 'Accepted', network: 'testnet-10' });
              const myAcceptance = arResults?.find((ar: any) => {
                const arAgrId = ar.agreementId || ar.agreement_id || '';
                const arPubkey = ar.pubkey || ar.partyA?.pubkey || ar.partyB?.pubkey || '';
                return arAgrId.startsWith(agrId.slice(0, 12)) && 
                       (arPubkey.startsWith(myPub.slice(0, 16)) || ar.acceptedBy?.startsWith(myPub.slice(0, 16)));
              });
              if (myAcceptance) {
                arweaveVerified = true;
                console.log('[Background-FROST] Arweave acceptance VERIFIED for', agrId.slice(0, 12));
              } else if (bal > 0n) {
                // Funds locked but no acceptance found — still restore (user needs to deal with locked funds)
                arweaveVerified = true;
                console.log('[Background-FROST] No acceptance found but', Number(bal)/1e8, 'KAS locked — restoring anyway');
              } else {
                console.log('[Background-FROST] No acceptance + no funds — STALE session, skipping', agrId.slice(0, 12));
              }
            }
          } catch (e) {
            console.warn('[Background-FROST] Arweave check failed, restoring as fallback:', e);
            arweaveVerified = true; // fail-open to avoid losing funded sessions
          }

          if (arweaveVerified) {
            console.log('[Background-FROST] Restoring verified session');
            setStep(session.step);
            setRole(session.role);
            setAgreementType(session.agreementType);
            setContract(session.contract);
            setBuyerLocked(session.buyerLocked);
            setSellerLocked(session.sellerLocked);
            if (session.counterpartyAddress) setCounterpartyAddress(session.counterpartyAddress);
            if (session.counterpartyKaspaAddr) setCounterpartyKaspaAddr(session.counterpartyKaspaAddr);
          }
        }`;

f = f.substring(0, ifSearch) + newBlock + f.substring(blockEnd);
fs.writeFileSync('NeighborAgreement.tsx', f);

console.log('Background-FROST restore now verifies Arweave acceptance');
console.log('Emojis:', (f.match(/[\u{1F000}-\u{1FFFF}]/gu) || []).length);
console.log('arweaveVerified hits:', (f.match(/arweaveVerified/g) || []).length);
