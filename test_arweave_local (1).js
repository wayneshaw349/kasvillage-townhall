const { secp256k1 } = require('@noble/curves/secp256k1');
const { sha384 } = require('@noble/hashes/sha512');
const { keccak_256 } = require('@noble/hashes/sha3');
const { concatBytes } = require('@noble/hashes/utils');
const crypto = require('crypto');
const https = require('https');

async function deepHash(data) {
  if (data instanceof Uint8Array) {
    const tag = concatBytes(new TextEncoder().encode('blob'), new TextEncoder().encode(data.byteLength.toString()));
    return sha384(concatBytes(sha384(tag), sha384(data)));
  }
  const tag = concatBytes(new TextEncoder().encode('list'), new TextEncoder().encode(data.length.toString()));
  let acc = sha384(tag);
  for (const chunk of data) { acc = sha384(concatBytes(acc, await deepHash(chunk))); }
  return acc;
}

function avroLong(v) { let n = v >= 0 ? v * 2 : (-v) * 2 - 1; const bytes = []; while (n > 0x7f) { bytes.push((n & 0x7f) | 0x80); n >>>= 7; } bytes.push(n & 0x7f); return new Uint8Array(bytes); }
function w64LE(v) { const b = new Uint8Array(8); b[0]=v&0xff; b[1]=(v>>8)&0xff; b[2]=(v>>16)&0xff; b[3]=(v>>24)&0xff; return b; }

async function main() {
  const priv = crypto.randomBytes(32);
  const pub = secp256k1.getPublicKey(priv, false);
  const enc = new TextEncoder();
  const tags = [{name:'App-Name',value:'KasVillage'},{name:'Content-Type',value:'application/json'},{name:'KV-Type',value:'test'}];
  const tp = [avroLong(tags.length)];
  for (const t of tags) { const n=enc.encode(t.name); const v=enc.encode(t.value); tp.push(avroLong(n.length),n,avroLong(v.length),v); }
  tp.push(avroLong(0));
  let st = new Uint8Array(0); for (const p of tp) st = concatBytes(st, p);
  const data = enc.encode(JSON.stringify({test:'KasVillage final',ts:Date.now()}));
  const toSign = await deepHash([enc.encode('dataitem'),enc.encode('1'),enc.encode('3'),pub,new Uint8Array(0),new Uint8Array(0),st,data]);
  const prefix = Buffer.concat([Buffer.from([0x19]), Buffer.from('Ethereum Signed Message:\n'+toSign.length)]);
  const ethHash = keccak_256(concatBytes(new Uint8Array(prefix), toSign));
  const sig = secp256k1.sign(ethHash, priv);
  const sigBytes = new Uint8Array(65); sigBytes.set(sig.toCompactRawBytes(), 0); sigBytes[64] = sig.recovery + 27;
  const item = concatBytes(new Uint8Array([3,0]),sigBytes,pub,new Uint8Array([0]),new Uint8Array([0]),w64LE(tags.length),w64LE(st.length),st,data);
  console.log('Size:', item.length);
  const buf = Buffer.from(item);
  const req = https.request({hostname:'turbo.ardrive.io',path:'/v1/tx',method:'POST',headers:{'Content-Type':'application/octet-stream','Content-Length':buf.length}},(res)=>{let body='';res.on('data',d=>body+=d);res.on('end',()=>{console.log('Status:',res.statusCode);if(res.statusCode===200){const j=JSON.parse(body);console.log('TX ID:',j.id);console.log('URL: https://arweave.net/'+j.id);console.log('SUCCESS!');}else{console.log('Error:',body.slice(0,300));}});});
  req.on('error',e=>console.log('Net error:',e.message));
  req.write(buf); req.end();
}
main().catch(console.error);
