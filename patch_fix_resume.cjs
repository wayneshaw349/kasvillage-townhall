const fs = require('fs');
let c = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

// 1. Add resumeAsCollateral state after manualAgrId
const marker = "const [manualAgrId, setManualAgrId] = useState('');";
if (c.includes(marker) && !c.includes('resumeAsCollateral, setResumeAsCollateral')) {
  c = c.replace(marker, marker + "\n  const [resumeAsCollateral, setResumeAsCollateral] = useState(false);");
  console.log('1. Added state');
} else { console.log('1. SKIP'); }

// 2. Revert lines ~1225 and ~2716 (non-resume) back to simple setAgreementType('trade')
// These are in the step 1 agreement type selection, not resume
// Find and revert by looking at context: step 1 selections set agreementType directly
// The resume handlers are at lines 3086+ (inside the Resume Agreement block)
// Lines 1225 and 2716 are in step 1/2 role selection

// Count occurrences
const pattern = "setAgreementType(resumeAsCollateral ? 'simple' : 'trade');\n                          if (resumeAsCollateral) setReleaseMode('cancel');";
let idx = 0;
let count = 0;
const positions = [];
while ((idx = c.indexOf(pattern, idx)) !== -1) {
  positions.push(idx);
  idx += pattern.length;
  count++;
}
console.log('Found', count, 'occurrences at positions:', positions.map(p => {
  const before = c.lastIndexOf('\n', p);
  return c.substring(Math.max(0, p - 30), p + 10).trim().slice(0, 20);
}));

// Revert first two (non-resume, in step 1/2 selection)
if (count >= 4) {
  // Replace first occurrence
  c = c.replace(pattern, "setAgreementType('trade');");
  console.log('2a. Reverted first');
  // Replace second (now first remaining non-resume)
  c = c.replace(pattern, "setAgreementType('trade');");
  console.log('2b. Reverted second');
}

fs.writeFileSync('NeighborAgreement.tsx', c);
console.log('Done');
