const fs = require('fs');
const f = 'src\\townhall_verification_complete.rs';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);

const products = fs.readFileSync('storefront_impls.rs', 'utf8').split(/\r?\n/);
const search = fs.readFileSync('storefront_search.rs', 'utf8').split(/\r?\n/);
const upload = fs.readFileSync('storefront_upload.rs', 'utf8').split(/\r?\n/);

function replaceFn(lines, sig, newBody) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith(sig)) {
      let depth = 0, end = i;
      for (let j = i; j < lines.length; j++) {
        for (const ch of lines[j]) { if (ch==='{') depth++; if (ch==='}') depth--; }
        if (depth === 0 && j > i) { end = j; break; }
      }
      lines.splice(i, end - i + 1, ...newBody);
      return true;
    }
  }
  return false;
}

if (replaceFn(lines, 'async fn query_products_from_arweave(', products))
  console.log('Replaced query_products_from_arweave');
else console.log('WARN: products fn not found');

if (replaceFn(lines, 'async fn search_storefronts_arweave(', search))
  console.log('Replaced search_storefronts_arweave');
else console.log('WARN: search fn not found');

if (replaceFn(lines, 'async fn upload_storefront_to_arweave(', upload))
  console.log('Replaced upload_storefront_to_arweave');
else console.log('WARN: upload fn not found');

fs.writeFileSync(f, lines.join('\r\n'));
console.log('Done');
