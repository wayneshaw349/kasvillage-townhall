const fs=require('fs');const F='push_notifications.ts';let s=fs.readFileSync(F,'utf8');
if(s.includes('kv_push_token_hash')){console.log('already patched');process.exit(0);}
fs.writeFileSync(F+'.bak_dedup',s);
const A="    if (!token) {\n      console.warn('[Push] No token to inscribe');\n      return null;\n    }";
const Acr=A.replace(/\n/g,'\r\n');
const B="    if (!token) {\n      console.warn('[Push] No token to inscribe');\n      return null;\n    }\n\n    // DEDUP: only inscribe when the token actually changed\n    {\n      const { sha256: _h } = await import('@noble/hashes/sha256');\n      const th = Array.from(_h(new TextEncoder().encode(token))).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);\n      const prev = await SecureStore.getItemAsync('kv_push_token_hash');\n      const prevTx = await SecureStore.getItemAsync('kv_push_arweave_tx');\n      if (prev === th && prevTx) {\n        console.log('[Push] Token unchanged - skipping inscribe (tx:', prevTx.slice(0, 12) + ')');\n        return { txId: prevTx };\n      }\n      await SecureStore.setItemAsync('kv_push_token_hash', th);\n    }";
const Bcr=B.replace(/\n/g,'\r\n');
if(s.includes(A)) s=s.replace(A,B);
else if(s.includes(Acr)) s=s.replace(Acr,Bcr);
else {console.error('anchor abort');process.exit(1);}
fs.writeFileSync(F,s);console.log('patched ok');
