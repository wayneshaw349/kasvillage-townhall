const fs = require("fs");
let s = fs.readFileSync("ProfileScreen.tsx", "utf8");
// Add missing imports to existing import line
s = s.replace(
  "import { StoredAvatarRenderer, getStoredAvatar } from './avatar_silhouette_generator';",
  "import { StoredAvatarRenderer, getStoredAvatar, RACE_GENERATORS, storeAvatarLocally, computeAvatarHash } from './avatar_silhouette_generator';"
);
// Replace require() with the already-imported functions
s = s.replace(
  "const { RACE_GENERATORS, storeAvatarLocally, computeAvatarHash } = require('./avatar_silhouette_generator');",
  "// Using imports from top of file"
);
fs.writeFileSync("ProfileScreen.tsx", s);
console.log("done - avatar imports fixed");
