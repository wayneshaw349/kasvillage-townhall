const fs=require('fs');

// Dashboard - remove P.O. Box button
let d=fs.readFileSync('Dashboard.tsx','utf8');
d=d.replace(/.*onNavigatePOBox.*\n/g,'');
d=d.replace(/.*P\.O\. Box.*\n/g,'');
fs.writeFileSync('Dashboard.tsx',d);

// AppNavigator - remove POBox route
let a=fs.readFileSync('AppNaviagator.tsx','utf8');
a=a.replace(/import \{ POBoxScreen \} from '\.\/POBoxScreen';\n/,'');
a=a.replace(/.*'po_box'.*\n/g,'');
a=a.replace(/.*POBoxScreen.*\n/g,'');
a=a.replace(/.*onNavigatePOBox.*\n/g,'');
fs.writeFileSync('AppNaviagator.tsx',a);

// ReceiveScreen - remove stealth tab
let r=fs.readFileSync('ReceiveScreen.tsx','utf8');
r=r.replace(/import\s*\{[\s\S]*?\}\s*from\s*'\.\/stealth_watcher';\n?/g,'');
r=r.replace(/.*[Ss]tealth(?!y).*\n/g,'');
r=r.replace(/.*AddressMode.*\n/g,'');
r=r.replace(/.*stealthAddress.*\n/gi,'');
r=r.replace(/.*stealthPayments.*\n/gi,'');
r=r.replace(/.*stealthMeta.*\n/gi,'');
r=r.replace(/.*modeBtnActiveStealth.*\n/g,'');
r=r.replace("type AddressMode = 'standard' | 'stealth';", '');
r=r.replace("const [mode, setMode] = useState<AddressMode>('standard');", '');
fs.writeFileSync('ReceiveScreen.tsx',r);

console.log('all PO Box + stealth UI removed');
