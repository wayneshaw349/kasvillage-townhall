const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');

if (s.includes('agreementType')) { console.log('Already patched'); process.exit(0); }

// 1. Add agreementType state after releaseMode state
const relModeAnchor = "const [releaseMode, setReleaseMode] = useState<ReleaseMode>('release');";
if (!s.includes(relModeAnchor)) { console.log('releaseMode state not found'); process.exit(1); }
s = s.replace(relModeAnchor, relModeAnchor + "\n  const [agreementType, setAgreementType] = useState<'trade' | 'collateral'>('trade');");

// 2. Add collateral toggle in proposal form (step 1)
// Find the description input field area
const descAnchor = 'placeholder="What are you trading?"';
if (!s.includes(descAnchor)) { 
  console.log('Description placeholder not found, trying alt');
  // Try alternate
  const altAnchor = 'placeholder="Describe the agreement"';
  if (!s.includes(altAnchor)) { console.log('No description field found'); }
}

// Add agreement type toggle before the propose button
const proposeBtn = "onPress={handlePropose}";
if (!s.includes(proposeBtn)) { console.log('Propose button not found'); process.exit(1); }

const toggleUI = `{/* Agreement Type Toggle */}
                      <View style={{ flexDirection: 'row', marginBottom: 12, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' }}>
                        <TouchableOpacity
                          onPress={() => setAgreementType('trade')}
                          style={{ flex: 1, paddingVertical: 10, backgroundColor: agreementType === 'trade' ? '#1e40af' : '#f3f4f6', alignItems: 'center' }}>
                          <Text style={{ color: agreementType === 'trade' ? '#fff' : '#374151', fontWeight: '600', fontSize: 13 }}>🤝 Trade Agreement</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setAgreementType('collateral')}
                          style={{ flex: 1, paddingVertical: 10, backgroundColor: agreementType === 'collateral' ? '#7c3aed' : '#f3f4f6', alignItems: 'center' }}>
                          <Text style={{ color: agreementType === 'collateral' ? '#fff' : '#374151', fontWeight: '600', fontSize: 13 }}>🔒 Collateral Agreement</Text>
                        </TouchableOpacity>
                      </View>
                      `;

// Insert toggle before the propose button's parent
const proposeBtnParent = "<TouchableOpacity onPress={handlePropose}";
s = s.replace(proposeBtnParent, toggleUI + proposeBtnParent);

// 3. At step 4, add "Return Collateral" button for collateral agreements
// Find the "Confirm & Release" or delivery confirmation button area
const step4Anchor = "Confirm Delivery";
if (s.includes(step4Anchor)) {
  // Wrap existing confirm button with agreement type check
  const confirmBtn = s.indexOf(step4Anchor);
  // Add collateral-specific button before the trade confirm button
  const step4Block = `{agreementType === 'collateral' ? (
                        <TouchableOpacity
                          onPress={() => { setReleaseMode('cancel'); setTemplateBuilt(false); setStep(5); }}
                          style={{ backgroundColor: '#7c3aed', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 }}>
                          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>🔓 Return Collateral</Text>
                          <Text style={{ color: '#e9d5ff', fontSize: 11, marginTop: 4 }}>Both parties sign to release locked funds back</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity onPress={() => { setReleaseMode('release'); setTemplateBuilt(false); setStep(5); }}
                          style={{ backgroundColor: '#16a34a', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 }}>
                          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>`;
  
  // Find the TouchableOpacity wrapping "Confirm Delivery" or similar
  // Replace the step 4 action area
  const step5NavAnchor = "setStep(5)";
  const firstStep5 = s.indexOf(step5NavAnchor);
  if (firstStep5 > 0) {
    // Find the parent TouchableOpacity
    const parentStart = s.lastIndexOf('<TouchableOpacity', firstStep5);
    if (parentStart > 0) {
      // Find the closing of this TouchableOpacity block (next </TouchableOpacity>)
      const parentEnd = s.indexOf('</TouchableOpacity>', firstStep5) + '</TouchableOpacity>'.length;
      const originalBtn = s.slice(parentStart, parentEnd);
      
      const newBtns = `{agreementType === 'collateral' ? (
                        <TouchableOpacity
                          onPress={() => { setReleaseMode('cancel'); setTemplateBuilt(false); setStep(5); }}
                          style={{ backgroundColor: '#7c3aed', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 }}>
                          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>🔓 Return Collateral</Text>
                          <Text style={{ color: '#e9d5ff', fontSize: 11, marginTop: 4 }}>Both parties sign to release locked funds back</Text>
                        </TouchableOpacity>
                      ) : (
                        ${originalBtn}
                      )}`;
      
      s = s.slice(0, parentStart) + newBtns + s.slice(parentEnd);
    }
  }
}

// 4. Update step 5 mode banner for collateral
const modeBannerAnchor = "Release — payment transfers to seller";
if (s.includes(modeBannerAnchor)) {
  s = s.replace(modeBannerAnchor, 
    "Release — payment transfers to seller' : agreementType === 'collateral' ? '🔓 Return — collateral returns to each party");
  // Actually this is getting complex with the ternary, let me just leave the existing banner
  // which already shows cancel vs release mode
  s = s.replace(
    "Release — payment transfers to seller' : agreementType === 'collateral' ? '🔓 Return — collateral returns to each party",
    "Release — payment transfers to seller"
  );
}

// 5. Reset agreementType on Reset
s = s.replace("setReleaseMode('release');", "setReleaseMode('release'); setAgreementType('trade');");

fs.writeFileSync(f, s);
console.log('Done: Collateral agreement mode added');
console.log('Verify agreementType:', s.includes('agreementType'));
console.log('Verify toggle UI:', s.includes('Collateral Agreement'));
console.log('Verify return collateral:', s.includes('Return Collateral'));
