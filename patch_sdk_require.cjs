const fs = require('fs');
let changes = 0;

// === 1: Patch procedural_sdk.ts — require SDK imports ===
const sdk = 'procedural_sdk.ts';
try {
  let s = fs.readFileSync(sdk, 'utf8');

  if (!s.includes('REQUIRED_SDK_IMPORTS')) {
    s = s.replace(
      "export const SDK_VERSION = '2.0.0';",
      `// Required SDK module imports — DApps MUST import at least one
export const REQUIRED_SDK_IMPORTS = [
  'procedural_sdk',
  'kasvillage_avatar_engine',
  'kasvillage_canvas_renderer',
  'kasvillage_audio_ui',
  'kasvillage_game_v1',
  'kasvillage_game_input_paint',
  'kasvillage_environments',
  'kasvillage_particles',
  'kasvillage_item_library',
  'kasvillage_shape_dictionary',
  'kasvillage_detail_engine',
  'kasvillage_skia_adapter',
  'kasvillage_wallet_bridge',
  'kasvillage_vscode_sdk',
];

export const SDK_VERSION = '2.0.0';`
    );
    changes++; console.log('1: Added REQUIRED_SDK_IMPORTS');
  }

  // Add SDK import check to scanDAppCode return
  const marker = "  return {\n    passed: violations.length === 0,\n    violations,\n    warnings,\n    stats: {\n      linesScanned: lines.length,\n      patternsChecked: lines.filter(l => l.trim() && !l.trim().startsWith('//')).length,\n      whitelistApplied,\n      blockedCount: violations.length,\n    }\n  };\n}";
  if (s.includes(marker) && !s.includes('missing_sdk_import')) {
    s = s.replace(marker, `  // SDK IMPORT REQUIREMENT — must use at least one KasVillage module
  const hasSDKImport = REQUIRED_SDK_IMPORTS.some(mod => 
    code.includes("from './" + mod + "'") || code.includes("from '" + mod + "'") ||
    code.includes('from "./' + mod + '"') || code.includes('from "' + mod + '"') ||
    code.includes("from '@kasvillage/") || code.includes("require('./" + mod + "')")
  );
  if (!hasSDKImport) {
    violations.push({ line: 1, pattern: 'missing_sdk_import', code: '(entire file)', severity: 'critical' });
    warnings.push({ line: 1, pattern: 'sdk_required', code: '', note: 'DApps must import from at least one KasVillage SDK module. Build with the SDK — not around it.' });
  } else { whitelistApplied++; }
  // Warn if using raw fetch without kvFetch
  if ((code.match(/[^a-zA-Z]fetch\\s*\\(/g)?.length || 0) > 0 && !code.includes('kvFetch')) {
    warnings.push({ line: 0, pattern: 'raw_fetch_without_kvFetch', code: '', note: 'Use kvFetch() from SDK instead of raw fetch(). kvFetch blocks image responses at runtime.' });
  }

  return {
    passed: violations.length === 0,
    violations,
    warnings,
    stats: {
      linesScanned: lines.length,
      patternsChecked: lines.filter(l => l.trim() && !l.trim().startsWith('//')).length,
      whitelistApplied,
      blockedCount: violations.length,
      sdkImportFound: hasSDKImport,
    }
  };
}`);
    changes++; console.log('2: Added SDK import check to scanner');
  }

  fs.writeFileSync(sdk, s);
} catch (e) {
  console.log('SKIP: procedural_sdk.ts not found in this directory — apply on local machine');
}

// === 2: Patch Workspace.tsx — show SDK requirement in Tab 5 ===
try {
  let w = fs.readFileSync('Workspace.tsx', 'utf8');
  if (w.includes('DApp Template') && !w.includes('Required SDK Modules')) {
    w = w.replace(
      `<View style={wsStyles.templateBox}>
              <Text style={wsStyles.templateTitle}>DApp Template</Text>`,
      `<View style={{ backgroundColor: '#fef2f2', borderRadius: rs.s(12), padding: rs.s(12), marginBottom: rs.s(12), borderWidth: 1, borderColor: '#fca5a5' }}>
              <Text style={{ fontSize: rs.font(12), fontWeight: 'bold', color: '#991b1b', marginBottom: rs.s(6) }}>⚠️ Required SDK Modules</Text>
              <Text style={{ fontSize: rs.font(10), color: '#b91c1c', marginBottom: rs.s(8) }}>Your DApp MUST import from at least one KasVillage SDK module. No SDK import = scan fails.</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: rs.s(4) }}>
                {['procedural_sdk', 'avatar_engine', 'canvas_renderer', 'audio_ui', 'game_v1', 'game_input', 'environments', 'particles', 'item_library', 'wallet_bridge'].map(m => (
                  <View key={m} style={{ backgroundColor: '#fff', paddingHorizontal: rs.s(6), paddingVertical: rs.s(2), borderRadius: rs.s(4), borderWidth: 1, borderColor: '#fca5a5' }}>
                    <Text style={{ fontSize: rs.font(8), fontFamily: 'monospace', color: '#991b1b' }}>{m}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ fontSize: rs.font(9), color: '#b91c1c', marginTop: rs.s(6) }}>Use kvFetch() instead of raw fetch() — blocks image responses at runtime.</Text>
            </View>
            <View style={wsStyles.templateBox}>
              <Text style={wsStyles.templateTitle}>DApp Template</Text>`
    );
    changes++; console.log('3: Added Required SDK Modules panel to Tab 5');
  }
  fs.writeFileSync('Workspace.tsx', w);
} catch (e) {
  console.log('SKIP: Workspace.tsx not found');
}

console.log('\nTotal changes:', changes);
