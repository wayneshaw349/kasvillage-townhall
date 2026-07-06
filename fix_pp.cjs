const fs=require('fs');let s=fs.readFileSync('Dashboard.tsx','utf8');
s=s.replace("onNavigatePOBox?: () => void;\n  activeMode","onNavigatePOBox?: () => void;\n  onNavigatePhoneProof?: () => void;\n  activeMode");
s=s.replace("onNavigatePOBox,\n  activeMode","onNavigatePOBox,\n  onNavigatePhoneProof,\n  activeMode");
fs.writeFileSync('Dashboard.tsx',s);console.log('done');
