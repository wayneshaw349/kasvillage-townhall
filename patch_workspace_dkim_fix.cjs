const fs = require('fs');
const f = 'Workspace.tsx';
let s = fs.readFileSync(f, 'utf8');
let changes = 0;

// Insert the "Paste Proof + real DKIM verify" panel BEFORE the existing step 2 verified panel
const insertBefore = "                {verificationStep === 2 && researcherProfile && (";
const pasteProofPanel = `                {verificationStep === 2 && !researcherProfile && (
                  <View>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: COLORS.amber900, textAlign: 'center', marginBottom: 8 }}>📋 Paste the Proof</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24, marginBottom: 16 }}>
                      {['Get Code', 'Send Email', 'Paste Proof'].map((label, i) => (
                        <View key={i} style={{ alignItems: 'center' }}>
                          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.amber600, justifyContent: 'center', alignItems: 'center' }}>
                            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>{i < 2 ? '✓' : '3'}</Text>
                          </View>
                          <Text style={{ fontSize: 9, color: COLORS.stone500, marginTop: 4 }}>{label}</Text>
                        </View>
                      ))}
                    </View>
                    <Text style={{ fontSize: 13, color: COLORS.stone600, textAlign: 'center', marginBottom: 12, lineHeight: 20 }}>Open the email you just sent. Get the raw source:</Text>
                    <View style={{ backgroundColor: COLORS.stone50, borderRadius: 12, padding: 12, marginBottom: 12, gap: 8 }}>
                      <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 10 }}><Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.stone800 }}>📱 Gmail (phone)</Text><Text style={{ fontSize: 11, color: COLORS.stone600 }}>Open email → ⋮ three dots → "Show original" → Copy</Text></View>
                      <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 10 }}><Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.stone800 }}>💻 Gmail (computer)</Text><Text style={{ fontSize: 11, color: COLORS.stone600 }}>Open email → ⋮ → "Show original" → Select all → Copy</Text></View>
                      <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 10 }}><Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.stone800 }}>📧 Outlook</Text><Text style={{ fontSize: 11, color: COLORS.stone600 }}>Open email → ··· → "View message source" → Copy</Text></View>
                      <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 10 }}><Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.stone800 }}>🍎 Apple Mail</Text><Text style={{ fontSize: 11, color: COLORS.stone600 }}>View → Message → Raw Source → Copy</Text></View>
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.stone700, marginBottom: 6 }}>Paste everything here:</Text>
                    <TextInput style={{ backgroundColor: '#fff', borderWidth: 2, borderColor: rawEmailHeaders.length > 200 ? COLORS.green500 : COLORS.stone300, borderRadius: 12, padding: 12, fontSize: 11, fontFamily: 'monospace', color: COLORS.stone700, minHeight: 100, textAlignVertical: 'top' }} value={rawEmailHeaders} onChangeText={setRawEmailHeaders} placeholder="Paste the full email source here..." placeholderTextColor={COLORS.stone400} multiline />
                    {rawEmailHeaders.length > 0 && <Text style={{ fontSize: 10, color: rawEmailHeaders.length > 200 ? COLORS.green600 : COLORS.amber600, marginTop: 4 }}>{rawEmailHeaders.length > 200 ? '✓ Headers pasted (' + rawEmailHeaders.length + ' chars)' : '⚠ Keep pasting — need the full source'}</Text>}
                    {verificationError ? <Text style={{ fontSize: 11, color: COLORS.red600, marginTop: 8 }}>{verificationError}</Text> : null}
                    {dkimSteps && dkimSteps.length > 0 && (
                      <View style={{ backgroundColor: '#f0f9ff', borderRadius: 10, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#93c5fd' }}>
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#1e40af', marginBottom: 4 }}>Verification Steps:</Text>
                        {dkimSteps.map((st, i) => (
                          <Text key={i} style={{ fontSize: 9, color: st.includes('✓') ? '#16a34a' : st.includes('✗') ? '#dc2626' : '#3b82f6', fontFamily: 'monospace', marginBottom: 2 }}>{st}</Text>
                        ))}
                      </View>
                    )}
                    <TouchableOpacity style={{ backgroundColor: rawEmailHeaders.length > 200 ? COLORS.green600 : COLORS.stone300, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 12 }} onPress={async () => {
                      if (rawEmailHeaders.length < 200) { setVerificationError('Paste the full email source — should be several hundred characters'); return; }
                      setIsLoading(true); setVerificationError('');
                      try {
                        const result = await verifyDKIM(rawEmailHeaders);
                        setDkimSteps(result.steps);
                        if (!result.verified) { setVerificationError(result.error || 'DKIM verification failed'); setIsLoading(false); return; }
                        if (magicLink && !rawEmailHeaders.includes(magicLink)) { setVerificationError('Code ' + magicLink + ' not found. Did you put it in the subject?'); setIsLoading(false); return; }
                        const domain = result.domain;
                        const domainHash = bytesToHex(sha256(new TextEncoder().encode('KV_EDU_' + domain)));
                        const researcherId = 'RES_' + domainHash.slice(0, 12).toUpperCase();
                        await SecureStore.setItemAsync('kv_researcher_id', researcherId);
                        await SecureStore.setItemAsync('kv_researcher_domain_hash', domainHash);
                        await SecureStore.setItemAsync('kv_researcher_domain', domain);
                        setRawEmailHeaders(''); setMagicLink('');
                        setResearcherProfile({ researcher_id: researcherId, email_verified: true, institution_domain: domain, domain_hash: domainHash, xp: 0, abstract_count: 0, questions_answered: 0, question_price: 0 });
                        Alert.alert('Verified! 🎓', 'DKIM cryptographically verified on-device!\\n\\nSchool: ' + domain + '\\nID: ' + researcherId + '\\n\\nZero data left your phone. Only school name stored.');
                      } catch (e) { setVerificationError(String(e)); }
                      setIsLoading(false);
                    }} disabled={isLoading || rawEmailHeaders.length < 200}>
                      {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>🔐 Verify DKIM Signature</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setVerificationStep(0)} style={{ alignItems: 'center', paddingVertical: 8, marginTop: 4 }}><Text style={{ color: COLORS.stone400, fontSize: 12 }}>← Start over</Text></TouchableOpacity>
                    <View style={{ backgroundColor: COLORS.green50, borderRadius: 10, padding: 12, marginTop: 12 }}>
                      <Text style={{ fontSize: 10, color: COLORS.green700, textAlign: 'center', lineHeight: 15 }}>🔒 What happens: DNS lookup for school's public DKIM key → RSA signature verified on YOUR phone → only school name saved. Zero PII transmitted.</Text>
                    </View>
                  </View>
                )}

`;

if (s.includes(insertBefore) && !s.includes('verificationStep === 2 && !researcherProfile')) {
  s = s.replace(insertBefore, pasteProofPanel + '                ' + insertBefore.trim());
  changes++; console.log('1: Added Paste Proof panel with real DKIM verify');
}

// Add dkimSteps state if not already there
if (!s.includes('dkimSteps')) {
  s = s.replace(
    'const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);',
    'const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);\n  const [dkimSteps, setDkimSteps] = useState<string[]>([]);'
  );
  changes++; console.log('2: Added dkimSteps state');
}

fs.writeFileSync(f, s);
console.log('\nTotal changes:', changes);
const v = fs.readFileSync(f, 'utf8');
console.log('Verify - paste proof panel:', v.includes('verificationStep === 2 && !researcherProfile'));
console.log('Verify - verifyDKIM call:', v.includes('await verifyDKIM(rawEmailHeaders)'));
console.log('Verify - audit trail:', v.includes('Verification Steps'));
console.log('Verify - DKIM button:', v.includes('Verify DKIM Signature'));
console.log('Verify - zero PII:', v.includes('Zero PII'));
console.log('Verify - cryptographically:', v.includes('cryptographically verified'));
