const fs = require('fs');
let c = fs.readFileSync('src/main.rs', 'utf8');
// Add Debug to StatelessVerifyResponse
c = c.replace('#[derive(Serialize)]\npub struct StatelessVerifyResponse', '#[derive(Debug, Serialize)]\npub struct StatelessVerifyResponse');
// Try with any whitespace
if (!c.includes('derive(Debug, Serialize)]\npub struct StatelessVerifyResponse')) {
  c = c.replace(/\#\[derive\(Serialize\)\]\s*pub struct StatelessVerifyResponse/, '#[derive(Debug, Clone, Serialize)]\npub struct StatelessVerifyResponse');
}
// Also add Clone to VerificationProof if missing
if (!c.includes('derive(Clone') || !c.match(/derive\(Clone[^)]*\)\]\s*pub struct VerificationProof/)) {
  c = c.replace(/pub struct VerificationProof \{/, '#[derive(Clone, Debug, Serialize, Deserialize)]\npub struct VerificationProof {');
}
fs.writeFileSync('src/main.rs', c);
console.log('Added Debug/Clone derives');
