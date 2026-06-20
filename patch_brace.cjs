const fs = require('fs');
let lines = fs.readFileSync('src/townhall_verification_complete.rs', 'utf8').split('\n');
// Lines 1634-1635 (index 1633-1634) are duplicates - remove them
// Line 1633: "        agreements_last_7d: l1_stats.agreements_last_7d,"
// Line 1634: "    };"
console.log('Before:', lines[1632], '|', lines[1633], '|', lines[1634]);
lines.splice(1633, 2);
console.log('Removed 2 duplicate lines');
fs.writeFileSync('src/townhall_verification_complete.rs', lines.join('\n'));
