const fs = require('fs');
const f = 'src\\townhall_verification_complete.rs';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
let fixes = 0;

for (let i = 0; i < lines.length; i++) {
  // Find: pub pubkey: String, inside CounterpartyLookupRequest
  // Make it optional with serde default
  if (lines[i].trim() === 'pub pubkey: String,' && i > 0) {
    // Check if previous line or nearby has CounterpartyLookupRequest
    let inStruct = false;
    for (let j = i-1; j > i-5 && j >= 0; j--) {
      if (lines[j].includes('CounterpartyLookupRequest')) { inStruct = true; break; }
    }
    if (inStruct) {
      lines[i] = lines[i].replace('pub pubkey: String,', '#[serde(default)]\n    pub pubkey: String,');
      fixes++; console.log('L' + (i+1) + ': Made pubkey optional in CounterpartyLookupRequest');
    }
  }
  
  // Same for CounterpartyProofRequest if it has pubkey
  if (lines[i].trim() === 'pub include_proof: bool,' && i > 0) {
    // Check struct name
    for (let j = i-1; j > i-5 && j >= 0; j--) {
      if (lines[j].includes('CounterpartyProofRequest')) {
        // This struct is fine - include_proof is a valid query param
        break;
      }
    }
  }
}

fs.writeFileSync(f, lines.join('\r\n'));
console.log('Fixes: ' + fixes);
