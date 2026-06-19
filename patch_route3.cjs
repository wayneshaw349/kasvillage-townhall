const fs = require('fs');
let c = fs.readFileSync('src/main.rs', 'utf8');
const route = '.route("/proof-status/{id}", web::get().to(get_proof_status))';
if (!c.includes(route)) {
  const anchor = '.route("/verify-identity", web::post().to(stateless_verify_identity))';
  const idx = c.indexOf(anchor);
  if (idx > -1) {
    const lineEnd = c.indexOf('\n', idx);
    c = c.slice(0, lineEnd) + '\n        ' + route + c.slice(lineEnd);
    fs.writeFileSync('src/main.rs', c);
    console.log('Route ACTUALLY added');
  }
} else {
  console.log('Route already there for real');
}
