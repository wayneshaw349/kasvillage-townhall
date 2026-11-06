// ============================================================================
// CashNoteScreen.tsx — KV_CASH_NOTE: make, print and redeem TRANSFERABLE bearer notes
// ============================================================================
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import * as CN from './kv_cash_note';

type Mode = 'home' | 'make' | 'wait' | 'slip' | 'finish' | 'redeem' | 'redeemTo';

function kasToSompi(t: string): bigint | null {
  const s = String(t || '').trim().replace(',', '.');
  if (!/^\d{1,11}(\.\d{0,8})?$/.test(s)) return null;
  const [w, f = ''] = s.split('.');
  return BigInt(w) * 100_000_000n + BigInt((f + '00000000').slice(0, 8));
}
const fmt = (s: string | bigint) => (Number(BigInt(s)) / 1e8).toFixed(4);

export const CashNoteScreen: React.FC<{ onClose: () => void; initialMode?: 'home' | 'make' | 'redeem' }> = ({ onClose, initialMode }) => {
  const [mode, setMode] = useState<Mode>(initialMode === 'make' ? 'make' : initialMode === 'redeem' ? 'redeem' : 'home');
  const [amount, setAmount] = useState(() => { const a = String((globalThis as any).__kvCashAmount || ''); (globalThis as any).__kvCashAmount = ''; return a; });
  const [session, setSession] = useState<CN.CnSession | null>(null);
  const [rows, setRows] = useState<CN.CnRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [camOk, setCamOk] = useState(false);
  const [slipHtml, setSlipHtml] = useState<{ screen: string; print: string } | null>(null);
  const [slipUi, setSlipUi] = useState(true);
  const [note, setNote] = useState<{ raw: string; sompi: bigint; printedSompi?: bigint; matches?: boolean; checkedAt?: number } | null>(null);
  const [toAddr, setToAddr] = useState('');
  const scanLock = useRef(false);
  const opLock = useRef(false); // KV_CASH_NOTE: double-tap guard (React state is too late)
  const _cam = (() => { try { return require('expo-camera'); } catch { return null; } })();

  const reload = useCallback(async () => { setSession(await CN.cnLoadSession()); setRows(await CN.cnList()); try { setRows(await CN.cnRefresh()); } catch {} }, []);
  useEffect(() => { reload(); }, [reload]);

  useEffect(() => { // wait for funding, then build the slip
    if (mode !== 'wait') return; let stop = false;
    (async () => {
      while (!stop) {
        let v = 0n; try { v = await CN.cnFundedSompi(); } catch {}
        if (stop) return;
        if (v > 0n) {
          const s = await CN.cnLoadSession(); if (!s) return;
          let usd = 0; try { const PF = require('./kas_price_feed'); await PF.refreshPrice().catch(() => {}); const p = PF.getKasPrice(); usd = p && !p.isStale ? Number(p.usdPerKas) || 0 : 0; } catch {}
          setSlipHtml(require('./kv_savings_note').bearerNotePages({ qr: s.qr, kas: Number(v) / 1e8, usdPerKas: usd, net: s.net }));
          setSession(s); setSlipUi(true); setMode('slip'); return;
        }
        setMsg('Waiting for the note to be funded…'); await new Promise((ok) => setTimeout(ok, 5000));
      }
    })();
    return () => { stop = true; };
  }, [mode]);

  const askCamera = async () => { try { const r = await _cam?.Camera?.requestCameraPermissionsAsync?.(); setCamOk(r?.status === 'granted'); } catch {} };

  const make = async () => {
    if (opLock.current) return; opLock.current = true;
    try { await makeInner(); } finally { opLock.current = false; setBusy(false); }
  };
  const makeInner = async () => {
    const s = kasToSompi(amount);
    if (s === null || s < CN.CN_MIN_SOMPI) { Alert.alert('Amount', 'Enter at least 0.1 KAS.'); return; }
    const ok = await new Promise<boolean>((r) => Alert.alert('Make a TRANSFERABLE note?', 'Anyone who holds or photographs this QR can take the money, like cash. Only hand it to the person you are paying.', [
      { text: 'Cancel', style: 'cancel', onPress: () => r(false) }, { text: 'Make note', onPress: () => r(true) }]));
    if (!ok) return;
    setBusy(true); const r = await CN.cnCreate(s).catch((e: any) => ({ error: String(e?.message || e) })); setBusy(false);
    if (r.error) { Alert.alert('Paper wallet', r.error); await reload(); return; }
    setMode('wait');
  };

  const reclaim = () => Alert.alert('Reclaim note?', 'Sends the note\'s coins back to your hot wallet. Any printed copy becomes empty.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Reclaim', style: 'destructive', onPress: checkReclaim },
  ]);
  // KV_CASH_NOTE: while 'returning', taps re-check (the key is kept until the reclaim is confirmed)
  const checkReclaim = async () => {
    if (opLock.current) return; opLock.current = true; setBusy(true);
    try {
      const r = await CN.cnReclaim().catch((e: any) => ({ error: String(e?.message || e) } as any));
      if (r.error) Alert.alert('Reclaim', r.error);
      else if (r.pending) { Alert.alert('Reclaiming…', 'The coins are on their way back to your hot wallet. Tap "Reclaiming… check again" in a minute to confirm.'); setSlipHtml(null); setMode('home'); }
      else { Alert.alert('Reclaimed', 'The coins are back in your hot wallet.'); setSlipHtml(null); setMode('home'); }
    } finally { opLock.current = false; setBusy(false); await reload(); }
  };
  const checkOld = async () => {
    if (opLock.current) return; opLock.current = true; setBusy(true);
    try {
      const r = await CN.sweepArchive();
      Alert.alert('Old notes', r.checked === 0 && !r.errors.length ? 'No old note keys on this network.' : 'Checked ' + r.checked + ' · sent home ' + r.swept + (r.pending ? ' · in progress ' + r.pending : '') + (r.skipped ? ' · other network ' + r.skipped : '') + (r.errors.length ? '\n' + r.errors.join('\n') : ''));
    } catch (e: any) { Alert.alert('Old notes', String(e?.message || e)); }
    finally { opLock.current = false; setBusy(false); }
  };

  const printNote = async () => {
    if (!slipHtml) return;
    let Print: any = null; try { if (require('expo-modules-core').requireOptionalNativeModule('ExpoPrint')) Print = require('expo-print'); } catch {}
    if (!Print?.printAsync) { Alert.alert('Printing not available', 'Use "Hide buttons" and take a screenshot, then print it from Photos.'); return; }
    try { await Print.printAsync({ html: slipHtml.print }); } catch (e: any) { Alert.alert('Print', String(e?.message || e)); }
  };

  const onScanned = async (data: string) => {
    if (scanLock.current) return; scanLock.current = true;
    try {
      if (mode === 'finish') {
        const r = await CN.cnFinish(data);
        if (r.error) { Alert.alert('Not yet', r.error); return; }
        Alert.alert('Note ready', 'The key is removed from this phone. The paper note is now the money: whoever holds it can spend it.');
        setSlipHtml(null); setMode('home'); await reload(); return;
      }
      const i = await CN.cnInspect(data);
      if (i.error || i.sompi === undefined) { Alert.alert('Paper wallet', i.error || 'Not valid'); return; }
      setNote({ raw: data, sompi: i.sompi, printedSompi: i.printedSompi, matches: i.matches, checkedAt: i.checkedAt }); setToAddr(await require('./kv_savings_qr').sqHotAddress()); setMode('redeemTo');
    } finally { setTimeout(() => { scanLock.current = false; }, 1500); }
  };

  const redeem = async () => {
    if (!note || opLock.current) return; opLock.current = true;
    try { await redeemInner(); } finally { opLock.current = false; setBusy(false); }
  };
  const redeemInner = async () => {
    if (!note) return;
    const mine = await require('./kv_savings_qr').sqHotAddress();
    const go = await new Promise<boolean>((r) => Alert.alert('Redeem note?', fmt(note.sompi) + ' KAS (minus a small fee) goes to ' + (toAddr.trim() === mine ? 'your hot wallet' : '…' + toAddr.trim().slice(-8)) + '.', [
      { text: 'Cancel', style: 'cancel', onPress: () => r(false) }, { text: 'Redeem', onPress: () => r(true) }]));
    if (!go) return;
    setBusy(true); const r = await CN.cnRedeem(note.raw, toAddr); setBusy(false);
    if (r.error) { Alert.alert(r.maybe ? 'Check before retrying' : 'Redeem failed', r.error); return; }
    Alert.alert('Redeemed', fmt(r.sompi || 0n) + ' KAS is on its way.'); setNote(null); setMode('home'); await reload();
  };

  const camera = (
    _cam?.CameraView && camOk ? (
      <View style={st.cam}><_cam.CameraView style={{ flex: 1 }} barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={(e: any) => { const d = String(e?.data || ''); if (d.startsWith('KVCN1|')) onScanned(d); }} /></View>
    ) : (<TouchableOpacity style={st.sec} onPress={askCamera}><Text style={st.secT}>Turn on camera</Text></TouchableOpacity>)
  );

  if (mode === 'slip' && slipHtml) {
    const WV = (() => { try { return require('react-native-webview').WebView; } catch { return null; } })();
    const SB = (() => { try { return require('react-native').StatusBar; } catch { return null; } })();
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        {SB ? <SB hidden={!slipUi} /> : null}
        {WV ? <WV source={{ html: slipHtml.screen }} originWhitelist={['about:blank']} javaScriptEnabled={false} scrollEnabled={false}
          onShouldStartLoadWithRequest={(r: any) => r.url === 'about:blank'} style={{ flex: 1, backgroundColor: '#FFFFFF' }} /> : null}
        {slipUi ? (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(28,25,23,0.94)', padding: 16, paddingBottom: 30 }}>
            <Text style={[st.b, { marginBottom: 6 }]}>TRANSFERABLE note. Print it, or tap "Hide buttons" and screenshot it (print from Photos, then delete the screenshot - a screenshot is spendable too).</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[st.sec, { flex: 1 }]} onPress={printNote}><Text style={st.secT}>Print</Text></TouchableOpacity>
              <TouchableOpacity style={[st.pri, { flex: 1 }]} onPress={() => setSlipUi(false)}><Text style={st.priT}>Hide buttons</Text></TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[st.sec, { flex: 1 }]} onPress={reclaim}><Text style={st.secT}>Reclaim</Text></TouchableOpacity>
              <TouchableOpacity style={[st.sec, { flex: 1 }]} onPress={() => setMode('finish')}><Text style={st.secT}>Printed → Finish</Text></TouchableOpacity>
            </View>
          </View>
        ) : <TouchableOpacity activeOpacity={1} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} onPress={() => setSlipUi(true)} />}
      </View>
    );
  }

  if (mode === 'make') return (
    <ScrollView contentContainerStyle={st.c}>
      <Text style={st.t}>Make a paper wallet</Text>
      <Text style={st.b}>KAS on paper. Whoever holds the paper scans it and chooses where the KAS goes - hand it over like you would hand over anything physical. Paid from your hot wallet. Until you tap Finish you can reclaim it.</Text>
      <Text style={st.l}>Amount (KAS)</Text>
      <TextInput style={st.in} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="e.g. 20" placeholderTextColor="#78716C" />
      <KvCapLine />
      <TouchableOpacity style={[st.pri, busy && { opacity: 0.5 }]} disabled={busy} onPress={make}>{busy ? <ActivityIndicator color="#000" /> : <Text style={st.priT}>Put it on paper</Text>}</TouchableOpacity>
      <TouchableOpacity style={st.sec} onPress={() => setMode('home')}><Text style={st.secT}>Back</Text></TouchableOpacity>
    </ScrollView>
  );

  if (mode === 'wait') return (
    <ScrollView contentContainerStyle={st.c}>
      <Text style={st.t}>Funding the paper</Text>
      <ActivityIndicator color="#D4AF37" style={{ marginVertical: 20 }} />
      <Text style={st.b}>{msg || 'Working…'}</Text>
      <TouchableOpacity style={st.sec} onPress={() => setMode('home')}><Text style={st.secT}>Leave (safe - resume later)</Text></TouchableOpacity>
      <TouchableOpacity style={st.sec} onPress={reclaim}><Text style={st.secT}>Reclaim to hot wallet</Text></TouchableOpacity>
    </ScrollView>
  );

  if (mode === 'finish' || mode === 'redeem') return (
    <ScrollView contentContainerStyle={st.c}>
      <Text style={st.t}>{mode === 'finish' ? 'Scan the printed page' : 'Check or sweep a paper wallet'}</Text>
      <Text style={st.b}>{mode === 'finish' ? 'Scan the printed page to prove it prints readably. Then the key is removed from this phone.' : 'Scan a KasVillage paper wallet. First you see a check against the blockchain (real KAS on it, printed amount, not redeemed). Nothing moves until you tap Redeem.'}</Text>
      {camera}
      <TouchableOpacity style={st.sec} onPress={() => setMode(mode === 'finish' ? 'slip' : 'home')}><Text style={st.secT}>Back</Text></TouchableOpacity>
    </ScrollView>
  );

  if (mode === 'redeemTo' && note) return (
    <ScrollView contentContainerStyle={st.c}>
      <Text style={st.t}>Paper wallet check</Text>
      <Text style={st.s}>Advisory: checked against api.kaspa.org just now{note.checkedAt ? ' (' + new Date(note.checkedAt).toLocaleTimeString() + ')' : ''}, two lookups agreeing. It can change the moment another copy is spent.</Text>
      {/* KV_CASH_NOTE precheck: the chain decides what the note is worth, not the printed number */}
      <View style={[st.card, { borderColor: note.matches === false ? '#EF4444' : '#86EFAC' }]}>
        <Text style={[st.cardH, { color: '#86EFAC' }]}>✓ Real KAS on chain: {fmt(note.sompi)} KAS</Text>
        {note.printedSompi !== undefined ? (
          note.matches ? <Text style={[st.cardH, { color: '#86EFAC', marginTop: 4 }]}>✓ Matches the printed amount ({fmt(note.printedSompi)} KAS)</Text>
            : <Text style={[st.cardH, { color: '#EF4444', marginTop: 4 }]}>✗ Printed {fmt(note.printedSompi)} KAS but only {fmt(note.sompi)} KAS is on it - do not accept it at face value</Text>
        ) : <Text style={[st.s, { marginTop: 4 }]}>Older paper: no printed amount inside the QR. Go by the on-chain value above.</Text>}
        <Text style={[st.cardH, { color: '#86EFAC', marginTop: 4 }]}>✓ Not redeemed as of this check</Text>
        <Text style={[st.s, { marginTop: 6 }]}>Until YOU sweep it, anyone else holding a copy (including whoever gave it to you) could still spend it first. Given one as a gift or payment? Sweep it into your own wallet now.</Text>
      </View>
      <Text style={st.l}>Send it to</Text>
      <TextInput style={st.in} value={toAddr} onChangeText={setToAddr} autoCapitalize="none" autoCorrect={false} placeholder="kaspa:..." placeholderTextColor="#78716C" />
      <Text style={st.s}>Filled with your hot wallet. Change it to send the KAS anywhere.</Text>
      <TouchableOpacity style={[st.pri, busy && { opacity: 0.5 }]} disabled={busy} onPress={redeem}>{busy ? <ActivityIndicator color="#000" /> : <Text style={st.priT}>Redeem</Text>}</TouchableOpacity>
      <TouchableOpacity style={st.sec} onPress={() => { setNote(null); setMode('home'); }}><Text style={st.secT}>Just checking - don't redeem</Text></TouchableOpacity>
    </ScrollView>
  );

  const out = rows.filter((r) => r.status !== 'redeemed');
  return (
    <ScrollView contentContainerStyle={st.c}>
      <Text style={st.t}>Paper wallets</Text>
      <Text style={st.b}>TRANSFERABLE paper KAS: whoever holds the note can spend it to any address. For gifts and paying people in person - not for your own savings.</Text>
      {session ? (
        <View style={st.card}>
          <Text style={st.cardH}>Note in progress ({fmt(session.sompi)} KAS){session.stage === 'returning' ? ' - reclaiming' : ''}</Text>
          {session.stage === 'returning' ? (
            <TouchableOpacity style={[st.pri, busy && { opacity: 0.5 }]} disabled={busy} onPress={checkReclaim}>{busy ? <ActivityIndicator color="#000" /> : <Text style={st.priT}>Reclaiming… check again</Text>}</TouchableOpacity>
          ) : (<>
            <TouchableOpacity style={st.pri} onPress={() => setMode('wait')}><Text style={st.priT}>Continue</Text></TouchableOpacity>
            <TouchableOpacity style={st.sec} onPress={reclaim}><Text style={st.secT}>Reclaim to hot wallet</Text></TouchableOpacity>
          </>)}
        </View>
      ) : <TouchableOpacity style={st.pri} onPress={() => setMode('make')}><Text style={st.priT}>Make a paper wallet</Text></TouchableOpacity>}
      <TouchableOpacity style={st.pri} onPress={() => setMode('redeem')}><Text style={st.priT}>Check / redeem a note</Text></TouchableOpacity>
      <TouchableOpacity style={[st.sec, busy && { opacity: 0.5 }]} disabled={busy} onPress={checkOld}><Text style={st.secT}>Check old deposits</Text></TouchableOpacity>
      {rows.length ? <Text style={[st.s, { marginTop: 14 }]}>Notes you made: {out.length} not yet redeemed</Text> : null}
      {rows.slice().reverse().map((r) => (
        <View key={r.addr} style={st.row}>
          <Text style={st.rowT}>{fmt(r.sompi)} KAS</Text>
          <Text style={[st.s, { color: r.status === 'redeemed' ? '#78716C' : '#FBBF24' }]}>{r.status || 'checking'} · {new Date(r.createdAt).toISOString().slice(0, 10)}</Text>
        </View>
      ))}
      <TouchableOpacity style={st.sec} onPress={onClose}><Text style={st.secT}>Close</Text></TouchableOpacity>
    </ScrollView>
  );
};

const st = StyleSheet.create({
  c: { padding: 20, paddingTop: 56, backgroundColor: '#1C1917', flexGrow: 1 },
  t: { color: '#F5F5F4', fontSize: 22, fontWeight: '800', marginBottom: 10 },
  b: { color: '#D6D3D1', fontSize: 14, lineHeight: 20, marginBottom: 12 },
  s: { color: '#A8A29E', fontSize: 12, marginBottom: 6 },
  l: { color: '#D6D3D1', fontSize: 13, fontWeight: '700', marginTop: 8 },
  in: { borderWidth: 1, borderColor: '#78716C', borderRadius: 8, padding: 10, color: '#F5F5F4', marginVertical: 6 },
  pri: { backgroundColor: '#D4AF37', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 12 },
  priT: { color: '#000', fontWeight: '800' },
  sec: { borderWidth: 1, borderColor: '#78716C', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 10 },
  secT: { color: '#F5F5F4', fontWeight: '600' },
  card: { borderWidth: 1, borderColor: '#D4AF37', borderRadius: 12, padding: 12, marginTop: 12 },
  cardH: { color: '#F5F5F4', fontWeight: '700' },
  row: { borderBottomWidth: 1, borderBottomColor: '#292524', paddingVertical: 10 },
  rowT: { color: '#F5F5F4', fontWeight: '600' },
  cam: { height: 280, borderRadius: 12, overflow: 'hidden', marginVertical: 10 },
});

export default CashNoteScreen;

// KV_CASH_CAP: shows the per-note limit under the amount box
function KvCapLine() {
  const [t, setT] = React.useState('');
  React.useEffect(() => { let live = true; require('./kv_cash_note').cnMaxSompi().then((c: any) => {
    if (!live) return;
    const cap = require('./kv_cash_note').CN_CAP_USD;
    if (c.max !== null) setT('Limit: $' + cap + ' per sheet (about ' + (Number(c.max) / 1e8).toFixed(2) + ' KAS' + (c.stale ? ', last known price' : '') + ')');
    else if (require('./kv_savings_qr').sqActiveNet() === 'mainnet') setT('Limit: $' + cap + ' per sheet (price unavailable - connect to the internet to make a note)');
  }).catch(() => {}); return () => { live = false; }; }, []);
  return t ? <Text style={{ color: '#a8a29e', fontSize: 12, marginTop: 4, marginBottom: 8 }}>{t}</Text> : null;
}
