// fix_drop_postfrostr.cjs - remove the unread R post from the accept flow.
//
// R reaches the counterparty two ways the flow actually uses:
//   1. embedded in the Accepted inscription (the frostR field), and
//   2. the clipboard exchange.
// The standalone postFrostR call after accept was a THIRD copy - and
// getFrostR, its only possible reader, has zero call sites in the app. A
// write nothing reads, on every accept, inside a signing flow that finally
// works, is pure downside.
//
// The single call site is try/catch-wrapped and fire-and-forget, so removing
// it cannot change any signing outcome. postFrostR / getFrostR stay exported
// from townhall_client in case a future relay flow wants them; only the call
// goes.
// Run from layer1 root:  node src\\fix_drop_postfrostr.cjs
const fs = require("fs");
const P = "NeighborAgreement.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("postFrostR REMOVED")) { console.log("already patched"); process.exit(0); }
const n = s.split("            // Post R to TownHall (after accept, so party_b exists)\n            try { const saved = await SecureStore.getItemAsync('kv_frost_nonce_' + agrId); if (saved) { const n = JSON.parse(saved); await postFrostR({ agreementId: agrId, pubkey: myPubkey, frostR: n.R_hex }); console.log('[FROST-R] R posted to TownHall after accept'); } } catch(e) { console.warn('[FROST-R] TownHall R post failed:', e); }\n").length - 1;
if (n !== 1) { console.error("ABORT: found " + n + ", expected 1"); process.exit(1); }
s = s.split("            // Post R to TownHall (after accept, so party_b exists)\n            try { const saved = await SecureStore.getItemAsync('kv_frost_nonce_' + agrId); if (saved) { const n = JSON.parse(saved); await postFrostR({ agreementId: agrId, pubkey: myPubkey, frostR: n.R_hex }); console.log('[FROST-R] R posted to TownHall after accept'); } } catch(e) { console.warn('[FROST-R] TownHall R post failed:', e); }\n").join("            // postFrostR REMOVED. R already travels two ways that the flow\n            // actually uses: embedded in the Accepted inscription (frostR field\n            // a few lines up) and via the clipboard exchange. This standalone\n            // TownHall post was a third copy that nothing ever read back -\n            // getFrostR has zero call sites anywhere in the app. An unread\n            // write on every accept was pure latency in a working signing flow.\n");
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("ok  [drop-postfrostr]");
console.log("\npatched " + P + ". Accept flow no longer posts R to TownHall.");
