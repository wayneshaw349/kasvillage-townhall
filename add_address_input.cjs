const fs = require('fs');
const f = 'TownHallScreen.tsx';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);

// 1. Add sendAddress state after sendDescription
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("const [sendDescription, setSendDescription] = useState('')")) {
    if (!lines[i+1]?.includes('sendAddress')) {
      lines.splice(i + 1, 0, "  const [sendAddress, setSendAddress] = useState('');");
      console.log('Added sendAddress state');
    }
    break;
  }
}

// 2. Pre-fill sendAddress when modal opens
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("onPress={() => setShowSendModal(true)}")) {
    lines[i] = lines[i].replace(
      "onPress={() => setShowSendModal(true)}",
      "onPress={() => { setSendAddress(myAddress || ''); setShowSendModal(true); }}"
    );
    console.log('Pre-fill sendAddress on modal open');
    break;
  }
}

// 3. Add address input field in modal — after stats preview, before description
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("sendType === 'stats' && myStats && (")) {
    // Find the closing of this stats preview block
    let depth = 0, end = i;
    for (let j = i; j < i + 20; j++) {
      if (lines[j].includes('</View>') && lines[j].trim() === '</View>') {
        // Check if it's the right closing
        let opens = 0, closes = 0;
        for (let k = i; k <= j; k++) {
          opens += (lines[k].match(/<View/g) || []).length;
          closes += (lines[k].match(/<\/View>/g) || []).length;
        }
        if (opens === closes) { end = j; break; }
      }
    }
    
    const addressInput = `
            {/* Kaspa Address for L1 queries */}
            {sendType === 'stats' && (
              <>
                <Text style={styles.inputLabel}>Kaspa Address (for L1 proof)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={sendAddress}
                  onChangeText={setSendAddress}
                  placeholder="kaspa:qr0n..."
                  placeholderTextColor={COLORS.stone400}
                  autoCapitalize="none"
                />
                <Text style={styles.inputHint}>
                  Your on-chain address — needed to verify L1 transaction history
                </Text>
              </>
            )}`;
    lines.splice(end + 2, 0, ...addressInput.split('\n'));
    console.log('Added address input field in stats modal');
    break;
  }
}

// 4. Use sendAddress in the proof fetch URL
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('/api/counterparty/') && lines[i].includes('include_proof=true')) {
    lines[i] = lines[i].replace(
      /address=\$\{encodeURIComponent\(myAddress \|\| ""\)\}/,
      'address=${encodeURIComponent(sendAddress || myAddress || "")}'
    );
    console.log('Updated proof URL to use sendAddress');
    break;
  }
}

fs.writeFileSync(f, lines.join('\r\n'));
console.log('Done');
