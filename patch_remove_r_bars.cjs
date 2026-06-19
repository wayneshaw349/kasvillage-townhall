const fs = require('fs');
let c = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

// Remove the old "Seller Release Bar" block (steps 4/5, role=seller)
// It starts with: {(step === 4 || step === 5) && role === 'seller' && (
// and ends with its closing )}
const barStart = c.indexOf("{(step === 4 || step === 5) && role === 'seller' && (");
if (barStart > -1) {
  // Find the matching closing — it's a JSX block ending with </View>\n            )}
  // Count braces to find the end
  let depth = 0;
  let i = barStart;
  let found = false;
  while (i < c.length) {
    if (c[i] === '{') depth++;
    if (c[i] === '}') { depth--; if (depth === 0) { i++; break; } }
    i++;
  }
  // i is now past the closing }
  // But JSX wraps it in {(...)} so we need to go one more )
  while (i < c.length && (c[i] === '\n' || c[i] === ' ')) i++;
  const removed = c.substring(barStart, i);
  const lineCount = removed.split('\n').length;
  c = c.substring(0, barStart) + '{ /* Old R input bars removed — canonical template flow handles R internally */ }' + c.substring(i);
  console.log('Removed seller release bar:', lineCount, 'lines');
} else {
  console.log('Seller release bar not found');
}

// Also remove the "Paste Release Key" section in join inbox
const releaseKeyStart = c.indexOf("<View style={{ backgroundColor: '#f0fdf4', borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#86efac' }}>");
if (releaseKeyStart > -1) {
  // Check it's the release key one (has "Paste Release Key" text)
  const releaseKeyCheck = c.indexOf('Paste Release Key', releaseKeyStart);
  if (releaseKeyCheck > -1 && releaseKeyCheck - releaseKeyStart < 200) {
    // Find closing </View>
    let depth2 = 0;
    let j = releaseKeyStart;
    while (j < c.length) {
      if (c.substring(j, j + 6) === '<View ') depth2++;
      if (c.substring(j, j + 7) === '</View>') { depth2--; if (depth2 === 0) { j += 7; break; } }
      j++;
    }
    const removed2 = c.substring(releaseKeyStart, j);
    c = c.substring(0, releaseKeyStart) + '{ /* Old release key input removed */ }' + c.substring(j);
    console.log('Removed paste release key section:', removed2.split('\n').length, 'lines');
  }
}

fs.writeFileSync('NeighborAgreement.tsx', c);
