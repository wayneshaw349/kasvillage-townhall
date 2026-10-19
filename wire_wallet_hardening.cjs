// wire_wallet_hardening.cjs - fixes from kv_security_check (2 FAIL + WARNs).
//   node wire_wallet_hardening.cjs     (project folder; safe to run twice)
// 1 game pay sheet asks Face ID / passcode     2 app lock fails closed + passcode-only phones locked
// 3 vault send always asks fresh               4 new vault offers Go Cold after cards are saved
// 5 pay cap 100 KAS games / 1000 pages          6 games can't put a Kaspa address on your clipboard
// 7 seed phrase clipboard clears after 60 s     8 crypto randomness for the typing-check salt
const fs = require('fs');
let ok = 0, skip = 0, bad = 0;
function patch(file, steps) {
  if (!fs.existsSync(file)) { console.log('MISSING ' + file); bad++; return; }
  const raw = fs.readFileSync(file, 'utf8'); const CRLF = raw.includes('\r\n');
  let s = raw.replace(/\r\n/g, '\n'); let changed = false;
  for (const [name, mark, fn] of steps) {
    if (s.includes(mark)) { console.log('  skip  ' + name + ' (already done)'); skip++; continue; }
    const n = fn(s);
    if (n === s || !n.includes(mark)) { console.log('  FAIL  ' + name + ' - anchor not found in ' + file); bad++; continue; }
    s = n; changed = true; ok++; console.log('  ok    ' + name);
  }
  if (changed) { fs.copyFileSync(file, file + '.bak_harden'); fs.writeFileSync(file, CRLF ? s.replace(/\n/g, '\r\n') : s, 'utf8'); }
}
const rep = (a, b) => (s) => s.includes(a) ? s.replace(a, b) : s;

console.log('OnChainPageView.tsx');
patch('OnChainPageView.tsx', [
  ['pay sheet asks Face ID / passcode', 'KV_PAY_AUTH', rep(
    "    setPayBusy(true);\n    try {\n      const ps = require('./proposal_share');",
    "    setPayBusy(true);\n    try {\n      { /* KV_PAY_AUTH: fresh Face ID / passcode for every payment */\n" +
    "        const LA = require('expo-local-authentication'); let _a: any = null;\n" +
    "        try { _a = await LA.authenticateAsync({ promptMessage: 'Pay ' + paySheet.kas + ' KAS', cancelLabel: 'Cancel', disableDeviceFallback: false }); } catch { _a = null; }\n" +
    "        if (!_a || !_a.success) { setPayBusy(false); if (_a && _a.error && !/cancel/i.test(String(_a.error))) setNotice('Payment needs Face ID or your phone passcode.'); return; }\n" +
    "      }\n      const ps = require('./proposal_share');")],
  ['pay cap 100 KAS games / 1000 pages', 'KV_PAY_CAP', rep(
    "if (!okAddr || !(kas > 0) || kas > 5000) {",
    "if (!okAddr || !(kas > 0) || kas > (props.game ? 100 : 1000) /* KV_PAY_CAP */) {")],
]);

console.log('AppNaviagator.tsx');
patch('AppNaviagator.tsx', [
  ['app lock: passcode-only phones still locked', 'KV_GATE_PASSCODE', rep(
    "        if (!hasHardware || !isEnrolled) { onSuccess(); return; }",
    "        if (!hasHardware || !isEnrolled) { /* KV_GATE_PASSCODE: no Face ID -> still ask the phone passcode */\n" +
    "          let lvl = 0; try { lvl = await LocalAuthentication.getEnrolledLevelAsync(); } catch { lvl = 0; }\n" +
    "          if (!lvl) { onSuccess(); return; } // phone has no lock at all - nothing to ask\n" +
    "        }")],
  ['app lock: OS-unsupported passcode prompt falls through', 'KV_GATE_NOTSUP', rep(
    "        result.success ? onSuccess() : onFail();\n      } catch {\n        onSuccess();\n      }",
    "        if (!result.success && /not_enrolled|not_available|passcode_not_set/.test(String((result as any).error || ''))) { onSuccess(); return; } /* KV_GATE_NOTSUP */\n" +
    "        result.success ? onSuccess() : onFail();\n      } catch {\n        onFail(); /* KV_GATE_FAILCLOSED */\n      }")],
]);

console.log('kasvillage_cold_wallet.tsx');
patch('kasvillage_cold_wallet.tsx', [
  ['vault send always asks fresh', 'KV_VAULT_FRESH', rep(
    "  const authOk = await biometricAuth.authenticate('Vault: send '",
    "  biometricAuth.clearCache(); /* KV_VAULT_FRESH: never reuse the hot-wallet unlock */\n  const authOk = await biometricAuth.authenticate('Vault: send '")],
]);

console.log('GenerateVaultScreen.tsx');
patch('GenerateVaultScreen.tsx', [
  ['new vault offers Go Cold after cards', 'KV_VAULT_AUTOCOLD', (s) => {
    const a = "  // Once wires exist, hand off to the existing backup UI (QR cards).\n";
    if (!s.includes(a) || !s.includes('          onDone={onDone}\n          onCancel={onDone}')) return s;
    s = s.replace(a, "  const finishVault = () => { /* KV_VAULT_AUTOCOLD */\n" +
      "    Alert.alert('Take the vault key off this phone?',\n" +
      "      'Only if you saved ALL your cards. Going cold removes the vault key from this phone, so a stolen phone cannot spend the vault. To spend later: Restore from Cards, send, then Go Cold again.',\n" +
      "      [{ text: 'Keep warm', style: 'cancel', onPress: onDone },\n" +
      "       { text: 'Go Cold (recommended)', onPress: async () => { try { const { vaultGoCold } = require('./kasvillage_cold_wallet'); const r = await vaultGoCold(); if (!r.success) Alert.alert('Go Cold', r.error || 'Failed'); } catch {} onDone(); } }]);\n" +
      "  };\n\n" + a);
    return s.replace('          onDone={onDone}\n          onCancel={onDone}', '          onDone={finishVault}\n          onCancel={onDone}');
  }],
]);

console.log('kv_net_bridge.ts');
patch('kv_net_bridge.ts', [
  ['games cannot put a Kaspa address on the clipboard', 'KV_CLIP_GUARD', rep(
    "    if (typeof m.text === 'string') Clipboard.setStringAsync(m.text.slice(0, 100000)).catch(() => {});",
    "    // KV_CLIP_GUARD: a game may copy text, but never a Kaspa address (stops address-swap tricks)\n" +
    "    if (typeof m.text === 'string') Clipboard.setStringAsync(m.text.slice(0, 100000).replace(/kaspa(test)?:[a-z0-9]{20,}/gi, '[address hidden]')).catch(() => {});")],
]);

const CLEAR = "await Clipboard.setStringAsync(mnemonic); setTimeout(() => { Clipboard.getStringAsync().then((c: string) => { if (c === mnemonic) Clipboard.setStringAsync(''); }).catch(() => {}); }, 60000); /* KV_CLIP_CLEAR */";
for (const f of ['MnemonicExportModal.tsx', 'expo_identity_ritual.tsx']) {
  console.log(f);
  patch(f, [['seed phrase clipboard clears after 60 s', 'KV_CLIP_CLEAR', (s) => s.split('await Clipboard.setStringAsync(mnemonic);').join(CLEAR)]]);
}

console.log('keyword_dictionary_draggable.tsx');
patch('keyword_dictionary_draggable.tsx', [
  ['crypto random salt', 'KV_SALT_CSPRNG', rep(
    "  const saltBytes = new Uint8Array(32);\n  for (let i = 0; i < 32; i++) saltBytes[i] = Math.floor(Math.random() * 256);",
    "  const saltBytes = Crypto.getRandomBytes(32); /* KV_SALT_CSPRNG */")],
]);

console.log('\n' + ok + ' applied, ' + skip + ' already done, ' + bad + ' failed' + (bad ? '  <- send me this output' : '') + '\nBackups: *.bak_harden   Next: node kv_security_check.cjs');
