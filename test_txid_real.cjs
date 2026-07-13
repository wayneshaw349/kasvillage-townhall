const { blake2b } = require('@noble/hashes/blake2b');
const hexToBytes=(h)=>{if(!h)return new Uint8Array(0);const b=new Uint8Array(h.length/2);for(let i=0;i<b.length;i++)b[i]=parseInt(h.substr(i*2,2),16);return b;};
const bytesToHex=(b)=>Array.from(b).map(x=>x.toString(16).padStart(2,'0')).join('');
const u16=(n)=>new Uint8Array([n&0xff,(n>>8)&0xff]);
const u32=(n)=>new Uint8Array([n&0xff,(n>>8)&0xff,(n>>16)&0xff,(n>>24)&0xff]);
const u64=(n)=>{const b=new Uint8Array(8);let v=BigInt(n);for(let i=0;i<8;i++){b[i]=Number(v&0xFFn);v>>=8n;}return b;};
const concat=(...a)=>{let l=0;for(const x of a)l+=x.length;const r=new Uint8Array(l);let o=0;for(const x of a){r.set(x,o);o+=x.length;}return r;};
const varBytes=(b)=>concat(u64(b.length),b);

function serializeV0(tx){
  const p=[];
  p.push(u16(tx.version)); p.push(u64(tx.inputs.length));
  for(const inp of tx.inputs){
    p.push(hexToBytes(inp.prevTxId)); p.push(u32(inp.prevIndex));
    p.push(varBytes(new Uint8Array(0))); p.push(u64(inp.sequence));
  }
  p.push(u64(tx.outputs.length));
  for(const out of tx.outputs){
    p.push(u64(out.amount)); p.push(u16(out.scriptVersion)); p.push(varBytes(hexToBytes(out.script)));
  }
  p.push(u64(tx.lockTime)); p.push(hexToBytes(tx.subnetworkId)); p.push(u64(tx.gas));
  p.push(varBytes(hexToBytes(tx.payload)));
  return concat(...p);
}
const KEY=new TextEncoder().encode('TransactionID');
const txid=(tx)=>bytesToHex(blake2b(serializeV0(tx),{dkLen:32,key:KEY}));

// REAL tx from api-tn10: a1bf97ae... (seller collateral funding)
const real = {
  version:0,
  inputs:[{ prevTxId:'25c93266f060a478436a838590e1c622481b3182835477fcfc1a8457d54f9218', prevIndex:1, sequence:0 }],
  outputs:[
    { amount:600000000,   scriptVersion:0, script:'20d2612e74ae37a6929e76b956398f769316e594480b57e975cf298bac046a7d1fac' },
    { amount:14698001500, scriptVersion:0, script:'20947bbfc963b010bebe71536dff6b02b2aa6a9d788338033a148c4aadb3930183ac' },
  ],
  lockTime:0, subnetworkId:'0000000000000000000000000000000000000000', gas:0, payload:''
};
const expected='a1bf97aec48160420c0ca4a4b09030d88ca36059a108b0a5ca0f729fc3e1f2a2';
const got=txid(real);
console.log((got===expected?'PASS':'FAIL')+' real tx a1bf97ae');
console.log('  expected '+expected);
console.log('  got      '+got);
