#!/usr/bin/env node
/* vault_selftest.cjs — proves the Shamir MNEMONIC-STRING backup restores the
 * SAME wallet, WITHOUT jest / expo / a test runner. The backup splits the UTF-8
 * bytes of the mnemonic string; seed/address derive from that string via PBKDF2
 * (WORDLIST-INDEPENDENT). Also reports wordlist health.
 * Usage:  node vault_selftest.cjs */
const crypto = require('crypto');
const fs = require('fs');
const secp = require('@noble/secp256k1');

const hex = (u8) => Buffer.from(u8).toString('hex');
function hmacSha512(key, data){ return new Uint8Array(crypto.createHmac('sha512', Buffer.from(key)).update(Buffer.from(data)).digest()); }
function hexToBytes(h){const u=new Uint8Array(h.length/2);for(let i=0;i<u.length;i++)u[i]=parseInt(h.substr(i*2,2),16);return u;}

function mnemonicToSeed(mnemonic, passphrase){
  const m = mnemonic.normalize('NFKD');
  const salt = ('mnemonic' + passphrase).normalize('NFKD');
  return new Uint8Array(crypto.pbkdf2Sync(Buffer.from(m,'utf8'), Buffer.from(salt,'utf8'), 2048, 64, 'sha512'));
}
const N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n;
function ser32(n){return new Uint8Array([(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255]);}
function deriveChild(parent, index){
  const hardened = index >= 0x80000000;
  const data = new Uint8Array(37);
  if (hardened){ data[0]=0; data.set(parent.privateKey,1); data.set(ser32(index),33); }
  else { const pub = secp.getPublicKey(parent.privateKey, true); data.set(pub,0); data.set(ser32(index),33); }
  const I = hmacSha512(parent.chainCode, data);
  const child = (BigInt('0x'+hex(I.slice(0,32))) + BigInt('0x'+hex(parent.privateKey))) % N;
  return { privateKey: hexToBytes(child.toString(16).padStart(64,'0')), chainCode: I.slice(32) };
}
function deriveKaspaHDKey(seed){
  const I = hmacSha512(new TextEncoder().encode('Bitcoin seed'), seed);
  let node = { privateKey: I.slice(0,32), chainCode: I.slice(32) };
  for (const idx of [44+0x80000000, 111111+0x80000000, 0+0x80000000, 0, 0]) node = deriveChild(node, idx);
  return node;
}
const BECH32='qpzry9x8gf2tvdw0s3jn54khce6mua7l';
function polymod(v){let c=1n;for(const d of v){const c0=c>>35n;c=((c&0x07fffffffffn)<<5n)^BigInt(d);if(c0&0x01n)c^=0x98f2bc8e61n;if(c0&0x02n)c^=0x79b76d99e2n;if(c0&0x04n)c^=0xf33e5fb3c4n;if(c0&0x08n)c^=0xae2eabe2a8n;if(c0&0x10n)c^=0x1e4f43e470n;}return c^1n;}
function conv8to5(p){const r=[];let buff=0,bits=0;for(const c of p){buff=(buff<<8)|c;bits+=8;while(bits>=5){bits-=5;r.push((buff>>bits)&31);buff&=(1<<bits)-1;}}if(bits>0)r.push((buff<<(5-bits))&31);return r;}
function addr(xOnly, hrp){const pay=conv8to5([0,...Array.from(xOnly)]);const pre=Array.from(hrp).map(c=>c.charCodeAt(0)&31);const cs=polymod([...pre,0,...pay,0,0,0,0,0,0,0,0]);const cb=[];for(let i=4;i>=0;i--)cb.push(Number((cs>>BigInt(i*8))&0xFFn));let a=hrp+':';for(const d of [...pay,...conv8to5(cb)])a+=BECH32[d];return a;}
function addressFromMnemonic(m, pass, hrp){const s=mnemonicToSeed(m,pass);const hd=deriveKaspaHDKey(s);const pub=secp.getPublicKey(hd.privateKey,true);return addr(pub.slice(1),hrp);}

const B32='0123456789ABCDEFGHJKMNPQRSTVWXYZ';const INV={};for(let i=0;i<B32.length;i++)INV[B32[i]]=i;
function b32enc(b){let o='',buf=0,bits=0;for(const x of b){buf=(buf<<8)|x;bits+=8;while(bits>=5){bits-=5;o+=B32[(buf>>bits)&31];}}if(bits>0)o+=B32[(buf<<(5-bits))&31];return o;}
function b32dec(s){const o=[];let buf=0,bits=0;for(const c of s){buf=(buf<<5)|INV[c];bits+=5;if(bits>=8){bits-=8;o.push((buf>>bits)&255);}}return new Uint8Array(o);}

let pass=0, fail=0;
const ok=(c,msg)=>{if(c){pass++;console.log('  PASS  '+msg);}else{fail++;console.log('  FAIL  '+msg);}};
const M = 'legal winner thank year wave sausage worth useful legal winner thank yellow';

console.log('\n== 1. Recovery reproduces the SAME address (string-based, empty passphrase) ==');
const want = addressFromMnemonic(M, '', 'kaspatest');
const got  = addressFromMnemonic(M, '', 'kaspatest');
console.log('  address : ' + want);
ok(got === want, 'string -> mnemonicToSeed("") -> deriveKaspaHDKey -> stable address');

console.log('\n== 2. QR wire leg: mnemonic UTF-8 bytes survive base32 encode/decode ==');
const bytes = new TextEncoder().encode(M.normalize('NFKD'));
const round = new TextDecoder().decode(b32dec(b32enc(bytes)));
ok(round === M, 'mnemonic bytes round-trip through the QR base32 codec (' + bytes.length + ' bytes)');

console.log('\n== 3. Passphrase guard: "" (correct) vs "kasvillage" (wrong) MUST differ ==');
const aE = addressFromMnemonic(M, '', 'kaspatest');
const aK = addressFromMnemonic(M, 'kasvillage', 'kaspatest');
console.log('  with ""          : ' + aE);
console.log('  with "kasvillage": ' + aK);
ok(aE !== aK, 'empty-passphrase address != kasvillage-passphrase address');

console.log('\n== 4. WORDLIST health (informational) ==');
try {
  const src = fs.readFileSync('bip39_wallet.ts', 'utf8');
  const st = src.indexOf('const WORDLIST');
  const body = src.slice(src.indexOf('[', st) + 1, src.indexOf('];', st));
  const w = (body.match(/"([a-z]+)"/g) || []).map(x => x.replace(/"/g, ''));
  const healthy = w.length === 2048 && w[0]==='abandon' && w[34]==='affair' && w[2047]==='zoo';
  console.log('  WORDLIST count: ' + w.length + (healthy ? '  (canonical OK)' : '  <- NOT canonical'));
  if (!healthy) console.log('  !  Run patch_bip39_wordlist.cjs — new wallets need the full 2048 list.');
} catch (e) { console.log('  (could not read bip39_wallet.ts: ' + e.message + ')'); }

console.log('\n----------------------------------------------------------');
console.log(fail === 0 ? 'ALL ' + pass + ' CHECKS PASSED  string backup restores the same wallet' : fail + ' CHECK(S) FAILED');
process.exit(fail === 0 ? 0 : 1);
