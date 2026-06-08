const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "ProfileScreen.tsx");
if (!fs.existsSync(file)) { console.log("⚠️  ProfileScreen.tsx not found"); process.exit(1); }
let s = fs.readFileSync(file, "utf8");
let fixes = 0;

// PATCH 1: Add import
const lastImport = s.lastIndexOf("\nimport ");
if (lastImport > -1 && !s.includes("storeSerialHash")) {
  const lineEnd = s.indexOf("\n", lastImport + 1);
  s = s.slice(0, lineEnd + 1) +
    "import { storeSerialHash, getSerialHash } from './device_attestation';\n" +
    s.slice(lineEnd + 1);
  fixes++;
  console.log("  → import added");
}

// PATCH 2: Find a good place to add the serial UI
// Look for a section near the bottom of the profile content, before the last </ScrollView> or closing View
// We'll look for "Recovery" or "Mnemonic" or "Export" section as anchor, or just before the final style block

// Strategy: find "export default" or "const styles" and insert a component before it
// Better: find a section header like "Security" or add after the last TouchableOpacity in the profile

// Look for a pattern like "Danger Zone" or "Clear Data" or similar settings section
const dangerAnchor = s.match(/['"]Danger Zone['"]|['"]Clear Data['"]|['"]Reset['"]|['"]Security['"]|['"]Account['"]|['"]Settings['"]/);

// Alternative: find the ProfileScreen component and add a state + UI block
// Find the component function
const componentMatch = s.match(/(export\s+(?:default\s+)?function\s+ProfileScreen|const\s+ProfileScreen\s*[:=])/);
if (!componentMatch) {
  console.log("⚠️  Could not find ProfileScreen component");
} else {
  // Add state variables after first useState
  const firstUseState = s.indexOf("useState", componentMatch.index);
  if (firstUseState > -1 && !s.includes("serialInput")) {
    const lineEnd = s.indexOf("\n", firstUseState);
    s = s.slice(0, lineEnd + 1) +
      "  const [serialInput, setSerialInput] = React.useState('');\n" +
      "  const [serialHashed, setSerialHashed] = React.useState(false);\n" +
      "  const [existingSerialHash, setExistingSerialHash] = React.useState<string | null>(null);\n" +
      "\n" +
      "  // Check if serial already bound\n" +
      "  React.useEffect(() => {\n" +
      "    getSerialHash().then(h => { if (h) { setExistingSerialHash(h); setSerialHashed(true); } });\n" +
      "  }, []);\n" +
      s.slice(lineEnd + 1);
    fixes++;
    console.log("  → state variables + useEffect added");
  }
}

if (fixes > 0) {
  fs.writeFileSync(file, s, "utf8");
  console.log(`✅ ProfileScreen.tsx — ${fixes} patches applied`);
  console.log("\n⚠️  You still need to manually add the serial UI JSX to ProfileScreen.");
  console.log("   Add this block inside your profile's ScrollView/settings area:");
  console.log('   {/* Hardware Attestation */}');
  console.log('   Paste the serial bind UI card from the instructions.');
} else {
  console.log("⚠️  No patches applied (already done or structure unexpected)");
}
