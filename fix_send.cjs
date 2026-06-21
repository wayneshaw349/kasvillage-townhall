const fs = require('fs');
const f = 'townhallscreen.tsx';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);

// Find the payload construction in handleSendVerification
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("const payload: any = {") && lines[i+1]?.includes("type: sendType")) {
    // Find end of payload block
    let end = i;
    for (let j = i; j < i + 15; j++) {
      if (lines[j].includes("payload.codebase_url")) { end = j; break; }
      if (lines[j].includes("payload.stats")) { end = j; break; }
    }
    // Find the closing of the if/else block after payload
    for (let j = end; j < end + 10; j++) {
      if (lines[j].trim() === '}') { end = j; break; }
    }
    
    // Replace entire payload section
    const newPayload = `      let payload: any;
      
      if (sendType === 'dapp') {
        payload = {
          owner_pubkey: myPubkey || '',
          apt_number: myApt || '',
          dapp_name: sendName,
          dapp_code: '', // Code fetched by TownHall from URL
          dapp_url: sendCodeUrl,
          category: 'UtilityTool',
          xp_commitment: 500,
          trait_count: traitCount,
          signature: 'self-attest',
          device_attestation: 'pending',
        };
      } else if (sendType === 'store') {
        payload = {
          owner_pubkey: myPubkey || '',
          apt_number: myApt || '',
          name: sendName,
          description: sendDescription,
          signature: 'self-attest',
        };
      } else {
        // Stats verification
        payload = {
          owner_pubkey: myPubkey || '',
          apt_number: myApt || '',
          stats: myStats || { xp: 0, successes: 0, deadlocks: 0, total_transactions: 0, created_at: 0, last_active_at: Date.now() },
          stats_signature: 'self-attest',
          device_attestation: 'pending',
        };
      }`;
    
    lines.splice(i, end - i + 1, ...newPayload.split('\n'));
    console.log('Fixed payload field names');
    break;
  }
}

fs.writeFileSync(f, lines.join('\r\n'));
console.log('Done');
