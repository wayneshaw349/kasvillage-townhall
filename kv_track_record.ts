// kv_track_record.ts — one-tap "track record" report for pitching a buyer, publisher or
// distributor. Built from the phone's counterparty-SIGNED stat chain (stat_records.ts,
// permanent, unlike the ~30h public API) + the game sales log. Every number links to
// what proves it; the full signed bundle rides along so anyone can verifyBundle() it.
import AsyncStorage from '@react-native-async-storage/async-storage';

const DAA_PER_DAY = 864000;             // 10 BPS
const SETTLED_MIN_KAS = 100;            // "established" partner: >= 100 KAS...
const SETTLED_MIN_DAYS = 30;            // ...held in coins at least 30 days old

const kas = (s: any) => Number(BigInt(String(s || '0'))) / 1e8;
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as any)[c]);
const api = (net: string) => require('./kaspa_payload').apiBase(net);
const explorer = (net: string, tx: string) => (net === 'mainnet' ? 'https://explorer.kaspa.org/txs/' : 'https://explorer-tn10.kaspa.org/txs/') + tx;

/** USD per KAS by day (CoinGecko daily), cached 12h. Empty map if unreachable. */
async function usdByDay(): Promise<Map<string, number>> {
  const ck = 'kv_kas_usd_daily_v1';
  try { const c = JSON.parse((await AsyncStorage.getItem(ck)) || 'null'); if (c && Date.now() - c.at < 43200000) return new Map(c.p); } catch {}
  const m = new Map<string, number>();
  try {
    const j: any = await (await fetch('https://api.coingecko.com/api/v3/coins/kaspa/market_chart?vs_currency=usd&days=max&interval=daily')).json();
    for (const [t, p] of (j && j.prices) || []) m.set(day(Number(t)), Number(p));
    if (m.size) await AsyncStorage.setItem(ck, JSON.stringify({ at: Date.now(), p: Array.from(m.entries()) }));
  } catch {}
  return m;
}
const priceOn = (m: Map<string, number>, ms: number) => { for (let i = 0; i < 7; i++) { const p = m.get(day(ms - i * 86400000)); if (p) return p; } return 0; };

/** A partner is "established" if their own wallet holds >= 100 KAS in coins >= 30 days old.
 *  Doesn't stop sybils, but each fake buyer now costs locked capital and time. */
async function established(cpPubkey: string, net: string, nowDaa: number): Promise<boolean> {
  try {
    const x = cpPubkey.length === 66 ? cpPubkey.slice(2) : cpPubkey;
    const addr = require('./canonical_agreement_steps').deriveAddress(x.toLowerCase(), net as any);
    const u: any[] = (await (await fetch(api(net) + '/addresses/' + encodeURIComponent(addr) + '/utxos')).json()) || [];
    let s = 0;
    for (const c of u) if (nowDaa - Number(c?.utxoEntry?.blockDaaScore || nowDaa) >= SETTLED_MIN_DAYS * DAA_PER_DAY) s += Number(c?.utxoEntry?.amount || 0);
    return s / 1e8 >= SETTLED_MIN_KAS;
  } catch { return false; }
}

export interface TrackRecord {
  network: string; deals: number; completed: number; cancelled: number; deadlocked: number;
  completionRate: number; volumeKas: number; volumeUsd: number; usdPriced: boolean;
  distinctPartners: number; repeatPartners: number; repeatRate: number;
  establishedPartners: number; establishedChecked: number;
  firstDeal: number; lastDeal: number; boardSales: number; boardBuyers: number;
}

export async function buildTrackRecord(): Promise<{ tr: TrackRecord; html: string; text: string }> {
  const net: string = require('./kv_net').KV_NET;
  const { loadChain, exportBundle } = require('./stat_records');
  const chain: any[] = ((await loadChain()) || []).filter((r: any) => (r.network || 'testnet-10') === net);
  const prices = await usdByDay();
  let nowDaa = 0;
  try { nowDaa = Number((await (await fetch(api(net) + '/info/blockdag')).json()).virtualDaaScore || 0); } catch {}

  const rows: string[] = [];
  const perCp = new Map<string, number>();
  let completed = 0, cancelled = 0, deadlocked = 0, volKas = 0, volUsd = 0, priced = 0, first = 0, last = 0;
  for (const r of chain) {
    const t = Number((r.anchor && r.anchor.blockTime) || r.ts || 0);
    const v = kas(r.buyerAmountSompi);
    if (r.outcome === 'complete') {
      completed++; volKas += v;
      const p = priceOn(prices, t); if (p) { volUsd += v * p; priced++; }
      perCp.set(r.cpPubkey, (perCp.get(r.cpPubkey) || 0) + 1);
    } else if (r.outcome === 'cancel') cancelled++; else deadlocked++;
    if (t) { first = first ? Math.min(first, t) : t; last = Math.max(last, t); }
    const tx = (r.anchor && r.anchor.releaseTxId) || r.escrowTxId;
    rows.push('<tr><td>' + (t ? day(t) : '-') + '</td><td>' + esc(r.outcome) + '</td><td>' + v.toFixed(2) + '</td><td>' + (priceOn(prices, t) ? '$' + (v * priceOn(prices, t)).toFixed(2) : '-') + '</td><td>' + esc(String(r.cpPubkey).slice(0, 12)) + '…</td><td>' + (tx ? '<a href="' + explorer(net, tx) + '">' + esc(tx.slice(0, 10)) + '…</a>' : '-') + '</td></tr>');
  }
  const cps = Array.from(perCp.keys());
  let est = 0; const checked = cps.slice(0, 15);
  if (nowDaa) for (const cp of checked) if (await established(cp, net, nowDaa)) est++;

  let boardSales = 0, boardBuyers = 0;
  try { const lg: any[] = JSON.parse((await AsyncStorage.getItem('kv_sales_log')) || '[]'); boardSales = lg.length; boardBuyers = new Set(lg.map((x: any) => x.buyer)).size; } catch {}

  const deals = chain.length;
  const tr: TrackRecord = {
    network: net, deals, completed, cancelled, deadlocked,
    completionRate: deals ? completed / deals : 0, volumeKas: volKas, volumeUsd: volUsd, usdPriced: completed > 0 && priced === completed,
    distinctPartners: cps.length, repeatPartners: cps.filter((c) => (perCp.get(c) || 0) >= 2).length,
    repeatRate: cps.length ? cps.filter((c) => (perCp.get(c) || 0) >= 2).length / cps.length : 0,
    establishedPartners: est, establishedChecked: nowDaa ? checked.length : 0,
    firstDeal: first, lastDeal: last, boardSales, boardBuyers,
  };
  const pct = (x: number) => Math.round(x * 100) + '%';
  const usd = '$' + Math.round(volUsd).toLocaleString('en-US') + (tr.usdPriced ? '' : ' (partial - some days unpriced)');
  const text = [
    'KasVillage track record (' + net + ')',
    deals + ' signed deals: ' + completed + ' completed (' + pct(tr.completionRate) + '), ' + cancelled + ' cancelled, ' + deadlocked + ' deadlocked',
    'Volume: ' + volKas.toFixed(2) + ' KAS ≈ ' + usd + ' at each deal-day price',
    tr.distinctPartners + ' distinct partners, ' + pct(tr.repeatRate) + ' came back' + (tr.establishedChecked ? ', ' + est + '/' + tr.establishedChecked + ' established (≥' + SETTLED_MIN_KAS + ' KAS held ≥' + SETTLED_MIN_DAYS + ' days)' : ''),
    boardSales ? boardSales + ' game boards delivered to ' + boardBuyers + ' distinct buyers' : '',
    first ? 'Active ' + day(first) + ' to ' + day(last) : '',
  ].filter(Boolean).join('\n');
  const bundle = await exportBundle();
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Track record</title>'
    + '<style>body{font:14px -apple-system,Segoe UI,sans-serif;margin:16px;color:#2f2418;background:#fffaf0}h1{font-size:20px}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border-bottom:1px solid #e5d9c3;padding:4px;text-align:left}.k{font-size:22px;font-weight:800}.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin:12px 0}.c{background:#f3ead9;border-radius:8px;padding:8px}pre{white-space:pre-wrap;word-break:break-all;font-size:9px;background:#f3ead9;padding:8px;border-radius:8px}</style></head><body>'
    + '<h1>KasVillage track record</h1><p>Network: ' + esc(net) + (first ? ' · active ' + day(first) + ' – ' + day(last) : '') + '</p><div class="g">'
    + '<div class="c"><div class="k">' + completed + '/' + deals + '</div>deals completed (' + pct(tr.completionRate) + ')</div>'
    + '<div class="c"><div class="k">' + esc(usd) + '</div>' + volKas.toFixed(2) + ' KAS, priced on each deal day</div>'
    + '<div class="c"><div class="k">' + tr.distinctPartners + '</div>distinct partners · ' + pct(tr.repeatRate) + ' repeat</div>'
    + (tr.establishedChecked ? '<div class="c"><div class="k">' + est + '/' + tr.establishedChecked + '</div>established partners (≥' + SETTLED_MIN_KAS + ' KAS held ≥' + SETTLED_MIN_DAYS + ' days)</div>' : '')
    + (boardSales ? '<div class="c"><div class="k">' + boardSales + '</div>game boards to ' + boardBuyers + ' distinct buyers</div>' : '')
    + '</div><h2>Deals</h2><table><tr><th>Date</th><th>Outcome</th><th>KAS</th><th>USD then</th><th>Partner</th><th>Proof tx</th></tr>' + rows.join('') + '</table>'
    + '<h2>How to verify</h2><p>Every deal below is signed by the other party (schnorr over the deal terms) and bound to its escrow address and transaction. Paste the bundle into KasVillage → Phone Proof → verify, or check each proof tx on the explorer. USD uses the CoinGecko daily KAS price on each deal date. Partner counts are honest signals, not guarantees: one person can control several wallets; "established" partners raise the cost of faking demand.</p>'
    + '<h2>Signed bundle</h2><pre>' + esc(bundle) + '</pre></body></html>';
  return { tr, html, text };
}

/** Build, save to a file and open the share sheet. */
export async function shareTrackRecord(): Promise<void> {
  const { html, text } = await buildTrackRecord();
  const { Share } = require('react-native');
  let url: string | undefined;
  try { const FS = require('expo-file-system/legacy'); url = FS.cacheDirectory + 'kasvillage_track_record.html'; await FS.writeAsStringAsync(url, html); } catch { url = undefined; }
  await Share.share(url ? { url, message: text, title: 'KasVillage track record' } : { message: text, title: 'KasVillage track record' });
}
