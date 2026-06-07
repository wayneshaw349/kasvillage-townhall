const fs = require("fs");
let s = fs.readFileSync("Expo_identity_ritual.tsx", "utf8");
s = s.replace(
  "await storeAvatarLocally({ race: recipeData.race || 'human', gender: recipeData.gender || 'male', paths, hash });",
  "await storeAvatarLocally({ race: recipeData.race || 'human', gender: recipeData.gender || 'male', paths, hash, createdAt: Date.now() } as any);"
);
fs.writeFileSync("Expo_identity_ritual.tsx", s);
console.log("done");
