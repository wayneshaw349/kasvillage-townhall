// wire_games_delist_filter.cjs — the Mailbox games lane honors delist records.
// Collects {k:'delist'} records from the same rails (cache/relay/scan feed the
// same parse), and drops any announce whose head has a delist from the SAME
// signer (publisher-key-only; if either side lacks a signer, the delist wins).
// Installed games are untouched: hide-from-store only.
const fs = require('fs');
const F = 'VillageMailbox.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_DELIST_FILTER')) { console.log('already patched'); process.exit(0); }

// --- 1. parseAnn: recognize delist records (unique via the 'game' category line) ---
const A1 = `            if (!r || r.k !== 'registry' || !r.d) return null;
            let quad: any = null; try { quad = r.d.primaryLink ? JSON.parse(r.d.primaryLink) : null; } catch {}
            if (!quad || !quad.head || !quad.manifestAddress || !quad.manifestHash) return null;
            if (String(r.d.category || '').toLowerCase() !== 'game') return null;`;
const c1 = s.split(A1).length - 1;
if (c1 !== 1) { console.error('ANCHOR 1 count =', c1, '- expected 1. Aborting.'); process.exit(1); }
const B1 = `            if (r && r.k === 'delist' && r.d && r.d.head) return { delist: true, head: String(r.d.head), t: r.t || 0, o: r.o || '' }; // KV_DELIST_FILTER
            if (!r || r.k !== 'registry' || !r.d) return null;
            let quad: any = null; try { quad = r.d.primaryLink ? JSON.parse(r.d.primaryLink) : null; } catch {}
            if (!quad || !quad.head || !quad.manifestAddress || !quad.manifestHash) return null;
            if (String(r.d.category || '').toLowerCase() !== 'game') return null;`;

// --- 2. take(): route delists into their own map ---
const A2 = `          const byHead = new Map<string, any>();
          const take = (it: any) => { if (!it) return; const prev = byHead.get(it.quad.head); if (!prev || it.t > prev.t) byHead.set(it.quad.head, it); };`;
const c2 = s.split(A2).length - 1;
if (c2 !== 1) { console.error('ANCHOR 2 count =', c2, '- expected 1. Aborting.'); process.exit(1); }
const B2 = `          const byHead = new Map<string, any>();
          const delistByHead = new Map<string, any>();
          const take = (it: any) => {
            if (!it) return;
            if (it.delist) { const p = delistByHead.get(it.head); if (!p || it.t > p.t) delistByHead.set(it.head, it); return; }
            const prev = byHead.get(it.quad.head); if (!prev || it.t > prev.t) byHead.set(it.quad.head, it);
          };`;

// --- 3. final items: filter delisted (signer-matched) ---
const A3 = `          const items = Array.from(byHead.values()).sort((a, b) => b.t - a.t);`;
const c3 = s.split(A3).length - 1;
if (c3 !== 1) { console.error('ANCHOR 3 count =', c3, '- expected 1. Aborting.'); process.exit(1); }
const B3 = `          const items = Array.from(byHead.values()).filter((it: any) => {
            const d = delistByHead.get(it.quad.head);
            if (!d) return true;
            return !!(d.o && it.o && d.o !== it.o); // same signer (or unknown signer) -> hidden
          }).sort((a, b) => b.t - a.t);`;

s = s.replace(A1, B1).replace(A2, B2).replace(A3, B3);
if (CRLF) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync(F, s);
console.log('patched: games lane collects delists and hides matching announces');
