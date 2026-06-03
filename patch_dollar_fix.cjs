const fs = require('fs');
const f = 'Workspace.tsx';
let s = fs.readFileSync(f, 'utf8');
let changes = 0;

// Fix all broken dollarPrice ternaries — replace with template literals
// Bad: {item.dollarPrice > 0 ? ' + item.dollarPrice.toFixed(2) + ' USD • ' : ''}...
// Good: {item.dollarPrice > 0 && <Text>${item.dollarPrice.toFixed(2)} USD</Text>}

const lines = s.split('\n');
for (let i = 0; i < lines.length; i++) {
  const t = lines[i].trim();
  // Match the broken pattern
  if (t.includes("item.dollarPrice > 0 ? '") && t.includes("item.dollarPrice.toFixed")) {
    const indent = lines[i].match(/^(\s*)/)[1];
    lines[i] = indent + "{item.dollarPrice > 0 ? `$${item.dollarPrice.toFixed(2)} USD` : ''} {item.kaspaPrice > 0 ? `${item.kaspaPrice} KAS` : 'Price TBD'}";
    changes++;
    console.log('Fixed line', i + 1);
  }
}

fs.writeFileSync(f, lines.join('\n'));
console.log('Total fixes:', changes);
