const fs = require('fs');
let c = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

// Remove the "Paste Release Key" block
const startMarker = "                <View style={{ backgroundColor: '#f0fdf4', borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#86efac' }}>\n                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#166534', marginBottom: 6 }}>?? Paste Release Key</Text>";
const idx = c.indexOf(startMarker);
if (idx > -1) {
  // Find the closing </View> for this block - count View nesting
  let depth = 0;
  let i = idx;
  let foundStart = false;
  while (i < c.length) {
    if (c.substring(i, i + 6) === '<View ') { depth++; foundStart = true; }
    if (c.substring(i, i + 7) === '</View>') {
      depth--;
      if (foundStart && depth === 0) {
        const end = i + 7;
        // Also remove trailing whitespace/newlines
        let endClean = end;
        while (endClean < c.length && (c[endClean] === '\n' || c[endClean] === '\r' || c[endClean] === ' ')) endClean++;
        c = c.substring(0, idx) + c.substring(endClean);
        console.log('Removed Paste Release Key block (' + (endClean - idx) + ' chars)');
        break;
      }
    }
    i++;
  }
} else { console.log('SKIP - block not found'); }

fs.writeFileSync('NeighborAgreement.tsx', c);
console.log('Done');
