const fs = require('fs');
let c = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

// 1. Add a useRef for collateral mode (synchronous)
const stateDecl = "const [resumeAsCollateral, setResumeAsCollateral] = useState(false);";
if (c.includes(stateDecl) && !c.includes('collateralRef')) {
  c = c.replace(stateDecl, stateDecl + "\n  const collateralRef = React.useRef(false);");
  console.log('1. Added collateralRef');
}

// 2. Update the existing handlers to read from ref instead of state
c = c.replace(
  /setAgreementType\(resumeAsCollateral \? 'simple' : 'trade'\);\n\s*if \(resumeAsCollateral\) setReleaseMode\('cancel'\);/g,
  "setAgreementType(collateralRef.current ? 'simple' : 'trade');\n                          if (collateralRef.current) { setReleaseMode('cancel'); console.log('[Resume] Collateral mode: cancel (2 outputs)'); }\n                          collateralRef.current = false;"
);
console.log('2. Handlers read from ref');

// 3. Wire Party A to set ref + simulate buyer click
c = c.replace(
  "onPress={() => setResumeAsCollateral(true)}\n                    >\n                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>Party A (Collateral)</Text>",
  "onPress={() => { collateralRef.current = true; setResumeAsCollateral(true); }}\n                    >\n                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>Party A (Collateral)</Text>"
);
console.log('3. Party A sets ref');

// 4. Wire Party B  
c = c.replace(
  "onPress={() => setResumeAsCollateral(true)}\n                    >\n                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>Party B (Collateral)</Text>",
  "onPress={() => { collateralRef.current = true; setResumeAsCollateral(true); }}\n                    >\n                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>Party B (Collateral)</Text>"
);
console.log('4. Party B sets ref');

fs.writeFileSync('NeighborAgreement.tsx', c);
console.log('Done');
