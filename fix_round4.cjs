const fs = require('fs');
const f = 'C:\\Users\\wayne\\Downloads\\townhall_verification_complete.rs';
let text = fs.readFileSync(f, 'utf8');
const before = text;

// Global regex replacements for all _ms -> _daa field mismatches
const subs = [
  [/\.total_completion_time_ms\b/g, '.total_completion_daa'],
  [/\.fastest_completion_ms\b/g, '.fastest_completion_daa'],
  [/\.agreements_last_30d\b(?!_daa)/g, '.agreements_last_30d_daa'],
  [/\.agreements_last_7d\b(?!_daa)/g, '.agreements_last_7d_daa'],
  [/\.last_deadlock_ms\b(?!_daa)/g, '.last_deadlock_daa'],
];

let total = 0;
for (const [re, rep] of subs) {
  const matches = text.match(re);
  if (matches) {
    total += matches.length;
    console.log(matches.length + 'x ' + re.source + ' -> ' + rep);
  }
  text = text.replace(re, rep);
}

fs.writeFileSync(f, text);
console.log('Total replacements: ' + total);
