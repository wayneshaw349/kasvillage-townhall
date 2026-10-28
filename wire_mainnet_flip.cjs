// wire_mainnet_flip.cjs - flip the wallet between testnet-10 and mainnet.
//   node wire_mainnet_flip.cjs mainnet     (release)
//   node wire_mainnet_flip.cjs testnet     (back to testing)
const fs = require('fs');
const want = process.argv[2] === 'mainnet' ? 'mainnet' : process.argv[2] === 'testnet' ? 'testnet-10' : null;
if (!want) { console.log('usage: node wire_mainnet_flip.cjs mainnet|testnet'); process.exit(2); }
const F = 'kv_net.ts'; const s = fs.readFileSync(F, 'utf8');
const re = /export const KV_NET: 'mainnet' \| 'testnet-10' = '(mainnet|testnet-10)';/;
const m = s.match(re); if (!m) { console.log('FAIL: switch line not found'); process.exit(1); }
if (m[1] === want) { console.log('already ' + want); process.exit(0); }
fs.writeFileSync(F, s.replace(re, "export const KV_NET: 'mainnet' | 'testnet-10' = '" + want + "';"));
console.log('KV_NET -> ' + want + '\n');
if (want === 'mainnet') console.log(`MAINNET CHECKLIST (all real money from here):
 1. npx expo start -c  (clear cache so every module picks the flag up)
 2. Create/restore a MAINNET wallet (kaspa: addresses) - testnet coins do not exist here
 3. Fund it: pledges (~5 KAS each), game publishes (chunk dust), fees
 4. Relay: deploy with mainnet env; wallets and relay must agree
 5. Republish games/stores - testnet posts do not carry over
 6. Re-pin anything address-based (registries derive per-network automatically)`);
else console.log('Back on testnet-10. npx expo start -c to rebuild.');
