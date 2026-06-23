const fs = require('fs');
const f = 'TownHallScreen.tsx';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);

// 1. Fix the success handler for stats — show proof data in alert
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("if (data.ok || data.found || data.proof)")) {
    // Find the Alert.alert inside this block (first occurrence after this line)
    for (let j = i; j < i + 30; j++) {
      if (lines[j].includes("Alert.alert(") && lines[j].includes("Submitted!")) {
        // Replace the alert with proof-aware version
        let alertEnd = j;
        for (let k = j; k < j + 10; k++) {
          if (lines[k].includes("[{ text: 'OK' }]")) { alertEnd = k; break; }
        }
        
        const newAlert = [
          "        // Show proof result",
          "        const proofType = data.proof?.proof_type || data.proof_type || 'pending';",
          "        const proofHash = data.proof?.proof_bytes ? data.proof.proof_bytes.slice(0, 8).join('') : (data.proof_hash || '');",
          "        const statsInfo = data.stats ? `XP: ${data.stats.xp || 0} | Trust: ${((data.stats.p_complete || 0.5) * 100).toFixed(1)}%` : '';",
          "        Alert.alert(",
          "          data.proof ? '🔒 SNARK Proof Generated!' : '✅ Submitted!',",
          "          data.proof",
          "            ? `Proof Type: ${proofType}\\n${statsInfo}\\nProof: ${proofHash}...`",
          "            : `Your ${sendType} has been submitted for verification.`,",
          "          [{ text: 'OK' }]",
          "        );",
        ];
        
        lines.splice(j, alertEnd - j + 1, ...newAlert);
        console.log('Updated success alert with proof display');
        break;
      }
    }
    break;
  }
}

// 2. Save proof to SecureStore for "Receive Proofs" to find
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("const updatedEvents = [newEvent, ...verificationEvents]")) {
    // Add proof saving before event storage
    lines.splice(i, 0,
      "        // Save proof for later retrieval",
      "        if (data.proof) {",
      "          await SecureStore.setItemAsync('kv_last_stats_proof', JSON.stringify(data.proof));",
      "          await SecureStore.setItemAsync('kv_last_stats', JSON.stringify(data.stats));",
      "        }",
    );
    console.log('Added proof saving to SecureStore');
    break;
  }
}

fs.writeFileSync(f, lines.join('\r\n'));
console.log('Done');
