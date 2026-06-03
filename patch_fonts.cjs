const fs = require('fs');
const f = 'Workspace.tsx';
let s = fs.readFileSync(f, 'utf8');

// Add font style selector ABOVE the graffiti builder
const oldFonts = `{/* Fonts Tab — Graffiti Banner Builder */}
        {activeView === 'fonts' && (
          <View>
            <SectionCard title="🎨 Graffiti Banner Builder">`;

const newFonts = `{/* Fonts Tab — Banner Styles + Graffiti Builder */}
        {activeView === 'fonts' && (
          <View>
            {/* Font Style Selector */}
            <SectionCard title="🔤 Banner Text Style">
              <Text style={{ fontSize: rs.font(11), color: COLORS.stone500, marginBottom: rs.s(12) }}>Choose how your store name renders on the banner</Text>
              <View style={{ gap: rs.s(8), marginBottom: rs.s(8) }}>
                {[
                  { id: 'clean', label: 'Clean Modern', weight: '400', spacing: 0, transform: 'none', preview: brandName || 'MY STORE' },
                  { id: 'bold', label: 'Bold Impact', weight: '900', spacing: 2, transform: 'uppercase', preview: (brandName || 'MY STORE').toUpperCase() },
                  { id: 'elegant', label: 'Elegant Serif', weight: '300', spacing: 4, transform: 'capitalize', preview: brandName || 'My Store' },
                  { id: 'retro', label: 'Retro Block', weight: '800', spacing: 6, transform: 'uppercase', preview: (brandName || 'MY STORE').toUpperCase() },
                  { id: 'graffiti', label: '🎨 Graffiti (advanced)', weight: '900', spacing: 0, transform: 'uppercase', preview: bannerRecipe.text || 'HOOD' },
                ].map(font => (
                  <TouchableOpacity key={font.id} onPress={() => setSelectedFont({ id: font.id, name: font.label, fontFamily: 'System' })}
                    style={{ backgroundColor: selectedFont.id === font.id ? COLORS.amber50 : '#fff', borderWidth: 2, borderColor: selectedFont.id === font.id ? COLORS.amber500 : COLORS.stone200, borderRadius: rs.s(12), padding: rs.s(14), overflow: 'hidden' }}>
                    <Text style={{ fontSize: rs.font(10), fontWeight: 'bold', color: selectedFont.id === font.id ? COLORS.amber800 : COLORS.stone500, marginBottom: rs.s(4) }}>{font.label}</Text>
                    {font.id === 'graffiti' ? (
                      <View style={{ backgroundColor: bannerRecipe.bgColor || '#fafaf9', borderRadius: rs.s(8), padding: rs.s(8), alignItems: 'center' }}>
                        <Text style={{ fontSize: rs.font(22), fontWeight: '900', color: bannerRecipe.fillColor || '#d97706', letterSpacing: 4, textShadowColor: bannerRecipe.shadowColor || '#78350f', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 1 }}>{font.preview}</Text>
                      </View>
                    ) : (
                      <View style={{ backgroundColor: bannerStyle.bg === 'crest' ? '#44403c' : bannerStyle.bg, borderRadius: rs.s(8), padding: rs.s(10), alignItems: 'center' }}>
                        <Text style={{ fontSize: rs.font(20), fontWeight: font.weight as any, color: bannerStyle.text || '#fff', letterSpacing: font.spacing, textTransform: font.transform as any }}>{font.preview}</Text>
                      </View>
                    )}
                    {selectedFont.id === font.id && <Text style={{ fontSize: rs.font(9), color: COLORS.amber600, marginTop: rs.s(4) }}>✓ Active</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            </SectionCard>

            {/* Graffiti Builder — only visible when graffiti font selected */}
            {selectedFont.id === 'graffiti' && (
            <SectionCard title="🎨 Graffiti Banner Builder">`;

if (s.includes(oldFonts)) {
  s = s.replace(oldFonts, newFonts);
  
  // Close the graffiti conditional — find the end of the graffiti SectionCard
  const graffitiEnd = "Recipe is ~200 bytes on Arweave — renders SVG on any device from the recipe\n              </Text>\n            </SectionCard>\n          </View>\n        )}";
  if (s.includes(graffitiEnd)) {
    s = s.replace(graffitiEnd, "Recipe is ~200 bytes on Arweave — renders SVG on any device from the recipe\n              </Text>\n            </SectionCard>\n            )}\n          </View>\n        )}");
    console.log('Fixed: added graffiti conditional close');
  }
  
  console.log('Fixed: added font style selector with live previews');
} else {
  console.log('ERROR: fonts pattern not found');
}

fs.writeFileSync(f, s);
