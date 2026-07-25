const fs=require('fs');
const F='wallet_registration_v2.ts';
let s=fs.readFileSync(F,'utf8');
if(s.includes('MODE-SLOT-SYNC')){console.log('already patched');process.exit(0);}
fs.writeFileSync(F+'.bak_modeslots',s);

// ---- FIX 1: restore invalidates stale mode-address cache ----
const A1="    await SecureStore.setItemAsync('kaspa_address', wallet.kaspaAddress);";
// appears in BOTH createWallet and restoreWalletFromMnemonic (same line text).
// We patch ALL occurrences — invalidating the cache on create is equally correct.
const cnt=s.split(A1).length-1;
if(cnt<1){console.error('fix1 anchor missing - abort');process.exit(1);}
const INJ1=A1+`
    // MODE-SLOT-SYNC: invalidate cached mode addresses so boot re-copies the fresh one
    try { await SecureStore.deleteItemAsync('kaspa_address_tutorial'); } catch {}
    try { await SecureStore.deleteItemAsync('kaspa_address_real'); } catch {}`;
s=s.split(A1).join(INJ1);

// ---- FIX 2: deriveKaspaAddress network-aware (currently dead code, zero callers) ----
const A2="async function deriveKaspaAddress(publicKeyHex: string): Promise<string> {\n  const pubBytes = hexToBytes(publicKeyHex);\n  const xOnly = pubBytes.slice(1); // drop 02/03 prefix \u2192 32 bytes\n  return kaspaAddressFromXOnly(xOnly, 'kaspa');\n}";
const A2crlf=A2.replace(/\n/g,'\r\n');
const B2="async function deriveKaspaAddress(publicKeyHex: string): Promise<string> {\n  const pubBytes = hexToBytes(publicKeyHex);\n  const xOnly = pubBytes.slice(1); // drop 02/03 prefix \u2192 32 bytes\n  const net = (await SecureStore.getItemAsync('kaspa_network')) || 'mainnet';\n  return kaspaAddressFromXOnly(xOnly, net.startsWith('testnet') ? 'kaspatest' : 'kaspa');\n}";
const B2crlf=B2.replace(/\n/g,'\r\n');
if(s.includes(A2)) s=s.replace(A2,B2);
else if(s.includes(A2crlf)) s=s.replace(A2crlf,B2crlf);
else console.log('fix2: anchor not found (non-fatal, dead code) - skipped');

if(!s.includes('MODE-SLOT-SYNC')){console.error('post-check failed');process.exit(1);}
fs.writeFileSync(F,s);
console.log('patched ok ('+cnt+' mode-slot injections)');
