// kv_tip_crew.tsx — KV_TIP_CREW 2026-11-02
// "Archived by" + "Tip everyone involved" for store fronts and dapp/game cards.
//   - Archived by: archive operators that pass the PHONE re-check (node_registry.verifiedOperatorPayouts),
//     each with its own tip button.
//   - Tip everyone: one amount, split wallet-to-wallet: owner (store / dev) 50%, the rest equally across
//     keepers (reposters) + archive operators. One plain send per person, each >= 0.2 KAS. KasVillage takes
//     nothing; each send pays only the normal Kaspa network fee. No server in the money path.
//   - Optional monthly reminder (this phone only): after a crew tip, the card shows "monthly tip due" after 30 days.
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';

const DAY = 86400000;
const remindKey = (id: string) => 'kv_crew_tip:' + id;
const short = (a: string) => a.slice(a.indexOf(':') + 1, a.indexOf(':') + 13) + '…';

export interface CrewShare { addr: string; roles: string[]; sompi: bigint; }

/** Pure split (exported for tests). Owner 50% when present, rest equal; self removed; duplicates merged. */
export function crewSplit(total: bigint, owner: string | null, keepers: string[], operators: string[], self: string, floor: bigint): { shares: CrewShare[]; error?: string } {
  const roles = new Map<string, string[]>();
  const add = (a: string, r: string) => { if (!a || a === self) return; const l = roles.get(a); if (l) { if (!l.includes(r)) l.push(r); } else roles.set(a, [r]); };
  if (owner) add(owner, 'owner');
  for (const k of keepers.slice(0, 5)) add(k, 'keeper');
  for (const o of operators) add(o, 'archive');
  const all = Array.from(roles.keys());
  if (!all.length) return { shares: [], error: 'Nobody to tip (it is all you).' };
  const ownerIn = !!owner && roles.has(owner);
  const rest = all.filter((a) => !(ownerIn && a === owner));
  const shares: CrewShare[] = [];
  if (ownerIn && rest.length) {
    const ownerAmt = total / 2n; const per = (total - ownerAmt) / BigInt(rest.length);
    shares.push({ addr: owner as string, roles: roles.get(owner as string)!, sompi: ownerAmt });
    for (const a of rest) shares.push({ addr: a, roles: roles.get(a)!, sompi: per });
  } else {
    const per = total / BigInt(all.length);
    for (const a of all) shares.push({ addr: a, roles: roles.get(a)!, sompi: per });
  }
  const min = shares.reduce((m, s) => (s.sompi < m ? s.sompi : m), shares[0].sompi);
  if (min < floor) {
    const need = ownerIn && rest.length ? floor * BigInt(rest.length) * 2n : floor * BigInt(all.length);
    return { shares: [], error: 'Too small: each person needs at least 0.2 KAS. Tip at least ' + (Number(need) / 1e8) + ' KAS for ' + all.length + ' people.' };
  }
  return { shares };
}

async function wallet(): Promise<{ sender: string; priv: string; net: string } | null> {
  const SS = require('expo-secure-store'); const net = require('./kv_net').KV_NET;
  let sender = (await SS.getItemAsync('kv_kaspa_address')) || (await SS.getItemAsync('kaspa_address'));
  if (net === 'mainnet') sender = (await SS.getItemAsync('kaspa_address_real')) || sender;
  const priv = await require('./proposal_share')._kvResolvePrivHex();
  return sender && priv ? { sender, priv, net } : null;
}
async function authed(msg: string): Promise<boolean> {
  try { const LA = require('expo-local-authentication'); const a = await LA.authenticateAsync({ promptMessage: msg, cancelLabel: 'Cancel', disableDeviceFallback: false }); return !!(a && a.success); } catch { return false; }
}
const validAddr = (a: string, net: string) => typeof a === 'string' && a.startsWith(net === 'mainnet' ? 'kaspa:' : 'kaspatest:') && a.length > 20;

export function KvTipCrew({ id, name, owner, keepers, compact }: { id: string; name: string; owner?: string | null; keepers?: string[]; compact?: boolean }) {
  const [ops, setOps] = useState<string[] | null>(null);
  const [last, setLast] = useState<{ at: number; remind: boolean } | null>(null);
  const [busy, setBusy] = useState('');
  const net = require('./kv_net').KV_NET;
  const own = owner && validAddr(owner, net) ? owner : null;
  const kps = (keepers || []).filter((k) => validAddr(k, net));
  const fs = compact ? 9 : 10;

  useEffect(() => {
    let live = true;
    require('./node_registry').verifiedOperatorPayouts(net).then((l: string[]) => { if (live) setOps(l.filter((a) => validAddr(a, net))); }).catch(() => live && setOps([]));
    (async () => { try { const AS = require('@react-native-async-storage/async-storage').default; const v = await AS.getItem(remindKey(id)); if (live && v) setLast(JSON.parse(v)); } catch {} })();
    return () => { live = false; };
  }, [id, net]);

  const send = async (w: any, addr: string, sompi: bigint, preview: string) => {
    const r: any = await require('./kaspa_rest_tx').sendKaspaViaRest({ preview, senderAddress: w.sender, recipientAddress: addr, amountSompi: sompi, privateKeyHex: w.priv, network: w.net });
    return !!(r && r.success !== false);
  };

  const tipOne = (addr: string) => {
    require('./kv_prompt').kvPrompt('Tip this archive operator', 'Keeps "' + name + '" archived.\n' + addr + '\n\nKAS goes straight to their wallet.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send tip', onPress: async (v: string) => {
        const s: bigint = require('./kaspa_rest_tx').kvParseKasToSompi(v);
        if (!(s >= 20_000_000n) || s > 500_000_000_000n) { Alert.alert('Invalid amount', 'Enter between 0.2 and 5000 KAS.'); return; }
        const w = await wallet(); if (!w) { Alert.alert('Tip failed', 'Wallet identity unavailable.'); return; }
        if (w.sender === addr) { Alert.alert('That is you', 'You archive this yourself.'); return; }
        if (!(await authed('Tip ' + Number(s) / 1e8 + ' KAS'))) { Alert.alert('Not sent', 'Tipping needs Face ID or your phone passcode.'); return; }
        setBusy(addr);
        try { Alert.alert((await send(w, addr, s, 'You - tip archive operator')) ? 'Tip sent ✓' : 'Tip failed', Number(s) / 1e8 + ' KAS to the archive operator.'); }
        catch (e: any) { Alert.alert('Tip failed', String(e?.message || e)); }
        setBusy('');
      } },
    ], 'plain-text', '1');
  };

  const tipAll = () => {
    require('./kv_prompt').kvPrompt('Tip everyone involved', 'One amount, split wallet-to-wallet:\n' + (own ? '• 50% to the ' + 'owner\n• 50% shared by ' : '• shared equally by ') + 'keepers and archive operators\n\nKasVillage takes nothing. Each person is a separate payment with a tiny Kaspa network fee.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Next', onPress: async (v: string) => {
        const total: bigint = require('./kaspa_rest_tx').kvParseKasToSompi(v);
        if (!(total > 0n) || total > 500_000_000_000n) { Alert.alert('Invalid amount', 'Enter between 0 and 5000 KAS.'); return; }
        const w = await wallet(); if (!w) { Alert.alert('Tip failed', 'Wallet identity unavailable.'); return; }
        const sp = crewSplit(total, own, kps, ops || [], w.sender, require('./node_registry').TIP_FLOOR_SOMPI);
        if (sp.error) { Alert.alert('Tip everyone', sp.error); return; }
        const lines = sp.shares.map((s) => s.roles.join('+') + ' ' + short(s.addr) + '  ' + Number(s.sompi) / 1e8 + ' KAS').join('\n');
        const go = async (remind: boolean) => {
          if (!(await authed('Tip ' + Number(total) / 1e8 + ' KAS to ' + sp.shares.length + ' people'))) { Alert.alert('Not sent', 'Tipping needs Face ID or your phone passcode.'); return; }
          setBusy('all'); let ok = 0; const bad: string[] = [];
          for (const s of sp.shares) {
            try { if (await send(w, s.addr, s.sompi, 'You - tip ' + s.roles.join('+'))) ok++; else bad.push(short(s.addr)); } catch { bad.push(short(s.addr)); }
            await new Promise((r) => setTimeout(r, 1500)); // let change settle between sends
          }
          setBusy('');
          if (ok) { const rec = { at: Date.now(), remind }; setLast(rec); try { await require('@react-native-async-storage/async-storage').default.setItem(remindKey(id), JSON.stringify(rec)); } catch {} }
          Alert.alert(ok ? 'Tips sent ✓' : 'Tips failed', ok + ' of ' + sp.shares.length + ' paid.' + (bad.length ? '\nNot paid: ' + bad.join(', ') + ' - nothing was taken for those.' : ''));
        };
        Alert.alert('Send ' + Number(total) / 1e8 + ' KAS?', lines, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Send', onPress: () => go(false) },
          { text: 'Send + remind monthly', onPress: () => go(true) },
        ]);
      } },
    ], 'plain-text', '2');
  };

  const days = last ? Math.floor((Date.now() - last.at) / DAY) : -1;
  const due = !!(last && last.remind && days >= 30);
  const n = (ops || []).length;
  return (
    <View style={{ marginTop: compact ? 4 : 10 }}>
      <Text style={{ color: '#0e7490', fontSize: fs, fontWeight: 'bold', textAlign: 'center' }}>
        {ops === null ? 'Checking archive operators…' : n ? 'Archived by ' + n + ' verified operator' + (n === 1 ? '' : 's') : 'No verified archive operator right now'}
      </Text>
      {(ops || []).slice(0, 3).map((a) => (
        <TouchableOpacity key={a} disabled={!!busy} onPress={() => tipOne(a)} style={{ marginTop: 4, borderWidth: 1, borderColor: '#0e7490', borderRadius: 8, paddingVertical: compact ? 5 : 7, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
          <Text style={{ color: '#0e7490', fontSize: fs, fontWeight: 'bold' }}>{short(a) + ' — Tip this archive'}</Text>
        </TouchableOpacity>
      ))}
      {(own || kps.length || n) ? (
        <TouchableOpacity disabled={!!busy} onPress={tipAll} style={{ marginTop: 6, borderWidth: 1, borderColor: due ? '#b45309' : '#7c3aed', backgroundColor: due ? '#fef3c7' : 'transparent', borderRadius: 8, paddingVertical: compact ? 6 : 8, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
          <Text style={{ color: due ? '#b45309' : '#7c3aed', fontSize: fs + 1, fontWeight: 'bold' }}>{busy === 'all' ? 'Sending tips…' : (due ? '⏰ Monthly tip due — ' : '\u{1F49C} ') + 'Tip everyone involved'}</Text>
        </TouchableOpacity>
      ) : null}
      {last ? <Text style={{ color: '#7A6A57', fontSize: fs - 1, textAlign: 'center', marginTop: 2 }}>{'You tipped the crew ' + (days < 1 ? 'today' : days + ' day' + (days === 1 ? '' : 's') + ' ago') + (last.remind ? ' · monthly reminder on' : '')}</Text> : null}
    </View>
  );
}
