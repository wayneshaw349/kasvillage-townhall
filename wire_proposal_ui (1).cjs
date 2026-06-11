const fs = require("fs");
let s = fs.readFileSync("QRPayNearby.tsx", "utf8");
let fixes = 0;

// 1. Add proposal_share import
if (!s.includes('proposal_share')) {
  s = s.replace(
    "import { useBluetoothPay } from './bluetooth_p2p';",
    "import { useBluetoothPay } from './bluetooth_p2p';\nimport { createProposal, decodeProposal, verifyProposal, acceptProposal, shareProposal, shareAcceptance } from './proposal_share';"
  );
  fixes++;
  console.log("  → proposal_share import added");
}

// 2. Add proposal modes to type
s = s.replace(
  "type Mode = 'choose' | 'ble_send' | 'ble_receive';",
  "type Mode = 'choose' | 'ble_send' | 'ble_receive' | 'send_proposal' | 'receive_proposal';"
);
fixes++;
console.log("  → proposal modes added");

// 3. Add proposal state vars after selectedPeer state
s = s.replace(
  "const [selectedPeer, setSelectedPeer] = useState<any>(null);",
  `const [selectedPeer, setSelectedPeer] = useState<any>(null);
  const [proposalAmount, setProposalAmount] = useState('');
  const [proposalDesc, setProposalDesc] = useState('');
  const [proposalSending, setProposalSending] = useState(false);
  const [incomingText, setIncomingText] = useState('');
  const [incomingProposal, setIncomingProposal] = useState<any>(null);
  const [proposalVerified, setProposalVerified] = useState(false);`
);
fixes++;
console.log("  → proposal state vars added");

// 4. Add proposal buttons to choose screen (before BLE section)
const bleSection = `{/* Bluetooth Option */}`;
const proposalButtons = `{/* Text/DM Proposal */}
            <TouchableOpacity style={styles.modeCard} onPress={() => setMode('send_proposal')}>
              <Text style={styles.modeIcon}>📤</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.modeCardTitle}>Send Proposal</Text>
                <Text style={styles.modeCardSub}>Create signed proposal — share via text or DM</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modeCard} onPress={() => setMode('receive_proposal')}>
              <Text style={styles.modeIcon}>📥</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.modeCardTitle}>Receive Proposal</Text>
                <Text style={styles.modeCardSub}>Paste a proposal to verify and accept</Text>
              </View>
            </TouchableOpacity>

            {/* Bluetooth Option */}`;

s = s.replace(bleSection, proposalButtons);
fixes++;
console.log("  → proposal buttons added to choose screen");

// 5. Add Send Proposal and Receive Proposal render blocks before BLE RECEIVE
const beforeBLE = `{/* BLE RECEIVE */}`;
const proposalScreens = `{/* SEND PROPOSAL */}
        {mode === 'send_proposal' && (
          <View>
            <TouchableOpacity onPress={() => setMode('choose')} style={{ marginBottom: rs(12) }}>
              <Text style={{ color: '#F59E0B', fontSize: rs(14) }}>← Back</Text>
            </TouchableOpacity>
            <Text style={{ color: '#FFF', fontSize: rs(18), fontWeight: '700', marginBottom: rs(16) }}>Create Signed Proposal</Text>

            <View style={{ backgroundColor: '#1A1A2E', borderRadius: rs(16), padding: rs(16), borderWidth: 1, borderColor: '#333' }}>
              <Text style={{ color: '#888', fontSize: rs(12), marginBottom: rs(6) }}>Amount (KAS)</Text>
              <TextInput
                style={{ backgroundColor: '#0A0A14', borderRadius: rs(10), padding: rs(14), color: '#FFF', fontSize: rs(20), fontWeight: '700', textAlign: 'center', borderWidth: 1, borderColor: '#333', marginBottom: rs(12) }}
                placeholder="0.00"
                placeholderTextColor="#555"
                value={proposalAmount}
                onChangeText={setProposalAmount}
                keyboardType="decimal-pad"
              />
              <Text style={{ color: '#888', fontSize: rs(12), marginBottom: rs(6) }}>What for?</Text>
              <TextInput
                style={{ backgroundColor: '#0A0A14', borderRadius: rs(10), padding: rs(14), color: '#FFF', fontSize: rs(14), borderWidth: 1, borderColor: '#333', marginBottom: rs(12) }}
                placeholder="Coffee, goods, services..."
                placeholderTextColor="#555"
                value={proposalDesc}
                onChangeText={setProposalDesc}
              />
              <TouchableOpacity
                style={{ backgroundColor: proposalAmount && !proposalSending ? '#F59E0B' : '#333', borderRadius: rs(12), padding: rs(16), alignItems: 'center' }}
                onPress={async () => {
                  const n = parseFloat(proposalAmount);
                  if (isNaN(n) || n <= 0) { Alert.alert('Error', 'Enter a valid amount'); return; }
                  setProposalSending(true);
                  const result = await createProposal('pay', n, proposalDesc || 'KAS payment');
                  setProposalSending(false);
                  if ('error' in result) { Alert.alert('Error', result.error); return; }
                  await shareProposal(result.encoded, n);
                  setProposalAmount('');
                  setProposalDesc('');
                  setMode('choose');
                }}
                disabled={!proposalAmount || proposalSending}
              >
                <Text style={{ color: proposalAmount ? '#000' : '#666', fontSize: rs(16), fontWeight: '700' }}>
                  {proposalSending ? 'Signing...' : '📤 Sign & Share Proposal'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ backgroundColor: '#0D2818', borderRadius: rs(12), padding: rs(12), marginTop: rs(12), borderWidth: 1, borderColor: '#10B981' }}>
              <Text style={{ color: '#10B981', fontSize: rs(11) }}>
                ✓ Signed with your ephemeral key{'\n'}
                ✓ Balance verified before sharing{'\n'}
                ✓ Expires in 24 hours{'\n'}
                ✓ No private keys in the message
              </Text>
            </View>
          </View>
        )}

        {/* RECEIVE PROPOSAL */}
        {mode === 'receive_proposal' && (
          <View>
            <TouchableOpacity onPress={() => { setMode('choose'); setIncomingProposal(null); setIncomingText(''); setProposalVerified(false); }} style={{ marginBottom: rs(12) }}>
              <Text style={{ color: '#F59E0B', fontSize: rs(14) }}>← Back</Text>
            </TouchableOpacity>
            <Text style={{ color: '#FFF', fontSize: rs(18), fontWeight: '700', marginBottom: rs(16) }}>Verify Proposal</Text>

            <View style={{ backgroundColor: '#1A1A2E', borderRadius: rs(16), padding: rs(16), borderWidth: 1, borderColor: '#333' }}>
              <Text style={{ color: '#888', fontSize: rs(12), marginBottom: rs(6) }}>Paste the proposal text (starts with kv1:)</Text>
              <TextInput
                style={{ backgroundColor: '#0A0A14', borderRadius: rs(10), padding: rs(14), color: '#FFF', fontSize: rs(12), minHeight: rs(80), borderWidth: 1, borderColor: '#333', marginBottom: rs(8), fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}
                placeholder="kv1:eyJ2Ijox..."
                placeholderTextColor="#555"
                value={incomingText}
                onChangeText={setIncomingText}
                multiline
              />
              <View style={{ flexDirection: 'row', gap: rs(8) }}>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#333', borderRadius: rs(8), padding: rs(12), alignItems: 'center' }}
                  onPress={async () => {
                    const clip = await Clipboard.getStringAsync();
                    if (clip) setIncomingText(clip);
                  }}
                >
                  <Text style={{ color: '#FFF', fontSize: rs(14) }}>📋 Paste</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#F59E0B', borderRadius: rs(8), padding: rs(12), alignItems: 'center' }}
                  onPress={() => {
                    const decoded = decodeProposal(incomingText.trim());
                    if (!decoded) { Alert.alert('Invalid', 'Could not decode proposal. Make sure you copied the full text.'); return; }
                    const v = verifyProposal(decoded);
                    if (!v.valid) { Alert.alert('Verification Failed', v.error || 'Invalid signature'); return; }
                    setIncomingProposal(decoded);
                    setProposalVerified(true);
                  }}
                >
                  <Text style={{ color: '#000', fontSize: rs(14), fontWeight: '700' }}>🔍 Verify</Text>
                </TouchableOpacity>
              </View>
            </View>

            {proposalVerified && incomingProposal && (
              <View style={{ backgroundColor: '#0D2818', borderRadius: rs(16), padding: rs(16), marginTop: rs(12), borderWidth: 1, borderColor: '#10B981' }}>
                <Text style={{ color: '#10B981', fontSize: rs(16), fontWeight: '700', marginBottom: rs(8) }}>✅ Proposal Verified</Text>
                <Text style={{ color: '#FFF', fontSize: rs(14) }}>From: {incomingProposal.fromName} ({incomingProposal.fromAPT})</Text>
                <Text style={{ color: '#FFF', fontSize: rs(20), fontWeight: '900', marginTop: rs(8) }}>
                  {(Number(incomingProposal.amount) / 1e8).toFixed(2)} KAS
                </Text>
                <Text style={{ color: '#AAA', fontSize: rs(12), marginTop: rs(4) }}>{incomingProposal.desc}</Text>
                <Text style={{ color: '#666', fontSize: rs(10), marginTop: rs(4) }}>Network: {incomingProposal.net}</Text>
                <Text style={{ color: '#666', fontSize: rs(10) }}>Address: {incomingProposal.fromAddr.slice(0, 35)}...</Text>

                <TouchableOpacity
                  style={{ backgroundColor: '#10B981', borderRadius: rs(12), padding: rs(16), alignItems: 'center', marginTop: rs(12) }}
                  onPress={async () => {
                    const result = await acceptProposal(incomingProposal);
                    if ('error' in result) { Alert.alert('Error', result.error); return; }
                    const amtKAS = Number(incomingProposal.amount) / 1e8;
                    await shareAcceptance(result.encoded, amtKAS);
                    Alert.alert('Accepted!', 'Counter-signed acceptance shared. The sender can now complete the transaction.');
                    setMode('choose');
                    setIncomingProposal(null);
                    setIncomingText('');
                    setProposalVerified(false);
                  }}
                >
                  <Text style={{ color: '#FFF', fontSize: rs(16), fontWeight: '700' }}>✓ Accept & Counter-Sign</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ backgroundColor: '#333', borderRadius: rs(12), padding: rs(14), alignItems: 'center', marginTop: rs(8) }}
                  onPress={() => { setIncomingProposal(null); setProposalVerified(false); }}
                >
                  <Text style={{ color: '#FF6B6B', fontSize: rs(14) }}>✗ Reject</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* BLE RECEIVE */}`;

s = s.replace(beforeBLE, proposalScreens);
fixes++;
console.log("  → proposal screens added");

fs.writeFileSync("QRPayNearby.tsx", s, "utf8");
console.log("done:", fixes, "patches applied");
