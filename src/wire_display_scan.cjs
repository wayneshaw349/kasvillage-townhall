// wire_display_scan.cjs — the display-side scan content_filter.ts's header
// calls "the one that matters", finally wired:
// 1. kaspa_payload.rebuildDirectory: every directory entry's announce text
//    (name/category/primaryLink) passes scanObject before it can render —
//    covers stores, services, academics, coupons, dapps in one place.
// 2. VillageMailbox store modal: the fetched config chunks (brand, description,
//    products, coupon copy) pass scanObject before setStoreView renders them.
// Blocked content renders as "no config" / absent listing; reason is logged.
const fs = require('fs');

// --- 1. kaspa_payload.ts: scan announce fields in rebuildDirectory ---
{
  const F = 'kaspa_payload.ts';
  let s = fs.readFileSync(F, 'utf8');
  const CRLF = s.includes('\r\n');
  if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes('KV_DISPLAY_SCAN')) console.log(F + ': already patched');
  else {
    const A = "    const _dl = delistByTarget.get(String(record.d.storeAddress));\n    if (_dl && (_dl.o === owner || _dl.o === KV_MOD_PUBKEY) && (_dl.t || 0) > (record.t || 0)) continue;";
    const c = s.split(A).length - 1;
    if (c !== 1) { console.error(F + ': ANCHOR count =', c, '- expected 1. Aborting.'); process.exit(1); }
    const B = A + "\n    // KV_DISPLAY_SCAN: reader-side text scan - announce fields never render unscanned\n    try { const { scanObject } = require('./content_filter'); const _sc = scanObject({ n: record.d.name, c: record.d.category, l: record.d.primaryLink }); if (!_sc.ok) { console.warn('[Directory] entry BLOCKED:', _sc.reason, String(record.d.name || '').slice(0, 24)); continue; } } catch {}";
    s = s.replace(A, B);
    fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
    console.log(F + ': directory entries scanned before render');
  }
}

// --- 2. VillageMailbox.tsx: scan fetched store config before rendering ---
{
  const F = 'VillageMailbox.tsx';
  let s = fs.readFileSync(F, 'utf8');
  const CRLF = s.includes('\r\n');
  if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes('KV_CFG_SCAN')) console.log(F + ': already patched');
  else {
    const A = "            const { config, error: _cfgErr } = await fetchStoreConfig(item.arweaveTx, cfgHash, 'testnet-10', (item as any).coords || undefined);";
    const c = s.split(A).length - 1;
    if (c !== 1) { console.error(F + ': ANCHOR count =', c, '- expected 1. Aborting.'); process.exit(1); }
    const B = A + "\n            // KV_CFG_SCAN: config chunks (products, coupons, description) never render unscanned\n            try { if (config) { const { scanObject } = require('./content_filter'); const _sc = scanObject(config); if (!_sc.ok) { console.warn('[Mailbox] store config BLOCKED:', _sc.reason, 'at', _sc.path); setStoreView(sv => sv && sv.entry.id === item.id ? { ...sv, config: null, loading: false } : sv); return; } } } catch {}";
    s = s.replace(A, B);
    fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
    console.log(F + ': store configs scanned before render');
  }
}
console.log('DONE - display-side scan live. Reload Metro (r).');
