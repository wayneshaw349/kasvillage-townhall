const fs = require('fs');
let c = fs.readFileSync('NeighborAgreement.tsx', 'utf8');
let count = 0;

// 1. Remove R from collateral TX payload — find the payload lambda in handleAcceptFromInbox
const payloadStart = c.indexOf("payload: await (async () => { try { const nonce = generateFrostNonce");
if (payloadStart > -1) {
  // Find the end of this payload block (returns nonce.R_hex)
  const payloadEnd = c.indexOf("})(),", payloadStart) + 5;
  const oldPayload = c.substring(payloadStart, payloadEnd);
  // Replace with empty payload — R still goes to TownHall + Arweave + clipboard
  c = c.substring(0, payloadStart) + 
    "payload: await (async () => { try { const nonce = generateFrostNonce({ frostAddress: frostData, recipientAddress: frostData.address, amountSompi: BigInt(Math.floor((buyerKas + sellerKas) * 1e8)), privateKeyHex: wallet.privKeyHex }); await SecureStore.setItemAsync('kv_frost_nonce_' + agrId, JSON.stringify(nonce)); console.log('[FROST-R] Nonce saved (NOT in payload):', nonce.R_hex.slice(0,20)); try { postFrostR({ agreementId: agrId, pubkey: myPubkey, frostR: nonce.R_hex }).then(() => console.log('[FROST-R] R posted to TownHall')).catch(() => {}); } catch {} return ''; } catch(e) { console.warn('[FROST-R] Nonce gen failed:', e); return ''; } })()," +
    c.substring(payloadEnd);
  count++;
  console.log('1. Removed R from collateral TX payload');
} else {
  console.log('1. Payload block not found — check manually');
}

fs.writeFileSync('NeighborAgreement.tsx', c);

// 2. Add startup nonce sweep to AppNaviagator.tsx
let nav = fs.readFileSync('AppNaviagator.tsx', 'utf8');
const sweepCode = `
  // === ORPHANED NONCE SWEEP ===
  useEffect(() => {
    (async () => {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const nonceKeys = keys.filter(k => k.startsWith('kv_frost_nonce_'));
        for (const nk of nonceKeys) {
          const raw = await SecureStore.getItemAsync(nk);
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw);
            const age = Date.now() - (parsed.createdAt || 0);
            if (age > 4 * 60 * 60 * 1000 || !parsed.createdAt) {
              await SecureStore.deleteItemAsync(nk);
              console.log('[K-SWEEP] Destroyed orphaned nonce:', nk, 'age:', Math.round(age / 60000), 'min');
            }
          } catch { await SecureStore.deleteItemAsync(nk); console.log('[K-SWEEP] Destroyed unparseable nonce:', nk); }
        }
      } catch (e) { console.warn('[K-SWEEP] Failed:', e); }
    })();
  }, []);`;

// Insert after the first useEffect in the main component
const navInsertPoint = nav.indexOf("// === ORPHANED NONCE SWEEP ===");
if (navInsertPoint > -1) {
  console.log('2. Nonce sweep already exists');
} else {
  // Find a good insertion point — after push notification setup
  const pushSetup = nav.indexOf("setupNotificationHandlers();");
  if (pushSetup > -1) {
    const afterPush = nav.indexOf("}, []);", pushSetup);
    if (afterPush > -1) {
      const insertAt = afterPush + 7;
      nav = nav.substring(0, insertAt) + '\n' + sweepCode + nav.substring(insertAt);
      console.log('2. Added orphaned nonce sweep to AppNaviagator.tsx');
      count++;
    }
  } else {
    console.log('2. Could not find insertion point — add manually');
  }
}

// 3. Stamp createdAt on nonce generation so sweep knows age
// In NeighborAgreement.tsx, the nonce JSON needs createdAt
let c2 = fs.readFileSync('NeighborAgreement.tsx', 'utf8');
// buyerBuildTemplate nonce save
const tmplSave = "JSON.stringify({ k: result.nonce.k.toString(16), d_tweaked: result.nonce.d_tweaked.toString(16), R_hex: result.nonce.R_hex })";
if (c2.includes(tmplSave)) {
  c2 = c2.replace(tmplSave, "JSON.stringify({ k: result.nonce.k.toString(16), d_tweaked: result.nonce.d_tweaked.toString(16), R_hex: result.nonce.R_hex, createdAt: Date.now() })");
  count++;
  console.log('3a. Added createdAt to buyer nonce save');
}
// cancel/split nonce save
const cancelSave = "JSON.stringify({ k: _nonce.k.toString(16), d_tweaked: _nonce.d_tweaked.toString(16), R_hex: _nonce.R_hex })";
if (c2.includes(cancelSave)) {
  c2 = c2.replace(cancelSave, "JSON.stringify({ k: _nonce.k.toString(16), d_tweaked: _nonce.d_tweaked.toString(16), R_hex: _nonce.R_hex, createdAt: Date.now() })");
  count++;
  console.log('3b. Added createdAt to cancel nonce save');
}
// seller collateral nonce save (handleAcceptFromInbox)
const sellerSave = "JSON.stringify(nonce)";
const sellerSaveIdx = c2.indexOf(sellerSave, c2.indexOf("Nonce saved (NOT in payload)") - 200);
if (sellerSaveIdx > -1) {
  c2 = c2.substring(0, sellerSaveIdx) + "JSON.stringify({ ...nonce, createdAt: Date.now() })" + c2.substring(sellerSaveIdx + sellerSave.length);
  count++;
  console.log('3c. Added createdAt to seller nonce save');
}
fs.writeFileSync('NeighborAgreement.tsx', c2);
fs.writeFileSync('AppNaviagator.tsx', nav);

console.log('Done:', count, 'changes');
