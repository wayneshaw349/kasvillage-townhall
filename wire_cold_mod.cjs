// wire_cold_mod.cjs — moderation step 3: COLD MOD KEY. Run make_mod_key.cjs FIRST
// (it writes modkey.pub.txt). This patcher then:
// 1. payload_publish: delistFromRegistry gains an optional signer - the record is
//    signed by the cold mod key while the TX dust is paid by the phone wallet
//    (the cold key's address needs no funds).
// 2. VillageMailbox: the moderator flow becomes _modFlow(key). Your wallet no longer
//    IS the mod key: tapping Delist on someone else's listing now offers
//    "Moderator (cold key)..." which asks you to paste the cold private key
//    (secure prompt), verifies it against the mod PUBLIC key, signs once, never stores.
// 3. Replaces the old mod pubkey (your trading wallet 037d42...) with the new cold
//    public key in every file that pins it.
const fs = require('fs');
const OLD = '037d42aac927f9fad639cd0b479b3e921951d90361fd2e1e05d184f8122bf17133';
let NEW;
try { NEW = fs.readFileSync('modkey.pub.txt', 'utf8').trim(); } catch { console.error('modkey.pub.txt not found - run `node make_mod_key.cjs` first.'); process.exit(1); }
if (!/^0[23][0-9a-f]{64}$/.test(NEW)) { console.error('modkey.pub.txt does not hold a compressed pubkey.'); process.exit(1); }

const jobs = [
  { f: 'payload_publish.ts', marker: 'KV_COLD_SIGNER', edits: [
    ["export async function delistFromRegistry(owner: OwnerKeys, head: string, kind: string = 'game', extra?: Record<string, any>) {\n  const rec = signRecord({ v: 1, k: 'delist', t: Date.now(), o: owner.pubkeyHex, d: { head, ...(extra || {}) } } as any, owner.privateKeyHex);",
     "// KV_COLD_SIGNER: optional signer - record signed by the cold mod key, dust paid by the wallet\nexport async function delistFromRegistry(owner: OwnerKeys, head: string, kind: string = 'game', extra?: Record<string, any>, signer?: { privateKeyHex: string; pubkeyHex: string }) {\n  const rec = signRecord({ v: 1, k: 'delist', t: Date.now(), o: (signer && signer.pubkeyHex) || owner.pubkeyHex, d: { head, ...(extra || {}) } } as any, (signer && signer.privateKeyHex) || owner.privateKeyHex);"],
  ] },
  { f: 'VillageMailbox.tsx', marker: 'KV_COLD_MOD', edits: [
    ["      if (entry.ownerPubkey && String(entry.ownerPubkey) !== pub && pub === _KV_MOD) {\n        const _head = String(entry.arweaveTx || entry.id);\n        const _fin = async (reason: string, note: string) => {",
     "      const _modFlow = (_mPriv: string, _mPub: string) => { // KV_COLD_MOD\n        const _head = String(entry.arweaveTx || entry.id);\n        const _fin = async (reason: string, note: string) => {"],
    ["const r: any = await delistFromRegistry({ privateKeyHex: priv, pubkeyHex: pub, address: sender, network: 'testnet-10' as any }, _head, kind, { reason, evidenceHash, mod: 1 });",
     "const r: any = await delistFromRegistry({ privateKeyHex: priv, pubkeyHex: pub, address: sender, network: 'testnet-10' as any }, _head, kind, { reason, evidenceHash, mod: 1 }, { privateKeyHex: _mPriv, pubkeyHex: _mPub });"],
    ["          { text: 'Cancel', style: 'cancel' },\n        ]);\n        return;\n      }\n      if (entry.ownerPubkey && String(entry.ownerPubkey) !== pub) { Alert.alert('Not your listing', 'Only the publisher key can delist. Readers ignore delists from other keys.'); return; }",
     `          { text: 'Cancel', style: 'cancel' },
        ]);
      };
      if (entry.ownerPubkey && String(entry.ownerPubkey) !== pub && pub === _KV_MOD) { _modFlow(priv, pub); return; }
      if (entry.ownerPubkey && String(entry.ownerPubkey) !== pub) {
        // cold-key moderation: key pasted at use, verified against _KV_MOD, never stored
        const RN = require('react-native');
        const _askCold = () => {
          if (RN.Platform.OS === 'ios' && (RN.Alert as any).prompt) {
            (RN.Alert as any).prompt('Cold mod key', 'Paste the moderator private key (64 hex). Used once to sign, never stored.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Unlock', onPress: (t: string) => {
                try {
                  const k = String(t || '').trim().toLowerCase();
                  const mp = bytesToHex(secp256k1.getPublicKey(hexToBytes(k), true));
                  if (mp !== _KV_MOD) { Alert.alert('Wrong key', 'That key does not match the moderation public key.'); return; }
                  _modFlow(k, mp);
                } catch (e: any) { Alert.alert('Bad key', String((e && e.message) || e)); }
              } },
            ], 'secure-text');
          } else { Alert.alert('iOS only', 'Cold-key moderation uses the iOS secure prompt for now.'); }
        };
        Alert.alert('Not your listing', 'Only the publisher key can delist - or the moderator, with the cold key.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Moderator (cold key)\\u2026', onPress: _askCold },
        ]);
        return;
      }`],
  ] },
];

let ok = true; const staged = [];
for (const j of jobs) {
  let s = fs.readFileSync(j.f, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes(j.marker)) { console.log(j.f + ': already patched - skipping'); continue; }
  for (const [a] of j.edits) { const c = s.split(a).length - 1; if (c !== 1) { console.error(j.f + ' ANCHOR count ' + c + ' expected 1: ' + a.slice(0, 60).replace(/\n/g, ' ')); ok = false; } }
  staged.push({ ...j, s, CRLF });
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const j of staged) {
  let s = j.s;
  for (const [a, b] of j.edits) s = s.split(a).join(b);
  fs.writeFileSync(j.f, j.CRLF ? s.replace(/\n/g, '\r\n') : s);
  console.log(j.f + ': patched');
}
// 3. rotate the pinned pubkey everywhere (idempotent)
let swapped = 0;
for (const f of ['VillageMailbox.tsx', 'kaspa_payload.ts']) {
  let s = fs.readFileSync(f, 'utf8');
  const n = s.split(OLD).length - 1;
  if (n) { fs.writeFileSync(f, s.split(OLD).join(NEW)); console.log(f + ': rotated mod pubkey in ' + n + ' place(s)'); swapped += n; }
}
if (!swapped) console.log('pubkey already rotated (old key not found)');
else if (swapped < 3) console.warn('WARNING: expected the old key in ~4 places, found ' + swapped + ' - check manually.');
console.log('DONE - cold mod key live. Your trading wallet is no longer the mod key.');
