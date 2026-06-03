const fs = require('fs');
const f = 'Workspace.tsx';
let s = fs.readFileSync(f, 'utf8');
let changes = 0;

// === 1: Add positioning language below the publish note ===
const publishNote = "KasVillage verifies and posts to Arweave for you (FREE via Turbo)";
if (s.includes(publishNote) && !s.includes('directory and non-custodial escrow')) {
  s = s.replace(
    publishNote,
    publishNote + `</Text>
        <Text style={{ fontSize: rs.font(8), color: '#a8a29e', textAlign: 'center', marginTop: rs.s(4), lineHeight: rs.font(12) }}>KasVillage is a reputation-scored directory and non-custodial escrow tool. Listings are hosted on whitelisted social platforms. KasVillage does not facilitate, process, or intermediate any sale. SDK compliance scan does not constitute endorsement. Users assume all risk.`
  );
  changes++; console.log('1: Added positioning language');
}

// === 2: Replace "Verified" with "SDK Compliant" in Quality Gate success ===
if (s.includes("DApp Verified & Published!")) {
  s = s.replace("DApp Verified & Published!", "DApp SDK Compliant & Published!");
  changes++; console.log('2a: Verified → SDK Compliant (title)');
}
if (s.includes("Verify DApp for Display")) {
  s = s.replace("Verify DApp for Display", "SDK Compliance Check");
  changes++; console.log('2b: Verify → SDK Compliance Check (button)');
}
if (s.includes("DApp Quality Gate")) {
  s = s.replaceAll("DApp Quality Gate", "SDK Compliance Gate");
  changes++; console.log('2c: Quality Gate → Compliance Gate');
}

// === 3: Add video demo section to DApps tab ===
const bookShelfBtn = `            {/* Book Shelf */}
            <TouchableOpacity
              style={wsStyles.bookShelfBtn}
              onPress={() => setShowAcademicPanel(true)}
            >
              <Text style={wsStyles.bookShelfBtnText}>📚 Book Shelf (Academic Research P2P)</Text>
            </TouchableOpacity>`;

const videoDemo = `            {/* Video Demo — the listing IS the marketing */}
            <View style={{ backgroundColor: '#fef3c7', borderRadius: rs.s(12), padding: rs.s(14), marginBottom: rs.s(12), borderWidth: 1, borderColor: '#f59e0b' }}>
              <Text style={{ fontSize: rs.font(14), fontWeight: '900', color: '#92400e', marginBottom: rs.s(6) }}>🎬 Video Demo = Your Listing</Text>
              <Text style={{ fontSize: rs.font(11), color: '#b45309', lineHeight: rs.font(17), marginBottom: rs.s(10) }}>
                Post a short video demo of your DApp, game, or website on Instagram or TikTok. That video IS your storefront listing — buyers see the demo, tap through, and the SDK compliance badge proves it's safe.
              </Text>
              <View style={{ gap: rs.s(6) }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs.s(8) }}>
                  <Text style={{ fontSize: rs.font(18) }}>📸</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: rs.font(11), fontWeight: 'bold', color: '#92400e' }}>Instagram Reel (15-60s)</Text>
                    <Text style={{ fontSize: rs.font(9), color: '#b45309' }}>Show gameplay, UI walkthrough, or feature highlight</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs.s(8) }}>
                  <Text style={{ fontSize: rs.font(18) }}>🎵</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: rs.font(11), fontWeight: 'bold', color: '#92400e' }}>TikTok (15-60s)</Text>
                    <Text style={{ fontSize: rs.font(9), color: '#b45309' }}>Quick demo with trending audio = organic reach</Text>
                  </View>
                </View>
              </View>
              <View style={{ backgroundColor: '#fff', borderRadius: rs.s(8), padding: rs.s(10), marginTop: rs.s(10) }}>
                <Text style={{ fontSize: rs.font(9), color: '#78716c', textAlign: 'center', lineHeight: rs.font(14) }}>
                  No platform fees. No middleman. Your social media IS your storefront.{String.fromCharCode(10)}
                  KasVillage provides the trust layer (XP reputation + non-custodial escrow).{String.fromCharCode(10)}
                  The video demo IS the product listing.
                </Text>
              </View>
            </View>

            {/* Book Shelf */}
            <TouchableOpacity
              style={wsStyles.bookShelfBtn}
              onPress={() => setShowAcademicPanel(true)}
            >
              <Text style={wsStyles.bookShelfBtnText}>📚 Book Shelf (Academic Research P2P)</Text>
            </TouchableOpacity>`;

if (s.includes(bookShelfBtn)) {
  s = s.replace(bookShelfBtn, videoDemo);
  changes++; console.log('3: Added video demo section');
}

// === 4: Update compliance notice text ===
const oldCompliance = "Prohibited content apps are restricted and auto-rejected by protocol.";
if (s.includes(oldCompliance)) {
  s = s.replace(oldCompliance,
    "Prohibited content apps are restricted and auto-rejected by the SDK scanner. DApps are NOT visible in KasVillage unless they pass the SDK Compliance Gate. Post a video demo on Instagram/TikTok as your listing.");
  changes++; console.log('4: Updated compliance notice');
}

// === 5: Add positioning to Items tab empty state ===
const oldItemTip = "Each item links directly to your Instagram/Pinterest post";
if (s.includes(oldItemTip)) {
  s = s.replace(oldItemTip,
    "Each item links to your Instagram/Pinterest post — no platform fees, no middleman");
  changes++; console.log('5: Updated items empty state tip');
}

fs.writeFileSync(f, s);
console.log('\nTotal changes:', changes);

const v = fs.readFileSync(f, 'utf8');
console.log('Verify - positioning language:', v.includes('directory and non-custodial escrow'));
console.log('Verify - SDK Compliant:', v.includes('SDK Compliant'));
console.log('Verify - Compliance Gate:', v.includes('Compliance Gate'));
console.log('Verify - video demo section:', v.includes('Video Demo'));
console.log('Verify - Instagram Reel:', v.includes('Instagram Reel'));
console.log('Verify - TikTok:', v.includes('TikTok'));
console.log('Verify - no middleman:', v.includes('no middleman'));
