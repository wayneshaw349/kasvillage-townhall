const fs = require('fs');
let c = fs.readFileSync('QRPayNearby.tsx', 'utf8');
// Replace multiline {'<newline>'} with {'\n'}
c = c.replace(/\{'[\r\n]+'\}/g, "{'\\n'}");
fs.writeFileSync('QRPayNearby.tsx', c);
console.log('Fixed', (c.match(/\{'\\n'\}/g)||[]).length, 'newline escapes');
