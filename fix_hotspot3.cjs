const fs = require("fs");
let s = fs.readFileSync("QRPayNearby.tsx", "utf8");

// iOS can't deep-link to Settings root/WiFi/Hotspot anymore (Apple blocks it).
// Android CAN open tethering settings directly. So: Android = deep link, iOS = alert.
const oldBlock = `onPress={() => {
                  if (Platform.OS === 'ios') {
                    Linking.openURL('App-Prefs:').catch(() => { Alert.alert('Hotspot', 'Go to Settings > Personal Hotspot > Turn On'); });
                  } else {
                    Linking.sendIntent('android.settings.TETHERING_SETTINGS').catch(() => { Alert.alert('Hotspot', 'Go to Settings > Mobile Hotspot > Turn On'); });
                  }
                }}`;

const newBlock = `onPress={() => {
                  if (Platform.OS === 'ios') {
                    Alert.alert(
                      '📶 Turn On Personal Hotspot',
                      'iOS does not allow apps to open Hotspot settings directly.\\n\\nSwipe up for Control Center, or go to:\\n\\nSettings → Personal Hotspot → toggle ON',
                      [{ text: 'Got it' }]
                    );
                  } else {
                    Linking.sendIntent('android.settings.TETHERING_SETTINGS').catch(() => { Alert.alert('Hotspot', 'Go to Settings > Mobile Hotspot > Turn On'); });
                  }
                }}`;

if (s.includes(oldBlock)) {
  s = s.replace(oldBlock, newBlock);
  fs.writeFileSync("QRPayNearby.tsx", s, "utf8");
  console.log("fixed: iOS shows instructions, Android deep-links to tethering");
} else {
  console.log("⚠️ block not found — may have changed");
}
