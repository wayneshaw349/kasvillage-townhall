const{secp256k1,schnorr}=require("@noble/curves/secp256k1");
const{sha256}=require("@noble/hashes/sha256");
const{blake2b}=require("@noble/hashes/blake2b");
const{bytesToHex,hexToBytes}=require("@noble/hashes/utils");
const N=secp256k1.CURVE.n;
const G=secp256k1.ProjectivePoint.BASE;
const HASH_KEY=new TextEncoder().encode("TransactionSigningHash");
function kb2b(d){return blake2b(d,{dkLen:32,key:HASH_KEY});}
function mod(a,m){return((a%m)+m)%m;}

// Same test keys
const BUYER={priv:"041149b90ad3189ce363bf1b3854a4c2a2067e503b1f5d53c69d17732cb20c33"};
const SELLER={priv:"3e4bf0e0bfc642b3f0645ceaf60e1e79bac5e56d2b5597220999393b53fc6efe"};
BUYER.pub=bytesToHex(secp256k1.getPublicKey(hexToBytes(BUYER.priv),true));
SELLER.pub=bytesToHex(secp256k1.getPublicKey(hexToBytes(SELLER.priv),true));

console.log("=== FROST FIXED L-HASH TEST ===");
console.log("Buyer pub:",BUYER.pub.slice(0,20));
console.log("Seller pub:",SELLER.pub.slice(0,20));

// Step 1: Aggregate keys using FIXED L hash (hexToBytes, no sessionId)
const[pk1,pk2]=[BUYER.pub,SELLER.pub].sort();
console.log("\npk1 (sorted):",pk1.slice(0,10),"=",pk1===SELLER.pub?"SELLER":"BUYER");
console.log("pk2 (sorted):",pk2.slice(0,10),"=",pk2===BUYER.pub?"BUYER":"SELLER");

// FIXED: hexToBytes instead of TextEncoder, no sessionId
const L=sha256(new Uint8Array([...hexToBytes(pk1),...hexToBytes(pk2)]));
console.log("L hash (fixed):",bytesToHex(L).slice(0,20));

const a1=mod(BigInt("0x"+bytesToHex(sha256(new Uint8Array([...L,...hexToBytes(pk1)])))),N);
const a2=mod(BigInt("0x"+bytesToHex(sha256(new Uint8Array([...L,...hexToBytes(pk2)])))),N);
const P1=secp256k1.ProjectivePoint.fromHex(pk1);
const P2=secp256k1.ProjectivePoint.fromHex(pk2);
const Pagg=P1.multiply(a1).add(P2.multiply(a2));
const aggHex=bytesToHex(Pagg.toRawBytes(true));
console.log("P_agg:",aggHex.slice(0,20),"parity:",aggHex.startsWith("02")?"EVEN":"ODD");

// Step 2: Simulate FROST nonce generation (deterministic like phone)
function genNonceDeterministic(privHex,aggPubHex,msg){
  const sk=BigInt("0x"+privHex);
  const myPub=bytesToHex(secp256k1.getPublicKey(hexToBytes(privHex),true));
  const myCoeff=myPub===pk1?a1:a2;
  let d=mod(sk*myCoeff,N);
  if(Pagg.toRawBytes(true)[0]===0x03) d=mod(N-d,N);
  const k_bytes=kb2b(new Uint8Array([...hexToBytes(d.toString(16).padStart(64,"0")),...msg]));
  let k=mod(BigInt("0x"+bytesToHex(k_bytes)),N);
  if(k===0n)k=1n;
  const R=G.multiply(k);
  return{k,d,R,R_hex:bytesToHex(R.toRawBytes(true)),d_hex:d.toString(16).padStart(64,"0")};
}

// Step 3: Build test TX (same structure as phone)
const frostScript="20"+aggHex.slice(2)+"ac";
const utxos=[
  {txId:bytesToHex(sha256(new TextEncoder().encode("buyer_tx"))),index:0,value:200000000n,scriptPubKey:frostScript},
  {txId:bytesToHex(sha256(new TextEncoder().encode("seller_tx"))),index:0,value:400000000n,scriptPubKey:frostScript},
].sort((a,b)=>a.txId.localeCompare(b.txId));
const buyerScript="20"+BUYER.pub.slice(2)+"ac";
const sellerScript="20"+SELLER.pub.slice(2)+"ac";
const totalIn=utxos.reduce((s,u)=>s+u.value,0n);
const outputs=[{value:200000000n,script:buyerScript},{value:totalIn-200000000n-10000n,script:sellerScript}];

// Step 4: Compute sighashes
function w8(v){return new Uint8Array([v]);}
function w16(v){const b=new Uint8Array(2);new DataView(b.buffer).setUint16(0,v,true);return b;}
function w32(v){const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,v,true);return b;}
function w64(v){const b=new Uint8Array(8);const d=new DataView(b.buffer);d.setUint32(0,Number(v&0xFFFFFFFFn),true);d.setUint32(4,Number(v>>32n),true);return b;}
function cat(...a){const t=a.reduce((s,x)=>s+x.length,0);const r=new Uint8Array(t);let o=0;for(const x of a){r.set(x,o);o+=x.length;}return r;}
function hPO(inp){return kb2b(cat(...inp.map(i=>cat(hexToBytes(i.txId),w32(i.index)))));}
function hSQ(inp){return kb2b(cat(...inp.map(()=>w64(0n))));}
function hSO(inp){return kb2b(new Uint8Array(inp.map(()=>1)));}
function hOUT(out){return kb2b(cat(...out.map(o=>cat(w64(o.value),w16(0),w64(BigInt(hexToBytes(o.script).length)),hexToBytes(o.script)))));}
function sighash(inp,out,idx){
  const i=inp[idx];const spk=hexToBytes(i.scriptPubKey);const sub=new Uint8Array(20);sub[0]=1;
  return kb2b(cat(w16(0),hPO(inp),hSQ(inp),hSO(inp),hexToBytes(i.txId),w32(i.index),w16(0),w64(BigInt(spk.length)),spk,w64(i.value),w64(0n),w8(1),hOUT(out),w64(0n),sub,w64(0n),new Uint8Array(32),w8(1)));
}

const sighashes=utxos.map((_,i)=>bytesToHex(sighash(utxos,outputs,i)));
console.log("\nSighash 0:",sighashes[0].slice(0,20));
console.log("Sighash 1:",sighashes[1].slice(0,20));

// Step 5: Generate nonces
const dummyMsg=hexToBytes(sighashes[0]);
const bNonce=genNonceDeterministic(BUYER.priv,aggHex,dummyMsg);
const sNonce=genNonceDeterministic(SELLER.priv,aggHex,dummyMsg);
console.log("\nBuyer R:",bNonce.R_hex.slice(0,20));
console.log("Seller R:",sNonce.R_hex.slice(0,20));
console.log("Buyer d_tweaked:",bNonce.d_hex.slice(0,20));
console.log("Seller d_tweaked:",sNonce.d_hex.slice(0,20));

// Step 6: Partial S per input (FROST 2-round)
function partialS(nonce,counterR_hex,sighash_hex){
  const Rc=secp256k1.ProjectivePoint.fromHex(counterR_hex);
  let Ragg=nonce.R.add(Rc);
  let k=nonce.k;
  if(Ragg.toRawBytes(true)[0]===0x03){k=mod(N-k,N);Ragg=Ragg.negate();}
  const Rx=Ragg.toRawBytes(true).slice(1);
  const Pfull=Pagg.toRawBytes(true);
  const Px=Pfull[0]===0x03?Pagg.negate().toRawBytes(true).slice(1):Pfull.slice(1);
  const tag=sha256(new TextEncoder().encode("BIP0340/challenge"));
  const e=mod(BigInt("0x"+bytesToHex(sha256(new Uint8Array([...tag,...tag,...Rx,...Px,...hexToBytes(sighash_hex)])))),N);
  const s=mod(k+mod(e*nonce.d,N),N);
  return{s,s_hex:s.toString(16).padStart(64,"0"),Rx_hex:bytesToHex(Rx)};
}

console.log("\n=== PER-INPUT SIGNING ===");
for(let i=0;i<sighashes.length;i++){
  const bp=partialS(bNonce,sNonce.R_hex,sighashes[i]);
  const sp=partialS(sNonce,bNonce.R_hex,sighashes[i]);
  const s_agg=mod(bp.s+sp.s,N);
  const sigHex=bp.Rx_hex+s_agg.toString(16).padStart(64,"0");
  
  // Verify with schnorr.verify
  const aggX=aggHex.slice(2);
  const valid=schnorr.verify(hexToBytes(sigHex),hexToBytes(sighashes[i]),hexToBytes(aggX));
  console.log("Input",i,":",valid?"VALID ?":"INVALID ?","sig:",sigHex.slice(0,20),"s_agg:",s_agg.toString(16).slice(0,16));
}

// Step 7: Also verify d_agg * G == P_agg (the aggregate key approach)
const sk1=pk1===BUYER.pub?BigInt("0x"+BUYER.priv):BigInt("0x"+SELLER.priv);
const sk2=pk2===BUYER.pub?BigInt("0x"+BUYER.priv):BigInt("0x"+SELLER.priv);
const dAgg=mod(mod(sk1*a1,N)+mod(sk2*a2,N),N);
const dAggP=G.multiply(dAgg);
console.log("\nd_agg*G == P_agg:",bytesToHex(dAggP.toRawBytes(true))===aggHex?"YES ?":"NO ?");

console.log("\n=== TEST COMPLETE ===");
