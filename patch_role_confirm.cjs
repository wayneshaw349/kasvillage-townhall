const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');

// Find the Active Agreements onPress handler
const anchor = "Alert.alert('Switch Agreement'";
const idx = s.indexOf(anchor);
if (idx < 0) { console.log('Anchor not found'); process.exit(1); }

if (s.includes('Confirm Role')) { console.log('Already patched'); process.exit(0); }

// Find the full Alert.alert call and replace with role confirmation
const old = "Alert.alert('Switch Agreement', 'Load ' + entry.agrId.slice(0,12) + '?\\nThis will switch your active session.'";
const replacement = "Alert.alert('Confirm Role', 'Agreement: ' + entry.agrId.slice(0,12) + '\\nRole: ' + (entry.role === 'buyer' ? '🛒 BUYER' : '🏪 SELLER') + '\\nFROST: ' + (entry.frostAddr || '').slice(0,25) + '...' + '\\nBalance: ' + entry.buyerAmount + ' + ' + entry.sellerAmount + ' KAS' + '\\nStep: ' + entry.step";

s = s.replace(old, replacement);
fs.writeFileSync(f, s);
console.log('Added role confirmation to Active Agreements');
console.log('Verify:', s.includes('Confirm Role'));
