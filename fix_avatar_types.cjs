const fs = require("fs");
let s = fs.readFileSync("ProfileScreen.tsx", "utf8");
s = s.replace(
  "const gen = RACE_GENERATORS[race.toLowerCase()]",
  "const gen = RACE_GENERATORS[race.toLowerCase() as Race]"
);
s = s.replace(
  "const ident = { race, gender, paths, hash, name: recipe.name || 'Villager' };",
  "const ident = { race: race as Race, gender: gender as Gender, paths, hash, name: recipe.name || 'Villager', createdAt: Date.now() };"
);
// Add Race/Gender type imports
if (!s.includes("import type { Race")) {
  s = s.replace(
    "import type { AvatarIdentity } from './avatar_silhouette_generator';",
    "import type { AvatarIdentity, Race, Gender } from './avatar_silhouette_generator';"
  );
}
fs.writeFileSync("ProfileScreen.tsx", s);
console.log("done");
