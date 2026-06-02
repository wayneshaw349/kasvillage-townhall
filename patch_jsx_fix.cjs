const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');

// Fix 1: Remove stray )}</> from header
s = s.replace(
  `</TouchableOpacity>\n                      )}</>`,
  `</TouchableOpacity>`
);

// Fix 2: Remove the misplaced conditional from VerificationCodeDisplay
// It was inserted between the checklist and the confirm button
s = s.replace(
  `<>{agreementType === 'collateral' ? (\n                        <TouchableOpacity\n                          onPress={() => { setReleaseMode('cancel'); setTemplateBuilt(false); setStep(5); }}\n                          style={{ backgroundColor: '#7c3aed', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 }}>\n                          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>🔓 Return Collateral</Text>\n                          <Text style={{ color: '#e9d5ff', fontSize: 11, marginTop: 4 }}>Both parties sign to release locked funds back</Text>\n                        </TouchableOpacity>\n                      ) : (\n                        <TouchableOpacity style={verifyStyles.confirmBtn} onPress={onConfirmed}>\n      <Text style={verifyStyles.confirmBtnText}>✓ Codes Match - Continue</Text>\n    </TouchableOpacity>`,
  `<TouchableOpacity style={verifyStyles.confirmBtn} onPress={onConfirmed}>\n      <Text style={verifyStyles.confirmBtnText}>✓ Codes Match - Continue</Text>\n    </TouchableOpacity>`
);

// Fix 3: Now add Return Collateral at step 4 correctly
// Find handleConfirmDelivery call and wrap it
const confirmAnchor = `onPress={handleConfirmDelivery}`;
if (s.includes(confirmAnchor) && !s.includes('Return Collateral')) {
  const btnStart = s.lastIndexOf('<TouchableOpacity', s.indexOf(confirmAnchor));
  const btnEnd = s.indexOf('</TouchableOpacity>', s.indexOf(confirmAnchor)) + '</TouchableOpacity>'.length;
  const origBtn = s.slice(btnStart, btnEnd);
  
  const wrapped = `{agreementType === 'collateral' ? (
                        <TouchableOpacity
                          onPress={() => { setReleaseMode('cancel'); setTemplateBuilt(false); setStep(5); }}
                          style={{ backgroundColor: '#7c3aed', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 }}>
                          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>🔓 Return Collateral</Text>
                          <Text style={{ color: '#e9d5ff', fontSize: 11, marginTop: 4 }}>Both parties sign to release locked funds back</Text>
                        </TouchableOpacity>
                      ) : (
                        ${origBtn}
                      )}`;
  
  s = s.slice(0, btnStart) + wrapped + s.slice(btnEnd);
}

fs.writeFileSync(f, s);
console.log('Fix 1 - stray fragment:', !s.includes(')}</>'));
console.log('Fix 2 - misplaced conditional:', !s.includes("agreementType === 'collateral'") || s.indexOf("agreementType === 'collateral'") > s.indexOf('handleConfirmDelivery'));
console.log('Fix 3 - Return Collateral at step 4:', s.includes('Return Collateral'));
