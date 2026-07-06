const fs=require('fs');let s=fs.readFileSync('Dashboard.tsx','utf8');
s=s.replace(/\s*<TouchableOpacity style=\{walletStyles\.actionBtn\} onPress=\{\(\) => onNavigatePOBox\?\.\(\)\}>[\s\S]*?<Text style=\{walletStyles\.actionLabel\}>P\.O\. Box<\/Text>\s*<\/TouchableOpacity>/,'');
fs.writeFileSync('Dashboard.tsx',s);console.log('removed');
