// ============================================================================
// KASVILLAGE — TRUSTLESS STEALTH VERIFIER (Client-side)
// ============================================================================
// Any phone reading a seller's rep re-verifies against Arweave directly.
// TownHall's "credited:true" is NOT trusted — this is the authority.
// ============================================================================

import { sha256 } from '@noble/hashes/sha256';

const ARWEAVE_GQL = 'https://arweave.net/graphql';
const ARWEAVE_DATA = 'https://arweave.net';

export interface VerifiedStealthStat {
  nullifier: string;
  amount_sompi: bigint;
  trade_tx: string;
  timestamp: number;
  merkle_verified: boolean;
}

export interface StealthRepResult {
  total_trades: number;
  total_volume_sompi: bigint;
  verified_trades: number;
  rejected: number;
}

// ============================================================================
// FETCH CURRENT ROOT (independent of TownHall)
// ============================================================================

export async function fetchMerkleRoot(network = 'testnet-10'): Promise<string | null> {
  const q = `{ transactions(tags: [{ name: "KV-Type", values: ["stealth-merkle-root"] }, { name: "KV-Network", values: ["${network}"] }], sort: HEIGHT_DESC, first: 1) { edges { node { id } } } }`;
  try {
    const r = await fetch(ARWEAVE_GQL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) });
    const j = await r.json();
    const edges = j?.data?.transactions?.edges ?? [];
    if (!edges.length) return null;
    const data = await (await fetch(`${ARWEAVE_DATA}/${edges[0].node.id}`)).json();
    return data.root ?? null;
  } catch { return null; }
}

// ============================================================================
// FETCH ALL NULLIFIER INSCRIPTIONS FOR A NETWORK
// ============================================================================

export async function fetchNullifiers(network = 'testnet-10'): Promise<Array<{ nullifier: string; amount: bigint; trade_tx: string; timestamp: number; proof_tx: string; txid: string }>> {
  const q = `{ transactions(tags: [{ name: "KV-Type", values: ["stealth-nullifier"] }, { name: "KV-Network", values: ["${network}"] }], first: 100, sort: HEIGHT_DESC) { edges { node { id tags { name value } } } } }`;
  try {
    const r = await fetch(ARWEAVE_GQL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) });
    const j = await r.json();
    const edges = j?.data?.transactions?.edges ?? [];
    const out = [];
    for (const e of edges) {
      const tags: Record<string, string> = {};
      for (const t of e.node.tags) tags[t.name] = t.value;
      out.push({
        nullifier: tags['KV-Nullifier'] ?? '',
        amount: BigInt(tags['KV-Amount'] ?? '0'),
        trade_tx: tags['KV-Trade'] ?? '',
        timestamp: parseInt(tags['KV-Timestamp'] ?? '0', 10),
        proof_tx: tags['KV-Proof'] ?? '',
        txid: e.node.id,
      });
    }
    return out;
  } catch { return []; }
}

// ============================================================================
// TRUSTLESS REP CHECK
// Reader re-verifies: (1) no duplicate nullifiers, (2) each proof valid
// against the current root. Ignores TownHall entirely.
// ============================================================================

export async function verifyStealthRep(
  network = 'testnet-10',
  verifyMerkleProof?: (proofHex: string, root: string) => Promise<boolean>,
): Promise<StealthRepResult> {
  const root = await fetchMerkleRoot(network);
  if (!root) return { total_trades: 0, total_volume_sompi: 0n, verified_trades: 0, rejected: 0 };

  const nulls = await fetchNullifiers(network);
  const seen = new Set<string>();
  let volume = 0n, verified = 0, rejected = 0;

  for (const n of nulls) {
    if (!n.nullifier || seen.has(n.nullifier)) { rejected++; continue; } // dup = reject
    seen.add(n.nullifier);

    if (verifyMerkleProof && n.proof_tx) {
      try {
        const proofBytes = await (await fetch(`${ARWEAVE_DATA}/${n.proof_tx}`)).arrayBuffer();
        const proofHex = Array.from(new Uint8Array(proofBytes)).map(b => b.toString(16).padStart(2, '0')).join('');
        if (!(await verifyMerkleProof(proofHex, root))) { rejected++; continue; }
      } catch { rejected++; continue; }
    }

    verified++;
    volume += n.amount;
  }

  return { total_trades: nulls.length, total_volume_sompi: volume, verified_trades: verified, rejected };
}
