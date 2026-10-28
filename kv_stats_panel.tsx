// KV_STATS: Project & Store stats - every number re-derived from Kaspa L1 or from
// dual-signed records; nothing self-reported, so a dev can show real engagement
// (keeps cost KAS; sales are co-signed escrow deals; bots must fund real wallets).
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const C = { bg: '#0a0a0a', card: '#1a1a2e', gold: '#D4AF37', pink: '#ec4899', indigo: '#818cf8', text: '#fff', mut: '#888', line: '#333', green: '#10B981' };

interface GameStat { id: string; head: string; keeps: number; keepers: number; lastKeep: number; pledgeKas: number; }
interface SaleRow { label: string; n: number; kas: number; }

export default function KvStatsPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [games, setGames] = useState<GameStat[] | null>(null);
  const [sales, setSales] = useState<{ deals: number; kasIn: number; buyers: number; top: SaleRow[] } | null>(null);
  const [err, setErr] = useState('');

  const load = async () => {
    setBusy(true); setErr('');
    try {
      const NET = 'testnet-10';
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
      let deals = 0, kasIn = 0;
      for (const r of chain) {
        if (!r || r.outcome !== 'complete') continue;
        const loc = byId[String(r.agrId)];
        if (loc && loc.role !== 'seller') continue; // sales view: deals where you were paid
        deals++; buyers.add(String(r.cpPubkey || ''));
        const kas = Number(r.buyerAmountSompi || 0) / 1e8; kasIn += kas;
        const label = String((loc && loc.description) || 'deal ' + String(r.agrId).slice(0, 10)).slice(0, 40);
        const it = (items[label] = items[label] || { label, n: 0, kas: 0 }); it.n++; it.kas += kas;
      }
      setSales({ deals, kasIn, buyers: buyers.size, top: Object.values(items).sort((a, b) => b.kas - a.kas).slice(0, 5) });
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
          <TouchableOpacity onPress={load} disabled={busy} style={{ borderWidth: 1, borderColor: C.pink, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginVertical: 10 }}>
            <Text style={{ color: C.pink, fontWeight: 'bold' }}>↻ Re-derive from chain</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}
