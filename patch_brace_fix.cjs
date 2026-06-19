const fs = require('fs');
let c = fs.readFileSync('src/main.rs', 'utf8');
// Fix the double closing brace after Push sent
const bad = 'eprintln!("[Proof] Push sent to {}", &pubkey_clone[..10]);\n        }\n        }\n    });';
const good = 'eprintln!("[Proof] Push sent to {}", &pubkey_clone[..10]);\n        }\n    });';
if (c.includes(bad)) {
  c = c.replace(bad, good);
  console.log('Fixed (LF)');
} else {
  // Try CRLF
  const badCR = bad.replace(/\n/g, '\r\n');
  const goodCR = good.replace(/\n/g, '\r\n');
  if (c.includes(badCR)) { c = c.replace(badCR, goodCR); console.log('Fixed (CRLF)'); }
  else {
    // Brute: replace the specific sequence
    c = c.replace(/Push sent to \{\}", &pubkey_clone\[\.\.10\]\);(\s*)\}(\s*)\}(\s*)\}\);/,
      'Push sent to {}", &pubkey_clone[..10]);$1}$3});');
    console.log('Fixed (regex)');
  }
}
fs.writeFileSync('src/main.rs', c);
