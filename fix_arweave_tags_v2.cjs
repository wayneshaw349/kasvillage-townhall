const fs = require('fs');
const f = 'src\\townhall_verification_complete.rs';
let content = fs.readFileSync(f, 'utf8');

// 1. Fix GraphQL tag names in query string (inside raw string literal)
content = content.replace(
  'name: \\"Type\\", values: [\\"KV_FROST_V1\\"]',
  'name: \\"KV-Type\\", values: [\\"frost-agreement\\"]'
);
content = content.replace(
  'name: \\"Participant-Hash\\", values: [\\"{}\\"]',
  'name: \\"KV-Pubkey\\", values: [\\"{}\\"]'
);
console.log('1. Fixed GraphQL query tags');

// 2. Use raw pubkey instead of hash
content = content.replace(
  'let pubkey_hash = compute_hash_index(&format!("PK:{}", pubkey));',
  'let pubkey_hash = pubkey.to_string();'
);
console.log('2. Using raw pubkey');

// 3. Fix tag reads: Event-Type → KV-Status
content = content.replace('get_tag("Event-Type")', 'get_tag("KV-Status")');
console.log('3. Fixed Event-Type → KV-Status');

// 4. Fix status values
content = content.replace('Some("completed")', 'Some("Released")');
content = content.replace('Some("deadlocked")', 'Some("Deadlocked")');
content = content.replace('Some("refunded")', 'Some("Refunded")');
content = content.replace('Some("expired")', 'Some("Expired")');
content = content.replace('Some("created")', 'Some("Agreed") | Some("Accepted") | Some("Signed")');
console.log('4. Fixed status values');

// 5. Fix field tag reads
content = content.replace('get_tag("Agreement-ID")', 'get_tag("KV-AgreementId")');
content = content.replace('get_tag("Buyer-Pubkey")', 'get_tag("KV-Pubkey")');
content = content.replace('get_tag("Seller-Pubkey")', 'get_tag("KV-Counterparty")');
content = content.replace('get_tag("Amount-Sompi")', 'get_tag("KV-Amount")');
content = content.replace('get_tag("DAA-Score")', 'get_tag("KV-DAAScore")');
content = content.replace('get_tag("Deadlock-Reason")', 'get_tag("KV-DeadlockReason")');
console.log('5. Fixed field tag reads');

fs.writeFileSync(f, content);
console.log('Done — NO other changes');
