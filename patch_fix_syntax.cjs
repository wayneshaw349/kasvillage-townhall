const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');

// Fix: the setStep line has };, but needs }}, to close the onPress + alert option
const bad = "setStep(entry.step);},\r\n                            ]);";
const good = "setStep(entry.step);\r\n                              }},\r\n                            ]);";

if (s.includes(bad)) {
  s = s.replace(bad, good);
  fs.writeFileSync(f, s);
  console.log('Fixed syntax');
} else {
  // Try LF version
  const badLF = "setStep(entry.step);},\n                            ]);";
  const goodLF = "setStep(entry.step);\n                              }},\n                            ]);";
  if (s.includes(badLF)) {
    s = s.replace(badLF, goodLF);
    fs.writeFileSync(f, s);
    console.log('Fixed syntax (LF)');
  } else {
    console.log('Pattern not found - checking context');
    const idx = s.indexOf('setStep(entry.step)');
    if (idx > 0) {
      console.log('Context:', JSON.stringify(s.slice(idx, idx + 80)));
    }
  }
}
