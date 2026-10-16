// wire_deal_rank.cjs — "best deal floats up, no buttons".
//  mailbox_kaspa_api.ts:
//   - kvEffMinKas(config): cheapest stash item (item.kaspaPrice) after the
//     best LIVE coupon (percent or flat KAS) - the effective price.
//   - kvDealRank(dir, items): fetches configs for the top listings (bounded,
//     they cache), computes per-CATEGORY mean/stddev of effective prices,
//     scores each listing pledge 0.30 + freshness 0.45 + deal 0.25 where
//     deal = clamp(0.5 + z/4, 0, 1), z = (mean - myPrice)/sd, sd floored at
//     10% of mean. Capped at ~2 sigma: pricing fake-low earns NOTHING extra.
//     Categories with <3 priced listings stay neutral. Wired into
//     storefronts + services.
//   - Coupons lane: sorted by discountedKaspa ascending - biggest real cut
//     first.
const fs = require('fs');
const F = 'mailbox_kaspa_api.ts';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_DEAL_RANK')) { console.log('already patched'); process.exit(0); }

const edits = [
  // 1. helpers after visSort
  [
`  return score(b) - score(a);
}`,
`  return score(b) - score(a);
}

// KV_DEAL_RANK: effective price = cheapest stash item after the best live coupon.
async function kvEffMinKas(storeAddress: string, cfgHash: string, coords: any): Promise<number> {
  try {
    if (!cfgHash) return 0;
    const { config } = await fetchStoreConfig(storeAddress, cfgHash, NET, coords || undefined);
    if (!config) return 0;
    const prices = (config.stash || []).map((i: any) => Number(i.kaspaPrice || 0)).filter((p: number) => p > 0);
    if (!prices.length) return 0;
    let eff = Math.min(...prices);
    const now = Date.now();
    for (const c of (config.coupons || [])) {
      if ((c.createdAt || 0) + (c.expiryDays || 30) * 86400000 < now) continue;
      if ((c.usedCount || 0) >= (c.maxUses || 1)) continue;
      const e2 = c.discountPercent > 0 ? eff * (1 - c.discountPercent / 100) : (c.discountKas > 0 ? eff - c.discountKas : eff);
      if (e2 < eff && e2 > 0) eff = e2;
    }
    return eff;
  } catch { return 0; }
}
// KV_DEAL_RANK: re-rank in place - pledge 0.30 + freshness 0.45 + deal 0.25.
// deal is a capped z-score against the CATEGORY's mean effective price, so a
// fake rock-bottom price scores no better than an honestly cheap one.
async function kvDealRank(dir: any[], items: any[], maxCfg: number = 12): Promise<void> {
  try {
    const n = Math.min(items.length, maxCfg);
    const eff: number[] = new Array(items.length).fill(0);
    for (let i = 0; i < n; i++) {
      const e: any = dir[i];
      eff[i] = await kvEffMinKas(e.storeAddress, e.configHash || (e.record && e.record.d && e.record.d.configHash) || '', e.record && e.record.d && e.record.d.coords);
      (items[i] as any).dealKas = eff[i];
    }
    const byCat: any = {};
    for (let i = 0; i < items.length; i++) { if (eff[i] > 0) { const k = String((dir[i] as any).category || '').toLowerCase(); (byCat[k] = byCat[k] || []).push(eff[i]); } }
    const stats: any = {};
    for (const k in byCat) { const a = byCat[k]; const m = a.reduce((x: number, y: number) => x + y, 0) / a.length; const sd = Math.sqrt(a.reduce((x: number, y: number) => x + (y - m) * (y - m), 0) / a.length); stats[k] = { m, sd: Math.max(sd, m * 0.1), n: a.length }; }
    const score = (i: number) => {
      const e: any = dir[i];
      const pledge = Math.min(Number(e.pledgeSompi) / 1e8 / 2500, 1) * 0.30;
      const ageH = Math.max(0, (Date.now() / 1000 - e.announcedAt) / 3600);
      const fresh = Math.pow(0.5, ageH / 168) * 0.45;
      const st = stats[String(e.category || '').toLowerCase()];
      let deal = 0.125; // neutral
      if (eff[i] > 0 && st && st.n >= 3) { const z = (st.m - eff[i]) / st.sd; deal = Math.max(0, Math.min(1, 0.5 + z / 4)) * 0.25; }
      return pledge + fresh + deal;
    };
    const idx = items.map((_: any, i: number) => i).sort((a: number, b: number) => score(b) - score(a));
    const si = idx.map((i: number) => items[i]); const sd2 = idx.map((i: number) => dir[i]);
    items.length = 0; (items as any).push(...si);
    dir.length = 0; (dir as any).push(...sd2);
    console.log('[DealRank]', n, 'priced of', items.length, Object.keys(stats).map((k) => k + ' n=' + stats[k].n + ' mu=' + stats[k].m.toFixed(1)).join(' | '));
  } catch (e) { console.log('[DealRank] skipped:', e); }
}`,
  ],
  // 2. storefronts: rank before return
  [
`      record: e.record, repostedBy: e.repostedBy || '', keepers: e.keepers || [], // KV_REPOST_ITEM
    } as any));
    return { items, hasMore: false, fromCache: false };`,
`      record: e.record, repostedBy: e.repostedBy || '', keepers: e.keepers || [], // KV_REPOST_ITEM
    } as any));
    await kvDealRank(dir as any[], items as any[]);
    return { items, hasMore: false, fromCache: false };`,
  ],
  // 3. services: rank before return
  [
`        record: e.record, repostedBy: e.repostedBy || '', keepers: e.keepers || [], // KV_REPOST_ITEM svc
      } as any));
    return { items, hasMore: false, fromCache: false };`,
`        record: e.record, repostedBy: e.repostedBy || '', keepers: e.keepers || [], // KV_REPOST_ITEM svc
      } as any));
    await kvDealRank(dir as any[], items as any[]);
    return { items, hasMore: false, fromCache: false };`,
  ],
  // 4. coupons: carry discountedKaspa + sort cheapest effective price first
  [
`          category: e.category,
          townhall: { verified: true, verifiedAt: e.announcedAt },
        });
      }
    }
    return { items, hasMore: false, fromCache: false };`,
`          category: e.category,
          townhall: { verified: true, verifiedAt: e.announcedAt },
          discountedKaspa: Number(c.discountedKaspa || 0),
        } as any);
      }
    }
    items.sort((a: any, b: any) => ((a.discountedKaspa > 0 ? a.discountedKaspa : 9e9) - (b.discountedKaspa > 0 ? b.discountedKaspa : 9e9))); // KV_DEAL_RANK: biggest real cut first
    return { items, hasMore: false, fromCache: false };`,
  ],
];

let ok = true;
for (let i = 0; i < edits.length; i++) {
  const c = s.split(edits[i][0]).length - 1;
  if (c !== 1) { console.error('ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1.'); ok = false; }
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const [a, b] of edits) s = s.split(a).join(b);
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: deal ranking live - storefronts/services by capped z-score, coupons by effective price');
