const fs = require('fs');
let c = fs.readFileSync('kv_proposal.ts', 'utf8');

// 1. Add buyerPubkey param to generateProposal
c = c.replace(
  "  description: string;\n}): string {",
  "  description: string;\n  buyerPubkey?: string;\n}): string {"
);

// 2. Include buyerPubkey in proposal string (at end, backward-compatible)
c = c.replace(
  "    params.network, params.buyerR, params.verificationCode, desc].join('|');",
  "    params.network, params.buyerR, params.verificationCode, desc, params.buyerPubkey || ''].join('|');"
);

// 3. Parse buyerPubkey from proposal string if present
c = c.replace(
  "    description: parts.slice(9).join('|'),",
  "    description: parts[9] || '',\n    buyerPubkeyRaw: parts[10] || '',"
);

// 4. Use actual pubkey if available, fallback to addressToPubkey
c = c.replace(
  "proposal.buyerPubkey = addressToPubkey(proposal.buyerAddress);",
  "proposal.buyerPubkey = proposal.buyerPubkeyRaw || addressToPubkey(proposal.buyerAddress);"
);

// 5. Add buyerPubkeyRaw to interface
c = c.replace(
  "  sellerPubkey?: string | null;",
  "  sellerPubkey?: string | null;\n  buyerPubkeyRaw?: string;"
);

fs.writeFileSync('kv_proposal.ts', c);
console.log('Done');
