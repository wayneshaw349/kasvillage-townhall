const fs = require('fs');
const f = 'Workspace.tsx';
let s = fs.readFileSync(f, 'utf8');
let fixes = 0;

// 1: Fix the broken preview tab price section
// Find: price ternary followed immediately by Bottom padding (missing closing tags)
const brokenPreview = `                        {item.kaspaPrice > 0 ? \`\${item.kaspaPrice} KAS\` : item.dollarPrice > 0 ? \`\$\${item.dollarPrice.toFixed(2)}\` : 'Price TBD'}
        
        {/* Bottom padding */}`;

const fixedPreview = `                        {item.kaspaPrice > 0 ? \`\${item.kaspaPrice} KAS\` : item.dollarPrice > 0 ? \`\$\${item.dollarPrice.toFixed(2)}\` : 'Price TBD'}
                      </Text>
                    </View>
                  )) : (
                    <Text style={{ fontSize: rs.font(11), color: COLORS.stone400, textAlign: 'center', paddingVertical: rs.s(12) }}>No items yet — add items in the Items tab</Text>
                  )}
                  {stash.length > 3 && <Text style={{ fontSize: rs.font(10), color: COLORS.amber600, textAlign: 'center', marginTop: rs.s(4) }}>+{stash.length - 3} more items</Text>}
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: rs.s(12), paddingVertical: rs.s(8), backgroundColor: COLORS.stone50 }}>
                  <Text style={{ fontSize: rs.font(9), color: COLORS.stone400 }}>{stash.length} items • {coupons.length} coupons</Text>
                  <Text style={{ fontSize: rs.font(9), color: COLORS.green600, fontWeight: 'bold' }}>✓ SDK Compliant</Text>
                </View>
              </View>
              <View style={{ backgroundColor: COLORS.amber50, borderRadius: rs.s(8), padding: rs.s(10) }}>
                <Text style={{ fontSize: rs.font(10), color: COLORS.amber700, textAlign: 'center' }}>Tap "Publish" to make this live on Arweave.</Text>
              </View>
            </SectionCard>
          </View>
        )}
        
        {/* Bottom padding */}`;

if (s.includes(brokenPreview)) {
  s = s.replace(brokenPreview, fixedPreview);
  fixes++;
  console.log('1: Fixed preview tab closing tags');
}

// 2: Truncate at first export default Workspace;
const marker = 'export default Workspace;';
const idx = s.indexOf(marker);
if (idx > 0) {
  const after = s.substring(idx + marker.length).trim();
  if (after.length > 100) {
    s = s.substring(0, idx + marker.length) + '\n';
    fixes++;
    console.log('2: Truncated', after.length, 'chars of duplicate');
  }
}

fs.writeFileSync(f, s);
console.log('Total fixes:', fixes);
const v = fs.readFileSync(f, 'utf8');
console.log('Exports:', (v.match(/export default Workspace;/g) || []).length);
console.log('Size:', v.length);
