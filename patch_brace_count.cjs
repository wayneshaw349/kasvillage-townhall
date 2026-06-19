const fs = require('fs');
let c = fs.readFileSync('townhallscreen.tsx', 'utf8');
// Find and fix the extra brace
const marker = "setSearchResult({ found: false, error: 'No verification proof on Arweave for APT-' + aptNum });";
const idx = c.indexOf(marker);
if (idx > -1) {
  // Get everything from marker to "} catch"
  const catchIdx = c.indexOf('} catch', idx);
  const between = c.substring(idx + marker.length, catchIdx);
  const braceCount = (between.match(/\}/g) || []).length;
  console.log('Braces between setSearchResult and catch:', braceCount, JSON.stringify(between.trim()));
  // Should be exactly 2 braces: close if/else, close else-block
  // If 3, remove one
  if (braceCount === 3) {
    const fixed = between.replace(/\}\s*\}\s*\}/, '}\n      }');
    c = c.substring(0, idx + marker.length) + fixed + c.substring(catchIdx);
    fs.writeFileSync('townhallscreen.tsx', c);
    console.log('Fixed: removed extra brace');
  } else {
    console.log('Brace count is', braceCount, '- may be OK');
  }
}
