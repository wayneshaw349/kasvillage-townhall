const fs=require('fs');let q=fs.readFileSync('QRPayNearby.tsx','utf8');
// Tally button on choose screen — beside IOU button (insert before Hotspot Info)
const hotAnchor="{/* Hotspot Info */}";
const i=q.indexOf(hotAnchor);
if(i<0){console.log('HOTSPOT ANCHOR FAIL');process.exit(1);}
const tallyBtn=`<TouchableOpacity style={{ marginTop: rs(8), backgroundColor: '#1A1A2E', borderRadius: rs(12), padding: rs(14), alignItems: 'center', borderWidth: 1, borderColor: '#49d6aa' }} onPress={() => setMode('tally')}>
                <Text style={{ color: '#49d6aa', fontSize: rs(13), fontWeight: '600' }}>Store Tally / Cash Register</Text>
              </TouchableOpacity>
            </View>

            `;
// close the BLE/IOU wrapper View then add tally btn — insert just before hotspot comment
q=q.slice(0,i)+tallyBtn+q.slice(i);
// Tally + Catalog screens — insert before BLE RECEIVE
const bleAnchor="{/* BLE RECEIVE */}";
const j=q.indexOf(bleAnchor);
if(j<0){console.log('BLE ANCHOR FAIL');process.exit(1);}
const screens=`{/* STORE TALLY */}
        {mode === 'tally' && (
          <View>
            <TouchableOpacity onPress={() => setMode('choose')} style={{ marginBottom: rs(12) }}>
              <Text style={{ color: '#F59E0B', fontSize: rs(14) }}>Back</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(12) }}>
              <Text style={{ color: '#49d6aa', fontSize: rs(18), fontWeight: '700' }}>Cash Register</Text>
              <TouchableOpacity onPress={() => setMode('catalog')} style={{ backgroundColor: '#1A1A2E', borderRadius: rs(8), paddingVertical: rs(6), paddingHorizontal: rs(12), borderWidth: 1, borderColor: '#333' }}>
                <Text style={{ color: '#87CEEB', fontSize: rs(12) }}>Manage Items</Text>
              </TouchableOpacity>
            </View>
            {catalog.length === 0 && <Text style={{ color: '#666', textAlign: 'center', marginVertical: rs(20), fontSize: rs(13) }}>No items yet. Tap Manage Items to add.</Text>}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: rs(8) }}>
              {catalog.map(item => (
                <TouchableOpacity key={item.id} onPress={() => addToCart(item)} style={{ backgroundColor: '#1A1A2E', borderRadius: rs(10), padding: rs(12), borderWidth: 1, borderColor: '#333', minWidth: '30%' }}>
                  <Text style={{ color: '#FFF', fontSize: rs(13), fontWeight: '600' }}>{item.name}</Text>
                  <Text style={{ color: '#49d6aa', fontSize: rs(12) }}>{item.priceKas} KAS</Text>
                </TouchableOpacity>
              ))}
            </View>
            {cart.length > 0 && (
              <View style={{ marginTop: rs(16), backgroundColor: '#0D0D1A', borderRadius: rs(12), padding: rs(14) }}>
                <Text style={{ color: '#49d6aa', fontSize: rs(14), fontWeight: '700', marginBottom: rs(8) }}>Cart</Text>
                {cart.map(line => (
                  <View key={line.item.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(6) }}>
                    <Text style={{ color: '#FFF', fontSize: rs(13), flex: 1 }}>{line.item.name} x{line.qty}</Text>
                    <Text style={{ color: '#87CEEB', fontSize: rs(13), marginRight: rs(10) }}>{(line.item.priceKas * line.qty).toFixed(2)}</Text>
                    <TouchableOpacity onPress={() => removeFromCart(line.item.id)}><Text style={{ color: '#FF6B6B', fontSize: rs(16) }}>-</Text></TouchableOpacity>
                  </View>
                ))}
                <View style={{ borderTopWidth: 1, borderTopColor: '#333', marginTop: rs(8), paddingTop: rs(8), flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: '#FFF', fontSize: rs(15), fontWeight: '700' }}>Total</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: '#49d6aa', fontSize: rs(15), fontWeight: '700' }}>{cartTotal.toFixed(2)} KAS</Text>
                    {kasPrice?.usdPerKas > 0 && <Text style={{ color: '#666', fontSize: rs(11) }}>~\${(cartTotal * kasPrice.usdPerKas).toFixed(2)}</Text>}
                  </View>
                </View>
                <TouchableOpacity onPress={() => { setRequestAmount(String(cartTotal)); setCart([]); setMode('ble_receive'); try { startReceiving(address, avatarName); } catch {} }} style={{ marginTop: rs(12), backgroundColor: '#49d6aa', borderRadius: rs(10), padding: rs(14), alignItems: 'center' }}>
                  <Text style={{ color: '#000', fontSize: rs(14), fontWeight: '700' }}>Charge {cartTotal.toFixed(2)} KAS</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        {/* CATALOG */}
        {mode === 'catalog' && (
          <View>
            <TouchableOpacity onPress={() => setMode('tally')} style={{ marginBottom: rs(12) }}>
              <Text style={{ color: '#F59E0B', fontSize: rs(14) }}>Back to Register</Text>
            </TouchableOpacity>
            <Text style={{ color: '#49d6aa', fontSize: rs(18), fontWeight: '700', marginBottom: rs(12) }}>Item Catalog</Text>
            <View style={{ flexDirection: 'row', gap: rs(8), marginBottom: rs(12) }}>
              <TextInput value={newItemName} onChangeText={setNewItemName} placeholder="Item name" placeholderTextColor="#666" style={{ flex: 2, backgroundColor: '#1A1A2E', color: '#FFF', borderRadius: rs(8), padding: rs(10), borderWidth: 1, borderColor: '#333' }} />
              <TextInput value={newItemPrice} onChangeText={setNewItemPrice} placeholder="KAS" placeholderTextColor="#666" keyboardType="decimal-pad" style={{ flex: 1, backgroundColor: '#1A1A2E', color: '#FFF', borderRadius: rs(8), padding: rs(10), borderWidth: 1, borderColor: '#333' }} />
            </View>
            <TouchableOpacity onPress={() => { const p = parseFloat(newItemPrice); if (!newItemName.trim() || !(p > 0)) { Alert.alert('Invalid', 'Enter name and price'); return; } saveCatalog([...catalog, { id: 'i' + Date.now(), name: newItemName.trim(), priceKas: p }]); setNewItemName(''); setNewItemPrice(''); }} style={{ backgroundColor: '#49d6aa', borderRadius: rs(10), padding: rs(12), alignItems: 'center', marginBottom: rs(16) }}>
              <Text style={{ color: '#000', fontSize: rs(14), fontWeight: '700' }}>Add Item</Text>
            </TouchableOpacity>
            {catalog.map(item => (
              <View key={item.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1A1A2E', borderRadius: rs(10), padding: rs(12), marginBottom: rs(8) }}>
                <Text style={{ color: '#FFF', fontSize: rs(13) }}>{item.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs(12) }}>
                  <Text style={{ color: '#49d6aa', fontSize: rs(13) }}>{item.priceKas} KAS</Text>
                  <TouchableOpacity onPress={() => saveCatalog(catalog.filter(c => c.id !== item.id))}><Text style={{ color: '#FF6B6B', fontSize: rs(14) }}>Delete</Text></TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
        `;
q=q.slice(0,j)+screens+q.slice(j);
fs.writeFileSync('QRPayNearby.tsx',q);console.log('done');
