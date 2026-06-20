const fs = require('fs');
const f = 'src\\main.rs';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
let removed = 0;

for (let i = lines.length - 1; i >= 0; i--) {
  const t = lines[i].trim();
  if (t.includes('townhall_verification_complete::api_search_storefronts') ||
      t.includes('townhall_verification_complete::api_get_storefront)') ||
      t.includes('townhall_verification_complete::api_record_visit') ||
      t.includes('townhall_verification_complete::api_get_storefront_stats') ||
      t.includes('townhall_verification_complete::api_get_products') ||
      t.includes('townhall_verification_complete::api_save_storefront') ||
      t === '// Storefronts') {
    lines.splice(i, 1);
    removed++; 
  }
}

// Make sure the last route line ends with ;
for (let i = lines.length - 1; i >= 0; i--) {
  if (lines[i].includes('townhall_verification_complete::api_check_integrity')) {
    if (!lines[i].trim().endsWith(';')) {
      lines[i] = lines[i].replace(/\)\)$/, '));');
      lines[i] = lines[i].replace(/\)\)\s*$/, '));');
    }
    break;
  }
}

fs.writeFileSync(f, lines.join('\r\n'));
console.log('Removed ' + removed + ' storefront route lines');
