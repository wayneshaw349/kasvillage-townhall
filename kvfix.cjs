const fs=require('fs');let k=fs.readFileSync('kv_proposal.ts','utf8');
// parser: read frostCounter from parts[11]
k=k.replace("    buyerPubkeyRaw: parts[10] || '',\n  };","    buyerPubkeyRaw: parts[10] || '',\n    frostCounter: parts[11] !== undefined && parts[11] !== '' ? parseInt(parts[11], 10) : undefined,\n  };");
// generateProposal param type: add the two optional fields
k=k.replace("  verificationCode: string;\n  description: string;\n}): string {","  verificationCode: string;\n  description: string;\n  buyerPubkey?: string;\n  frostCounter?: number;\n}): string {");
fs.writeFileSync('kv_proposal.ts',k);console.log('done');
