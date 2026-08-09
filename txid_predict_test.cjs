// txid_predict_test.cjs — determine correct txid preimage vs node
// Usage: node txid_predict_test.cjs [txid]
// Requires @noble/hashes in node_modules (already present).
const { blake2b } = require('@noble/hashes/blake2b');

const TXID = process.argv[2] || '856bab2f8384cc802aed78fa71d98c29f2297584380b01147ac821213f9949b2';
const API = 'https://api-tn10.kaspa.org';
const KEY = new TextEncoder().encode('TransactionID');

const hexToBytes = (h) => Uint8Array.from((h.match(/../g) || []).map(b => parseInt(b, 16)));
const bytesToHex = (b) => Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
function writeU8(v){ return Uint8Array.of(v & 0xff); }
function writeU16LE(v){ const b=new Uint8Array(2); new DataView(b.buffer).setUint16(0,v,true); return b; }
function writeU32LE(v){ const b=new Uint8Array(4); new DataView(b.buffer).setUint32(0,v,true); return b; }
function writeU64LE(v){ const b=new Uint8Array(8); new DataView(b.buffer).setBigUint64(0,BigInt(v),true); return b; }
function varBytes(d){ return concat(writeU64LE(d.length), d); }
function concat(...arrs){ const n=arrs.reduce((s,a)=>s+a.length,0); const out=new Uint8Array(n); let o=0; for(const a of arrs){ out.set(a,o); o+=a.length; } return out; }
const H = (pre) => bytesToHex(blake2b(pre, { dkLen: 32, key: KEY }));

(async () => {
  const r = await fetch(`${API}/transactions/${TXID}?inputs=true&outputs=true&resolve_previous_outpoints=no`);
  if (!r.ok) { console.error('fetch failed', r.status); process.exit(1); }
  const tx = await r.json();
  console.log('node txid   :', tx.transaction_id);
  console.log('node mass   :', tx.mass);
  console.log('payload len :', (tx.payload || '').length / 2, 'bytes');

  const inputs = tx.inputs.map(i => ({
    prevTxId: i.previous_outpoint_hash,
    prevIndex: i.previous_outpoint_index !== undefined ? Number(i.previous_outpoint_index) : Number(i.previous_outpoint_index || 0),
    sequence: BigInt(i.sequence ?? 0),
    sigOpCount: Number(i.sig_op_count ?? 1),
  }));
  const outputs = tx.outputs.map(o => ({
    amount: BigInt(o.amount),
    scriptVersion: Number(o.script_public_key_version ?? 0),
    scriptHex: o.script_public_key,
  }));
  const lockTime = BigInt(tx.lock_time ?? 0);
  const subnetworkId = tx.subnetwork_id || '0000000000000000000000000000000000000000';
  const gas = BigInt(tx.gas ?? 0);
  const payload = tx.payload || '';
  const mass = BigInt(tx.mass ?? 0);

  function core() {
    const p = [];
    p.push(writeU16LE(Number(tx.version ?? 0)));
    p.push(writeU64LE(inputs.length));
    for (const inp of inputs) {
      p.push(hexToBytes(inp.prevTxId));
      p.push(writeU32LE(inp.prevIndex));
      p.push(varBytes(new Uint8Array(0)));
      p.push(writeU64LE(inp.sequence));
    }
    p.push(writeU64LE(outputs.length));
    for (const o of outputs) {
      p.push(writeU64LE(o.amount));
      p.push(writeU16LE(o.scriptVersion));
      p.push(varBytes(hexToBytes(o.scriptHex)));
    }
    p.push(writeU64LE(lockTime));
    p.push(hexToBytes(subnetworkId));
    p.push(writeU64LE(gas));
    return p;
  }

  const variants = {
    'V0 current (varBytes payload, no mass)': () => H(concat(...core(), varBytes(hexToBytes(payload)))),
    'V1 + mass u64 AFTER payload (if mass>0)': () => H(concat(...core(), varBytes(hexToBytes(payload)), ...(mass > 0n ? [writeU64LE(mass)] : []))),
    'V2 + mass u64 BEFORE payload (if mass>0)': () => H(concat(...core(), ...(mass > 0n ? [writeU64LE(mass)] : []), varBytes(hexToBytes(payload)))),
    'V3 payloadHash(blake2b) instead of varBytes, no mass': () => {
      const ph = payload ? blake2b(hexToBytes(payload), { dkLen: 32 }) : new Uint8Array(32);
      return H(concat(...core(), ph));
    },
    'V4 varBytes payload + mass always (even 0)': () => H(concat(...core(), varBytes(hexToBytes(payload)), writeU64LE(mass))),
    'V5 sigOpCount in input block, varBytes payload, mass after': () => {
      const p = [];
      p.push(writeU16LE(Number(tx.version ?? 0)));
      p.push(writeU64LE(inputs.length));
      for (const inp of inputs) {
        p.push(hexToBytes(inp.prevTxId));
        p.push(writeU32LE(inp.prevIndex));
        p.push(varBytes(new Uint8Array(0)));
        p.push(writeU64LE(inp.sequence));
        p.push(writeU8(inp.sigOpCount));
      }
      p.push(writeU64LE(outputs.length));
      for (const o of outputs) {
        p.push(writeU64LE(o.amount));
        p.push(writeU16LE(o.scriptVersion));
        p.push(varBytes(hexToBytes(o.scriptHex)));
      }
      p.push(writeU64LE(lockTime));
      p.push(hexToBytes(subnetworkId));
      p.push(writeU64LE(gas));
      p.push(varBytes(hexToBytes(payload)));
      if (mass > 0n) p.push(writeU64LE(mass));
      return H(concat(...p));
    },
  };

  let winner = null;
  for (const [name, fn] of Object.entries(variants)) {
    try {
      const id = fn();
      const match = id === tx.transaction_id;
      console.log((match ? 'MATCH  ✓ ' : 'miss     ') + name + ' -> ' + id.slice(0, 16));
      if (match) winner = name;
    } catch (e) { console.log('ERROR    ' + name + ': ' + e.message); }
  }
  console.log(winner ? '\nWINNER: ' + winner : '\nNo variant matched — paste this output back.');
})();
