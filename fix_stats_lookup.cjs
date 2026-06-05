// fix_stats_lookup.cjs — Binary-safe removal of old stub
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, 'TownHallScreen.tsx');

const buf = fs.readFileSync(FILE);
const src = buf.toString('utf8');

// Find the exact bad line using a short unique substring
const needle = '> = ({ myApt, myAddress }) => {\r\n  const [lookupQuery, setLookupQuery] = useState';
const needle2 = '> = ({ myApt, myAddress }) => {\n  const [lookupQuery, setLookupQuery] = useState';

let startIdx = src.indexOf(needle);
if (startIdx === -1) startIdx = src.indexOf(needle2);
if (startIdx === -1) {
  console.log('[fix] Old stub not found. File may already be clean.');
  process.exit(0);
}

// Back up to include the "}>" at the start of the line
// startIdx points to "> = ...", we need to include the "}" before it
if (startIdx > 0 && src[startIdx - 1] === '}') startIdx--;

// Find the end: the "};" that closes the old stub
// Search for "  };\r\n" or "  };\n" after the stub's "// TODO"
const todoIdx = src.indexOf('// TODO: implement stats lookup', startIdx);
if (todoIdx === -1) {
  console.log('[fix] TODO marker not found in old stub.');
  process.exit(1);
}

// Find the closing "};\r\n" after TODO
let endIdx = src.indexOf('};', todoIdx);
if (endIdx === -1) {
  console.log('[fix] Closing }; not found.');
  process.exit(1);
}
endIdx += 2; // include the ";"
// Also skip trailing newline
while (endIdx < src.length && (src[endIdx] === '\r' || src[endIdx] === '\n')) endIdx++;

console.log('[fix] Removing bytes', startIdx, 'to', endIdx, '(' + (endIdx - startIdx) + ' chars)');
console.log('[fix] Removed text starts with:', JSON.stringify(src.slice(startIdx, startIdx + 60)));
console.log('[fix] Removed text ends with:', JSON.stringify(src.slice(endIdx - 30, endIdx)));

// Replace with just "};\n" to close the new component
const fixed = src.slice(0, startIdx) + '};\n' + src.slice(endIdx);

fs.writeFileSync(FILE, fixed);
console.log('[fix] Done. Old stub removed, component properly closed.');
