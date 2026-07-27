const fs=require('fs');const F='Dashboard.tsx';let s=fs.readFileSync(F,'utf8');
if(s.includes('DASH-RESYNC')){console.log('already patched');process.exit(0);}
fs.writeFileSync(F+'.bak_resync',s);
const A="      try {\n        const ledgerJson = await AsyncStorage.getItem('kv_utxo_ledger');";
const Acr=A.replace(/\n/g,'\r\n');
const B="      // DASH-RESYNC: heal stale/foreign ledger cache on every dashboard load\n      try {\n        const SecureStoreMod = require('expo-secure-store');\n        const primary = (await SecureStoreMod.getItemAsync('kv_kaspa_address'))\n          || (await SecureStoreMod.getItemAsync('kaspa_address')) || '';\n        if (primary) {\n          const { syncLedger } = require('./utxo_ledger');\n          await syncLedger(primary);\n        }\n      } catch (e) { console.warn('[DashStats] resync skipped:', e); }\n      try {\n        const ledgerJson = await AsyncStorage.getItem('kv_utxo_ledger');";
const Bcr=B.replace(/\n/g,'\r\n');
if(s.includes(A)) s=s.replace(A,B);
else if(s.includes(Acr)) s=s.replace(Acr,Bcr);
else {console.error('anchor abort');process.exit(1);}
fs.writeFileSync(F,s);console.log('patched ok');
