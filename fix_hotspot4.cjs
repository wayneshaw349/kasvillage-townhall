const fs = require("fs");
let s = fs.readFileSync("QRPayNearby.tsx", "utf8");

const old = "Linking.openURL('App-Prefs:').catch(() => { Alert.alert('Hotspot', 'Go to Settings > Personal Hotspot > Turn On'); });";

const rep = "Alert.alert('Turn On Hotspot', 'Go to Settings > Personal Hotspot > Toggle ON\\n\\nOr use Control Center (swipe down).', [{ text: 'Got it' }]);";

if (s.includes(old)) {
  s = s.replace(old, rep);
  fs.writeFileSync("QRPayNearby.tsx", s, "utf8");
  console.log("fixed");
} else {
  console.log("not found — checking for partial match");
  if (s.includes("App-Prefs:")) {
    // Fallback: replace the whole line
    s = s.replace(/Linking\.openURL\('App-Prefs:'\)[^;]*;/, rep);
    fs.writeFileSync("QRPayNearby.tsx", s, "utf8");
    console.log("fixed via fallback");
  } else {
    console.log("App-Prefs not found at all");
  }
}
