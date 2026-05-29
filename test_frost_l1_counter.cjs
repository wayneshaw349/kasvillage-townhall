const{secp256k1,schnorr}=require("@noble/curves/secp256k1");
const{sha256}=require("@noble/hashes/sha256");
const{blake2b}=require("@noble/hashes/blake2b");
const{bytesToHex,hexToBytes}=require("@noble/hashes/utils");
const N=secp256k1.CURVE.n;
const G=secp256k1.ProjectivePoint.BASE;
const HASH_KEY=new TextEncoder().encode("TransactionSigningHash");
function kb2b(d){return blake2b(d,{dkLen:32,key:HASH_KEY});}
function mod(a,m){return((a%m)+m)%m;}

const BUYER={priv:"041149b90ad3189ce363bf1b3854a4c2a2067e503b1f5d53c69d17732cb20c33"};
const SELLER={priv:"3e4bf0e0bfc642b3f0645ceaf60e1e79bac5e56d2b5597220999393b53fc6efe"};
BUYER.pub=bytesToHex(secp256k1.getPublicKey(hexToBytes(BUYER.priv),true));
SELLER.pub=bytesToHex(secp256k1.getPublicKey(hexToBytes(SELLER.priv),true));

const[pk1,pk2]=[BUYER.pub,SELLER.pub].sort();
// Counter set by L1 loop below
let COUNTER = 0;
function deriveWithCounter(cnt) {
const cb = (cnt > 0) ? new TextEncoder().encode(String(cnt)) : new Uint8Array(0);
return sha256(new Uint8Array([...hexToBytes(pk1),...hexToBytes(pk2),...cb]));
}
let L=deriveWithCounter(0);
let a1=mod(BigInt("0x"+bytesToHex(sha256(new Uint8Array([...L,...hexToBytes(pk1)])))),N);
let a2=mod(BigInt("0x"+bytesToHex(sha256(new Uint8Array([...L,...hexToBytes(pk2)])))),N);
const P1=secp256k1.ProjectivePoint.fromHex(pk1);
const P2=secp256k1.ProjectivePoint.fromHex(pk2);
let Pagg=P1.multiply(a1).add(P2.multiply(a2));
let aggHex=bytesToHex(Pagg.toRawBytes(true));
let aggXOnly=aggHex.slice(2);
let frostScript="20"+aggXOnly+"ac";

// Derive FROST address
const prefix="kaspatest";
const CHARSET="qpzry9x8gf2tvdw0s3jn54khce6mua7l";
function kaspaPolymod(vals){let c=1n;for(const d of vals){const c0=c>>35n;c=((c&0x07fffffffffn)<<5n)^BigInt(d);if(c0&1n)c^=0x98f2bc8e61n;if(c0&2n)c^=0x79b76d99e2n;if(c0&4n)c^=0xf33e5fb3c4n;if(c0&8n)c^=0xae2eabe2a8n;if(c0&0x10n)c^=0x1e4f43e470n;}return c^1n;}
function conv8to5(p){const r=[];let b=0,bits=0;for(const c of p){b=(b<<8)|c;bits+=8;while(bits>=5){bits-=5;r.push((b>>bits)&31);b&=(1<<bits)-1;}}if(bits>0)r.push((b<<(5-bits))&31);return r;}
const xOnly=hexToBytes(aggXOnly);
const fullPayload=[0,...Array.from(xOnly)];
const fp5=conv8to5(fullPayload);
const pfx5=Array.from(prefix).map(c=>c.charCodeAt(0)&0x1f);
const csIn=[...pfx5,0,...fp5,0,0,0,0,0,0,0,0];
const cs=kaspaPolymod(csIn);
const csB=[];for(let i=4;i>=0;i--)csB.push(Number((cs>>BigInt(i*8))&0xFFn));
const cs5=conv8to5(csB);
let addr=prefix+":";for(const d of[...fp5,...cs5])addr+=CHARSET[d];

const FORCE_COUNTER = 1; // Set to specific counter to test spending
console.log("=== FROST L1 TEST WITH COUNTER ===");
console.log("FROST address:",addr);
console.log("FROST script:",frostScript.slice(0,20)+"...");
console.log("P_agg:",aggHex.slice(0,20));

// Check balance on L1
async function findCleanCounter() {
  const API2 = "https://api-tn10.kaspa.org";
  for (let cnt = 0; cnt < 10; cnt++) {
    const _L = deriveWithCounter(cnt);
    const _a1 = mod(BigInt("0x"+bytesToHex(sha256(new Uint8Array([..._L,...hexToBytes(pk1)])))),N);
    const _a2 = mod(BigInt("0x"+bytesToHex(sha256(new Uint8Array([..._L,...hexToBytes(pk2)])))),N);
    const _Pagg = P1.multiply(_a1).add(P2.multiply(_a2));
    const _xOnly = bytesToHex(_Pagg.toRawBytes(true)).slice(2);
    const _payload = [0,...Array.from(hexToBytes(_xOnly))];
    const _fp5 = conv8to5(_payload);
    const _pfx5 = Array.from(prefix).map(c=>c.charCodeAt(0)&0x1f);
    const _csIn = [..._pfx5,0,..._fp5,0,0,0,0,0,0,0,0];
    const _cs = kaspaPolymod(_csIn);
    const _csB = []; for(let i=4;i>=0;i--) _csB.push(Number((_cs>>BigInt(i*8))&0xFFn));
    const _cs5 = conv8to5(_csB);
    let _addr = prefix+":"; for(const d of[..._fp5,..._cs5]) _addr += CHARSET[d];
    try {
      const r = await fetch(API2 + "/addresses/" + _addr + "/balance");
      const d = await r.json();
      const bal = BigInt(d.balance || "0");
      if (bal === 0n) {
        console.log("Counter", cnt, "-> CLEAN:", _addr.slice(0,45));
        return cnt;
      } else {
        console.log("Counter", cnt, "->", Number(bal)/1e8, "KAS (skip)");
      }
    } catch { return cnt; }
  }
  return 0;
}

async function run(){
  // L1 counter loop
  COUNTER = (typeof FORCE_COUNTER !== 'undefined' && FORCE_COUNTER >= 0) ? FORCE_COUNTER : await findCleanCounter();
  console.log('Forced counter:', COUNTER);
  console.log("Using counter:", COUNTER);
  // Rederive with selected counter
  L = deriveWithCounter(COUNTER);
  const _a1r = mod(BigInt("0x"+bytesToHex(sha256(new Uint8Array([...L,...hexToBytes(pk1)])))),N);
  const _a2r = mod(BigInt("0x"+bytesToHex(sha256(new Uint8Array([...L,...hexToBytes(pk2)])))),N);
  // Reassign globals
  a1 = _a1r; a2 = _a2r;
  Pagg = P1.multiply(a1).add(P2.multiply(a2));
  aggHex = bytesToHex(Pagg.toRawBytes(true));
  aggXOnly = aggHex.slice(2);
  frostScript = "20" + aggXOnly + "ac";
  // Rederive address
  const xOnly2 = hexToBytes(aggXOnly);
  const fp2 = [0,...Array.from(xOnly2)];
  const fp52 = conv8to5(fp2);
  const pfx52 = Array.from(prefix).map(c2=>c2.charCodeAt(0)&0x1f);
  const csIn2 = [...pfx52,0,...fp52,0,0,0,0,0,0,0,0];
  const cs2 = kaspaPolymod(csIn2);
  const csB2 = []; for(let i=4;i>=0;i--) csB2.push(Number((cs2>>BigInt(i*8))&0xFFn));
  const cs52 = conv8to5(csB2);
  addr = prefix+":"; for(const d of[...fp52,...cs52]) addr += CHARSET[d];
  console.log("FROST address:", addr);
  console.log("FROST script:", frostScript.slice(0,20)+"...");
  const API="https://api-tn10.kaspa.org";
  
  // Check FROST address balance
  console.log("\nChecking FROST address balance...");
  const utxoResp=await fetch(API+"/addresses/"+addr+"/utxos");
  const utxoData=await utxoResp.json();
  
  if(!utxoData||utxoData.length===0){
    console.log("No UTXOs at FROST address. Need to fund it first.");
    console.log("Send test KAS to:",addr);
    console.log("\nBut first, verify FROST math offline:");
    offlineVerify();
    return;
  }
  
  console.log("Found",utxoData.length,"UTXOs:");
  let totalBal=0n;
  for(const u of utxoData){
    const amt=BigInt(u.utxoEntry.amount);
    totalBal+=amt;
    console.log("  ",u.outpoint.transactionId.slice(0,16)+"...:"+u.outpoint.index,"=",Number(amt)/1e8,"KAS");
  }
  console.log("Total:",Number(totalBal)/1e8,"KAS");
  
  // Sort UTXOs deterministically
  const sortedUtxos=utxoData.sort((a,b)=>a.outpoint.transactionId.localeCompare(b.outpoint.transactionId));
  
  // Build TX: send everything back to buyer and seller
  const buyerAmt=200000000n;
  const fee=300000n;
  const sellerAmt=totalBal-buyerAmt-fee;
  const buyerScript2="20"+BUYER.pub.slice(2)+"ac";
  const sellerScript2="20"+SELLER.pub.slice(2)+"ac";
  const inputs=sortedUtxos.map(u=>({txId:u.outpoint.transactionId,index:u.outpoint.index,value:BigInt(u.utxoEntry.amount),scriptPubKey:u.utxoEntry.scriptPublicKey.scriptPublicKey}));
  const outputs2=[{value:buyerAmt,script:buyerScript2},{value:sellerAmt,script:sellerScript2}];
  
  console.log("\nTX: buyer gets",Number(buyerAmt)/1e8,"KAS, seller gets",Number(sellerAmt)/1e8,"KAS, fee",Number(fee)/1e8);
  
  // Sighashes
  function w8(v){return new Uint8Array([v]);}
  function w16(v){const b=new Uint8Array(2);new DataView(b.buffer).setUint16(0,v,true);return b;}
  function w32(v){const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,v,true);return b;}
  function w64(v){const b=new Uint8Array(8);const d=new DataView(b.buffer);d.setUint32(0,Number(v&0xFFFFFFFFn),true);d.setUint32(4,Number(v>>32n),true);return b;}
  function cat(...a){const t=a.reduce((s,x)=>s+x.length,0);const r=new Uint8Array(t);let o=0;for(const x of a){r.set(x,o);o+=x.length;}return r;}
  
  function computeSighash(inp,out,idx){
    const ii=inp[idx];const spk=hexToBytes(ii.scriptPubKey);const sub=new Uint8Array(20);
    return kb2b(cat(w16(0),
      kb2b(cat(...inp.map(i=>cat(hexToBytes(i.txId),w32(i.index))))),
      kb2b(cat(...inp.map(()=>w64(0n)))),
      kb2b(new Uint8Array(inp.map(()=>1))),
      hexToBytes(ii.txId),w32(ii.index),w16(0),w64(BigInt(spk.length)),spk,w64(ii.value),w64(0n),w8(1),
      kb2b(cat(...out.map(o=>cat(w64(o.value),w16(0),w64(BigInt(hexToBytes(o.script).length)),hexToBytes(o.script))))),
      w64(0n),sub,w64(0n),new Uint8Array(32),w8(1)));
  }
  
  // Generate nonces
  function genNonce(privHex,msg){
    const myPub=bytesToHex(secp256k1.getPublicKey(hexToBytes(privHex),true));
    const myCoeff=myPub===pk1?a1:a2;
    let d=mod(BigInt("0x"+privHex)*myCoeff,N);
    if(Pagg.toRawBytes(true)[0]===0x03)d=mod(N-d,N);
    const k_bytes=kb2b(new Uint8Array([...hexToBytes(d.toString(16).padStart(64,"0")),...msg]));
    let k=mod(BigInt("0x"+bytesToHex(k_bytes)),N);
    if(k===0n)k=1n;
    return{k,d,R:G.multiply(k),R_hex:bytesToHex(G.multiply(k).toRawBytes(true))};
  }
  
  const msg0=computeSighash(inputs,outputs2,0);
  const bN=genNonce(BUYER.priv,msg0);
  const sN=genNonce(SELLER.priv,msg0);
  console.log("Buyer R:",bN.R_hex.slice(0,20));
  console.log("Seller R:",sN.R_hex.slice(0,20));
  
  // Sign each input
  const signedInputs=[];
  for(let idx=0;idx<inputs.length;idx++){
    const sh=bytesToHex(computeSighash(inputs,outputs2,idx));
    
    // Buyer partial
    const Rc_b=secp256k1.ProjectivePoint.fromHex(sN.R_hex);
    let Ragg_b=bN.R.add(Rc_b);
    let kb=bN.k;
    if(Ragg_b.toRawBytes(true)[0]===0x03){kb=mod(N-kb,N);Ragg_b=Ragg_b.negate();}
    const Rx=Ragg_b.toRawBytes(true).slice(1);
    const Pfull=Pagg.toRawBytes(true);
    const Px=Pfull[0]===0x03?Pagg.negate().toRawBytes(true).slice(1):Pfull.slice(1);
    const tag=sha256(new TextEncoder().encode("BIP0340/challenge"));
    const e=mod(BigInt("0x"+bytesToHex(sha256(new Uint8Array([...tag,...tag,...Rx,...Px,...hexToBytes(sh)])))),N);
    const sb=mod(kb+mod(e*bN.d,N),N);
    
    // Seller partial
    const Rc_s=secp256k1.ProjectivePoint.fromHex(bN.R_hex);
    let Ragg_s=sN.R.add(Rc_s);
    let ks=sN.k;
    if(Ragg_s.toRawBytes(true)[0]===0x03){ks=mod(N-ks,N);}
    const ss=mod(ks+mod(e*sN.d,N),N);
    
    const s_agg=mod(sb+ss,N);
    const sigHex=bytesToHex(Rx)+s_agg.toString(16).padStart(64,"0");
    
    // Verify locally
    const valid=schnorr.verify(hexToBytes(sigHex),hexToBytes(sh),hexToBytes(aggXOnly));
    console.log("Input",idx,"sighash:",sh.slice(0,16),"sig:",sigHex.slice(0,16),"verify:",valid?"VALID":"INVALID");
    
    if(!valid){console.log("ABORT: local verify failed");return;}
    
    // Build signatureScript
    const sigB=hexToBytes(sigHex);
    const swt=new Uint8Array(sigB.length+1);swt.set(sigB);swt[sigB.length]=0x01;
    const ss2=new Uint8Array(1+swt.length);ss2[0]=swt.length;ss2.set(swt,1);
    signedInputs.push({
      previousOutpoint:{transactionId:inputs[idx].txId,index:inputs[idx].index},
      signatureScript:bytesToHex(ss2),
      sequence:"0",
      sigOpCount:1
    });
  }
  
  // Build and submit TX
  const txBody={
    transaction:{
      version:0,
      inputs:signedInputs,
      outputs:outputs2.map(o=>({amount:o.value.toString(),scriptPublicKey:{version:0,scriptPublicKey:o.script}})),
      lockTime:"0",
      subnetworkId:"0000000000000000000000000000000000000000",
      gas:"0",
      payload:""
    }
  };
  
  console.log("\nSubmitting to Kaspa L1...");
  const submitResp=await fetch(API+"/transactions",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(txBody)
  });
  const submitData=await submitResp.json();
  console.log("L1 Response:",JSON.stringify(submitData));
  
  if(submitData.transactionId){
    console.log("\n*** SUCCESS! TX ID:",submitData.transactionId,"***");
    console.log("Explorer: https://explorer-tn10.kaspa.org/txs/"+submitData.transactionId);
  }else{
    console.log("\n*** FAILED ***");
  }
}

function offlineVerify(){
  // Quick offline verify with dummy data
  const dummySH="deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
  const msg=hexToBytes(dummySH);
  
  function mkNonce(privHex){
    const myPub=bytesToHex(secp256k1.getPublicKey(hexToBytes(privHex),true));
    const myCoeff=myPub===pk1?a1:a2;
    let d=mod(BigInt("0x"+privHex)*myCoeff,N);
    if(Pagg.toRawBytes(true)[0]===0x03)d=mod(N-d,N);
    const k_bytes=kb2b(new Uint8Array([...hexToBytes(d.toString(16).padStart(64,"0")),...msg]));
    let k=mod(BigInt("0x"+bytesToHex(k_bytes)),N);
    if(k===0n)k=1n;
    return{k,d,R:G.multiply(k),R_hex:bytesToHex(G.multiply(k).toRawBytes(true))};
  }
  
  const bN=mkNonce(BUYER.priv);
  const sN=mkNonce(SELLER.priv);
  const Rc=secp256k1.ProjectivePoint.fromHex(sN.R_hex);
  let Ragg=bN.R.add(Rc);
  let kb=bN.k,ks=sN.k;
  if(Ragg.toRawBytes(true)[0]===0x03){kb=mod(N-kb,N);ks=mod(N-ks,N);Ragg=Ragg.negate();}
  const Rx=Ragg.toRawBytes(true).slice(1);
  const Pfull=Pagg.toRawBytes(true);
  const Px=Pfull[0]===0x03?Pagg.negate().toRawBytes(true).slice(1):Pfull.slice(1);
  const tag=sha256(new TextEncoder().encode("BIP0340/challenge"));
  const e=mod(BigInt("0x"+bytesToHex(sha256(new Uint8Array([...tag,...tag,...Rx,...Px,...msg])))),N);
  const sb=mod(kb+mod(e*bN.d,N),N);
  const ss=mod(ks+mod(e*sN.d,N),N);
  const s_agg=mod(sb+ss,N);
  const sigHex=bytesToHex(Rx)+s_agg.toString(16).padStart(64,"0");
  const valid=schnorr.verify(hexToBytes(sigHex),msg,hexToBytes(aggXOnly));
  console.log("\nOffline BIP340 verify:",valid?"VALID ?":"INVALID ?");
  console.log("FROST address for funding:",addr);
}

run().catch(e=>console.error("Error:",e));
