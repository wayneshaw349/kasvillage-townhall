const fs = require('fs');
let c = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

// Default releaseMode based on agreementType
// Trade = 'release' (all to seller), Collateral = 'cancel' (each gets own back)
const oldState = "const [releaseMode, setReleaseMode] = useState<'release' | 'cancel'>('release');";
const newState = "const [releaseMode, setReleaseMode] = useState<'release' | 'cancel'>('release');\n\n  // Collateral agreements always use cancel mode (both parties get deposit back)\n  useEffect(() => { if (agreementType === 'simple') setReleaseMode('cancel'); }, [agreementType]);";
if (c.includes(oldState)) {
  c = c.replace(oldState, newState);
  console.log('1. Collateral defaults to cancel mode');
} else { console.log('1. SKIP'); }

fs.writeFileSync('NeighborAgreement.tsx', c);
console.log('Done');
