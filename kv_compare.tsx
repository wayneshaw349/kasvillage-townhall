// KV_COMPARE: "Compare prices" next to a store item. Opens Google Shopping for the item name,
// sorted lowest price first, in the phone's OWN browser (never inside KasVillage). No key, no relay,
// nothing sent to any server of ours. Google picks and rates the stores, not KasVillage.
//
// KV_COMPARE_PP: when the person comes back to the app, it asks (optional) for the best dollar price
// they found. That pair - village Kaspa price vs best outside dollar price for the SAME item - is a
// real, first-hand measurement of Kaspa purchasing power. Kept only on this phone
// (AsyncStorage 'kv_price_compares'); the Stats panel averages it.
import React, { useEffect, useState } from 'react';
import { Alert, AppState, Linking, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const COMPARE_KEY = 'kv_price_compares';
export interface PriceCompare { name: string; kas: number; usdPerKas: number; kUsd: number; dUsd: number; d: number; ts: number; }

type Ask = { name: string; kas: number };
let _listener: ((a: Ask) => void) | null = null;

export function kvComparePrices(itemName: string, kaspaPrice?: number): void {
  const q = Array.from(String(itemName || '').replace(/[\u0000-\u001f]/g, ' ').trim()).slice(0, 100).join('').trim(); // AUDIT 2026-11-01: code points, never split a surrogate pair
  if (!q) return;
  const _k = Number(kaspaPrice || 0); const kas = isFinite(_k) && _k > 0 ? _k : 0; // AUDIT 2026-11-01
  let url = '';
  try { url = 'https://www.google.com/search?tbm=shop&tbs=p_ord:p&q=' + encodeURIComponent(q); } catch { return; } // AUDIT 2026-11-01: lone surrogate throws URIError
  Alert.alert('Compare prices',
    `Search Google Shopping for "${q}", lowest price first?\n\nOpens in your phone's browser. Google chooses and rates the stores - check store ratings, and paste any unfamiliar store into TownHall > Check a link first.`,
    [{ text: 'Cancel', style: 'cancel' },
     { text: 'Open', onPress: () => {
        Linking.openURL(url).then(() => {
          if (!(kas > 0)) return;
          // ask once, when the person comes back to the app
          let left = false;
          const sub = AppState.addEventListener('change', (st) => {
            if (st !== 'active') { left = true; return; }
            if (!left) return;
            sub.remove();
            if (_listener) _listener({ name: q, kas });
          });
          setTimeout(() => { try { sub.remove(); } catch {} }, 30 * 60 * 1000);
        }).catch(() => Alert.alert('Could not open', 'No browser accepted this link.'));
     } }]);
}

// AUDIT 2026-11-01: "$1,299.50" / "1299" / "49,99" (one comma, no dot = decimal comma). Non-finite -> NaN.
export function kvParseUsd(text: string): number {
  let t = String(text || '').replace(/[$\s]/g, '');
  if (t.indexOf('.') < 0 && (t.match(/,/g) || []).length === 1) t = t.replace(',', '.');
  else t = t.replace(/,/g, '');
  if (!/^\d*\.?\d*$/.test(t) || t === '' || t === '.') return NaN;
  const n = parseFloat(t);
  return isFinite(n) ? n : NaN;
}

export async function loadCompares(): Promise<PriceCompare[]> {
  try { const r = await AsyncStorage.getItem(COMPARE_KEY); const a = r ? JSON.parse(r) : []; return Array.isArray(a) ? a : []; } catch { return []; }
}

async function saveCompare(c: PriceCompare): Promise<void> {
  const all = (await loadCompares()).filter((x) => x.name.toLowerCase() !== c.name.toLowerCase()); // latest per item
  all.unshift(c);
  try { await AsyncStorage.setItem(COMPARE_KEY, JSON.stringify(all.slice(0, 200))); } catch {}
}

/** Mount once per screen that shows Compare buttons. Overlay (not a Modal) so it works inside modals. */
export function KvCompareHost() {
  const [ask, setAsk] = useState<Ask | null>(null);
  const [usd, setUsd] = useState('');
  useEffect(() => { _listener = (a) => { setUsd(''); setAsk(a); }; return () => { _listener = null; }; }, []);
  if (!ask) return null;
  let usdPerKas = 0;
  try { const p: any = require('./kas_price_feed').getKasPrice(); usdPerKas = (p && !p.isStale) ? Number(p.usdPerKas || 0) : 0; if (!isFinite(usdPerKas)) usdPerKas = 0; } catch {} // AUDIT 2026-11-01: refuse a stale price
  const kUsd = ask.kas * usdPerKas;
  const D = kvParseUsd(usd); // AUDIT 2026-11-01
  const valid = isFinite(D) && isFinite(kUsd) && D > 0 && kUsd > 0;
  const d = valid ? (D - kUsd) / D : 0;
  const save = async () => {
    if (!valid) return;
    await saveCompare({ name: ask.name, kas: ask.kas, usdPerKas, kUsd, dUsd: D, d: Math.max(-0.9, Math.min(0.9, d)), ts: Date.now() });
    setAsk(null);
    Alert.alert('Saved', 'Added to Kaspa purchasing power in Stats.');
  };
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 20, zIndex: 9999, elevation: 50 }}>
      <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: '#1c1917' }}>Best price you found?</Text>
        <Text style={{ fontSize: 12, color: '#57534e', marginTop: 4 }} numberOfLines={2}>{ask.name}</Text>
        <Text style={{ fontSize: 12, color: '#57534e', marginTop: 6 }}>
          Village: {ask.kas} KAS{usdPerKas ? ` ≈ $${kUsd.toFixed(2)}` : ' (KAS price not loaded yet)'}
        </Text>
        <TextInput value={usd} onChangeText={setUsd} placeholder="Lowest dollar price, e.g. 49.99" placeholderTextColor="#9ca3af"
          keyboardType="decimal-pad" autoFocus
          style={{ borderWidth: 1, borderColor: '#d6d3d1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginTop: 10, fontSize: 14, color: '#1c1917' }} />
        {valid ? (
          <Text style={{ fontSize: 12, marginTop: 8, fontWeight: '700', color: d >= 0 ? '#059669' : '#dc2626' }}>
            {d >= 0 ? `Kaspa price is ${Math.round(d * 100)}% cheaper` : `Kaspa price is ${Math.round(-d * 100)}% more expensive`} · PP ×{(1 / (1 - Math.max(-0.9, Math.min(0.9, d)))).toFixed(2)}
          </Text>
        ) : null}
        <Text style={{ fontSize: 10, color: '#78716c', marginTop: 6 }}>Kept only on this phone. Used for the purchasing-power estimate in Stats.</Text>
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
