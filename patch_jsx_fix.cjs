const fs = require('fs');
let c = fs.readFileSync('ProfileScreen.tsx', 'utf8');

// Wrap the serialHashed true branch in a fragment
c = c.replace(
  "{serialHashed ? (\n              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>",
  "{serialHashed ? (\n              <>\n              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>"
);

// Close the fragment after the attest button
c = c.replace(
  "              )}\n            ) : (",
  "              )}\n              </>\n            ) : ("
);

console.log('Fixed JSX fragment');
fs.writeFileSync('ProfileScreen.tsx', c);
