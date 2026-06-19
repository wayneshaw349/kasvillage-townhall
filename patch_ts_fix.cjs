const fs = require('fs');
let c = fs.readFileSync('canonical_agreement_steps.ts', 'utf8');

// 1. Fix redeclare: rename sighash outputs variable in buyerBuildTemplate
// The old code has "const outputs: CanonicalOutput[] = template.o.map"
// which conflicts with "const { outputs } = computeReleaseOutputs"
const oldSighashOutputs = "  const outputs: CanonicalOutput[] = template.o.map((o) => ({\n    value: BigInt(o.v),\n    script: o.s,\n  }));";
const newSighashOutputs = "  const canonOutputs: CanonicalOutput[] = template.o.map((o) => ({\n    value: BigInt(o.v),\n    script: o.s,\n  }));";
if (c.includes(oldSighashOutputs)) {
  c = c.replace(oldSighashOutputs, newSighashOutputs);
  console.log('1a. Renamed outputs -> canonOutputs in buyerBuildTemplate sighash');
} else {
  // Try with different indentation
  const alt = c.indexOf('const outputs: CanonicalOutput[] = template.o.map');
  if (alt > -1) {
    // Find within buyerBuildTemplate (after computeReleaseOutputs)
    const releaseIdx = c.indexOf('computeReleaseOutputs(');
    if (releaseIdx > -1) {
      const nextOutputs = c.indexOf('const outputs: CanonicalOutput[]', releaseIdx);
      if (nextOutputs > -1) {
        c = c.substring(0, nextOutputs) + 'const canonOutputs: CanonicalOutput[]' + c.substring(nextOutputs + 'const outputs: CanonicalOutput[]'.length);
        console.log('1b. Renamed via indexOf');
      }
    }
  } else { console.log('1. SKIP'); }
}

// 2. Fix the sighash loop reference from outputs -> canonOutputs
// Find "computeSighash(inputs, outputs, i)" after the rename point
const afterRelease = c.indexOf('computeReleaseOutputs(');
if (afterRelease > -1) {
  // Find the sighashes loop in buyerBuildTemplate
  const sighashLoop = c.indexOf("sighashes.push(bytesToHex(computeSighash(inputs, outputs, i)));", afterRelease);
  if (sighashLoop > -1) {
    c = c.substring(0, sighashLoop) + "sighashes.push(bytesToHex(computeSighash(inputs, canonOutputs, i)));" + c.substring(sighashLoop + "sighashes.push(bytesToHex(computeSighash(inputs, outputs, i)));".length);
    console.log('2. Fixed sighash call to use canonOutputs');
  } else { console.log('2. SKIP - sighash loop not found'); }
}

fs.writeFileSync('canonical_agreement_steps.ts', c);
console.log('Done');
