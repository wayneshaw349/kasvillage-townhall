const fs = require("fs");
const path = require("path");

const gradleFile = path.join(__dirname, "node_modules", "react-native-ble-advertiser", "android", "build.gradle");

if (!fs.existsSync(gradleFile)) {
  console.log("⚠️  react-native-ble-advertiser not installed. Run: npm install react-native-ble-advertiser --save");
  process.exit(1);
}

let s = fs.readFileSync(gradleFile, "utf8");
let fixes = 0;

// Fix compileSdkVersion
if (s.match(/compileSdkVersion\s+28/)) {
  s = s.replace(/compileSdkVersion\s+28/g, "compileSdkVersion 34");
  fixes++;
}
if (s.match(/compileSdkVersion\s+rootProject\.ext\.compileSdkVersion/)) {
  console.log("  compileSdkVersion already uses rootProject — OK");
}

// Fix buildToolsVersion
if (s.match(/buildToolsVersion\s+["']28\.0\.3["']/)) {
  s = s.replace(/buildToolsVersion\s+["']28\.0\.3["']/g, 'buildToolsVersion "34.0.0"');
  fixes++;
}

// Fix targetSdkVersion
if (s.match(/targetSdkVersion\s+28/)) {
  s = s.replace(/targetSdkVersion\s+28/g, "targetSdkVersion 34");
  fixes++;
}

// Fix minSdkVersion if too old
if (s.match(/minSdkVersion\s+16/)) {
  s = s.replace(/minSdkVersion\s+16/g, "minSdkVersion 24");
  fixes++;
}

if (fixes > 0) {
  fs.writeFileSync(gradleFile, s, "utf8");
  console.log(`✅ react-native-ble-advertiser build.gradle — ${fixes} fixes applied (SDK 28 → 34)`);
  console.log("\n⚠️  IMPORTANT: This patches node_modules which EAS re-installs from npm.");
  console.log("   To persist for EAS builds, use patch-package:");
  console.log("   npm install patch-package --save-dev");
  console.log("   npx patch-package react-native-ble-advertiser");
  console.log("   Then add to package.json scripts: \"postinstall\": \"patch-package\"");
} else {
  console.log("⚠️  No fixes needed or patterns not found. Current content:");
  console.log(s.slice(0, 800));
}
