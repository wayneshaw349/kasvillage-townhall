// wire_dkim_announce.cjs — DKIM re-point + TownHall dapp-registry fix.
// The on-device DKIM verify (Workspace submit tab) succeeds and saves the
// researcher id, but nothing reaches the announce - so the Academics lane
// (which filters on d.dkim / d.dkimDomain) never lights up. Now:
//  1. kaspa_payload.makeRegistryAnnounce: extra carries dkim/dkimDomain into d.
//  2. payload_publish.announceToRegistry: extra type widened to match.
//  3. Workspace DKIM success: persists the verified school domain (kv_dkim_domain).
//  4. Workspace announce sites (publish + re-announce): Academic-category
//     stores stamp dkim:true + dkimDomain from the saved verification.
//  5. TownHallScreen:1119: dapp announce was landing on the STORE registry
//     ('dapp' was the category arg; kind defaulted to 'store'). Now kind='dapp'.
// All anchors verified before any file is written.
const fs = require('fs');

const edits = [
  {
    f: 'kaspa_payload.ts',
    pairs: [
      [
        "export function makeRegistryAnnounce(ownerPubkey: string, storeAddress: string, name: string, category: string, extra?: { primaryLink?: string; configHash?: string; coords?: any }): KvRecord {",
        "export function makeRegistryAnnounce(ownerPubkey: string, storeAddress: string, name: string, category: string, extra?: { primaryLink?: string; configHash?: string; coords?: any; dkim?: boolean; dkimDomain?: string }): KvRecord {"
      ],
      [
        "  if (extra?.coords) d.coords = extra.coords;\n  return { k: 'registry', v: 1, o: ownerPubkey, t: Date.now(), d };",
        "  if (extra?.coords) d.coords = extra.coords;\n  // KV_DKIM_ANNOUNCE: on-device DKIM verification result rides the announce;\n  // the Academics lane filters on exactly these fields.\n  if (extra?.dkim) d.dkim = true;\n  if (extra?.dkimDomain) d.dkimDomain = extra.dkimDomain;\n  return { k: 'registry', v: 1, o: ownerPubkey, t: Date.now(), d };"
      ],
    ],
  },
  {
    f: 'payload_publish.ts',
    pairs: [
      [
        "  extra?: { primaryLink?: string; configHash?: string; coords?: any },",
        "  extra?: { primaryLink?: string; configHash?: string; coords?: any; dkim?: boolean; dkimDomain?: string }, // KV_DKIM_ANNOUNCE"
      ],
    ],
  },
  {
    f: 'Workspace.tsx',
    pairs: [
      // 3. persist verified domain at the on-device DKIM success point
      [
        "                        await SecureStore.setItemAsync('kv_researcher_domain_hash', domainHash);",
        "                        await SecureStore.setItemAsync('kv_researcher_domain_hash', domainHash);\n                        await SecureStore.setItemAsync('kv_dkim_domain', domain); // KV_DKIM_ANNOUNCE: next Academic-category announce carries this"
      ],
      // 4a. publish-flow announce stamps dkim for Academic stores
      [
        "          const _ann: any = await announceToRegistry(_owner, _pub.storeAddress, brandName, storeCategory, 'store', { primaryLink, configHash: _annHash, coords: _stCoords });",
        "          const _dk = storeCategory === 'Academic' ? await SecureStore.getItemAsync('kv_dkim_domain') : null; // KV_DKIM_ANNOUNCE\n          const _ann: any = await announceToRegistry(_owner, _pub.storeAddress, brandName, storeCategory, 'store', { primaryLink, configHash: _annHash, coords: _stCoords, ...(_dk ? { dkim: true, dkimDomain: _dk } : {}) } as any);"
      ],
      // 4b. re-announce flow, same stamp
      [
        "      const ann: any = await announceToRegistry(_owner2 as any, st.storeAddress, st.name, st.category, 'store', { primaryLink: st.primaryLink, configHash: st.cfgHash, coords });",
        "      const _dk2 = st.category === 'Academic' ? await SecureStore.getItemAsync('kv_dkim_domain') : null; // KV_DKIM_ANNOUNCE\n      const ann: any = await announceToRegistry(_owner2 as any, st.storeAddress, st.name, st.category, 'store', { primaryLink: st.primaryLink, configHash: st.cfgHash, coords, ...(_dk2 ? { dkim: true, dkimDomain: _dk2 } : {}) } as any);"
      ],
    ],
  },
  {
    f: 'TownHallScreen.tsx',
    pairs: [
      [
        "try { await announceToRegistry(_owner, _pub.storeAddress, sendName, 'dapp'); } catch {}",
        "try { await announceToRegistry(_owner, _pub.storeAddress, sendName, 'GameGrid', 'dapp'); } catch {} // KV_DKIM_ANNOUNCE: kind arg was missing - announce landed on the store registry"
      ],
    ],
  },
];

// Pass 1: read + normalize + verify every anchor. Abort before any write.
const staged = [];
let ok = true;
for (const e of edits) {
  let s = fs.readFileSync(e.f, 'utf8');
  const CRLF = s.includes('\r\n');
  if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes('KV_DKIM_ANNOUNCE')) { console.log(e.f + ': already patched - skipping'); continue; }
  for (let i = 0; i < e.pairs.length; i++) {
    const c = s.split(e.pairs[i][0]).length - 1;
    if (c !== 1) { console.error(e.f + ' ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1.'); ok = false; }
  }
  staged.push({ ...e, s, CRLF });
}
if (!ok) { console.error('Aborting - no files written.'); process.exit(1); }

// Pass 2: apply + write.
for (const e of staged) {
  let s = e.s;
  for (const [a, b] of e.pairs) s = s.replace(a, b);
  fs.writeFileSync(e.f, e.CRLF ? s.replace(/\n/g, '\r\n') : s);
  console.log(e.f + ': patched (' + e.pairs.length + ' edit' + (e.pairs.length > 1 ? 's' : '') + ')');
}
console.log('DONE - DKIM rides Academic announces; dapp announces land on the dapp registry.');
