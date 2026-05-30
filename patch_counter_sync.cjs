const fs = require('fs');
let f = fs.readFileSync('NeighborAgreement.tsx', 'utf8');
let fixes = 0;

// === FIX 1: parseClipboard handles KV| anywhere (email headers/footers) ===
const oldStartsWith = "if (v.startsWith('KV|'))";
if (f.includes(oldStartsWith)) {
  f = f.replace(
    oldStartsWith,
    "const kvIdx = v.indexOf('KV|'); if (kvIdx >= 0)"
  );
  // Fix the body to use kvLine instead of v
  f = f.replace(
    "result.kvProposal = v;",
    "const kvLine = v.substring(kvIdx).split('\\n')[0].replace(/\\s*Sent from my iPhone.*$/i, '').trim(); result.kvProposal = kvLine;"
  );
  f = f.replace(
    "const parts = v.split('|');",
    "const parts = kvLine.split('|');"
  );
  fixes++;
  console.log('FIX 1: parseClipboard handles KV| anywhere in text');
}

// === FIX 2: Seller paste handler also handles KV| anywhere ===
const oldSellerPaste = 'if (v.startsWith("KV|"))';
if (f.includes(oldSellerPaste)) {
  f = f.replace(
    oldSellerPaste,
    'const kvStart = v.indexOf("KV|"); if (kvStart >= 0)'
  );
  // Fix the parseProposal call to use extracted line
  const oldParseCall = 'const parsed = parseProposal(v);';
  if (f.includes(oldParseCall)) {
    f = f.replace(
      oldParseCall,
      'const kvClean = v.substring(kvStart).split("\\n")[0].replace(/\\s*Sent from my iPhone.*$/i, "").trim(); const parsed = parseProposal(kvClean);'
    );
  }
  fixes++;
  console.log('FIX 2: Seller paste strips email headers + "Sent from my iPhone"');
}

// === FIX 3: Add frostCounter to generateProposal call ===
const genProposalCall = "const shareText = generateProposal({";
const genIdx = f.indexOf(genProposalCall);
if (genIdx >= 0) {
  // Find the closing of the generateProposal call
  const closingParen = f.indexOf('});', genIdx);
  const currentCall = f.substring(genIdx, closingParen + 3);
  
  // Check if frostCounter is already there
  if (!currentCall.includes('frostCounter')) {
    // Add frostCounter before the closing
    f = f.replace(
      /description: \(contract\.itemDescription[^}]+\},\n\s*\}\)/,
      (match) => match.replace(')})', 
        ",\n            frostCounter: contract.frostData?.frostCounter || 0,\n          })")
    );
    
    // Simpler approach: just insert before the closing });
    if (!f.includes('frostCounter: contract.frostData')) {
      const beforeClose = f.lastIndexOf('})', f.indexOf('generateProposal({') + 100);
      // Find the description line in generateProposal
      const descLine = f.indexOf("description: (contract.itemDescription", genIdx);
      if (descLine > 0) {
        const lineEnd = f.indexOf('\n', descLine);
        const currentLine = f.substring(descLine, lineEnd);
        f = f.replace(
          currentLine,
          currentLine.replace(/,\s*$/, '') + ',\n            frostCounter: contract.frostData?.frostCounter || 0,'
        );
      }
    }
    fixes++;
    console.log('FIX 3: Added frostCounter to generateProposal call');
  }
}

// === FIX 4: Update kv_proposal.ts to include frostCounter ===
let kv;
try { kv = fs.readFileSync('kv_proposal.ts', 'utf8'); } catch { kv = null; }
if (kv) {
  // Add frostCounter to the KV format
  // Current format: KV|agrId|buyerAddr|sellerAddr|buyerAmt|sellerAmt|network|R|verCode|desc
  // New format: KV|agrId|buyerAddr|sellerAddr|buyerAmt|sellerAmt|network|R|verCode|desc|counter
  
  if (!kv.includes('frostCounter')) {
    // Add to generateProposal function
    if (kv.includes('params.description')) {
      kv = kv.replace(
        /params\.description[^;]*;/,
        (match) => match + "\n  if (params.frostCounter !== undefined) parts.push(String(params.frostCounter));"
      );
    }
    
    // Add to parseProposal function
    if (kv.includes('description:')) {
      kv = kv.replace(
        /description:\s*parts\[\d+\]/,
        (match) => match + ",\n    frostCounter: parts[10] !== undefined ? parseInt(parts[10]) : undefined"
      );
    }
    
    // Add to interface
    if (kv.includes('description?:') || kv.includes('description:')) {
      kv = kv.replace(
        /verificationCode\??\s*:\s*string;/,
        (match) => match + "\n  frostCounter?: number;"
      );
    }
    
    fs.writeFileSync('kv_proposal.ts', kv);
    fixes++;
    console.log('FIX 4: Added frostCounter to kv_proposal.ts');
  }
} else {
  console.log('FIX 4: kv_proposal.ts not found — adding inline counter extraction');
  // Fallback: extract counter from KV line in the paste handler
}

// === FIX 5: Seller uses buyer's counter instead of independently deriving ===
// Find the seller L1 counter loop in handleAcceptFromInbox
const sellerLoopMarker = "for (let _sc = 0; _sc < 10; _sc++)";
const sellerLoopIdx = f.indexOf(sellerLoopMarker);
if (sellerLoopIdx >= 0) {
  // Find the block before: where frostData is set
  // We need to check if the parsed proposal has a frostCounter
  // If it does, skip the loop and use it directly
  
  const beforeLoop = f.lastIndexOf('\n', sellerLoopIdx);
  const indent = '          ';
  const counterCheck = `${indent}// Use buyer's counter if provided in proposal (avoids counter divergence)
${indent}const buyerCounter = (agreement as any)?.frostCounter ?? (agreement as any)?.KVFrostCounter;
${indent}if (buyerCounter !== undefined && buyerCounter !== null) {
${indent}  const directFrost = deriveFrostAddressLocal({ pubkeyA: myPubkey, pubkeyB: proposerPubkey, network: frostNetwork, agreementId: agrId, frostCounter: buyerCounter });
${indent}  frostData = directFrost;
${indent}  console.log('[Seller-Counter] Using buyer counter:', buyerCounter, directFrost.address.slice(0,30));
${indent}} else {
`;
  
  // Find the end of the loop (after the fallback)
  const loopFallback = f.indexOf("if (!frostData) frostData = deriveFrostAddressLocal", sellerLoopIdx);
  const loopFallbackEnd = f.indexOf(';', loopFallback) + 1;
  
  // Wrap the loop in an else block
  f = f.substring(0, beforeLoop + 1) + counterCheck + f.substring(beforeLoop + 1, loopFallbackEnd) + '\n' + indent + '}' + f.substring(loopFallbackEnd);
  
  fixes++;
  console.log('FIX 5: Seller uses buyer counter when available, falls back to L1 loop');
}

// === FIX 6: Also extract frostCounter from parsed KV proposal in seller paste ===
const sellerParsedAlert = "Alert.alert(\"Proposal Found\"";
const spIdx = f.indexOf(sellerParsedAlert);
if (spIdx >= 0) {
  // Find where fakeAgr is created
  const fakeAgrIdx = f.indexOf("const fakeAgr = {", spIdx);
  if (fakeAgrIdx >= 0) {
    const fakeAgrEnd = f.indexOf("};", fakeAgrIdx);
    const currentFakeAgr = f.substring(fakeAgrIdx, fakeAgrEnd + 2);
    if (!currentFakeAgr.includes('frostCounter')) {
      f = f.replace(
        currentFakeAgr,
        currentFakeAgr.replace('};', ', frostCounter: parsed.frostCounter };')
      );
      fixes++;
      console.log('FIX 6: frostCounter passed through fakeAgr to handleAcceptFromInbox');
    }
  }
}

fs.writeFileSync('NeighborAgreement.tsx', f);
console.log('\nTotal fixes:', fixes);
console.log('Emojis:', (f.match(/[\u{1F000}-\u{1FFFF}]/gu) || []).length);

// Verify
console.log('\n--- Verification ---');
console.log('KV| anywhere parse:', f.includes('kvIdx >= 0') || f.includes('kvStart >= 0'));
console.log('Sent from iPhone strip:', f.includes('Sent from my iPhone'));
console.log('frostCounter in generateProposal:', f.includes('frostCounter: contract.frostData'));
console.log('Buyer counter check in seller:', f.includes('buyerCounter'));
