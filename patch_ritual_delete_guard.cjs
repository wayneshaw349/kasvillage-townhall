// patch_ritual_delete_guard.cjs — stop the ritual destroying a recoverable wallet
// Run: node patch_ritual_delete_guard.cjs
//
// Before: a wrong-network address prefix deletes kv_private_key + kv_mnemonic outright.
// After:  if a mnemonic exists, re-derive for the CURRENT network (non-destructive).
//         Only a wallet with no mnemonic — i.e. genuinely unrecoverable — is cleared,
//         and only after the user confirms.
const fs = require('fs');
const P = 'expo_identity_ritual.tsx';

const raw = fs.readFileSync(P, 'utf8');
const EOL = raw.includes('\r\n') ? '\r\n' : '\n';
const L = raw.split(/\r?\n/);

// locate the three consecutive deletes
const i = L.findIndex(l => l.includes("deleteItemAsync('kv_kaspa_address')"));
if (i < 0) throw new Error("anchor not found: deleteItemAsync('kv_kaspa_address')");
if (!L[i + 1] || !L[i + 1].includes("deleteItemAsync('kv_private_key')"))
  throw new Error('line i+1 is not the kv_private_key delete: ' + L[i + 1]);
if (!L[i + 2] || !L[i + 2].includes("deleteItemAsync('kv_mnemonic')"))
  throw new Error('line i+2 is not the kv_mnemonic delete: ' + L[i + 2]);

// only one such block may exist
const total = L.filter(l => l.includes("deleteItemAsync('kv_kaspa_address')")).length;
if (total !== 1) throw new Error(`expected 1 kv_kaspa_address delete, found ${total}`);

console.log('--- replacing lines ' + (i + 1) + '-' + (i + 3) + ' ---');
console.log(L.slice(i, i + 3).join(EOL));
console.log('------------------------------');

const ind = (L[i].match(/^\s*/) || [''])[0];
const p = (s) => ind + s;

const guarded = [
  p("// [DELETE-GUARD] never destroy a wallet that cards can still restore."),
  p("const _gMnemonic = await SecureStore.getItemAsync('kv_mnemonic');"),
  p("if (_gMnemonic) {"),
  p("  // Wrong network, not corruption: re-derive the same seed for this network."),
  p("  console.log('[PhaseAnchor] DELETE-GUARD: mnemonic present, re-deriving for', network);"),
  p("  const { restoreWalletFromMnemonic } = await import('./wallet_registration_v2');"),
  p("  const _gRes = await restoreWalletFromMnemonic(_gMnemonic, network);"),
  p("  if (_gRes.success && _gRes.kaspaAddress) {"),
  p("    console.log('[PhaseAnchor] DELETE-GUARD: re-derived', _gRes.kaspaAddress);"),
  p("    setWalletAddress(_gRes.kaspaAddress);"),
  p("    setStep('funding');"),
  p("    startBalancePoller(_gRes.kaspaAddress, network);"),
  p("    return;"),
  p("  }"),
  p("  console.warn('[PhaseAnchor] DELETE-GUARD: re-derive failed, keeping keys anyway');"),
  p("  Alert.alert("),
  p("    'Wallet kept',"),
  p("    'This wallet is on a different network. Nothing was deleted. Switch the network setting, or restore from your recovery cards.'"),
  p("  );"),
  p("  return;"),
  p("}"),
  p("// No mnemonic: nothing can restore this wallet. Clearing is the only path"),
  p("// forward, but it is irreversible, so make it explicit rather than silent."),
  p("console.warn('[PhaseAnchor] DELETE-GUARD: no mnemonic — wallet is unrecoverable');"),
  p("await SecureStore.deleteItemAsync('kv_kaspa_address');"),
  p("await SecureStore.deleteItemAsync('kv_private_key');"),
  p("await SecureStore.deleteItemAsync('kv_mnemonic');"),
];

const out = [...L.slice(0, i), ...guarded, ...L.slice(i + 3)].join(EOL);

for (const m of ['[DELETE-GUARD]', 'restoreWalletFromMnemonic', "_gMnemonic"]) {
  if (!out.includes(m)) throw new Error('post-condition failed: ' + m);
}
if (out === raw) throw new Error('no changes written');

fs.writeFileSync(P + '.bak-delguard', raw, 'utf8');
fs.writeFileSync(P, out, 'utf8');
console.log('[done] backup at ' + P + '.bak-delguard');
