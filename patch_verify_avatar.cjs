const fs = require('fs');
let c = fs.readFileSync('townhallscreen.tsx', 'utf8');

// Find the handleVerify fetch call
const old = `const response = await fetch(\`\${TOWNHALL_BASE}/verify-identity\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey: myPubkey, apt: myApt }),
      });`;

const replacement = `// Build avatar from recipe
      let avatar = { animal:'',class:'',combat_style:'',defining_moment:'',formative_memory:'',life_philosophy:'',lore_origin:'',mutant:'',mutate:'',name:'',occupation:'',origin_story:'',personality:'',power_spike:'',race:'',signature_move:'',voice_line:'',weakness:'' };
      try {
        const recipeStr = await SecureStore.getItemAsync('kv_avatar_recipe');
        if (recipeStr) {
          const r = JSON.parse(recipeStr);
          avatar.name = r.name || '';
          avatar.race = r.race || '';
          avatar.class = r.class || '';
          avatar.occupation = r.occupation || '';
          avatar.animal = r.animal || '';
          avatar.origin_story = r.originStory || '';
          avatar.formative_memory = r.formativeMemory || '';
          avatar.life_philosophy = r.lifePhilosophy || '';
          avatar.power_spike = r.powerSpike || '';
          avatar.signature_move = r.signatureMove || '';
          avatar.voice_line = r.voiceLine || '';
          avatar.personality = r.characterDescription || r.scenarioDesire || '';
          avatar.defining_moment = r.scenarioDesire || r.characterDescription || '';
        }
      } catch {}
      const response = await fetch(\`\${TOWNHALL_BASE}/verify-identity\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey: myPubkey, avatar, signature: 'self-attest' }),
      });`;

if (c.includes('body: JSON.stringify({ pubkey: myPubkey, apt: myApt })')) {
  c = c.replace(
    /const response = await fetch\(`\$\{TOWNHALL_BASE\}\/verify-identity`[\s\S]*?body: JSON\.stringify\(\{ pubkey: myPubkey, apt: myApt \}\),\s*\}\);/,
    replacement
  );
  fs.writeFileSync('townhallscreen.tsx', c);
  console.log('OK: handleVerify now sends avatar + signature');
} else {
  console.log('ERROR: pattern not found');
}
