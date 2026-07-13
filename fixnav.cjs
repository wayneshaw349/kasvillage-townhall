const fs=require('fs');let a=fs.readFileSync('AppNaviagator.tsx','utf8');
a=a.replace("const utxoResp = await fetch(balUrl.replace('/balance', '/utxos'));","const utxoResp = await fetch(`${apiBase}/addresses/${kaspaAddr}/utxos`);");
a=a.replace("onUtxoRefresh(utxos, 'testnet', async (data, tags) => {","onUtxoRefresh(utxos, 'testnet', async (data: any, tags: any) => {");
fs.writeFileSync('AppNaviagator.tsx',a);console.log('done');
