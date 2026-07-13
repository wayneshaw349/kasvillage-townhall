const fs=require('fs');
let a=fs.readFileSync('AppNaviagator.tsx','utf8');
a=a.replace(/onUtxoRefresh\(utxos, 'testnet',[\s\S]*?\)\.catch\(e => console\.warn\('\[AppNav\] UTXO snapshot failed:', e\)\);/,"onUtxoRefresh(utxos, 'testnet').catch(e => console.warn('[AppNav] UTXO snapshot failed:', e));");
fs.writeFileSync('AppNaviagator.tsx',a);
let p=fs.readFileSync('ProfileScreen.tsx','utf8');
p=p.replace(/React\.FC<\{ navigation\?: any(;[^}]*)?\}>/,"React.FC<{ navigation?: any; onNavigatePhoneProof?: () => void; onNavigateEntertainment?: () => void; onNavigateTownHall?: () => void; onNavigateBookshelf?: () => void }>");
fs.writeFileSync('ProfileScreen.tsx',p);console.log('done');
