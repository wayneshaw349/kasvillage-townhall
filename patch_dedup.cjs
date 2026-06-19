const fs = require('fs');
let c = fs.readFileSync('ProfileScreen.tsx', 'utf8');

// Find the duplicate: second occurrence of the attest block
const marker = "              {!arweaveAttested && (\n              <TouchableOpacity";
const first = c.indexOf(marker);
const second = c.indexOf(marker, first + 1);
if (second > -1) {
  // Find the end of the second block: "              )}"
  const blockEnd = c.indexOf("              )}", second);
  if (blockEnd > -1) {
    const endOfBlock = blockEnd + "              )}".length;
    c = c.substring(0, second) + c.substring(endOfBlock);
    console.log('Removed duplicate attest block');
  }
} else { console.log('No duplicate found'); }

fs.writeFileSync('ProfileScreen.tsx', c);
