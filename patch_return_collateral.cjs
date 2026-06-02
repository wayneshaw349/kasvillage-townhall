const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');

if (s.includes('Return Collateral')) { console.log('Already patched'); process.exit(0); }

const anchor = 'Start Signing Ceremony';
const a = s.indexOf(anchor);
if (a < 0) { console.log('Anchor not found'); process.exit(1); }

const p = s.lastIndexOf('<TouchableOpacity', a);
const e = s.indexOf('</TouchableOpacity>', a) + '</TouchableOpacity>'.length;
const orig = s.slice(p, e);

const fix = `{agreementType === 'collateral' ? (
                        <TouchableOpacity
                          onPress={() => { setReleaseMode('cancel'); setTemplateBuilt(false); setStep(5); }}
                          style={{ backgroundColor: '#7c3aed', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 }}>
                          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>🔓 Return Collateral</Text>
                          <Text style={{ color: '#e9d5ff', fontSize: 11, marginTop: 4 }}>Both parties sign to release locked funds back</Text>
                        </TouchableOpacity>
                      ) : (
                        ${orig}
                      )}`;

s = s.slice(0, p) + fix + s.slice(e);
fs.writeFileSync(f, s);
console.log('Return Collateral button added');
console.log('Verify:', s.includes('Return Collateral'));
