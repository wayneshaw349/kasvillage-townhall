const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');

// The conditional {agreementType === 'collateral' ? ... : ...} 
// needs to be wrapped in <> </> fragment because there's a sibling <Text> after it
const condStart = "{agreementType === 'collateral' ? (";
const condEnd = ")}";

const idx = s.indexOf(condStart);
if (idx < 0) { console.log('Conditional not found'); process.exit(1); }

// Find the closing of the conditional (the final )} after the original TouchableOpacity)
// Search for the pattern: </TouchableOpacity>\n                      )}
const closePattern = "</TouchableOpacity>\n                      )}";
const closeIdx = s.indexOf(closePattern, idx);
if (closeIdx < 0) { console.log('Close pattern not found'); process.exit(1); }
const fullClose = closeIdx + closePattern.length;

// Wrap: <>{...}</>  but we need to include the warning Text too
// Actually simpler: just wrap the conditional in a fragment
s = s.slice(0, idx) + '<>' + s.slice(idx, fullClose) + '</>' + s.slice(fullClose);

fs.writeFileSync(f, s);
console.log('Fragment fix applied');
