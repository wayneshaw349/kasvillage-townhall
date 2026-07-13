const fs = require('fs');
function has(file, needle){ try { return fs.readFileSync(file,'utf8').includes(needle); } catch(e){ return null; } }
function line(label, ok){ console.log((ok===true?'  PRESENT ':ok===null?'  NO FILE ':'  MISSING ') + label); return ok===true; }

// find the file that actually holds canonicalVerify
const files = fs.readdirSync('.').filter(n=>/\.(ts|tsx)$/.test(n));
const canonFile = files.find(n=>{try{return fs.readFileSync(n,'utf8').includes('function canonicalVerify')||fs.readFileSync(n,'utf8').includes('idValid');}catch{return false;}});

console.log('=== FROST PASTE-ONLY + SIGNATURE AUDIT ===\n');

console.log('[1] canonical trusts pasted agrId  (file: '+(canonFile||'?')+')');
line("idValid no longer hard-compares recompute", canonFile ? has(canonFile,"kvAgrId.indexOf('AGR_')") : null);
line("recompute downgraded to diagnostic",        canonFile ? has(canonFile,"agrId recompute differs") : null);

console.log('\n[2] inbox / active-list population disabled');
line("active-list populate gated off", has('NeighborAgreement.tsx','if(false) setFrostActiveList'));
line("inbox merge neutralized",        has('NeighborAgreement.tsx','KV inbox off'));

console.log('\n[3] seller FROST = canon (no L1 counter scan)');
line("frostData seeded from canon",    has('NeighborAgreement.tsx','canon.frostData || null'));
line("reuse block guarded",            has('NeighborAgreement.tsx','!frostData && agrFrostAddr'));

console.log('\n[4] KV proposal SIGN (buyer)');
line("secp import in kv_proposal",     has('kv_proposal.ts','import { secp256k1 }'));
line("kvSigHash helper",               has('kv_proposal.ts','KV_SIG_V1:'));
line("sign via toCompactRawBytes",     has('kv_proposal.ts','toCompactRawBytes()'));
line("param buyerPrivKeyHex",          has('kv_proposal.ts','buyerPrivKeyHex?: string'));
line("param frostCounter",             has('kv_proposal.ts','frostCounter?: number;'));

console.log('\n[5] KV proposal VERIFY (seller)');
line("signature gate present",         has('kv_proposal.ts','SIGNATURE GATE'));
line("verify uses hexToBytes(bytes)",  has('kv_proposal.ts','secp256k1.verify(hexToBytes(_sig)'));
line("rejects unsigned",               has('kv_proposal.ts','Unsigned proposal'));

console.log('\n[6] wiring in NeighborAgreement');
line("buyer loads wallet at gen site", has('NeighborAgreement.tsx','const _wallet = await loadMainWallet();'));
line("buyer passes privkey to sign",   has('NeighborAgreement.tsx','buyerPrivKeyHex: _wallet?.privKeyHex'));
line("seller rejects invalid parse",   has('NeighborAgreement.tsx','parsed.valid === false'));

console.log('\n=== done ===');
