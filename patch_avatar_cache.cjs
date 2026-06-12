#!/usr/bin/env node
// patch_avatar_cache.cjs
// Adds sprite cache (AsyncStorage) + chess piece helpers to kasvillage_avatar_engine.ts

const fs = require('fs');
const path = require('path');

const enginePath = path.join(__dirname, 'kasvillage_avatar_engine.ts');
const snippetPath = path.join(__dirname, '_avatar_cache_snippet.ts');

if (!fs.existsSync(enginePath)) {
  console.error('ERROR: kasvillage_avatar_engine.ts not found');
  process.exit(1);
}
if (!fs.existsSync(snippetPath)) {
  console.error('ERROR: _avatar_cache_snippet.ts not found (should be next to this script)');
  process.exit(1);
}

let src = fs.readFileSync(enginePath, 'utf8');
const snippet = fs.readFileSync(snippetPath, 'utf8');
let patches = 0;

// 1. Add AsyncStorage import if not present
if (!src.includes('AsyncStorage')) {
  // Find the SecureStore import line
  const ssImport = "import * as SecureStore from 'expo-secure-store';";
  if (src.includes(ssImport)) {
    src = src.replace(
      ssImport,
      ssImport + "\nimport AsyncStorage from '@react-native-async-storage/async-storage';"
    );
  } else {
    // Fallback: find last import and add after
    const lines = src.split('\n');
    let lastImportLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ')) lastImportLine = i;
    }
    if (lastImportLine >= 0) {
      lines.splice(lastImportLine + 1, 0, "import AsyncStorage from '@react-native-async-storage/async-storage';");
      src = lines.join('\n');
    }
  }
  patches++;
  console.log('  \u2192 AsyncStorage import added');
} else {
  console.log('  \u2713 AsyncStorage already imported');
}

// 2. Insert cache + chess snippet before USAGE comment block
if (src.includes('getChessPieceSVG')) {
  console.log('  \u2713 Chess helpers already present');
} else {
  const marker = '// ============================================================================\n// USAGE (the 10-line developer promise)';
  if (src.includes(marker)) {
    src = src.replace(marker, snippet + '\n\n' + marker);
    patches++;
    console.log('  \u2192 Cache system + chess helpers inserted before USAGE block');
  } else {
    // Fallback: append to end of file
    src += '\n' + snippet;
    patches++;
    console.log('  \u2192 Cache system + chess helpers appended to end');
  }
}

// 3. Write patched file
fs.writeFileSync(enginePath, src, 'utf8');

// 4. Dep check
const pkgPath = path.join(__dirname, 'package.json');
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
  if (deps['@react-native-async-storage/async-storage']) {
    console.log('  \u2713 AsyncStorage dependency found');
  } else {
    console.log('  \u26A0 Missing @react-native-async-storage/async-storage \u2014 run:');
    console.log('    npx expo install @react-native-async-storage/async-storage');
  }
}

// 5. Clean up snippet file (optional — remove after patching)
// fs.unlinkSync(snippetPath);
// console.log('  \u2192 Snippet file cleaned up');

console.log('done: ' + patches + ' patches applied');
