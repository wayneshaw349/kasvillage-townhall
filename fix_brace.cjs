const fs = require('fs');
const f = 'C:\\Users\\wayne\\Downloads\\townhall_verification_complete.rs';
const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
// Line 1635 (0-indexed: 1634) is the stray `};`
if (lines[1634].trim() === '};') {
  lines.splice(1634, 1);
  fs.writeFileSync(f, lines.join('\r\n'));
  console.log('Removed stray }; at line 1635. Total lines now:', lines.length);
} else {
  console.log('Line 1635 is not "};", found:', lines[1634].trim());
}
