const fs = require('fs');
const f = 'src\\main.rs';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
let fixes = 0;

for (let i = 0; i < lines.length; i++) {
  // Only swap in the second route block (line 7700+)
  if (i > 7700 && lines[i].includes('/api/verify/dapp') && lines[i].includes('verify_dapp)')) {
    lines[i] = lines[i].replace('verify_dapp)', 'townhall_verification_complete::api_verify_dapp)');
    fixes++; console.log('L' + (i+1) + ': verify_dapp -> townhall_verification_complete::api_verify_dapp');
  }
}

fs.writeFileSync(f, lines.join('\r\n'));
console.log('Fixes: ' + fixes);
