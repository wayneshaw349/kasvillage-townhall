const fs = require('fs');
const f = 'TownHallScreen.tsx';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);

// Find where stats proof is saved to SecureStore and add Arweave inscription after
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("kv_last_stats_proof") && lines[i].includes("SecureStore")) {
    // Find the closing } of this if block
    let end = i;
    for (let j = i; j < i + 5; j++) {
      if (lines[j].trim() === '}') { end = j; break; }
    }
    
    const inscription = [
      '        // Inscribe stats proof to Arweave',
      '        if (data.proof && myPubkey) {',
      '          try {',
      "            const { uploadToIrys: statsUpload } = await import('./arweave_upload');",
      '            const proofPayload = JSON.stringify({',
      "              v: 1,",
      "              type: 'stats-proof',",
      '              pubkey: myPubkey,',
      '              apt: myApt,',
      '              stats: data.stats,',
      '              proof: data.proof,',
      '              timestamp: Date.now(),',
      '            });',
      '            const tags = [',
      "              { name: 'App-Name', value: 'KasVillage' },",
      "              { name: 'KV-Type', value: 'stats-proof' },",
      "              { name: 'KV-Pubkey', value: myPubkey },",
      "              { name: 'KV-ProofType', value: data.proof.proof_type || 'Halo2-IPA-Stats-Mock-V2' },",
      "              { name: 'KV-Successes', value: String(data.stats?.successes || 0) },",
      "              { name: 'KV-Deadlocks', value: String(data.stats?.deadlocks || 0) },",
      "              { name: 'KV-XP', value: String(data.stats?.xp || 0) },",
      "              { name: 'Content-Type', value: 'application/json' },",
      '            ];',
      '            const result = await statsUpload(proofPayload, tags);',
      "            const txId = result?.txId || result?.id || '';",
      "            if (txId) {",
      "              await SecureStore.setItemAsync('kv_stats_proof_tx', txId);",
      "              console.log('[TownHall] Stats proof inscribed:', txId);",
      '            }',
      '          } catch (e) {',
      "            console.warn('[TownHall] Stats proof inscription failed:', e);",
      '          }',
      '        }',
    ];
    
    lines.splice(end + 1, 0, ...inscription);
    console.log('Added Arweave inscription for stats proof');
    break;
  }
}

fs.writeFileSync(f, lines.join('\r\n'));
console.log('Done');
