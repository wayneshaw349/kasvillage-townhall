// Standalone Kaspa txid serialization validator.
// Rebuilds confirmed tx a1bf97ae... and tries to reproduce its transaction_id.
// Run: node test_txid.cjs   (needs @noble/hashes in node_modules — run from project dir)

const { blake2b } = require('@noble/hashes/blake2b');

// ---- your primitives (copied exactly from kaspa_rest_tx.ts) ----
const hexToBytes = (h) => { const b = new Uint8Array(h.length/2); for (let i=0;i<b.length;i++) b[i]=parseInt(h.substr(i*2,2),16); return b; };
const bytesToHex = (b) => Array.from(b).map(x=>x.toString(16).padStart(2,'0')).join('');
function writeU16LE(n){ return new Uint8Array([n & 0xff, (n>>8)&0xff]); }
function writeU32LE(n){ return new Uint8Array([n&0xff,(n>>8)&0xff,(n>>16)&0xff,(n>>24)&0xff]); }
function writeU64LE(n){ const buf=new Uint8Array(8); let v=BigInt(n); for(let i=0;i<8;i++){buf[i]=Number(v&0xFFn); v>>=8n;} return buf; }
function concat(...arrays){ let len=0; for(const a of arrays) len+=a.length; const r=new Uint8Array(len); let off=0; for(const a of arrays){r.set(a,off); off+=a.length;} return r; }

// ---- the confirmed tx (from the API response) ----
const TX = {
  version: 0,
  inputs: [{
    prevTxId: '25c93266f060a478436a838590e1c622481b3182835477fcfc1a8457d54f9218',
    prevIndex: 1,
    sigScript: '413412ff4d85022f07299e870084b80dffb27ef7ebc522a33e91a1049c522353379c0e141957a323caf5b41a97bc7c6ebe98512159102cf29d84ee10c279ed507801',
    sequence: 0n,
    sigOpCount: 1,
  }],
  outputs: [
    { amount: 600000000n,   scriptVersion: 0, script: '20d2612e74ae37a6929e76b956398f769316e594480b57e975cf298bac046a7d1fac' },
    { amount: 14698001500n, scriptVersion: 0, script: '20947bbfc963b010bebe71536dff6b02b2aa6a9d788338033a148c4aadb3930183ac' },
  ],
  lockTime: 0n,
  subnetworkId: '0000000000000000000000000000000000000000',
  gas: 0n,
  payload: '',
};

const KNOWN_TXID = 'a1bf97aec48160420c0ca4a4b09030d88ca36059a108b0a5ca0f729fc3e1f2a2';
const KNOWN_HASH = 'ef3c92123a0914329df7b22a18bbcf4cff3e23b3d5c0386ad89bd5965533b777';

// Serialize the tx. emptySigs=true -> signature scripts zeroed (txid); false -> included (hash).
function serialize(tx, emptySigs) {
  const parts = [];
  parts.push(writeU16LE(tx.version));
  parts.push(writeU64LE(tx.inputs.length));
  for (const inp of tx.inputs) {
    parts.push(hexToBytes(inp.prevTxId));       // 32
    parts.push(writeU32LE(inp.prevIndex));      // 4
    const sig = emptySigs ? new Uint8Array(0) : hexToBytes(inp.sigScript);
    parts.push(writeU64LE(sig.length));         // script len u64
    parts.push(sig);                            // script bytes
    parts.push(writeU64LE(inp.sequence));       // 8
    // sigOpCount: some serializations include it as u8 here. Try WITH first; a variant below tries without.
    parts.push(new Uint8Array([inp.sigOpCount]));
  }
  parts.push(writeU64LE(tx.outputs.length));
  for (const out of tx.outputs) {
    parts.push(writeU64LE(out.amount));         // 8
    parts.push(writeU16LE(out.scriptVersion));  // 2
    const s = hexToBytes(out.script);
    parts.push(writeU64LE(s.length));           // script len u64
    parts.push(s);                              // script bytes
  }
  parts.push(writeU64LE(tx.lockTime));          // 8
  parts.push(hexToBytes(tx.subnetworkId));      // 20
  parts.push(writeU64LE(tx.gas));               // 8
  // payload hash: native subnetwork -> 32 zero bytes; else blake2b(payload)
  const payloadBytes = tx.payload ? hexToBytes(tx.payload) : new Uint8Array(0);
  const isNative = tx.subnetworkId === '0000000000000000000000000000000000000000';
  const payloadHash = isNative ? new Uint8Array(32) : blake2b(payloadBytes, { dkLen: 32 });
  parts.push(payloadHash);                      // 32
  return concat(...parts);
}

// Try a hash with a given domain string, applied as KEY and as PERSONALIZATION.
function tryHash(data, domain) {
  const results = {};
  const keyBytes = new TextEncoder().encode(domain);
  try { results.asKey = bytesToHex(blake2b(data, { dkLen: 32, key: keyBytes })); } catch(e){ results.asKey = 'ERR:'+e.message; }
  // personalization must be exactly 16 bytes for blake2b
  try {
    const pers = new Uint8Array(16); pers.set(keyBytes.slice(0,16));
    results.asPersonal = bytesToHex(blake2b(data, { dkLen: 32, personalization: pers }));
  } catch(e){ results.asPersonal = 'ERR:'+e.message; }
  return results;
}

const domains = ['TransactionID', 'TransactionHash', 'TransactionSigningHash'];

console.log('KNOWN txid:', KNOWN_TXID);
console.log('KNOWN hash:', KNOWN_HASH);
console.log('');

for (const emptySigs of [true, false]) {
  const data = serialize(TX, emptySigs);
  console.log('=== serialize emptySigs=' + emptySigs + ' (len ' + data.length + ') ===');
  for (const d of domains) {
    const r = tryHash(data, d);
    for (const [mode, hex] of Object.entries(r)) {
      const tag = hex === KNOWN_TXID ? '  <<< MATCHES TXID' : (hex === KNOWN_HASH ? '  <<< MATCHES HASH' : '');
      console.log(`  ${d} [${mode}]: ${hex}${tag}`);
    }
  }
  console.log('');
}
