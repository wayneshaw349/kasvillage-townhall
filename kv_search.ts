// kv_search.ts - Mailbox search: every word must match (any order), ranked, 1-typo tolerant.
// Chips: "all" / "*" lists everything; "fresh", "most kept", "cheapest" change the sort.
const UNIT: Record<string, number> = { hour: 3600e3, day: 86400e3, week: 604800e3, month: 2592000e3 };

function ed1(a: string, b: string): boolean { // edit distance <= 1
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0, j = 0, diff = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++diff > 1) return false;
    if (la > lb) i++; else if (lb > la) j++; else { i++; j++; }
  }
  return diff + (la - i) + (lb - j) <= 1;
}
const words = (s: string) => String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const tagList = (t: any): string[] => Array.isArray(t) ? t.map(String) : (typeof t === 'string' ? t.split(',') : []);

function fields(item: any) {
  const q = item.quad || {};
  return {
    name: String(item.name || item.title || item.storeName || q.game || '').toLowerCase(),
    alt: String(q.game || item.brandName || '').toLowerCase(),
    tags: tagList(q.tags || item.tags).join(' ').toLowerCase(),
    cat: String(item.category || item.field || item.institution || '').toLowerCase(),
    desc: String(item.description || '').toLowerCase(),
  };
}
function tokenScore(tok: string, f: ReturnType<typeof fields>): number {
  const nw = words(f.name + ' ' + f.alt);
  if (nw.some((w) => w === tok)) return 10;
  if (nw.some((w) => w.startsWith(tok))) return 8;
  if ((f.name + ' ' + f.alt).replace(/\s+/g, '').includes(tok)) return 6; // "kascity" vs "kas city"
  const tw = words(f.tags);
  if (tw.some((w) => w === tok || w.startsWith(tok))) return 5;
  if (words(f.cat).some((w) => w.startsWith(tok))) return 4;
  if (f.desc.includes(tok)) return 2;
  if (tok.length >= 4) {
    if (nw.some((w) => ed1(tok, w))) return 4;
    if (tw.some((w) => ed1(tok, w))) return 2;
  }
  return 0;
}
const fresh = (it: any) => Math.max(Number(it.t || it.createdAt || 0), Number(it.keptAt || 0));
const kept = (it: any) => (Array.isArray(it.keepers) ? it.keepers.length : 0);
const priceOf = (it: any) => { const p = Number(it.price ?? it.minPrice ?? it.lowestPrice ?? (it.quad && it.quad.price)); return isFinite(p) && p > 0 ? p : Infinity; };

export function searchItems(data: any[], query: string, section: string): any[] {
  let q = String(query || '').toLowerCase().trim();
  if (!q) return [];
  let cutoff = 0;
  const tm = q.match(/\b(?:last\s+)?(\d+)?\s*(hour|day|week|month)s?\b/);
  if (tm) { cutoff = Date.now() - (tm[1] ? parseInt(tm[1], 10) : 1) * UNIT[tm[2]]; q = q.replace(tm[0], ' ').trim(); }
  let sort: 'score' | 'fresh' | 'kept' | 'cheap' = 'score';
  if (/\bmost kept\b|\bkept\b/.test(q)) { sort = 'kept'; q = q.replace(/\bmost kept\b|\bkept\b/g, ' '); }
  if (/\bfresh(est)?\b|\bnew(est)?\b/.test(q)) { sort = 'fresh'; q = q.replace(/\bfresh(est)?\b|\bnew(est)?\b/g, ' '); }
  if (/\bcheap(est)?\b/.test(q)) { sort = 'cheap'; q = q.replace(/\bcheap(est)?\b/g, ' '); }
  q = q.replace(/\ball\b|\*/g, ' ').trim();
  const toks = words(q).filter((t) => t.length >= 2 || /\d/.test(t));
  const out: Array<{ it: any; s: number }> = [];
  for (const it of data || []) {
    const age = it.t || it.createdAt || 0;
    if (cutoff && age && age < cutoff) continue;
    if (!toks.length) { out.push({ it, s: 0 }); continue; }
    const f = fields(it); let s = 0, ok = true;
    for (const tk of toks) { const v = tokenScore(tk, f); if (!v) { ok = false; break; } s += v; }
    if (ok) out.push({ it, s });
  }
  const tie = (a: any, b: any) => (kept(b.it) - kept(a.it)) || (fresh(b.it) - fresh(a.it));
  out.sort((a, b) => {
    if (sort === 'fresh') return fresh(b.it) - fresh(a.it);
    if (sort === 'kept') return (kept(b.it) - kept(a.it)) || (fresh(b.it) - fresh(a.it));
    if (sort === 'cheap') return (priceOf(a.it) - priceOf(b.it)) || (b.s - a.s);
    return (b.s - a.s) || (section === 'storefronts' ? priceOf(a.it) - priceOf(b.it) : 0) || tie(a, b);
  });
  return out.map((x) => x.it);
}

export const SEARCH_CHIPS: Record<string, string[]> = {
  games: ['all', 'fresh', 'most kept', 'board', 'arcade', 'puzzle', '2-player'],
  storefronts: ['all', 'fresh', 'cheapest'],
  dapps: ['all', 'fresh'],
  coupons: ['all', 'fresh'],
  academics: ['all', 'fresh'],
  services: ['all', 'fresh'],
};
