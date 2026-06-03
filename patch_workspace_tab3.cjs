const fs = require('fs');
const f = 'Workspace.tsx';
let s = fs.readFileSync(f, 'utf8');
let changes = 0;

// === 1: Add item editing state ===
if (!s.includes('editingItem')) {
  s = s.replace(
    "  // Publishing state\n  const [isPublishing, setIsPublishing] = useState(false);",
    `  // Item editing
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [itemForm, setItemForm] = useState({ name: '', description: '', dollarPrice: '', kaspaPrice: '', socialUrl: '' });
  
  // Publishing state
  const [isPublishing, setIsPublishing] = useState(false);`
  );
  changes++; console.log('1: Added item editing state');
}

// === 2: Add item helper functions ===
if (!s.includes('handleSaveItem')) {
  s = s.replace(
    "  const handleCopyTemplate = async () => {",
    `  // Item CRUD
  const handleSaveItem = () => {
    if (!itemForm.name.trim()) { Alert.alert('Required', 'Item name is required'); return; }
    if (!itemForm.socialUrl.trim()) { Alert.alert('Required', 'Social post URL is required — link to your Instagram/Pinterest/Etsy listing'); return; }
    const url = itemForm.socialUrl.trim();
    const allowed = ['instagram.com', 'pinterest.com', 'etsy.com', 'tiktok.com', 'facebook.com', 'youtube.com', 'ebay.com'];
    const isAllowed = allowed.some(d => url.includes(d));
    if (!isAllowed && url.startsWith('http')) { Alert.alert('Whitelist Only', 'Links must be from: Instagram, Pinterest, Etsy, TikTok, Facebook, YouTube, or eBay'); return; }
    
    const item = {
      id: editingItem?.id || 'item_' + Date.now(),
      name: itemForm.name.trim(),
      description: itemForm.description.trim(),
      dollarPrice: parseFloat(itemForm.dollarPrice) || 0,
      kaspaPrice: parseFloat(itemForm.kaspaPrice) || 0,
      socialUrl: url.startsWith('http') ? url : 'https://' + url,
      platform: url.includes('instagram') ? 'instagram' : url.includes('pinterest') ? 'pinterest' : url.includes('etsy') ? 'etsy' : url.includes('tiktok') ? 'tiktok' : url.includes('ebay') ? 'ebay' : 'other',
      updatedAt: Date.now(),
    };
    
    if (editingItem) {
      setStash(prev => prev.map(i => i.id === editingItem.id ? item : i));
    } else {
      setStash(prev => [...prev, item]);
    }
    setShowItemForm(false);
    setEditingItem(null);
    setItemForm({ name: '', description: '', dollarPrice: '', kaspaPrice: '', socialUrl: '' });
    // Auto-save locally
    SecureStore.setItemAsync('storefront_items_' + hostId, JSON.stringify(
      editingItem ? stash.map(i => i.id === editingItem.id ? item : i) : [...stash, item]
    )).catch(() => {});
  };
  
  const handleEditItem = (item: any) => {
    setEditingItem(item);
    setItemForm({
      name: item.name || '',
      description: item.description || '',
      dollarPrice: item.dollarPrice?.toString() || '',
      kaspaPrice: item.kaspaPrice?.toString() || '',
      socialUrl: item.socialUrl || '',
    });
    setShowItemForm(true);
  };
  
  const handleDeleteItem = (itemId: string) => {
    Alert.alert('Delete Item?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        const updated = stash.filter(i => i.id !== itemId);
        setStash(updated);
        SecureStore.setItemAsync('storefront_items_' + hostId, JSON.stringify(updated)).catch(() => {});
      }},
    ]);
  };
  
  const getPlatformIcon = (url: string) => {
    if (url?.includes('instagram')) return '📸';
    if (url?.includes('pinterest')) return '📌';
    if (url?.includes('etsy')) return '🛍️';
    if (url?.includes('tiktok')) return '🎵';
    if (url?.includes('ebay')) return '🏷️';
    if (url?.includes('facebook')) return '📘';
    return '🔗';
  };

  const handleCopyTemplate = async () => {`
  );
  changes++; console.log('2: Added item CRUD helpers');
}

// === 3: Load items from SecureStore on mount ===
if (s.includes("if (cfg.stash) setStash(cfg.stash);") && !s.includes('storefront_items_')) {
  s = s.replace(
    "if (cfg.stash) setStash(cfg.stash);",
    `if (cfg.stash) setStash(cfg.stash);
        // Also try separate items store
        try { const itemsJson = await SecureStore.getItemAsync('storefront_items_' + hostId); if (itemsJson) { const items = JSON.parse(itemsJson); if (items.length > 0) setStash(items); } } catch {}`
  );
  changes++; console.log('3: Load items from SecureStore');
}

// === 4: Replace Items tab with full CRUD ===
const oldItemsTab = `        {/* Items Tab */}
        {activeView === 'items' && (
          <SectionCard title="The Stash Management">
            <Text style={wsStyles.sectionSubtitle}>Add, edit, or delete items for your Node.</Text>
            
            {stash.length > 0 ? (
              stash.map(item => (
                <View key={item.id} style={wsStyles.itemCard}>
                  <View>
                    <Text style={wsStyles.itemName}>{item.name}</Text>
                    <Text style={wsStyles.itemPrice}>
                      \${item.dollarPrice?.toFixed(2)} → {item.kaspaPrice?.toLocaleString()} KASPA
                    </Text>
                  </View>
                  <View style={wsStyles.itemActions}>
                    <TouchableOpacity>
                      <Edit3 size={rs.s(16)} color={COLORS.blue600} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setStash(prev => prev.filter(i => i.id !== item.id))}>
                      <Trash2 size={rs.s(16)} color={COLORS.red600} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <Text style={wsStyles.emptyText}>No items yet. Add your first product!</Text>
            )}
            
            <TouchableOpacity
              style={wsStyles.addItemBtn}
              onPress={() => {
                const newItem = {
                  id: \`item_\${Date.now()}\`,
                  name: 'New Item',
                  dollarPrice: 0,
                  kaspaPrice: 0,
                };
                setStash([...stash, newItem]);
              }}
            >
              <ShoppingBag size={rs.s(16)} color={COLORS.white} />
              <Text style={wsStyles.addItemBtnText}>Add New Item</Text>
            </TouchableOpacity>
          </SectionCard>
        )}`;

const newItemsTab = `        {/* Items Tab */}
        {activeView === 'items' && (
          <View>
            <SectionCard title="The Stash Management">
              <Text style={wsStyles.sectionSubtitle}>Add, edit, or delete items for your feed.</Text>
              
              {stash.length > 0 ? (
                stash.map(item => (
                  <TouchableOpacity key={item.id} onPress={() => { if (item.socialUrl) Linking.openURL(item.socialUrl); }}
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, borderRadius: rs.s(12), padding: rs.s(12), marginBottom: rs.s(8), borderWidth: 1, borderColor: COLORS.amber200 }} activeOpacity={0.7}>
                    <Text style={{ fontSize: rs.font(28), marginRight: rs.s(10) }}>{getPlatformIcon(item.socialUrl)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: rs.font(14), fontWeight: 'bold', color: COLORS.stone800 }}>{item.name}</Text>
                      {item.description ? <Text style={{ fontSize: rs.font(10), color: COLORS.stone500, marginTop: 2 }} numberOfLines={1}>{item.description}</Text> : null}
                      <Text style={{ fontSize: rs.font(11), color: COLORS.amber700, marginTop: rs.s(2) }}>
                        {item.dollarPrice > 0 ? '$' + item.dollarPrice.toFixed(2) + ' • ' : ''}{item.kaspaPrice > 0 ? item.kaspaPrice + ' KAS' : 'Price TBD'}
                      </Text>
                      <Text style={{ fontSize: rs.font(9), color: COLORS.blue500, marginTop: 2 }} numberOfLines={1}>
                        {item.socialUrl ? '↗ ' + item.socialUrl.replace('https://', '').slice(0, 40) + '...' : 'No link'}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: rs.s(12) }}>
                      <TouchableOpacity onPress={() => handleEditItem(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Edit3 size={rs.s(16)} color={COLORS.blue600} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteItem(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Trash2 size={rs.s(16)} color={COLORS.red600} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: rs.s(24) }}>
                  <ShoppingBag size={rs.s(32)} color={COLORS.amber300} />
                  <Text style={{ fontSize: rs.font(13), color: COLORS.amber600, fontStyle: 'italic', marginTop: rs.s(8) }}>No items yet. Add your first product!</Text>
                  <Text style={{ fontSize: rs.font(10), color: COLORS.stone400, marginTop: rs.s(4) }}>Each item links directly to your Instagram/Pinterest post</Text>
                </View>
              )}
              
              <TouchableOpacity
                style={wsStyles.addItemBtn}
                onPress={() => { setEditingItem(null); setItemForm({ name: '', description: '', dollarPrice: '', kaspaPrice: '', socialUrl: '' }); setShowItemForm(true); }}
              >
                <Plus size={rs.s(16)} color={COLORS.white} />
                <Text style={wsStyles.addItemBtnText}>Add New Item</Text>
              </TouchableOpacity>
            </SectionCard>

            {/* Item Form Modal */}
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
                      <Text style={{ fontSize: rs.font(10), color: COLORS.blue600, marginBottom: rs.s(8) }}>
                        Paste the link to this item's photo on Instagram, Pinterest, or Etsy.{String.fromCharCode(10)}Buyers tap the item → opens this exact post.
                      </Text>
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
                        {['📸 Instagram', '📌 Pinterest', '🛍️ Etsy', '🎵 TikTok', '🏷️ eBay'].map(p => (
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
        )}`;

if (s.includes(oldItemsTab)) {
  s = s.replace(oldItemsTab, newItemsTab);
  changes++; console.log('4: Replaced Items tab with full CRUD');
} else {
  console.log('4: WARN - exact match failed, trying alternate');
  const si = s.indexOf("{/* Items Tab */}");
  const ei = s.indexOf("{/* DApps Tab */}");
  if (si >= 0 && ei > si) {
    // Find the start of the line
    const lineStart = s.lastIndexOf('\n', si) + 1;
    s = s.slice(0, lineStart) + newItemsTab + '\n        \n' + s.slice(ei);
    changes++; console.log('4: Applied via alternate match');
  }
}

fs.writeFileSync(f, s);
console.log('\nTotal changes:', changes);

const v = fs.readFileSync(f, 'utf8');
console.log('Verify - item form:', v.includes('showItemForm'));
console.log('Verify - handleSaveItem:', v.includes('handleSaveItem'));
console.log('Verify - socialUrl:', v.includes('socialUrl'));
console.log('Verify - platform icon:', v.includes('getPlatformIcon'));
console.log('Verify - whitelist check:', v.includes('instagram.com'));
console.log('Verify - tap opens link:', v.includes('Linking.openURL(item.socialUrl)'));
console.log('Verify - edit modal:', v.includes('Edit Item'));
