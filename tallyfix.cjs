const fs=require('fs');let q=fs.readFileSync('QRPayNearby.tsx','utf8');
q=q.replace("                <Text style={{ color: '#49d6aa', fontSize: rs(13), fontWeight: '600' }}>Store Tally / Cash Register</Text>\n              </TouchableOpacity>\n            </View>\n            {/* Hotspot Info */}","                <Text style={{ color: '#49d6aa', fontSize: rs(13), fontWeight: '600' }}>Store Tally / Cash Register</Text>\n              </TouchableOpacity>\n            {/* Hotspot Info */}");
fs.writeFileSync('QRPayNearby.tsx',q);console.log('done');
