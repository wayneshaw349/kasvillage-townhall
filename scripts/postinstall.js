const fs = require('fs');
const p = 'node_modules/react-native-http-bridge/android/build.gradle';
if (fs.existsSync(p)) {
  let f = fs.readFileSync(p, 'utf8');
  f = f.replace('com.android.tools.build:gradle:2.2.0', 'com.android.tools.build:gradle:8.2.0');
  f = f.replace(/\bcompile\b/g, 'implementation');
  f = f.replace(/\btestCompile\b/g, 'testImplementation');
  f = f.replace(/compileSdkVersion\s+\d+/, 'compileSdkVersion 36');
  f = f.replace(/targetSdkVersion\s+\d+/, 'targetSdkVersion 36');
  f = f.replace(/minSdkVersion\s+\d+/, 'minSdkVersion 24');
  f = f.replace(/buildToolsVersion\s+['"][^'"]+['"]/, "buildToolsVersion '36.0.0'");
  fs.writeFileSync(p, f);
}
const s = 'node_modules/react-native-http-bridge/android/src/main/java/me/alwx/HttpServer/Server.java';
if (fs.existsSync(s)) {
  let f = fs.readFileSync(s, 'utf8');
  f = f.replace('import android.support.annotation.Nullable;', 'import androidx.annotation.Nullable;');
  fs.writeFileSync(s, f);
}
