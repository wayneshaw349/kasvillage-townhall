// ============================================================================
// KASVILLAGE — PHONE PROOF SCREEN (Trustless Counterparty Verification)
// ============================================================================
// Standalone dashboard section. Generate + verify counterparty stat proofs
// directly from Arweave. Works with TownHall down.
// ============================================================================

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Modal, Dimensions, PixelRatio,
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

  const handleGenerate = async () => {
    const input = target.trim();
    if (!input) { setError('Enter APT, address, or pubkey'); return; }
    let pk = input;
    if (input.startsWith('APT-')) { try { const r = await fetch('https://arweave.net/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: `{ transactions(tags: [{ name: \"KV-Type\", values: [\"identity-anchor\"] }, { name: \"KV-APT\", values: [\"${input}\"] }], first: 1, sort: HEIGHT_DESC) { edges { node { tags { name value } } } } }` }) }); const j = await r.json(); const t = j?.data?.transactions?.edges?.[0]?.node?.tags || []; pk = t.find((x: any) => x.name === 'KV-Pubkey')?.value || ''; } catch {} }
    if (input.startsWith('kaspa') || input.startsWith('kaspatest')) { try { const r = await fetch('https://arweave.net/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: `{ transactions(tags: [{ name: \"KV-Type\", values: [\"identity-anchor\"] }, { name: \"KV-Address\", values: [\"${input}\"] }], first: 1, sort: HEIGHT_DESC) { edges { node { tags { name value } } } } }` }) }); const j = await r.json(); const t = j?.data?.transactions?.edges?.[0]?.node?.tags || []; pk = t.find((x: any) => x.name === 'KV-Pubkey')?.value || ''; } catch {} }
    if (!pk) { setError('Could not resolve pubkey'); return; }
    setError(''); setLoading(true); setProof(null); setVerified(null);
    try {
      const myPk = (await SecureStore.getItemAsync('kaspa_pubkey')) || 'anon';
      const p = await generateCounterpartyProof(pk, myPk);
      setProof(p);
    } catch (e: any) {
      setError(e?.message || 'Generation failed (Arweave unreachable?)');
    } finally { setLoading(false); }
  };

  const handleVerify = async () => {
    if (!proof) return;
    setLoading(true);
    try {
      const r = await verifyCounterpartyProof(proof);
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
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>Phone Proof</Text>
          <TouchableOpacity onPress={onClose}><X size={rs.s(24)} color={C.muted} /></TouchableOpacity>
        </View>

        <ScrollView style={s.content}>
          <Text style={s.desc}>
            Tally any user's completed trades, deadlocks, and P(complete) directly from Arweave.
            No TownHall needed. Every number is backed by a re-fetchable transaction.
          </Text>

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
                      {verified.valid ? 'VERIFIED — recomputed from Arweave, matches' : 'INVALID'}
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
  desc: { color: C.muted, fontSize: rs.font(13), lineHeight: rs.font(19), marginBottom: rs.s(16) },
  inputBox: { marginBottom: rs.s(12) },
  label: { color: C.muted, fontSize: rs.font(12), marginBottom: rs.s(6) },
  input: { backgroundColor: C.card, borderRadius: rs.s(10), padding: rs.s(12), color: C.text, fontSize: rs.font(13), fontFamily: 'monospace', borderWidth: 1, borderColor: C.border },
  genBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs.s(8), backgroundColor: C.gold, padding: rs.s(14), borderRadius: rs.s(10), marginBottom: rs.s(8) },
  genBtnText: { color: '#000', fontSize: rs.font(15), fontWeight: 'bold' },
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
