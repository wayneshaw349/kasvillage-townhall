// ============================================================================
// KASVILLAGE — PHONE PROOF SCREEN (Trustless Counterparty Verification)
// ============================================================================
// Standalone dashboard section. Generate + verify counterparty stat proofs
// directly from Arweave. Works with TownHall down.
// ============================================================================

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Modal, Dimensions, PixelRatio, Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';
import { X, Copy, CheckCircle, XCircle, Search } from 'lucide-react-native';
import {
  generateCounterpartyProof,
  verifyCounterpartyProof,
  proofToText,
  CounterpartyProof,
} from './counterparty_stat_prover';

const { width: SW } = Dimensions.get('window');
const sc = Math.min(SW / 393, 1.2);
const rs = {
  s: (n: number) => Math.round(n * sc),
  font: (n: number) => Math.round(n * sc * (PixelRatio.getFontScale() > 1 ? 0.9 : 1)),
};

const C = {
  bg: '#0a0a0a', card: '#1a1a2e', primary: '#49d6aa', gold: '#D4AF37',
  text: '#fff', muted: '#888', border: '#333', red: '#e74c3c', green: '#27AE60',
};

export interface PhoneProofScreenProps {
  visible: boolean;
  onClose: () => void;
}

export function PhoneProofScreen({ visible, onClose }: PhoneProofScreenProps) {
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [proof, setProof] = useState<CounterpartyProof | null>(null);
  const [verified, setVerified] = useState<{ valid: boolean; reason?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  // KV_PHONE_LOCAL: on-phone dual-signed evidence chain (Arweave-independent)
  const [myChain, setMyChain] = useState<any[]>([]);
  const [chainVerdict, setChainVerdict] = useState('');
  const [chainCopied, setChainCopied] = useState(false);
  const [trBusy, setTrBusy] = useState(false);
  const [anchorMsg, setAnchorMsg] = useState(''); // KV_PHONE_LOCAL3
  // KV_BUNDLE_VERIFY: paste someone else's evidence bundle and check it against the chain
  const [bundleIn, setBundleIn] = useState('');
  const [bundleBusy, setBundleBusy] = useState(false);
  const [bundleRes, setBundleRes] = useState<any>(null);
  const [net, setNet] = useState<'mainnet' | 'testnet-10'>('testnet-10'); // KV_NET_FOLLOW: scans follow the wallet's network
  React.useEffect(() => {
    (async () => { try { const a = (await SecureStore.getItemAsync('kv_kaspa_address')) || (await SecureStore.getItemAsync('kaspa_address')) || ''; if (a.startsWith('kaspa:')) setNet('mainnet'); } catch {} })();
  }, []);
  React.useEffect(() => {
    if (!visible) return;
    (async () => { try { const { loadChain } = require('./stat_records'); setMyChain(await loadChain()); } catch (e) { console.log('[PhoneProof] chain load failed:', e); } })();
  }, [visible]);
  const handleChainVerify = async () => {
    try {
      const { exportBundle, verifyBundle } = require('./stat_records');
      const _b = await exportBundle();
      const _pk = (await SecureStore.getItemAsync('kaspa_pubkey')) || (await SecureStore.getItemAsync('kv_public_key')) || '';
      const _v: any = verifyBundle(_b, _pk);
      setChainVerdict(_v && _v.valid !== false && _v.ok !== false ? 'VALID \u2713' : 'INVALID: ' + String((_v && (_v.reason || _v.error)) || 'see log'));
    } catch (e: any) { setChainVerdict('error: ' + String(e && e.message).slice(0, 40)); }
    setTimeout(() => setChainVerdict(''), 6000);
  };
  const handleChainCopy = async () => {
    try { const { exportBundle } = require('./stat_records'); await Clipboard.setStringAsync(await exportBundle()); setChainCopied(true); setTimeout(() => setChainCopied(false), 2000); } catch (e) { console.log('[PhoneProof] bundle copy failed:', e); }
  };
  const handleAnchorFetch = async () => {
    try {
      const { backfillAnchors, loadChain, fetchAnchor, setAnchor } = require('./stat_records');
      const _n = await backfillAnchors(20);
      // KV_PHONE_LOCAL2: complete partial anchors (txid stamped, header missing)
      let _f = 0;
      const _chain: any[] = await loadChain();
      for (const _r of _chain) {
        const _a: any = _r && _r.anchor;
        if (_a && _a.releaseTxId && !_a.utxoCommitment) {
          const _full = await fetchAnchor(_a.releaseTxId, _r.network === 'mainnet' ? 'mainnet' : require('./kv_net').KV_NET);
          if (_full && (_full.utxoCommitment || _full.releaseDaaScore)) { await setAnchor(_r.agrId, _full); _f++; }
        }
      }
      console.log('[PhoneProof] anchors backfilled:', _n, 'headers refetched:', _f);
      setAnchorMsg((_n + _f) > 0 ? 'Anchored ' + (_n + _f) + ' \u2713' : 'All anchored \u2713');
      setTimeout(() => setAnchorMsg(''), 4000);
      setMyChain(await loadChain());
    } catch (e) { console.log('[PhoneProof] anchor fetch failed:', e); }
  };

  const _xo = (k: string) => { const p = String(k || '').toLowerCase(); return p.length === 66 ? p.slice(2) : p; };
  const _race = <T,>(p: Promise<T>, ms: number): Promise<T | null> => Promise.race([p, new Promise<null>((res) => setTimeout(() => res(null), ms))]);
  const handleBundleVerify = async () => {
    const raw = bundleIn.trim();
    if (!raw) { setBundleRes({ ok: false, errors: ['Paste a bundle first - the other person copies it from THEIR Phone Proof screen.'] }); return; }
    setBundleBusy(true); setBundleRes(null);
    try {
      const { verifyBundle, fetchAnchor } = require('./stat_records');
      let recs: any[] = [];
      try { recs = JSON.parse(raw).records || []; } catch { setBundleRes({ ok: false, errors: ['Not valid bundle JSON.'] }); setBundleBusy(false); return; }
      if (!recs.length) { setBundleRes({ ok: false, empty: true, errors: ['No completed agreements yet - there is nothing to verify. A bundle fills in after their first settled trade.'] }); setBundleBusy(false); return; }
      const owner = String(recs[0].myPubkey || '');
      const v: any = verifyBundle(raw, owner);
      const distinct = new Set(recs.map((r: any) => _xo(r.cpPubkey)).filter(Boolean)).size;
      // anchor spot-check: confirm up to 3 anchored records exist on the chain
      let anchorsTried = 0, anchorsOk = 0;
      for (const r of recs) {
        const a: any = r && r.anchor; if (!a || !a.releaseTxId) continue;
        if (anchorsTried >= 3) break; anchorsTried++;
        try { const got: any = await _race(fetchAnchor(a.releaseTxId, r.network === 'mainnet' ? 'mainnet' : require('./kv_net').KV_NET), 6000); if (got && (got.releaseDaaScore || got.utxoCommitment)) anchorsOk++; } catch {}
      }
      // live cross-check: a fresh chain scan of the same pubkey catches dropped recent deals
      const warns: string[] = []; let liveLine = '';
      try {
        const { scanCounterparty } = require('./counterparty_scan');
        const live: any = await _race(scanCounterparty(owner, net, 40, false), 9000);
        if (live) {
          liveLine = 'Live chain window: ' + live.settled + ' settled, ' + live.deadlocked + ' deadlocked of ' + live.total + (live.truncated ? '+' : '');
          if (live.deadlocked > v.deadlocks) warns.push('The live chain shows ' + live.deadlocked + ' deadlocked escrows but the bundle admits only ' + v.deadlocks + ' - recent bad deals may have been left out.');
        } else liveLine = 'Live cross-check timed out - rely on the signature checks above.';
      } catch { liveLine = 'Live cross-check unavailable.'; }
      // KV_BUNDLE_NET: testnet deals are free to make, so they never count as mainnet reputation
      const _expNet = require('./kv_vault_active').kvActiveNet();
      const _wrongNet = recs.filter((r: any) => String(r.network || 'testnet-10') !== _expNet);
      if (_wrongNet.length) {
        v.ok = false;
        v.errors = [...(v.errors || []), _wrongNet.length + ' of ' + recs.length + ' record(s) are from ' + (_expNet === 'mainnet' ? 'TESTNET (practice coins)' : 'MAINNET') + ' - they do not count here. Only ' + _expNet + ' deals are real reputation on this network.'];
      }
      if (v.legacy) warns.push(v.legacy + ' legacy (v1) record(s): counterparty signature does not cover escrow/timeout/description.');
      if (anchorsTried && anchorsOk < anchorsTried) warns.push('Only ' + anchorsOk + '/' + anchorsTried + ' spot-checked anchors were found on the chain.');
      setBundleRes({ ...v, owner, distinct, anchorsTried, anchorsOk, warns, liveLine });
    } catch (e: any) { setBundleRes({ ok: false, errors: [String(e?.message || e)] }); }
    setBundleBusy(false);
  };

  const handleGenerate = async () => {
    const input = target.trim();
    if (!input) { setError('Enter APT, address, or pubkey'); return; }
    let pk = input;
    if (input.startsWith('APT-')) { try { const r = await fetch('https://arweave.net/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: `{ transactions(tags: [{ name: \"KV-Type\", values: [\"identity-anchor\"] }, { name: \"KV-APT\", values: [\"${input}\"] }], first: 1, sort: HEIGHT_DESC) { edges { node { tags { name value } } } } }` }) }); const j = await r.json(); const t = j?.data?.transactions?.edges?.[0]?.node?.tags || []; pk = t.find((x: any) => x.name === 'KV-Pubkey')?.value || ''; } catch {} }
    if (input.startsWith('kaspa') || input.startsWith('kaspatest')) { try { const r = await fetch('https://arweave.net/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: `{ transactions(tags: [{ name: \"KV-Type\", values: [\"identity-anchor\"] }, { name: \"KV-Address\", values: [\"${input}\"] }], first: 1, sort: HEIGHT_DESC) { edges { node { tags { name value } } } } }` }) }); const j = await r.json(); const t = j?.data?.transactions?.edges?.[0]?.node?.tags || []; pk = t.find((x: any) => x.name === 'KV-Pubkey')?.value || ''; } catch {} }
    if (!pk) { setError('Could not resolve pubkey'); return; }
    setError(''); setLoading(true); setProof(null); setVerified(null);
    try {
      // KV_SCAN_PROOF: chain-first background check (Arweave prover dead in RN)
      if (!/^[0-9a-fA-F]{64,66}$/.test(pk)) throw new Error('Enter their pubkey (64/66 hex) - it is in any proposal they send you');
      const { scanCounterparty } = require('./counterparty_scan');
      const _scan: any = await scanCounterparty(pk, net, 40, false);
      const _p: any = {
        completed: _scan.settled,
        deadlocks: _scan.deadlocked,
        total_agreements: _scan.total,
        p_complete: _scan.pSettled || 0,
        total_volume_sompi: Number(_scan.payoutsReceived || 0),
        evidence_hash: 'L1 scan ' + String(_scan.address || '').slice(0, 28) + (_scan.truncated ? ' (truncated - lower bound)' : ''),
        evidence: (_scan.escrows || []).map((e: any) => ({ agrId: 'escrow ' + String(e.escrowAddr || '').slice(10, 26), status: String(e.resolution || ''), amount: Number(e.fundedTotal || 0), arweaveTx: String(e.resolutionTxId || ''), role: '' })),
        _scan: true, _pk: pk,
      };
      setProof(_p);
    } catch (e: any) {
      setError(e?.message || 'Chain scan failed');
    } finally { setLoading(false); }
  };

  const handleVerify = async () => {
    if (!proof) return;
    setLoading(true);
    try {
      let r: any;
      if ((proof as any)._scan) {
        // KV_SCAN_PROOF: verify = independent re-scan of the chain, compare tallies
        const { scanCounterparty } = require('./counterparty_scan');
        const _re: any = await scanCounterparty((proof as any)._pk, net, 40, false);
        const _match = _re.settled === proof.completed && _re.deadlocked === proof.deadlocks && _re.total === proof.total_agreements;
        r = { valid: _match, reason: _match ? undefined : 'fresh scan differs (window moved or new activity): settled ' + _re.settled + ' vs ' + proof.completed + ', deadlocked ' + _re.deadlocked + ' vs ' + proof.deadlocks };
      } else {
        r = await verifyCounterpartyProof(proof);
      }
      setVerified(r);
    } catch (e: any) {
      setVerified({ valid: false, reason: e?.message || 'Verify error' });
    } finally { setLoading(false); }
  };

  const handleCopy = async () => {
    if (!proof) return;
    await Clipboard.setStringAsync(proofToText(proof));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[s.container, { padding: 8 }]}>
        {/* KV_PHONE: clip-art phone frame - the proof lives in a phone */}
        <View style={{ flex: 1, backgroundColor: '#5b7c99', borderRadius: 30, borderWidth: 2, borderColor: '#43617c', padding: 10 }}>
          <View style={{ alignSelf: 'center', width: 54, height: 6, borderRadius: 3, backgroundColor: '#43617c', marginBottom: 8 }} />
          <View style={{ flex: 1, borderRadius: 14, overflow: 'hidden', backgroundColor: C.bg }}>
        <View style={s.header}>
          <Text style={s.title}>Phone Proof</Text>
          <TouchableOpacity onPress={onClose}><X size={rs.s(24)} color={C.muted} /></TouchableOpacity>
        </View>

        <ScrollView style={s.content}>
          <Text style={s.desc}>
            Background-check any user straight from the Kaspa chain: enter their pubkey (it is in
            any proposal they send) and tally completed trades, deadlocks, and P(complete). No
            cooperation needed - every number is a re-fetchable transaction in the live window.
          </Text>

          {/* KV_PHONE_LOCAL: on-phone dual-signed evidence chain */}
          <View style={{ backgroundColor: C.card, borderRadius: rs.s(12), padding: rs.s(14), marginBottom: rs.s(14), borderWidth: 1, borderColor: C.border }}>
            <Text style={{ color: C.gold, fontWeight: 'bold', fontSize: rs.font(13) }}>My Evidence Chain ({myChain.length})</Text>
            <Text style={{ color: C.muted, fontSize: rs.font(10), marginTop: rs.s(4) }}>
              Dual-signed completions kept on this phone, hash-chained and anchored to Kaspa block headers (DAA score + MuHash snapshot of the whole chain at that moment). Survives pruning. Share the bundle and anyone can verify it on request.
            </Text>
            {myChain.length === 0 ? (
              <Text style={{ color: C.muted, fontSize: rs.font(11), marginTop: rs.s(8) }}>No records yet {'\u2014'} completed agreements land here automatically.</Text>
            ) : myChain.map((r: any, i: number) => {
              const _a: any = r && r.anchor;
              return (
                <View key={i} style={{ marginTop: rs.s(8), borderTopWidth: i ? 1 : 0, borderTopColor: C.border, paddingTop: rs.s(6) }}>
                  <Text style={{ color: C.text, fontSize: rs.font(11), fontWeight: 'bold' }}>{String(r.agrId || r.agreementId || 'record ' + (i + 1))}  <Text style={{ color: C.primary }}>{String(r.status || r.outcome || '')}</Text></Text>
                  <Text style={{ color: C.muted, fontSize: rs.font(9), marginTop: rs.s(2) }}>
                    {_a ? 'DAA ' + String(_a.releaseDaaScore || '?') + '  tx ' + String(_a.releaseTxId || '').slice(0, 16) + (_a.utxoCommitment ? '  MuHash \u2713' : '  header pending') : 'anchor pending'}
                  </Text>
                </View>
              );
            })}
            <View style={{ flexDirection: 'row', gap: rs.s(8), marginTop: rs.s(10) }}>
              <TouchableOpacity onPress={handleChainVerify} style={{ flex: 1, borderWidth: 1, borderColor: C.primary, borderRadius: rs.s(8), paddingVertical: rs.s(8), alignItems: 'center' }}>
                <Text style={{ color: C.primary, fontSize: rs.font(11), fontWeight: 'bold' }}>{chainVerdict || 'Verify Chain'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleChainCopy} style={{ flex: 1, borderWidth: 1, borderColor: C.gold, borderRadius: rs.s(8), paddingVertical: rs.s(8), alignItems: 'center' }}>
                <Text style={{ color: C.gold, fontSize: rs.font(11), fontWeight: 'bold' }}>{chainCopied ? 'Copied' : 'Copy Bundle'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAnchorFetch} style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: rs.s(8), paddingVertical: rs.s(8), alignItems: 'center' }}>
                <Text style={{ color: anchorMsg ? C.primary : C.muted, fontSize: rs.font(11), fontWeight: 'bold' }}>{anchorMsg || 'Fetch Anchors'}</Text>
              </TouchableOpacity>
            </View>
            {/* KV_TRACK_RECORD: one-tap report for pitching buyers/publishers */}
            <TouchableOpacity onPress={async () => { setTrBusy(true); try { await require('./kv_track_record').shareTrackRecord(); } catch (e: any) { Alert.alert('Track record', String((e && e.message) || e)); } finally { setTrBusy(false); } }}
              disabled={trBusy} style={{ marginTop: rs.s(8), backgroundColor: C.gold, borderRadius: rs.s(8), paddingVertical: rs.s(10), alignItems: 'center', opacity: trBusy ? 0.6 : 1 }}>
              <Text style={{ color: '#fff', fontSize: rs.font(12), fontWeight: 'bold' }}>{trBusy ? 'Building track record…' : 'Export track record'}</Text>
            </TouchableOpacity>
          </View>

          {/* KV_BUNDLE_VERIFY: check a bundle someone sent you */}
          <View style={{ backgroundColor: C.card, borderRadius: rs.s(12), padding: rs.s(14), marginBottom: rs.s(14), borderWidth: 1, borderColor: C.border }}>
            <Text style={{ color: C.primary, fontWeight: 'bold', fontSize: rs.font(13) }}>Verify someone's bundle</Text>
            <Text style={{ color: C.muted, fontSize: rs.font(10), marginTop: rs.s(4) }}>
              They copy their Evidence Chain bundle and send it to you. Pasting it here checks every dual signature, the hash chain, their Kaspa anchors, and runs a fresh chain scan to catch left-out deals.
            </Text>
            <TextInput
              style={[s.input, { marginTop: rs.s(8), minHeight: rs.s(70), textAlignVertical: 'top' }]}
              value={bundleIn} onChangeText={setBundleIn} multiline
              placeholder='Paste their bundle JSON ({"kind":"KVSTAT-BUNDLE"...})'
              placeholderTextColor={C.muted} autoCapitalize="none" autoCorrect={false}
            />
            <TouchableOpacity onPress={handleBundleVerify} disabled={bundleBusy} style={{ marginTop: rs.s(8), borderWidth: 1, borderColor: C.primary, borderRadius: rs.s(8), paddingVertical: rs.s(10), alignItems: 'center' }}>
              {bundleBusy ? <ActivityIndicator color={C.primary} /> : <Text style={{ color: C.primary, fontWeight: '600', fontSize: rs.font(13) }}>Verify bundle</Text>}
            </TouchableOpacity>
            {bundleRes && (
              <View style={{ marginTop: rs.s(10) }}>
                <Text style={{ color: bundleRes.ok ? C.green : bundleRes.empty ? C.muted : C.red, fontWeight: 'bold', fontSize: rs.font(13) }}>
                  {bundleRes.ok ? '\u2713 VALID - dual-signed and chain-intact' : bundleRes.empty ? '\u2014 EMPTY' : '\u2717 INVALID'}
                </Text>
                {bundleRes.ok !== false || bundleRes.total ? (
                  <Text style={{ color: C.text, fontSize: rs.font(11), marginTop: rs.s(4) }}>
                    {String(bundleRes.complete || 0) + ' complete / ' + String(bundleRes.deadlocks || 0) + ' deadlocked of ' + String(bundleRes.total || 0) + ' records \u00b7 ' + String(bundleRes.distinct || 0) + ' distinct counterpart' + (bundleRes.distinct === 1 ? 'y' : 'ies') + (bundleRes.anchorsTried ? ' \u00b7 anchors ' + bundleRes.anchorsOk + '/' + bundleRes.anchorsTried + ' \u2713' : '')}
                  </Text>
                ) : null}
                {bundleRes.owner ? <Text style={{ color: C.muted, fontSize: rs.font(9), fontFamily: 'monospace', marginTop: rs.s(2) }}>{'for ' + bundleRes.owner.slice(0, 20) + '\u2026 - make sure this matches the pubkey on THEIR proposal'}</Text> : null}
                {bundleRes.liveLine ? <Text style={{ color: C.muted, fontSize: rs.font(10), marginTop: rs.s(4) }}>{bundleRes.liveLine}</Text> : null}
                {(bundleRes.warns || []).map((w: string, i: number) => <Text key={i} style={{ color: C.gold, fontSize: rs.font(10), marginTop: rs.s(4) }}>{'\u26a0 ' + w}</Text>)}
                {(bundleRes.errors || []).slice(0, 3).map((e: string, i: number) => <Text key={'e' + i} style={{ color: C.red, fontSize: rs.font(10), marginTop: rs.s(4) }}>{e}</Text>)}
              </View>
            )}
          </View>

          <View style={s.inputBox}>
            <Text style={s.label}>Counterparty Pubkey</Text>
            <TextInput
              style={s.input}
              value={target}
              onChangeText={setTarget}
              placeholder="APT-XXXX, kaspa:..., or pubkey"
              placeholderTextColor={C.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity style={s.genBtn} onPress={handleGenerate} disabled={loading}>
            {loading && !proof ? <ActivityIndicator color="#000" /> : (
              <><Search size={rs.s(18)} color="#000" /><Text style={s.genBtnText}>Generate Proof</Text></>
            )}
          </TouchableOpacity>

          {error ? <Text style={s.error}>{error}</Text> : null}

          {proof && (
            <>
              <View style={s.tallyCard}>
                <Text style={s.tallyTitle}>Tally</Text>
                <Row k="Completed" v={String(proof.completed)} color={C.green} />
                <Row k="Deadlocks" v={String(proof.deadlocks)} color={C.red} />
                <Row k="Total Agreements" v={String(proof.total_agreements)} />
                <Row k="P(Complete)" v={proof.total_agreements > 0 ? (proof.p_complete * 100).toFixed(1) + '%' : 'N/A'} color={C.gold} />
                <Row k="Volume" v={(proof.total_volume_sompi / 1e8).toFixed(4) + ' KAS'} />
                <View style={s.divider} />
                <Text style={s.hashLabel}>Evidence Hash</Text>
                <Text style={s.hash}>{proof.evidence_hash}</Text>
                <Text style={s.evidenceCount}>{proof.evidence.length} agreement(s) — each re-fetchable</Text>
              </View>

              <View style={s.btnRow}>
                <TouchableOpacity style={s.verifyBtn} onPress={handleVerify} disabled={loading}>
                  {loading ? <ActivityIndicator color={C.primary} /> : (
                    <><CheckCircle size={rs.s(18)} color={C.primary} /><Text style={s.verifyBtnText}>Verify</Text></>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={s.copyBtn} onPress={handleCopy}>
                  {copied ? <CheckCircle size={rs.s(18)} color={C.green} /> : <Copy size={rs.s(18)} color={C.gold} />}
                  <Text style={s.copyBtnText}>{copied ? 'Copied' : 'Copy Proof'}</Text>
                </TouchableOpacity>
              </View>

              {verified && (
                <View style={[s.verdictCard, verified.valid ? s.verdictOk : s.verdictBad]}>
                  {verified.valid ? <CheckCircle size={rs.s(24)} color={C.green} /> : <XCircle size={rs.s(24)} color={C.red} />}
                  <View style={{ flex: 1 }}>
                    <Text style={[s.verdictText, { color: verified.valid ? C.green : C.red }]}>
                      {verified.valid ? 'VERIFIED — recomputed from the Kaspa chain, matches' : 'INVALID'}
                    </Text>
                    {verified.reason ? <Text style={s.verdictReason}>{verified.reason}</Text> : null}
                  </View>
                </View>
              )}

              <View style={s.evidenceBox}>
                <Text style={s.evidenceTitle}>Evidence</Text>
                {proof.evidence.map((e, i) => (
                  <View key={e.agrId + i} style={s.evidenceItem}>
                    <Text style={[s.evStatus, { color: e.status === 'Released' ? C.green : e.status === 'Deadlocked' ? C.red : C.muted }]}>
                      {e.status}
                    </Text>
                    <Text style={s.evAgr}>{e.agrId.slice(0, 20)}</Text>
                    <Text style={s.evTx}>{e.arweaveTx.slice(0, 12)}...</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
          </View>
          <TouchableOpacity onPress={onClose} style={{ alignSelf: 'center', marginTop: 8, width: 34, height: 34, borderRadius: 17, borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.85)' }} />
        </View>
      </View>
    </Modal>
  );
}

const Row: React.FC<{ k: string; v: string; color?: string }> = ({ k, v, color }) => (
  <View style={s.row}>
    <Text style={s.rowK}>{k}</Text>
    <Text style={[s.rowV, color ? { color } : {}]}>{v}</Text>
  </View>
);

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: rs.s(16), borderBottomWidth: 1, borderBottomColor: C.border },
  title: { fontSize: rs.font(20), fontWeight: 'bold', color: C.text },
  content: { flex: 1, padding: rs.s(16) },
  desc: { color: C.muted, fontSize: rs.font(13), lineHeight: rs.font(18), marginBottom: rs.s(16) },
  inputBox: { marginBottom: rs.s(12) },
  label: { color: C.muted, fontSize: rs.font(12), marginBottom: rs.s(6) },
  input: { backgroundColor: C.card, borderRadius: rs.s(10), padding: rs.s(12), color: C.text, fontSize: rs.font(13), fontFamily: 'monospace', borderWidth: 1, borderColor: C.border },
  genBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs.s(8), backgroundColor: C.gold, padding: rs.s(14), borderRadius: rs.s(10), marginBottom: rs.s(8) },
  genBtnText: { color: '#000', fontSize: rs.font(14), fontWeight: 'bold' },
  error: { color: C.red, fontSize: rs.font(12), marginTop: rs.s(4) },
  tallyCard: { backgroundColor: C.card, borderRadius: rs.s(12), padding: rs.s(16), marginTop: rs.s(16) },
  tallyTitle: { color: C.gold, fontSize: rs.font(14), fontWeight: '900', textTransform: 'uppercase', marginBottom: rs.s(12) },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: rs.s(6) },
  rowK: { color: C.muted, fontSize: rs.font(13) },
  rowV: { color: C.text, fontSize: rs.font(13), fontWeight: '600' },
  divider: { height: 1, backgroundColor: C.border, marginVertical: rs.s(10) },
  hashLabel: { color: C.muted, fontSize: rs.font(11) },
  hash: { color: C.primary, fontSize: rs.font(10), fontFamily: 'monospace', marginTop: rs.s(2) },
  evidenceCount: { color: C.muted, fontSize: rs.font(11), marginTop: rs.s(8) },
  btnRow: { flexDirection: 'row', gap: rs.s(12), marginTop: rs.s(12) },
  verifyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs.s(6), padding: rs.s(12), borderWidth: 1, borderColor: C.primary, borderRadius: rs.s(10) },
  verifyBtnText: { color: C.primary, fontSize: rs.font(14), fontWeight: '600' },
  copyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs.s(6), padding: rs.s(12), backgroundColor: '#D4AF3720', borderRadius: rs.s(10) },
  copyBtnText: { color: C.gold, fontSize: rs.font(14), fontWeight: '600' },
  verdictCard: { flexDirection: 'row', alignItems: 'center', gap: rs.s(10), padding: rs.s(14), borderRadius: rs.s(10), marginTop: rs.s(12) },
  verdictOk: { backgroundColor: '#27AE6020' },
  verdictBad: { backgroundColor: '#e74c3c20' },
  verdictText: { fontSize: rs.font(13), fontWeight: 'bold' },
  verdictReason: { color: C.muted, fontSize: rs.font(11), marginTop: rs.s(2) },
  evidenceBox: { backgroundColor: C.card, borderRadius: rs.s(12), padding: rs.s(16), marginTop: rs.s(16), marginBottom: rs.s(24) },
  evidenceTitle: { color: C.text, fontSize: rs.font(14), fontWeight: '600', marginBottom: rs.s(10) },
  evidenceItem: { flexDirection: 'row', alignItems: 'center', gap: rs.s(8), paddingVertical: rs.s(6), borderBottomWidth: 1, borderBottomColor: C.border },
  evStatus: { fontSize: rs.font(11), fontWeight: '600', width: rs.s(72) },
  evAgr: { color: C.text, fontSize: rs.font(11), fontFamily: 'monospace', flex: 1 },
  evTx: { color: C.muted, fontSize: rs.font(10), fontFamily: 'monospace' },
});

export default PhoneProofScreen;
