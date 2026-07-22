#!/usr/bin/env node
// Persists the mnemonic to SecureStore ('kv_mnemonic', device-only) in createWallet
// ONLY (anchor pinned to createWallet's USER_STATS write, so restoreWalletFromMnemonic
// — which already stores kv_mnemonic — is left untouched).
// Count-guarded, CRLF-tolerant, idempotent.
// Usage:  node patch_store_kv_mnemonic.cjs [path\to\wallet_registration_v2.ts]
const fs=require('fs');
const FILE=process.argv[2]||'wallet_registration_v2.ts';
const FIND=Buffer.from('ICAgIGF3YWl0IFNlY3VyZVN0b3JlLnNldEl0ZW1Bc3luYyhTVE9SRV9LRVlTLk1BU1RFUl9TRUVELCBieXRlc1RvSGV4KHdhbGxldC5zZWVkKSwgewogICAgICBrZXljaGFpbkFjY2Vzc2libGU6IFNlY3VyZVN0b3JlLldIRU5fUEFTU0NPREVfU0VUX1RISVNfREVWSUNFX09OTFksCiAgICB9KTsKICAgIGF3YWl0IFNlY3VyZVN0b3JlLnNldEl0ZW1Bc3luYyhTVE9SRV9LRVlTLlJFR0lTVFJBVElPTl9TVEFUVVMsICd3YWxsZXRfY3JlYXRlZCcpOwogICAgYXdhaXQgQXN5bmNTdG9yYWdlLnNldEl0ZW0oU1RPUkVfS0VZUy5VU0VSX1NUQVRTLCBKU09OLnN0cmluZ2lmeShjcmVhdGVEZWZhdWx0VXNlclN0YXRzKCkpKTsK','base64').toString('utf8');
const REPL=Buffer.from('ICAgIGF3YWl0IFNlY3VyZVN0b3JlLnNldEl0ZW1Bc3luYyhTVE9SRV9LRVlTLk1BU1RFUl9TRUVELCBieXRlc1RvSGV4KHdhbGxldC5zZWVkKSwgewogICAgICBrZXljaGFpbkFjY2Vzc2libGU6IFNlY3VyZVN0b3JlLldIRU5fUEFTU0NPREVfU0VUX1RISVNfREVWSUNFX09OTFksCiAgICB9KTsKICAgIGF3YWl0IFNlY3VyZVN0b3JlLnNldEl0ZW1Bc3luYygna3ZfbW5lbW9uaWMnLCB3YWxsZXQubW5lbW9uaWMsIHsKICAgICAga2V5Y2hhaW5BY2Nlc3NpYmxlOiBTZWN1cmVTdG9yZS5XSEVOX1BBU1NDT0RFX1NFVF9USElTX0RFVklDRV9PTkxZLAogICAgfSk7CiAgICBhd2FpdCBTZWN1cmVTdG9yZS5zZXRJdGVtQXN5bmMoU1RPUkVfS0VZUy5SRUdJU1RSQVRJT05fU1RBVFVTLCAnd2FsbGV0X2NyZWF0ZWQnKTsKICAgIGF3YWl0IEFzeW5jU3RvcmFnZS5zZXRJdGVtKFNUT1JFX0tFWVMuVVNFUl9TVEFUUywgSlNPTi5zdHJpbmdpZnkoY3JlYXRlRGVmYXVsdFVzZXJTdGF0cygpKSk7Cg==','base64').toString('utf8');
let s=fs.readFileSync(FILE,'utf8');
const eol=s.includes('\r\n')?'\r\n':'\n';
// idempotency: is kv_mnemonic already written INSIDE the createWallet block (i.e. before this exact anchor)?
const anchorHasMnemonic=/setItemAsync\('kv_mnemonic', wallet\.mnemonic[\s\S]{0,400}?createDefaultUserStats/.test(s);
if(anchorHasMnemonic){console.log('[skip] createWallet already writes kv_mnemonic.');process.exit(0);}
const esc=t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\r?\n/g,'\r?\n');
const re=new RegExp(esc(FIND),'g');
const count=(s.match(re)||[]).length;
if(count!==1){console.error('[ABORT] createWallet anchor found '+count+' times (expected 1). No writes.');process.exit(1);}
s=s.replace(new RegExp(esc(FIND)),REPL.replace(/\r?\n/g,eol));
// post: exactly TWO kv_mnemonic writes now (createWallet + restore), was 1
const n=(s.match(/setItemAsync\('kv_mnemonic', wallet\.mnemonic/g)||[]).length;
if(n<1){console.error('[ABORT] post-condition failed (kv_mnemonic writes='+n+').');process.exit(1);}
fs.writeFileSync(FILE,s);
console.log('[ok] kv_mnemonic write inserted into createWallet ('+n+' total kv_mnemonic writes in file). eol='+JSON.stringify(eol));
