const fs = require('fs');
const f = 'counterparty_lookup.ts';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
let fixes = 0;

for (let i = 0; i < lines.length; i++) {
  const t = lines[i].trim();

  // Fix URL: replace /user-stats with /api/counterparty/{pubkey}
  if (t === "const url = `${TOWNHALL_API}/user-stats`;") {
    lines[i] = lines[i].replace(
      "const url = `${TOWNHALL_API}/user-stats`;",
      "const url = endpoint\n      ? `${TOWNHALL_API}/api/counterparty/${pubkey}/${endpoint}?${params.toString()}`\n      : `${TOWNHALL_API}/api/counterparty/${pubkey}?${params.toString()}`;"
    );
    fixes++; console.log('L' + (i+1) + ': Fixed URL to /api/counterparty/{pubkey}');
  }

  // Fix method: POST -> GET (and remove body)
  if (t === "const response = await fetch(url, {" && fixes > 0 && fixes < 2) {
    // Check next lines for method: 'POST' and body
    for (let j = i+1; j < i+6; j++) {
      if (lines[j].trim() === "method: 'POST',") {
        lines[j] = lines[j].replace("'POST'", "'GET'");
        fixes++; console.log('L' + (j+1) + ': POST -> GET');
      }
      if (lines[j].trim().startsWith("body: JSON.stringify")) {
        lines[j] = '      // body removed - GET request uses path params';
        fixes++; console.log('L' + (j+1) + ': Removed POST body');
      }
    }
    break;
  }
}

fs.writeFileSync(f, lines.join('\r\n'));
console.log('Fixes: ' + fixes);
