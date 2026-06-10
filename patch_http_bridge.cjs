const fs = require("fs");
const path = require("path");

const gradleFile = path.join(__dirname, "node_modules", "react-native-http-bridge", "android", "build.gradle");

if (!fs.existsSync(gradleFile)) {
  console.log("⚠️  react-native-http-bridge not found in node_modules");
  process.exit(1);
}

let s = fs.readFileSync(gradleFile, "utf8");
let fixes = 0;

// Fix ancient gradle plugin version
if (s.includes("com.android.tools.build:gradle:2.2.0")) {
  s = s.replace(/com\.android\.tools\.build:gradle:2\.2\.0/g, "com.android.tools.build:gradle:8.1.0");
  fixes++;
  console.log("  → gradle plugin 2.2.0 → 8.1.0");
}

// Fix compileSdkVersion
if (s.match(/compileSdkVersion\s+\d+/)) {
  s = s.replace(/compileSdkVersion\s+\d+/g, "compileSdkVersion 34");
  fixes++;
  console.log("  → compileSdkVersion → 34");
}

// Remove old buildToolsVersion (modern AGP uses default)
if (s.match(/buildToolsVersion\s+["'][\d.]+["']/)) {
  s = s.replace(/buildToolsVersion\s+["'][\d.]+["']\s*\n?/g, "");
  fixes++;
  console.log("  → buildToolsVersion removed (use AGP default)");
}

// Fix targetSdkVersion
if (s.match(/targetSdkVersion\s+\d+/)) {
  s = s.replace(/targetSdkVersion\s+\d+/g, "targetSdkVersion 34");
  fixes++;
  console.log("  → targetSdkVersion → 34");
}

// Fix minSdkVersion
if (s.match(/minSdkVersion\s+\d+/)) {
  s = s.replace(/minSdkVersion\s+\d+/g, "minSdkVersion 24");
  fixes++;
  console.log("  → minSdkVersion → 24");
}

// jcenter is dead — replace with mavenCentral
if (s.includes("jcenter()")) {
  s = s.replace(/jcenter\(\)/g, "mavenCentral()");
  fixes++;
  console.log("  → jcenter() → mavenCentral()");
}

if (fixes > 0) {
  fs.writeFileSync(gradleFile, s, "utf8");
  console.log(`✅ react-native-http-bridge build.gradle — ${fixes} fixes applied`);
  console.log("\nNext: npx patch-package react-native-http-bridge");
} else {
  console.log("⚠️  No patterns matched. Current file:");
  console.log(s);
}
