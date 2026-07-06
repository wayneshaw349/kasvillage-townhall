const fs=require('fs');let s=fs.readFileSync('Dashboard.tsx','utf8');
s=s.replace(/onNavigatePhoneProof\?: \(\) => void;\r?\n/,(m)=>m+'  onNavigateBalanceSheet?: () => void;\n');
s=s.replace(/onNavigatePhoneProof,\r?\n/,(m)=>m+'  onNavigateBalanceSheet,\n');
s=s.replace("onNavigatePhoneProof={onNavigatePhoneProof}","onNavigatePhoneProof={onNavigatePhoneProof}\n              onNavigateBalanceSheet={onNavigateBalanceSheet}");
fs.writeFileSync('Dashboard.tsx',s);console.log('done');
