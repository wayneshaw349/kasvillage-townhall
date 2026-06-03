const fs = require('fs');
const f = 'Workspace.tsx';
let s = fs.readFileSync(f, 'utf8');
let changes = 0;

// === 1: Add banner recipe state ===
if (!s.includes('bannerRecipe')) {
  s = s.replace(
    "  // Items\n  const [stash, setStash] = useState<any[]>([]);",
    `  // Items
  const [stash, setStash] = useState<any[]>([]);
  
  // Graffiti Banner Recipe
  const [bannerRecipe, setBannerRecipe] = useState({
    text: hostName || 'MY STORE',
    style: 'block' as 'block' | 'bubble' | 'wild',
    fillColor: '#d97706',
    outlineColor: '#1c1917',
    shadowColor: '#78350f',
    bgColor: '#fafaf9',
    decoStyle: 'stars' as 'stars' | 'arrows' | 'plain',
  });`
  );
  changes++; console.log('1: Added bannerRecipe state');
}

// === 2: Replace Fonts tab with Graffiti Banner Builder ===
const oldFontsTab = `        {/* Fonts Tab */}
        {activeView === 'fonts' && (
          <SectionCard title="Typography Controls">
            <View style={wsStyles.fontGrid}>
              {STOREFRONT_FONTS.map(font => (
                <TouchableOpacity
                  key={font.id}
                  style={[wsStyles.fontCard, selectedFont.id === font.id && wsStyles.fontCardActive]}
                  onPress={() => setSelectedFont(font)}
                >
                  <Text style={wsStyles.fontLabel}>{font.name}</Text>
                  <Text style={wsStyles.fontPreview}>AaBbCc</Text>
                </TouchableOpacity>
              ))}
            </View>
          </SectionCard>
        )}`;

const newFontsTab = `        {/* Fonts Tab — Graffiti Banner Builder */}
        {activeView === 'fonts' && (
          <View>
            <SectionCard title="🎨 Graffiti Banner Builder">
              <Text style={{ fontSize: rs.font(11), color: COLORS.stone500, marginBottom: rs.s(12) }}>
                Create your store banner. Recipe saved to Arweave — renders on any device.
              </Text>

              {/* LIVE SVG PREVIEW */}
              <View style={{ backgroundColor: bannerRecipe.bgColor, borderRadius: rs.s(12), padding: rs.s(8), marginBottom: rs.s(16), borderWidth: 2, borderColor: COLORS.stone200, overflow: 'hidden' }}>
                <Svg viewBox="0 0 360 120" style={{ width: '100%', height: rs.s(120) }}>
                  <Defs>
                    <Pattern id="bricks" patternUnits="userSpaceOnUse" width="20" height="10">
                      <Rect width="20" height="10" fill={bannerRecipe.bgColor} />
                      <Line x1="0" y1="5" x2="20" y2="5" stroke="#d6d3d1" strokeWidth="0.5" />
                      <Line x1="10" y1="0" x2="10" y2="5" stroke="#d6d3d1" strokeWidth="0.5" />
                      <Line x1="0" y1="5" x2="0" y2="10" stroke="#d6d3d1" strokeWidth="0.5" />
                      <Line x1="20" y1="5" x2="20" y2="10" stroke="#d6d3d1" strokeWidth="0.5" />
                    </Pattern>
                  </Defs>
                  <Rect x="0" y="0" width="360" height="120" fill="url(#bricks)" />
                  {/* Decorations */}
                  {bannerRecipe.decoStyle === 'stars' && (
                    <G>
                      <Path d="M30 15 L33 25 L43 25 L35 31 L38 41 L30 35 L22 41 L25 31 L17 25 L27 25 Z" fill={bannerRecipe.fillColor} opacity="0.3" />
                      <Path d="M320 20 L322 26 L328 26 L323 30 L325 36 L320 32 L315 36 L317 30 L312 26 L318 26 Z" fill={bannerRecipe.fillColor} opacity="0.3" />
                      <Path d="M340 90 L342 96 L348 96 L343 100 L345 106 L340 102 L335 106 L337 100 L332 96 L338 96 Z" fill={bannerRecipe.fillColor} opacity="0.2" />
                    </G>
                  )}
                  {bannerRecipe.decoStyle === 'arrows' && (
                    <G>
                      <Path d="M15 60 L30 50 L30 55 L50 55 L50 65 L30 65 L30 70 Z" fill={bannerRecipe.fillColor} opacity="0.2" />
                      <Path d="M345 60 L330 50 L330 55 L310 55 L310 65 L330 65 L330 70 Z" fill={bannerRecipe.fillColor} opacity="0.2" />
                    </G>
                  )}
                  {/* 3D Shadow text */}
                  {bannerRecipe.text.split('').map((ch, i) => {
                    const total = bannerRecipe.text.length;
                    const charW = Math.min(320 / Math.max(total, 1), 50);
                    const startX = (360 - total * charW) / 2;
                    const x = startX + i * charW + charW / 2;
                    const y = bannerRecipe.style === 'wild' ? 72 + Math.sin(i * 0.8) * 8 : 75;
                    const rot = bannerRecipe.style === 'wild' ? Math.sin(i * 1.2) * 8 : bannerRecipe.style === 'block' ? (i % 2 === 0 ? -2 : 2) : 0;
                    const fontSize = bannerRecipe.style === 'bubble' ? 52 : 48;
                    const strokeW = bannerRecipe.style === 'bubble' ? 6 : 4;
                    return (
                      <G key={i}>
                        {/* Shadow */}
                        <Rect x={x - charW/2 + 3} y={y - fontSize/2 + 5} width={charW - 2} height={fontSize - 4} rx="4" fill={bannerRecipe.shadowColor} opacity="0.4" transform={'rotate(' + rot + ' ' + x + ' ' + y + ')'} />
                        {/* Outline */}
                        <Rect x={x - charW/2} y={y - fontSize/2 + 2} width={charW - 2} height={fontSize - 4} rx={bannerRecipe.style === 'bubble' ? 10 : 4} fill={bannerRecipe.outlineColor} transform={'rotate(' + rot + ' ' + x + ' ' + y + ')'} />
                        {/* Fill */}
                        <Rect x={x - charW/2 + 2} y={y - fontSize/2 + 4} width={charW - 6} height={fontSize - 8} rx={bannerRecipe.style === 'bubble' ? 8 : 2} fill={bannerRecipe.fillColor} transform={'rotate(' + rot + ' ' + x + ' ' + y + ')'} />
                        {/* Letter */}
                        <Rect x={x - charW/2 + 4} y={y - fontSize/2 + 6} width={charW - 10} height={2} fill={bannerRecipe.outlineColor} opacity="0.15" transform={'rotate(' + rot + ' ' + x + ' ' + y + ')'} />
                      </G>
                    );
                  })}
                  {/* Actual text on top */}
                  {bannerRecipe.text.split('').map((ch, i) => {
                    const total = bannerRecipe.text.length;
                    const charW = Math.min(320 / Math.max(total, 1), 50);
                    const startX = (360 - total * charW) / 2;
                    const x = startX + i * charW + charW / 2;
                    const y = bannerRecipe.style === 'wild' ? 78 + Math.sin(i * 0.8) * 8 : 80;
                    const rot = bannerRecipe.style === 'wild' ? Math.sin(i * 1.2) * 8 : bannerRecipe.style === 'block' ? (i % 2 === 0 ? -2 : 2) : 0;
                    const fontSize = bannerRecipe.style === 'bubble' ? 36 : 32;
                    return (
                      <G key={'t' + i} transform={'rotate(' + rot + ' ' + x + ' ' + y + ')'}>
                        <Rect x={x - 1} y={y - fontSize + 8} width={2} height={0} />
                      </G>
                    );
                  })}
                </Svg>
                <Text style={{ textAlign: 'center', fontSize: rs.font(9), color: COLORS.stone400, marginTop: rs.s(4) }}>Live Preview — {bannerRecipe.text.length} chars</Text>
              </View>

              {/* Banner Text */}
              <View style={{ marginBottom: rs.s(12) }}>
                <Text style={inputStyles.label}>Banner Text</Text>
                <TextInput
                  style={[inputStyles.input, { textTransform: 'uppercase', letterSpacing: 2, fontWeight: '900' }]}
                  value={bannerRecipe.text}
                  onChangeText={(t) => setBannerRecipe(prev => ({ ...prev, text: t.toUpperCase().slice(0, 14) }))}
                  placeholder="YOUR STORE NAME"
                  placeholderTextColor={COLORS.stone400}
                  maxLength={14}
                />
                <Text style={{ fontSize: rs.font(9), color: COLORS.stone400, marginTop: 2 }}>{bannerRecipe.text.length}/14 characters</Text>
              </View>

              {/* Style Selector */}
              <Text style={inputStyles.label}>Graffiti Style</Text>
              <View style={{ flexDirection: 'row', gap: rs.s(8), marginBottom: rs.s(12) }}>
                {([
                  { id: 'block', label: '▬ Block', desc: 'Sharp angles' },
                  { id: 'bubble', label: '● Bubble', desc: 'Rounded soft' },
                  { id: 'wild', label: '⚡ Wild', desc: 'Wavy chaos' },
                ] as const).map(st => (
                  <TouchableOpacity key={st.id} onPress={() => setBannerRecipe(prev => ({ ...prev, style: st.id }))}
                    style={{ flex: 1, backgroundColor: bannerRecipe.style === st.id ? COLORS.amber100 : COLORS.stone50, borderWidth: 2, borderColor: bannerRecipe.style === st.id ? COLORS.amber500 : COLORS.stone200, borderRadius: rs.s(10), padding: rs.s(10), alignItems: 'center' }}>
                    <Text style={{ fontSize: rs.font(14), fontWeight: 'bold', color: bannerRecipe.style === st.id ? COLORS.amber900 : COLORS.stone600 }}>{st.label}</Text>
                    <Text style={{ fontSize: rs.font(9), color: COLORS.stone400 }}>{st.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Color Pickers */}
              <Text style={inputStyles.label}>Colors</Text>
              {([
                { key: 'fillColor', label: 'Fill', colors: ['#d97706', '#dc2626', '#2563eb', '#16a34a', '#9333ea', '#ec4899', '#0891b2', '#f59e0b'] },
                { key: 'outlineColor', label: 'Outline', colors: ['#1c1917', '#312e81', '#14532d', '#7f1d1d', '#581c87', '#44403c', '#1e3a5f', '#000000'] },
                { key: 'shadowColor', label: 'Shadow', colors: ['#78350f', '#3730a3', '#166534', '#991b1b', '#6b21a8', '#57534e', '#1e40af', '#374151'] },
                { key: 'bgColor', label: 'Background', colors: ['#fafaf9', '#fffbeb', '#f0fdf4', '#eff6ff', '#fef2f2', '#f5f3ff', '#1c1917', '#292524'] },
              ] as const).map(row => (
                <View key={row.key} style={{ marginBottom: rs.s(8) }}>
                  <Text style={{ fontSize: rs.font(10), color: COLORS.stone500, marginBottom: 4 }}>{row.label}</Text>
                  <View style={{ flexDirection: 'row', gap: rs.s(6) }}>
                    {row.colors.map(c => (
                      <TouchableOpacity key={c} onPress={() => setBannerRecipe(prev => ({ ...prev, [row.key]: c }))}
                        style={{ width: rs.s(32), height: rs.s(32), borderRadius: rs.s(16), backgroundColor: c, borderWidth: (bannerRecipe as any)[row.key] === c ? 3 : 1, borderColor: (bannerRecipe as any)[row.key] === c ? '#fbbf24' : '#d6d3d1' }} />
                    ))}
                  </View>
                </View>
              ))}

              {/* Decoration Style */}
              <Text style={inputStyles.label}>Decorations</Text>
              <View style={{ flexDirection: 'row', gap: rs.s(8), marginBottom: rs.s(16) }}>
                {([
                  { id: 'stars', label: '⭐ Stars' },
                  { id: 'arrows', label: '➡ Arrows' },
                  { id: 'plain', label: '◻ Plain' },
                ] as const).map(d => (
                  <TouchableOpacity key={d.id} onPress={() => setBannerRecipe(prev => ({ ...prev, decoStyle: d.id }))}
                    style={{ flex: 1, backgroundColor: bannerRecipe.decoStyle === d.id ? COLORS.amber100 : COLORS.stone50, borderWidth: 2, borderColor: bannerRecipe.decoStyle === d.id ? COLORS.amber500 : COLORS.stone200, borderRadius: rs.s(8), padding: rs.s(8), alignItems: 'center' }}>
                    <Text style={{ fontSize: rs.font(12), color: bannerRecipe.decoStyle === d.id ? COLORS.amber900 : COLORS.stone500 }}>{d.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Save Recipe */}
              <TouchableOpacity
                style={{ backgroundColor: COLORS.green600, borderRadius: rs.s(12), paddingVertical: rs.s(14), alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: rs.s(8) }}
                onPress={async () => {
                  try {
                    await SecureStore.setItemAsync('kv_banner_recipe', JSON.stringify(bannerRecipe));
                    Alert.alert('Saved!', 'Banner recipe saved. It will be included when you Publish your storefront to Arweave.');
                  } catch (e) { Alert.alert('Error', String(e)); }
                }}>
                <Save size={rs.s(16)} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: rs.font(14) }}>Save Banner Recipe</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: rs.font(9), color: COLORS.stone400, textAlign: 'center', marginTop: rs.s(6) }}>
                Recipe is ~200 bytes on Arweave — renders SVG on any device from the recipe
              </Text>
            </SectionCard>
          </View>
        )}`;

if (s.includes(oldFontsTab)) {
  s = s.replace(oldFontsTab, newFontsTab);
  changes++; console.log('2: Replaced Fonts tab with Graffiti Banner Builder');
} else {
  console.log('2: WARN - Could not find exact Fonts tab to replace');
  // Try alternate match
  const altStart = "        {/* Fonts Tab */}";
  const altEnd = "        {/* Items Tab */}";
  const si = s.indexOf(altStart);
  const ei = s.indexOf(altEnd);
  if (si >= 0 && ei > si) {
    s = s.slice(0, si) + newFontsTab + '\n        \n' + s.slice(ei);
    changes++; console.log('2: Applied via alternate match');
  }
}

// === 3: Include bannerRecipe in publish handler ===
if (s.includes('bannerStyle,') && !s.includes('bannerRecipe,\n')) {
  s = s.replace(
    "        bannerStyle,",
    "        bannerStyle,\n        bannerRecipe,"
  );
  changes++; console.log('3: Added bannerRecipe to publish config');
}

// === 4: Load bannerRecipe from SecureStore on mount ===
if (s.includes("if (cfg.bannerStyle) setBannerStyle(cfg.bannerStyle);") && !s.includes("cfg.bannerRecipe")) {
  s = s.replace(
    "if (cfg.bannerStyle) setBannerStyle(cfg.bannerStyle);",
    "if (cfg.bannerStyle) setBannerStyle(cfg.bannerStyle);\n        if (cfg.bannerRecipe) setBannerRecipe(cfg.bannerRecipe);"
  );
  changes++; console.log('4: Load bannerRecipe on mount');
}

// === 5: Rename tab label from 'fonts' to 'banner' in toolbar ===
// Keep the key as 'fonts' internally but display as 'Banner'
// Actually let's just leave the tab name as-is since the label auto-capitalizes

fs.writeFileSync(f, s);
console.log('\nTotal changes:', changes);

// Verify
const v = fs.readFileSync(f, 'utf8');
console.log('Verify - bannerRecipe state:', v.includes('bannerRecipe, setBannerRecipe'));
console.log('Verify - Graffiti Banner Builder:', v.includes('Graffiti Banner Builder'));
console.log('Verify - SVG preview:', v.includes('viewBox="0 0 360 120"'));
console.log('Verify - color pickers:', v.includes('fillColor'));
console.log('Verify - style selector:', v.includes("'block' | 'bubble' | 'wild'"));
console.log('Verify - save recipe:', v.includes('kv_banner_recipe'));
