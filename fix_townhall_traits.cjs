const fs = require("fs");
let s = fs.readFileSync("townhallscreen.tsx", "utf8");

const old = "const traits = await SecureStore.getItemAsync('kv_trait_count');";
const rep = `// Count traits from avatar recipe (same as ProfileScreen)
      let traits = null;
      try {
        const recipeStr = await SecureStore.getItemAsync('kv_avatar_recipe');
        if (recipeStr) {
          const recipe = JSON.parse(recipeStr);
          const traitKeys = ['name','race','class','occupation','animal','originStory','formativeMemory','scenarioDesire','characterDescription','voiceLine','lifePhilosophy','powerSpike','signatureMove'];
          const filled = traitKeys.filter(k => recipe[k] && recipe[k].length > 0).length;
          traits = String(filled);
        }
      } catch {}`;

if (s.includes(old)) {
  s = s.replace(old, rep);
  fs.writeFileSync("townhallscreen.tsx", s, "utf8");
  console.log("✅ TownHall now reads traits from kv_avatar_recipe");
} else {
  console.log("⚠️  Anchor not found");
}
