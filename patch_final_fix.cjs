const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');

// FIX 1: Remove broken conditional from VerificationCodeDisplay
// Replace the entire broken section with the original clean code
const brokenStart = "    <>{agreementType === 'collateral' ? (";
const brokenEnd = "    </TouchableOpacity>\n    \n    <Text style={verifyStyles.warning}>\n      ⚠️ If codes DON'T match, STOP! Someone may be intercepting.\n    </Text>\n  </View>\n);";

const cleanVerify = `    <TouchableOpacity style={verifyStyles.confirmBtn} onPress={onConfirmed}>
      <Text style={verifyStyles.confirmBtnText}>✓ Codes Match - Continue</Text>
    </TouchableOpacity>
    
    <Text style={verifyStyles.warning}>
      ⚠️ If codes DON't match, STOP! Someone may be intercepting.
    </Text>
  </View>
);`;

const brokenIdx = s.indexOf(brokenStart);
if (brokenIdx >= 0) {
  const endIdx = s.indexOf(brokenEnd, brokenIdx);
  if (endIdx >= 0) {
    s = s.slice(0, brokenIdx) + cleanVerify + s.slice(endIdx + brokenEnd.length);
    console.log('Fix 1: VerificationCodeDisplay restored');
  } else {
    console.log('Fix 1: End pattern not found, trying alternate');
    // Try to find just the opening and replace through to the component end
    const compEnd = s.indexOf('const verifyStyles', brokenIdx);
    if (compEnd > 0) {
      // Find the );\n before verifyStyles
      const closeIdx = s.lastIndexOf(');', compEnd);
      s = s.slice(0, brokenIdx) + cleanVerify + '\n\n' + s.slice(compEnd);
      console.log('Fix 1: Alternate applied');
    }
  }
} else {
  console.log('Fix 1: Broken pattern not found (may already be fixed)');
}

// FIX 2: handleRequestRelease sets cancel then immediately resets to release
s = s.replace(
  "setReleaseMode('cancel');\n          setTemplateBuilt(false); setReleaseMode('release');",
  "setReleaseMode('cancel');\n          setTemplateBuilt(false);"
);
console.log('Fix 2: handleRequestRelease cancel mode preserved');

fs.writeFileSync(f, s);

// Verify
const v = fs.readFileSync(f, 'utf8');
console.log('Verify - no broken conditional in VerifyDisplay:', !v.includes("agreementType === 'collateral'") || v.indexOf("agreementType === 'collateral'") > v.indexOf('const NeighborAgreement'));
console.log('Verify - cancel not overridden:', !v.includes("setReleaseMode('cancel');\n          setTemplateBuilt(false); setReleaseMode('release')"));
console.log('Verify - confirmBtn exists:', v.includes('verifyStyles.confirmBtn'));
