const fs = require('fs');
const f = 'Workspace.tsx';
let s = fs.readFileSync(f, 'utf8');

// Remove sdk_sources import if it exists
s = s.replace("\nimport { SDK_SOURCES } from './sdk_sources';", '');

// Replace clipboard handler — use GitHub raw URL
const oldClip = /const fullSource = SDK_SOURCES.*?Alert\.alert\('Copied!', m \+ '.*?'\);/s;
const oldClip2 = /\/\/ SDK module source snippets.*?Alert\.alert\('Copied!', m \+ '.*?'\);/s;

const newClip = `const fileName = m === 'procedural_sdk' ? 'procedural_sdk' : 'kasvillage_' + m;
                          const rawUrl = 'https://raw.githubusercontent.com/wayneshaw349/kasvillage-townhall/main/' + fileName + '.ts';
                          const clipText = 'Fetch this file and use it to build: ' + rawUrl;
                          Clipboard.setStringAsync(clipText);
                          Alert.alert('Copied!', fileName + '.ts\\n\\nGitHub URL on clipboard.\\nPaste into Claude Code →\\nit fetches the full source automatically.');`;

if (oldClip.test(s)) {
  s = s.replace(oldClip, newClip);
  console.log('Fixed: clipboard uses GitHub raw URL');
} else if (oldClip2.test(s)) {
  s = s.replace(oldClip2, newClip);
  console.log('Fixed: clipboard uses GitHub raw URL (v2)');
} else {
  console.log('ERROR: clipboard pattern not found');
}

fs.writeFileSync(f, s);
