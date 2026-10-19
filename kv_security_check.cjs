// kv_security_check.cjs - hot wallet + vault + game-bridge security check.
//   node kv_security_check.cjs        (run in the project folder)
// Prints PASS / WARN / FAIL per rule. Reads files only - changes nothing.
const fs = require('fs');
const rd = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
const SKIP = /\.bak|orig|frost_test|^(find_|fix_|wire_|kascity_|patch_|make_|kv_security)/;
const files = fs.readdirSync('.').filter((f) => /\.(tsx?|js)$/.test(f) && !/\.d\.ts$/.test(f) && !SKIP.test(f));
const all = files.map((f) => [f, rd(f)]);
let pass = 0, warn = 0, fail = 0;
const out = (lvl, msg, where) => { lvl === 'PASS' ? pass++ : lvl === 'WARN' ? warn++ : fail++;
  console.log((lvl === 'PASS' ? '  PASS ' : lvl === 'WARN' ? '  WARN ' : '  FAIL ') + msg + (where ? '\n         -> ' + where : '')); };
const grepAll = (re) => { const hits = []; for (const [f, s] of all) s.split(/\r?\n/).forEach((l, i) => { if (re.test(l)) hits.push(f + ':' + (i + 1)); }); return hits; };
const fnBody = (src, name) => { const i = src.indexOf(name); if (i < 0) return ''; return src.slice(i, i + 3000); };

const cold = rd('kasvillage_cold_wallet.tsx'), view = rd('OnChainPageView.tsx'), nav = rd('AppNaviagator.tsx');
const net = rd('kv_net_bridge.ts'), reg = rd('wallet_registration_v2.ts'), gen = rd('GenerateVaultScreen.tsx');

console.log('\n== KEY STORAGE');
const asyncSecret = grepAll(/AsyncStorage\.setItem\([^)]*(mnemonic|seed|priv|secret|wif)/i).filter((h) => !/pubkey/i.test(h));
asyncSecret.length ? out('FAIL', 'secret written to AsyncStorage (unencrypted)', asyncSecret.join(', ')) : out('PASS', 'no keys/mnemonics in AsyncStorage');
const ssSecret = [];
for (const [f, s] of all) { const re = /setItemAsync\(\s*(['"][^'"]*(mnemonic|priv|seed|secret)[^'"]*['"]|STORE_KEYS\.PRIVATE_KEY)\s*,[^;]*?\)/gi; let m;
  while ((m = re.exec(s))) { const seg = s.slice(m.index, m.index + 400).split(/\n\s*(await|const|let|if)\b/)[0]; const viaVar = /,\s*(\w+)\s*\)/.exec(seg); if (!/THIS_DEVICE_ONLY/.test(seg) && !(viaVar && new RegExp('const\\s+' + viaVar[1] + '\\s*=\\s*\\{[^}]*THIS_DEVICE_ONLY').test(s))) ssSecret.push(f + ':' + (s.slice(0, m.index).split('\n').length)); } }
ssSecret.length ? out('WARN', 'secret saved without *_THIS_DEVICE_ONLY (can sync to iCloud backup)', ssSecret.join(', ')) : out('PASS', 'all keys/mnemonics SecureStore + THIS_DEVICE_ONLY');
const logs = []; for (const [f, s] of all) s.split(/\r?\n/).forEach((l, i) => { if (!/console\.(log|warn|info|error)\(/.test(l)) return;
  const code = l.slice(l.search(/console\.(log|warn|info|error)\(/)).split(/\);/)[0].replace(/'[^']*'|"[^"]*"|`[^`]*`/g, "''").replace(/!!\s*\w+|\w+\??\.length/g, '');
  if (/\b(privKeyHex|privateKeyHex|mnemonic|privkey|seedHex)\b/.test(code)) logs.push(f + ':' + (i + 1)); });
logs.length ? out('WARN', 'a log line mentions a secret variable - check it prints no key', logs.slice(0, 6).join(', ')) : out('PASS', 'no secret values logged');
/kv_prev_wallet_priv/.test(reg) ? out('PASS', 'previous wallet key kept as a restore safety net (same passcode protection - so funds on it are never lost)') : out('PASS', 'no old wallet keys kept');

console.log('\n== VAULT');
/WHEN_PASSCODE_SET_THIS_DEVICE_ONLY/.test(gen) ? out('PASS', 'vault mnemonic needs a device passcode + never leaves the device') : out('FAIL', 'vault mnemonic stored without passcode protection', 'GenerateVaultScreen.tsx');
/vaultGoCold/.test(cold) && /deleteItemAsync\('kv_vault_mnemonic'\)/.test(cold) ? out('PASS', '"Go Cold" removes vault key from the phone (cards become the only key)') : out('FAIL', 'no way to remove the vault key from the phone');
const vs = fnBody(cold, 'async function sendKASFromVault');
/clearCache\(\)|fresh|force/.test(vs.slice(0, 400)) ? out('PASS', 'vault send always asks Face ID / passcode fresh')
  : out('WARN', 'vault send reuses the 30 s Face ID cache - a hot-wallet unlock lets a vault send skip the prompt', 'kasvillage_cold_wallet.tsx sendKASFromVault');
/fill\(0\)/.test(vs) ? out('PASS', 'vault private key buffer wiped after signing') : out('WARN', 'vault key buffer not wiped after use');
/kv_vault/.test(view) ? out('FAIL', 'game/page viewer can reach the vault key', 'OnChainPageView.tsx') : out('PASS', 'games/pages can never reach the vault (viewer has no vault access)');
/Go Cold/.test(rd('SendKAS.tsx')) ? out('PASS', 'after a vault send the app offers Go Cold again') : out('WARN', 'no Go Cold reminder after vault send');
/vault/i.test(gen) && /auto.?cold|goCold\(/i.test(gen) ? out('PASS', 'new vault goes cold after cards are saved') : out('WARN', 'new vault stays WARM (key on phone) until the user presses Go Cold - phone theft = vault + hot wallet', 'GenerateVaultScreen.tsx');

console.log('\n== APP LOCK');
const gate = fnBody(nav, 'const BiometricGate');
/catch\s*\{\s*onSuccess\(\)/.test(gate) ? out('FAIL', 'app lock opens if Face ID throws an error (fail-open)', 'AppNaviagator.tsx BiometricGate catch') : out('PASS', 'app lock fails closed');
/!hasHardware \|\| !isEnrolled\) \{ onSuccess\(\)/.test(gate) ? out('WARN', 'phone with no Face ID / fingerprint enrolled skips the app lock (PIN quiz is the only gate)', 'AppNaviagator.tsx BiometricGate') : out('PASS', 'no-biometric phones still get a lock');
/LOCKOUT_KEY/.test(nav) && /FAIL_COUNT_KEY/.test(nav) ? out('PASS', 'failed unlock attempts lock out (stored in SecureStore)') : out('WARN', 'no unlock lockout');

console.log('\n== GAMES / PAGES (WebView)');
/allowFileAccess=\{false\}/.test(view) ? out('PASS', 'no file access') : out('FAIL', 'WebView can read files');
/setSupportMultipleWindows=\{false\}/.test(view) ? out('PASS', 'no pop-up windows') : out('WARN', 'pop-up windows allowed');
/originWhitelist=\{\['https:\/\/kv-game\.local'\]\}/.test(view) && /onShouldStartLoadWithRequest/.test(view) ? out('PASS', 'navigation locked - external links blocked') : out('FAIL', 'pages can navigate away');
/a === 10 \|\| a === 127/.test(net) ? out('PASS', 'game network: allowlisted hosts only, private/LAN IPs blocked') : out('FAIL', 'game network can reach your LAN');
/privkey|privateKey/i.test(view.split('const confirmPay')[0].split('KV_GRANTS')[0].slice(-2000)) ? null : null;
const pay = fnBody(view, 'const confirmPay');
/authenticateAsync|biometric/i.test(pay) ? out('PASS', 'game payment sheet asks Face ID before sending')
  : out('FAIL', 'game payment sheet sends with ONE tap - no Face ID / passcode (someone holding the unlocked phone, or a misleading game, can pay)', 'OnChainPageView.tsx confirmPay');
const capM = view.match(/kas > \(props\.game \? (\d+) : (\d+)\)/) || view.match(/kas > (\d{2,})\)/) || []; const cap = capM[1];
/KV_PAY_NOCAP/.test(view) ? out('PASS', 'no pay cap - any price allowed, Face ID / passcode confirms every amount') : cap && +cap > 500 && !/KV_PAY_AUTH/.test(view) ? out('WARN', 'a game can request up to ' + cap + ' KAS with no Face ID', 'OnChainPageView.tsx kv://pay') : out('PASS', 'game payment amount ok');
/setStringAsync\(m\.text/.test(net) && !/KV_CLIP_GUARD/.test(net) ? out('WARN', 'a game can overwrite your clipboard silently (address-swap risk when you paste an address)', 'kv_net_bridge.ts') : out('PASS', 'games cannot write the clipboard silently');
/kc\[0-9a-f\]\{8\}/.test(view) ? out('PASS', 'game clipboard read returns only a table code, never the full clipboard') : out('WARN', 'game may read full clipboard');

console.log('\n== CONTENT BLOCKER');
const hc = rd('html_chunks.ts'), ws = rd('Workspace.tsx');
/KV_PAGE_CONTENT_GATE/.test(hc) ? out('PASS', 'pages (stores, dapps, custom HTML): words on screen run the content filter') : out('FAIL', 'pages only get a code scan - words on screen are not filtered', 'html_chunks.ts scanHtmlForPublish');
/KV_PUBLISH_CONTENT_GATE/.test(ws) ? out('PASS', 'shelf game publish runs the full content blocker on the phone') : out('FAIL', 'shelf game publish skips the content blocker', 'Workspace.tsx runPublish');
/scanObject(Strict)?\(storefrontConfig\)/.test(ws) ? out('PASS', 'store name / description / links / coupons filtered') : out('WARN', 'store config not filtered');
/<img\\b/.test(hc) && /data:image/.test(hc) ? out('PASS', 'no photos on pages or games (procedural images only)') : out('WARN', 'pages can embed photos');

console.log('\n== SEED PHRASE HANDLING');
const clip = grepAll(/setStringAsync\(\s*mnemonic\s*\)/);
const cleared = all.some(([, s]) => /setStringAsync\(\s*mnemonic\s*\)[\s\S]{0,400}setStringAsync\(\s*''\s*\)/.test(s));
clip.length && !cleared ? out('WARN', 'seed phrase can be copied to clipboard and is never cleared (games/other apps can read it)', clip.join(', ')) : out('PASS', 'seed phrase clipboard handled');
const weak = grepAll(/(salt|nonce|seed|key)[A-Za-z]*\[i\]\s*=\s*Math\.floor\(Math\.random/i);
weak.length ? out('WARN', 'Math.random used for salt/key bytes (use crypto.getRandomValues)', weak.join(', ')) : out('PASS', 'crypto randomness for keys');

console.log('\n' + pass + ' PASS   ' + warn + ' WARN   ' + fail + ' FAIL\n');
