const fs = require("fs");
let s = fs.readFileSync("ProfileScreen.tsx", "utf8");
let fixes = 0;

// 1. Add import
if (!s.includes('app_integrity_client')) {
  s = s.replace(
    "import * as Clipboard from 'expo-clipboard';",
    "import * as Clipboard from 'expo-clipboard';\nimport { shareApp } from './app_integrity_client';"
  );
  fixes++;
  console.log("  → app_integrity_client import added");
}

// 2. Add Share App button in the Security section (after Hardware Bind card)
const securityAnchor = s.indexOf("Hardware Bind");
if (securityAnchor > -1 && !s.includes("Share KasVillage")) {
  // Find a good insertion point after the security section
  const insertAnchor = s.indexOf("</ScrollView>");
  if (insertAnchor > -1) {
    const shareCard = `
          {/* Share App */}
          <View style={{ backgroundColor: '#1A1A2E', borderRadius: 16, padding: 16, marginTop: 12, borderWidth: 1, borderColor: '#10B981' }}>
            <Text style={{ color: '#10B981', fontSize: 16, fontWeight: '700', marginBottom: 8 }}>📲 Share KasVillage</Text>
            <Text style={{ color: '#888', fontSize: 12, marginBottom: 12 }}>
              Share the app with anyone — downloads from Arweave (permanent, uncensorable). Verified with your publisher signature.
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: '#10B981', borderRadius: 12, padding: 14, alignItems: 'center' }}
              onPress={() => shareApp()}
            >
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>📤 Share App Link</Text>
            </TouchableOpacity>
          </View>
`;
    s = s.slice(0, insertAnchor) + shareCard + s.slice(insertAnchor);
    fixes++;
    console.log("  → Share App card added to ProfileScreen");
  }
}

fs.writeFileSync("ProfileScreen.tsx", s, "utf8");
console.log("done:", fixes, "patches applied");
