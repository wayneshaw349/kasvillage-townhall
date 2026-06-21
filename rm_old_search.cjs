const fs = require('fs');
const f = 'townhallscreen.tsx';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);

// Find "// Call Town Hall API" and remove to "} catch"
let start = -1, end = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('// Call Town Hall API') && start < 0) {
    start = i;
  }
  if (start >= 0 && lines[i].trim() === '} catch (error) {') {
    end = i;
    break;
  }
}

if (start >= 0 && end >= 0) {
  console.log('Removing old search code: lines ' + (start+1) + '-' + (end));
  lines.splice(start, end - start);
  console.log('Removed ' + (end - start) + ' lines');
} else {
  console.log('Not found (start=' + start + ' end=' + end + ')');
}

fs.writeFileSync(f, lines.join('\r\n'));
