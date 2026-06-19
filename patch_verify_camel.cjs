const fs = require('fs');
let c = fs.readFileSync('townhallscreen.tsx', 'utf8');
c = c.replace("animal:'',class:'',combat_style:'',defining_moment:'',formative_memory:'',life_philosophy:'',lore_origin:'',mutant:'',mutate:'',name:'',occupation:'',origin_story:'',personality:'',power_spike:'',race:'',signature_move:'',voice_line:'',weakness:''",
  "animal:'',class:'',combatStyle:'',definingMoment:'',formativeMemory:'',lifePhilosophy:'',loreOrigin:'',mutant:'',mutate:'',name:'',occupation:'',originStory:'',personality:'',powerSpike:'',race:'',signatureMove:'',voiceLine:'',weakness:''");
c = c.replace(/avatar\.origin_story/g, 'avatar.originStory');
c = c.replace(/avatar\.formative_memory/g, 'avatar.formativeMemory');
c = c.replace(/avatar\.life_philosophy/g, 'avatar.lifePhilosophy');
c = c.replace(/avatar\.power_spike/g, 'avatar.powerSpike');
c = c.replace(/avatar\.signature_move/g, 'avatar.signatureMove');
c = c.replace(/avatar\.voice_line/g, 'avatar.voiceLine');
c = c.replace(/avatar\.defining_moment/g, 'avatar.definingMoment');
fs.writeFileSync('townhallscreen.tsx', c);
console.log('OK: avatar keys now camelCase');
