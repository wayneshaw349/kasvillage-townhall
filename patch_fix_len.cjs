const fs = require('fs');
let c = fs.readFileSync('src/townhall_verification_complete.rs', 'utf8');
c = c.replaceAll(".len() as u64.len() as u64", ".len() as u64");
console.log('Fixed doubled .len()');
fs.writeFileSync('src/townhall_verification_complete.rs', c);
