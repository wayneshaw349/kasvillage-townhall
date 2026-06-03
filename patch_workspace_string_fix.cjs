const fs = require('fs');
const f = 'Workspace.tsx';
let s = fs.readFileSync(f, 'utf8');
let changes = 0;

// Fix all unterminated dollarPrice strings
// Pattern: {item.dollarPrice > 0 ? '\n  (newline breaks the string)
// Replace with single-line ternary
const lines = s.split('\n');
const fixedLines = [];
let skip = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  
  // Fix broken dollarPrice ternary (string continues on wrong line)
  if (trimmed === "{item.dollarPrice > 0 ? '") {
    // Look ahead for the rest of the ternary or just replace
    fixedLines.push(line.replace("{item.dollarPrice > 0 ? '", "{item.dollarPrice > 0 ? '$' + item.dollarPrice.toFixed(2) + ' USD • ' : ''}{item.kaspaPrice > 0 ? item.kaspaPrice + ' KAS' : 'Price TBD'}"));
    changes++;
    console.log('Fixed broken dollarPrice at line', i + 1);
    continue;
  }
  
  // Remove orphaned continuation lines from broken ternary
  if (trimmed.startsWith("+ item.dollarPrice.toFixed(2) + ' • '") || 
      trimmed.startsWith("+ item.dollarPrice.toFixed(2) + ' USD'")) {
    console.log('Removed orphan at line', i + 1, ':', trimmed.slice(0, 60));
    changes++;
    continue;
  }
  
  fixedLines.push(line);
}

fs.writeFileSync(f, fixedLines.join('\n'));
console.log('\nTotal fixes:', changes);

// Verify no more broken strings
const v = fs.readFileSync(f, 'utf8');
const remaining = (v.match(/dollarPrice > 0 \? '\n/g) || []).length;
console.log('Remaining broken dollarPrice strings:', remaining);
