const fs = require('fs');
const f = 'Workspace.tsx';
let s = fs.readFileSync(f, 'utf8');
let changes = 0;

// Check if Item Form Modal exists
if (s.includes('showItemForm') && !s.includes('{/* Item Form Modal */}')) {
  // The modal was lost in truncation — add it before {/* Coupons Tab */}
  const insertBefore = "        {/* Coupons Tab */}";
  const itemModal = `        {/* Item Form Modal */}
            <Modal visible={showItemForm} animationType="slide" transparent>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: rs.s(20) }}>
                <View style={{ backgroundColor: COLORS.cardBg, borderRadius: rs.s(20), padding: rs.s(20), maxHeight: '85%' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs.s(16) }}>
                    <Text style={{ fontSize: rs.font(18), fontWeight: '900', color: COLORS.amber900 }}>{editingItem ? '✏️ Edit Item' : '➕ New Item'}</Text>
                    <TouchableOpacity onPress={() => { setShowItemForm(false); setEditingItem(null); }}>
                      <X size={rs.s(20)} color={COLORS.stone500} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView>
                    <InputField label="Item Name" value={itemForm.name} onChangeText={(t) => setItemForm(prev => ({ ...prev, name: t }))} placeholder="e.g. Silver Eagle Coin" />
                    <InputField label="Description (optional)" value={itemForm.description} onChangeText={(t) => setItemForm(prev => ({ ...prev, description: t }))} placeholder="Condition, year, details..." multiline />
                    <View style={{ flexDirection: 'row', gap: rs.s(10) }}>
                      <View style={{ flex: 1 }}>
                        <InputField label="Price (USD)" value={itemForm.dollarPrice} onChangeText={(t) => setItemForm(prev => ({ ...prev, dollarPrice: t }))} placeholder="0.00" keyboardType="numeric" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <InputField label="Price (KAS)" value={itemForm.kaspaPrice} onChangeText={(t) => setItemForm(prev => ({ ...prev, kaspaPrice: t }))} placeholder="0" keyboardType="numeric" />
                      </View>
                    </View>
                    <View style={{ backgroundColor: COLORS.blue50, borderRadius: rs.s(12), padding: rs.s(12), marginBottom: rs.s(12), borderWidth: 1, borderColor: COLORS.blue200 }}>
                      <Text style={{ fontSize: rs.font(12), fontWeight: 'bold', color: COLORS.blue800, marginBottom: rs.s(4) }}>📸 Direct Post Link</Text>
                      <Text style={{ fontSize: rs.font(10), color: COLORS.blue600, marginBottom: rs.s(8) }}>Link to this item on Instagram, Pinterest, Etsy, TikTok, eBay, or Facebook. Buyers tap → opens your post.</Text>
                      <TextInput
                        style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.blue300, borderRadius: rs.s(10), paddingHorizontal: rs.s(12), paddingVertical: rs.s(10), fontSize: rs.font(12), color: COLORS.stone800, fontFamily: 'monospace' }}
                        value={itemForm.socialUrl}
                        onChangeText={(t) => setItemForm(prev => ({ ...prev, socialUrl: t }))}
                        placeholder="https://instagram.com/p/ABC123..."
                        placeholderTextColor={COLORS.stone400}
                        keyboardType="url"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: rs.s(6), marginTop: rs.s(8) }}>
                        {['📸 Instagram', '📌 Pinterest', '🛍️ Etsy', '🎵 TikTok', '🏷️ eBay', '📘 Facebook'].map(p => (
                          <View key={p} style={{ backgroundColor: COLORS.stone100, paddingHorizontal: rs.s(8), paddingVertical: rs.s(3), borderRadius: rs.s(6) }}>
                            <Text style={{ fontSize: rs.font(9), color: COLORS.stone500 }}>{p}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                    <TouchableOpacity onPress={handleSaveItem}
                      style={{ backgroundColor: COLORS.green600, borderRadius: rs.s(12), paddingVertical: rs.s(14), alignItems: 'center', marginTop: rs.s(8) }}>
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: rs.font(14) }}>{editingItem ? 'Save Changes' : 'Add Item'}</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </View>
            </Modal>
          </View>
        )}
        
        `;

  if (s.includes(insertBefore)) {
    // Check if there's already a </View> )} before Coupons Tab
    const idx = s.indexOf(insertBefore);
    const before = s.substring(Math.max(0, idx - 50), idx);
    
    // Remove the existing </View> )} that patch_items_close2 added (we're replacing it with modal + close)
    const closePattern = "          </View>\n        )}\n        \n        {/* Coupons Tab */}";
    if (s.includes(closePattern)) {
      s = s.replace(closePattern, itemModal + "{/* Coupons Tab */}");
      changes++;
      console.log('1: Added Item Form Modal (replaced close pattern)');
    } else {
      s = s.replace(insertBefore, itemModal + insertBefore);
      changes++;
      console.log('1: Added Item Form Modal (inserted before Coupons)');
    }
  }
} else if (s.includes('{/* Item Form Modal */}')) {
  console.log('1: SKIP — Item Form Modal already exists');
} else {
  console.log('1: SKIP — showItemForm state not found');
}

fs.writeFileSync(f, s);
console.log('Total:', changes);

// Verify
const v = fs.readFileSync(f, 'utf8');
console.log('Verify - Item Form Modal:', v.includes('Item Form Modal'));
console.log('Verify - handleSaveItem:', v.includes('handleSaveItem'));
console.log('Verify - socialUrl input:', v.includes('instagram.com/p/ABC123'));
