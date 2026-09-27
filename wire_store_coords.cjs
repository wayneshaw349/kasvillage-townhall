// wire_store_coords.cjs - stores, dapps and academics get coordinates too.
//
// Only the two GAME announce paths carried a quad. Stores announced
// {primaryLink, configHash} and dapps announced {configHash} - no anchor_hash,
// no daa span, no pledge. Their chunks were on chain the whole time with
// nothing advertising where to look, so the moment the relay recycled they
// were undiscoverable. Exactly the bug games had this morning.
//
// Academics needs no separate work: the Research Shelf is a view inside the
// storefront config, so it publishes and announces through the store path.
//
// primaryLink is a real URL for a store, so coords get their own field rather
// than being packed into it the way a game quad is.
//
// Anchor is captured BEFORE the first chunk tx in both paths, so a walk starts
// just ahead of the content instead of crawling from the pruning point.
// Run from layer1 root:  node src\\wire_store_coords.cjs
const fs = require("fs");
function patch(P, edits, guard) {
  let s = fs.readFileSync(P, "utf8");
  const CRLF = s.includes("\r\n");
  if (CRLF) s = s.replace(/\r\n/g, "\n");
  if (s.includes(guard)) { console.log("already patched  [" + P + "]"); return; }
  for (const [name, a, b] of edits) {
    const f = s.split(a).length - 1;
    if (f !== 1) { console.error("ABORT [" + name + "]: found " + f + ", expected 1"); process.exit(1); }
    s = s.split(a).join(b); console.log("ok  [" + name + "]");
  }
  fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
}
patch("kaspa_payload.ts", [["record-coords", "export function makeRegistryAnnounce(ownerPubkey: string, storeAddress: string, name: string, category: string, extra?: { primaryLink?: string; configHash?: string }): KvRecord {\n  const d: any = { storeAddress, name, category };\n  if (extra?.primaryLink) d.primaryLink = extra.primaryLink;\n  if (extra?.configHash) d.configHash = extra.configHash;", "export function makeRegistryAnnounce(ownerPubkey: string, storeAddress: string, name: string, category: string, extra?: { primaryLink?: string; configHash?: string; coords?: any }): KvRecord {\n  const d: any = { storeAddress, name, category };\n  if (extra?.primaryLink) d.primaryLink = extra.primaryLink;\n  if (extra?.configHash) d.configHash = extra.configHash;\n  // Coordinates: anchor_hash + daa span + pledge, same as a game quad. Stores\n  // and dapps kept their chunks on chain but advertised no way to find them,\n  // so once the relay recycled they were undiscoverable. primaryLink is a real\n  // URL here, so the coords need a field of their own.\n  if (extra?.coords) d.coords = extra.coords;"]], "d.coords");
patch("payload_publish.ts", [["announce-sig", "  extra?: { primaryLink?: string; configHash?: string },", "  extra?: { primaryLink?: string; configHash?: string; coords?: any },"]], "coords?: any");
patch("Workspace.tsx", [
  ["store-anchor", "      setPubStage('Anchoring pledge on Kaspa L1...');\n      const _pub: any = await publishContent(_owner, 'store', {", "      setPubStage('Anchoring pledge on Kaspa L1...');\n      // Anchor BEFORE the first chunk tx, so the walk starts just ahead of the\n      // content instead of crawling from the pruning point.\n      let _stAnchor = '';\n      try {\n        const _sr = await fetch('https://kasvillage.app.runonflux.io/api/kaspa/sink');\n        _stAnchor = String((await _sr.json()).sink || '');\n      } catch {}\n      const _pub: any = await publishContent(_owner, 'store', {"],
  ["store-coords", "          const _annHash = _ck.success ? _ck.hash : _cfgHash;\n          const _ann: any = await announceToRegistry(_owner, _pub.storeAddress, brandName, storeCategory, 'store', { primaryLink, configHash: _annHash });", "          const _annHash = _ck.success ? _ck.hash : _cfgHash;\n          let _stCoords: any = undefined;\n          try {\n            let lo = Number.MAX_SAFE_INTEGER, hi = 0, pl = 0;\n            const ur = await fetch('https://api-tn10.kaspa.org/addresses/' + encodeURIComponent(_pub.storeAddress) + '/utxos');\n            for (const u of (await ur.json()) || []) {\n              const dd = Number(u.utxoEntry?.blockDaaScore || u.blockDaaScore || 0);\n              if (dd > 0) { if (dd < lo) lo = dd; if (dd > hi) hi = dd; }\n              pl += Number(u.utxoEntry?.amount || u.amount || 0);\n            }\n            if (hi > 0) _stCoords = { pledge_kas: Math.round(pl / 1e7) / 10, daa_from: Math.max(0, lo - 600), daa_to: hi + 600, ...(_stAnchor ? { anchor_hash: _stAnchor } : {}) };\n            console.log('[Workspace] store coords', _stCoords);\n          } catch (de) { console.warn('[Workspace] store daa span skipped:', de); }\n          const _ann: any = await announceToRegistry(_owner, _pub.storeAddress, brandName, storeCategory, 'store', { primaryLink, configHash: _annHash, coords: _stCoords });"],
  ["dapp-anchor", "                    const _pub: any = await publishContent(_owner, 'dapp', { name: _gname, category: 'GameGrid', contentHash: _cHash }, 1, 500_000_000n);", "                    let _dpAnchor = '';\n                    try {\n                      const _sr = await fetch('https://kasvillage.app.runonflux.io/api/kaspa/sink');\n                      _dpAnchor = String((await _sr.json()).sink || '');\n                    } catch {}\n                    const _pub: any = await publishContent(_owner, 'dapp', { name: _gname, category: 'GameGrid', contentHash: _cHash }, 1, 500_000_000n);"],
  ["dapp-coords", "                    setGameStage('Announcing...');\n                    const _ann: any = await announceToRegistry(_owner, _pub.storeAddress, _gname, 'GameGrid', 'dapp', { configHash: _ck.hash });", "                    setGameStage('Announcing...');\n                    let _dpCoords: any = undefined;\n                    try {\n                      let lo = Number.MAX_SAFE_INTEGER, hi = 0, pl = 0;\n                      const ur = await fetch('https://api-tn10.kaspa.org/addresses/' + encodeURIComponent(_pub.storeAddress) + '/utxos');\n                      for (const u of (await ur.json()) || []) {\n                        const dd = Number(u.utxoEntry?.blockDaaScore || u.blockDaaScore || 0);\n                        if (dd > 0) { if (dd < lo) lo = dd; if (dd > hi) hi = dd; }\n                        pl += Number(u.utxoEntry?.amount || u.amount || 0);\n                      }\n                      if (hi > 0) _dpCoords = { pledge_kas: Math.round(pl / 1e7) / 10, daa_from: Math.max(0, lo - 600), daa_to: hi + 600, ...(_dpAnchor ? { anchor_hash: _dpAnchor } : {}) };\n                    } catch (de) { console.warn('[Game] dapp daa span skipped:', de); }\n                    const _ann: any = await announceToRegistry(_owner, _pub.storeAddress, _gname, 'GameGrid', 'dapp', { configHash: _ck.hash, coords: _dpCoords });"],
], "_stAnchor");
console.log("\ndone. Stores, dapps and academics now advertise coordinates.");
