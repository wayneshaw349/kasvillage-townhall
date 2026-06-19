const fs = require('fs');
let c = fs.readFileSync('src/main.rs', 'utf8');
// Remove the duplicate HALO2_K_ACADEMIC we added to release block
c = c.replace(/pub const HALO2_K: u32 = 12;[^\r\n]*\r?\npub const HALO2_K_ACADEMIC: u32 = 17;[^\r\n]*\r?\n\r?\n#\[cfg\(not/, 
  'pub const HALO2_K: u32 = 12;  // Default: fast proofs, same security for marketplace\n\n#[cfg(not');
// Simpler: just remove line 93
const lines = c.split(/\r?\n/);
if (lines[92] && lines[92].includes('HALO2_K_ACADEMIC')) {
  lines.splice(92, 1);
  c = lines.join(c.includes('\r\n') ? '\r\n' : '\n');
  console.log('Removed duplicate L93');
}
fs.writeFileSync('src/main.rs', c);
