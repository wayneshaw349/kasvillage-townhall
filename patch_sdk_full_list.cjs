const fs = require('fs');
const f = 'Workspace.tsx';
let s = fs.readFileSync(f, 'utf8');

// Replace the old 10-module list with full SDK catalog in a scrollable section
const oldSection = `{['procedural_sdk', 'avatar_engine', 'canvas_renderer', 'audio_ui', 'game_v1', 'game_input', 'environments', 'particles', 'item_library', 'wallet_bridge'].map(m => (
                  <TouchableOpacity key={m} onPress={() => {
                    const importLine = "import { " + m + " } from '@kasvillage/sdk/" + m + "';\\nimport { procedural_sdk } from '@kasvillage/sdk/procedural_sdk';";
                    Clipboard.setStringAsync(importLine);
                    Alert.alert('Copied!', m + ' import copied to clipboard.\\n\\nprocedural_sdk auto-included.\\n\\nPaste into Claude Code.');
                  }} style={{ backgroundColor: '#fff', paddingHorizontal: rs.s(8), paddingVertical: rs.s(4), borderRadius: rs.s(6), borderWidth: 1, borderColor: '#fca5a5' }} activeOpacity={0.6}>
                    <Text style={{ fontSize: rs.font(9), fontFamily: 'monospace', color: '#991b1b' }}>📋 {m}</Text>
                  </TouchableOpacity>
                ))}
              <Text style={{ fontSize: rs.font(8), color: '#b91c1c', marginTop: rs.s(4), fontStyle: 'italic' }}>Tap any module → copies import + procedural_sdk to clipboard</Text>`;

const SDK_CATEGORIES = `{(() => {
                const sdkModules = [
                  { cat: '🎮 Core Engine', mods: ['procedural_sdk', 'game_v1', 'game_loop', 'game_input'] },
                  { cat: '👤 Avatar & Identity', mods: ['avatar_engine', 'player_sprite', 'enemy_avatars'] },
                  { cat: '🎨 Rendering', mods: ['canvas_renderer', 'ps1_engine', 'ps1_presets', 'board_renderer', 'camera_system'] },
                  { cat: '⚔️ Combat & Input', mods: ['touch_input', 'parry_system', 'enemy_combos', 'paint_v2'] },
                  { cat: '🌍 World', mods: ['environments', 'particles', 'wave_spawner', 'difficulty', 'vagrant_preset'] },
                  { cat: '🎵 Audio & Music', mods: ['audio_ui', 'spotify_auth', 'spotify_sync', 'juice'] },
                  { cat: '🎒 Items & Economy', mods: ['item_library', 'wallet_bridge'] },
                  { cat: '📡 Multiplayer', mods: ['multiplayer', 'tuned_config'] },
                ];
                return sdkModules.map(group => (
                  <View key={group.cat} style={{ marginBottom: rs.s(8) }}>
                    <Text style={{ fontSize: rs.font(9), fontWeight: 'bold', color: '#78350f', marginBottom: rs.s(4) }}>{group.cat}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: rs.s(4) }}>
                      {group.mods.map(m => (
                        <TouchableOpacity key={m} onPress={() => {
                          const importLine = "import { " + m + " } from '@kasvillage/sdk/kasvillage_" + m + "';\\nimport { procedural_sdk } from '@kasvillage/sdk/procedural_sdk';";
                          Clipboard.setStringAsync(importLine);
                          Alert.alert('Copied!', m + ' import copied.\\nprocedural_sdk auto-included.\\nPaste into Claude Code.');
                        }} style={{ backgroundColor: '#fff', paddingHorizontal: rs.s(6), paddingVertical: rs.s(3), borderRadius: rs.s(5), borderWidth: 1, borderColor: '#fca5a5' }} activeOpacity={0.6}>
                          <Text style={{ fontSize: rs.font(8), fontFamily: 'monospace', color: '#991b1b' }}>📋 {m}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ));
              })()}
              <Text style={{ fontSize: rs.font(8), color: '#b91c1c', marginTop: rs.s(4), fontStyle: 'italic' }}>Tap any module → copies import + procedural_sdk to clipboard</Text>
              <Text style={{ fontSize: rs.font(7), color: '#78716c', marginTop: rs.s(2) }}>{(() => { let c = 0; [4,3,5,4,5,4,2,2].forEach(n => c += n); return c; })()} modules across 8 categories</Text>`;

if (s.includes(oldSection)) {
  s = s.replace(oldSection, SDK_CATEGORIES);
  console.log('Fixed: SDK modules expanded to 29 modules in 8 categories');
} else {
  console.log('ERROR: old SDK section not found');
}

fs.writeFileSync(f, s);
