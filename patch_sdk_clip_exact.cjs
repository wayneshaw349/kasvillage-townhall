const fs = require('fs');
const f = 'Workspace.tsx';
let s = fs.readFileSync(f, 'utf8');

const old = `const importLine = "import { " + m + " } from '@kasvillage/sdk/kasvillage_" + m + "';\\nimport { procedural_sdk } from '@kasvillage/sdk/procedural_sdk';";
                          Clipboard.setStringAsync(importLine);
                          Alert.alert('Copied!', m + ' import copied.\\nprocedural_sdk auto-included.\\nPaste into Claude Code.');`;

const fix = `const nameMap = { 'procedural_sdk': 'procedural_sdk', 'game_input': 'kasvillage_game_input_paint' };
                          const fileName = nameMap[m] || ('kasvillage_' + m);
                          const rawUrl = 'https://raw.githubusercontent.com/wayneshaw349/kasvillage-townhall/main/' + fileName + '.ts';
                          Clipboard.setStringAsync('Fetch this file and use it to build: ' + rawUrl);
                          Alert.alert('Copied!', fileName + '.ts\\nGitHub URL on clipboard.\\nPaste into Claude Code.');`;

if (s.includes(old)) {
  s = s.replace(old, fix);
  console.log('Fixed: SDK clipboard → GitHub raw URLs');
} else {
  console.log('MISS — trying without escaped newlines');
  const old2 = "const importLine = \"import { \" + m + \" } from '@kasvillage/sdk/kasvillage_\" + m + \"';\\nimport { procedural_sdk } from '@kasvillage/sdk/procedural_sdk';\";";
  console.log('Has old2:', s.includes(old2));
}

fs.writeFileSync(f, s);
