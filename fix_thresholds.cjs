const fs = require("fs");
const path = require("path");

// ============================================================
// FIX 1: TownHallScreen.tsx — all hardcoded 13/18 → 6/10
// ============================================================
const thFile = path.join(__dirname, "townhallscreen.tsx");
if (fs.existsSync(thFile)) {
  let s = fs.readFileSync(thFile, "utf8");
  let fixes = 0;

  // handleVerify guard: traitCount < 13 → < 6
  if (s.includes("if (traitCount < 13)")) {
    s = s.replace("if (traitCount < 13)", "if (traitCount < 6)");
    fixes++;
  }

  // handleVerify alert: "You need 13 traits" → "You need 6 traits"
  if (s.includes("You need 13 traits to verify")) {
    s = s.replace("You need 13 traits to verify", "You need 6 traits to verify");
    fixes++;
  }

  // Verify button gate: traitCount >= 13 → >= 6
  if (s.includes("traitCount >= 13 ?")) {
    s = s.replace("traitCount >= 13 ?", "traitCount >= 6 ?");
    fixes++;
  }

  // "Need X more traits" text: 13 - traitCount → 6 - traitCount
  if (s.includes("{13 - traitCount}")) {
    s = s.replace("{13 - traitCount}", "{6 - traitCount}");
    fixes++;
  }

  // Progress bar width: traitCount / 13 → traitCount / 6
  if (s.includes("(traitCount / 13)")) {
    s = s.replace("(traitCount / 13)", "(traitCount / 6)");
    fixes++;
  }

  // Progress text: /13 traits → /6 traits
  if (s.includes("{traitCount}/13 traits")) {
    s = s.replace("{traitCount}/13 traits", "{traitCount}/6 traits");
    fixes++;
  }

  // Status display: /18 → /10
  if (s.includes("{traitCount}/18")) {
    s = s.replace("{traitCount}/18", "{traitCount}/10");
    fixes++;
  }

  // Info text: "Complete 13 avatar traits" → "Complete 6 avatar traits"
  if (s.includes("Complete 13 avatar traits")) {
    s = s.replace("Complete 13 avatar traits", "Complete 6 avatar traits");
    fixes++;
  }

  if (fixes > 0) {
    fs.writeFileSync(thFile, s, "utf8");
    console.log(`✅ TownHallScreen.tsx — ${fixes} threshold fixes applied`);
  } else {
    console.log("⚠️  TownHallScreen.tsx — no anchors found (already fixed?)");
  }
} else {
  console.log("⚠️  townhallscreen.tsx not found");
}

// ============================================================
// FIX 2: Workspace.tsx — CITADEL_SELLER_THRESHOLD 13 → 6
// ============================================================
const wsFile = path.join(__dirname, "Workspace.tsx");
if (fs.existsSync(wsFile)) {
  let s = fs.readFileSync(wsFile, "utf8");
  if (s.includes("const CITADEL_SELLER_THRESHOLD = 13")) {
    s = s.replace("const CITADEL_SELLER_THRESHOLD = 13", "const CITADEL_SELLER_THRESHOLD = 6");
    fs.writeFileSync(wsFile, s, "utf8");
    console.log("✅ Workspace.tsx — CITADEL_SELLER_THRESHOLD 13 → 6");
  } else {
    console.log("⚠️  Workspace.tsx — threshold not found or already fixed");
  }
} else {
  console.log("⚠️  Workspace.tsx not found");
}

// ============================================================
// FIX 3: ProfileScreen.tsx — thresholds if hardcoded
// ============================================================
const psFile = path.join(__dirname, "ProfileScreen.tsx");
if (fs.existsSync(psFile)) {
  let s = fs.readFileSync(psFile, "utf8");
  let fixes = 0;

  // CITADEL_BUYER_THRESHOLD = 9 → 5
  if (s.includes("CITADEL_BUYER_THRESHOLD = 9")) {
    s = s.replace("CITADEL_BUYER_THRESHOLD = 9", "CITADEL_BUYER_THRESHOLD = 5");
    fixes++;
  }
  // CITADEL_SELLER_THRESHOLD = 13 → 6
  if (s.includes("CITADEL_SELLER_THRESHOLD = 13")) {
    s = s.replace("CITADEL_SELLER_THRESHOLD = 13", "CITADEL_SELLER_THRESHOLD = 6");
    fixes++;
  }
  // /9 traits display
  if (s.includes("{traitCount}/9 traits")) {
    s = s.replace("{traitCount}/9 traits", "{traitCount}/5 traits");
    fixes++;
  }

  if (fixes > 0) {
    fs.writeFileSync(psFile, s, "utf8");
    console.log(`✅ ProfileScreen.tsx — ${fixes} threshold fixes applied`);
  } else {
    console.log("⚠️  ProfileScreen.tsx — no hardcoded thresholds found");
  }
} else {
  console.log("⚠️  ProfileScreen.tsx not found");
}

console.log("\n📋 Summary:");
console.log("  Buyer/Resident threshold: 5 traits");
console.log("  Seller/Passport threshold: 6 traits");
console.log("  Total possible traits: 10 (from ritual)");
console.log("  Device attestation: bonus trust, not required");
console.log("\n⚠️  Rust backend (main.rs) TRAITS_TO_BUY/TRAITS_TO_SELL also need updating on next Flux deploy");
