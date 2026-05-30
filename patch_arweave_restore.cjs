const fs = require('fs');
let f = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

// Find the old restore useEffect block
const marker = "console.log('[Neighbor] Restoring session at step', session.step);";
const altMarker = "console.log('[Neighbor] SKIP auto-restore";
const idx = f.indexOf(marker);
const altIdx = f.indexOf(altMarker);

if (idx < 0 && altIdx < 0) {
  console.log('Restore block not found');
  process.exit(1);
}

// Find the useEffect that contains the restore
const searchFrom = idx >= 0 ? idx : altIdx;

// Walk backward to find "useEffect(() => {"
let useEffectStart = f.lastIndexOf('useEffect(() => {', searchFrom);
// Walk further back to find the outer "(async () => {" wrapper
let outerStart = f.lastIndexOf('(async () => {', searchFrom);
if (outerStart > useEffectStart) useEffectStart = f.lastIndexOf('useEffect', outerStart);

// Find the matching closing: "}, []);"
// Look for the pattern after the useEffect body
let depth = 0, blockEnd = -1;
const bodyStart = f.indexOf('{', useEffectStart);
for (let i = bodyStart; i < f.length; i++) {
  if (f[i] === '{') depth++;
  if (f[i] === '}') {
    depth--;
    if (depth === 0) {
      // Check if followed by ", []);" pattern
      const after = f.substring(i, i + 20).trim();
      if (after.startsWith('}, [])') || after.startsWith('})\n') || after.startsWith('} })()')) {
        // Find the full end: "}, []);"
        blockEnd = f.indexOf(';', i) + 1;
        break;
      }
    }
  }
}

if (blockEnd < 0) {
  console.log('Could not find end of restore useEffect');
  // Fallback: just replace the restore line
  if (idx >= 0) {
    f = f.replace(marker, "// REPLACED: Arweave inbox restore handles session recovery");
  } else {
    f = f.replace(altMarker + "'); return;", "// REPLACED: Arweave inbox restore handles session recovery");
  }
  fs.writeFileSync('NeighborAgreement.tsx', f);
  console.log('Fallback: replaced restore line only');
  process.exit(0);
}

console.log('Found restore useEffect from char', useEffectStart, 'to', blockEnd);
console.log('Old block size:', blockEnd - useEffectStart, 'chars');

// New restore: query Arweave for my agreements, derive step from L1
const newRestore = `useEffect(() => {
    (async () => {
      const _v = await AsyncStorage.getItem('kv_frost_v').catch(() => null);
      if (!_v) { console.log('[Restore] Skip - FLUSH-V2 pending'); return; }
      
      // ARWEAVE-BASED RESTORE: inbox is the source of truth
      try {
        const wallet = await loadMainWallet();
        if (!wallet) return;
        const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
        const dataPart = wallet.address.split(':')[1];
        const data5bit = Array.from(dataPart).map((c: string) => CHARSET.indexOf(c));
        const result: number[] = [];
        let buff = 0, bits = 0;
        for (const d of data5bit) { buff = (buff << 5) | d; bits += 5; while (bits >= 8) { bits -= 8; result.push((buff >> bits) & 0xff); } }
        let myPubkey = '';
        if (result[0] === 0x00 && result.length >= 33) {
          const xOnly = result.slice(1, 33);
          myPubkey = '02' + xOnly.map((b: number) => b.toString(16).padStart(2, '0')).join('');
        }
        if (!myPubkey) return;

        // Query Arweave for my active agreements
        const arAll = await queryAgreementsFromArweave({ network: 'testnet-10' });
        const myActive = arAll.filter((a: any) => {
          const pk = a.pubkey || a.partyA?.pubkey || '';
          const cp = a.counterpartyPubkey || a.KVCounterparty || '';
          const status = (a.status || '').toLowerCase();
          return (pk.startsWith(myPubkey.slice(0, 16)) || cp.startsWith(myPubkey.slice(0, 16))) &&
                 (status === 'proposed' || status === 'accepted' || status === 'agreed' || status === 'agreed-send');
        });

        if (myActive.length === 0) {
          console.log('[Arweave-Restore] No active agreements found');
          return;
        }

        // Find most recent by checking L1 FROST balance
        const apiBase = wallet.network?.includes('testnet') ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
        let bestMatch: any = null;
        let bestStep = 0;

        for (const agr of myActive.slice(0, 5)) {
          const frostAddr = agr.frostAddress || '';
          if (!frostAddr || frostAddr.length < 20) continue;

          try {
            const balResp = await fetch(apiBase + '/addresses/' + frostAddr + '/balance');
            if (!balResp.ok) continue;
            const balData = await balResp.json();
            const bal = Number(balData.balance || '0') / 1e8;
            const buyerAmt = (agr.buyerAmountSompi || 0) / 1e8;
            const sellerAmt = (agr.sellerAmountSompi || 0) / 1e8;
            const expectedTotal = buyerAmt + sellerAmt;

            let derivedStep = 3; // default: waiting for funding
            if (bal >= expectedTotal && expectedTotal > 0) derivedStep = 4; // fully funded

            if (derivedStep > bestStep || (derivedStep === bestStep && !bestMatch)) {
              bestMatch = agr;
              bestStep = derivedStep;
            }
            console.log('[Arweave-Restore] ', agr.agreementId?.slice(0, 12), ':', bal, 'KAS, step:', derivedStep);
          } catch {}
        }

        if (bestMatch && bestStep >= 4) {
          // Only auto-restore if funds are locked (step 4+)
          const agrId = bestMatch.agreementId || bestMatch.agreement_id || '';
          const proposerPk = bestMatch.pubkey || bestMatch.partyA?.pubkey || '';
          const iAmProposer = proposerPk.startsWith(myPubkey.slice(0, 16));
          const myRole = iAmProposer ? 'buyer' : 'seller';
          const buyerPk = iAmProposer ? myPubkey : proposerPk;
          const sellerPk = iAmProposer ? (bestMatch.counterpartyPubkey || '') : myPubkey;

          console.log('[Arweave-Restore] Auto-restoring funded agreement:', agrId.slice(0, 12), 'step:', bestStep, 'role:', myRole);

          setRole(myRole as any);
          setAgreementType('trade');
          setStep(bestStep);
          setContract((prev: any) => ({
            ...prev,
            agreementId: agrId,
            buyerPubkey: buyerPk,
            sellerPubkey: sellerPk,
            itemPriceKas: (bestMatch.buyerAmountSompi || 0) / 1e8,
            sellerCommitmentKas: (bestMatch.sellerAmountSompi || 0) / 1e8,
            itemDescription: bestMatch.description || agrId.slice(0, 12),
            multisigAddress: bestMatch.frostAddress || '',
            frostData: bestMatch.frostAddress ? { address: bestMatch.frostAddress, network: 'testnet-10' } : undefined,
          }));
          setBuyerLocked(true);
          setSellerLocked(true);
        } else {
          console.log('[Arweave-Restore] No funded agreements — start fresh, use inbox');
        }
      } catch (e) {
        console.warn('[Arweave-Restore] Failed:', e);
      }
    })();
  }, []);`;

f = f.substring(0, useEffectStart) + newRestore + f.substring(blockEnd);
fs.writeFileSync('NeighborAgreement.tsx', f);

console.log('Restore replaced with Arweave-based restore');
console.log('Emojis:', (f.match(/[\u{1F000}-\u{1FFFF}]/gu) || []).length);
console.log('Arweave-Restore hits:', (f.match(/Arweave-Restore/g) || []).length);
