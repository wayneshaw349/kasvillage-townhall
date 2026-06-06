// wire_adaptive_apt.cjs
// Run AFTER wire_apt_lookup.cjs
// Upgrades townhallscreen.tsx from static deriveApt to adaptive deriveAptWithCheck
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'townhallscreen.tsx');
let src = fs.readFileSync(file, 'utf8');

// 1. Update import to include deriveAptWithCheck
src = src.replace(
  "import { deriveApt, resolveAptToPubkey, verifyApt } from './apt_derivation';",
  "import { deriveApt, deriveAptWithCheck, resolveAptToPubkey, verifyApt } from './apt_derivation';"
);

// 2. Replace static deriveApt in init with async deriveAptWithCheck
src = src.replace(
  "const derivedApt = deriveApt(pubkey);\n        setMyApt('APT-' + derivedApt);",
  "const { apt: derivedApt } = await deriveAptWithCheck(pubkey);\n        setMyApt('APT-' + derivedApt);"
);

fs.writeFileSync(file, src, 'utf8');
console.log('✅ townhallscreen.tsx: upgraded to deriveAptWithCheck (adaptive)');
