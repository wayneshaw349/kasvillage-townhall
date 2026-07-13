const fs=require('fs');let s=fs.readFileSync('IOUBalanceSheetShare.tsx','utf8');
// 1. remove misplaced loader block
const blk="\n      try {\n        const pj = await SecureStore.getItemAsync('kv_pending_iou');\n        if (pj) {\n          const p = JSON.parse(pj);\n          if (Date.now() - p.created > p.expiresMs) {\n            await releaseIOU(p.iouId);\n            await SecureStore.deleteItemAsync('kv_pending_iou');\n            setPendingIOU(null);\n            console.log('[IOU] pending IOU expired, hold released');\n          } else { setPendingIOU(p); }\n        }\n      } catch {}";
s=s.replace(blk,'');
// 2. fix bare returns
s=s.replace("if (!address) { console.log('[IOU] no address yet'); return; }","if (!address) { console.log('[IOU] no address yet'); return null; }");
s=s.replace("if (!pubkey) { console.log('[IOU] no pubkey in any key'); return; }","if (!pubkey) { console.log('[IOU] no pubkey in any key'); return null; }");
// 3. state + loader inside component
if(!/import React/.test(s)) s="import React from 'react';\n"+s;
s=s.replace("export function IOUBalanceSheetModal(props: Props) {","export function IOUBalanceSheetModal(props: Props) {\n  const [pendingIOU, setPendingIOU] = React.useState<any>(null);\n  React.useEffect(() => { (async () => { try { const pj = await SecureStore.getItemAsync('kv_pending_iou'); if (pj) { const p = JSON.parse(pj); if (Date.now() - p.created > p.expiresMs) { await releaseIOU(p.iouId); await SecureStore.deleteItemAsync('kv_pending_iou'); setPendingIOU(null); } else { setPendingIOU(p); } } } catch {} })(); }, []);");
fs.writeFileSync('IOUBalanceSheetShare.tsx',s);console.log('done');
