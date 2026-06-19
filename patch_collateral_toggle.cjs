const fs = require('fs');
let c = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

// 1. Remove Party A/B buttons entirely
const partyIdx = c.indexOf("Party A (Collateral)</Text>");
if (partyIdx > -1) {
  const viewStart = c.lastIndexOf('<View', partyIdx);
  let depth = 0, i = viewStart;
  while (i < c.length) {
    if (c.substring(i, i + 5) === '<View') depth++;
    if (c.substring(i, i + 7) === '</View>') { depth--; if (depth === 0) { let end = i + 7; while (end < c.length && '\n\r '.includes(c[end])) end++; c = c.substring(0, viewStart) + c.substring(end); console.log('1. Removed Party A/B buttons'); break; } }
    i++;
  }
}

// 2. Add collateral toggle before Load buttons
const loadRow = c.indexOf("flex: 1, backgroundColor: '#059669'", c.indexOf('Paste AGR_ID'));
const viewBefore = c.lastIndexOf('<View', loadRow);
const toggle = "                  <TouchableOpacity onPress={() => { collateralRef.current = !collateralRef.current; setResumeAsCollateral(!resumeAsCollateral); }} style={{ marginBottom: 8, padding: 8, borderRadius: 8, backgroundColor: resumeAsCollateral ? '#ecfdf5' : '#f3f4f6', borderWidth: 2, borderColor: resumeAsCollateral ? '#059669' : '#d1d5db' }}>\n                    <Text style={{ fontSize: 12, textAlign: 'center', fontWeight: 'bold', color: resumeAsCollateral ? '#059669' : '#888' }}>{resumeAsCollateral ? '\\u2705 Collateral Agreement' : 'Tap for Collateral Mode'}</Text>\n                  </TouchableOpacity>\n";
c = c.substring(0, viewBefore) + toggle + c.substring(viewBefore);
console.log('2. Added toggle');

// 3. Update buyer label to show Party A when collateral
c = c.replace(
  "Load as Buyer'}</Text>}",
  "' + (resumeAsCollateral ? 'Party A' : 'Load as Buyer') + '}'}</Text>}"
);
console.log('3. Dynamic buyer label');

// 4. Update seller label to show Party B when collateral
c = c.replace(
  "Load as Seller'}</Text>}",
  "' + (resumeAsCollateral ? 'Party B' : 'Load as Seller') + '}'}</Text>}"
);
console.log('4. Dynamic seller label');

fs.writeFileSync('NeighborAgreement.tsx', c);
console.log('Done');
