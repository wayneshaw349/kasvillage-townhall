const fs = require('fs');
const f = 'Workspace.tsx';
let s = fs.readFileSync(f, 'utf8');

// Fix the filename mapping to handle edge cases
s = s.replace(
  "const fileName = m === 'procedural_sdk' ? 'procedural_sdk' : 'kasvillage_' + m;",
  `const nameMap: Record<string,string> = {
                            'procedural_sdk': 'procedural_sdk',
                            'game_input': 'kasvillage_game_input_paint',
                            'audio_ui': 'kasvillage_audio_ui',
                            'particles': 'kasvillage_particles',
                          };
                          const fileName = nameMap[m] || ('kasvillage_' + m);`
);

fs.writeFileSync(f, s);
console.log('Fixed: SDK name mapping for edge cases');
