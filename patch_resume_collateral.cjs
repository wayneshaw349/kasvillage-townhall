const fs = require('fs');
let c = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

// Find the end of the seller button </TouchableOpacity> and add collateral buttons after
const sellerBtnEnd = "setAgreementType('trade');";
const sellerCount = (c.match(/setAgreementType\('trade'\);/g) || []).length;
console.log('Found', sellerCount, 'setAgreementType trade calls');

// Replace both with: check if collateral mode is active
// Instead of adding new buttons (too complex for one patch), 
// add a collateral toggle ABOVE the Load buttons

const resumeHeader = "<Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1e40af', marginBottom: 8 }}>Resume Agreement</Text>";
const newHeader = "<Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1e40af', marginBottom: 8 }}>Resume Agreement</Text>\n" +
"                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>\n" +
"                    <TouchableOpacity\n" +
"                      style={{ flex: 1, padding: 8, borderRadius: 8, borderWidth: 2, borderColor: resumeAsCollateral ? '#059669' : '#d1d5db', backgroundColor: resumeAsCollateral ? '#ecfdf5' : '#fff', alignItems: 'center' }}\n" +
"                      onPress={() => setResumeAsCollateral(!resumeAsCollateral)}\n" +
"                    >\n" +
"                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: resumeAsCollateral ? '#059669' : '#888' }}>{resumeAsCollateral ? '\\u2705 Collateral Mode' : 'Collateral?'}</Text>\n" +
"                    </TouchableOpacity>\n" +
"                  </View>";

if (c.includes(resumeHeader)) {
  c = c.replace(resumeHeader, newHeader);
  console.log('1. Added collateral toggle');
} else { console.log('1. SKIP'); }

// Add state variable for resumeAsCollateral
const stateMarker = "const [manualAgrId, setManualAgrId] = useState('');";
if (c.includes(stateMarker) && !c.includes('resumeAsCollateral')) {
  c = c.replace(stateMarker, stateMarker + "\n  const [resumeAsCollateral, setResumeAsCollateral] = useState(false);");
  console.log('2. Added resumeAsCollateral state');
} else { console.log('2. SKIP'); }

// Change both setAgreementType('trade') to check resumeAsCollateral
c = c.replace(
  /setAgreementType\('trade'\);/g, 
  "setAgreementType(resumeAsCollateral ? 'simple' : 'trade');\n                          if (resumeAsCollateral) setReleaseMode('cancel');"
);
console.log('3. Updated agreementType to check collateral toggle');

// Update button labels to show collateral when active
c = c.replace(
  "Load as Buyer'}</Text>",
  "Load as Buyer'}</Text>"
);

fs.writeFileSync('NeighborAgreement.tsx', c);
console.log('Done');
