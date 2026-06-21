const fs = require('fs');
const f = 'src\\main.rs';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('townhall_verification_complete::api_check_integrity')) {
    // Remove trailing ) so we can chain
    lines[i] = lines[i].replace(/\)\)\s*$/, '))');
    const ind = '        ';
    const routes = [
      ind + '// Storefronts (townhall_verification_complete)',
      ind + '.route("/api/storefront/search", web::get().to(townhall_verification_complete::api_search_storefronts))',
      ind + '.route("/api/storefront/{pubkey}", web::get().to(townhall_verification_complete::api_get_storefront))',
      ind + '.route("/api/storefront/{pubkey}/visit", web::post().to(townhall_verification_complete::api_record_visit))',
      ind + '.route("/api/storefront/{pubkey}/stats", web::get().to(townhall_verification_complete::api_get_storefront_stats))',
      ind + '.route("/api/storefront/{pubkey}/products", web::get().to(townhall_verification_complete::api_get_products))',
      ind + '.route("/api/storefront", web::post().to(townhall_verification_complete::api_save_storefront))',
    ];
    lines.splice(i + 1, 0, ...routes);
    console.log('Wired 6 storefront routes after L' + (i+1));
    break;
  }
}

fs.writeFileSync(f, lines.join('\r\n'));
