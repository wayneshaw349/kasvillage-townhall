// wire_announce_button.cjs — ANNOUNCE-ONLY button beside each PUBLISH button.
//
// Re-broadcasts NOTHING: derives the same owner + addresses, reads the daa
// span + a fresh walk anchor, and sends the single ~1 KAS registry announce
// carrying the full quad. Use when the game is already on chain (records
// seeded) and only the registry entry is missing.
// Run from layer1 root:  node src\wire_announce_button.cjs
const fs = require("fs");
const P = "Workspace.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("runAnnounceOnly")) { console.log("already patched"); process.exit(0); }
let n = 0;
function rep(name, a, b, exp) {
  const f = s.split(a).length - 1;
  if (f !== exp) { console.error("ABORT [" + name + "]: expected " + exp + ", found " + f); process.exit(1); }
  s = s.split(a).join(b); n++; console.log("ok  [" + name + "]");
}
rep("announce-fn",
`  const runPublish = async (gameId: string) => {`,
`  const runAnnounceOnly = async (gameId: string) => {
    if (gbusy) return;
    setGbusy(gameId); setGlog([]);
    try {
      const entry = GAMES[gameId];
      if (!entry) { gadd('unknown game ' + gameId); setGbusy(''); return; }
      const m = entry.bundle.manifest;
      const { deriveStoreKeys, announceToRegistry } = require('./payload_publish');
      const { getWalletPrivateKey, getWalletAddress, getWalletPublicKey } = require('./bip39_wallet');
      const priv = await getWalletPrivateKey();
      const pub = await getWalletPublicKey();
      const myAddr = await getWalletAddress();
      const owner = { privateKeyHex: priv, pubkeyHex: pub, address: myAddr, network: 'testnet-10' as any };
      const slots = Math.max(...m.frags.map((f: any) => f.slot)) + 1;
      const slotAddresses = Array.from({ length: slots }, (_, i) => deriveStoreKeys(priv, entry.nonceBase + i, owner.network).address);
      const manifestAddress = deriveStoreKeys(priv, entry.nonceBase + 86, owner.network).address;
      gadd('announce-only for ' + gameId);
      gadd('manifest ' + manifestAddress);
      let publishAnchor = '';
      try {
        const sr = await fetch('https://kasvillage.app.runonflux.io/api/kaspa/sink');
        publishAnchor = String((await sr.json()).sink || '');
        if (publishAnchor) gadd('walk anchor: ' + publishAnchor.slice(0, 16) + '…');
      } catch {}
      let daaSpan: any = {};
      try {
        let lo = Number.MAX_SAFE_INTEGER, hi = 0;
        for (const sa of slotAddresses.concat([manifestAddress])) {
          const ur = await fetch('https://api-tn10.kaspa.org/addresses/' + encodeURIComponent(sa) + '/utxos');
          for (const u of (await ur.json()) || []) {
            const d = Number(u.utxoEntry?.blockDaaScore || u.blockDaaScore || 0);
            if (d > 0) { if (d < lo) lo = d; if (d > hi) hi = d; }
          }
        }
        if (hi > 0) daaSpan = { daa_from: Math.max(0, lo - 600), daa_to: hi + 600, ...(publishAnchor ? { anchor_hash: publishAnchor } : {}) };
        gadd('walk span: daa ' + daaSpan.daa_from + ' .. ' + daaSpan.daa_to);
      } catch (de: any) { gadd('daa span skipped: ' + String(de?.message || de)); }
      // manifestHash is deterministic: sha256 of the manifest JSON — the exact
      // recipe publishConfigChunks used, so this equals the published hash.
      const { sha256 } = require('@noble/hashes/sha256');
      const { bytesToHex, utf8ToBytes } = require('@noble/hashes/utils');
      const manifestHash = bytesToHex(sha256(utf8ToBytes(JSON.stringify(m))));
      gadd('manifestHash ' + manifestHash.slice(0, 16) + '…');
      const quad = { game: gameId, manifestAddress, manifestHash, head: m.head, ...daaSpan };
      gadd('announcing to game registry…');
      const _ann: any = await announceToRegistry(owner, manifestAddress, gameId, 'Game', 'game', { primaryLink: JSON.stringify(quad), configHash: manifestHash } as any);
      if (_ann && _ann.success !== false) gadd('registry announce OK -> ' + String(_ann.registryAddr || '').slice(0, 24) + '… (~1 KAS)');
      else gadd('announce failed: ' + String((_ann && _ann.error) || 'unknown'));
    } catch (e: any) { gadd('announce error: ' + String(e?.message || e)); }
    setGbusy('');
  };
  const runPublish = async (gameId: string) => {`, 1);
rep("announce-btn",
`        <TouchableOpacity key={id} disabled={!!gbusy} onPress={() => runPublish(id)}`,
`        <TouchableOpacity key={id + '-ann'} disabled={!!gbusy} onPress={() => runAnnounceOnly(id)}
          style={{ backgroundColor: '#241f36', borderWidth: 1, borderColor: '#7c5cff', borderRadius: 8, padding: 10, marginBottom: 6 }}>
          <Text style={{ color: '#b9a6ff', fontWeight: '800', fontFamily: 'monospace', fontSize: 12 }}>
            {gbusy === id ? 'WORKING…' : 'ANNOUNCE ' + id + ' (registry only, ~1 KAS)'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity key={id} disabled={!!gbusy} onPress={() => runPublish(id)}`, 1);
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("\npatched " + P + " (" + n + "). ANNOUNCE button live above each PUBLISH button.");
