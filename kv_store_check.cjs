// kv_store_check.cjs - App Store / Google Play readiness check. Reads files only.
//   node kv_store_check.cjs        (project folder)
const fs = require('fs');
const rd = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
const SKIP = /\.bak|orig|^(find_|fix_|wire_|kascity_|patch_|make_|kv_)/;
const files = fs.readdirSync('.').filter((f) => /\.(tsx?)$/.test(f) && !/\.d\.ts$/.test(f) && !SKIP.test(f));
const all = files.map((f) => [f, rd(f)]);
const uses = (mod) => all.filter(([, s]) => s.includes("from '" + mod + "'") || s.includes("require('" + mod + "')")).map(([f]) => f);
let app = {}; try { app = JSON.parse(rd('app.json')).expo || {}; } catch {}
let eas = {}; try { eas = JSON.parse(rd('eas.json')); } catch {}
const plist = (app.ios && app.ios.infoPlist) || {}, perms = (app.android && app.android.permissions) || [];
const plugins = JSON.stringify(app.plugins || []), pkg = rd('package.json');
let p = 0, w = 0, f = 0, m = 0;
const out = (lvl, msg, fix) => { if (lvl === 'PASS') p++; else if (lvl === 'WARN') w++; else if (lvl === 'FAIL') f++; else m++;
  console.log('  ' + lvl.padEnd(7) + msg + (fix ? '\n         fix: ' + fix : '')); };

console.log('\n== PERMISSION TEXTS (missing text = crash or rejection)');
const cam = uses('expo-camera');
if (cam.length) (plist.NSCameraUsageDescription || /expo-camera[^\]]*cameraPermission/.test(plugins))
  ? out('PASS', 'camera text set') : out('FAIL', 'camera is used (' + cam.join(', ') + ') but no camera text of yours - the build falls back to Expo\'s generic text, which Apple rejects (5.1.1)', 'add expo-camera plugin with cameraPermission text');
plist.NSFaceIDUsageDescription ? out('PASS', 'Face ID text set') : out('FAIL', 'no Face ID text');
const ble = uses('react-native-ble-plx');
if (plist.NSBluetoothAlwaysUsageDescription || perms.some((x) => /BLUETOOTH/.test(x)))
  out('WARN', 'Bluetooth permissions still declared (you decided to remove Bluetooth)' + (ble.length ? ' - still imported by ' + ble.join(', ') : ''), 'remove BLE permissions, plugin and package - reviewers ask for a demo of every permission');
perms.some((x) => /ACCESS_(FINE|COARSE)_LOCATION/.test(x)) ? out('WARN', 'Android asks for LOCATION (only needed for Bluetooth) - Google Play makes you justify it', 'remove ACCESS_FINE_LOCATION with Bluetooth') : out('PASS', 'no location permission');
/expo-notifications/.test(plugins) ? out('PASS', 'notifications plugin set') : null;

console.log('\n== NETWORK (release builds block plain http)');
const httpIp = all.filter(([, s]) => /http:\/\/\d{1,3}(\.\d{1,3}){3}:35816/.test(s)).map(([x]) => x);
const httpHtml = fs.readdirSync('.').filter((x) => /\.html$/.test(x) && /http:\/\/\d{1,3}(\.\d{1,3}){3}:35816/.test(rd(x)));
(httpIp.length || httpHtml.length) ? out('WARN', 'relay mirrors use plain http://IP:35816 - TestFlight / Play builds block these (ATS / cleartext); only https://kasvillage.app.runonflux.io will work', 'release: use the https Flux domain only (it load-balances the nodes); IPs cannot get an ATS exception') : out('PASS', 'no plain-http relay IPs');
const lan = all.filter(([, s]) => /fetch\(`http:\/\/\$\{/.test(s)).map(([x]) => x);
lan.length ? (plist.NSLocalNetworkUsageDescription ? out('PASS', 'local-network text set') : out('WARN', 'phone-to-phone http (Wi-Fi/Tailscale) in ' + lan.join(', ') + ' - iOS needs a local-network text, and cleartext must be allowed for LAN', 'add NSLocalNetworkUsageDescription, or drop these paths if unused'))
  : out('PASS', 'no LAN http');

console.log('\n== RELEASE BUILD');
const prod = (eas.build && eas.build.production) || {};
prod.developmentClient ? out('FAIL', 'production profile is a dev client') : out('PASS', 'production profile is a real release build (no Expo dev menu)');
prod.autoIncrement || (eas.cli && eas.cli.appVersionSource === 'remote') ? out('PASS', 'build numbers auto-increment') : out('WARN', 'build number not auto-incremented');
eas.build && eas.build.preview ? out('PASS', 'preview profile exists (TestFlight / internal test)') : out('WARN', 'no preview profile');
app.android && app.android.googleServicesFile && !fs.existsSync(app.android.googleServicesFile) ? out('FAIL', 'google-services.json missing') : out('PASS', 'Android google-services file ok');
const claudeLink = all.find(([, s]) => /openURL\('https:\/\/claude\.ai\/code'\)/.test(s));
claudeLink ? out('WARN', '"Open Claude Code" button links out to a third-party dev tool (' + claudeLink[0] + ') - reviewers flag unexplained outbound buttons', 'hide it or label it as a developer resource') : out('PASS', 'no stray dev-tool links');

console.log('\n== POLICY');
all.some(([, s]) => /Remove from Phone/.test(s)) ? out('PASS', 'wallet can be removed from the phone (account deletion rule)') : out('WARN', 'no in-app wallet removal');
all.some(([f2, s]) => /VillageMailbox|payload_publish/.test(f2) && /flag/i.test(s)) ? out('PASS', 'user content can be reported (community flags)') : out('FAIL', 'no report button for user content');
all.some(([, s]) => /privacy policy/i.test(s)) ? out('PASS', 'privacy policy linked in app') : out('FAIL', 'no privacy policy link in the app (required by Apple and Google)', 'add a Privacy Policy + Terms link in Profile (host the page on any https site)');
all.some(([, s]) => /terms of (service|use)|EULA/i.test(s)) ? out('PASS', 'terms / EULA linked') : out('FAIL', 'no Terms of Use (Apple requires zero-tolerance terms for apps with user content)', 'same page as privacy policy');
const view = rd('OnChainPageView.tsx');
/kv:\/\/pay|path\.startsWith\('pay/.test(view) || /KV_PAY_AUTH/.test(view)
  ? (/Platform\.OS\s*===\s*'ios'[^\n]*pay|KV_IOS_PAY/.test(view) ? out('PASS', 'iOS: games cannot unlock content with KAS')
    : out('WARN', 'iOS: a game can open the KAS pay sheet inside the app - Apple 3.1.1 bans unlocking game content with crypto (your plan: buying happens outside the app)', 'on iOS, game pay sheet = "send to this address from your wallet" (no unlock), or hide it')) : null;

console.log('\n== CHECK BY HAND');
out('MANUAL', 'Apple account must be an ORGANIZATION (not individual) to ship a crypto wallet (guideline 3.1.5)');
out('MANUAL', 'ITSAppUsesNonExemptEncryption=false - OK only if you use standard crypto (secp256k1, AES, SHA). True for KasVillage today');
out('MANUAL', 'App Store privacy labels: you collect no personal data on a server - say so; wallet addresses are public on chain');
out('MANUAL', 'Reviewer notes: explain testnet vs mainnet, give a test wallet with TN10 KAS, and explain games run in a sandbox');

console.log('\n' + p + ' PASS   ' + w + ' WARN   ' + f + ' FAIL   ' + m + ' by hand\n');
