// patch_avatar_thresholds_ble.cjs
// 1. Avatar regen from recipe on Profile load
// 2. Lower trait thresholds: 5 to buy, 6 to sell
// 3. BLE prep in frost_complete.ts (stays disabled until EAS build)
const fs = require("fs");
const path = require("path");

let changes = 0;

// ── 1. AVATAR REGEN in ProfileScreen.tsx ─────────────────────────────────────
const profileFile = path.join(__dirname, "ProfileScreen.tsx");
if (fs.existsSync(profileFile)) {
  let s = fs.readFileSync(profileFile, "utf8");

  // Add regen block
  if (!s.includes("// REGEN:")) {
    const target = "getStoredAvatar().then(async (id) => {";
    if (s.includes(target)) {
      s = s.replace(target,
`getStoredAvatar().then(async (id) => {
      // REGEN: regenerate from recipe if no stored avatar
      if (!id) {
        try {
          const recipeStr = await SecureStore.getItemAsync('kv_avatar_recipe');
          if (recipeStr) {
            const recipe = JSON.parse(recipeStr);
            const { RACE_GENERATORS, storeAvatarLocally, computeAvatarHash } = require('./avatar_silhouette_generator');
            const race = recipe.race || 'human';
            const gender = recipe.gender || 'male';
            const gen = RACE_GENERATORS[race.toLowerCase()] || RACE_GENERATORS['human'];
            const paths = gen(gender, 1);
            const hash = computeAvatarHash(paths);
            const ident = { race, gender, paths, hash, name: recipe.name || 'Villager' };
            await storeAvatarLocally(ident);
            setAvatarIdentity(ident as any);
            console.log('[Profile] Avatar regenerated:', race, gender, paths.length, 'paths');
            return;
          }
        } catch (e) { console.warn('[Profile] Avatar regen failed:', e); }
      }`
      );
      changes++;
      console.log("✅ ProfileScreen: avatar regen added");
    }
  } else {
    console.log("   ProfileScreen: regen already present");
  }

  // Lower thresholds in ProfileScreen
  s = s.replace("const CITADEL_BUYER_THRESHOLD = 8;", "const CITADEL_BUYER_THRESHOLD = 5;");
  s = s.replace("const CITADEL_SELLER_THRESHOLD = 12;", "const CITADEL_SELLER_THRESHOLD = 6;");
  // Update display text
  s = s.replace("{traitCount}/8 traits", "{traitCount}/5 traits");
  s = s.replace("{traitCount}/12 traits", "{traitCount}/6 traits");
  s = s.replace("Trait Count: {stats.trait_count}/12", "Trait Count: {stats.trait_count}/6");

  fs.writeFileSync(profileFile, s, "utf8");
  changes++;
  console.log("✅ ProfileScreen: thresholds → 5 buyer, 6 seller");
}

// ── 2. TRAIT THRESHOLDS in TownHallScreen.tsx ────────────────────────────────
const thFile = path.join(__dirname, "TownHallScreen.tsx");
if (fs.existsSync(thFile)) {
  let s = fs.readFileSync(thFile, "utf8");

  // Change "Need 13 more traits" to dynamic
  s = s.replace(/Need 13 more traits/g, "Need 6 more traits");
  s = s.replace(/0\/13 traits/g, "0/6 traits");
  s = s.replace(/13 traits/g, "6 traits");
  // If there's a hardcoded 13 threshold check
  s = s.replace(/traitCount >= 13/g, "traitCount >= 6");
  s = s.replace(/traits >= 13/g, "traits >= 6");
  s = s.replace(/count >= 13/g, "count >= 6");

  fs.writeFileSync(thFile, s, "utf8");
  changes++;
  console.log("✅ TownHallScreen: verification threshold → 6 traits");
}

// ── 3. TRAIT THRESHOLDS in shared_types.ts ───────────────────────────────────
const sharedFile = path.join(__dirname, "shared_types.ts");
if (fs.existsSync(sharedFile)) {
  let s = fs.readFileSync(sharedFile, "utf8");

  // Update any trait threshold constants
  s = s.replace(/PASSPORT_TRAIT_THRESHOLD\s*=\s*13/g, "PASSPORT_TRAIT_THRESHOLD = 6");
  s = s.replace(/RESIDENT_TRAIT_THRESHOLD\s*=\s*9/g, "RESIDENT_TRAIT_THRESHOLD = 5");
  s = s.replace(/MIN_TRAITS_BUYER\s*=\s*9/g, "MIN_TRAITS_BUYER = 5");
  s = s.replace(/MIN_TRAITS_SELLER\s*=\s*13/g, "MIN_TRAITS_SELLER = 6");

  fs.writeFileSync(sharedFile, s, "utf8");
  changes++;
  console.log("✅ shared_types: thresholds updated");
}

// ── 4. BLE STATUS CHECK ─────────────────────────────────────────────────────
const frostFile = path.join(__dirname, "frost_complete.ts");
if (fs.existsSync(frostFile)) {
  let s = fs.readFileSync(frostFile, "utf8");

  // Check current BLE state
  if (s.includes("BLE disabled until EAS build")) {
    console.log("   frost_complete: BLE disabled (correct — needs EAS build with native module)");
  } else if (s.includes("require('react-native-ble-plx')")) {
    console.log("⚠️  frost_complete: BLE enabled but may crash without native module");
    console.log("   Run EAS build before testing BLE: eas build --profile development --platform all");
  }
}

// ── 5. DASHBOARD threshold if present ────────────────────────────────────────
const dashFile = path.join(__dirname, "Dashboard.tsx");
if (fs.existsSync(dashFile)) {
  let s = fs.readFileSync(dashFile, "utf8");
  let changed = false;

  if (s.includes("traitCount >= 13")) { s = s.replace(/traitCount >= 13/g, "traitCount >= 6"); changed = true; }
  if (s.includes("traitCount >= 9")) { s = s.replace(/traitCount >= 9/g, "traitCount >= 5"); changed = true; }

  if (changed) {
    fs.writeFileSync(dashFile, s, "utf8");
    console.log("✅ Dashboard: thresholds updated");
    changes++;
  }
}

console.log(`\n✅ Done — ${changes} files changed`);
console.log("   Buyer (Resident): 5 traits");
console.log("   Seller (Passport): 6 traits + avatar customization");
console.log("   Avatar: regenerates from recipe on Profile load");
console.log("   BLE: disabled until next EAS build with native module");
