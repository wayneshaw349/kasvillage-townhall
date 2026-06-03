const fs = require('fs');
const f = 'VillageMailbox.tsx';
let s = fs.readFileSync(f, 'utf8');
let changes = 0;

// Replace DApp onPress with dual-link (video demo + app URL)
const oldDapp = `} else if (section === 'dapps') {
        // Open video demo or game URL
        const dappLink = item.gameUrl || item.videoUrl || item.primaryLink || '';
        if (dappLink) Linking.openURL(dappLink.startsWith('http') ? dappLink : 'https://' + dappLink);
        else Alert.alert('No Link', 'This DApp has no demo or game URL set.');`;

const newDapp = `} else if (section === 'dapps') {
        // DApps, games, websites — video demo + live URL
        const videoLink = item.videoUrl || '';
        const appLink = item.gameUrl || item.primaryLink || '';
        if (videoLink && appLink) {
          Alert.alert(item.name || 'App', 'Watch the demo or open the app?', [
            { text: 'Cancel', style: 'cancel' },
            { text: '🎬 Watch Demo', onPress: () => Linking.openURL(videoLink.startsWith('http') ? videoLink : 'https://' + videoLink) },
            { text: '🚀 Open App', onPress: () => Linking.openURL(appLink.startsWith('http') ? appLink : 'https://' + appLink) },
          ]);
        } else {
          const link = videoLink || appLink;
          if (link) Linking.openURL(link.startsWith('http') ? link : 'https://' + link);
          else Alert.alert('No Link', 'No demo or app URL set.');
        }`;

if (s.includes(oldDapp)) {
  s = s.replace(oldDapp, newDapp);
  changes++; console.log('1: DApp dual-link (demo + app URL)');
}

// Same pattern for academics — video + repo
const oldAcad = `} else if (section === 'academics') {
        // Open video explainer, repo, or contact channel
        const acadLink = item.videoUrl || item.repositoryUrl || '';
        if (acadLink) Linking.openURL(acadLink.startsWith('http') ? acadLink : 'https://' + acadLink);
        else Alert.alert('Research', item.title || 'No link available');`;

const newAcad = `} else if (section === 'academics') {
        const videoLink = item.videoUrl || '';
        const repoLink = item.repositoryUrl || '';
        if (videoLink && repoLink) {
          Alert.alert(item.title || 'Research', 'Watch the explainer or view the paper?', [
            { text: 'Cancel', style: 'cancel' },
            { text: '🎬 Video Explainer', onPress: () => Linking.openURL(videoLink.startsWith('http') ? videoLink : 'https://' + videoLink) },
            { text: '📄 View Paper', onPress: () => Linking.openURL(repoLink.startsWith('http') ? repoLink : 'https://' + repoLink) },
          ]);
        } else {
          const link = videoLink || repoLink;
          if (link) Linking.openURL(link.startsWith('http') ? link : 'https://' + link);
          else Alert.alert('Research', item.title || 'No link available');
        }`;

if (s.includes(oldAcad)) {
  s = s.replace(oldAcad, newAcad);
  changes++; console.log('2: Academic dual-link (video + paper)');
}

fs.writeFileSync(f, s);
console.log('\nTotal:', changes);
console.log('Verify - Watch Demo:', s.includes('Watch Demo'));
console.log('Verify - Open App:', s.includes('Open App'));
console.log('Verify - Video Explainer:', s.includes('Video Explainer'));
console.log('Verify - View Paper:', s.includes('View Paper'));
