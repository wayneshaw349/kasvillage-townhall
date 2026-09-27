const fs = require('fs');
let code = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

// 1. Add 'join' to agreementType union
code = code.replace(
  "const [agreementType, setAgreementType] = useState<'simple' | 'trade' | null>(null);",
  "const [agreementType, setAgreementType] = useState<'simple' | 'trade' | 'join' | null>(null);\n  const [inboxAgreements, setInboxAgreements] = useState<any[]>([]);\n  const [inboxLoading, setInboxLoading] = useState(false);"
);

// 2. Add loadInbox function after the state declarations — find a good anchor
const loadInboxFn = `
  // === PARTY B INBOX: Load pending agreements from TownHall ===
  const loadInbox = async () => {
    setInboxLoading(true);
    try {
      const wallet = await loadMainWallet();
      if (!wallet) { setInboxLoading(false); return; }
      // Derive pubkey from address
      const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
      const dataPart = wallet.address.split(':')[1];
      const data5bit = Array.from(dataPart).map((c: string) => CHARSET.indexOf(c));
      const result: number[] = [];
      let buff = 0, bits = 0;
      for (const d of data5bit) { buff = (buff << 5) | d; bits += 5; while (bits >= 8) { bits -= 8; result.push((buff >> bits) & 0xff); } }
      let myPubkey = '';
      if (result[0] === 0x00 && result.length >= 33) {
        const xOnly = result.slice(1, 33);
        myPubkey = '02' + xOnly.map((b: number) => b.toString(16).padStart(2, '0')).join('');
      }
      if (!myPubkey) { setInboxLoading(false); return; }
      const agreements = await listMyAgreements(myPubkey);
      // Show proposed agreements where I'm NOT party A (i.e., I can accept)
      const pending = agreements.filter((a: any) => 
        a.status === 'Proposed' && a.partyA?.pubkey !== myPubkey
      );
      setInboxAgreements(pending);
    } catch (e) {
      console.error('[Neighbor] Inbox load error:', e);
    }
    setInboxLoading(false);
  };

  const handleAcceptFromInbox = async (agreement: any) => {
    try {
      const wallet = await loadMainWallet();
      if (!wallet) return;
      const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
      const dataPart = wallet.address.split(':')[1];
      const data5bit = Array.from(dataPart).map((c: string) => CHARSET.indexOf(c));
      const result: number[] = [];
      let buff = 0, bits = 0;
      for (const d of data5bit) { buff = (buff << 5) | d; bits += 5; while (bits >= 8) { bits -= 8; result.push((buff >> bits) & 0xff); } }
      let myPubkey = '';
      if (result[0] === 0x00 && result.length >= 33) {
        const xOnly = result.slice(1, 33);
        myPubkey = '02' + xOnly.map((b: number) => b.toString(16).padStart(2, '0')).join('');
      }
      const acceptResult = await acceptAgreement({
        agreementId: agreement.agreementId || agreement.agreement_id,
        pubkey: myPubkey,
        amount_sompi: agreement.partyA?.amount_sompi || 0,
        signature: 'accept_' + Date.now(),
      });
      if (acceptResult?.success) {
        Alert.alert('Accepted', 'Agreement accepted! Setting up FROST address...');
        // Set contract state from the accepted agreement
        setContract(prev => ({
          ...prev,
          agreementId: agreement.agreementId || agreement.agreement_id,
          description: agreement.description || '',
          buyerPubkey: agreement.partyA?.pubkey || '',
          sellerPubkey: myPubkey,
          counterpartyPubkey: agreement.partyA?.pubkey || '',
          itemPriceKas: (agreement.partyA?.amount_sompi || 0) / 1e8,
          sellerCommitmentKas: (agreement.partyA?.amount_sompi || 0) / 1e8,
        }));
        setRole('seller');
        setAgreementType('trade');
        setStep(3); // Jump to FROST derivation / lock step
      }
    } catch (e) {
      console.error('[Neighbor] Accept error:', e);
      Alert.alert('Error', e instanceof Error ? e.message : 'Accept failed');
    }
  };
`;

// Insert loadInbox after the handleSetCounterparty function
const counterpartyMarker = 'const handleSetCounterparty = (addr: string) => {';
const counterpartyIdx = code.indexOf(counterpartyMarker);
if (counterpartyIdx > 0) {
  // Find the end of handleSetCounterparty (next const or function)
  const nextConst = code.indexOf('\n  const handle', counterpartyIdx + 50);
  if (nextConst > 0) {
    code = code.slice(0, nextConst) + '\n' + loadInboxFn + code.slice(nextConst);
    console.log('1: loadInbox + handleAcceptFromInbox inserted');
  }
}

// 3. Add "Join Existing" button to step 1 agreement type picker
const joinButton = `
                <TouchableOpacity
                  onPress={() => { setAgreementType('join'); loadInbox(); }}
                  style={{ backgroundColor: '#FFF7ED', borderWidth: 2, borderColor: '#F97316', borderRadius: 12, padding: 16, marginBottom: 12 }}
                >
                  <Text style={{ fontSize: rs.font(14), fontWeight: 'bold', color: '#9A3412' }}>Join Existing Agreement</Text>
                  <Text style={{ fontSize: rs.font(11), color: '#C2410C', marginTop: 4 }}>Accept an agreement proposed by your counterparty. Check your inbox for pending proposals.</Text>
                </TouchableOpacity>`;

// Insert after the Trade Agreement button
const tradeButtonEnd = "For purchasing goods or services.</Text>\n                </TouchableOpacity>";
const tradeIdx = code.indexOf(tradeButtonEnd);
if (tradeIdx > 0) {
  code = code.slice(0, tradeIdx + tradeButtonEnd.length) + joinButton + code.slice(tradeIdx + tradeButtonEnd.length);
  console.log('2: Join Existing button added to step 1');
}

// 4. Add inbox view when agreementType === 'join'
const inboxView = `
            {step === 1 && agreementType === 'join' && (
              <View>
                <TouchableOpacity onPress={() => setAgreementType(null)} style={{ marginBottom: 8 }}>
                  <Text style={{ color: '#78716C', fontSize: rs.font(11) }}>{'< Back to agreement types'}</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: rs.font(16), fontWeight: 'bold', color: '#1E1B4B', marginBottom: 12, textAlign: 'center' }}>Pending Proposals</Text>
                
                <TouchableOpacity
                  onPress={loadInbox}
                  style={{ backgroundColor: '#F5F3FF', borderRadius: 8, padding: 10, marginBottom: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: '#6D28D9', fontSize: rs.font(12), fontWeight: '600' }}>
                    {inboxLoading ? 'Loading...' : 'Refresh Inbox'}
                  </Text>
                </TouchableOpacity>

                {inboxAgreements.length === 0 && !inboxLoading && (
                  <View style={{ backgroundColor: '#F5F5F4', borderRadius: 8, padding: 20, alignItems: 'center' }}>
                    <Text style={{ color: '#78716C', fontSize: rs.font(12) }}>No pending proposals</Text>
                    <Text style={{ color: '#A8A29E', fontSize: rs.font(10), marginTop: 4 }}>Ask your counterparty to create an agreement first</Text>
                  </View>
                )}

                {inboxAgreements.map((agr: any, idx: number) => (
                  <View key={idx} style={{ backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#F59E0B', borderRadius: 12, padding: 14, marginBottom: 10 }}>
                    <Text style={{ fontSize: rs.font(13), fontWeight: 'bold', color: '#92400E' }}>
                      {agr.description || 'Agreement ' + (agr.agreementId || agr.agreement_id || '').slice(0, 8)}
                    </Text>
                    <Text style={{ fontSize: rs.font(11), color: '#B45309', marginTop: 4 }}>
                      From: {(agr.partyA?.pubkey || '').slice(0, 16)}...
                    </Text>
                    <Text style={{ fontSize: rs.font(11), color: '#B45309', marginTop: 2 }}>
                      Amount: {((agr.partyA?.amount_sompi || 0) / 1e8).toFixed(2)} KASPA
                    </Text>
                    <Text style={{ fontSize: rs.font(10), color: '#D97706', marginTop: 2 }}>
                      Status: {agr.status} • Network: {agr.network || 'testnet-10'}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleAcceptFromInbox(agr)}
                      style={{ backgroundColor: '#059669', borderRadius: 8, padding: 10, marginTop: 10, alignItems: 'center' }}
                    >
                      <Text style={{ color: '#FFF', fontSize: rs.font(12), fontWeight: 'bold' }}>Accept Agreement</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}`;

// Insert BEFORE the existing {step === 1 && agreementType && ( block
const existingAgrTypeBlock = '{step === 1 && agreementType && (';
const existingIdx = code.indexOf(existingAgrTypeBlock);
if (existingIdx > 0) {
  // Find the {/* before it or the line start
  const lineStart = code.lastIndexOf('\n', existingIdx);
  code = code.slice(0, lineStart) + '\n' + inboxView + '\n' + code.slice(lineStart);
  console.log('3: Inbox view added for join type');
}

// 5. Update the condition for existing agreementType block to exclude 'join'
code = code.replace(
  "{step === 1 && agreementType && (",
  "{step === 1 && agreementType && agreementType !== 'join' && ("
);
console.log('4: Excluded join from existing agreementType detail view');

// 6. Also need to update TownHall list endpoint to support listing ALL proposed agreements
// The listMyAgreements currently filters by pubkey — for inbox we need to list all proposed
// Add a listProposedAgreements function to townhall_client.ts

let clientCode = fs.readFileSync('townhall_client.ts', 'utf8');

const listAllFn = `
// ============================================================================
// LIST ALL PROPOSED AGREEMENTS (for Party B inbox)
// ============================================================================
export async function listProposedAgreements(): Promise<AgreementListItem[]> {
  try {
    const resp = await townhallFetch('/api/agreements/proposed');
    if (!resp.ok) return [];
    return await resp.json();
  } catch (e) {
    console.warn('[TownHall] listProposed error:', e);
    return [];
  }
}
`;

// Check if it already exists
if (!clientCode.includes('listProposedAgreements')) {
  clientCode += listAllFn;
  fs.writeFileSync('townhall_client.ts', clientCode);
  console.log('5: listProposedAgreements added to townhall_client.ts');
} else {
  console.log('5: listProposedAgreements already exists');
}

// 7. Add the /api/agreements/proposed route to src/main.rs
let rustCode = fs.readFileSync('src/main.rs', 'utf8');

const listProposedHandler = `
async fn frost_list_proposed(state: web::Data<AppStateV3>) -> impl Responder {
    let agreements = state.frost_relay.list_proposed();
    HttpResponse::Ok().json(agreements)
}
`;

const listProposedMethod = `
    pub fn list_proposed(&self) -> Vec<FrostAgreement> {
        self.agreements.read().unwrap().values()
            .filter(|a| a.status == FrostAgreementStatus::Proposed)
            .cloned().collect()
    }
`;

// Add handler if not exists
if (!rustCode.includes('frost_list_proposed')) {
  // Insert handler before configure_routes_v3
  const configV3 = rustCode.indexOf('pub fn configure_routes_v3');
  if (configV3 > 0) {
    rustCode = rustCode.slice(0, configV3) + listProposedHandler + '\n' + rustCode.slice(configV3);
    console.log('6: frost_list_proposed handler added to src/main.rs');
  }

  // Add method to FrostRelayStore
  const listByPubkey = rustCode.indexOf('pub fn list_by_pubkey');
  if (listByPubkey > 0) {
    const endOfMethod = rustCode.indexOf('\n    }', listByPubkey);
    if (endOfMethod > 0) {
      rustCode = rustCode.slice(0, endOfMethod + 6) + '\n' + listProposedMethod + rustCode.slice(endOfMethod + 6);
      console.log('7: list_proposed method added to FrostRelayStore');
    }
  }

  // Add route
  rustCode = rustCode.replace(
    '.route("/api/agreements", web::get().to(frost_list_agreements))',
    '.route("/api/agreements", web::get().to(frost_list_agreements))\n        .route("/api/agreements/proposed", web::get().to(frost_list_proposed))'
  );
  console.log('8: /api/agreements/proposed route added');

  fs.writeFileSync('src/main.rs', rustCode);
} else {
  console.log('6-8: Already exists in src/main.rs');
}

// Also update the loadInbox to use listProposedAgreements instead
code = code.replace(
  "const agreements = await listMyAgreements(myPubkey);",
  "const agreements = await listMyAgreements(myPubkey);\n      // Also fetch all proposed agreements (for Party B inbox)\n      const { listProposedAgreements } = await import('./townhall_client');\n      const allProposed = await listProposedAgreements();"
);
code = code.replace(
  "// Show proposed agreements where I'm NOT party A (i.e., I can accept)\n      const pending = agreements.filter((a: any) => \n        a.status === 'Proposed' && a.partyA?.pubkey !== myPubkey\n      );",
  "// Show proposed agreements where I'm NOT party A (i.e., I can accept)\n      const allAgreements = [...agreements, ...allProposed];\n      const seen = new Set<string>();\n      const pending = allAgreements.filter((a: any) => {\n        const id = a.agreementId || a.agreement_id;\n        if (seen.has(id)) return false;\n        seen.add(id);\n        return (a.status === 'Proposed' || a.status === 'proposed') && a.partyA?.pubkey !== myPubkey;\n      });"
);
console.log('9: loadInbox updated to use listProposedAgreements');

fs.writeFileSync('NeighborAgreement.tsx', code);
console.log('=== ALL DONE ===');
console.log('NeighborAgreement.tsx lines:', code.split('\n').length);
