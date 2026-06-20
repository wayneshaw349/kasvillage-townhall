const fs = require('fs');
const f = 'C:\\Users\\wayne\\Downloads\\townhall_verification_complete.rs';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
let fixes = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('owner_pubkey: [u8; 33]')) {
    lines[i] = lines[i].replace('[u8; 33]', 'String');
    fixes++;
    console.log('L' + (i+1) + ': owner_pubkey -> String');
  }
  if (lines[i].includes('content_hash: [u8; 32]') && lines[i].includes('pub ')) {
    lines[i] = lines[i].replace('[u8; 32]', 'String');
    fixes++;
    console.log('L' + (i+1) + ': content_hash -> String');
  }
  if (lines[i].includes('device_attestation_hash: [u8; 32]') && lines[i].includes('pub ')) {
    lines[i] = lines[i].replace('[u8; 32]', 'String');
    fixes++;
    console.log('L' + (i+1) + ': device_attestation_hash -> String');
  }
}
fs.writeFileSync(f, lines.join('\r\n'));
console.log('Fixes: ' + fixes);
