const fs = require('fs');
let c = fs.readFileSync('townhallscreen.tsx', 'utf8');

// Find the alreadyVerified section
const alreadyIdx = c.indexOf('alreadyVerified');
const traitCheck = c.indexOf('traitCount >= 6', alreadyIdx);
// Find the closing </View> + ) before traitCount >= 6
const closeParen = c.lastIndexOf(')', traitCheck);
const closeView = c.lastIndexOf('</View>', closeParen);

console.log('alreadyVerified at:', alreadyIdx);
console.log('traitCount >= 6 at:', traitCheck);
console.log('</View> at:', closeView);
console.log(') at:', closeParen);
console.log('Context:', c.substring(closeView, traitCheck + 20));

// Insert re-verify button between </View> closing and the ) : traitCount check
const insertPoint = closeParen + 1; // after the )
const nl = c[closeParen + 1] === '\r' ? '\r\n' : '\n';
const button = nl + '          {isVerified && (' + nl + '            <TouchableOpacity style={{backgroundColor:"#F59E0B",borderRadius:10,padding:12,marginTop:10,alignItems:"center"}} onPress={async()=>{await SecureStore.deleteItemAsync("kv_townhall_verified");setIsVerified(false);}}>' + nl + '              <Text style={{color:"#000",fontWeight:"700"}}>Re-verify + Inscribe to Arweave</Text>' + nl + '            </TouchableOpacity>' + nl + '          )}';

// Replace ") : traitCount >= 6" with ") \n {button} \n : traitCount >= 6"  
// Actually just insert after the )
if (!c.includes('Re-verify')) {
  c = c.substring(0, insertPoint) + button + c.substring(insertPoint);
  fs.writeFileSync('townhallscreen.tsx', c);
  console.log('OK: button inserted');
} else {
  console.log('Already has re-verify');
}
