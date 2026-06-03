const fs = require('fs');
const f = 'Workspace.tsx';
let s = fs.readFileSync(f, 'utf8');

// Find the exact broken boundary: </Text> followed by {/* Coupons Tab */}
// Missing: close inner View, edit/delete buttons, close TouchableOpacity, close map, empty state, Add button, close SectionCard, close View, close conditional

const oldBoundary = `                      </Text>
        
        {/* Coupons Tab */}`;

const fixedBoundary = `                      </Text>
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
                  <Text style={{ fontSize: rs.font(13), color: COLORS.amber600, fontStyle: 'italic', marginTop: rs.s(8) }}>No items yet</Text>
                </View>
              )}
              <TouchableOpacity style={wsStyles.addItemBtn} onPress={() => { setEditingItem(null); setItemForm({ name: '', description: '', dollarPrice: '', kaspaPrice: '', socialUrl: '' }); setShowItemForm(true); }}>
                <Plus size={rs.s(16)} color={COLORS.white} />
                <Text style={wsStyles.addItemBtnText}>Add New Item</Text>
              </TouchableOpacity>
            </SectionCard>
          </View>
        )}
        
        {/* Coupons Tab */}`;

if (s.includes(oldBoundary)) {
  s = s.replace(oldBoundary, fixedBoundary);
  console.log('Fixed: closed items tab (added 20 lines of closing tags)');
} else {
  console.log('ERROR: boundary not found. Checking...');
  // Debug: show what's around "Coupons Tab"
  const idx = s.indexOf('{/* Coupons Tab */}');
  if (idx > 0) {
    console.log('Found Coupons Tab at index', idx);
    console.log('Before:', JSON.stringify(s.substring(idx - 80, idx)));
  }
}

// Also remove duplicate content after first export default
const exportPositions = [];
let searchFrom = 0;
while (true) {
  const idx = s.indexOf('export default Workspace;', searchFrom);
  if (idx < 0) break;
  exportPositions.push(idx);
  searchFrom = idx + 1;
}
console.log('Export count:', exportPositions.length);
if (exportPositions.length > 1) {
  s = s.substring(0, exportPositions[0] + 'export default Workspace;'.length) + '\n';
  console.log('Truncated at first export, removed duplicate');
}

fs.writeFileSync(f, s);
console.log('Done');
