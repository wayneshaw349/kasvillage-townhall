// patch_deadlock_arweave.cjs v2 — CRLF-safe
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, 'NeighborAgreement.tsx');

let src = fs.readFileSync(FILE, 'utf8');
if (src.includes("status: 'Deadlocked'")) {
  console.log('[patch] Already applied — skipping.');
  process.exit(0);
}

// Normalize to LF for matching
const norm = src.replace(/\r\n/g, '\n');

// 1) Make handleEnterDispute async
const syncFn = 'const handleEnterDispute = () => {';
const asyncFn = 'const handleEnterDispute = async () => {';
if (norm.includes(syncFn)) {
  src = src.replace(syncFn, asyncFn);
  console.log('[patch] 1/2 Made handleEnterDispute async');
} else if (norm.includes(asyncFn)) {
  console.log('[patch] 1/2 Already async');
} else {
  console.log('[patch] ERROR: handleEnterDispute not found');
  process.exit(1);
}

// 2) Inject after kv_user_stats setItemAsync line
const marker = "SecureStore.setItemAsync('kv_user_stats', JSON.stringify(newStats))";
const markerAlt = 'SecureStore.setItemAsync("kv_user_stats", JSON.stringify(newStats))';
const insertMarker = src.includes(marker) ? marker : src.includes(markerAlt) ? markerAlt : null;

if (!insertMarker) {
  console.log('[patch] ERROR: kv_user_stats marker not found');
  process.exit(1);
}

// Find the FIRST occurrence inside handleEnterDispute (not other functions)
const fnStart = src.indexOf(asyncFn);
const markerIdx = src.indexOf(insertMarker, fnStart);
if (markerIdx === -1 || markerIdx - fnStart > 500) {
  console.log('[patch] ERROR: marker too far from function');
  process.exit(1);
}

// Find end of that line (after the semicolon)
let insertAt = markerIdx + insertMarker.length;
// Skip past the semicolon if present
while (insertAt < src.length && src[insertAt] !== '\n' && src[insertAt] !== '\r') insertAt++;

const INJECT = `
    // Inscribe Deadlocked status to Arweave (permanent record)
    try {
      const wallet = await loadMainWallet();
      if (wallet) {
        const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
        const dp = wallet.address.split(':')[1];
        const d5 = Array.from(dp).map(c => CHARSET.indexOf(c));
        const rb = []; let bf = 0, bi = 0;
        for (const d of d5) { bf = (bf << 5) | d; bi += 5; while (bi >= 8) { bi -= 8; rb.push((bf >> bi) & 0xff); } }
        const myPk = rb[0] === 0x00 && rb.length >= 33 ? '02' + rb.slice(1, 33).map(b => b.toString(16).padStart(2, '0')).join('') : '';
        await inscribeAgreementToArweave({
          agreementId: contract.agreementId || '',
          pubkey: myPk,
          amount_sompi: Math.floor((contract.itemPriceKas + contract.sellerCommitmentKas) * 1e8),
          description: contract.itemDescription || '',
          network: wallet.network || 'testnet-10',
          status: 'Deadlocked',
          frostAddress: contract.multisigAddress || '',
          signature: 'deadlock_' + Date.now(),
          counterpartyPubkey: role === 'buyer' ? (contract.sellerPubkey || '') : (contract.buyerPubkey || ''),
          buyerAmountSompi: Math.floor(contract.itemPriceKas * 1e8),
          sellerAmountSompi: Math.floor(contract.sellerCommitmentKas * 1e8),
        });
        console.log('[Deadlock] Inscribed to Arweave');
      }
    } catch (e) { console.warn('[Deadlock] Arweave inscription failed:', e); }`;

src = src.slice(0, insertAt) + INJECT + src.slice(insertAt);
console.log('[patch] 2/2 Injected Arweave Deadlocked inscription');

fs.writeFileSync(FILE, src);
console.log('[patch] Done.');
