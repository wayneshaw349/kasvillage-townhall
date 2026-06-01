const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');

// 1. Add state variable after sellerResponseB64
const stateAnchor = "const [sellerResponseB64, setSellerResponseB64] = useState('');";
if (!s.includes(stateAnchor)) { console.log('State anchor not found'); process.exit(1); }
if (s.includes('templateBuilt')) { console.log('Already patched'); process.exit(0); }
s = s.replace(stateAnchor, stateAnchor + "\n  const [templateBuilt, setTemplateBuilt] = useState(false);");

// 2. Set templateBuilt=true after successful build
const buildAnchor = "console.log('[Ceremony] Template built:', result.templateB64.length, 'chars');";
if (!s.includes(buildAnchor)) { console.log('Build anchor not found'); process.exit(1); }
s = s.replace(buildAnchor, buildAnchor + "\n      setTemplateBuilt(true);");

// 3. Gray out the Build button when templateBuilt
const btnAnchor = "<TouchableOpacity onPress={buildReleaseTemplate} style={{ backgroundColor: '#059669'";
if (!s.includes(btnAnchor)) { console.log('Button anchor not found'); process.exit(1); }
s = s.replace(btnAnchor, "<TouchableOpacity onPress={buildReleaseTemplate} disabled={templateBuilt} style={{ backgroundColor: templateBuilt ? '#9ca3af' : '#059669'");

// 4. Change button text when built
const btnTextAnchor = "{'Build TX Template (generates k + R)'}";
if (!s.includes(btnTextAnchor)) { console.log('Button text anchor not found'); process.exit(1); }
s = s.replace(btnTextAnchor, "{templateBuilt ? 'Template Built ✓ (paste response below)' : 'Build TX Template (generates k + R)'}");

fs.writeFileSync(f, s);
console.log('Done: Build button grays out after first tap');
console.log('Verify state:', s.includes('templateBuilt'));
console.log('Verify disabled:', s.includes('disabled={templateBuilt}'));
console.log('Verify text:', s.includes('Template Built'));
