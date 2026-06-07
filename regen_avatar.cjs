// regen_avatar.cjs
// Adds avatar regeneration from stored recipe to ProfileScreen.tsx
// If no stored avatar SVG, regenerates from race/gender in kv_avatar_recipe
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "ProfileScreen.tsx");
let s = fs.readFileSync(file, "utf8");

if (s.includes("// REGEN:")) {
  console.log("Already patched");
  process.exit(0);
}

const target = "getStoredAvatar().then(async (id) => {";
if (!s.includes(target)) {
  console.error("Target not found in ProfileScreen.tsx");
  process.exit(1);
}

s = s.replace(
  target,
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

fs.writeFileSync(file, s, "utf8");
console.log("done - avatar regen patched into ProfileScreen.tsx");
