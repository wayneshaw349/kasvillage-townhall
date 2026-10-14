// wire_store_walk_coords.cjs — thread the announce's coords into the store
// config fetch, so a phone can walk raw blocks for a store when every index
// is cold (same resilience games have).
// 1. mailbox_kaspa_api: storefront entries carry coords from the announce record.
// 2. VillageMailbox: the modal passes them to fetchStoreConfig (4th arg).
const fs = require('fs');

// --- 1. mailbox_kaspa_api.ts ---
{
  const F = 'mailbox_kaspa_api.ts';
  let s = fs.readFileSync(F, 'utf8');
  const CRLF = s.includes('\r\n');
  if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes('coords: (e.record')) console.log(F + ': already patched');
  else {
    const A = "      primaryLink: e.primaryLink || '',\n      configHash: e.configHash || '',\n    } as any));";
    const c = s.split(A).length - 1;
    if (c !== 1) { console.error(F + ': ANCHOR count =', c, '- expected 1. Aborting.'); process.exit(1); }
    const B = "      primaryLink: e.primaryLink || '',\n      configHash: e.configHash || '',\n      coords: (e.record && e.record.d && e.record.d.coords) || null,\n    } as any));";
    s = s.replace(A, B);
    fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
    console.log(F + ': storefront entries carry announce coords');
  }
}

// --- 2. VillageMailbox.tsx ---
{
  const F = 'VillageMailbox.tsx';
  let s = fs.readFileSync(F, 'utf8');
  const CRLF = s.includes('\r\n');
  if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes("(item as any).coords")) console.log(F + ': already patched');
  else {
    const A = "            const { config, error: _cfgErr } = await fetchStoreConfig(item.arweaveTx, cfgHash, 'testnet-10');";
    const c = s.split(A).length - 1;
    if (c !== 1) { console.error(F + ': ANCHOR count =', c, '- expected 1. Aborting.'); process.exit(1); }
    const B = "            const { config, error: _cfgErr } = await fetchStoreConfig(item.arweaveTx, cfgHash, 'testnet-10', (item as any).coords || undefined);";
    s = s.replace(A, B);
    fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
    console.log(F + ': modal passes coords to fetchStoreConfig');
  }
}
console.log('DONE - reload Metro (r); store config now walk-capable within the publish window.');
