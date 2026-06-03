const fs = require('fs');
const f = 'VillageMailbox.tsx';
let s = fs.readFileSync(f, 'utf8');
let changes = 0;

// Fix DApps — open video demo or game URL, not Arweave gateway
s = s.replace(
  "} else if (section === 'dapps' && item.arweaveTx) {\n        // Open DApp page on Arweave gateway\n        Linking.openURL('https://arweave.net/' + item.arweaveTx);",
  "} else if (section === 'dapps') {\n        // Open video demo or game URL\n        const dappLink = item.gameUrl || item.videoUrl || item.primaryLink || '';\n        if (dappLink) Linking.openURL(dappLink.startsWith('http') ? dappLink : 'https://' + dappLink);\n        else Alert.alert('No Link', 'This DApp has no demo or game URL set.');"
);
changes++; console.log('1: DApps → video demo / game URL');

// Fix Academics — open video explainer or repo, not gateway
s = s.replace(
  "} else if (section === 'academics') {\n        // Open repository URL if available, otherwise Arweave TX\n        if (item.repositoryUrl) Linking.openURL(item.repositoryUrl);\n        else if (item.arweaveTx) Linking.openURL('https://arweave.net/' + item.arweaveTx);",
  "} else if (section === 'academics') {\n        // Open video explainer, repo, or contact channel\n        const acadLink = item.videoUrl || item.repositoryUrl || '';\n        if (acadLink) Linking.openURL(acadLink.startsWith('http') ? acadLink : 'https://' + acadLink);\n        else Alert.alert('Research', item.title || 'No link available');"
);
changes++; console.log('2: Academics → video explainer / repo');

// Fix Services — same pattern
s = s.replace(
  "} else if (section === 'services') {\n        if (item.contactChannel) Linking.openURL(item.contactChannel);\n        else if (item.arweaveTx) Linking.openURL('https://arweave.net/' + item.arweaveTx);",
  "} else if (section === 'services') {\n        const svcLink = item.contactChannel || item.primaryLink || '';\n        if (svcLink) Linking.openURL(svcLink.startsWith('http') ? svcLink : 'https://' + svcLink);\n        else Alert.alert('Service', item.title || 'No contact info');"
);
changes++; console.log('3: Services → contact channel');

fs.writeFileSync(f, s);
console.log('\nTotal:', changes);
console.log('Verify - no arweave.net gateway:', !s.includes("arweave.net/' + item.arweaveTx"));
console.log('Verify - gameUrl:', s.includes('item.gameUrl'));
console.log('Verify - videoUrl:', s.includes('item.videoUrl'));
