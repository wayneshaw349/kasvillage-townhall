const fs=require('fs');let a=fs.readFileSync('AppNaviagator.tsx','utf8');
if(a.includes('__kvLastTxId')){console.log('already wired');process.exit(0);}
a=a.replace("onSuccess={(txId: string) => {","onSuccess={(txId: string) => {\n            (globalThis as any).__kvLastTxId = txId;");
fs.writeFileSync('AppNaviagator.tsx',a);console.log('done');
