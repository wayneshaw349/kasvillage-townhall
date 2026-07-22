#!/usr/bin/env node
// Persists the mnemonic to SecureStore ('kv_mnemonic', device-only) in createWallet,
// so Vault Backup + Export Seed can find it. Same Keychain flag as the private key.
// Count-guarded, CRLF-tolerant, idempotent.
// Usage:  node patch_store_kv_mnemonic.cjs [path\to\wallet_registration_v2.ts]
const fs=require('fs');
const FILE=process.argv[2]||'wallet_registration_v2.ts';
const FIND=Buffer.from('ICAgIGF3YWl0IFNlY3VyZVN0b3JlLnNldEl0ZW1Bc3luYyhTVE9SRV9LRVlTLk1BU1RFUl9TRUVELCBieXRlc1RvSGV4KHdhbGxldC5zZWVkKSwgewogICAgICBrZXljaGFpbkFjY2Vzc2libGU6IFNlY3VyZVN0b3JlLldIRU5fUEFTU0NPREVfU0VUX1RISVNfREVWSUNFX09OTFksCiAgICB9KTsKICAgIGF3YWl0IFNlY3VyZVN0b3JlLnNldEl0ZW1Bc3luYyhTVE9SRV9LRVlTLlJFR0lTVFJBVElPTl9TVEFUVVMsICd3YWxsZXRfY3JlYXRlZCcpOwo=','base64').toString('utf8');
const REPL=Buffer.from('ICAgIGF3YWl0IFNlY3VyZVN0b3JlLnNldEl0ZW1Bc3luYyhTVE9SRV9LRVlTLk1BU1RFUl9TRUVELCBieXRlc1RvSGV4KHdhbGxldC5zZWVkKSwgewogICAgICBrZXljaGFpbkFjY2Vzc2libGU6IFNlY3VyZVN0b3JlLldIRU5fUEFTU0NPREVfU0VUX1RISVNfREVWSUNFX09OTFksCiAgICB9KTsKICAgIGF3YWl0IFNlY3VyZVN0b3JlLnNldEl0ZW1Bc3luYygna3ZfbW5lbW9uaWMnLCB3YWxsZXQubW5lbW9uaWMsIHsKICAgICAga2V5Y2hhaW5BY2Nlc3NpYmxlOiBTZWN1cmVTdG9yZS5XSEVOX1BBU1NDT0RFX1NFVF9USElTX0RFVklDRV9PTkxZLAogICAgfSk7CiAgICBhd2FpdCBTZWN1cmVTdG9yZS5zZXRJdGVtQXN5bmMoU1RPUkVfS0VZUy5SRUdJU1RSQVRJT05fU1RBVFVTLCAnd2FsbGV0X2NyZWF0ZWQnKTsK','base64').toString('utf8');
let s=fs.readFileSync(FILE,'utf8');
const eol=s.includes('\r\n')?'\r\n':'\n';
if(/setItemAsync\('kv_mnemonic', wallet\.mnemonic/.test(s)){console.log('[skip] kv_mnemonic write already present.');process.exit(0);}
const esc=t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\r?\n/g,'\r?\n');
const re=new RegExp(esc(FIND),'g');
const count=(s.match(re)||[]).length;
if(count!==1){console.error('[ABORT] anchor found '+count+' times (expected 1). No writes.');process.exit(1);}
s=s.replace(new RegExp(esc(FIND)),REPL.replace(/\r?\n/g,eol));
if((s.match(/setItemAsync\('kv_mnemonic', wallet\.mnemonic/g)||[]).length!==1){console.error('[ABORT] post-condition failed.');process.exit(1);}
fs.writeFileSync(FILE,s);
console.log('[ok] kv_mnemonic write inserted into createWallet. eol='+JSON.stringify(eol));
