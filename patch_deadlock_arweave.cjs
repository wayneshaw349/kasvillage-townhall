// patch_deadlock_arweave.cjs — inscribe Deadlocked status to Arweave
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, 'NeighborAgreement.tsx');

const src = fs.readFileSync(FILE, 'utf8');
if (src.includes("status: 'Deadlocked'")) {
  console.log('[patch] Already applied — skipping.');
  process.exit(0);
}

const OLD = `const handleEnterDispute = () => {
    const newStats = {
      ...userStats,
      deadlocks: userStats.deadlocks + 1,
      xp: Math.max(0, userStats.xp - 50),
    };
    setUserStats(newStats);
    SecureStore.setItemAsync('kv_user_stats', JSON.stringify(newStats));
    setStep(8);
  };`;

const NEW = `const handleEnterDispute = async () => {
    const newStats = {
      ...userStats,
      deadlocks: userStats.deadlocks + 1,
      xp: Math.max(0, userStats.xp - 50),
    };
    setUserStats(newStats);
    SecureStore.setItemAsync('kv_user_stats', JSON.stringify(newStats));
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
    } catch (e) { console.warn('[Deadlock] Arweave inscription failed:', e); }
    setStep(8);
  };`;

if (!src.includes(OLD)) {
  console.log('[patch] Pattern not found. Check NeighborAgreement.tsx manually.');
  process.exit(1);
}

fs.writeFileSync(FILE, src.replace(OLD, NEW));
console.log('[patch] Done — Deadlocked Arweave inscription added.');
