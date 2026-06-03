const fs = require('fs');
const f = 'Workspace.tsx';
let s = fs.readFileSync(f, 'utf8');

const oldPreview = `{/* Preview Tab */}
        {activeView === 'preview' && (
          <SectionCard title="Storefront Preview">
            <Text style={{ fontSize: rs.font(13), color: COLORS.stone600, textAlign: 'center', paddingVertical: rs.s(16) }}>
              Your storefront banner is shown above.{String.fromCharCode(10)}
              Tap "Visit Storefront" to open your social page.{String.fromCharCode(10)}
              Tap "Publish" to inscribe config to Arweave.
            </Text>
            <View style={{ backgroundColor: COLORS.amber50, borderRadius: rs.s(8), padding: rs.s(10), marginTop: rs.s(8) }}>
              <Text style={{ fontSize: rs.font(10), color: COLORS.amber700, textAlign: 'center' }}>
                Buyers see your banner on KasVillage → tap an item → directed to your Instagram/Pinterest/Etsy listing
              </Text>
            </View>
          </SectionCard>
        )}`;

const newPreview = `{/* Preview Tab — What Buyers See */}
        {activeView === 'preview' && (
          <View>
            <SectionCard title="👁 What Buyers See">
              <Text style={{ fontSize: rs.font(10), color: COLORS.stone500, marginBottom: rs.s(12) }}>This is how your store appears in the Mailbox feed</Text>
              
              {/* Storefront Card Preview */}
              <View style={{ backgroundColor: '#fff', borderRadius: rs.s(16), borderWidth: 1, borderColor: COLORS.stone200, overflow: 'hidden', marginBottom: rs.s(16) }}>
                {/* Banner */}
                <View style={{ backgroundColor: bannerStyle.bg === 'crest' ? '#44403c' : bannerStyle.bg, padding: rs.s(20), alignItems: 'center' }}>
                  <Text style={{ fontSize: rs.font(22), fontWeight: '900', color: bannerStyle.text || '#fff' }}>{brandName || 'Your Store'}</Text>
                  {storeDescription ? <Text style={{ fontSize: rs.font(10), color: bannerStyle.text || '#fff', opacity: 0.8, marginTop: rs.s(4) }} numberOfLines={2}>{storeDescription}</Text> : null}
                </View>
                
                {/* Social Icons Row */}
                {Object.keys(socialLinks).filter(k => socialLinks[k]).length > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: rs.s(16), paddingVertical: rs.s(8), backgroundColor: COLORS.stone50 }}>
                    {Object.entries(socialLinks).filter(([, v]) => v).map(([k]) => (
                      <Text key={k} style={{ fontSize: rs.font(20) }}>
                        {k === 'instagram' ? '📸' : k === 'tiktok' ? '🎵' : k === 'etsy' ? '🛍️' : k === 'pinterest' ? '📌' : k === 'youtube' ? '▶️' : k === 'facebook' ? '📘' : '🔗'}
                      </Text>
                    ))}
                  </View>
                )}
                
                {/* Items Preview */}
                <View style={{ padding: rs.s(12) }}>
                  {stash.length > 0 ? stash.slice(0, 3).map(item => (
                    <View key={item.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: rs.s(8), borderBottomWidth: 1, borderBottomColor: COLORS.stone100 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: rs.font(13), fontWeight: 'bold', color: COLORS.stone800 }}>{item.name}</Text>
                        <Text style={{ fontSize: rs.font(10), color: COLORS.stone400 }}>{item.platform || 'social'}</Text>
                      </View>
                      <Text style={{ fontSize: rs.font(12), fontWeight: 'bold', color: COLORS.amber700 }}>
                        {item.kaspaPrice > 0 ? item.kaspaPrice + ' KAS' : item.dollarPrice > 0 ? '$' + item.dollarPrice : ''}
                      </Text>
                    </View>
                  )) : (
                    <Text style={{ fontSize: rs.font(11), color: COLORS.stone400, textAlign: 'center', paddingVertical: rs.s(12) }}>No items yet — add items in the Items tab</Text>
                  )}
                  {stash.length > 3 && <Text style={{ fontSize: rs.font(10), color: COLORS.amber600, textAlign: 'center', marginTop: rs.s(4) }}>+{stash.length - 3} more items</Text>}
                </View>
                
                {/* Footer */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: rs.s(12), paddingVertical: rs.s(8), backgroundColor: COLORS.stone50 }}>
                  <Text style={{ fontSize: rs.font(9), color: COLORS.stone400 }}>{stash.length} items • {coupons.length} coupons</Text>
                  <Text style={{ fontSize: rs.font(9), color: COLORS.green600, fontWeight: 'bold' }}>✓ SDK Compliant</Text>
                </View>
              </View>
              
              <View style={{ backgroundColor: COLORS.amber50, borderRadius: rs.s(8), padding: rs.s(10) }}>
                <Text style={{ fontSize: rs.font(10), color: COLORS.amber700, textAlign: 'center' }}>
                  Tap "Publish" to make this live on Arweave. Buyers see this card in their Mailbox feed.
                </Text>
              </View>
            </SectionCard>
          </View>
        )}`;

if (s.includes(oldPreview)) {
  s = s.replace(oldPreview, newPreview);
  console.log('Fixed: preview tab now shows full storefront card');
} else {
  console.log('ERROR: preview pattern not found');
}

fs.writeFileSync(f, s);
