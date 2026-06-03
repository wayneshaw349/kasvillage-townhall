const fs = require('fs');
const f = 'Workspace.tsx';
let s = fs.readFileSync(f, 'utf8');
let fixes = 0;

// 1: Fix Clipboard import — replace deprecated RN Clipboard with expo-clipboard
if (s.includes("Clipboard,\n  ActivityIndicator") || s.includes("Clipboard,")) {
  // Remove Clipboard from RN import
  s = s.replace(/,\s*Clipboard/g, '');
  // Add expo-clipboard import after SecureStore import
  if (!s.includes("import * as Clipboard from 'expo-clipboard'")) {
    s = s.replace(
      "import * as SecureStore from 'expo-secure-store';",
      "import * as SecureStore from 'expo-secure-store';\nimport * as Clipboard from 'expo-clipboard';"
    );
  }
  // Fix Clipboard.setString → Clipboard.setStringAsync
  s = s.replaceAll('Clipboard.setString(', 'Clipboard.setStringAsync(');
  fixes++;
  console.log('1: Fixed Clipboard → expo-clipboard + setStringAsync');
}

// 2: Wire Services tab pricing to state
const oldServicesRate = `<View style={acStyles.priceRow}>
                    <TextInput
                      style={acStyles.priceInput}
                      placeholder="0"
                      keyboardType="numeric"
                    />
                    <Text style={acStyles.priceLabel}>KASPA</Text>
                  </View>
                </View>
                
                <View style={acStyles.serviceBox}>
                  <Text style={acStyles.serviceTitle}>📚 Tutoring & Consulting</Text>
                  <Text style={acStyles.serviceSubtitle}>
                    Offer code auditing, tutoring, analytics, consulting services.
                  </Text>
                  <View style={acStyles.priceRow}>
                    <TextInput
                      style={acStyles.priceInput}
                      placeholder="0"
                      keyboardType="numeric"
                    />
                    <Text style={acStyles.priceLabel}>KASPA/hr</Text>
                  </View>`;

const newServicesRate = `<View style={acStyles.priceRow}>
                    <TextInput
                      style={acStyles.priceInput}
                      placeholder="0"
                      keyboardType="numeric"
                      value={researcherProfile?.question_price?.toString() || ''}
                      onChangeText={(t) => setResearcherProfile((p) => p ? ({ ...p, question_price: parseFloat(t) || 0 }) : p)}
                    />
                    <Text style={acStyles.priceLabel}>KASPA</Text>
                  </View>
                  {!researcherProfile && <Text style={{ fontSize: rs.font(10), color: COLORS.red600, marginTop: rs.s(4) }}>Verify .edu email first in Submit tab</Text>}
                  {researcherProfile && <TouchableOpacity onPress={async () => {
                    const price = researcherProfile.question_price || 0;
                    const updated = abstractsList.map(a => a.researcherId === researcherProfile.researcher_id ? { ...a, questionPrice: price } : a);
                    setAbstractsList(updated);
                    await SecureStore.setItemAsync('kv_abstracts', JSON.stringify(updated));
                    Alert.alert('Saved', 'Question price set to ' + price + ' KAS');
                  }} style={{ backgroundColor: COLORS.green600, borderRadius: rs.s(8), paddingVertical: rs.s(8), alignItems: 'center', marginTop: rs.s(8) }}><Text style={{ color: '#fff', fontWeight: 'bold', fontSize: rs.font(12) }}>Save Price</Text></TouchableOpacity>}
                </View>
                
                <View style={acStyles.serviceBox}>
                  <Text style={acStyles.serviceTitle}>📚 Tutoring & Consulting</Text>
                  <Text style={acStyles.serviceSubtitle}>
                    Offer code auditing, tutoring, analytics, consulting services. Contact via your chosen QA channel.
                  </Text>
                  <Text style={{ fontSize: rs.font(11), color: COLORS.stone600, marginBottom: rs.s(8) }}>
                    Buyers contact you through the channel you set in your abstract submission (Telegram, Instagram DM, Signal, Email, or Nostr).
                  </Text>
                  <View style={acStyles.priceRow}>
                    <TextInput
                      style={acStyles.priceInput}
                      placeholder="0"
                      keyboardType="numeric"
                    />
                    <Text style={acStyles.priceLabel}>KASPA/hr</Text>
                  </View>`;

if (s.includes(oldServicesRate)) {
  s = s.replace(oldServicesRate, newServicesRate);
  fixes++;
  console.log('2: Wired Services tab pricing + save button');
}

// 3: Add Arweave inscription to abstract submission
if (s.includes('await saveAbstract(newAbstract);') && !s.includes('KV-AbstractId')) {
  s = s.replace(
    'await saveAbstract(newAbstract);',
    `await saveAbstract(newAbstract);
    // Inscribe to Arweave
    try {
      const { uploadToIrys } = await import('./arweave_upload');
      await uploadToIrys(JSON.stringify(newAbstract), [
        { name: 'App-Name', value: 'KasVillage' },
        { name: 'KV-Type', value: 'Abstract' },
        { name: 'KV-AbstractId', value: newAbstract.id },
        { name: 'KV-Domain', value: newAbstract.institutionDomain },
        { name: 'KV-Discipline', value: abstractDiscipline },
        { name: 'KV-VideoUrl', value: abstractVideoUrl },
        { name: 'KV-QAChannel', value: qaChannel },
        { name: 'Content-Type', value: 'application/json' },
      ]);
      console.log('[Academic] Abstract inscribed to Arweave');
    } catch (e) { console.warn('[Academic] Arweave failed:', e); }`
  );
  fixes++;
  console.log('3: Added Arweave inscription to abstract submission');
}

fs.writeFileSync(f, s);
console.log('Total:', fixes);
