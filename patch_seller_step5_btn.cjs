const fs = require('fs');
let f = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

// Add a "Go to Signing Ceremony" button for seller at step 4
// Find the seller's waiting box
const marker = "Waiting for buyer to confirm & release...";
const idx = f.indexOf(marker);
if (idx < 0) { console.log('Marker not found'); process.exit(1); }

// Find the closing </View> of the waitingBox
const afterMarker = f.indexOf("</View>", idx);
const afterWaitingBox = f.indexOf("</View>", afterMarker + 7);

// Insert button after the waiting box
const insertPoint = afterWaitingBox + "</View>".length;
const sellerStep5Btn = `
                    <TouchableOpacity
                      onPress={() => setStep(5)}
                      style={{ backgroundColor: '#4f46e5', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12 }}
                    >
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>Go to Signing Ceremony (Step 5)</Text>
                    </TouchableOpacity>`;

f = f.substring(0, insertPoint) + sellerStep5Btn + f.substring(insertPoint);

fs.writeFileSync('NeighborAgreement.tsx', f);
console.log('Added seller step 5 button');
