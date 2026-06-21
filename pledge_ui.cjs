const fs = require('fs');

// === 1. Replace Step 2 "XP Commitment" with KAS Pledge in Workspace.tsx ===
console.log('=== Workspace pledge UI ===');
const wf = 'Workspace.tsx';
let wl = fs.readFileSync(wf, 'utf8').split(/\r?\n/);

// Find step === 2 and replace the content
for (let i = 0; i < wl.length; i++) {
  if (wl[i].includes("step === 2") && wl[i].includes("&&")) {
    // Find the end of this step block (next {step === 3)
    let depth = 0, end = i;
    let started = false;
    for (let j = i; j < wl.length; j++) {
      if (wl[j].includes('step === 3')) { end = j - 2; break; }
    }
    
    const newStep2 = `            {step === 2 && (
              <View style={qgStyles.stepContent}>
                <Text style={qgStyles.stepTitle}>KAS Pledge</Text>
                <Text style={qgStyles.stepSubtitle}>
                  Hold KAS in your wallet for the pledge duration. If balance drops below pledge, your DApp becomes invisible.
                </Text>
                
                {/* Pledge Amount */}
                <View style={qgStyles.xpBox}>
                  <Text style={qgStyles.xpLabel}>Pledge Amount (KAS)</Text>
                  <Text style={qgStyles.xpValue}>{manifest.pledgeKas || 100} KAS</Text>
                  <View style={qgStyles.xpButtons}>
                    {[100, 500, 1000, 5000].map(val => (
                      <TouchableOpacity
                        key={val}
                        style={[
                          qgStyles.xpBtn,
                          (manifest.pledgeKas || 100) === val && qgStyles.xpBtnActive
                        ]}
                        onPress={() => setManifest({ ...manifest, pledgeKas: val })}
                      >
                        <Text style={[
                          qgStyles.xpBtnText,
                          (manifest.pledgeKas || 100) === val && qgStyles.xpBtnTextActive
                        ]}>
                          {val >= 1000 ? val/1000 + 'K' : val}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                
                {/* Duration */}
                <View style={qgStyles.xpBox}>
                  <Text style={qgStyles.xpLabel}>Pledge Duration</Text>
                  <View style={qgStyles.xpButtons}>
                    {[
                      { days: 30, label: '30d' },
                      { days: 90, label: '90d' },
                      { days: 180, label: '6mo' },
                      { days: 365, label: '1yr' },
                    ].map(d => (
                      <TouchableOpacity
                        key={d.days}
                        style={[
                          qgStyles.xpBtn,
                          (manifest.pledgeDays || 90) === d.days && qgStyles.xpBtnActive
                        ]}
                        onPress={() => setManifest({ ...manifest, pledgeDays: d.days })}
                      >
                        <Text style={[
                          qgStyles.xpBtnText,
                          (manifest.pledgeDays || 90) === d.days && qgStyles.xpBtnTextActive
                        ]}>
                          {d.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                
                {/* Board Preview */}
                <View style={[qgStyles.boardPreview, { borderColor: board.color }]}>
                  <Text style={[qgStyles.boardName, { color: board.color }]}>
                    {(manifest.pledgeKas || 100) >= 2000 ? '🏆 Elite' :
                     (manifest.pledgeKas || 100) >= 500 ? '📋 Main' : '🧪 Incubator'}
                  </Text>
                  <Text style={qgStyles.boardDesc}>
                    {(manifest.pledgeKas || 100) >= 2000 ? 'Premium placement, highest visibility' :
                     (manifest.pledgeKas || 100) >= 500 ? 'Verified apps, good visibility' :
                     'Testing/beta apps, limited visibility'}
                  </Text>
                  <Text style={[qgStyles.boardDesc, { marginTop: 4, fontStyle: 'italic' }]}>
                    Pledge: {manifest.pledgeKas || 100} KAS for {manifest.pledgeDays || 90} days
                  </Text>
                </View>
                
                <View style={qgStyles.buttonRow}>
                  <TouchableOpacity style={qgStyles.backBtn} onPress={() => setStep(1)}>
                    <Text style={qgStyles.backBtnText}>← Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={qgStyles.stakeBtn}
                    onPress={async () => {
                      try {
                        const pledgeKas = manifest.pledgeKas || 100;
                        const pledgeDays = manifest.pledgeDays || 90;
                        const pledgeSompi = pledgeKas * 100000000;
                        const durationDaa = pledgeDays * 86400;
                        const pubkey = await SecureStore.getItemAsync('kv_public_key');
                        const address = await SecureStore.getItemAsync('kv_address');
                        
                        // Get current DAA from Kaspa API
                        let startDaa = Math.floor(Date.now() / 1000); // fallback
                        try {
                          const daaResp = await fetch('https://api-tn.kaspa.org/info/virtual-chain-blue-score');
                          const daaData = await daaResp.json();
                          if (daaData.blueScore) startDaa = daaData.blueScore;
                        } catch {}
                        
                        // Inscribe pledge on Arweave via Irys
                        if (typeof uploadToIrys === 'function') {
                          await uploadToIrys(JSON.stringify({
                            type: 'KV_DAPP_PLEDGE_V1',
                            pledgeSompi,
                            durationDaa,
                            startDaa,
                            dappName: manifest.name,
                          }), [
                            { name: 'App-Name', value: 'KasVillage' },
                            { name: 'Type', value: 'KV_DAPP_PLEDGE_V1' },
                            { name: 'Pubkey-Hash', value: hashPubkey(pubkey || '') },
                            { name: 'Owner-Pubkey', value: pubkey || '' },
                            { name: 'KV-Pledge-Sompi', value: pledgeSompi.toString() },
                            { name: 'KV-Pledge-Start-DAA', value: startDaa.toString() },
                            { name: 'KV-Pledge-Duration-DAA', value: durationDaa.toString() },
                            { name: 'KV-Pledge-Address', value: address || '' },
                            { name: 'KV-DAppName', value: manifest.name },
                          ]);
                        }
                        
                        Alert.alert('Pledge Inscribed', pledgeKas + ' KAS pledged for ' + pledgeDays + ' days. Your wallet balance will be monitored.');
                        setStep(3);
                      } catch (err) {
                        Alert.alert('Pledge Failed', String(err));
                      }
                    }}
                  >
                    <Text style={qgStyles.stakeBtnText}>Pledge & Publish</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}`;
    
    // Replace from step 2 start to step 2 end
    wl.splice(i, end - i + 1, ...newStep2.split('\n'));
    console.log('  Replaced Step 2 (XP → KAS Pledge)');
    break;
  }
}

// Fix step 1 button text
for (let i = 0; i < wl.length; i++) {
  if (wl[i].includes('Continue to XP Stake')) {
    wl[i] = wl[i].replace('Continue to XP Stake', 'Continue to KAS Pledge');
    console.log('  Fixed step 1 button text');
    break;
  }
}

// Fix step 3 "XP locked" alert
for (let i = 0; i < wl.length; i++) {
  if (wl[i].includes('XP Committed') && wl[i].includes('XP locked')) {
    // This alert is now inside our new step 2, should be gone. Check if it persists.
    break;
  }
}

fs.writeFileSync(wf, wl.join('\r\n'));
console.log('  Workspace done');

console.log('Done');
