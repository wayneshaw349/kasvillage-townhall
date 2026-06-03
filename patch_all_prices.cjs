const fs = require('fs');
const f = 'Workspace.tsx';
const lines = fs.readFileSync(f, 'utf8').split('\n');
let fixes = 0;

for (let i = 0; i < lines.length; i++) {
  const t = lines[i].trim();
  // Fix any broken price ternary that ends with an opening quote
  if (t.includes('dollarPrice > 0') && t.endsWith("? '")) {
    const indent = lines[i].match(/^(\s*)/)[1];
    lines[i] = indent + "{item.kaspaPrice > 0 ? `${item.kaspaPrice} KAS` : item.dollarPrice > 0 ? `$${item.dollarPrice.toFixed(2)}` : 'Price TBD'}";
    fixes++;
    console.log('Fixed broken price at line', i + 1);
  }
  // Also fix the reversed pattern
  if (t.includes('kaspaPrice') && t.includes('dollarPrice') && t.endsWith("? '")) {
    const indent = lines[i].match(/^(\s*)/)[1];
    lines[i] = indent + "{item.kaspaPrice > 0 ? `${item.kaspaPrice} KAS` : item.dollarPrice > 0 ? `$${item.dollarPrice.toFixed(2)}` : 'Price TBD'}";
    fixes++;
    console.log('Fixed broken price at line', i + 1);
  }
}

fs.writeFileSync(f, lines.join('\n'));
console.log('Total fixes:', fixes);

// Verify no broken strings remain
const v = fs.readFileSync(f, 'utf8');
const broken = (v.match(/dollarPrice > 0 \? '\n/g) || []).length;
const broken2 = (v.match(/dollarPrice > 0 \? '$/gm) || []).length;
console.log('Remaining broken strings:', broken + broken2);
