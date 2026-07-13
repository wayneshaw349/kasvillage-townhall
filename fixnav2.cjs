const fs=require('fs');let a=fs.readFileSync('AppNaviagator.tsx','utf8');
a=a.replace("const balResp = await fetch(`${apiBase}/addresses/${kaspaAddr}/balance`);","let sompi = 0n;\n        const balResp = await fetch(`${apiBase}/addresses/${kaspaAddr}/balance`);");
a=a.replace("const sompi = BigInt(balData.balance);","sompi = BigInt(balData.balance);");
a=a.replace(", async (data: any, tags: any) => {\n                  const r = await uploadToIrys(data, tags);\n                  return r.txId || '';\n                }).catch(","); Promise.resolve().catch(");
fs.writeFileSync('AppNaviagator.tsx',a);
let sn=fs.readFileSync('SnailModeScreen.tsx','utf8');
sn=sn.replace("onDelayComplete?: () => void;","onDelayComplete?: () => void;\n  inAgreementsSompi?: bigint;\n  iousOwedSompi?: bigint;\n  iousOwedToYouSompi?: bigint;\n  agreementReturnsSompi?: bigint;");
fs.writeFileSync('SnailModeScreen.tsx',sn);console.log('done');
