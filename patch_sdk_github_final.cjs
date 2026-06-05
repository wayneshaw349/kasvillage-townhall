const fs = require('fs');
const f = 'Workspace.tsx';
let s = fs.readFileSync(f, 'utf8');

const old = `const importLine = "import { " + m + " } from '@kasvillage/sdk/kasvillage_" + m + "';\\nimport { procedural_sdk } from '@kasvillage/sdk/procedural_sdk';";
                          Clipboard.setStringAsync(importLine);
                          Alert.alert('Copied!', m + ' import copied to clipboard.\\n\\nprocedural_sdk auto-included.\\n\\nPaste into Claude Code.');`;

const replacement = `const nameMap = { 'procedural_sdk': 'procedural_sdk', 'game_input': 'kasvillage_game_input_paint' };
                          const fileName = nameMap[m] || ('kasvillage_' + m);
                          const rawUrl = 'https://raw.githubusercontent.com/wayneshaw349/kasvillage-townhall/main/' + fileName + '.ts';
                          Clipboard.setStringAsync('Fetch this file and use it to build: ' + rawUrl);
                          Alert.alert('Copied!', fileName + '.ts\\n\\nGitHub URL on clipboard.\\nPaste into Claude Code.');`;

if (s.includes(old)) {
  s = s.replace(old, replacement);
  console.log('Fixed: SDK clipboard now uses GitHub raw URLs');
} else {
  console.log('Pattern not found, checking...');
  console.log('Has importLine:', s.includes('importLine'));
  console.log('Has setStringAsync(importLine):', s.includes('setStringAsync(importLine)'));
}

fs.writeFileSync(f, s);
