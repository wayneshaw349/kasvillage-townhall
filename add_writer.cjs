const fs=require('fs');let s=fs.readFileSync('IOUBalanceSheetShare.tsx','utf8');
s=s.replace("iou.issuerSignature = signIOUSync(iou, creds.privkey);","iou.issuerSignature = signIOUSync(iou, creds.privkey);\n  try { await SecureStore.setItemAsync('kv_pending_iou', JSON.stringify({ iouId, amount: formatKAS(amountSompi), created: Date.now(), expiresMs: 86400000 })); } catch {}");
fs.writeFileSync('IOUBalanceSheetShare.tsx',s);console.log('done');
