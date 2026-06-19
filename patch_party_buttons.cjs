const fs = require('fs');
let c = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

// 1. Remove the collateral toggle and add Party A / Party B buttons in a second row
const oldToggle = "                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>\n" +
"                    <TouchableOpacity\n" +
"                      style={{ flex: 1, padding: 8, borderRadius: 8, borderWidth: 2, borderColor: resumeAsCollateral ? '#059669' : '#d1d5db', backgroundColor: resumeAsCollateral ? '#ecfdf5' : '#fff', alignItems: 'center' }}\n" +
"                      onPress={() => setResumeAsCollateral(!resumeAsCollateral)}\n" +
"                    >\n" +
"                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: resumeAsCollateral ? '#059669' : '#888' }}>{resumeAsCollateral ? '\\u2705 Collateral Mode' : 'Collateral?'}</Text>\n" +
"                    </TouchableOpacity>\n" +
"                  </View>";

if (c.includes(oldToggle)) {
  c = c.replace(oldToggle, '');
  console.log('1. Removed toggle');
} else { console.log('1. SKIP - toggle not found'); }

// 2. After the seller button closing tag, add Party A and Party B buttons
// Find "Load as Seller" text to locate the seller button
const sellerLabel = "Load as Seller'}</Text>}";
const sellerBtnEnd = c.indexOf(sellerLabel);
if (sellerBtnEnd > -1) {
  // Find the </TouchableOpacity> after seller label
  const afterSeller = c.indexOf('</TouchableOpacity>', sellerBtnEnd);
  if (afterSeller > -1) {
    const endOfSellerBtn = afterSeller + '</TouchableOpacity>'.length;
    // Find the closing </View> of the button row
    const closingView = c.indexOf('</View>', endOfSellerBtn);
    if (closingView > -1) {
      const insertPoint = closingView + '</View>'.length;
      const partyButtons = "\n                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>\n" +
"                    <TouchableOpacity\n" +
"                      style={{ flex: 1, backgroundColor: '#059669', borderRadius: 8, padding: 12, alignItems: 'center' }}\n" +
"                      disabled={!manualAgrId || manualAgrId.length < 6}\n" +
"                      onPress={() => { setResumeAsCollateral(true); /* trigger buyer handler with collateral */ }}\n" +
"                    >\n" +
"                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>Party A (Collateral)</Text>\n" +
"                    </TouchableOpacity>\n" +
"                    <TouchableOpacity\n" +
"                      style={{ flex: 1, backgroundColor: '#059669', borderRadius: 8, padding: 12, alignItems: 'center' }}\n" +
"                      disabled={!manualAgrId || manualAgrId.length < 6}\n" +
"                      onPress={() => { setResumeAsCollateral(true); /* trigger seller handler with collateral */ }}\n" +
"                    >\n" +
"                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>Party B (Collateral)</Text>\n" +
"                    </TouchableOpacity>\n" +
"                  </View>";
      c = c.substring(0, insertPoint) + partyButtons + c.substring(insertPoint);
      console.log('2. Added Party A/B buttons');
    }
  }
} else { console.log('2. SKIP'); }

fs.writeFileSync('NeighborAgreement.tsx', c);
console.log('Done');
