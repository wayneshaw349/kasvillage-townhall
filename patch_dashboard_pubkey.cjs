const fs = require('fs');
const f = 'Dashboard.tsx';
let c = fs.readFileSync(f, 'utf8');

if (c.includes('DASH_PUBKEY_BTN')) { console.error('ABORT: already patched'); process.exit(1); }

// 1. Add Clipboard import after the SecureStore import.
const scImport = "import * as SecureStore from 'expo-secure-store';";
if (c.split(scImport).length - 1 !== 1) { console.error('ABORT: SecureStore import anchor not unique'); process.exit(1); }
c = c.replace(scImport, scImport + "\nimport * as Clipboard from 'expo-clipboard';");

// 2. Add the button as the first item in the actions View.
//    Anchor on the actions View opening (unique marker from the grep).
const actionsAnchor = '<View style={[walletStyles.actions, { paddingHorizontal: 4 }]}>';
if (c.split(actionsAnchor).length - 1 !== 1) { console.error('ABORT: actions View anchor count != 1'); process.exit(1); }

const btn = actionsAnchor + `
      {/* DASH_PUBKEY_BTN */}
      <TouchableOpacity style={[walletStyles.actionBtn, { borderRadius: 8 }]} onPress={async () => {
        try {
          const myPub = (await SecureStore.getItemAsync('kv_public_key'))
            || (await SecureStore.getItemAsync('kaspa_pubkey'))
            || (await SecureStore.getItemAsync('kv_l1_pubkey')) || '';
          if (myPub && /^0[23][0-9a-f]{64}$/i.test(myPub)) {
            await Clipboard.setStringAsync(myPub);
            Alert.alert('Copied', 'Your pubkey is copied. Share it with a counterparty to start a trade.');
          } else {
            Alert.alert('Not available', 'Your pubkey is not ready yet.');
          }
        } catch (e) { console.warn('[Dashboard][Pubkey] failed:', e); }
      }}>
        <Text style={walletStyles.actionIcon}>🔑</Text>
        <Text style={walletStyles.actionLabel}>My Pubkey</Text>
      </TouchableOpacity>`;

c = c.replace(actionsAnchor, btn);
fs.writeFileSync(f, c);
console.log('OK — Dashboard My Pubkey button added (+ Clipboard import)');
