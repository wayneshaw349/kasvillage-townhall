const fs = require("fs");
let s = fs.readFileSync("ProfileScreen.tsx", "utf8");
s = s.replace(
  "getStoredAvatar().then(async (id) => {\n      if (id) {",
  `getStoredAvatar().then(async (id) => {
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
      }
      if (id) {`
);
fs.writeFileSync("ProfileScreen.tsx", s);
console.log("done - avatar regen added");
