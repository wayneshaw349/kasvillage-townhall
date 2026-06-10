const fs = require("fs");
let s = fs.readFileSync("QRPayNearby.tsx", "utf8");

// Add Linking import
s = s.replace(
  "import * as Clipboard from 'expo-clipboard';",
  "import * as Clipboard from 'expo-clipboard';\nimport { Linking } from 'react-native';"
);

// Replace hotspot steps with tappable button
s = s.replace(
  `1. Phone A → Settings → Hotspot → Turn On{'\\n'}
                2. Phone B → Connect to hotspot{'\\n'}
                3. Show/Scan QR code{'\\n'}
                4. Trade!`,
  `1. Tap below to open Hotspot settings{'\\n'}
                2. Other phone connects to your hotspot{'\\n'}
                3. Show/Scan QR code{'\\n'}
                4. Trade offline!`
);

// Add hotspot button after the steps text
s = s.replace(
  "</View>\n          </View>\n        )}\n\n        {/* RECEIVE MODE",
  `<TouchableOpacity
                style={{ backgroundColor: '#10B981', borderRadius: rs(10), padding: rs(12), marginTop: rs(10), alignItems: 'center' }}
                onPress={() => {
                  if (Platform.OS === 'ios') {
                    Linking.openURL('App-Prefs:root=INTERNET_TETHERING').catch(() => Linking.openSettings());
                  } else {
                    Linking.sendIntent('android.settings.TETHERING_SETTINGS').catch(() => Linking.openSettings());
                  }
                }}
              >
                <Text style={{ color: '#FFF', fontSize: rs(14), fontWeight: '700' }}>📶 Open Hotspot Settings</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* RECEIVE MODE`
);

fs.writeFileSync("QRPayNearby.tsx", s, "utf8");
console.log("done: hotspot settings link added");
