const fs = require('fs');

// Fix procedural_sdk.ts - sdkImportFound not in ScanResult stats
const f1 = 'procedural_sdk.ts';
if (fs.existsSync(f1)) {
  let s = fs.readFileSync(f1, 'utf8');
  // Add sdkImportFound to the stats type in ScanResult
  if (s.includes('linesScanned: number;\n    patternsChecked: number;\n    whitelistApplied: number;\n    blockedCount: number;')) {
    s = s.replace(
      'linesScanned: number;\n    patternsChecked: number;\n    whitelistApplied: number;\n    blockedCount: number;',
      'linesScanned: number;\n    patternsChecked: number;\n    whitelistApplied: number;\n    blockedCount: number;\n    sdkImportFound?: boolean;'
    );
    fs.writeFileSync(f1, s);
    console.log('Fixed procedural_sdk.ts: added sdkImportFound to stats type');
  } else {
    console.log('procedural_sdk.ts: stats pattern not found');
  }
}
