const fs = require('fs');
const f = 'Dockerfile';
let text = fs.readFileSync(f, 'utf8');

// After "COPY src/main.rs src/main.rs", add the verification file
text = text.replace(
  'COPY src/main.rs src/main.rs',
  'COPY src/main.rs src/main.rs\nCOPY src/townhall_verification_complete.rs src/townhall_verification_complete.rs'
);

fs.writeFileSync(f, text);
console.log('Added COPY for townhall_verification_complete.rs');
