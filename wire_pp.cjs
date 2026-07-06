const fs=require('fs');let s=fs.readFileSync('AppNaviagator.tsx','utf8');
s=s.replace("import { ReceiveScreen } from './ReceiveScreen';","import { ReceiveScreen } from './ReceiveScreen';\nimport { PhoneProofScreen } from './PhoneProofScreen';");
s=s.replace("  | 'receive_kas'","  | 'receive_kas'\n  | 'phone_proof'");
s=s.replace(`    case 'receive_kas':
      return (
        <ReceiveScreen
          visible={true}
          onClose={() => setScreen('dashboard')}
          myAddress={kaspaAddress}
        />
      );`,`    case 'receive_kas':
      return (
        <ReceiveScreen
          visible={true}
          onClose={() => setScreen('dashboard')}
          myAddress={kaspaAddress}
        />
      );

    case 'phone_proof':
      return (
        <PhoneProofScreen
          visible={true}
          onClose={() => setScreen('dashboard')}
        />
      );`);
s=s.replace(`        <Dashboard
          user={user}
          balance={balance}
          isSnailMode={snailMode}
          isEliteMode={user.xp >= 10000}
          navigation={navigation}
        />`,`        <Dashboard
          user={user}
          balance={balance}
          isSnailMode={snailMode}
          isEliteMode={user.xp >= 10000}
          navigation={navigation}
          onNavigatePhoneProof={() => setScreen('phone_proof')}
        />`);
fs.writeFileSync('AppNaviagator.tsx',s);console.log('nav wired');
