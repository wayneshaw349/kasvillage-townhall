const fs = require('fs');
const f = 'Workspace.tsx';
let s = fs.readFileSync(f, 'utf8');

const oldModules = `{['procedural_sdk', 'avatar_engine', 'canvas_renderer', 'audio_ui', 'game_v1', 'game_input', 'environments', 'particles', 'item_library', 'wallet_bridge'].map(m => (
                  <View key={m} style={{ backgroundColor: '#fff', paddingHorizontal: rs.s(6), paddingVertical: rs.s(2), borderRadius: rs.s(4), borderWidth: 1, borderColor: '#fca5a5' }}>
                    <Text style={{ fontSize: rs.font(8), fontFamily: 'monospace', color: '#991b1b' }}>{m}</Text>
                  </View>
                ))}`;

const newModules = `{['procedural_sdk', 'avatar_engine', 'canvas_renderer', 'audio_ui', 'game_v1', 'game_input', 'environments', 'particles', 'item_library', 'wallet_bridge'].map(m => (
                  <TouchableOpacity key={m} onPress={() => {
                    const importLine = "import { " + m + " } from '@kasvillage/sdk/" + m + "';\\nimport { procedural_sdk } from '@kasvillage/sdk/procedural_sdk';";
                    Clipboard.setStringAsync(importLine);
                    Alert.alert('Copied!', m + ' import copied to clipboard.\\n\\nprocedural_sdk auto-included.\\n\\nPaste into Claude Code.');
                  }} style={{ backgroundColor: '#fff', paddingHorizontal: rs.s(8), paddingVertical: rs.s(4), borderRadius: rs.s(6), borderWidth: 1, borderColor: '#fca5a5' }} activeOpacity={0.6}>
                    <Text style={{ fontSize: rs.font(9), fontFamily: 'monospace', color: '#991b1b' }}>📋 {m}</Text>
                  </TouchableOpacity>
                ))}
              <Text style={{ fontSize: rs.font(8), color: '#b91c1c', marginTop: rs.s(4), fontStyle: 'italic' }}>Tap any module → copies import + procedural_sdk to clipboard</Text>`;

if (s.includes(oldModules)) {
  s = s.replace(oldModules, newModules);
  console.log('Fixed: SDK modules now tappable → copies import to clipboard');
} else {
  console.log('ERROR: pattern not found');
}

fs.writeFileSync(f, s);
