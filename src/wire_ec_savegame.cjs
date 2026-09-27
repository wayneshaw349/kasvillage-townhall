// wire_ec_savegame.cjs - SAVE FILE (export) option for installed chain games.
//
// The verified game already lives on the device (kv_games/<head>.html - that
// is what plays offline). Tapping an On-Chain card in the Entertainment
// Center now offers PLAY or SAVE FILE: export opens the iOS share sheet on
// that exact cached file, so it can go to the Files app, AirDrop, or email -
// the user owns a copy of the hash-verified artifact outside the app.
// Run from layer1 root:  node src\\wire_ec_savegame.cjs
const fs = require("fs");
const P = "EntertainmentCenter.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("SAVE FILE")) { console.log("already patched"); process.exit(0); }
const a = "    const _cg = (dapp as any).chainGame;\n    if (_cg && _cg.manifestAddress && _cg.head) {\n      // Installed chain game: OnChainPageView solves cache-first + verifies.\n      setPlayingChain(_cg);\n      setLaunching(false);\n      return;\n    }";
const b = "    const _cg = (dapp as any).chainGame;\n    if (_cg && _cg.manifestAddress && _cg.head) {\n      // Installed chain game: play from the verified device copy, or export\n      // that copy out of the app (Files / AirDrop / email) so the user owns\n      // the artifact - same bytes DOWNLOAD verified against HEAD.\n      setLaunching(false);\n      const RN = require('react-native');\n      RN.Alert.alert(\n        dapp.name,\n        'Saved on this phone (verified vs HEAD ' + String(_cg.head).slice(0, 12) + '\\u2026). Plays offline.',\n        [\n          { text: 'PLAY', onPress: () => setPlayingChain(_cg) },\n          { text: 'SAVE FILE (export)', onPress: async () => {\n              try {\n                const FS = require('expo-file-system');\n                const uri = FS.documentDirectory + 'kv_games/' + _cg.head + '.html';\n                const info = await FS.getInfoAsync(uri);\n                if (!info.exists) { RN.Alert.alert('Not cached yet', 'Open the game once (PLAY) or re-download it in the Mailbox, then export.'); return; }\n                await RN.Share.share({ url: uri, title: (dapp.name || 'game') + '.html' });\n              } catch (e: any) { RN.Alert.alert('Export failed', String(e?.message || e)); }\n            } },\n          { text: 'Cancel', style: 'cancel' },\n        ],\n      );\n      return;\n    }";
const f = s.split(a).length - 1;
if (f !== 1) { console.error("ABORT [save-option]: anchor found " + f + " times (expected 1)"); process.exit(1); }
s = s.split(a).join(b);
console.log("ok  [save-option]");
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("\npatched " + P + " (1 edit). On-Chain cards now offer PLAY / SAVE FILE.");
