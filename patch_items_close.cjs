const fs = require('fs');
const f = 'Workspace.tsx';
let s = fs.readFileSync(f, 'utf8');

// 1: Find the broken items section and close it properly
// The pattern: dollarPrice line followed immediately by {/* Coupons Tab */}
const broken = `{item.dollarPrice > 0 ? \`\$\${item.dollarPrice.toFixed(2)} USD\` : ''} {item.kaspaPrice > 0 ? \`\${item.kaspaPrice} KAS\` : 'Price TBD'}
        
        {/* Coupons Tab */}`;

const fixed = `{item.dollarPrice > 0 ? \`\$\${item.dollarPrice.toFixed(2)} USD\` : ''} {item.kaspaPrice > 0 ? \`\${item.kaspaPrice} KAS\` : 'Price TBD'}
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

if (s.includes(broken)) {
  s = s.replace(broken, fixed);
  console.log('1: Closed items tab properly');
} else {
  console.log('1: SKIP — exact pattern not found, trying alternate');
  // Try without backtick template literals
  const lines = s.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().includes('dollarPrice') && lines[i].trim().includes('Price TBD') && 
        i + 3 < lines.length && lines[i+2]?.trim().includes('Coupons Tab')) {
      // Insert closing tags between dollarPrice line and Coupons Tab
      const indent = '        ';
      lines.splice(i + 1, 1, // replace the empty line
        indent + '                  </Text>',
        indent + '                  <Text style={{ fontSize: rs.font(9), color: COLORS.blue500, marginTop: 2 }} numberOfLines={1}>',
        indent + '                    {item.socialUrl ? "↗ " + item.socialUrl.replace("https://", "").slice(0, 40) : "No link"}',
        indent + '                  </Text>',
        indent + '                </View>',
        indent + '                <View style={{ flexDirection: "row", gap: rs.s(12) }}>',
        indent + '                  <TouchableOpacity onPress={() => handleEditItem(item)}><Edit3 size={rs.s(16)} color={COLORS.blue600} /></TouchableOpacity>',
        indent + '                  <TouchableOpacity onPress={() => handleDeleteItem(item.id)}><Trash2 size={rs.s(16)} color={COLORS.red600} /></TouchableOpacity>',
        indent + '                </View>',
        indent + '              </TouchableOpacity>',
        indent + '            ))',
        indent + '          ) : (',
        indent + '            <View style={{ alignItems: "center", paddingVertical: rs.s(24) }}>',
        indent + '              <Text style={{ fontSize: rs.font(13), color: COLORS.amber600 }}>No items yet</Text>',
        indent + '            </View>',
        indent + '          )}',
        indent + '          <TouchableOpacity style={wsStyles.addItemBtn} onPress={() => { setEditingItem(null); setItemForm({ name: "", description: "", dollarPrice: "", kaspaPrice: "", socialUrl: "" }); setShowItemForm(true); }}>',
        indent + '            <Plus size={rs.s(16)} color={COLORS.white} />',
        indent + '            <Text style={wsStyles.addItemBtnText}>Add New Item</Text>',
        indent + '          </TouchableOpacity>',
        indent + '        </SectionCard>',
        indent + '      </View>',
        indent + '    )}',
        indent + '    ',
      );
      s = lines.join('\n');
      console.log('1b: Closed items tab at line', i + 1);
      break;
    }
  }
}

// 2: Remove duplicate content after first valid `export default Workspace;`
const firstExport = s.indexOf('export default Workspace;');
if (firstExport > 0) {
  const afterExport = s.substring(firstExport + 'export default Workspace;'.length).trim();
  if (afterExport.length > 100) {
    // There's duplicate content — truncate at the first export
    s = s.substring(0, firstExport + 'export default Workspace;'.length) + '\n';
    console.log('2: Removed', afterExport.length, 'chars of duplicate content after export');
  }
}

fs.writeFileSync(f, s);

// Verify
const v = fs.readFileSync(f, 'utf8');
const exportCount = (v.match(/export default Workspace;/g) || []).length;
console.log('Verify - export count:', exportCount, '(should be 1)');
console.log('Verify - has Coupons Tab:', v.includes('Coupons Tab'));
console.log('Verify - has items closing:', v.includes('handleEditItem') || v.includes('Add New Item'));
