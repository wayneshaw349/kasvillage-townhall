const fs=require('fs');let s=fs.readFileSync('AppNaviagator.tsx','utf8');
s=s.replace("import { PhoneProofScreen }","import IOUBalanceSheetModal from './IOUBalanceSheetShare';\nimport { PhoneProofScreen }");
s=s.replace("| 'phone_proof'","| 'phone_proof'\n  | 'balance_sheet'");
s=s.replace("case 'phone_proof':","case 'balance_sheet':\n      return <IOUBalanceSheetModal visible={true} onClose={() => setScreen('dashboard')} />;\n\n    case 'phone_proof':");
s=s.replace("onNavigatePhoneProof={() => setScreen('phone_proof')}","onNavigatePhoneProof={() => setScreen('phone_proof')}\n          onNavigateBalanceSheet={() => setScreen('balance_sheet')}");
fs.writeFileSync('AppNaviagator.tsx',s);console.log('done');
