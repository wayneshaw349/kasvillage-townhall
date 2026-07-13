const fs=require('fs');let s=fs.readFileSync('QRPayNearby.tsx','utf8');
s=s.replace("setMode('send');","setMode('send_proposal');");
fs.writeFileSync('QRPayNearby.tsx',s);console.log('done');
