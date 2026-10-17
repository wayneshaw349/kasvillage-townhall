// wire_mod_reason.cjs — moderation step 1: mod delists carry a reason + evidenceHash.
// - delistFromRegistry(owner, head, kind, extra?) -> d: { head, ...extra }
// - Delist button: if the wallet is the mod key and NOT the owner, run the
//   moderator flow (pick a reason, optional private note on iOS). Only the hash
//   of {head, reason, note, title, owner, t} goes on chain; the full preimage is
//   kept locally in AsyncStorage 'kv_mod_log' so you can prove it later.
// Readers already honor mod-key delists; the extra fields are ignored by them.
const fs = require('fs');

const jobs = [
  {
    f: 'payload_publish.ts',
    marker: 'KV_MOD_EXTRA',
    edits: [
      ["export async function delistFromRegistry(owner: OwnerKeys, head: string, kind: string = 'game') {\n  const rec = signRecord({ v: 1, k: 'delist', t: Date.now(), o: owner.pubkeyHex, d: { head } } as any, owner.privateKeyHex);",
       "// KV_MOD_EXTRA: optional { reason, evidenceHash, mod } on moderator delists\nexport async function delistFromRegistry(owner: OwnerKeys, head: string, kind: string = 'game', extra?: Record<string, any>) {\n  const rec = signRecord({ v: 1, k: 'delist', t: Date.now(), o: owner.pubkeyHex, d: { head, ...(extra || {}) } } as any, owner.privateKeyHex);"],
    ],
  },
  {
    f: 'VillageMailbox.tsx',
    marker: 'KV_MOD_REASON',
    edits: [
      ["      if (entry.ownerPubkey && String(entry.ownerPubkey) !== pub) { Alert.alert('Not your listing',",
       `      // KV_MOD_REASON: moderator path (mod key, not the owner) - reason + evidence hash on chain
      const _KV_MOD = '037d42aac927f9fad639cd0b479b3e921951d90361fd2e1e05d184f8122bf17133';
      if (entry.ownerPubkey && String(entry.ownerPubkey) !== pub && pub === _KV_MOD) {
        const _head = String(entry.arweaveTx || entry.id);
        const _fin = async (reason: string, note: string) => {
          try {
            const { utf8ToBytes } = require('@noble/hashes/utils');
            let _sha: any; try { _sha = require('@noble/hashes/sha256').sha256; } catch (_) { _sha = require('@noble/hashes/sha2').sha256; }
            const pre = JSON.stringify({ head: _head, reason, note: note || '', title: String(entry.title || entry.name || ''), owner: String(entry.ownerPubkey || ''), t: Date.now() });
            const evidenceHash = bytesToHex(_sha(utf8ToBytes(pre)));
            const { delistFromRegistry } = require('./payload_publish');
            const r: any = await delistFromRegistry({ privateKeyHex: priv, pubkeyHex: pub, address: sender, network: 'testnet-10' as any }, _head, kind, { reason, evidenceHash, mod: 1 });
            if (r && r.success === false) throw new Error(String(r.error || 'send failed'));
            try {
              const AS = require('@react-native-async-storage/async-storage').default;
              const old = JSON.parse((await AS.getItem('kv_mod_log')) || '[]');
              old.push({ pre, evidenceHash, kind, txid: (r && (r.txid || r.transactionId)) || null });
              await AS.setItem('kv_mod_log', JSON.stringify(old));
            } catch (_) {}
            console.log('[ModDelist]', _head.slice(0, 24), reason, evidenceHash, 'preimage:', pre);
            setStoreView(null);
            Alert.alert('Moderator delist posted', 'Reason: ' + reason + '\\nEvidence hash: ' + evidenceHash.slice(0, 16) + '...\\nPreimage saved on this phone (kv_mod_log). The owner can see the reason on chain.');
          } catch (e: any) { Alert.alert('Mod delist failed', String((e && e.message) || e)); }
        };
        const _note = (reason: string) => setTimeout(() => {
          const RN = require('react-native');
          if (RN.Platform.OS === 'ios' && (RN.Alert as any).prompt) {
            (RN.Alert as any).prompt('Evidence note (private)', 'Describe the evidence or file reference. Only its hash goes on chain.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delist', style: 'destructive', onPress: (t: string) => _fin(reason, t || '') },
            ], 'plain-text');
          } else { _fin(reason, ''); }
        }, 350);
        Alert.alert('Moderator delist', 'Not your listing - acting as moderator. Pick a reason; it is recorded on chain with an evidence hash (~1 KAS).', [
          { text: 'Prohibited category', onPress: () => _note('prohibited') },
          { text: 'Scam / fraud', onPress: () => _note('fraud') },
          { text: 'Illegal content', onPress: () => _note('illegal') },
          { text: 'Cancel', style: 'cancel' },
        ]);
        return;
      }
      if (entry.ownerPubkey && String(entry.ownerPubkey) !== pub) { Alert.alert('Not your listing',`],
    ],
  },
];

let ok = true;
const staged = [];
for (const j of jobs) {
  let s = fs.readFileSync(j.f, 'utf8');
  const CRLF = s.includes('\r\n');
  if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes(j.marker)) { console.log(j.f + ': already patched - skipping'); continue; }
  for (let i = 0; i < j.edits.length; i++) { const c = s.split(j.edits[i][0]).length - 1; if (c !== 1) { console.error(j.f + ' ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1.'); ok = false; } }
  staged.push({ ...j, s, CRLF });
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const j of staged) {
  let s = j.s;
  for (const [a, b] of j.edits) s = s.split(a).join(b);
  fs.writeFileSync(j.f, j.CRLF ? s.replace(/\n/g, '\r\n') : s);
  console.log(j.f + ': patched');
}
console.log('DONE - moderator delists carry reason + evidence hash.');
