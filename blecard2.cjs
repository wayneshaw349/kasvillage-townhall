const fs=require('fs');let q=fs.readFileSync('QRPayNearby.tsx','utf8');
const anchor=">{address}</Text>";
const endAnchor="</View>";
const i=q.indexOf(anchor);
if(i<0){console.log('ANCHOR1 FAIL');process.exit(1);}
const j=q.indexOf(endAnchor,i+anchor.length);
if(j<0){console.log('ANCHOR2 FAIL');process.exit(1);}
const before=q.slice(0,i+anchor.length);
const after=q.slice(j+endAnchor.length);
const insert=`
              <View style={{ backgroundColor: '#FFF', padding: rs(12), borderRadius: rs(10), marginTop: rs(16) }}>
                <QRCode value={qrPayload} size={rs(180)} />
              </View>
              <Text style={{ color: '#87CEEB', fontSize: rs(10), marginTop: rs(8), textAlign: 'center' }}>Scan to connect + get address{parseFloat(requestAmount) > 0 ? ' + ' + requestAmount + ' KAS request' : ''}</Text>
              <TextInput value={requestAmount} onChangeText={setRequestAmount} placeholder="Request amount (KAS)" placeholderTextColor="#666" keyboardType="decimal-pad" style={{ width: '100%', backgroundColor: '#0D0D1A', color: '#FFF', borderRadius: rs(10), padding: rs(10), marginTop: rs(12), borderWidth: 1, borderColor: '#333', textAlign: 'center' }} />
            </View>
            <View style={{ flexDirection: 'row', gap: rs(8), marginTop: rs(14), width: '100%' }}>
              <TouchableOpacity style={{ flex: 1, backgroundColor: '#F59E0B', borderRadius: rs(12), padding: rs(14), alignItems: 'center' }} onPress={() => { stopReceiving(); setMode('send_proposal'); }}>
                <Text style={{ color: '#000', fontWeight: '700', fontSize: rs(14) }}>Send KAS</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, backgroundColor: '#1A1A2E', borderRadius: rs(12), padding: rs(14), alignItems: 'center', borderWidth: 1, borderColor: '#D4AF37' }} onPress={() => { stopReceiving(); setShowIOUSheet(true); }}>
                <Text style={{ color: '#D4AF37', fontWeight: '700', fontSize: rs(14) }}>Create IOU</Text>
              </TouchableOpacity>
            </View>`;
q=before+insert+after;
if(!q.includes("const [requestAmount")) q=q.replace("const [showIOUSheet, setShowIOUSheet] = useState(false);","const [showIOUSheet, setShowIOUSheet] = useState(false);\n  const [requestAmount, setRequestAmount] = useState('');");
fs.writeFileSync('QRPayNearby.tsx',q);console.log('done');
