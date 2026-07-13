const fs=require('fs');let q=fs.readFileSync('QRPayNearby.tsx','utf8');
const t=q.indexOf("Store Tally / Cash Register</Text>");
if(t<0){console.log('FAIL1');process.exit(1);}
const to=q.indexOf("</TouchableOpacity>",t);
const ev=q.indexOf("</View>",to);
const hs=q.indexOf("{/* Hotspot Info */}",to);
if(to<0||ev<0||hs<0||ev>hs){console.log('FAIL2');process.exit(1);}
// remove the stray </View> between tally button and hotspot comment
q=q.slice(0,ev)+q.slice(ev+"</View>".length);
fs.writeFileSync('QRPayNearby.tsx',q);console.log('done');
