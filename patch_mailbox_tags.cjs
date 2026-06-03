const fs = require('fs');
const f = 'mailbox_arweave_api.ts';
let s = fs.readFileSync(f, 'utf8');
let changes = 0;

// === 1: Fix DApp query tags ===
s = s.replace(
  '{ name: "Type", values: ["KV_DAPP_V1"] }',
  '{ name: "KV-Type", values: ["DApp"] }'
);
// Fix DApp field parsing
s = s.replace("getTagValue(tags, 'DApp-Name')", "getTagValue(tags, 'KV-DAppName')");
s = s.replace("getTagValue(tags, 'Owner-Pubkey') ?? '',\n      templateVerified: getTagValue(tags, 'Template-Verified') === 'true',",
  "getTagValue(tags, 'KV-Owner') ?? '',\n      templateVerified: getTagValue(tags, 'KV-SDKHash') !== null,");
s = s.replace("getTagValue(tags, 'Verified') === 'true',\n        verifiedAt: edge.node.block?.timestamp,\n        verificationTx: getTagValue(tags, 'Verification-TX'),\n        apt: getTagValue(tags, 'APT-Alias'),\n      },\n      createdAt: edge.node.block?.timestamp ?? 0,\n      xpCommitment: parseInt(getTagValue(tags, 'XP-Commitment') ?? '0', 10),",
  "getTagValue(tags, 'KV-SDKHash') !== null,\n        verifiedAt: edge.node.block?.timestamp,\n        verificationTx: id,\n        apt: getTagValue(tags, 'KV-Owner'),\n      },\n      createdAt: edge.node.block?.timestamp ?? 0,\n      xpCommitment: parseInt(getTagValue(tags, 'KV-XPStake') ?? '0', 10),");
changes++; console.log('1: Fixed DApp tags');

// === 2: Fix Storefront query tags ===
s = s.replace(
  '{ name: "Type", values: ["KV_STOREFRONT_V1"] }',
  '{ name: "KV-Type", values: ["Storefront"] }'
);
s = s.replace("getTagValue(tags, 'Brand-Name') ?? 'Unknown Store'", "getTagValue(tags, 'KV-StoreName') ?? 'Unknown Store'");
s = s.replace("getTagValue(tags, 'Tagline') ?? ''", "getTagValue(tags, 'KV-Category') ?? ''");
// Fix owner and other fields - need to be careful with duplicate patterns
// First storefront-specific block already handled above for DApps
// Handle second occurrence
const sfOwner = "ownerPubkey: getTagValue(tags, 'Owner-Pubkey') ?? '',\n      logoArweaveTx: getTagValue(tags, 'Logo-TX'),";
if (s.includes(sfOwner)) {
  s = s.replace(sfOwner, "ownerPubkey: getTagValue(tags, 'KV-Owner') ?? '',\n      primaryLink: getTagValue(tags, 'KV-PrimaryLink') ?? '',\n      logoArweaveTx: getTagValue(tags, 'Logo-TX'),");
  changes++; console.log('2a: Fixed Storefront owner + added primaryLink');
}
// Fix second Verified block (for storefronts)
if (s.includes("verified: getTagValue(tags, 'Verified') === 'true',")) {
  s = s.replace(
    "verified: getTagValue(tags, 'Verified') === 'true',",
    "verified: true, // published = verified"
  );
  changes++; console.log('2b: Fixed Storefront verified');
}
changes++; console.log('2: Fixed Storefront tags');

// === 3: Fix Coupon query tags ===
if (s.includes('{ name: "Type", values: ["KV_COUPON_V1"] }')) {
  s = s.replace('{ name: "Type", values: ["KV_COUPON_V1"] }', '{ name: "KV-Type", values: ["Coupon"] }');
  changes++; console.log('3: Fixed Coupon tags');
}

// === 4: Fix Academic query tags ===
if (s.includes('{ name: "Type", values: ["KV_ACADEMIC_V1"] }')) {
  s = s.replace('{ name: "Type", values: ["KV_ACADEMIC_V1"] }', '{ name: "KV-Type", values: ["Abstract"] }');
  changes++; console.log('4: Fixed Academic tags');
}

// === 5: Fix Service query tags ===
if (s.includes('{ name: "Type", values: ["KV_SERVICE_V1"] }')) {
  s = s.replace('{ name: "Type", values: ["KV_SERVICE_V1"] }', '{ name: "KV-Type", values: ["Service"] }');
  changes++; console.log('5: Fixed Service tags');
}

// === 6: Add primaryLink to StorefrontEntry type ===
if (s.includes('productCount: number;') && !s.includes('primaryLink')) {
  s = s.replace(
    'productCount: number;',
    'productCount: number;\n  primaryLink?: string;'
  );
  changes++; console.log('6: Added primaryLink to StorefrontEntry type');
}

// === 7: Fix remaining tag name patterns (Category, Description etc) ===
// These appear in multiple fetch functions
s = s.replaceAll("getTagValue(tags, 'Category')", "getTagValue(tags, 'KV-Category')");
s = s.replaceAll("getTagValue(tags, 'Description')", "getTagValue(tags, 'KV-Description') || getTagValue(tags, 'Description')");
s = s.replaceAll("getTagValue(tags, 'Rating')", "getTagValue(tags, 'KV-Rating')");
s = s.replaceAll("getTagValue(tags, 'Product-Count')", "getTagValue(tags, 'KV-ProductCount')");
changes++; console.log('7: Fixed remaining tag names');

fs.writeFileSync(f, s);
console.log('\nTotal changes:', changes);
const v = fs.readFileSync(f, 'utf8');
console.log('Verify - KV-Type DApp:', v.includes('KV-Type", values: ["DApp"]'));
console.log('Verify - KV-Type Storefront:', v.includes('KV-Type", values: ["Storefront"]'));
console.log('Verify - KV-StoreName:', v.includes('KV-StoreName'));
console.log('Verify - KV-DAppName:', v.includes('KV-DAppName'));
console.log('Verify - KV-Owner:', v.includes('KV-Owner'));
console.log('Verify - primaryLink:', v.includes('primaryLink'));
