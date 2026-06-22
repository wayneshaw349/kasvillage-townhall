const fs = require('fs');
const f = 'townhallscreen.tsx';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);

// Find sendEndpoint mapping and change stats to use counterparty proof
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("sendEndpoint") && lines[i].includes("sendType === 'dapp'")) {
    // Replace the whole endpoint selection + fetch
    // Find the fetch call after this
    for (let j = i; j < i + 10; j++) {
      if (lines[j].includes("const response = await fetch")) {
        // Replace the endpoint line and fetch call
        lines[i] = `      const sendEndpoint = sendType === 'dapp' ? '/api/verify/dapp'
        : sendType === 'store' ? '/api/verify/store'
        : null; // Stats uses GET counterparty proof`;
        
        // Replace the fetch block for stats
        const newFetch = `      let response;
      if (sendType === 'stats') {
        // Use counterparty SNARK proof endpoint (GET)
        response = await fetch(\`\${TOWNHALL_BASE}/api/counterparty/\${myPubkey}/proof?include_proof=true\`);
      } else {
        response = await fetch(\`\${TOWNHALL_BASE}\${sendEndpoint}\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }`;
        lines.splice(j, 4, ...newFetch.split('\n'));
        console.log('Rewired stats to /api/counterparty/{pubkey}/proof');
        break;
      }
    }
    break;
  }
}

// Also update the success handler to handle the proof response format
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("if (data.ok)") && i > 0) {
    // Check we're in handleSendVerification
    let inSend = false;
    for (let j = i-1; j > i-30 && j >= 0; j--) {
      if (lines[j].includes('handleSendVerification')) { inSend = true; break; }
    }
    if (inSend) {
      // Replace with broader success check
      lines[i] = lines[i].replace('if (data.ok)', 'if (data.ok || data.found || data.proof)');
      console.log('Updated success check for proof response');
      break;
    }
  }
}

fs.writeFileSync(f, lines.join('\r\n'));
console.log('Done');
