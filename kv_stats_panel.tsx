// KV_STATS: Project & Store stats - every number re-derived from Kaspa L1 or from
// dual-signed records; nothing self-reported, so a dev can show real engagement
// (keeps cost KAS; sales are co-signed escrow deals; bots must fund real wallets).
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, ActivityIndicator, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const C = { bg: '#0a0a0a', card: '#1a1a2e', gold: '#D4AF37', pink: '#ec4899', indigo: '#818cf8', text: '#fff', mut: '#888', line: '#333', green: '#10B981' };

interface GameStat { id: string; head: string; keeps: number; keepers: number; lastKeep: number; pledgeKas: number; }
interface SaleRow { label: string; n: number; kas: number; }

// KV_PNL: profit health. Revenue is VERIFIED (dual-signed deals, last 30 days); costs are
// self-entered and stay on this phone. Projection: expected = 30-day run-rate; FLOOR = 50% of it.
const PNL_KEY = 'kv_pnl_costs_v1';
interface Costs { cogsPct: string; ai: string; team: string; rent: string; publish: string; audit: string; }
const NO_COSTS: Costs = { cogsPct: '', ai: '', team: '', rent: '', publish: '', audit: '' };
const num = (v: string) => { const n = parseFloat(String(v || '').replace(/[^0-9.]/g, '')); return isFinite(n) ? n : 0; };
export function kvPnl(revUsd30: number, c: Costs) {
  const cogs = Math.min(Math.max(num(c.cogsPct), 0), 100) / 100;
  const monthly = num(c.ai) + num(c.team) + num(c.rent) + (num(c.publish) + num(c.audit)) / 12; // one-time costs spread over 12 months
  const expected = revUsd30 * (1 - cogs) - monthly;
  // KV_PNL_STRESS: floors anchored to history, not optimism.
  //  - Recession: US retail fell ~12% peak-to-trough in 2008-09; we use -15% volume.
  //  - Crypto winter: BTC bears fell 77-84% from ATH, mid-cap alts 85-90%; we use -85% price.
  //  Standard case = BOTH at once: (1-0.85)*(1-0.15) ~= 13% of today's revenue.
  const RECESSION_VOL = 0.15, BEAR_PRICE = 0.85;
  const recessionFloor = revUsd30 * (1 - RECESSION_VOL) * (1 - cogs) - monthly;
  const winterFloor = revUsd30 * (1 - BEAR_PRICE) * (1 - RECESSION_VOL) * (1 - cogs) - monthly;
  const floor = winterFloor; // the number we judge by - never the generous one
  // KV_PNL_BULL: the upside swing, kept sober. BTC mid-cycle bulls ran ~3-4x (20x only from
  // the exact bottom); activity grows with it. We use KAS x3 and sales +50% - a ceiling to
  // size the opportunity, never a number to plan costs on.
  const bullCeiling = revUsd30 * 3 * 1.5 * (1 - cogs) - monthly;
  const breakEvenRev = cogs < 1 ? monthly / (1 - cogs) : Infinity;
  const band = Math.max(monthly * 0.05, 1);
  const state: 'green' | 'black' | 'red' = expected > band ? 'green' : expected < -band ? 'red' : 'black';
  const ratio = breakEvenRev > 0 && isFinite(breakEvenRev) ? Math.min(revUsd30 / breakEvenRev, 2) : (revUsd30 > 0 ? 2 : 0); // 1.0 = break-even
  return { cogs, monthly, expected, floor, recessionFloor, winterFloor, bullCeiling, breakEvenRev, state, ratio };
}

export default function KvStatsPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [games, setGames] = useState<GameStat[] | null>(null);
  const [sales, setSales] = useState<{ deals: number; kasIn: number; buyers: number; top: SaleRow[] } | null>(null);
  const [err, setErr] = useState('');
  const [costs, setCosts] = useState<Costs>(NO_COSTS); // KV_PNL
  const [rev30, setRev30] = useState(0);
  const [editCosts, setEditCosts] = useState(false);
  useEffect(() => { (async () => { try { const r = await AsyncStorage.getItem(PNL_KEY); if (r) setCosts({ ...NO_COSTS, ...JSON.parse(r) }); } catch {} })(); }, []);
  const saveCosts = async (c: Costs) => { setCosts(c); try { await AsyncStorage.setItem(PNL_KEY, JSON.stringify(c)); } catch {} };

  const load = async () => {
    setBusy(true); setErr('');
    try {
      const NET = require('./kv_net').KV_NET;
      // ---- projects: keeps per head from the on-chain game registry ----
      const myGames: Record<string, any> = {};
      try { Object.assign(myGames, require('./games_to_publish')); } catch {}
      try { Object.assign(myGames, JSON.parse((await AsyncStorage.getItem('kv_my_games')) || '{}')); } catch {}
      const { registryAddress } = require('./payload_publish');
      const { fetchRecords, verifyRecord } = require('./kaspa_payload');
      const byHead: Record<string, { keeps: number; who: Set<string>; last: number }> = {};
      try {
        const recs: any[] = await fetchRecords(registryAddress('game', NET), NET, 100, 5);
        for (const r of recs) {
          const rec = r && r.record;
          if (!rec || rec.k !== 'keep' || !rec.d || !rec.d.head) continue;
          try { if (typeof verifyRecord === 'function' && !verifyRecord(rec)) continue; } catch { continue; }
          const h = String(rec.d.head);
          const e = (byHead[h] = byHead[h] || { keeps: 0, who: new Set(), last: 0 });
          e.keeps++; e.who.add(String(rec.o || '')); e.last = Math.max(e.last, Number(rec.t) || 0);
        }
      } catch {}
      let pledges: any[] = [];
      try { pledges = await require('./kv_reclaim').listMyPledges(); } catch {}
      const g: GameStat[] = Object.keys(myGames).map((id) => {
        const head = String(myGames[id].head || '');
        const e = byHead[head] || { keeps: 0, who: new Set(), last: 0 };
        const pl = pledges.find((p: any) => p.key === 'game:' + id);
        return { id, head, keeps: e.keeps, keepers: e.who.size, lastKeep: e.last, pledgeKas: pl ? Number(pl.sompi) / 1e8 : 0 };
      });
      setGames(g);
      // ---- store sales: dual-signed completions + local descriptions ----
      const { loadChain } = require('./stat_records');
      const chain: any[] = await loadChain();
      let la: any[] = []; try { la = await require('./local_agreements').listAgreements(); } catch {}
      const byId: Record<string, any> = {}; for (const a of la) byId[String(a.agrId)] = a;
      const items: Record<string, SaleRow> = {}; const buyers = new Set<string>();
      let deals = 0, kasIn = 0, kas30 = 0;
      for (const r of chain) {
        if (!r || r.outcome !== 'complete') continue;
        const loc = byId[String(r.agrId)];
        if (loc && loc.role !== 'seller') continue; // sales view: deals where you were paid
        deals++; buyers.add(String(r.cpPubkey || ''));
        const kas = Number(r.buyerAmountSompi || 0) / 1e8; kasIn += kas;
        if (Number(r.ts || 0) > Date.now() - 30 * 86400000) kas30 += kas; // KV_PNL run-rate window
        const label = String((loc && loc.description) || 'deal ' + String(r.agrId).slice(0, 10)).slice(0, 40);
        const it = (items[label] = items[label] || { label, n: 0, kas: 0 }); it.n++; it.kas += kas;
      }
      setSales({ deals, kasIn, buyers: buyers.size, top: Object.values(items).sort((a, b) => b.kas - a.kas).slice(0, 5) });
      setRev30(kas30);
    } catch (e: any) { setErr(String(e?.message || e)); }
    setBusy(false);
  };
  useEffect(() => { if (visible && games === null && !busy) load(); }, [visible]);

  let sm = false; try { sm = require('./streamer_mode').isStreamer(); } catch {}
  const kasTxt = (n: number) => (sm ? '••• KAS' : n.toFixed(2) + ' KAS');
  const age = (t: number) => (!t ? 'never' : Math.max(1, Math.round((Date.now() - t) / 3600000)) + 'h ago');

  if (!visible) return null;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.line }}>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: 'bold' }}>📊 Project & Store Stats</Text>
          <TouchableOpacity onPress={onClose}><Text style={{ color: C.mut, fontSize: 18 }}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1, padding: 16 }}>
          <Text style={{ color: C.mut, fontSize: 12, lineHeight: 17, marginBottom: 12 }}>
            Every number below is re-derived from Kaspa L1 or from dual-signed deal records - nothing is
            self-reported. Keeps cost the keeper KAS; sales are escrow deals co-signed by the buyer.
          </Text>
          {busy && <ActivityIndicator color={C.pink} style={{ marginVertical: 20 }} />}
          {err ? <Text style={{ color: '#e74c3c', fontSize: 12 }}>{err}</Text> : null}

          <Text style={{ color: C.pink, fontWeight: 'bold', fontSize: 14, marginBottom: 6 }}>MY PROJECTS (on-chain)</Text>
          {games && games.length === 0 && <Text style={{ color: C.mut, fontSize: 12 }}>No published games on this device.</Text>}
          {(games || []).map((p) => (
            <View key={p.id} style={{ backgroundColor: C.card, borderRadius: 10, padding: 12, marginBottom: 8 }}>
              <Text style={{ color: C.text, fontWeight: 'bold', fontSize: 13 }} numberOfLines={1}>{p.id}</Text>
              <Text style={{ color: C.indigo, fontSize: 12, marginTop: 3 }}>
                {p.keeps} keep{p.keeps === 1 ? '' : 's'} · {p.keepers} distinct keeper{p.keepers === 1 ? '' : 's'} · last {age(p.lastKeep)}
              </Text>
              <Text style={{ color: p.pledgeKas > 0 ? C.green : C.mut, fontSize: 11, marginTop: 2 }}>
                {p.pledgeKas > 0 ? '⛓ pledge in place: ' + kasTxt(p.pledgeKas) : 'no live pledge'}
              </Text>
            </View>
          ))}

          <Text style={{ color: C.pink, fontWeight: 'bold', fontSize: 14, marginVertical: 8 }}>MY STORE SALES (dual-signed)</Text>
          {sales && (
            <View style={{ backgroundColor: C.card, borderRadius: 10, padding: 12, marginBottom: 8 }}>
              <Text style={{ color: C.text, fontSize: 13 }}>
                {sales.deals} completed deal{sales.deals === 1 ? '' : 's'} · {sales.buyers} distinct buyer{sales.buyers === 1 ? '' : 's'} · <Text style={{ color: C.green }}>{kasTxt(sales.kasIn)}</Text> received
              </Text>
              {sales.top.length > 0 && <Text style={{ color: C.gold, fontSize: 12, marginTop: 8, fontWeight: 'bold' }}>TOP SELLING ITEMS</Text>}
              {sales.top.map((it, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text style={{ color: C.text, fontSize: 12, flex: 1 }} numberOfLines={1}>{(i + 1) + '. ' + it.label}</Text>
                  <Text style={{ color: C.mut, fontSize: 12 }}>{it.n}× · <Text style={{ color: C.green }}>{kasTxt(it.kas)}</Text></Text>
                </View>
              ))}
              {sales.deals === 0 && <Text style={{ color: C.mut, fontSize: 12, marginTop: 4 }}>No completed sales on this device yet.</Text>}
            </View>
          )}
          {/* KV_PNL: profit health bar */}
          {(() => {
            let usdPer = 0; try { const p: any = require('./kas_price_feed').getKasPrice(); usdPer = Number((p && (p.usd || p.price || p.usdPerKas)) || 0); } catch {}
            const revUsd = usdPer > 0 ? rev30 * usdPer : 0;
            const P = kvPnl(revUsd, costs);
            const col = P.state === 'green' ? C.green : P.state === 'red' ? '#ef4444' : '#e7e5e4';
            const fill = P.state === 'green' ? C.green : P.state === 'red' ? '#ef4444' : '#1c1917';
            const usd = (n: number) => (sm ? '$•••' : (n < 0 ? '-$' : '$') + Math.abs(n).toFixed(0));
            const field = (k: keyof Costs, label: string, hint: string) => (
              <View key={k} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                <Text style={{ color: C.mut, fontSize: 12, flex: 1 }}>{label}<Text style={{ fontSize: 10 }}>{'  ' + hint}</Text></Text>
                <TextInput value={costs[k]} onChangeText={(t) => saveCosts({ ...costs, [k]: t })} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#555"
                  style={{ color: C.text, borderWidth: 1, borderColor: C.line, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, width: 90, textAlign: 'right' }} />
              </View>
            );
            return (
              <View style={{ backgroundColor: C.card, borderRadius: 10, padding: 12, marginTop: 4 }}>
                <Text style={{ color: C.pink, fontWeight: 'bold', fontSize: 14 }}>💹 PROFIT HEALTH (30-day)</Text>
                <View style={{ height: 14, borderRadius: 7, backgroundColor: '#2a2a2a', marginTop: 10, overflow: 'hidden' }}>
                  <View style={{ width: Math.max(4, Math.min(100, P.ratio * 50)) + '%', height: '100%', backgroundColor: fill, borderRightWidth: P.state === 'black' ? 2 : 0, borderRightColor: '#e7e5e4' } as any} />
                  <View style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, backgroundColor: '#e7e5e4' }} />
                </View>
                <Text style={{ color: C.mut, fontSize: 10, marginTop: 3, textAlign: 'center' }}>red = loss · black = break-even (center line) · green = profit</Text>
                {usdPer <= 0 ? <Text style={{ color: C.gold, fontSize: 11, marginTop: 6 }}>KAS price not loaded yet - open the Dashboard once, then re-derive.</Text> : null}
                <Text style={{ color: col, fontWeight: 'bold', fontSize: 15, marginTop: 8 }}>
                  {P.state === 'green' ? 'Profitable' : P.state === 'red' ? 'Running at a loss' : 'Break-even'}: {usd(P.expected)}/mo
                </Text>
                <Text style={{ color: C.text, fontSize: 12, marginTop: 4 }}>Verified revenue (30d): {usd(revUsd)} · costs {usd(P.monthly)}/mo{P.cogs ? ' + ' + Math.round(P.cogs * 100) + '% goods' : ''}</Text>
                <Text style={{ color: P.recessionFloor >= 0 ? C.green : '#ef4444', fontSize: 12, marginTop: 2 }}>Recession floor (sales −15%, USD-priced goods): {usd(P.recessionFloor)}/mo</Text>
                <Text style={{ color: P.winterFloor >= 0 ? C.green : '#ef4444', fontSize: 12, marginTop: 2, fontWeight: 'bold' }}>Crypto-winter floor (KAS −85% + sales −15%): {usd(P.winterFloor)}/mo ← standard case</Text>
                <Text style={{ color: C.indigo, fontSize: 12, marginTop: 2 }}>Bull ceiling (KAS ×3, sales +50%): {usd(P.bullCeiling)}/mo — possibility, not a plan</Text>
                <Text style={{ color: C.mut, fontSize: 10, marginTop: 2 }}>Anchored to history: alt bears drop 85–90% from ATH; 2008–09 retail fell ~12%; mid-cycle bulls ran ~3–4×. Plan costs on the winter floor; let the bull surprise you.</Text>
                <Text style={{ color: C.mut, fontSize: 12, marginTop: 2 }}>Break-even needs {isFinite(P.breakEvenRev) ? usd(P.breakEvenRev) : '—'}/mo in sales</Text>
                <TouchableOpacity onPress={() => setEditCosts(!editCosts)} style={{ marginTop: 8 }}>
                  <Text style={{ color: C.indigo, fontSize: 12 }}>{editCosts ? '▼ Hide my costs' : '▶ Enter my costs (USD, stays on this phone)'}</Text>
                </TouchableOpacity>
                {editCosts ? (
                  <View>
                    {field('cogsPct', 'Cost of goods', '% of each sale')}
                    {field('ai', 'AI subscription', '$/month')}
                    {field('team', 'Team / staff', '$/month')}
                    {field('rent', 'Rent / mortgage', '$/month')}
                    {field('publish', 'Publish & launch', 'one-time $')}
                    {field('audit', 'Audit', 'one-time $')}
                    <Text style={{ color: C.mut, fontSize: 10, marginTop: 6 }}>One-time costs are spread over 12 months. Revenue is verified on-chain; costs are your own numbers - never shared.</Text>
                  </View>
                ) : null}
              </View>
            );
          })()}
          <TouchableOpacity onPress={load} disabled={busy} style={{ borderWidth: 1, borderColor: C.pink, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginVertical: 10 }}>
            <Text style={{ color: C.pink, fontWeight: 'bold' }}>↻ Re-derive from chain</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}
