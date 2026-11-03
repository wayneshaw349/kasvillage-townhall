// KV_COMPARE: "Compare prices" next to a store item. Opens Google Shopping for the item name,
// sorted lowest price first, in the phone's OWN browser (never inside KasVillage). No key, no relay,
// nothing sent to any server of ours. Google picks and rates the stores, not KasVillage.
//
// KV_COMPARE_PP: when the person comes back to the app, it asks (optional) for the best price they
// found, in THEIR currency (KV_FX: phone's region by default, changeable). That pair - village Kaspa
// price vs best outside price for the SAME item, same currency - is a first-hand measurement of Kaspa
// purchasing power. National = checks in your currency; global = all checks (a ratio, so currencies mix).
// Kept only on this phone (AsyncStorage 'kv_price_compares'); the Stats panel averages it.
import React, { useEffect, useState } from 'react';
import { Alert, AppState, Linking, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CURRENCIES, Ccy, ccyOf, getCcy, setCcy, kasPriceIn, parseMoney, fmtMoney } from './kv_fx';

export const COMPARE_KEY = 'kv_price_compares';
// ccy/pxPerKas/kLocal/dLocal are new (KV_FX). Old rows have only the usd fields and count as USD.
export interface PriceCompare {
  name: string; kas: number; usdPerKas: number; kUsd: number; dUsd: number; d: number; ts: number;
  ccy?: string; pxPerKas?: number; kLocal?: number; dLocal?: number; cat?: string;
}
export const compareCcy = (c: PriceCompare): string => (c.ccy ? String(c.ccy) : 'USD');

type Ask = { name: string; kas: number };
const _listeners = new Set<(a: Ask) => void>(); // AUDIT 2026-11-01: one per mounted host, not a single global

export function kvComparePrices(itemName: string, kaspaPrice?: number): void {
  const q = Array.from(String(itemName || '').replace(/[\u0000-\u001f]/g, ' ').trim()).slice(0, 100).join('').trim(); // AUDIT 2026-11-01: code points, never split a surrogate pair
  if (!q) return;
  const _k = Number(kaspaPrice || 0); const kas = isFinite(_k) && _k > 0 ? _k : 0; // AUDIT 2026-11-01
  (async () => {
    const c = await getCcy();
    let shop = '', web = '';
    try {
      const e = encodeURIComponent(q); // AUDIT 2026-11-01: lone surrogate throws URIError
      shop = 'https://www.google.com/search?tbm=shop&tbs=p_ord:p&gl=' + c.gl + '&q=' + e;
      web = 'https://www.google.com/search?gl=' + c.gl + '&q=' + e + '+' + encodeURIComponent('price');
    } catch { return; }
    const open = (url: string) => Linking.openURL(url).then(() => {
      if (!(kas > 0)) return;
      let left = false; // ask once, when the person comes back to the app
      const sub = AppState.addEventListener('change', (st) => {
        if (st !== 'active') { left = true; return; }
        if (!left) return;
        sub.remove();
        _listeners.forEach((fn) => fn({ name: q, kas }));
      });
      setTimeout(() => { try { sub.remove(); } catch {} }, 30 * 60 * 1000);
    }).catch(() => Alert.alert('Could not open', 'No browser accepted this link.'));
    Alert.alert('Compare prices',
      `Search for "${q}" in ${c.name} prices (${c.code}), lowest first?\n\nOpens in your phone's browser. Google chooses and rates the stores - check store ratings, and paste any unfamiliar store into TownHall > Check a link first.\n\nGoogle Shopping is not offered in every country; use "Google search" if it shows nothing.`,
      [{ text: 'Cancel', style: 'cancel' },
       { text: 'Google search', onPress: () => open(web) },
       { text: 'Google Shopping', onPress: () => open(shop) }]);
  })();
}

/** Kept for older callers: parse a typed price (any common format). */
export function kvParseUsd(text: string): number { return parseMoney(text, 2); }

export async function loadCompares(): Promise<PriceCompare[]> {
  try { const r = await AsyncStorage.getItem(COMPARE_KEY); const a = r ? JSON.parse(r) : []; return Array.isArray(a) ? a : []; } catch { return []; }
}

async function saveCompare(c: PriceCompare): Promise<void> {
  // latest per item AND currency (the same item checked in two countries is two data points)
  const all = (await loadCompares()).filter((x) => !(x.name.toLowerCase() === c.name.toLowerCase() && compareCcy(x) === compareCcy(c)));
  all.unshift(c);
  try { await AsyncStorage.setItem(COMPARE_KEY, JSON.stringify(all.slice(0, 200))); } catch {}
}

/** Purchasing power from your checks: national (your currency) and global (all currencies). Last 90 days. */
export function comparePP(all: PriceCompare[], ccy: string) {
  const fresh = all.filter((c) => Number(c.ts || 0) > Date.now() - 90 * 86400000 && Number.isFinite(Number(c.d)));
  const avg = (xs: PriceCompare[]) => (xs.length ? xs.reduce((p, c) => p + Number(c.d), 0) / xs.length : 0);
  const nat = fresh.filter((c) => compareCcy(c) === ccy);
  const byCcy: Record<string, PriceCompare[]> = {};
  fresh.forEach((c) => { (byCcy[compareCcy(c)] = byCcy[compareCcy(c)] || []).push(c); });
  // global = average of each currency's average, so one busy country does not drown the rest
  const codes = Object.keys(byCcy);
  const global = codes.length ? codes.reduce((p, k) => p + avg(byCcy[k]), 0) / codes.length : 0;
  return {
    national: { ccy, n: nat.length, avg: avg(nat), top: nat.slice(0, 3) },
    global: { n: fresh.length, countries: codes.length, avg: global },
    // KV_PP_CROSS: your own checks of the SAME listing in 2+ currencies (Big-Mac style, USD terms)
    cross: (() => { try { const PP = require('./kv_pp_index'); return PP.crossLevels(fresh.filter((c) => Number(c.dUsd) > 0).map((c) => ({ ccy: compareCcy(c), ik: PP.ppItemKey(c.name, c.kas), usd: Number(c.dUsd) }))); } catch { return { cross: [], crossItems: 0 }; } })(),
    perCcy: codes.map((k) => ({ ccy: k, n: byCcy[k].length, avg: avg(byCcy[k]) })).sort((a, b) => b.n - a.n),
  };
}

/** Mount once per screen that shows Compare buttons. Overlay (not a Modal) so it works inside modals. */
export function KvCompareHost() {
  const [ask, setAsk] = useState<Ask | null>(null);
  const [val, setVal] = useState('');
  const [ccy, setC] = useState<Ccy>(ccyOf('USD'));
  const [px, setPx] = useState(0);
  const [pick, setPick] = useState(false);
  const [cat, setCat] = useState('other'); // KV_PP_INDEX: broad category, shared with the village index
  useEffect(() => { const fn = (a: Ask) => { setVal(''); setPick(false); setCat('other'); setAsk(a); }; _listeners.add(fn); return () => { _listeners.delete(fn); }; }, []);
  useEffect(() => { if (!ask) return; (async () => { const c = await getCcy(); setC(c); setPx(0); setPx(await kasPriceIn(c.code)); })(); }, [ask]);
  if (!ask) return null;
  const kLocal = ask.kas * px;
  const D = parseMoney(val, ccy.dec);
  const valid = isFinite(D) && isFinite(kLocal) && D > 0 && kLocal > 0;
  const d = valid ? (D - kLocal) / D : 0;
  const choose = async (c: Ccy) => { setPick(false); setC(c); await setCcy(c.code); setPx(0); setPx(await kasPriceIn(c.code)); };
  const save = async () => {
    if (!valid) return;
    let usd = 0; try { usd = await kasPriceIn('USD'); } catch {}
    const rate = usd > 0 && px > 0 ? usd / px : 0; // local -> USD, from the two KAS prices (display only)
    const dc = Math.max(-0.9, Math.min(0.9, d));
    await saveCompare({ name: ask.name, kas: ask.kas, usdPerKas: usd, kUsd: ask.kas * usd, dUsd: rate ? D * rate : 0,
      d: dc, ts: Date.now(), ccy: ccy.code, pxPerKas: px, kLocal, dLocal: D, cat });
    setAsk(null);
    // KV_PP_INDEX: opt-in share - the record carries only currency + % + category
    try {
      const PP = require('./kv_pp_index');
      const pref = await PP.ppSharePref();
      const fire = () => PP.ppShare(ccy.code, dc, cat, PP.ppItemKey(ask.name, ask.kas), rate ? D * rate : 0).then((r: any) => { if (r?.error) console.warn('[PP] share failed:', r.error); else console.log('[PP] shared', r.txId); }).catch(() => {});
      if (pref === 'always') { fire(); Alert.alert('Saved', 'Added to your Stats and shared with the village index (' + ccy.code + ', ' + cat + ').'); return; }
      if (pref === 'ask') {
        Alert.alert('Share with the village index?',
          'Helps everyone see Kaspa\'s real purchasing power. Shares ONLY: currency (' + ccy.code + '), the % difference, the category (' + cat + '), the best outside price in USD, and a hashed code of this village listing (so the same item can be compared between countries) - never the item name, store or your balance. Costs ~0.2 KAS. Counts if you have a 10+ KAS pledge or a settled trade.',
          [{ text: 'Never', onPress: () => PP.ppSetSharePref('never') },
           { text: 'Not now', style: 'cancel' },
           { text: 'Always share', onPress: () => { PP.ppSetSharePref('always'); fire(); } }]);
        return;
      }
    } catch {}
    Alert.alert('Saved', 'Added to Kaspa purchasing power in Stats (' + ccy.code + ' and global).');
  };
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 20, zIndex: 9999, elevation: 50 }}>
      <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, maxHeight: '85%' }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: '#1c1917' }}>Best price you found?</Text>
        <Text style={{ fontSize: 12, color: '#57534e', marginTop: 4 }} numberOfLines={2}>{ask.name}</Text>
        <TouchableOpacity onPress={() => setPick(!pick)} style={{ marginTop: 8, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#d6d3d1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
          <Text style={{ fontSize: 12, color: '#1c1917', fontWeight: '700' }}>{ccy.sym} {ccy.code} · {ccy.name} ▾</Text>
        </TouchableOpacity>
        {pick ? (
          <ScrollView style={{ maxHeight: 220, marginTop: 6, borderWidth: 1, borderColor: '#e7e5e4', borderRadius: 8 }}>
            {CURRENCIES.map((c) => (
              <TouchableOpacity key={c.code} onPress={() => choose(c)} style={{ paddingHorizontal: 10, paddingVertical: 8, backgroundColor: c.code === ccy.code ? '#f5f5f4' : '#fff' }}>
                <Text style={{ fontSize: 12, color: '#1c1917' }}>{c.sym} {c.code} · {c.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}
        <Text style={{ fontSize: 12, color: '#57534e', marginTop: 6 }}>
          Village: {ask.kas} KAS{px ? ' ≈ ' + fmtMoney(kLocal, ccy) : ' (KAS price in ' + ccy.code + ' loading…)'}
        </Text>
        <TextInput value={val} onChangeText={setVal} placeholder={'Lowest price in ' + ccy.code + ', e.g. ' + (ccy.dec === 0 ? '12000' : '49.99')} placeholderTextColor="#9ca3af"
          keyboardType="decimal-pad" autoFocus
          style={{ borderWidth: 1, borderColor: '#d6d3d1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginTop: 10, fontSize: 14, color: '#1c1917' }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          {require('./kv_pp_index').PP_CATS.map((c: string) => (
            <TouchableOpacity key={c} onPress={() => setCat(c)} style={{ borderWidth: 1, borderColor: cat === c ? '#059669' : '#d6d3d1', backgroundColor: cat === c ? '#ecfdf5' : '#fff', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6 }}>
              <Text style={{ fontSize: 11, color: cat === c ? '#059669' : '#57534e', fontWeight: cat === c ? '800' : '500' }}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {valid ? (
          <Text style={{ fontSize: 12, marginTop: 8, fontWeight: '700', color: d >= 0 ? '#059669' : '#dc2626' }}>
            {(d >= 0 ? `Kaspa price is ${Math.round(d * 100)}% cheaper` : `Kaspa price is ${Math.round(-d * 100)}% more expensive`) + ' than ' + fmtMoney(D, ccy)} · PP ×{(1 / (1 - Math.max(-0.9, Math.min(0.9, d)))).toFixed(2)}
          </Text>
        ) : null}
        <Text style={{ fontSize: 10, color: '#78716c', marginTop: 6 }}>Kept only on this phone. Counts toward your {ccy.code} (national) and global purchasing power in Stats.</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
          <TouchableOpacity onPress={() => setAsk(null)} style={{ paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ color: '#57534e', fontWeight: '700' }}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={save} disabled={!valid} style={{ backgroundColor: valid ? '#059669' : '#a8a29e', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
