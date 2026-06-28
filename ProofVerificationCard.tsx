// ============================================================================
// PROOF VERIFICATION CARD - Add to TownHallScreen proof display
// ============================================================================
// Drop this into the proofCard section of TownHallScreen.tsx
// The proof response from /api/counterparty/{pubkey}/proof now includes:
//   proof.vk_fingerprint: string  (SHA256 of verifying key)
//   proof.merkle_root: string     (Poseidon Merkle root of L1 events)
//   proof.proof_type: string      ("Halo2-IPA-Stats-V2" for real SNARK)
// ============================================================================

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';

interface ProofData {
  proof_type: string;
  proof_bytes: number[];
  vk_fingerprint: string;
  merkle_root: string;
  generated_at: number;
  public_inputs: {
    pubkey_hash: string;
    successes: number;
    deadlocks: number;
    xp: number;
    p_complete_fixed: number;
    total_agreements: number;
    l1_events_root: string;
    arweave_stats_hash: string;
    [key: string]: any;
  };
}

interface Props {
  proof: ProofData;
  pubkey: string;
}

export const ProofVerificationCard: React.FC<Props> = ({ proof, pubkey }) => {
  const [expanded, setExpanded] = useState(false);
  const isReal = proof.proof_type === 'Halo2-IPA-Stats-V2';

  const copyVerificationBundle = async () => {
    const bundle = {
      version: '1.0',
      system: 'KasVillage Halo2-IPA Stats Proof',
      proof_type: proof.proof_type,
      circuit: {
        k: 8,
        gates: 8,
        advice_columns: 20,
        instance_columns: 1,
        gate_1: 'xp = successes × 10 - deadlocks × 50',
        gate_2: 'p_complete × (2 + S + F) = (1 + S) × 1000000',
        gate_3: 'total = completed + refunded + deadlocked + pending',
        gate_4: 'total = as_buyer + as_seller',
        gate_5: 'deadlocks = deadlocked',
        gate_6: 'successes = completed',
        gate_7: 'adjusted_p × SCALE^5 = base × recency × pattern × resolution × speed × role',
        gate_8: 'final_p × SCALE = confidence × adjusted + (SCALE - confidence) × prior',
      },
      vk_fingerprint: proof.vk_fingerprint,
      merkle_root: proof.merkle_root,
      public_inputs: proof.public_inputs,
      proof_bytes_hex: proof.proof_bytes.map(b => b.toString(16).padStart(2, '0')).join(''),
      generated_at: proof.generated_at,
      pubkey,
      verify_endpoint: 'https://kasvillage.app.runonflux.io/api/verify/stats-vk',
      merkle_proof_endpoint: `https://kasvillage.app.runonflux.io/api/verify/merkle-proof/${pubkey}`,
      instructions: [
        '1. Reconstruct StatsVerificationCircuit with the 8 gates above',
        '2. Generate VK from ParamsIPA(K=8) using PSE Halo2 v2023_04_20',
        '3. Compare VK fingerprint (SHA256 of Debug format)',
        '4. Verify proof_bytes against public_inputs using verify_proof',
        '5. Check merkle_root matches L1 events via /api/verify/merkle-proof',
      ],
    };

    await Clipboard.setStringAsync(JSON.stringify(bundle, null, 2));
    Alert.alert('Copied', 'Verification bundle copied to clipboard. Paste into any AI or verifier tool.');
  };

  return (
    <View style={s.container}>
      {/* Proof Type Badge */}
      <TouchableOpacity style={s.header} onPress={() => setExpanded(!expanded)}>
        <View style={[s.badge, isReal ? s.badgeReal : s.badgeMock]}>
          <Text style={s.badgeText}>{isReal ? '🔐 SNARK Verified' : '⚠️ Hash Only'}</Text>
        </View>
        <Text style={s.proofType}>{proof.proof_type}</Text>
        <Text style={s.expandIcon}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={s.details}>
          {/* VK Fingerprint */}
          <View style={s.row}>
            <Text style={s.label}>VK Fingerprint</Text>
            <Text style={s.value} numberOfLines={1}>{proof.vk_fingerprint?.substring(0, 16)}...</Text>
          </View>

          {/* Merkle Root */}
          <View style={s.row}>
            <Text style={s.label}>Merkle Root</Text>
            <Text style={s.value} numberOfLines={1}>{proof.merkle_root?.substring(0, 16)}...</Text>
          </View>

          {/* Stats Summary */}
          <View style={s.row}>
            <Text style={s.label}>Proven Stats</Text>
            <Text style={s.value}>
              {proof.public_inputs.successes}S / {proof.public_inputs.deadlocks}D / {proof.public_inputs.xp}XP
            </Text>
          </View>

          {/* Proof Size */}
          <View style={s.row}>
            <Text style={s.label}>Proof Size</Text>
            <Text style={s.value}>{proof.proof_bytes?.length || 0} bytes</Text>
          </View>

          {/* Copy Button */}
          <TouchableOpacity style={s.copyBtn} onPress={copyVerificationBundle}>
            <Text style={s.copyBtnText}>📋 Copy Verification Bundle</Text>
          </TouchableOpacity>

          <Text style={s.hint}>
            Paste into any AI to independently verify your stats are real
          </Text>
        </View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    backgroundColor: '#1c1917',
    borderRadius: 12,
    marginTop: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#292524',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeReal: { backgroundColor: '#15803d' },
  badgeMock: { backgroundColor: '#92400e' },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  proofType: {
    color: '#a8a29e',
    fontSize: 11,
    flex: 1,
    fontFamily: 'monospace',
  },
  expandIcon: {
    color: '#78716c',
    fontSize: 12,
  },
  details: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#292524',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  label: {
    color: '#78716c',
    fontSize: 11,
  },
  value: {
    color: '#d6d3d1',
    fontSize: 11,
    fontFamily: 'monospace',
    maxWidth: '60%',
  },
  copyBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  copyBtnText: {
    color: '#1c1917',
    fontSize: 13,
    fontWeight: '800',
  },
  hint: {
    color: '#57534e',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 6,
  },
});

export default ProofVerificationCard;
