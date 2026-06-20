const fs = require('fs');
const lines = fs.readFileSync('C:\\Users\\wayne\\Downloads\\townhall_verification_complete.rs','utf8').split(/\r?\n/);
let depth = 0;
for (let i = 1527; i < 1636; i++) {
  let prev = depth;
  for (const ch of lines[i]) {
    if (ch === '{') depth++;
    if (ch === '}') depth--;
  }
  if (depth !== prev) console.log('L' + (i+1) + ' d:' + prev + '->' + depth + ' | ' + lines[i].trim().substring(0,90));
}
