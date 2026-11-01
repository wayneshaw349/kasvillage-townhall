// ============================================================================
// SavingsQRScreen.tsx — KV_SAVINGS_QR: the vault as a tracker of printed QRs
// ============================================================================
// Add to vault : hot wallet -> throwaway key -> split -> sign exits -> print -> scan back -> key deleted
// Spend        : scan a printed QR -> signature + chain checks -> coins go to the hot wallet
// The vault keeps no keys after a deposit is verified. The two-phone FROST vault is separate.
// ============================================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import * as SQ from './kv_savings_qr';
import { VaultQRSignScreen } from './VaultQRSignScreen';

type Mode = 'home' | 'add' | 'progress' | 'print' | 'verify' | 'scan' | 'slips';

/** "12.5" / "12,5" -> sompi, exact (no floating point). */
function kasToSompi(t: string): bigint | null {
  const s = String(t || '').trim().replace(',', '.');
  if (!/^\d{1,11}(\.\d{0,8})?$/.test(s)) return null;
  const [w, f = ''] = s.split('.');
  return BigInt(w) * 100_000_000n + BigInt((f + '00000000').slice(0, 8));
}
const fmt = (sompi: string | bigint) => (Number(BigInt(sompi)) / 1e8).toFixed(4);

export const SavingsQRScreen: React.FC<{ onClose: () => void; initialMode?: 'home' | 'add' | 'scan' }> = ({ onClose, initialMode }) => {
  const [mode, setMode] = useState<Mode>(initialMode === 'scan' ? 'scan' : initialMode === 'add' && !SQ.sqTutorial() ? 'add' : 'home');
  const [rows, setRows] = useState<SQ.SqRow[]>([]);
  const [session, setSession] = useState<SQ.SqSession | null>(null);
  const [amount, setAmount] = useState(() => { const a = String((globalThis as any).__kvSavingsAmount || ''); (globalThis as any).__kvSavingsAmount = ''; return a; }); // KV_SAVINGS_UI: amount carried from Send
  const [count, setCount] = useState('1');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [camOk, setCamOk] = useState(false);
  const scanLock = useRef(false);
  const [oldVault, setOldVault] = useState<{ vault: any; sompi: bigint; sweepKas: string } | null>(null);
  const [oldSweep, setOldSweep] = useState<{ to: string; kas: string } | null>(null);
  const _cam = (() => { try { return require('expo-camera'); } catch { return null; } })();

  const reload = useCallback(async () => {
    setSession(await SQ.sqLoadSession());
    setRows(await SQ.sqList());
    try { setRows(await SQ.sqRefresh()); } catch {}
    try { setOldVault(await SQ.sqOldCardPaperVault()); } catch { setOldVault(null); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  // Block screenshots while QRs exist on this phone (print + verify steps).
  useEffect(() => {
    if (mode !== 'print' && mode !== 'verify') return;
    let undo: any = null;
    (async () => { try { const SC = await import('expo-screen-capture'); await SC.preventScreenCaptureAsync('kv-savings-qr'); undo = () => SC.allowScreenCaptureAsync('kv-savings-qr').catch(() => {}); } catch {} })();
    return () => { if (undo) undo(); };
  }, [mode]);

  // Progress: wait for the deposit, then sign.
  useEffect(() => {
    if (mode !== 'progress') return;
    let stop = false;
    (async () => {
      while (!stop) {
        const r = await SQ.sqSign().catch((e: any) => ({ error: String(e?.message || e) }));
        if (stop) return;
        if ((r as any).error) { setMsg((r as any).error); return; }
        if (!(r as any).waiting) { setSession(await SQ.sqLoadSession()); setMode('print'); return; }
        setMsg('Waiting for the deposit to confirm…');
        await new Promise((ok) => setTimeout(ok, 5000));
      }
    })();
    return () => { stop = true; };
  }, [mode]);

  const askCamera = async () => { try { const r = await _cam?.Camera?.requestCameraPermissionsAsync?.(); setCamOk(r?.status === 'granted'); } catch {} };

  const startDeposit = async () => {
    const s = kasToSompi(amount); const n = Number(count);
    if (s === null || s <= 0n) { Alert.alert('Amount', 'Enter an amount in KAS, e.g. 250 or 12.5'); return; }
    if (!Number.isInteger(n) || n < 1 || n > 10) { Alert.alert('QRs', 'Choose 1 to 10 QRs.'); return; }
    if (s / BigInt(n) < 101_000_000n) { Alert.alert('Too small', 'Each QR must hold at least about 1.01 KAS.'); return; }
    // Every QR pays the hot wallet: its backup cards must exist and match before the first deposit.
    const bk = await SQ.sqHotBackupCheck();
    if (bk) { Alert.alert('Back up your hot wallet first', bk, [{ text: 'OK' }, { text: 'Details', onPress: async () => { const d = await SQ.sqHotBackupDiag().catch((e: any) => String(e?.message || e)); console.log('[SavingsQR] backup diag\n' + d); Alert.alert('Backup check details', d); } }]); return; }
    let saved = false; try { saved = (await require('expo-secure-store').getItemAsync('kv_sq_backup_ok')) === '1'; } catch {}
    if (!saved) {
      const yes = await new Promise<boolean>((ok) => Alert.alert('Backup cards saved?', 'Savings QRs always pay your hot wallet. If you lose this phone, only your hot wallet backup cards (Profile → Backup cards) get those coins back. Have you saved them?', [
        { text: 'Not yet', style: 'cancel', onPress: () => ok(false) }, { text: 'Yes, saved', onPress: () => ok(true) }]));
      if (!yes) return;
      try { await require('expo-secure-store').setItemAsync('kv_sq_backup_ok', '1'); } catch {}
    }
    setBusy(true); setMsg('');
    const r = await SQ.sqStartDeposit(s, n);
    setBusy(false);
    if (r.error) { Alert.alert('Deposit', r.error); await reload(); return; }
    setMode('progress');
  };

  // No printer module needed: one slip per screen on plain white -> screenshot -> print from Photos.
  const [slips, setSlips] = useState<string[]>([]);
  const [slipIdx, setSlipIdx] = useState(0);
  const [slipUi, setSlipUi] = useState(true);
  const showSlips = async () => {
    if (!session?.qrs || !session.exits) return;
    const hot = await SQ.sqHotAddress();
    let usd = 0; try { const PF = require('./kas_price_feed'); await PF.refreshPrice().catch(() => {}); const p = PF.getKasPrice(); usd = p && !p.isStale ? Number(p.usdPerKas) || 0 : 0; } catch {}
    const pages: string[] = JSON.parse(require('./kv_savings_note').notePrintHtml({ qrs: session.qrs, outs: session.exits.map((e) => e.outSompi), hotLast6: hot.slice(-6), net: session.net, usdPerKas: usd, single: true }));
    setSlips(pages); setSlipIdx(0); setSlipUi(true); setMode('slips');
  };

  const printSheet = async () => {
    if (!session?.qrs || !session.exits) return;
    // check the native module quietly first: requiring expo-print in a build without it throws a red dev error
    let Print: any = null; try { if (require('expo-modules-core').requireOptionalNativeModule('ExpoPrint')) Print = require('expo-print'); } catch {}
    if (!Print?.printAsync) { Alert.alert('Printing not available', 'This build of KasVillage cannot print yet. Update the app, then come back: your deposit is safe and waiting.'); return; }
    const hot = await SQ.sqHotAddress();
    let usd = 0; try { const PF = require('./kas_price_feed'); await PF.refreshPrice().catch(() => {}); const p = PF.getKasPrice(); usd = p && !p.isStale ? Number(p.usdPerKas) || 0 : 0; } catch {}
    try { await Print.printAsync({ html: SQ.sqPrintHtml(session.qrs, session.exits.map((e) => e.outSompi), hot.slice(-6), session.net, usd) }); }
    catch (e: any) { Alert.alert('Print', String(e?.message || e)); }
  };

  const returnDeposit = () => Alert.alert('Return deposit?', 'Sends this deposit back to your hot wallet (minus a small fee). No QRs will be valid.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Return', style: 'destructive', onPress: async () => { setBusy(true); const r = await SQ.sqReturnToHot(); setBusy(false); if (r.error) Alert.alert('Return', r.error); else { Alert.alert('Returned', 'The deposit is going back to your hot wallet.'); setMode('home'); } await reload(); } },
  ]);

  const onScanned = async (data: string) => {
    if (scanLock.current) return; scanLock.current = true;
    try {
      if (mode === 'verify') {
        const r = await SQ.sqVerifyAndForget(data);
        if (r.error) { Alert.alert('Not yet', r.error); return; }
        Alert.alert('Saved to the vault', 'The key is deleted. Your printed QRs are now the only way to move these coins, and they can only pay your hot wallet. Keep the two copies in different places.');
        setMode('home'); await reload(); return;
      }
      const c = await SQ.sqCheckQr(data);
      if (c.error || !c.info) { Alert.alert('Savings QR', c.error || 'Not valid'); return; }
      const i = c.info;
      const warn = i.paysHot ? '' : '\n\nWARNING: this QR pays wallet …' + i.hotLast6 + ', not your current wallet. Continue only if you still have that wallet\'s seed.';
      Alert.alert('Move to hot wallet?', fmt(i.outSompi) + ' KAS will go to your hot wallet …' + i.hotLast6 + '.' + warn, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', onPress: async () => { setBusy(true); const r = await SQ.sqSpend(i); setBusy(false); if (r.error) Alert.alert(r.maybe ? 'Check before retrying' : 'Failed', r.error); else Alert.alert('Sent', 'Coins are on their way to your hot wallet.'); setMode('home'); await reload(); } },
      ]);
    } finally { setTimeout(() => { scanLock.current = false; }, 1500); }
  };

  const unspent = rows.filter((r) => r.status !== 'spent');
  const total = unspent.reduce((a, r) => a + BigInt(r.outSompi), 0n);
  const camera = (
    _cam?.CameraView && camOk ? (
      <View style={st.cam}><_cam.CameraView style={{ flex: 1 }} barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={(e: any) => { const d = String(e?.data || ''); if (d.startsWith('KVSQ1|')) onScanned(d); }} /></View>
    ) : (<TouchableOpacity style={st.sec} onPress={askCamera}><Text style={st.secT}>Turn on camera</Text></TouchableOpacity>)
  );

  if (mode === 'add') return (
    <ScrollView contentContainerStyle={st.c}>
      <Text style={st.t}>Add to vault</Text>
      <Text style={st.b}>Moves KAS from your hot wallet into printed Savings QRs. After you print and scan one back, the key is deleted: the paper is the only way to move these coins, and only into your hot wallet.</Text>
      <Text style={st.l}>Amount (KAS)</Text>
      <TextInput style={st.in} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="e.g. 500" placeholderTextColor="#78716C" />
      <Text style={st.l}>Split into how many QRs (1-10)</Text>
      <TextInput style={st.in} value={count} onChangeText={setCount} keyboardType="number-pad" />
      <Text style={st.s}>Each QR returns its share minus a small network fee (~0.005 KAS). A split also pays one small fee.</Text>
      <TouchableOpacity style={[st.pri, busy && { opacity: 0.5 }]} disabled={busy} onPress={startDeposit}>{busy ? <ActivityIndicator color="#000" /> : <Text style={st.priT}>Deposit</Text>}</TouchableOpacity>
      <TouchableOpacity style={st.sec} onPress={() => setMode('home')}><Text style={st.secT}>Back</Text></TouchableOpacity>
    </ScrollView>
  );

  if (mode === 'progress') return (
    <ScrollView contentContainerStyle={st.c}>
      <Text style={st.t}>Preparing your QRs</Text>
      <ActivityIndicator color="#D4AF37" style={{ marginVertical: 20 }} />
      <Text style={st.b}>{msg || 'Working…'}</Text>
      <TouchableOpacity style={st.sec} onPress={() => setMode('home')}><Text style={st.secT}>Leave (safe - resume later)</Text></TouchableOpacity>
      <TouchableOpacity style={st.sec} onPress={returnDeposit}><Text style={st.secT}>Return deposit to hot wallet</Text></TouchableOpacity>
    </ScrollView>
  );

  if (mode === 'print') return (
    <ScrollView contentContainerStyle={st.c}>
      <Text style={st.t}>Print your Savings QRs</Text>
      <Text style={st.b}>{(session?.qrs?.length || 0)} QR{(session?.qrs?.length || 0) > 1 ? 's' : ''} ready. Print once: every QR comes out twice, stamped ORIGINAL and BACKUP COPY (same coins - count originals only). Store the two sets in different places. Losing every copy of a QR loses its coins.</Text>
      <TouchableOpacity style={st.pri} onPress={printSheet}><Text style={st.priT}>Print sheet</Text></TouchableOpacity>
      <TouchableOpacity style={st.sec} onPress={showSlips}><Text style={st.secT}>No printer app? Show slips to screenshot</Text></TouchableOpacity>
      <TouchableOpacity style={st.sec} onPress={() => setMode('verify')}><Text style={st.secT}>Printed originals + backup copies → Verify</Text></TouchableOpacity>
      <TouchableOpacity style={st.sec} onPress={returnDeposit}><Text style={st.secT}>Cancel: return deposit</Text></TouchableOpacity>
    </ScrollView>
  );

  if (mode === 'slips') {
    const WV = (() => { try { return require('react-native-webview').WebView; } catch { return null; } })();
    const SB = (() => { try { return require('react-native').StatusBar; } catch { return null; } })();
    const n = slips.length; const half = n / 2;
    const label = slipIdx < half ? 'ORIGINAL ' + (slipIdx + 1) + ' of ' + half : 'BACKUP COPY ' + (slipIdx - half + 1) + ' of ' + half;
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        {SB ? <SB hidden={!slipUi} /> : null}
        {WV && slips[slipIdx] ? <WV key={slipIdx} source={{ html: slips[slipIdx] }} originWhitelist={['about:blank']} javaScriptEnabled={false} scrollEnabled={false}
            onShouldStartLoadWithRequest={(r: any) => r.url === 'about:blank'} style={{ flex: 1, backgroundColor: '#FFFFFF' }} />
          : <Text style={[st.b, { padding: 16, color: '#000' }]}>This build cannot show the slips.</Text>}
        {slipUi ? (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(28,25,23,0.94)', padding: 16, paddingBottom: 30 }}>
            <Text style={[st.b, { marginBottom: 6 }]}>{label} · tap "Hide buttons", screenshot, then tap the screen to come back. Print the screenshots from Photos (Share → Print), then delete them.</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[st.sec, { flex: 1 }]} disabled={slipIdx === 0} onPress={() => setSlipIdx(slipIdx - 1)}><Text style={st.secT}>‹ Prev</Text></TouchableOpacity>
              <TouchableOpacity style={[st.pri, { flex: 2 }]} onPress={() => setSlipUi(false)}><Text style={st.priT}>Hide buttons</Text></TouchableOpacity>
              <TouchableOpacity style={[st.sec, { flex: 1 }]} disabled={slipIdx >= n - 1} onPress={() => setSlipIdx(slipIdx + 1)}><Text style={st.secT}>Next ›</Text></TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[st.sec, { flex: 1 }]} onPress={() => setMode('print')}><Text style={st.secT}>Back</Text></TouchableOpacity>
              <TouchableOpacity style={[st.sec, { flex: 2 }]} onPress={() => setMode('verify')}><Text style={st.secT}>Printed all → Verify</Text></TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity activeOpacity={1} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} onPress={() => setSlipUi(true)} />
        )}
      </View>
    );
  }

  if (mode === 'verify' || mode === 'scan') return (
    <ScrollView contentContainerStyle={st.c}>
      <Text style={st.t}>{mode === 'verify' ? 'Scan one printed QR' : 'Scan a Savings QR'}</Text>
      <Text style={st.b}>{mode === 'verify' ? 'Scan any QR from the PAPER (not a screen). This proves the print is readable; then the key is deleted.' : 'The coins move to your hot wallet. Nothing else is possible with a Savings QR.'}</Text>
      {camera}
      {busy ? <ActivityIndicator color="#D4AF37" /> : null}
      <TouchableOpacity style={st.sec} onPress={() => setMode(mode === 'verify' ? 'print' : 'home')}><Text style={st.secT}>Back</Text></TouchableOpacity>
    </ScrollView>
  );

  return (
    <ScrollView contentContainerStyle={st.c}>
      <Text style={st.t}>Savings QR vault</Text>
      <Text style={st.big}>{fmt(total)} KAS</Text>
      <Text style={st.s}>{unspent.length} unspent QR{unspent.length === 1 ? '' : 's'} · spent so far: {fmt(rows.filter((r) => r.status === 'spent').reduce((a, r) => a + BigInt(r.outSompi), 0n))} KAS ({rows.filter((r) => r.status === 'spent').length})</Text>
      <Text style={st.b}>This vault holds no keys. It is just a tally of the QRs you printed: what you have and what is spent. Your printed ORIGINALS are the money - backup copies are the same coins, so never count them twice.</Text>
      {session ? (
        <View style={st.card}>
          <Text style={st.cardH}>Deposit in progress ({session.stage})</Text>
          <TouchableOpacity style={st.pri} onPress={() => setMode(session.stage === 'signed' ? 'print' : 'progress')}><Text style={st.priT}>Continue</Text></TouchableOpacity>
          <TouchableOpacity style={st.sec} onPress={returnDeposit}><Text style={st.secT}>Return deposit to hot wallet</Text></TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={st.pri} onPress={() => { if (SQ.sqTutorial()) { Alert.alert('Real mode only', 'Savings QR needs Real mode.'); return; } setMode('add'); }}><Text style={st.priT}>Add to vault</Text></TouchableOpacity>
      )}
      <TouchableOpacity style={st.pri} onPress={() => setMode('scan')}><Text style={st.priT}>Spend: scan a QR</Text></TouchableOpacity>
      {oldVault && oldVault.sompi > 0n ? (
        <View style={st.card}>
          <Text style={st.cardH}>Old card + paper vault: {fmt(oldVault.sompi)} KAS</Text>
          <Text style={st.s}>This vault type is retired. Move its coins to your hot wallet (needs your vault cards loaded and your paper key), then put them in Savings QRs.</Text>
          <TouchableOpacity style={st.pri} onPress={async () => setOldSweep({ to: await SQ.sqHotAddress(), kas: oldVault.sweepKas })}><Text style={st.priT}>Move funds to hot wallet</Text></TouchableOpacity>
        </View>
      ) : null}
      {oldVault && oldSweep ? (
        <VaultQRSignScreen visible vault={oldVault.vault} initialRecipient={oldSweep.to} initialAmountKas={oldSweep.kas}
          getPrivateKeyHex={() => require('./kasvillage_cold_wallet').vaultCardKeyHex()}
          onClose={() => { setOldSweep(null); reload(); }} onSuccess={() => { setOldSweep(null); reload(); }} />
      ) : null}
      {rows.slice().reverse().map((r) => (
        <View key={r.id} style={st.row}>
          <Text style={st.rowT}>{fmt(r.outSompi)} KAS · {r.label}</Text>
          <Text style={[st.s, { color: r.status === 'spent' ? '#78716C' : r.status === 'unspent' ? '#86EFAC' : '#FBBF24' }]}>{r.status || 'checking'} · {new Date(r.createdAt).toISOString().slice(0, 10)} · pays …{r.hotLast6}</Text>
        </View>
      ))}
      <TouchableOpacity style={st.sec} onPress={onClose}><Text style={st.secT}>Close</Text></TouchableOpacity>
    </ScrollView>
  );
};

const st = StyleSheet.create({
  c: { padding: 20, paddingTop: 56, backgroundColor: '#1C1917', flexGrow: 1 },
  t: { color: '#F5F5F4', fontSize: 22, fontWeight: '800', marginBottom: 10 },
  big: { color: '#D4AF37', fontSize: 32, fontWeight: '800' },
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

/** Compact tally line for Dashboard / Send: "Savings vault 123.4500 KAS · 3 QRs". No keys, no network on first paint. */
export const KvSavingsTally: React.FC<{ onPress?: () => void; hidden?: boolean; style?: any }> = ({ onPress, hidden, style }) => {
  const [t, setT] = useState<{ haveSompi: bigint; haveCount: number } | null>(null);
  useEffect(() => {
    let live = true;
    (async () => { try { const a = await SQ.sqTally(); if (live) setT(a); await SQ.sqRefresh(); const b = await SQ.sqTally(); if (live) setT(b); } catch {} })();
    return () => { live = false; };
  }, []);
  if (!t || t.haveCount === 0) return onPress ? (
    <TouchableOpacity onPress={onPress} style={style}><Text style={{ color: '#A8A29E', fontSize: 12 }}>Savings vault: none yet · tap to start</Text></TouchableOpacity>
  ) : null;
  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress} style={style}>
      <Text style={{ color: '#D4AF37', fontSize: 13, fontWeight: '700' }}>Savings vault {hidden ? '••••' : fmt(t.haveSompi) + ' KAS'} · {t.haveCount} QR{t.haveCount === 1 ? '' : 's'}</Text>
    </TouchableOpacity>
  );
};

export default SavingsQRScreen;
