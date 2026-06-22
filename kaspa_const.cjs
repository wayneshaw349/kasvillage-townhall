const fs = require('fs');
const f = 'src\\townhall_verification_complete.rs';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);

// 1. Add KASPA_API constant after MAX_CODE_SIZE_BYTES
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const MAX_CODE_SIZE_BYTES')) {
    if (!lines[i+1]?.includes('KASPA_API')) {
      lines.splice(i + 1, 0,
        '',
        '// Kaspa network API — swap comment to switch mainnet/testnet',
        'const KASPA_API: &str = "https://api-tn10.kaspa.org"; // testnet-10',
        '// const KASPA_API: &str = "https://api.kaspa.org"; // mainnet',
      );
      console.log('Added KASPA_API constant');
    }
    break;
  }
}

// 2. Replace all hardcoded Kaspa URLs
let count = 0;
for (let i = 0; i < lines.length; i++) {
  // Balance endpoint
  if (lines[i].includes('"https://api-tn10.kaspa.org/addresses/{}/') || lines[i].includes('"https://api-tn.kaspa.org/addresses/{}/')) {
    lines[i] = lines[i].replace(/"https:\/\/api-tn10?\.kaspa\.org\/addresses\/\{\}\/([^"]+)"/, '&format!("{}/addresses/{}/{}", KASPA_API, $1)');
    // Actually easier to use format! macro with KASPA_API
    // Let me do a simpler replacement
  }
  
  // Replace full URL patterns
  if (lines[i].includes('https://api-tn10.kaspa.org') || lines[i].includes('https://api-tn.kaspa.org')) {
    lines[i] = lines[i]
      .replace(/https:\/\/api-tn10\.kaspa\.org/g, '{KASPA_API}')
      .replace(/https:\/\/api-tn\.kaspa\.org/g, '{KASPA_API}');
    count++;
  }
}

// 3. Fix the format strings — {KASPA_API} in format! macros needs proper syntax
for (let i = 0; i < lines.length; i++) {
  // Fix: format!("...{KASPA_API}/addresses/{}..." → format!("{}/addresses/{}...", KASPA_API, ...
  if (lines[i].includes('{KASPA_API}') && lines[i].includes('format!')) {
    // Already in a format! macro — {KASPA_API} will work as named arg if we add KASPA_API = KASPA_API
    // Actually simpler: just replace the URL construction
  }
  
  // Fix standalone let url = 
  if (lines[i].includes('{KASPA_API}') && lines[i].includes('let url =')) {
    lines[i] = lines[i].replace(
      /let url = "(\{KASPA_API\})([^"]+)"/,
      'let url = format!("{}{}", KASPA_API, "$2")'
    );
    if (lines[i].includes('let url = format!')) count++;
  }
}

console.log('Replaced ' + count + ' URLs');

// Simpler approach: just do direct string replacements for the known patterns
let content = lines.join('\r\n');

// Pattern 1: format!("https://api-tn10.kaspa.org/addresses/{}/full-transactions?limit=100", pubkey)
content = content.replace(
  /format!\(\s*"https:\/\/api-tn10\.kaspa\.org\/addresses\/\{\}\/full-transactions\?limit=100"/g,
  'format!("{}/addresses/{}/full-transactions?limit=100", KASPA_API'
);

// Pattern 2: "https://api-tn10.kaspa.org/info/virtual-chain-blue-score"
content = content.replace(
  /"https:\/\/api-tn10\.kaspa\.org\/info\/virtual-chain-blue-score"/g,
  '&format!("{}/info/virtual-chain-blue-score", KASPA_API)'
);

// Pattern 3: format!("https://api-tn10.kaspa.org/addresses/{}/balance", address)
content = content.replace(
  /format!\(\s*"https:\/\/api-tn10\.kaspa\.org\/addresses\/\{\}\/balance"/g,
  'format!("{}/addresses/{}/balance", KASPA_API'
);

// Clean up any {KASPA_API} leftovers
content = content.replace(/\{KASPA_API\}/g, '');

fs.writeFileSync(f, content);
console.log('Done');
