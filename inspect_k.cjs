const fs = require('fs');
let c = fs.readFileSync('src/main.rs', 'utf8');

// 1. Check the constant situation around lines 87-92
const lines = c.split(/\r?\n/);
console.log('L87:', lines[86]);
console.log('L88:', lines[87]);
console.log('L89:', lines[88]);
console.log('L90:', lines[89]);
console.log('L91:', lines[90]);
console.log('L92:', lines[91]);
console.log('L93:', lines[92]);
