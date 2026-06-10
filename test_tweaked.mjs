import * as secp from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { blake2b } from '@noble/hashes/blake2b';
import { hmac } from '@noble/hashes/hmac';

secp.etc.hmacSha256Sync = (key, ...msgs) => {
  const cat = new Uint8Array(msgs.reduce((n, m) => n + m.length, 0));
  let off = 0; for (const m of msgs) { cat.set(m, off); off += m.length; }
  return hmac(sha256, key, cat);
};

const N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
const KK = new TextEncoder().encode('TransactionSigningHash');
const h2b = hex => { const b = new Uint8Array(hex.length/2); for(let i=0;i<b.length;i++) b[i]=parseInt(hex.slice(i*2,i*2+2),16); return b; };
const b2h = b => Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
const kb = d => blake2b(d, { dkLen: 32, key: KK });

console.log('=== FROST WITH MuSig TWEAK (matching patched frost_complete.ts) ===\n');

const bPriv = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
const sPriv = 'f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5';
const bPub = b2h(secp.getPublicKey(h2b(bPriv), true));
const sPub = b2h(secp.getPublicKey(h2b(sPriv), true));
const [pk1,pk2] = [bPub,sPub].sort();

const _L = sha256(new TextEncoder().encode(pk1+pk2+'AGR_TEST'));
const a1 = BigInt('0x'+b2h(sha256(new Uint8Array([..._L,...h2b(pk1)]))))%N;
const a2 = BigInt('0x'+b2h(sha256(new Uint8Array([..._L,...h2b(pk2)]))))%N;
const Pa = secp.ProjectivePoint.fromHex(pk1).multiply(a1).add(secp.ProjectivePoint.fromHex(pk2).multiply(a2));
const aH = b2h(Pa.toRawBytes(true));

const msg = new TextEncoder().encode(JSON.stringify({frost:'kaspatest:qf',aggPubkey:aH,to:'kaspatest:qr',amount:'1500000000'}));
const mH = kb(msg);

function nonce(priv, pub) {
  const sk = BigInt('0x'+priv);
  const myA = pub === pk1 ? a1 : a2;
  const skt = (sk * myA) % N;
  const Pab = Pa.toRawBytes(true);
  let d = skt; if (Pab[0]===0x03) d=(N-skt)%N;
  const kB = kb(new Uint8Array([...h2b(d.toString(16).padStart(64,'0')),...mH]));
  let k = BigInt('0x'+b2h(kB))%N; if(k===0n)k=1n;
  const R = secp.ProjectivePoint.BASE.multiply(k);
  return { R_hex:b2h(R.toRawBytes(true)), k_private:k.toString(16).padStart(64,'0'), d_tweaked:d.toString(16).padStart(64,'0'), message_hex:b2h(mH) };
}

function pS(my, cpR) {
  const Rm = secp.ProjectivePoint.fromHex(my.R_hex);
  const Rt = secp.ProjectivePoint.fromHex(cpR);
  let Ra = Rm.add(Rt);
  let k = BigInt('0x'+my.k_private);
  const Rab = Ra.toRawBytes(true);
  if(Rab[0]===0x03){k=(N-k)%N;Ra=Ra.negate();}
  const Rax = Ra.toRawBytes(true).slice(1);
  const Pf = Pa.toRawBytes(true);
  const Px = Pf[0]===0x03 ? Pa.negate().toRawBytes(true).slice(1) : Pf.slice(1);
  const eH = kb(new Uint8Array([...Rax,...Px,...mH]));
  const e = BigInt('0x'+b2h(eH))%N;
  const d = BigInt('0x'+my.d_tweaked);
  const s = (k+e*d)%N;
  return { s_hex:s.toString(16).padStart(64,'0'), R_agg_x_hex:b2h(Rax), e };
}

const nA = nonce(bPriv, bPub);
const nB = nonce(sPriv, sPub);
console.log('R_A:', nA.R_hex.slice(0,16));
console.log('R_B:', nB.R_hex.slice(0,16));

const pA = pS(nA, nB.R_hex);
const pB = pS(nB, nA.R_hex);
console.log('R_agg match:', pA.R_agg_x_hex===pB.R_agg_x_hex?'✅':'❌');
console.log('e match:', pA.e===pB.e?'✅':'❌');

const sA = (BigInt('0x'+pA.s_hex)+BigInt('0x'+pB.s_hex))%N;
const sG = secp.ProjectivePoint.BASE.multiply(sA);
const Rv = secp.ProjectivePoint.fromHex(new Uint8Array([0x02,...h2b(pA.R_agg_x_hex)]));
const Pv = Pa.toRawBytes(true)[0]===0x03?Pa.negate():Pa;
const ex = Rv.add(Pv.multiply(pA.e));

const a = b2h(sG.toRawBytes(true).slice(1));
const b = b2h(ex.toRawBytes(true).slice(1));
console.log('\ns*G:', a.slice(0,24));
console.log('R+eP:', b.slice(0,24));
console.log('BIP340:', a===b ? '✅ VERIFIED' : '❌ INVALID');
if(a===b) console.log('\n🎉 FROST 2-of-2 with MuSig tweak: FULLY VALID');
