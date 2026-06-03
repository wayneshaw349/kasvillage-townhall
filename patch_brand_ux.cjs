const fs = require('fs');
const f = 'Workspace.tsx';
let s = fs.readFileSync(f, 'utf8');
let changes = 0;

// === 1: Logo Style — add visual preview ===
const oldLogo = `<Text style={inputStyles.label}>Logo Style</Text>
              <View style={wsStyles.toggleRow}>
                {(['round', 'square'] as const).map(shape => (
                  <TouchableOpacity
                    key={shape}
                    style={[wsStyles.toggleBtn, logoShape === shape && wsStyles.toggleBtnActive]}
                    onPress={() => setLogoShape(shape)}
                  >
                    <Text style={[wsStyles.toggleBtnText, logoShape === shape && wsStyles.toggleBtnTextActive]}>
                      {shape}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>`;

const newLogo = `<Text style={inputStyles.label}>Logo Shape Preview</Text>
              <View style={{ flexDirection: 'row', gap: rs.s(16), marginBottom: rs.s(12), alignItems: 'center' }}>
                {([
                  { id: 'round' as const, label: 'Circle', radius: 999 },
                  { id: 'square' as const, label: 'Rounded Square', radius: rs.s(12) },
                ] as const).map(shape => (
                  <TouchableOpacity
                    key={shape.id}
                    onPress={() => setLogoShape(shape.id)}
                    style={{ alignItems: 'center', opacity: logoShape === shape.id ? 1 : 0.4 }}
                  >
                    <View style={{ width: rs.s(64), height: rs.s(64), borderRadius: shape.radius, backgroundColor: logoShape === shape.id ? COLORS.amber200 : COLORS.stone200, borderWidth: logoShape === shape.id ? 3 : 1, borderColor: logoShape === shape.id ? COLORS.amber600 : COLORS.stone300, justifyContent: 'center', alignItems: 'center', marginBottom: rs.s(4) }}>
                      <Text style={{ fontSize: rs.font(24) }}>{logoUrl ? '🖼' : '📷'}</Text>
                    </View>
                    <Text style={{ fontSize: rs.font(11), fontWeight: logoShape === shape.id ? 'bold' : 'normal', color: logoShape === shape.id ? COLORS.amber900 : COLORS.stone500 }}>{shape.label}</Text>
                    {logoShape === shape.id && <Text style={{ fontSize: rs.font(9), color: COLORS.amber600 }}>✓ Selected</Text>}
                  </TouchableOpacity>
                ))}
              </View>`;

if (s.includes(oldLogo)) {
  s = s.replace(oldLogo, newLogo);
  changes++;
  console.log('1: Logo style — added visual preview');
} else {
  console.log('1: SKIP — logo pattern not found');
}

// === 2: Communication channels — add labels above inputs ===
const oldComm = `{COMMUNICATION_CHANNELS.map(channel => (
                <View key={channel.id} style={wsStyles.socialRow}>
                  <Text style={wsStyles.socialIcon}>{channel.icon}</Text>
                  <TextInput
                    style={wsStyles.socialInput}
                    value={commChannels[channel.id] || ''}
                    onChangeText={(text) => setCommChannels({ ...commChannels, [channel.id]: text })}
                    placeholder={channel.placeholder}
                    placeholderTextColor={COLORS.stone400}
                  />
                </View>
              ))}`;

const newComm = `{COMMUNICATION_CHANNELS.map(channel => (
                <View key={channel.id} style={{ backgroundColor: COLORS.stone50, borderRadius: rs.s(12), padding: rs.s(12), marginBottom: rs.s(8) }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs.s(8), marginBottom: rs.s(6) }}>
                    <Text style={{ fontSize: rs.font(20) }}>{channel.icon}</Text>
                    <Text style={{ fontSize: rs.font(13), fontWeight: 'bold', color: COLORS.stone800 }}>{channel.label}</Text>
                  </View>
                  <TextInput
                    style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.stone200, borderRadius: rs.s(8), paddingHorizontal: rs.s(12), paddingVertical: rs.s(10), fontSize: rs.font(13), color: COLORS.stone700 }}
                    value={commChannels[channel.id] || ''}
                    onChangeText={(text) => setCommChannels({ ...commChannels, [channel.id]: text })}
                    placeholder={channel.placeholder}
                    placeholderTextColor={COLORS.stone400}
                    autoCapitalize="none"
                  />
                </View>
              ))}`;

if (s.includes(oldComm)) {
  s = s.replace(oldComm, newComm);
  changes++;
  console.log('2: Communication channels — added bold labels');
} else {
  console.log('2: SKIP — comm pattern not found');
}

fs.writeFileSync(f, s);
console.log('Total:', changes);
