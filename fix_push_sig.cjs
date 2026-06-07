const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "Expo_identity_ritual.tsx");
if (!fs.existsSync(file)) { console.log("⚠️  File not found"); process.exit(1); }
let s = fs.readFileSync(file, "utf8");

const old = `const pushToken = await registerPushToken();
        if (pushToken) {
          const pubkey = await SecureStore.getItemAsync('kv_public_key') || '';
          const privKey = await SecureStore.getItemAsync('kaspa_private_key') || '';
          if (pubkey && privKey) {
            await inscribePushToken(pubkey, privKey);`;

const fix = `const pushToken = await registerPushToken();
        if (pushToken) {
          const pubkey = await SecureStore.getItemAsync('kv_public_key') || '';
          if (pubkey) {
            await inscribePushToken(pubkey);`;

if (s.includes(old)) {
  s = s.replace(old, fix);
  fs.writeFileSync(file, s, "utf8");
  console.log("✅ Fixed inscribePushToken(pubkey) — 1 arg");
} else {
  console.log("⚠️  Anchor not found — already fixed or patch not applied yet");
}
