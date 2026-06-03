const fs = require('fs');
const f = 'VillageMailbox.tsx';
let s = fs.readFileSync(f, 'utf8');
let changes = 0;

// === 1: Replace the placeholder onPress with real link opening ===
const oldOnPress = "const onPress = () => console.log('Open:', item.id);";
const newOnPress = `const onPress = () => {
      // Route based on section type
      if (section === 'storefronts' && item.primaryLink) {
        Linking.openURL(item.primaryLink.startsWith('http') ? item.primaryLink : 'https://' + item.primaryLink);
      } else if (section === 'dapps' && item.arweaveTx) {
        // Open DApp page on Arweave gateway
        Linking.openURL('https://arweave.net/' + item.arweaveTx);
      } else if (section === 'academics') {
        // Open repository URL if available, otherwise Arweave TX
        if (item.repositoryUrl) Linking.openURL(item.repositoryUrl);
        else if (item.arweaveTx) Linking.openURL('https://arweave.net/' + item.arweaveTx);
      } else if (section === 'coupons') {
        // Copy coupon code
        try { Clipboard.setString(item.code || item.title || ''); Alert.alert('Coupon Copied!', (item.code || item.title) + ' — use at checkout in a Neighbor Agreement'); } catch { Alert.alert('Coupon', item.title || item.code || 'No code'); }
      } else if (section === 'services') {
        if (item.contactChannel) Linking.openURL(item.contactChannel);
        else if (item.arweaveTx) Linking.openURL('https://arweave.net/' + item.arweaveTx);
      } else {
        Alert.alert('Details', item.name || item.storeName || item.title || 'No details');
      }
    };`;

if (s.includes(oldOnPress)) {
  s = s.replace(oldOnPress, newOnPress);
  changes++; console.log('1: Wired onPress to open links');
}

// === 2: Add imports for Clipboard and Alert ===
if (!s.includes("import * as Clipboard") && !s.includes("Clipboard,")) {
  // Alert is already imported via react-native, just need Clipboard
  s = s.replace(
    "import * as SecureStore from 'expo-secure-store';",
    "import * as SecureStore from 'expo-secure-store';\nimport * as Clipboard from 'expo-clipboard';\nimport { Alert } from 'react-native';"
  );
  changes++; console.log('2: Added Clipboard + Alert imports');
}

// === 3: Add primaryLink display to StorefrontCard ===
const oldStoreCategory = "<Text style={cardStyles.storeCategory}>{item.category}</Text>";
if (s.includes(oldStoreCategory) && !s.includes('item.primaryLink')) {
  s = s.replace(
    oldStoreCategory,
    `<Text style={cardStyles.storeCategory}>{item.category}</Text>
      {item.primaryLink && <Text style={{ fontSize: rs.font(9), color: COLORS.indigo600, marginTop: rs.s(2) }} numberOfLines={1}>↗ {item.primaryLink.replace('https://', '').slice(0, 25)}...</Text>}`
  );
  changes++; console.log('3: Added primaryLink to StorefrontCard');
}

// === 4: Update the header subtitle with positioning language ===
const oldSubtitle = "Verified listings only";
if (s.includes(oldSubtitle)) {
  s = s.replace(oldSubtitle, "Discover stores, DApps & research — tap to visit");
  changes++; console.log('4: Updated header subtitle');
}

fs.writeFileSync(f, s);
console.log('\nTotal changes:', changes);
const v = fs.readFileSync(f, 'utf8');
console.log('Verify - Linking.openURL:', v.includes('Linking.openURL(item.primaryLink'));
console.log('Verify - coupon copy:', v.includes('Coupon Copied'));
console.log('Verify - arweave gateway:', v.includes('arweave.net/' ));
console.log('Verify - primaryLink display:', v.includes('item.primaryLink'));
