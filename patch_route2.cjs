const fs = require('fs');
let c = fs.readFileSync('src/main.rs', 'utf8');
const anchor = '.route("/verify-identity", web::post().to(stateless_verify_identity))';
if (c.includes(anchor) && !c.includes('proof-status')) {
  c = c.replace(anchor, anchor + '\n        .route("/proof-status/{id}", web::get().to(get_proof_status))');
  fs.writeFileSync('src/main.rs', c);
  console.log('Route added');
} else if (c.includes('proof-status')) {
  console.log('Already registered');
} else {
  console.log('Anchor not found');
}
