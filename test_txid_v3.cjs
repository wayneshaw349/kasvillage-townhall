const { blake2b } = require('@noble/hashes/blake2b');
const hexToBytes = (h) => { if(!h) return new Uint8Array(0); const b=new Uint8Array(h.length/2); for(let i=0;i<b.length;i++) b[i]=parseInt(h.substr(i*2,2),16); return b; };
const bytesToHex = (b) => Array.from(b).map(x=>x.toString(16).padStart(2,'0')).join('');
const u16=(n)=>new Uint8Array([n&0xff,(n>>8)&0xff]);
const u32=(n)=>new Uint8Array([n&0xff,(n>>8)&0xff,(n>>16)&0xff,(n>>24)&0xff]);
const u64=(n)=>{const b=new Uint8Array(8); let v=BigInt(n); for(let i=0;i<8;i++){b[i]=Number(v&0xFFn); v>>=8n;} return b;};
const concat=(...a)=>{let l=0; for(const x of a) l+=x.length; const r=new Uint8Array(l); let o=0; for(const x of a){r.set(x,o); o+=x.length;} return r;};
const varBytes=(b)=>concat(u64(b.length), b);

function serializeV0(tx){
  const p=[];
  p.push(u16(tx.version)); p.push(u64(tx.inputs.length));
  for(const inp of tx.inputs){
    p.push(hexToBytes(inp.prevTxId)); p.push(u32(inp.prevIndex));
    p.push(varBytes(new Uint8Array(0)));           // sig script excluded
    p.push(u64(inp.sequence));                     // sequence (sig_op_count skipped)
  }
  p.push(u64(tx.outputs.length));
  for(const out of tx.outputs){
    p.push(u64(out.amount)); p.push(u16(out.scriptVersion)); p.push(varBytes(hexToBytes(out.script)));
  }
  p.push(u64(tx.lockTime)); p.push(hexToBytes(tx.subnetworkId)); p.push(u64(tx.gas));
  p.push(varBytes(hexToBytes(tx.payload)));
  return concat(...p);
}
const KEY = new TextEncoder().encode('TransactionID');
const txid = (tx)=> bytesToHex(blake2b(serializeV0(tx),{dkLen:32,key:KEY}));

const NATIVE='0000000000000000000000000000000000000000';
// Hash::from_u64_word(0) = 32 bytes, u64 word 0 -> all zero? In kaspa, from_u64_word puts the u64 in the FIRST 8 bytes LE, rest zero.
const fromU64Word = (n)=>{ const b=new Uint8Array(32); const v=u64(n); b.set(v,0); return bytesToHex(b); };

const tests = [
  { name:'#1 empty', tx:{version:0,inputs:[],outputs:[],lockTime:0,subnetworkId:NATIVE,gas:0,payload:''},
    id:'2c18d5e59ca8fc4c23d9560da3bf738a8f40935c11c162017fbf2c907b7e665c' },
  // #2: input = outpoint(Hash::from_u64_word(0), index 2), sigScript [1,2], sequence 7, sigOpCount 5
  { name:'#2 one input', tx:{version:0,
      inputs:[{prevTxId:fromU64Word(0), prevIndex:2, sequence:7}],
      outputs:[], lockTime:0, subnetworkId:NATIVE, gas:0, payload:''},
    id:'b2d65ae36e123eb73f253176d7234a57656b84d0d60b9fc746ab0d0f085c9cc7' },
  // #3: same input + output value 1564, spk version 7, script [1,2,3,4,5]
  { name:'#3 input+output', tx:{version:0,
      inputs:[{prevTxId:fromU64Word(0), prevIndex:2, sequence:7}],
      outputs:[{amount:1564, scriptVersion:7, script:'0102030405'}],
      lockTime:0, subnetworkId:NATIVE, gas:0, payload:''},
    id:'67289b12146d1b5ef384332137399791a5cfe89506ff31688b0d95ae821d0a0c' },
];

for(const t of tests){
  const got = txid(t.tx);
  console.log((got===t.id?'PASS':'FAIL') + ' ' + t.name);
  if(got!==t.id){ console.log('  expected '+t.id); console.log('  got      '+got); }
}
