const fs = require('fs');
let c = fs.readFileSync('townhallscreen.tsx', 'utf8');
// Add Linking import if missing
if (!c.includes("from 'react-native'") || !c.includes('Linking')) {
  c = c.replace("} from 'react-native';", "  Linking,\n} from 'react-native';");
  console.log('1. Added Linking import');
}
// Wire the View on Arweave button
const old = "{searchResult.arweaveTx && (\n                    <TouchableOpacity style={styles.arweaveLink}>";
const rep = "{searchResult.arweaveTx && (\n                    <TouchableOpacity style={styles.arweaveLink} onPress={() => Linking.openURL('https://arweave.net/' + searchResult.arweaveTx)}>";
if (c.includes('<TouchableOpacity style={styles.arweaveLink}>')) {
  c = c.replace('<TouchableOpacity style={styles.arweaveLink}>', "<TouchableOpacity style={styles.arweaveLink} onPress={() => Linking.openURL('https://arweave.net/' + searchResult.arweaveTx)}>");
  console.log('2. Wired View on Arweave link');
}
fs.writeFileSync('townhallscreen.tsx', c);
