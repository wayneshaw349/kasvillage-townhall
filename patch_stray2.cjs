const fs = require('fs');
let c = fs.readFileSync('townhallscreen.tsx', 'utf8');
// Fix: "});¶        }" ? "}¶        }"
const bad = "setSearchResult({ found: false, error: 'No verification proof on Arweave for APT-' + aptNum });\r\n                });";
const good = "setSearchResult({ found: false, error: 'No verification proof on Arweave for APT-' + aptNum });\r\n                }";
if (c.includes(bad)) { c = c.replace(bad, good); console.log('Fixed CRLF'); }
else {
  c = c.replace("});\n                });", "});\n                }");
  console.log('Fixed LF');
}
fs.writeFileSync('townhallscreen.tsx', c);
