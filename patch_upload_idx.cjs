const fs = require('fs');
let c = fs.readFileSync('src/main.rs', 'utf8'); // wrong file, fix below
c = fs.readFileSync('townhallscreen.tsx', 'utf8');
const a = c.indexOf('buildAns104Item');
const b = c.indexOf("await buildFn(dataBytes, tags, privKey).then(uploadFn);");
console.log('buildAns104Item at:', a);
console.log('buildFn.then at:', b);
// Find the line start of arweaveUpload import
const importLine = c.lastIndexOf("const arweaveUpload", a);
// Find the end of the result line
const resultEnd = c.indexOf(';', b) + 1;
console.log('Replace from:', importLine, 'to:', resultEnd);
console.log('OLD:', JSON.stringify(c.substring(importLine, resultEnd)));
const replacement = 'const arweaveUpload = await import(\'./arweave_upload\');\n              console.log(\'[TownHall] Starting Arweave inscription, payload:\', proofPayload.length, \'bytes\');\n              if (arweaveUpload.uploadToTurbo) {\n              const result = await arweaveUpload.uploadToTurbo(proofPayload, tags);\n              console.log(\'[TownHall] Upload result:\', JSON.stringify(result));';
c = c.substring(0, importLine) + replacement + c.substring(resultEnd);
fs.writeFileSync('townhallscreen.tsx', c);
console.log('Done:', c.includes('uploadToTurbo'), !c.includes('buildAns104Item'));
