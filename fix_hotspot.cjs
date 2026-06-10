const fs = require("fs");
let s = fs.readFileSync("QRPayNearby.tsx", "utf8");

s = s.replace(
  "Linking.openURL('App-Prefs:root=INTERNET_TETHERING').catch(() => Linking.openSettings());",
  "Linking.openURL('App-Prefs:root=INTERNET_TETHERING').catch(() => { Alert.alert('Hotspot', 'Go to Settings > Personal Hotspot > Turn On'); });"
);

s = s.replace(
  "Linking.sendIntent('android.settings.TETHERING_SETTINGS').catch(() => Linking.openSettings());",
  "Linking.sendIntent('android.settings.TETHERING_SETTINGS').catch(() => { Alert.alert('Hotspot', 'Go to Settings > Mobile Hotspot > Turn On'); });"
);

fs.writeFileSync("QRPayNearby.tsx", s, "utf8");
console.log("fixed");
