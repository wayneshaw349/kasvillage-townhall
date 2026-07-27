const fs=require('fs');const F='NeighborAgreement.tsx';let s=fs.readFileSync(F,'utf8');
if(s.includes('FUND-SENTINEL')){console.log('already patched');process.exit(0);}
fs.writeFileSync(F+'.bak_fundsentinel',s);

const A1="const _arRes = await uploadToIrys(_arBody, [";
const B1="if (await SecureStore.getItemAsync('kv_funded_' + _agrId)) { console.log('[Refund] FUND-SENTINEL - already funded, skipping re-inscribe + re-fund'); setIsLoading(false); return; }\n      const _arRes = await uploadToIrys(_arBody, [";
let c=s.split(A1).length-1;
if(c!==1){console.error('anchor1 count='+c+' - abort');process.exit(1);}
s=s.replace(A1,B1);

const A2="const _br = await broadcastPreparedTx(_p.preparedTx, _p.network);";
const B2="const _sentK = 'kv_funded_' + _agrId;\n      await SecureStore.setItemAsync(_sentK, _p.predictedTxId);\n      let _br: any = await broadcastPreparedTx(_p.preparedTx, _p.network);\n      if (!_br.success && /already in the mempool/i.test(String(_br.error || ''))) { console.log('[Refund] FUND-SENTINEL: already-in-mempool -> success'); _br = { success: true, txId: _p.predictedTxId }; }\n      if (!_br.success) { await SecureStore.deleteItemAsync(_sentK).catch(() => {}); }";
c=s.split(A2).length-1;
if(c!==1){console.error('anchor2 count='+c+' - abort');process.exit(1);}
s=s.replace(A2,B2);

fs.writeFileSync(F,s);console.log('patched ok');
