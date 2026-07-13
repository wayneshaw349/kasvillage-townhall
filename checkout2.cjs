const fs=require('fs');let q=fs.readFileSync('QRPayNearby.tsx','utf8');
const anchor="{/* STORE TALLY */}";
const i=q.indexOf(anchor);
if(i<0){console.log('ANCHOR FAIL');process.exit(1);}
const screens=`{/* SHOP MODE - customer scans items */}
        {mode === 'shop' && (
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(12) }}>
              <TouchableOpacity onPress={() => { setCameraActive(false); setMode('choose'); setCart([]); }}>
                <Text style={{ color: '#F59E0B', fontSize: rs(14) }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ color: '#49d6aa', fontSize: rs(16), fontWeight: '700' }}>Scan Items</Text>
              <Text style={{ color: '#FFF', fontSize: rs(14) }}>{cart.length} items</Text>
            </View>
            {!cameraPermission?.granted ? (
              <TouchableOpacity onPress={requestCameraPermission} style={{ backgroundColor: '#49d6aa', borderRadius: rs(10), padding: rs(14), alignItems: 'center' }}>
                <Text style={{ color: '#000', fontWeight: '700' }}>Allow Camera</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ borderRadius: rs(12), overflow: 'hidden', height: rs(240) }}>
                <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={({ data }) => {
                    try {
                      const parsed = JSON.parse(data);
                      if (parsed.type === 'kv_item' && parsed.id) {
                        addToCart({ id: parsed.id, name: parsed.name, priceKas: parsed.priceKas });
                      }
                    } catch {}
                  }}
                />
              </View>
            )}
            {cart.length > 0 && (
              <View style={{ marginTop: rs(12), backgroundColor: '#0D0D1A', borderRadius: rs(12), padding: rs(14) }}>
                <Text style={{ color: '#49d6aa', fontWeight: '700', marginBottom: rs(8), fontSize: rs(13) }}>Cart</Text>
                {cart.map(line => (
                  <View key={line.item.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: rs(4) }}>
                    <Text style={{ color: '#FFF', fontSize: rs(12) }}>{line.item.name} x{line.qty}</Text>
                    <Text style={{ color: '#87CEEB', fontSize: rs(12) }}>{(line.item.priceKas * line.qty).toFixed(2)} KAS</Text>
                  </View>
                ))}
                <View style={{ borderTopWidth: 1, borderTopColor: '#333', marginTop: rs(8), paddingTop: rs(8), flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: '#FFF', fontWeight: '700', fontSize: rs(14) }}>Total</Text>
                  <Text style={{ color: '#49d6aa', fontWeight: '700', fontSize: rs(14) }}>{cartTotal.toFixed(2)} KAS</Text>
                </View>
                <TouchableOpacity onPress={() => {
                  setCameraActive(false);
                  setRequestAmount(String(cartTotal));
                  setReceiptItems([...cart]);
                  setMode('ble_receive');
                  try { startReceiving(address, avatarName); } catch {}
                }} style={{ marginTop: rs(12), backgroundColor: '#49d6aa', borderRadius: rs(10), padding: rs(14), alignItems: 'center' }}>
                  <Text style={{ color: '#000', fontWeight: '700', fontSize: rs(14) }}>Finish Shopping — Pay {cartTotal.toFixed(2)} KAS</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        {/* VERIFY MODE - security scans receipt QR */}
        {mode === 'verify' && (
          <View>
            <TouchableOpacity onPress={() => { setMode('choose'); setVerifyResult(null); setScannedReceipt(null); }} style={{ marginBottom: rs(12) }}>
              <Text style={{ color: '#F59E0B', fontSize: rs(14) }}>Back</Text>
            </TouchableOpacity>
            <Text style={{ color: '#FFF', fontSize: rs(18), fontWeight: '700', marginBottom: rs(12) }}>Security Verify</Text>
            {!verifyResult ? (
              !cameraPermission?.granted ? (
                <TouchableOpacity onPress={requestCameraPermission} style={{ backgroundColor: '#49d6aa', borderRadius: rs(10), padding: rs(14), alignItems: 'center' }}>
                  <Text style={{ color: '#000', fontWeight: '700' }}>Allow Camera</Text>
                </TouchableOpacity>
              ) : (
                <View>
                  <Text style={{ color: '#888', fontSize: rs(12), textAlign: 'center', marginBottom: rs(8) }}>Scan customer receipt QR</Text>
                  <View style={{ borderRadius: rs(12), overflow: 'hidden', height: rs(260) }}>
                    <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                      onBarcodeScanned={({ data }) => {
                        try {
                          const r = JSON.parse(data);
                          if (r.type === 'kv_receipt' && r.hash && r.txId) {
                            setScannedReceipt(r);
                            const recheck = buildReceiptHash(r.items, r.txId);
                            setVerifyResult(recheck === r.hash ? 'valid' : 'invalid');
                          }
                        } catch {}
                      }}
                    />
                  </View>
                </View>
              )
            ) : (
              <View style={{ borderRadius: rs(16), padding: rs(20), alignItems: 'center', backgroundColor: verifyResult === 'valid' ? '#0D2818' : '#2a0a0a', borderWidth: 2, borderColor: verifyResult === 'valid' ? '#10B981' : '#e74c3c' }}>
                <Text style={{ fontSize: rs(48) }}>{verifyResult === 'valid' ? '✅' : '❌'}</Text>
                <Text style={{ color: verifyResult === 'valid' ? '#10B981' : '#e74c3c', fontSize: rs(22), fontWeight: '900', marginTop: rs(8) }}>{verifyResult === 'valid' ? 'PAID & VERIFIED' : 'INVALID RECEIPT'}</Text>
                {scannedReceipt && verifyResult === 'valid' && (
                  <View style={{ marginTop: rs(12), width: '100%' }}>
                    <Text style={{ color: '#49d6aa', fontWeight: '700', marginBottom: rs(6), fontSize: rs(13) }}>Items paid for:</Text>
                    {scannedReceipt.items?.map((l: CartLine) => (
                      <View key={l.item.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: rs(4) }}>
                        <Text style={{ color: '#FFF', fontSize: rs(12) }}>{l.item.name} x{l.qty}</Text>
                        <Text style={{ color: '#87CEEB', fontSize: rs(12) }}>{(l.item.priceKas * l.qty).toFixed(2)} KAS</Text>
                      </View>
                    ))}
                    <Text style={{ color: '#FFF', fontWeight: '700', marginTop: rs(8) }}>TX: {scannedReceipt.txId?.slice(0,20)}...</Text>
                  </View>
                )}
                <TouchableOpacity onPress={() => { setVerifyResult(null); setScannedReceipt(null); }} style={{ marginTop: rs(16), backgroundColor: '#333', borderRadius: rs(10), padding: rs(12), alignItems: 'center', width: '100%' }}>
                  <Text style={{ color: '#FFF', fontSize: rs(13) }}>Scan Next Customer</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        `;
q=q.slice(0,i)+screens+q.slice(i);
// Add Shop + Verify buttons to tally choose screen
q=q.replace("onPress={() => setMode('tally')}>","onPress={() => setMode('tally')}>");
q=q.replace("<Text style={{ color: '#49d6aa', fontSize: rs(13), fontWeight: '600' }}>Store Tally / Cash Register</Text>","<Text style={{ color: '#49d6aa', fontSize: rs(13), fontWeight: '600' }}>🧮 Store Tally / Cash Register</Text>");
// Add verify button after tally button
q=q.replace("{/* Hotspot Info */}","<TouchableOpacity style={{ marginTop: rs(8), backgroundColor: '#1A1A2E', borderRadius: rs(12), padding: rs(14), alignItems: 'center', borderWidth: 1, borderColor: '#e74c3c' }} onPress={() => setMode('verify')}>\n                <Text style={{ color: '#e74c3c', fontSize: rs(13), fontWeight: '600' }}>🔍 Security Verify</Text>\n              </TouchableOpacity>\n            {/* Hotspot Info */}");
// Wire receipt QR generation after payment — patch the Charge button to also set receipt
q=q.replace("setRequestAmount(String(cartTotal)); setCart([]); setMode('ble_receive');","setRequestAmount(String(cartTotal)); setReceiptItems([...cart]); setCart([]); setMode('ble_receive');");
fs.writeFileSync('QRPayNearby.tsx',q);console.log('done');
