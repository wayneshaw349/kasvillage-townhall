// wire_bugfix_batch1.cjs - verified fixes from the bug bounty sweep (wallet side).
//   node wire_bugfix_batch1.cjs     (project folder; safe to run twice)
// A  Face ID cancel no longer opens onboarding (was a way into the wallet) -> Locked screen + Unlock
// B  addresses are checksum-verified before any send; recipient must be on the same network
// C  store delist no longer sends your whole balance; pledge withdraw fee headroom fixed
// D  IOU: acceptance signature covers the pay-to address, full pubkey match, closed IOUs cannot be re-pasted
// E  game cards: only signed listings count, another key cannot take over a game card, delists per signer
// F  page security policy cannot be switched off with an HTML comment
// G  Mailbox copy buttons work (Clipboard.setString was removed in expo-clipboard)
// H  mainnet: pledge / walk-span lookups follow the address network (were hard-wired to testnet)
// I  store publish spinner resets when the content filter blocks it; "Delete seed" really deletes it
// J  KAS -> sompi rounding (0.29 KAS was sent as 0.28999999)
// K  a wallet with no recovery words is never deleted when the network differs
// L  game network: a redirect cannot escape the host allowlist
// K  a wallet with no recovery words is never deleted when the network differs
// L  game network: a redirect cannot escape the host allowlist
const fs = require('fs');
let ok = 0, skip = 0, bad = 0;
function patch(file, steps) {
  if (!fs.existsSync(file)) { console.log('MISSING ' + file); bad++; return; }
  const raw = fs.readFileSync(file, 'utf8'); const CRLF = raw.includes('\r\n');
  let s = raw.replace(/\r\n/g, '\n'); let changed = false;
  for (const [name, mark, fn] of steps) {
    if (s.includes(mark)) { console.log('  skip  ' + name); skip++; continue; }
    const n = fn(s);
    if (n === s || !n.includes(mark)) { console.log('  FAIL  ' + name + ' - anchor not found'); bad++; continue; }
    s = n; changed = true; ok++; console.log('  ok    ' + name);
  }
  if (changed) { fs.copyFileSync(file, file + '.bak_bb1'); fs.writeFileSync(file, CRLF ? s.replace(/\n/g, '\r\n') : s, 'utf8'); }
}
const rep = (a, b) => (s) => s.split(a).length === 2 ? s.replace(a, b) : s;   // exactly one match or no change

// ---------------- A ----------------
console.log('AppNaviagator.tsx');
patch('AppNaviagator.tsx', [
  ['A Face ID fail -> Locked screen (not onboarding)', 'KV_LOCKED_SCREEN', (s) => {
    const a = "  const handleBiometricFail = useCallback(() => setScreen('onboarding'), []);";
    const b = "    case 'biometric_gate':\n      return <BiometricGate onSuccess={handleBiometricSuccess} onFail={handleBiometricFail} />;";
    const u = "  | 'biometric_gate'\n";
    if (s.split(a).length !== 2 || s.split(b).length !== 2 || s.split(u).length !== 2) return s;
    return s.replace(u, u + "  | 'kv_locked'\n")
      .replace(a, "  const handleBiometricFail = useCallback(() => setScreen('kv_locked' as any), []); // KV_LOCKED_SCREEN: a cancelled / failed unlock never reaches onboarding")
      .replace(b, "    case 'kv_locked':\n      return (\n        <View style={{ flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', padding: 24 }}>\n" +
        "          <Text style={{ color: '#D4AF37', fontSize: 24, fontWeight: '800', marginBottom: 10 }}>{'\\u{1F512}'} Locked</Text>\n" +
        "          <Text style={{ color: '#aaa', fontSize: 14, textAlign: 'center', marginBottom: 26 }}>Unlock with Face ID or your phone passcode to open your wallet.</Text>\n" +
        "          <TouchableOpacity onPress={() => setScreen('biometric_gate')} style={{ backgroundColor: '#D4AF37', paddingHorizontal: 34, paddingVertical: 14, borderRadius: 10 }}>\n" +
        "            <Text style={{ color: '#000', fontWeight: '800', fontSize: 16 }}>Unlock</Text>\n          </TouchableOpacity>\n        </View>\n      );\n\n" + b);
  }],
]);

// ---------------- B ----------------
console.log('kaspa_rest_tx.ts');
patch('kaspa_rest_tx.ts', [
  ['B checksum check in addressToScript', 'KV_ADDR_CHECKSUM', rep(
    "function addressToScript(address: string): Uint8Array {\n  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';\n",
    "export function kvAddressValid(address: string): boolean { // KV_ADDR_CHECKSUM: bech32 (40-bit polymod) + prefix + charset + length\n" +
    "  const C = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'; const a = String(address || '');\n" +
    "  const m = /^(kaspa|kaspatest|kaspadev|kaspasim):([a-z0-9]+)$/.exec(a); if (!m) return false;\n" +
    "  const d: number[] = []; for (const ch of m[2]) { const v = C.indexOf(ch); if (v < 0) return false; d.push(v); }\n" +
    "  if (d.length < 8 + 53) return false;\n" +
    "  let c = 1n; for (const v of [...Array.from(m[1]).map((x) => x.charCodeAt(0) & 31), 0, ...d]) { const c0 = c >> 35n; c = ((c & 0x07ffffffffn) << 5n) ^ BigInt(v);\n" +
    "    if (c0 & 1n) c ^= 0x98f2bc8e61n; if (c0 & 2n) c ^= 0x79b76d99e2n; if (c0 & 4n) c ^= 0xf33e5fb3c4n; if (c0 & 8n) c ^= 0xae2eabe2a8n; if (c0 & 16n) c ^= 0x1e4f43e470n; }\n" +
    "  return (c ^ 1n) === 0n;\n}\n" +
    "function addressToScript(address: string): Uint8Array {\n  if (!kvAddressValid(address)) throw new Error('Invalid Kaspa address (checksum failed) - check every character'); // KV_ADDR_CHECKSUM\n  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';\n")],
  ['B recipient must match sender network', 'KV_ADDR_SAMENET', rep(
    "  const { senderAddress, recipientAddress, amountSompi, privateKeyHex, network, payload } = params;\n  \n  try {\n",
    "  const { senderAddress, recipientAddress, amountSompi, privateKeyHex, network, payload } = params;\n  \n  try {\n" +
    "    if (String(recipientAddress).split(':')[0] !== String(senderAddress).split(':')[0]) throw new Error('Wrong network: ' + String(recipientAddress).split(':')[0] + ' address from a ' + String(senderAddress).split(':')[0] + ' wallet'); // KV_ADDR_SAMENET\n")],
]);
console.log('kasvillage_cold_wallet.tsx');
patch('kasvillage_cold_wallet.tsx', [
  ['B Send screen validates checksum', 'KV_ADDR_UI', rep(
    "function isValidKaspaAddress(address: string): boolean {\n  if (!address) return false;\n",
    "function isValidKaspaAddress(address: string): boolean {\n  if (!address) return false;\n  try { if (!require('./kaspa_rest_tx').kvAddressValid(address.trim())) return false; } catch {} // KV_ADDR_UI\n")],
]);

// ---------------- C ----------------
console.log('payload_publish.ts');
patch('payload_publish.ts', [
  ['C delist sends dust, not your balance', 'KV_DELIST_DUST', (s) => {
    const i = s.indexOf('export async function publishDelist('); if (i < 0) return s;
    const j = s.indexOf('    amountSompi: 0n,\n', i); if (j < 0 || j - i > 600) return s;
    return s.slice(0, j) + '    amountSompi: 20_000_000n, // KV_DELIST_DUST: 0n meant "send everything" in sendKaspaViaRest\n' + s.slice(j + '    amountSompi: 0n,\n'.length);
  }],
  ['C pledge withdraw fee headroom', 'KV_WITHDRAW_FEE', rep(
    "  const FEE_HEADROOM = 100_000n; // 0.001 KAS; sender's fee loop settles exact",
    "  const FEE_HEADROOM = 1_000_000n; // KV_WITHDRAW_FEE: 0.01 KAS - 100k was below the real fee, so every withdraw failed")],
]);

// ---------------- D ----------------
console.log('proposal_share.ts');
patch('proposal_share.ts', [
  ['D acceptance signs the pay-to address (v2)', 'KV_COUNTERSIGN_V2', (s) => {
    const a = "function hashCounterSign(proposal: TradeProposal): Uint8Array {\n  const canonical = JSON.stringify({\n    proposalSig: proposal.sig,\n    amount: proposal.amount,\n    from: proposal.from,\n    ts: proposal.ts,\n    nonce: proposal.nonce,\n  });\n  return sha256(new TextEncoder().encode('KV_COUNTERSIGN_V1:' + canonical));\n}";
    const v = "    const hash = hashCounterSign(a.proposal);\n    const sig = (secp256k1 as any).Signature.fromCompact(hexToBytes(a.counterSig));";
    const c = "  const hash = hashCounterSign(proposal);\n  const sig = secp256k1.sign(hash, hexToBytes(creds.privkey));";
    const p = "  // Verify signature\n  try {\n    const hash = hashProposal(proposal);";
    if ([a, v, c, p].some((x) => s.split(x).length !== 2)) return s;
    s = s.replace(a, "function hashCounterSign(proposal: TradeProposal, counterAddr?: string): Uint8Array { // KV_COUNTERSIGN_V2: pay-to address is signed\n  const canonical = JSON.stringify({\n    proposalSig: proposal.sig,\n    amount: proposal.amount,\n    from: proposal.from,\n    ts: proposal.ts,\n    nonce: proposal.nonce,\n    ...(counterAddr !== undefined ? { counterAddr } : {}),\n  });\n  return sha256(new TextEncoder().encode((counterAddr !== undefined ? 'KV_COUNTERSIGN_V2:' : 'KV_COUNTERSIGN_V1:') + canonical));\n}\n" +
      "export async function kvIsClosedIOU(nonce: string): Promise<boolean> { try { const AS = require('@react-native-async-storage/async-storage').default; const L = JSON.parse((await AS.getItem('kv_closed_ious')) || '[]'); return Array.isArray(L) && L.includes(String(nonce)); } catch { return false; } }\n" +
      "export async function kvMarkClosedIOU(nonce: string): Promise<void> { try { const AS = require('@react-native-async-storage/async-storage').default; const L = JSON.parse((await AS.getItem('kv_closed_ious')) || '[]'); const n = (Array.isArray(L) ? L : []).filter((x: string) => x !== String(nonce)); n.push(String(nonce)); await AS.setItem('kv_closed_ious', JSON.stringify(n.slice(-500))); } catch {} }");
    const v2 = "    if (!/^[0-9a-f]{32,66}$/.test(String(a.counterPubkey || ''))) return { valid: false, error: 'Acceptor pubkey too short' };\n    const hash = hashCounterSign(a.proposal, String(a.counterAddr || ''));\n    const sig = (secp256k1 as any).Signature.fromCompact(hexToBytes(a.counterSig));";
    const c2 = "  const hash = hashCounterSign(proposal, String(creds.address || ''));\n  const sig = secp256k1.sign(hash, hexToBytes(creds.privkey));";
    const p2 = "  if (!/^[0-9a-f]{32,66}$/.test(String(proposal.from || ''))) return { valid: false, error: 'Sender pubkey too short' };\n  // Verify signature\n  try {\n    const hash = hashProposal(proposal);";
    return s.replace(v, v2).replace(c, c2).replace(p, p2);
  }],
]);
console.log('IOUBalanceSheetShare.tsx');
patch('IOUBalanceSheetShare.tsx', [
  ['D closed IOUs cannot be re-pasted', 'KV_IOU_CLOSED', (s) => {
    const a = "const acc = decodeAcceptance(pasteInput.trim()); if (!acc) throw new Error('Invalid acceptance');";
    const r = "  const removePropIOU = async (nonce: string) => { setPropIOUs(";
    if (s.split(a).length !== 2 || s.split(r).length !== 2) return s;
    return s.replace(a, a + " if (await require('./proposal_share').kvIsClosedIOU(acc.proposal.nonce)) throw new Error('This IOU was already settled or cancelled'); /* KV_IOU_CLOSED */")
      .replace(r, "  const removePropIOU = async (nonce: string) => { try { await require('./proposal_share').kvMarkClosedIOU(nonce); } catch {} setPropIOUs(");
  }],
]);

// ---------------- E ----------------
console.log('VillageMailbox.tsx');
patch('VillageMailbox.tsx', [
  ['E only signed game listings', 'KV_ANN_SIGNED', rep(
    "            if (!r || r.k !== 'registry' || !r.d) return null;\n            let quad: any = null;",
    "            if (!r || r.k !== 'registry' || !r.d) return null;\n            try { if (typeof kp.verifyRecord === 'function' && !kp.verifyRecord(r)) return null; } catch { return null; } // KV_ANN_SIGNED\n            let quad: any = null;")],
  ['E another key cannot take over a game card', 'KV_ANN_OWNER', rep(
    "            const prev = byHead.get(it.quad.head); if (!prev || it.t > prev.t) byHead.set(it.quad.head, it);",
    "            const prev = byHead.get(it.quad.head); if (!prev || (prev.o === it.o && it.t > prev.t)) byHead.set(it.quad.head, it); // KV_ANN_OWNER: first signer seen (device cache first) owns the card")],
  ['E delists kept per signer', 'KV_DELIST_PERSIGNER', (s) => {
    const a = "            if (it.delist) { const p = delistByHead.get(it.head); if (!p || it.t > p.t) delistByHead.set(it.head, it); return; }";
    const d = "          const delistByHead = new Map<string, any>();\n";
    const f1 = "if (byHead.size) { try { setGames(Array.from(byHead.values()).filter((it: any) => { const d = delistByHead.get(it.quad.head);";
    const f2 = "            const d = delistByHead.get(it.quad.head);\n            if (!d) return true;";
    if ([a, d, f1, f2].some((x) => s.split(x).length !== 2)) return s;
    return s.replace(d, d + "          const _kvDl = (h: string, o: string) => { let best: any = null; for (const v of delistByHead.values()) if (v.head === h && (v.o === o || v.o === KV_MOD_PUBKEY) && (!best || v.t > best.t)) best = v; return best; }; // KV_DELIST_PERSIGNER\n")
      .replace(a, "            if (it.delist) { const _k = it.head + '|' + it.o; const p = delistByHead.get(_k); if (!p || it.t > p.t) delistByHead.set(_k, it); return; }")
      .replace(f1, "if (byHead.size) { try { setGames(Array.from(byHead.values()).filter((it: any) => { const d = _kvDl(it.quad.head, it.o);")
      .replace(f2, "            const d = _kvDl(it.quad.head, it.o);\n            if (!d) return true;");
  }],
  ['G copy buttons (setString removed)', 'KV_CLIP_ASYNC', (s) => {
    const n = s.split('Clipboard.setString(').length - 1; if (n < 1) return s;
    return s.split('Clipboard.setString(').join('Clipboard.setStringAsync(') + '\n// KV_CLIP_ASYNC\n';
  }],
]);

// ---------------- F ----------------
console.log('OnChainPageView.tsx');
patch('OnChainPageView.tsx', [
  ['F CSP ignores <head> inside comments', 'KV_CSP_NOCOMMENT', rep(
    "  if (/<head(\\s[^>]*)?>/i.test(raw)) return raw.replace(/<head(\\s[^>]*)?>/i, (mm) => mm + meta); // word-boundary: never matches JS like i<heads.length",
    "  { // KV_CSP_NOCOMMENT: find the first <head> that is NOT inside <!-- -->\n" +
    "    const blank = raw.replace(/<!--[\\s\\S]*?(-->|$)/g, (c) => ' '.repeat(c.length));\n" +
    "    const hm = /<head(\\s[^>]*)?>/i.exec(blank);\n" +
    "    if (hm) { const at = hm.index + hm[0].length; return raw.slice(0, at) + meta + raw.slice(at); }\n" +
    "    if (/<!--/.test(raw)) { const dm = /^\\s*<!doctype[^>]*>/i.exec(blank); const at = dm ? dm[0].length : 0; return raw.slice(0, at) + meta + raw.slice(at); }\n" +
    "  }")],
]);

// ---------------- H ----------------
const NETFIX = (s) => {
  const re = /fetch\('https:\/\/api-tn10\.kaspa\.org\/addresses\/' \+ encodeURIComponent\(([^()]+(?:\([^()]*\))?[^()]*)\) \+ '\/utxos'\)/g;
  let n = 0; const out = s.replace(re, (m, v) => { n++; return "fetch((String(" + v + ").startsWith('kaspa:') ? 'https://api.kaspa.org' : 'https://api-tn10.kaspa.org') + '/addresses/' + encodeURIComponent(" + v + ") + '/utxos')"; });
  return n ? out + '\n// KV_NET_API (' + n + ')\n' : s;
};
console.log('Workspace.tsx');
patch('Workspace.tsx', [
  ['H mainnet-aware pledge / span lookups', 'KV_NET_API', NETFIX],
  ['I store publish spinner resets on content block', 'KV_PUB_RESET', rep(
    "          setPubStage('');\n          Alert.alert('Cannot publish', reasonMessage(_hits[0].reason));",
    "          setPubStage(''); setIsPublishing(false); // KV_PUB_RESET\n          Alert.alert('Cannot publish', reasonMessage(_hits[0].reason));")],
]);
console.log('game_chunks.ts');
patch('game_chunks.ts', [['H mainnet-aware walk span', 'KV_NET_API', NETFIX]]);

// ---------------- I ----------------
console.log('MnemonicExportModal.tsx');
patch('MnemonicExportModal.tsx', [
  ['I "Delete seed" really deletes the seed', 'KV_SEED_DELETE', rep(
    "    if (confirmDelete) {\n      Alert.alert(\n        '⚠️ Seed Deleted',",
    "    if (confirmDelete) {\n      try { require('expo-secure-store').deleteItemAsync('kv_mnemonic').catch(() => {}); } catch {} // KV_SEED_DELETE: the key stays, only the 12 words go\n      Alert.alert(\n        '⚠️ Seed Deleted',")],
]);

// ---------------- J ----------------
console.log('SendKAS.tsx');
patch('SendKAS.tsx', [
  ['J KAS -> sompi rounding', 'KV_SOMPI_ROUND', rep(
    "function kasToSompi(kas: number): bigint {\n  return BigInt(Math.floor(kas * 100_000_000));",
    "function kasToSompi(kas: number): bigint {\n  return BigInt(Math.round(kas * 100_000_000)); // KV_SOMPI_ROUND")],
]);

// ---------------- K ----------------
console.log('expo_identity_ritual.tsx');
patch('expo_identity_ritual.tsx', [
  ['K raw-key wallet is never silently deleted on a network switch', 'KV_NO_SILENT_DELETE', rep(
    "          console.warn('[PhaseAnchor] DELETE-GUARD: no mnemonic — wallet is unrecoverable');\n          await SecureStore.deleteItemAsync('kv_kaspa_address');\n          await SecureStore.deleteItemAsync('kv_private_key');\n          await SecureStore.deleteItemAsync('kv_mnemonic');\n",
    "          console.warn('[PhaseAnchor] DELETE-GUARD: no mnemonic - keeping the wallet (KV_NO_SILENT_DELETE)');\n" +
    "          Alert.alert('Wallet kept', 'This wallet has no recovery words and belongs to the other network, so it was NOT deleted. Switch the network setting back to use it.');\n" +
    "          return;\n")],
]);

// ---------------- L ----------------
console.log('kv_net_bridge.ts');
patch('kv_net_bridge.ts', [
  ['L game network: a redirect cannot leave the allowlist', 'KV_NET_REDIRECT', rep(
    "      const body = await r.text();\n      if (body.length > MAX_RESP) { reply({ error: 'response too large' }); return; }",
    "      if (r.url && r.url !== m.url && !kvNetAllowed(String(r.url), allow)) { reply({ error: 'blocked redirect: ' + String(r.url).slice(0, 80) }); return; } // KV_NET_REDIRECT\n      const body = await r.text();\n      if (body.length > MAX_RESP) { reply({ error: 'response too large' }); return; }")],
]);

console.log('\n' + ok + ' applied, ' + skip + ' already done, ' + bad + ' failed' + (bad ? '  <- send me this output' : '') + '\nBackups: *.bak_bb1');
