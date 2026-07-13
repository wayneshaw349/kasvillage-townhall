// fix_frostcounter.cjs
// Re-applies the two lost edits using single-line, CRLF-tolerant regex anchors.
// 1. kv_proposal.ts parser: read frostCounter from parts[11]
// 2. NeighborAgreement.tsx buyer caller: pass frostCounter into generateProposal
const fs = require('fs');

function edit(file, apply) {
  let s = fs.readFileSync(file, 'utf8');
  const before = s;
  s = apply(s);
  if (s === before) { console.log('NO CHANGE (anchor not matched):', file); return false; }
  fs.writeFileSync(file, s);
  console.log('OK:', file);
  return true;
}

// ---- 1. Parser: kv_proposal.ts ----
edit('kv_proposal.ts', (s) => {
  if (s.includes('frostCounter: (parts[11]')) { console.log('parser already has it'); return s; }
  // match: buyerPubkeyRaw: parts[10] || '',   (tolerate any whitespace/quotes)
  return s.replace(
    /(buyerPubkeyRaw:\s*parts\[10\]\s*\|\|\s*'',)/,
    "$1\n    frostCounter: (parts[11] !== undefined && parts[11] !== '') ? parseInt(parts[11], 10) : undefined,"
  );
});

// ---- 2. Caller: NeighborAgreement.tsx ----
edit('NeighborAgreement.tsx', (s) => {
  if (s.includes('frostCounter: (contract.frostData')) { console.log('caller already has it'); return s; }
  // Insert frostCounter right after the buyerPubkey line inside the generateProposal call.
  // Anchor: buyerPubkey: contract.buyerPubkey || '',  (there may be several; target the one
  // immediately followed by a description line that includes shippingCenter)
  return s.replace(
    /(buyerPubkey:\s*contract\.buyerPubkey\s*\|\|\s*'',\r?\n\s*)(description:\s*\(contract\.itemDescription)/,
    "$1frostCounter: (contract.frostData ? contract.frostData.frostCounter : undefined) ?? 0,\n                            $2"
  );
});

console.log('done');
