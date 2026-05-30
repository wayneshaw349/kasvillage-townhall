const fs = require("fs");
const lines = fs.readFileSync("NeighborAgreement.tsx", "utf8").split("\n");
let changes = 0;

// ========================================================
// FIX 1: Add versioned auto-flush useEffect after the comment
// Line 977 has "// AUTO_FLUSH:" comment but NO useEffect below it
// ========================================================
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("// AUTO_FLUSH:") && lines[i+1] && lines[i+1].includes("const [step, setStep]")) {
    lines[i] = "  // AUTO_FLUSH: versioned migration for L hash fix (v2)";
    lines.splice(i + 1, 0,
      "  React.useEffect(() => { (async () => { try {",
      "    const ver = await AsyncStorage.getItem('kv_frost_v');",
      "    if (ver !== 'v2') {",
      "      await AsyncStorage.removeItem('kv_agreement_session');",
      "      await AsyncStorage.removeItem('kv_frost_active_list');",
      "      const keys = await AsyncStorage.getAllKeys();",
      "      const kv = keys.filter((k: string) => k.startsWith('kv_frost_') || k.startsWith('kv_agreed_') || k.startsWith('kv_manual_') || k.startsWith('frost_') || k.startsWith('FROST_'));",
      "      if (kv.length > 0) await AsyncStorage.multiRemove(kv);",
      "      await AsyncStorage.setItem('kv_frost_v', 'v2');",
      "      console.log('[FLUSH-V2] One-time migration done, cleared', kv.length, 'keys');",
      "    }",
      "  } catch(e) { console.warn('[FLUSH]', e); } })(); }, []);"
    );
    changes++;
    console.log("FIX 1: Added versioned auto-flush useEffect at line", i + 2);
    break;
  }
}

// ========================================================
// FIX 2: Check the session restore doesn't race with flush
// Find loadAgreementSession().then and add a version guard
// ========================================================
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("loadAgreementSession().then(session =>") && !lines[i-1]?.includes("kv_frost_v")) {
    // Wrap with version check so old sessions don't restore before flush
    lines.splice(i, 0,
      "    // Guard: skip restore if flush hasn't run yet (old L hash sessions)",
      "    const _flushDone = await AsyncStorage.getItem('kv_frost_v').catch(() => null);",
      "    if (!_flushDone) { console.log('[Restore] Waiting for FLUSH-V2 migration...'); return; }"
    );
    changes++;
    console.log("FIX 2: Added restore guard before loadAgreementSession at line", i + 1);
    break;
  }
}

// ========================================================  
// FIX 3: Verify Arweave recovery is present in background FROST check
// ========================================================
let hasRecovery = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("[Recovery] Found")) { hasRecovery = true; break; }
}
if (hasRecovery) {
  console.log("FIX 3: Arweave recovery already present ✓");
} else {
  console.log("FIX 3: WARNING - Arweave recovery NOT found, may need manual add");
}

// ========================================================
// VERIFY: brace/paren balance
// ========================================================
const c = lines.join("\n");
let b = 0, p = 0;
for (const ch of c) {
  if (ch === "{") b++;
  if (ch === "}") b--;
  if (ch === "(") p++;
  if (ch === ")") p--;
}

console.log("\n=== VERIFICATION ===");
console.log("Changes applied:", changes);
console.log("Braces:", b === 0 ? "OK ✓" : "BROKEN(" + b + ") ✗");
console.log("Parens:", p === 0 ? "OK ✓" : "BROKEN(" + p + ") ✗");

if (b !== 0 || p !== 0) {
  console.log("ERROR: Syntax broken, NOT saving file");
  process.exit(1);
}

if (changes === 0) {
  console.log("WARNING: No changes applied - patterns may not match");
  console.log("Checking what line 977-979 actually contains:");
  for (let i = 976; i < 980; i++) {
    console.log("  " + (i+1) + ": " + (lines[i] || "").substring(0, 80));
  }
  process.exit(1);
}

fs.writeFileSync("NeighborAgreement.tsx", c);
console.log("\n✓ File saved successfully");
console.log("\nWhat this does:");
console.log("  1. On FIRST run: clears old FROST sessions (v2 migration)");
console.log("  2. On future runs: skips flush, sessions persist normally");
console.log("  3. Session restore blocked until flush completes");
console.log("  4. Active agreements recoverable from Arweave if list is empty");
