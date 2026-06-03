const fs = require('fs');
const f = 'Workspace.tsx';
let s = fs.readFileSync(f, 'utf8');
let changes = 0;

// === 1: Add DISCIPLINES constant ===
if (!s.includes('DISCIPLINES')) {
  s = s.replace(
    "const STOREFRONT_FONTS = [",
    `const DISCIPLINES = [
  { id: 'cs', label: 'Computer Science', icon: '💻' },
  { id: 'math', label: 'Mathematics', icon: '📐' },
  { id: 'physics', label: 'Physics', icon: '⚛️' },
  { id: 'bio', label: 'Biology', icon: '🧬' },
  { id: 'chem', label: 'Chemistry', icon: '🧪' },
  { id: 'econ', label: 'Economics', icon: '📊' },
  { id: 'eng', label: 'Engineering', icon: '⚙️' },
  { id: 'law', label: 'Law', icon: '⚖️' },
  { id: 'med', label: 'Medicine', icon: '🩺' },
  { id: 'psych', label: 'Psychology', icon: '🧠' },
  { id: 'other', label: 'Other', icon: '📚' },
];

const QA_CHANNELS = [
  { id: 'telegram', label: 'Telegram', icon: '✈️', placeholder: 't.me/username or @handle' },
  { id: 'instagram_dm', label: 'Instagram DM', icon: '📸', placeholder: '@your_instagram' },
  { id: 'signal', label: 'Signal', icon: '🔒', placeholder: 'Signal username' },
  { id: 'email', label: 'Email (generic)', icon: '📧', placeholder: 'any email (not .edu)' },
  { id: 'nostr', label: 'Nostr', icon: '🟣', placeholder: 'npub...' },
];

const STOREFRONT_FONTS = [`
  );
  changes++; console.log('1: Added DISCIPLINES + QA_CHANNELS');
}

// === 2: Add state for new fields ===
if (!s.includes('abstractDiscipline')) {
  s = s.replace(
    "const [attestation3, setAttestation3] = useState(false);",
    `const [attestation3, setAttestation3] = useState(false);
  const [abstractDiscipline, setAbstractDiscipline] = useState('');
  const [abstractVideoUrl, setAbstractVideoUrl] = useState('');
  const [qaChannel, setQaChannel] = useState('');
  const [qaHandle, setQaHandle] = useState('');`
  );
  changes++; console.log('2: Added abstract field state');
}

// === 3: Enhance the abstract submission form ===
// Find the abstract form (after "Verified Researcher" badge, before attestations)
const afterRepoUrl = `<InputField label="Keywords (comma separated)" value={keywords} onChangeText={setKeywords} placeholder="machine learning, cryptography, ..." />`;

if (s.includes(afterRepoUrl) && !s.includes('abstractDiscipline')) {
  const enhancedFields = `<InputField label="Keywords (comma separated)" value={keywords} onChangeText={setKeywords} placeholder="machine learning, cryptography, ..." />

                    {/* Discipline */}
                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: COLORS.stone500, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Field / Discipline</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      {DISCIPLINES.map(d => (
                        <TouchableOpacity key={d.id} onPress={() => setAbstractDiscipline(d.id)}
                          style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: abstractDiscipline === d.id ? COLORS.amber100 : COLORS.stone50, borderWidth: 1, borderColor: abstractDiscipline === d.id ? COLORS.amber500 : COLORS.stone200 }}>
                          <Text style={{ fontSize: 11, color: abstractDiscipline === d.id ? COLORS.amber900 : COLORS.stone600 }}>{d.icon} {d.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Video Explainer */}
                    <View style={{ backgroundColor: COLORS.blue50, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: COLORS.blue200 }}>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.blue800, marginBottom: 4 }}>🎬 Video Explainer (optional)</Text>
                      <Text style={{ fontSize: 10, color: COLORS.blue600, marginBottom: 8 }}>Short video explaining your research on Instagram or TikTok. Makes it accessible and boosts visibility.</Text>
                      <TextInput style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.blue300, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, color: COLORS.stone800 }} value={abstractVideoUrl} onChangeText={setAbstractVideoUrl} placeholder="https://instagram.com/reel/ABC123..." placeholderTextColor={COLORS.stone400} keyboardType="url" autoCapitalize="none" />
                    </View>

                    {/* Q&A Contact Channel */}
                    <View style={{ backgroundColor: '#fef3c7', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#f59e0b' }}>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#92400e', marginBottom: 4 }}>💬 How should questioners reach you?</Text>
                      <Text style={{ fontSize: 10, color: '#b45309', marginBottom: 8 }}>When someone asks about your research, the question is sent to your chosen channel. Pick one:</Text>
                      <View style={{ gap: 6 }}>
                        {QA_CHANNELS.map(ch => (
                          <TouchableOpacity key={ch.id} onPress={() => setQaChannel(ch.id)}
                            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: qaChannel === ch.id ? '#fef3c7' : '#fff', borderRadius: 8, padding: 10, borderWidth: qaChannel === ch.id ? 2 : 1, borderColor: qaChannel === ch.id ? '#f59e0b' : COLORS.stone200, gap: 8 }}>
                            <Text style={{ fontSize: 18 }}>{ch.icon}</Text>
                            <Text style={{ fontSize: 12, fontWeight: qaChannel === ch.id ? 'bold' : 'normal', color: COLORS.stone700 }}>{ch.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      {qaChannel && (
                        <TextInput style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#f59e0b', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, color: COLORS.stone800, marginTop: 8 }} value={qaHandle} onChangeText={setQaHandle} placeholder={QA_CHANNELS.find(c => c.id === qaChannel)?.placeholder || 'Your handle...'} placeholderTextColor={COLORS.stone400} autoCapitalize="none" />
                      )}
                    </View>`;

  s = s.replace(afterRepoUrl, enhancedFields);
  changes++; console.log('3: Enhanced abstract form with discipline, video, QA channel');
}

// === 4: Include new fields in the abstract object ===
const oldAbstractObj = "id: \`ABS_\${Date.now()}\`,";
if (s.includes(oldAbstractObj) && !s.includes('discipline:')) {
  s = s.replace(
    "id: `ABS_${Date.now()}`,",
    "id: `ABS_${Date.now()}`,\n      discipline: abstractDiscipline,\n      videoUrl: abstractVideoUrl,\n      qaChannel,\n      qaHandle,"
  );
  changes++; console.log('4: Added new fields to abstract object');
}

// === 5: Include new fields in Arweave tags ===
const oldArweaveTags = "{ name: 'KV-Domain', value: newAbstract.institutionDomain }";
if (s.includes(oldArweaveTags) && !s.includes('KV-Discipline')) {
  s = s.replace(
    oldArweaveTags,
    oldArweaveTags + ",\n          { name: 'KV-Discipline', value: abstractDiscipline },\n          { name: 'KV-QAChannel', value: qaChannel },\n          { name: 'KV-VideoUrl', value: abstractVideoUrl }"
  );
  changes++; console.log('5: Added discipline/channel/video to Arweave tags');
}

// === 6: Add QA channel info to abstract list display (Browse tab) ===
// In the abstract list card, add the contact channel
const oldViewRepo = "View Repository";
if (s.includes(oldViewRepo) && !s.includes('qaChannel')) {
  // This is in the abstract detail view
  s = s.replace(
    "View Repository</Text>\n                          </TouchableOpacity>",
    `View Repository</Text>
                          </TouchableOpacity>
                          {selectedAbstract.videoUrl ? (
                            <TouchableOpacity onPress={() => Linking.openURL(selectedAbstract.videoUrl)} style={{ marginTop: 6 }}>
                              <Text style={{ color: COLORS.blue600, fontSize: 13, textDecorationLine: 'underline' }}>🎬 Watch Video Explainer</Text>
                            </TouchableOpacity>
                          ) : null}
                          {selectedAbstract.qaChannel && selectedAbstract.qaHandle ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, backgroundColor: '#fef3c7', borderRadius: 8, padding: 8 }}>
                              <Text style={{ fontSize: 12 }}>{QA_CHANNELS.find(c => c.id === selectedAbstract.qaChannel)?.icon || '💬'}</Text>
                              <Text style={{ fontSize: 11, color: '#92400e' }}>Questions via {QA_CHANNELS.find(c => c.id === selectedAbstract.qaChannel)?.label}: <Text style={{ fontWeight: 'bold' }}>{selectedAbstract.qaHandle}</Text></Text>
                            </View>
                          ) : null}`
  );
  changes++; console.log('6: Added video + QA channel to abstract detail view');
}

// === 7: Update "Ask Question" to show the contact channel ===
const oldAskPrompt = "Ask a question about this research...";
if (s.includes(oldAskPrompt)) {
  s = s.replace(
    oldAskPrompt,
    "Type your question — it will be sent via " + "' + (selectedAbstract?.qaChannel ? (QA_CHANNELS.find(c => c.id === selectedAbstract.qaChannel)?.label || 'their chosen channel') : 'the platform') + '"
  );
  // Actually that won't work as a static string replacement into JSX. Let me fix it differently.
}
// Revert the bad replacement and do it properly
if (s.includes("Type your question — it will be sent via ")) {
  s = s.replace(
    "Type your question — it will be sent via " + "' + (selectedAbstract?.qaChannel ? (QA_CHANNELS.find(c => c.id === selectedAbstract.qaChannel)?.label || 'their chosen channel') : 'the platform') + '",
    "Type your question here..."
  );
}

// === 8: Wire the question submission to open the researcher's channel ===
const oldSubmitQuestion = "Submit Question";
if (s.includes(oldSubmitQuestion) && !s.includes('openQAChannel')) {
  // After question submission, offer to open the channel
  s = s.replace(
    "const handleAskQuestion = async () => {\n    if (!selectedAbstract || !newQuestion.trim()) return;",
    `const openQAChannel = (abstract_: any, question: string) => {
    const ch = abstract_.qaChannel;
    const handle = abstract_.qaHandle || '';
    if (ch === 'telegram' && handle) {
      const tgUser = handle.replace('@', '').replace('t.me/', '');
      Linking.openURL('https://t.me/' + tgUser + '?text=' + encodeURIComponent('Re: ' + abstract_.title + '\\n\\n' + question));
    } else if (ch === 'instagram_dm' && handle) {
      Linking.openURL('https://instagram.com/' + handle.replace('@', ''));
      Alert.alert('DM on Instagram', 'Send your question as a DM to ' + handle);
    } else if (ch === 'signal' && handle) {
      Alert.alert('Signal', 'Message ' + handle + ' on Signal with your question.');
    } else if (ch === 'email' && handle) {
      Linking.openURL('mailto:' + handle + '?subject=' + encodeURIComponent('Re: ' + abstract_.title) + '&body=' + encodeURIComponent(question));
    } else if (ch === 'nostr' && handle) {
      Alert.alert('Nostr', 'Send a DM to ' + handle + ' on Nostr.');
    } else {
      Alert.alert('Contact', 'The researcher has not set a contact channel. Check the abstract for contact info.');
    }
  };

  const handleAskQuestion = async () => {
    if (!selectedAbstract || !newQuestion.trim()) return;`
  );
  changes++; console.log('8: Added openQAChannel router');
}

// After question is saved, prompt to open the channel
const oldQuestionSaved = "setNewQuestion('');\n      setSubmittingQuestion(false);";
if (s.includes(oldQuestionSaved) && !s.includes('openQAChannel(selectedAbstract')) {
  s = s.replace(
    "setNewQuestion('');\n      setSubmittingQuestion(false);",
    `setNewQuestion('');
      setSubmittingQuestion(false);
      // Prompt to open researcher's contact channel
      if (selectedAbstract.qaChannel && selectedAbstract.qaHandle) {
        Alert.alert('Question Saved!', 'Now send it to the researcher via ' + (QA_CHANNELS.find(c => c.id === selectedAbstract.qaChannel)?.label || 'their channel') + '?', [
          { text: 'Later', style: 'cancel' },
          { text: 'Open ' + (QA_CHANNELS.find(c => c.id === selectedAbstract.qaChannel)?.label || 'Channel'), onPress: () => openQAChannel(selectedAbstract, newQuestion.trim()) },
        ]);
      }`
  );
  changes++; console.log('9: Prompt to open QA channel after question');
}

// === 10: Add discipline filter to Browse tab ===
const oldSearchRow = "searchQuery}";
// Skip this for now — can add later

// === 11: Reset new fields on submission ===
const oldResetKeywords = "setKeywords('');";
if (s.includes(oldResetKeywords) && !s.includes("setAbstractDiscipline('')")) {
  s = s.replace(
    "setKeywords('');",
    "setKeywords('');\n    setAbstractDiscipline('');\n    setAbstractVideoUrl('');"
  );
  changes++; console.log('10: Reset new fields on submission');
}

fs.writeFileSync(f, s);
console.log('\nTotal changes:', changes);
const v = fs.readFileSync(f, 'utf8');
console.log('Verify - DISCIPLINES:', v.includes('DISCIPLINES'));
console.log('Verify - QA_CHANNELS:', v.includes('QA_CHANNELS'));
console.log('Verify - discipline selector:', v.includes('abstractDiscipline'));
console.log('Verify - video explainer:', v.includes('abstractVideoUrl'));
console.log('Verify - qaChannel state:', v.includes("qaChannel, setQaChannel"));
console.log('Verify - channel router:', v.includes('openQAChannel'));
console.log('Verify - Arweave discipline tag:', v.includes('KV-Discipline'));
console.log('Verify - Watch Video:', v.includes('Watch Video Explainer'));
