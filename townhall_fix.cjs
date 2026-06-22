const fs = require('fs');
const f = 'townhallscreen.tsx';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
let fixes = 0;

// Find the sendEndpoint + fetch section in handleSendVerification
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("const sendEndpoint = sendType === 'dapp'") && lines[i].includes("'/api/verify/dapp'")) {
    // Find the fetch call (within next 5 lines)
    let fetchLine = -1;
    for (let j = i; j < i + 5; j++) {
      if (lines[j].includes('const response = await fetch(') || lines[j].includes('const response = await fetch(`')) {
        fetchLine = j;
        break;
      }
    }
    if (fetchLine < 0) continue;
    
    // Find end of the fetch call (closing });)
    let fetchEnd = fetchLine;
    let depth = 0;
    for (let j = fetchLine; j < fetchLine + 10; j++) {
      for (const ch of lines[j]) { if (ch==='{') depth++; if (ch==='}') depth--; }
      // Look for the line with just });
      if (lines[j].trim() === '});') { fetchEnd = j; break; }
    }
    
    // Replace from sendEndpoint line through fetch end
    const replacement = [
      '      let response;',
      "      if (sendType === 'stats') {",
      '        // SNARK proof via counterparty endpoint',
      '        response = await fetch(`${TOWNHALL_BASE}/api/counterparty/${myPubkey}/proof?include_proof=true`);',
      '      } else {',
      "        const sendEndpoint = sendType === 'dapp' ? '/api/verify/dapp' : '/api/verify/store';",
      '        response = await fetch(`${TOWNHALL_BASE}${sendEndpoint}`, {',
      "          method: 'POST',",
      "          headers: { 'Content-Type': 'application/json' },",
      '          body: JSON.stringify(payload),',
      '        });',
      '      }',
    ];
    
    lines.splice(i, fetchEnd - i + 1, ...replacement);
    fixes++; console.log('Replaced sendEndpoint + fetch with stats proof routing');
    break;
  }
}

// Fix success check to handle proof response format
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('if (data.ok)') && i > 0) {
    // Check we're in handleSendVerification (look back for isSending)
    let inSend = false;
    for (let j = i-1; j > i-20 && j >= 0; j--) {
      if (lines[j].includes('setIsSending') || lines[j].includes('handleSendVerification')) { inSend = true; break; }
    }
    if (inSend) {
      lines[i] = lines[i].replace('if (data.ok)', 'if (data.ok || data.found || data.proof)');
      fixes++; console.log('Updated success check for proof response');
      break;
    }
  }
}

fs.writeFileSync(f, lines.join('\r\n'));
console.log('Fixes: ' + fixes);
