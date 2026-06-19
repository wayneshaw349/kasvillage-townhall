const fs = require('fs');
let c = fs.readFileSync('townhallscreen.tsx', 'utf8');
// In handleVerify, accept both data.ok and data.success
c = c.replace(
  "const data = await response.json();\n      \n      if (data.ok) {\n        setIsVerified(true);",
  "const data = await response.json();\n      \n      if (data.ok || data.success) {\n        setIsVerified(true);"
);
// fallback simpler pattern if formatting differs
if (!c.includes('data.ok || data.success')) {
  c = c.replace(/if \(data\.ok\) \{(\s*)setIsVerified\(true\);/, 'if (data.ok || data.success) {$1setIsVerified(true);');
}
fs.writeFileSync('townhallscreen.tsx', c);
console.log(c.includes('data.ok || data.success') ? 'OK: success check fixed' : 'ERROR: pattern not found');
