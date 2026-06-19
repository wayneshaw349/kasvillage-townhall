const fs = require('fs');
let c = fs.readFileSync('src/main.rs', 'utf8');
// Find the exact route text
const idx = c.indexOf('.route("/verify-identity"');
if (idx > -1) {
  const lineEnd = c.indexOf('\n', idx);
  const line = c.substring(idx, lineEnd);
  console.log('Found:', line.trim());
  if (!c.includes('proof-status')) {
    c = c.slice(0, lineEnd) + '\n        .route("/proof-status/{id}", web::get().to(get_proof_status))' + c.slice(lineEnd);
    fs.writeFileSync('src/main.rs', c);
    console.log('Route added');
  }
} else {
  console.log('verify-identity route not found');
}
