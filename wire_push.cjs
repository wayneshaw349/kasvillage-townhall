const fs = require("fs");
const path = require("path");
const dir = __dirname;

let changes = 0;

// === 1. Expo_identity_ritual.tsx — import + wire after kv_verified ===
const ritualFile = path.join(dir, "Expo_identity_ritual.tsx");
if (fs.existsSync(ritualFile)) {
  let s = fs.readFileSync(ritualFile, "utf8");

  // Add import after last import block
  const importAnchor = "} from './keyword_dictionary_draggable';";
  if (!s.includes("from './push_notifications'")) {
    s = s.replace(
      importAnchor,
      importAnchor + "\nimport { registerPushToken, inscribePushToken } from './push_notifications';"
    );
    changes++;
    console.log("✅ Ritual: push import added");
  } else {
    console.log("   Ritual: push import already present");
  }

  // Wire registerPushToken + inscribePushToken after kv_verified
  const kvAnchor = "await SecureStore.setItemAsync('kv_verified', 'true');";
  if (s.includes(kvAnchor) && !s.includes("registerPushToken()")) {
    const pushWiring = `
      // === Push notification registration ===
      try {
        const pushToken = await registerPushToken();
        if (pushToken) {
          const pubkey = await SecureStore.getItemAsync('kv_public_key') || '';
          const privKey = await SecureStore.getItemAsync('kaspa_private_key') || '';
          if (pubkey && privKey) {
            await inscribePushToken(pubkey, privKey);
            console.log('[PhaseAnchor] Push token inscribed to Arweave');
          }
        }
      } catch (pushErr) {
        console.warn('[PhaseAnchor] Push registration failed (non-fatal):', pushErr);
      }`;
    s = s.replace(kvAnchor, kvAnchor + pushWiring);
    changes++;
    console.log("✅ Ritual: push wiring added after kv_verified");
  } else if (s.includes("registerPushToken()")) {
    console.log("   Ritual: push wiring already present");
  } else {
    console.log("⚠️  Ritual: kv_verified anchor not found");
  }

  fs.writeFileSync(ritualFile, s, "utf8");
} else {
  console.log("⚠️  Expo_identity_ritual.tsx not found");
}

// === 2. NeighborAgreement.tsx — import + wire after partial sig + release ===
const neighborFile = path.join(dir, "NeighborAgreement.tsx");
if (fs.existsSync(neighborFile)) {
  let s = fs.readFileSync(neighborFile, "utf8");

  // Add import after frost_complete import
  const frostImportAnchor = "} from './frost_complete';";
  if (!s.includes("from './push_notifications'")) {
    s = s.replace(
      frostImportAnchor,
      frostImportAnchor + "\nimport { sendPushToCounterparty } from './push_notifications';"
    );
    changes++;
    console.log("✅ Neighbor: push import added");
  } else {
    console.log("   Neighbor: push import already present");
  }

  // Wire after partial sig posted (after relay success log)
  const partialAnchor = "console.log(`[Neighbor] Partial TX posted via ${relayResult.method}: ${relayResult.url}`);";
  if (s.includes(partialAnchor) && !s.includes("sendPushToCounterparty(counterpartyPubkey")) {
    const pushPartial = `
          // Notify counterparty via push
          if (counterpartyPubkey) {
            sendPushToCounterparty(counterpartyPubkey, 'partial_sig_ready').catch(e =>
              console.warn('[Neighbor] Push notify failed (non-fatal):', e)
            );
          }`;
    s = s.replace(partialAnchor, partialAnchor + pushPartial);
    changes++;
    console.log("✅ Neighbor: push after partial_sig_ready added");
  } else if (s.includes("sendPushToCounterparty(counterpartyPubkey")) {
    console.log("   Neighbor: partial sig push already present");
  } else {
    console.log("⚠️  Neighbor: partial sig anchor not found");
  }

  // Wire after release TX broadcast
  const releaseAnchor = "console.log('[Neighbor] ✓ Release TX broadcast:', result.txId);";
  if (s.includes(releaseAnchor) && !s.includes("'release_available'")) {
    const pushRelease = `
          // Notify counterparty release is available
          const cpPubkey = role === 'buyer' ? contract.sellerPubkey : contract.buyerPubkey;
          if (cpPubkey) {
            sendPushToCounterparty(cpPubkey, 'release_available').catch(e =>
              console.warn('[Neighbor] Push release notify failed:', e)
            );
          }`;
    s = s.replace(releaseAnchor, releaseAnchor + pushRelease);
    changes++;
    console.log("✅ Neighbor: push after release_available added");
  } else if (s.includes("'release_available'")) {
    console.log("   Neighbor: release push already present");
  } else {
    console.log("⚠️  Neighbor: release anchor not found");
  }

  fs.writeFileSync(neighborFile, s, "utf8");
} else {
  console.log("⚠️  NeighborAgreement.tsx not found");
}

console.log(`\n✅ Done — ${changes} changes`);
console.log("   Run: npx tsc --noEmit");
