const fs = require("fs");
let s = fs.readFileSync("ProfileScreen.tsx", "utf8");
const old = "setStats(prev => ({ ...prev, trait_count: filled }));";
const rep = old + "\n        console.log('[Profile] trait_count:', filled, 'filled keys:', JSON.stringify(traitKeys.filter(k => recipe[k] && recipe[k].length > 0)));";
if (s.includes(old) && !s.includes("[Profile] trait_count:")) {
  s = s.replace(old, rep);
  fs.writeFileSync("ProfileScreen.tsx", s, "utf8");
  console.log("debug log added");
} else {
  console.log("already added or anchor missing");
}
