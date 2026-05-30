const fs = require('fs');
let f = fs.readFileSync('NeighborAgreement.tsx', 'utf8');
let fixes = 0;

// Find and disable the Seller-Release auto-trigger
// It logs "[Seller-Release] Got partial sig, co-signing..."
const patterns = [
  // The auto-trigger block that fires on relay poll
  { find: "console.log('[Seller-Release] Got partial sig, co-signing...')", label: "Seller-Release auto-trigger" },
  { find: "[Seller-Release] Sig mode:", label: "Seller-Release sig mode" },
  { find: "[Seller-Release] buyerR source:", label: "Seller-Release buyerR" },
  { find: "[Seller-Release] 2-round:", label: "Seller-Release 2-round" },
];

// Find the function/block that contains the Seller-Release logic
const marker = "Seller-Release] Got partial sig";
const idx = f.indexOf(marker);
if (idx < 0) {
  console.log('Seller-Release auto-trigger not found — already clean');
  process.exit(0);
}

// Walk backward to find the containing if/block
let searchStart = idx;
// Go back to find the condition that triggers this
let lineStart = f.lastIndexOf('\n', searchStart);
let contextStart = f.lastIndexOf('\n', lineStart - 1);
let contextLine = f.substring(contextStart, lineStart).trim();
console.log('Context before trigger:', contextLine.substring(0, 80));

// Strategy: wrap the entire Seller-Release block in if(false)
// Find "Got partial sig" and go backward to the nearest if/else block
// Then forward to find its closing brace

// More targeted: find the function that calls this and disable it
// Look for the complete block by finding "Seller-Release] Got partial sig" 
// and wrapping the enclosing block

// Find the line number
const before = f.substring(0, idx);
const lineNum = before.split('\n').length;
console.log('Seller-Release trigger at line:', lineNum);

// Show surrounding lines
const lines = f.split('\n');
const start = Math.max(0, lineNum - 5);
const end = Math.min(lines.length, lineNum + 15);
console.log('\n--- Context ---');
for (let i = start; i < end; i++) {
  const marker2 = i === lineNum - 1 ? '>>>' : '   ';
  console.log(`${marker2} ${i + 1}: ${lines[i].substring(0, 100)}`);
}

// Find the enclosing if block
// Walk backward from the trigger line to find the condition
let ifLine = lineNum - 1;
while (ifLine > 0 && !lines[ifLine].trim().startsWith('if') && !lines[ifLine].includes('partialSig') && !lines[ifLine].includes('Seller-Release')) {
  ifLine--;
  if (lineNum - ifLine > 20) break; // don't go too far
}

console.log('\nPotential guard at line', ifLine + 1, ':', lines[ifLine].trim().substring(0, 80));

// Insert if(false) guard right before the Seller-Release log
// Find the start of the block containing the trigger
const triggerLineContent = lines[lineNum - 1];
const indent = triggerLineContent.match(/^\s*/)[0];

// Replace the trigger line with an if(false) guarded version
lines[lineNum - 1] = indent + '/* DISABLED: old auto-trigger — use canonical template flow instead */';
lines.splice(lineNum, 0, indent + '// ' + triggerLineContent.trim());

// Also find and disable completeFrost2Round / completeFrostAndBroadcast calls near the trigger
let disabled = 0;
for (let i = lineNum; i < Math.min(lineNum + 50, lines.length); i++) {
  if (lines[i].includes('completeFrost2Round') || 
      lines[i].includes('completeFrostAndBroadcast') ||
      lines[i].includes('createFrostPartialSig')) {
    if (!lines[i].trim().startsWith('//') && !lines[i].trim().startsWith('/*')) {
      lines[i] = lines[i].replace(/(completeFrost2Round|completeFrostAndBroadcast|createFrostPartialSig)/, '/* DISABLED */ // $1');
      disabled++;
    }
  }
}

f = lines.join('\n');
fs.writeFileSync('NeighborAgreement.tsx', f);

console.log('\nDisabled Seller-Release auto-trigger at line', lineNum);
console.log('Disabled', disabled, 'old signing calls nearby');
console.log('Emojis:', (f.match(/[\u{1F000}-\u{1FFFF}]/gu) || []).length);

// Verify no more active Seller-Release triggers
const remaining = (f.match(/\[Seller-Release\] Got partial sig/g) || []).length;
const commented = (f.match(/\/\/ .*\[Seller-Release\] Got partial sig/g) || []).length;
console.log('Active triggers:', remaining - commented, '(should be 0)');
