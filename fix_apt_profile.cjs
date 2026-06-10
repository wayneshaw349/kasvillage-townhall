const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "ProfileScreen.tsx");
if (!fs.existsSync(file)) { console.log("⚠️  ProfileScreen.tsx not found"); process.exit(1); }
let s = fs.readFileSync(file, "utf8");
let fixes = 0;

// PATCH 1: Replace hardcoded APT-303 with dynamic derivation from SecureStore
const oldApt = "const [aptNumber] = useState('APT-303');";
const newApt = `const [aptNumber, setAptNumber] = useState('APT-...');

  // Derive real APT from pubkey (same as TownHall)
  useEffect(() => {
    (async () => {
      try {
        // Check stored alias first
        const stored = await SecureStore.getItemAsync('apt_alias');
        if (stored) { setAptNumber(stored); return; }
        // Derive from pubkey
        const pubkey = await SecureStore.getItemAsync('kv_l1_pubkey') || await SecureStore.getItemAsync('kaspa_pubkey') || await SecureStore.getItemAsync('kv_public_key') || '';
        if (pubkey && pubkey.length >= 10) {
          const hexSlice = pubkey.slice(2, 9);
          const num = parseInt(hexSlice, 16) % 10000000;
          const apt = 'APT-' + num.toString();
          setAptNumber(apt);
        }
      } catch {} 
    })();
  }, []);`;

if (s.includes(oldApt)) {
  s = s.replace(oldApt, newApt);
  fixes++;
  console.log("  → APT derivation from pubkey added");
}

// PATCH 2: Add Clipboard import
if (!s.includes("Clipboard") && !s.includes("expo-clipboard")) {
  const lastImportIdx = s.lastIndexOf("\nimport ");
  if (lastImportIdx > -1) {
    const lineEnd = s.indexOf("\n", lastImportIdx + 1);
    s = s.slice(0, lineEnd + 1) + "import * as Clipboard from 'expo-clipboard';\n" + s.slice(lineEnd + 1);
    fixes++;
    console.log("  → Clipboard import added");
  }
}

// PATCH 3: Make APT badge tappable to copy
const oldBadge = `<View style={styles.aptBadge}>
            <Text style={styles.aptText}>{aptNumber}</Text>
          </View>`;
const newBadge = `<TouchableOpacity 
            style={styles.aptBadge}
            onPress={async () => {
              await Clipboard.setStringAsync(aptNumber);
              Alert.alert('Copied!', aptNumber + ' copied to clipboard');
            }}
            onLongPress={async () => {
              const addr = await SecureStore.getItemAsync('kaspa_address') || '';
              if (addr) {
                await Clipboard.setStringAsync(addr);
                Alert.alert('Address Copied!', addr.slice(0, 30) + '...');
              }
            }}
          >
            <Text style={styles.aptText}>{aptNumber}</Text>
            <Text style={{ color: '#1C1917', fontSize: 8, opacity: 0.6 }}>tap to copy</Text>
          </TouchableOpacity>`;

if (s.includes(oldBadge)) {
  s = s.replace(oldBadge, newBadge);
  fixes++;
  console.log("  → APT badge now tappable (tap=copy APT, long press=copy address)");
}

if (fixes > 0) {
  fs.writeFileSync(file, s, "utf8");
  console.log(`✅ ProfileScreen.tsx — ${fixes} patches applied`);
} else {
  console.log("⚠️  No patches applied");
}
