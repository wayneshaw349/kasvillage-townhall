const fs = require('fs');
const f = 'src\\main.rs';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
let fixes = 0;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('frost_release_complete') && lines[i].trim().endsWith(';')) {
    // Remove trailing ; so we can chain more routes
    lines[i] = lines[i].replace(/\);\s*$/, ')');
    
    const ind = '        ';
    const newRoutes = [
      ind + '// Counterparty Stats (townhall_verification_complete)',
      ind + '.route("/api/counterparty/batch", web::post().to(townhall_verification_complete::api_get_counterparty_stats_batch))',
      ind + '.route("/api/counterparty/{pubkey}", web::get().to(townhall_verification_complete::api_get_counterparty_stats))',
      ind + '.route("/api/counterparty/{pubkey}/proof", web::get().to(townhall_verification_complete::api_get_counterparty_stats_with_proof))',
      ind + '// Verification',
      ind + '.route("/api/verify/integrity", web::post().to(townhall_verification_complete::api_check_integrity))',
      ind + '// Storefronts',
      ind + '.route("/api/storefront/search", web::get().to(townhall_verification_complete::api_search_storefronts))',
      ind + '.route("/api/storefront/{pubkey}", web::get().to(townhall_verification_complete::api_get_storefront))',
      ind + '.route("/api/storefront/{pubkey}/visit", web::post().to(townhall_verification_complete::api_record_visit))',
      ind + '.route("/api/storefront/{pubkey}/stats", web::get().to(townhall_verification_complete::api_get_storefront_stats))',
      ind + '.route("/api/storefront/{pubkey}/products", web::get().to(townhall_verification_complete::api_get_products))',
      ind + '.route("/api/storefront", web::post().to(townhall_verification_complete::api_save_storefront));',
    ];
    
    lines.splice(i + 1, 0, ...newRoutes);
    fixes++; console.log('Wired routes after L' + (i+1));
    break;
  }
}

if (fixes === 0) console.log('ERROR: Could not find frost_release_complete route');
fs.writeFileSync(f, lines.join('\r\n'));
console.log('Done. Fixes: ' + fixes);
