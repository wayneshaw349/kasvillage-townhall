// ============================================================================
// INSCRIBE VK + PROOF BUNDLE TO ARWEAVE
// ============================================================================
// Call from ProofVerificationCard after proof is received
// Uses existing uploadToTurbo from arweave_upload.ts
// ============================================================================

import { uploadToTurbo, prepareKVTags } from './arweave_upload';
import type { ArweaveTag } from './avatar_arweave_upload';

interface ProofBundle {
  proof_type: string;
  vk_fingerprint: string;
  merkle_root: string;
  proof_bytes: number[];
  public_inputs: Record<string, any>;
  generated_at: number;
}

/**
 * Inscribe VK fingerprint + circuit definition to Arweave
 * Called once per circuit version change (not per proof)
 * Tag: KV-Type: stats-circuit-vk
 */
export async function inscribeCircuitVK(
  vkFingerprint: string,
  pubkey: string,
): Promise<{ success: boolean; txId?: string; error?: string }> {
  const circuitDef = {
    version: '1.0',
    proof_system: 'Halo2-IPA',
    curve: 'Pallas (EqAffine)',
    k: 8,
    gates: 8,
    advice_columns: 20,
    instance_columns: 1,
    vk_fingerprint: vkFingerprint,
    gates_detail: {
      gate_1: 'xp = successes * 10 - deadlocks * 50',
      gate_2: 'p_complete * (2 + S + F) = (1 + S) * SCALE',
      gate_3: 'total = completed + refunded + deadlocked + pending',
      gate_4: 'total = as_buyer + as_seller',
      gate_5: 'deadlocks = deadlocked',
      gate_6: 'successes = completed',
      gate_7: 'adjusted_p * SCALE^5 = base * recency * pattern * resolution * speed * role',
      gate_8: 'final_p * SCALE = confidence * adjusted + (SCALE - confidence) * prior',
    },
    halo2_fork: 'PSE v2023_04_20',
    timestamp: Math.floor(Date.now() / 1000),
  };

  const tags: ArweaveTag[] = [
    { name: 'App-Name', value: 'KasVillage' },
    { name: 'Content-Type', value: 'application/json' },
    { name: 'KV-Type', value: 'stats-circuit-vk' },
    { name: 'KV-VKFingerprint', value: vkFingerprint },
    { name: 'KV-Pubkey', value: pubkey },
    { name: 'KV-ProofSystem', value: 'Halo2-IPA-Stats-V2' },
    { name: 'KV-K', value: '8' },
    { name: 'KV-Gates', value: '8' },
    { name: 'Unix-Time', value: String(Math.floor(Date.now() / 1000)) },
  ];

  return uploadToTurbo(JSON.stringify(circuitDef), tags);
}

/**
 * Inscribe full proof bundle to Arweave
 * Called each time a new proof is generated
 * Tag: KV-Type: stats-proof
 */
export async function inscribeStatsProof(
  proof: ProofBundle,
  pubkey: string,
): Promise<{ success: boolean; txId?: string; error?: string }> {
  const bundle = {
    proof_type: proof.proof_type,
    vk_fingerprint: proof.vk_fingerprint,
    merkle_root: proof.merkle_root,
    proof_bytes_hex: proof.proof_bytes.map(b => b.toString(16).padStart(2, '0')).join(''),
    public_inputs: proof.public_inputs,
    generated_at: proof.generated_at,
    pubkey,
  };

  const tags: ArweaveTag[] = [
    { name: 'App-Name', value: 'KasVillage' },
    { name: 'Content-Type', value: 'application/json' },
    { name: 'KV-Type', value: 'stats-proof' },
    { name: 'KV-Pubkey', value: pubkey },
    { name: 'KV-ProofType', value: proof.proof_type },
    { name: 'KV-VKFingerprint', value: proof.vk_fingerprint },
    { name: 'KV-MerkleRoot', value: proof.merkle_root },
    { name: 'KV-XP', value: String(proof.public_inputs.xp || 0) },
    { name: 'KV-Successes', value: String(proof.public_inputs.successes || 0) },
    { name: 'KV-Deadlocks', value: String(proof.public_inputs.deadlocks || 0) },
    { name: 'Unix-Time', value: String(Math.floor(Date.now() / 1000)) },
  ];

  return uploadToTurbo(JSON.stringify(bundle), tags);
}
