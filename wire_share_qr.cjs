const fs = require("fs");
let s = fs.readFileSync("ProfileScreen.tsx", "utf8");
let fixes = 0;

// Add QRCode import if not present
if (!s.includes("react-native-qrcode-svg")) {
  s = s.replace(
    "import { shareApp } from './app_integrity_client';",
    "import { shareApp, getShareQRData } from './app_integrity_client';\nimport QRCode from 'react-native-qrcode-svg';"
  );
  fixes++;
  console.log("  → QRCode + getShareQRData imports added");
}

// Add state for QR data
if (!s.includes("appQRData")) {
  // Find existing useState declarations
  const stateAnchor = s.indexOf("const [aptNumber]");
  if (stateAnchor > -1) {
    const lineEnd = s.indexOf("\n", stateAnchor);
    s = s.slice(0, lineEnd + 1) +
      "  const [appQRData, setAppQRData] = useState<string | null>(null);\n" +
      "  const [showAppQR, setShowAppQR] = useState(false);\n" +
      s.slice(lineEnd + 1);
    fixes++;
    console.log("  → QR state vars added");
  }
}

// Replace the simple share button with QR + share
const oldShareCard = `<TouchableOpacity
              style={{ backgroundColor: '#10B981', borderRadius: 12, padding: 14, alignItems: 'center' }}
              onPress={() => shareApp()}
            >
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>📤 Share App Link</Text>
            </TouchableOpacity>`;

const newShareCard = `<TouchableOpacity
              style={{ backgroundColor: '#10B981', borderRadius: 12, padding: 14, alignItems: 'center' }}
              onPress={async () => {
                const data = await getShareQRData();
                if (data) { setAppQRData(data.downloadUrl); setShowAppQR(!showAppQR); }
                else { Alert.alert('Not Published', 'App not yet on Arweave.'); }
              }}
            >
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>{showAppQR ? '▲ Hide QR' : '▼ Show QR Code'}</Text>
            </TouchableOpacity>
            {showAppQR && appQRData && (
              <View style={{ alignItems: 'center', marginTop: 12, backgroundColor: '#FFF', borderRadius: 16, padding: 16 }}>
                <QRCode value={appQRData} size={180} backgroundColor="#FFF" color="#000" />
                <Text style={{ color: '#333', fontSize: 10, marginTop: 8, textAlign: 'center' }}>Scan to download KasVillage</Text>
              </View>
            )}
            <TouchableOpacity
              style={{ backgroundColor: '#333', borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 8 }}
              onPress={() => shareApp()}
            >
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>📤 Share via Text</Text>
            </TouchableOpacity>`;

if (s.includes(oldShareCard)) {
  s = s.replace(oldShareCard, newShareCard);
  fixes++;
  console.log("  → QR code display + share button added");
}

fs.writeFileSync("ProfileScreen.tsx", s, "utf8");
console.log("done:", fixes, "patches applied");
