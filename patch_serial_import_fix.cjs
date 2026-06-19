const fs = require('fs');
let c = fs.readFileSync('ProfileScreen.tsx', 'utf8');
c = c.replace(
  "import { uploadToArweave } from './arweave_upload';",
  "import { uploadToTurbo } from './arweave_upload';"
);
c = c.replace('await uploadToArweave(', 'await uploadToTurbo(');
console.log('Fixed import + call');
fs.writeFileSync('ProfileScreen.tsx', c);
