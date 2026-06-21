const fs = require('fs');
const f = 'src\\main.rs';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);

for (let i = 0; i < lines.length; i++) {
  // Find the integrity line and remove its trailing ;
  if (lines[i].includes('api_check_integrity') && lines[i].trim().endsWith(';')) {
    lines[i] = lines[i].replace(/;\s*$/, '');
    console.log('L' + (i+1) + ': removed ; from integrity line');
  }
  // Add ; to the last storefront route
  if (lines[i].includes('api_save_storefront') && !lines[i].trim().endsWith(';')) {
    lines[i] = lines[i].replace(/\)\)\s*$/, '));');
    console.log('L' + (i+1) + ': added ; to save_storefront');
  }
}

fs.writeFileSync(f, lines.join('\r\n'));
