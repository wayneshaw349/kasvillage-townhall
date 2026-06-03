const fs = require('fs');
const f = 'Workspace.tsx';
let s = fs.readFileSync(f, 'utf8');
let changes = 0;

// === 1: Add discipline + video + QA channel to the abstract form ===
// Insert after the Keywords InputField
const keywordsLine = '<InputField label="Keywords (comma separated)" value={keywords} onChangeText={setKeywords} placeholder="machine learning, cryptography, ..." />';
if (s.includes(keywordsLine) && !s.includes('Field / Discipline')) {
  const extraFields = `<InputField label="Keywords (comma separated)" value={keywords} onChangeText={setKeywords} placeholder="machine learning, cryptography, ..." />

                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: COLORS.stone500, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Field / Discipline</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      {DISCIPLINES.map(d => (
                        <TouchableOpacity key={d.id} onPress={() => setAbstractDiscipline(d.id)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: abstractDiscipline === d.id ? COLORS.amber100 : COLORS.stone50, borderWidth: 1, borderColor: abstractDiscipline === d.id ? COLORS.amber500 : COLORS.stone200 }}>
                          <Text style={{ fontSize: 11, color: abstractDiscipline === d.id ? COLORS.amber900 : COLORS.stone600 }}>{d.icon} {d.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={{ backgroundColor: COLORS.blue50, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: COLORS.blue200 }}>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.blue800, marginBottom: 4 }}>🎬 Video Explainer (optional)</Text>
                      <Text style={{ fontSize: 10, color: COLORS.blue600, marginBottom: 8 }}>Short video on Instagram/TikTok explaining your research</Text>
                      <TextInput style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.blue300, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, color: COLORS.stone800 }} value={abstractVideoUrl} onChangeText={setAbstractVideoUrl} placeholder="https://instagram.com/reel/..." placeholderTextColor={COLORS.stone400} keyboardType="url" autoCapitalize="none" />
                    </View>
                    <View style={{ backgroundColor: '#fef3c7', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#f59e0b' }}>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#92400e', marginBottom: 4 }}>💬 How should people reach you with questions?</Text>
                      <Text style={{ fontSize: 10, color: '#b45309', marginBottom: 8 }}>Pick your preferred channel — questions get routed here</Text>
                      <View style={{ gap: 6 }}>
                        {QA_CHANNELS.map(ch => (
                          <TouchableOpacity key={ch.id} onPress={() => setQaChannel(ch.id)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: qaChannel === ch.id ? '#fef3c7' : '#fff', borderRadius: 8, padding: 10, borderWidth: qaChannel === ch.id ? 2 : 1, borderColor: qaChannel === ch.id ? '#f59e0b' : COLORS.stone200, gap: 8 }}>
                            <Text style={{ fontSize: 18 }}>{ch.icon}</Text>
                            <Text style={{ fontSize: 12, fontWeight: qaChannel === ch.id ? 'bold' : 'normal', color: COLORS.stone700 }}>{ch.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      {qaChannel ? <TextInput style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#f59e0b', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, color: COLORS.stone800, marginTop: 8 }} value={qaHandle} onChangeText={setQaHandle} placeholder={QA_CHANNELS.find(c => c.id === qaChannel)?.placeholder || 'Your handle...'} placeholderTextColor={COLORS.stone400} autoCapitalize="none" /> : null}
                    </View>`;
  s = s.replace(keywordsLine, extraFields);
  changes++; console.log('1: Added discipline + video + QA channel to form');
}

// === 2: Add openQAChannel function ===
if (!s.includes('openQAChannel')) {
  s = s.replace(
    "const handleAskQuestion = async () => {",
    `const openQAChannel = (abs: any, question: string) => {
    const ch = abs.qaChannel; const handle = abs.qaHandle || '';
    if (ch === 'telegram' && handle) { Linking.openURL('https://t.me/' + handle.replace('@','').replace('t.me/','') + '?text=' + encodeURIComponent('Re: ' + abs.title + '\\n\\n' + question)); }
    else if (ch === 'instagram_dm' && handle) { Linking.openURL('https://instagram.com/' + handle.replace('@','')); Alert.alert('DM on Instagram', 'Send your question as a DM to ' + handle); }
    else if (ch === 'email' && handle) { Linking.openURL('mailto:' + handle + '?subject=' + encodeURIComponent('Re: ' + abs.title) + '&body=' + encodeURIComponent(question)); }
    else if (ch === 'signal') { Alert.alert('Signal', 'Message ' + handle + ' on Signal'); }
    else if (ch === 'nostr') { Alert.alert('Nostr', 'DM ' + handle + ' on Nostr'); }
    else { Alert.alert('No Channel', 'Researcher has not set a contact channel.'); }
  };

  const handleAskQuestion = async () => {`
  );
  changes++; console.log('2: Added openQAChannel router');
}

// === 3: After question saved, prompt to open channel ===
if (s.includes("setSubmittingQuestion(false);") && !s.includes('openQAChannel(selectedAbstract')) {
  s = s.replace(
    "setSubmittingQuestion(false);\n    };",
    `setSubmittingQuestion(false);
      if (selectedAbstract?.qaChannel && selectedAbstract?.qaHandle) {
        Alert.alert('Question Saved!', 'Send it to the researcher?', [
          { text: 'Later' },
          { text: 'Open ' + (QA_CHANNELS.find(c => c.id === selectedAbstract.qaChannel)?.label || 'Channel'), onPress: () => openQAChannel(selectedAbstract, newQuestion.trim()) },
        ]);
      }
    };`
  );
  changes++; console.log('3: Prompt to open channel after question');
}

// === 4: Include new fields in abstract object ===
if (s.includes("id: \`ABS_\${Date.now()}\`,") && !s.includes('discipline:')) {
  s = s.replace(
    "id: `ABS_${Date.now()}`,",
    "id: `ABS_${Date.now()}`,\n      discipline: abstractDiscipline,\n      videoUrl: abstractVideoUrl,\n      qaChannel,\n      qaHandle,"
  );
  changes++; console.log('4: Added fields to abstract object');
}

// === 5: Add video + QA channel display in abstract detail ===
if (s.includes("View Repository") && !s.includes('Watch Video Explainer')) {
  s = s.replace(
    `View Repository</Text>
                          </TouchableOpacity>`,
    `View Repository</Text>
                          </TouchableOpacity>
                          {selectedAbstract.videoUrl ? <TouchableOpacity onPress={() => Linking.openURL(selectedAbstract.videoUrl)} style={{ marginTop: 6 }}><Text style={{ color: COLORS.blue600, fontSize: 13, textDecorationLine: 'underline' }}>🎬 Watch Video Explainer</Text></TouchableOpacity> : null}
                          {selectedAbstract.qaChannel && selectedAbstract.qaHandle ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, backgroundColor: '#fef3c7', borderRadius: 8, padding: 8 }}><Text style={{ fontSize: 11, color: '#92400e' }}>💬 Questions via {selectedAbstract.qaChannel}: <Text style={{ fontWeight: 'bold' }}>{selectedAbstract.qaHandle}</Text></Text></View> : null}`
  );
  changes++; console.log('5: Added video + QA channel to detail view');
}

fs.writeFileSync(f, s);
console.log('\nTotal changes:', changes);
const v = fs.readFileSync(f, 'utf8');
console.log('Verify - discipline selector:', v.includes('Field / Discipline'));
console.log('Verify - video explainer field:', v.includes('Video Explainer'));
console.log('Verify - QA channel picker:', v.includes('How should people reach'));
console.log('Verify - openQAChannel:', v.includes('openQAChannel'));
console.log('Verify - prompt after question:', v.includes('Question Saved'));
console.log('Verify - video in detail:', v.includes('Watch Video Explainer'));
