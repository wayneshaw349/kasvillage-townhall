// Kaspa v0 txid validator — corrected per consensus/core/src/hashing/tx.rs
// Validates against the Rust test vectors, then your real tx a1bf97ae.
const { blake2b } = require('@noble/hashes/blake2b');

const hexToBytes = (h) => { if(!h) return new Uint8Array(0); const b=new Uint8Array(h.length/2); for(let i=0;i<b.length;i++) b[i]=parseInt(h.substr(i*2,2),16); return b; };
const bytesToHex = (b) => Array.from(b).map(x=>x.toString(16).padStart(2,'0')).join('');
const u16 = (n)=> new Uint8Array([n&0xff,(n>>8)&0xff]);
const u32 = (n)=> new Uint8Array([n&0xff,(n>>8)&0xff,(n>>16)&0xff,(n>>24)&0xff]);
const u64 = (n)=>{ const b=new Uint8Array(8); let v=BigInt(n); for(let i=0;i<8;i++){b[i]=Number(v&0xFFn); v>>=8n;} return b; };
const concat = (...a)=>{ let l=0; for(const x of a) l+=x.length; const r=new Uint8Array(l); let o=0; for(const x of a){r.set(x,o); o+=x.length;} return r; };
// write_var_bytes = u64 length prefix + bytes
const varBytes = (bytes)=> concat(u64(bytes.length), bytes);

// Serialize v0 tx for TxID: EXCLUDE_SIGNATURE_SCRIPT | EXCLUDE_MASS_COMMIT
function serializeV0(tx){
  const parts = [];
  parts.push(u16(tx.version));
  parts.push(u64(tx.inputs.length));           // write_len
  for(const inp of tx.inputs){
    parts.push(hexToBytes(inp.prevTxId));       // outpoint tx id (32)
    parts.push(u32(inp.prevIndex));             // outpoint index (u32)
    parts.push(varBytes(new Uint8Array(0)));    // EXCLUDE sig script -> empty var bytes
    // sig_op_count SKIPPED (inside excluded block)
    parts.push(u64(inp.sequence));              // sequence u64
    // compute_budget SKIPPED for v0
  }
  parts.push(u64(tx.outputs.length));           // write_len
  for(const out of tx.outputs){
    parts.push(u64(out.amount));                // value u64
    parts.push(u16(out.scriptVersion));         // spk version u16
    parts.push(varBytes(hexToBytes(out.script)));// script var bytes
    // no covenant for v0
  }
  parts.push(u64(tx.lockTime));                 // lock_time u64
  parts.push(hexToBytes(tx.subnetworkId));      // subnetwork 20 bytes
  parts.push(u64(tx.gas));                      // gas u64
  parts.push(varBytes(hexToBytes(tx.payload))); // payload var bytes (NOT excluded)
  // mass EXCLUDED
  return concat(...parts);
}

// Kaspa uses blake2b with a 32-byte key = domain string padded/truncated.
// kaspa_hashes::TransactionID uses blake2b keyed. Try key = "TransactionID" utf8 (13 bytes),
// also try 32-byte zero-padded, also personalization.
function hashTxId(data){
  const results = {};
  const dom = 'TransactionID';
  const domBytes = new TextEncoder().encode(dom);
  // (a) key = raw utf8 bytes
  try { results.key_raw = bytesToHex(blake2b(data,{dkLen:32,key:domBytes})); } catch(e){ results.key_raw='ERR'; }
  // (b) key = 32-byte zero-padded
  try { const k=new Uint8Array(32); k.set(domBytes); results.key_pad32 = bytesToHex(blake2b(data,{dkLen:32,key:k})); } catch(e){ results.key_pad32='ERR'; }
  // (c) personalization 16 bytes
  try { const p=new Uint8Array(16); p.set(domBytes.slice(0,16)); results.personal = bytesToHex(blake2b(data,{dkLen:32,personalization:p})); } catch(e){ results.personal='ERR:'+e.message; }
  return results;
}

// ---- Test vectors from Rust source ----
const NATIVE = '0000000000000000000000000000000000000000';
const tests = [
  { name:'Rust#1 empty', tx:{ version:0, inputs:[], outputs:[], lockTime:0, subnetworkId:NATIVE, gas:0, payload:'' },
    expectedId:'2c18d5e59ca8fc4c23d9560da3bf738a8f40935c11c162017fbf2c907b7e665c' },
];

for(const t of tests){
  const data = serializeV0(t.tx);
  console.log('=== ' + t.name + ' (preimage len ' + data.length + ') ===');
  console.log('  expected:', t.expectedId);
  const r = hashTxId(data);
  for(const [mode,hex] of Object.entries(r)){
    const tag = hex===t.expectedId ? '  <<< MATCH' : '';
    console.log('  ' + mode + ': ' + hex + tag);
  }
  console.log('');
}
