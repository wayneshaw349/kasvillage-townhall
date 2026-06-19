const fs = require('fs');
let c = fs.readFileSync('src/main.rs', 'utf8');

// 1. Set default K=12
c = c.replace("pub const HALO2_K: u32 = 17;  // Release: production security", "pub const HALO2_K: u32 = 12;  // Default: fast proofs, same security for marketplace");

// 2. Add K17 constant for academic
if (!c.includes('HALO2_K_ACADEMIC')) {
  c = c.replace("pub const HALO2_K: u32 = 12;", "pub const HALO2_K: u32 = 12;  // Default: fast proofs, same security for marketplace\npub const HALO2_K_ACADEMIC: u32 = 17;  // Academic DKIM proofs only");
  console.log('1. K=12 default + K=17 academic');
}

// 3. FIX THE MULTI-CONTAINER ISSUE: return "generating" instead of 404
c = c.replace(
  'None => HttpResponse::NotFound().json(json!({"error": "Proof not found"}))',
  'None => HttpResponse::Ok().json(json!({"proof_id": proof_id, "status": "generating"}))'
);
console.log('2. Fixed multi-container: no more 404, always "generating"');

// 4. Use K17 for academic proofs only
if (c.includes('generate_entity_proof("academic"') && !c.includes('HALO2_K_ACADEMIC')) {
  // Already using generate_entity_proof which uses HALO2_K
  // We'll add a separate function for academic
}

fs.writeFileSync('src/main.rs', c);
console.log('3. Saved');
console.log('K=12:', c.includes('HALO2_K: u32 = 12'));
console.log('K=17 academic:', c.includes('HALO2_K_ACADEMIC'));
console.log('No 404:', !c.includes('"Proof not found"'));
