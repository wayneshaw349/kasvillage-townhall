const fs = require('fs');
const f = 'Workspace.tsx';
let s = fs.readFileSync(f, 'utf8');

// Replace the runtime reference with a static number
s = s.replaceAll(
  '{IMAGE_BYPASS_PATTERNS.length}+',
  '53+'
);
// Also try without curly braces in case it's in a template
s = s.replaceAll(
  'IMAGE_BYPASS_PATTERNS.length',
  '53'
);

fs.writeFileSync(f, s);
console.log('Fixed: replaced IMAGE_BYPASS_PATTERNS.length with 53');
