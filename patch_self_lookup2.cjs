const fs = require('fs');
let c = fs.readFileSync('townhallscreen.tsx', 'utf8');

// Find the APT lookup block by a unique anchor
const anchor = "lookupResult = await lookupByApt(aptNum);";
const idx = c.indexOf(anchor);
if (idx > -1) {
  // Find the start of "const aptNum" line before it
  const lineStart = c.lastIndexOf('const aptNum', idx);
  if (lineStart > -1) {
    // Find the comment line above it
    const commentStart = c.lastIndexOf('//', lineStart);
    const blockStart = (commentStart > lineStart - 80) ? commentStart : lineStart;
    const blockEnd = idx + anchor.length;
    const replacement = `// APT lookup: check self first, then Arweave
        const aptNum = q.replace(/^APT-/i, '');
        const myAptNum = (myApt || '').replace(/^APT-/i, '');
        if (aptNum === myAptNum && myPubkey) {
          const selfResult = await lookupCounterparty(myPubkey);
          lookupResult = { pubkey: myPubkey, stats: selfResult.stats };
        } else {
          lookupResult = await lookupByApt(aptNum);
        }`;
    c = c.substring(0, blockStart) + replacement + c.substring(blockEnd);
    console.log('1. Added self-lookup shortcut');
  }
} else { console.log('1. SKIP - anchor not found'); }

fs.writeFileSync('townhallscreen.tsx', c);
console.log('Done');
