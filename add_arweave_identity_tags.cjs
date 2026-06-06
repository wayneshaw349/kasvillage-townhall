// add_arweave_identity_tags.cjs
// Adds KV-Pubkey and KV-Address tags to identity inscription
// so TownHall can resolve address→pubkey via Arweave query
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'identity_inscription_v6.ts');
let src = fs.readFileSync(file, 'utf8');

// 1. Read pubkey before tags array (after address read)
src = src.replace(
  `// Get device anchor hash (first 16 hex chars = 8 bytes)`,
  `// Read pubkey for Arweave tagging
  const pubkeyHex = await SecureStore.getItemAsync('kv_public_key') ?? '';

  // Get device anchor hash (first 16 hex chars = 8 bytes)`
);

// 2. Add KV-Pubkey and KV-Address to Arweave tags
src = src.replace(
  `{ name: 'KV-Network',      value: network },
  ];`,
  `{ name: 'KV-Network',      value: network },
    { name: 'KV-Pubkey',       value: pubkeyHex },
    { name: 'KV-Address',      value: address },
  ];`
);

fs.writeFileSync(file, src, 'utf8');
console.log('✅ identity_inscription_v6.ts: added KV-Pubkey + KV-Address tags');
