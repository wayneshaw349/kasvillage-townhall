const fs=require('fs');
let s=fs.readFileSync('AppNaviagator.tsx','utf8');

// Add import
if(!s.includes('QRPayNearby')){
  s=s.replace(
    "import { ProfileScreen } from './ProfileScreen';",
    "import { ProfileScreen } from './ProfileScreen';\nimport { QRPayNearby } from './QRPayNearby';"
  );
}

// Replace the whole pay_nearby case block
const old = `case 'pay_nearby':
      return <PayNearbyScreen
        userAddress={kaspaAddress}
        userName={user.apartment}
        onBack={() => setScreen('dashboard')}
      />;`;

const rep = `case 'pay_nearby':
      return <QRPayNearby onClose={() => setScreen('dashboard')} />;`;

if(s.includes('PayNearbyScreen')){
  s=s.replace(old, rep);
  console.log('replaced case');
} else {
  console.log('PayNearbyScreen not found');
}

fs.writeFileSync('AppNaviagator.tsx',s,'utf8');
console.log('done');
