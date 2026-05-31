// patch_frost_reuse.cjs — prevent counter divergence on re-accept
// Adds KV-FrostCounter to Arweave inscription + seller reuse from Arweave
const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');
const NL = s.includes('\r\n') ? '\r\n' : '\n';
const n = (str) => str.replace(/\n/g, NL);
let fixes = 0;

// ═══════════════════════════════════════════════════════════════
// FIX 1: Seller — reuse frostAddress from Arweave before L1 scan
// Insert BEFORE the buyerCounter check in handleAcceptFromInbox
// ═══════════════════════════════════════════════════════════════

const FIX1_ANCHOR = n(`          // Use buyer's counter if provided in proposal (avoids counter divergence)
          const buyerCounter = (agreement as any)?.frostCounter ?? (agreement as any)?.KVFrostCounter;`);

const FIX1_INSERT = n(`          // FROST REUSE: if Arweave/TownHall has frostAddress with funds, find matching counter
          const agrFrostAddr = agreement.frostAddress || '';
          if (agrFrostAddr && agrFrostAddr.length > 20) {
            try {
              const _reuseResp = await fetch(_sApi + '/addresses/' + agrFrostAddr + '/utxos');
              if (_reuseResp.ok) {
                const _reuseUtxos = await _reuseResp.json();
                if (Array.isArray(_reuseUtxos) && _reuseUtxos.length >= 1) {
                  // Find which counter produces this address
                  for (let _rc = 0; _rc < 25; _rc++) {
                    const _rcFrost = deriveFrostAddressLocal({ pubkeyA: myPubkey, pubkeyB: proposerPubkey, network: frostNetwork, agreementId: agrId, frostCounter: _rc });
                    if (_rcFrost.address === agrFrostAddr) {
                      frostData = _rcFrost;
                      console.log('[Seller-Reuse] FROST reused from Arweave, counter:', _rc, agrFrostAddr.slice(0,30), 'UTXOs:', _reuseUtxos.length);
                      break;
                    }
                  }
                }
              }
            } catch (e) { console.warn('[Seller-Reuse] Check failed:', e); }
          }
          // Use buyer's counter if provided in proposal (avoids counter divergence)
          const buyerCounter = (agreement as any)?.frostCounter ?? (agreement as any)?.KVFrostCounter;`);

if (s.includes(FIX1_ANCHOR)) {
  s = s.replace(FIX1_ANCHOR, FIX1_INSERT);
  fixes++;
  console.log('FIX 1: Seller FROST reuse from Arweave ✓');
} else {
  console.log('FIX 1: ANCHOR NOT FOUND');
}

// ═══════════════════════════════════════════════════════════════
// FIX 2: Seller — skip L1 scan if frostData already set by reuse
// Wrap the existing L1 loop with "if (!frostData)"
// ═══════════════════════════════════════════════════════════════

const FIX2_ANCHOR = n(`          if (buyerCounter !== undefined && buyerCounter !== null) {`);

const FIX2_REPLACE = n(`          if (frostData) {
            console.log('[Seller-Reuse] Skipping L1 scan — already have FROST from Arweave');
          } else if (buyerCounter !== undefined && buyerCounter !== null) {`);

if (s.includes(FIX2_ANCHOR)) {
  s = s.replace(FIX2_ANCHOR, FIX2_REPLACE);
  fixes++;
  console.log('FIX 2: Skip L1 scan when reused ✓');
} else {
  console.log('FIX 2: ANCHOR NOT FOUND');
}

// ═══════════════════════════════════════════════════════════════
// FIX 3: Seller — skip auto-send if FROST already has our funds
// Add check using the reused frostData address
// ═══════════════════════════════════════════════════════════════

const FIX3_ANCHOR = n(`          const immediateSendAmount = mySendAmount;
          if (immediateSendAmount > 0 && wallet.privKeyHex) {`);

const FIX3_REPLACE = n(`          const immediateSendAmount = mySendAmount;
          // Skip auto-send if FROST already has funds (re-accept scenario)
          let _skipSend = false;
          if (frostData?.address) {
            try {
              const _chkResp = await fetch(_sApi + '/addresses/' + frostData.address + '/balance');
              if (_chkResp.ok) {
                const _chkBal = Number((await _chkResp.json()).balance || '0');
                if (_chkBal >= immediateSendAmount) {
                  console.log('[Seller-Reuse] FROST already has', _chkBal / 1e8, 'KAS >= my', immediateSendAmount / 1e8, '— skip send');
                  _skipSend = true;
                }
              }
            } catch {}
          }
          if (immediateSendAmount > 0 && wallet.privKeyHex && !_skipSend) {`);

if (s.includes(FIX3_ANCHOR)) {
  s = s.replace(FIX3_ANCHOR, FIX3_REPLACE);
  fixes++;
  console.log('FIX 3: Skip auto-send on reuse ✓');
} else {
  console.log('FIX 3: ANCHOR NOT FOUND');
}

// ═══════════════════════════════════════════════════════════════
// FIX 4: Arweave GQL tag parsing — read KV-FrostCounter
// In the inbox Arweave query, add frostCounter to parsed result
// ═══════════════════════════════════════════════════════════════

const FIX4_ANCHOR = n(`            frostAddress: tm['KV-FrostAddress'] || '',
            partyA: { pubkey: tm['KV-Pubkey'] || '', amount_sompi: parseInt(tm['KV-Amount'] || '0') },`);

const FIX4_REPLACE = n(`            frostAddress: tm['KV-FrostAddress'] || '',
            frostCounter: tm['KV-FrostCounter'] !== undefined ? parseInt(tm['KV-FrostCounter']) : undefined,
            partyA: { pubkey: tm['KV-Pubkey'] || '', amount_sompi: parseInt(tm['KV-Amount'] || '0') },`);

// This pattern appears multiple times — replace ALL
let fix4Count = 0;
while (s.includes(FIX4_ANCHOR)) {
  s = s.replace(FIX4_ANCHOR, FIX4_REPLACE);
  fix4Count++;
}
if (fix4Count > 0) {
  fixes++;
  console.log('FIX 4: GQL frostCounter parse (' + fix4Count + ' locations) ✓');
} else {
  console.log('FIX 4: ANCHOR NOT FOUND');
}

// ═══════════════════════════════════════════════════════════════
// WRITE + VERIFY
// ═══════════════════════════════════════════════════════════════
fs.writeFileSync(f, s);
console.log('\n=== ' + fixes + '/4 fixes ===');

const v = fs.readFileSync(f, 'utf8');
const checks = [
  ['Seller-Reuse block', v.includes('[Seller-Reuse] FROST reused from Arweave')],
  ['Skip L1 scan', v.includes('[Seller-Reuse] Skipping L1 scan')],
  ['Skip auto-send', v.includes('[Seller-Reuse] FROST already has')],
  ['GQL frostCounter', v.includes("KV-FrostCounter")],
  ['No double buyerCounter', (v.match(/const buyerCounter/g) || []).length === 1],
];
console.log('\nVerification:');
checks.forEach(([name, ok]) => console.log(ok ? '  ✓' : '  ✗', name));
console.log(checks.every(c => c[1]) ? '\n✅ ALL PASSED' : '\n❌ CHECK FAILURES');
