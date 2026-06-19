const fs = require('fs');
let c = fs.readFileSync('townhallscreen.tsx', 'utf8');
// Change "already verified" block to include a re-verify button
c = c.replace(
  "You're verified! Your content is visible in search.",
  "You're verified! Your content is visible in search.\\n\\nTap below to re-verify and inscribe proof to Arweave."
);
// Make the already-verified section also show the verify button
c = c.replace(
  '</Text>\n          </View>\n          ) : traitCount >= 6',
  '</Text>\n            <TouchableOpacity style={{backgroundColor:"#F59E0B",borderRadius:10,padding:12,marginTop:10,alignItems:"center"}} onPress={async()=>{await SecureStore.deleteItemAsync("kv_townhall_verified");setIsVerified(false);}}><Text style={{color:"#000",fontWeight:"700"}}>Re-verify + Inscribe to Arweave</Text></TouchableOpacity>\n          </View>\n          ) : traitCount >= 6'
);
fs.writeFileSync('townhallscreen.tsx', c);
console.log('OK: added re-verify button');
