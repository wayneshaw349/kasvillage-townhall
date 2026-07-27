const fs=require('fs');const F='NeighborAgreement.tsx';let s=fs.readFileSync(F,'utf8');
if(s.includes('REUSE-GUARD')){console.log('already patched');process.exit(0);}
fs.writeFileSync(F+'.bak_reuseguard',s);

const A1="console.log('[Neighbor] Seller preparing (freeze, no broadcast)', immediateSendAmount / 1e8, 'KASPA to FROST');";
const B1="{ /* REUSE-GUARD: never rebuild a frozen template - a rebuild invalidates the buyer cosign */\n        const _rgP = await SecureStore.getItemAsync('kv_refund_pending_' + agrId);\n        const _rgB = await SecureStore.getItemAsync('kv_refund_b64_' + agrId);\n        if (_rgP && _rgB) {\n          try { await Clipboard.setStringAsync(_rgB); } catch {}\n          console.log('[Refund] REUSE-GUARD - frozen template exists, re-copied same templates, not re-preparing');\n          Alert.alert('Templates Re-Copied', 'Your existing frozen templates were copied again (unchanged). Send both to the buyer. Nothing was re-built.');\n          setIsLoading(false); setAcceptingId(null); return;\n        }\n      }\n      console.log('[Neighbor] Seller preparing (freeze, no broadcast)', immediateSendAmount / 1e8, 'KASPA to FROST');";
let c=s.split(A1).length-1;
if(c!==1){console.error('anchor1 count='+c+' - abort');process.exit(1);}
s=s.replace(A1,B1);

const A2="try { await Clipboard.setStringAsync(_refund.templateB64 + '|' + _kill.templateB64); } catch {}";
const B2="try { await Clipboard.setStringAsync(_refund.templateB64 + '|' + _kill.templateB64); } catch {}\n      await SecureStore.setItemAsync('kv_refund_b64_' + agrId, _refund.templateB64 + '|' + _kill.templateB64).catch(() => {}); // REUSE-GUARD store";
c=s.split(A2).length-1;
if(c!==1){console.error('anchor2 count='+c+' - abort');process.exit(1);}
s=s.replace(A2,B2);

fs.writeFileSync(F,s);console.log('patched ok');
