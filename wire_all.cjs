const fs=require('fs');let s=fs.readFileSync('IOUBalanceSheetShare.tsx','utf8');
s=s.replace("import { uploadToTurbo","import { allocateForIOU, releaseIOU, getUtxoLedger } from './utxo_ledger';\nimport { uploadToTurbo");
fs.writeFileSync('IOUBalanceSheetShare.tsx',s);console.log('1: utxo wired');

let q=fs.readFileSync('QRPayNearby.tsx','utf8');
q=q.replace("// QRPayNearby.tsx","// PayNearby.tsx");
if(!q.includes('IOUBalanceSheetShare'))q=q.replace("import QRCode","import { IOUBalanceSheetShare } from './IOUBalanceSheetShare';\nimport QRCode");
fs.writeFileSync('QRPayNearby.tsx',q);console.log('2: IOU wired into PayNearby');

let r=fs.readFileSync('ReceiveScreen.tsx','utf8');
if(!r.includes('QRCode'))r=r.replace("import { getBalance","import QRCode from 'react-native-qrcode-svg';\nimport { getBalance");
fs.writeFileSync('ReceiveScreen.tsx',r);console.log('3: QR checked in Receive');
