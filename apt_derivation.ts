// apt_derivation.ts
// Adaptive apartment derivation from pubkey
// Starts 6 hex chars, grows on collision: 6→16.7M, 7→268M, 8→4.3B, 12→281T

import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

const MIN_HEX = 6;
const MAX_HEX = 12;

export function deriveAptAt(pubkeyHex: string, hexLen: number): string {
  const hash = sha256(new TextEncoder().encode(pubkeyHex));
  return String(parseInt(bytesToHex(hash).slice(0, hexLen), 16));
}

export function deriveApt(pubkeyHex: string): string {
  return deriveAptAt(pubkeyHex, MIN_HEX);
}

export async function deriveAptWithCheck(pubkeyHex: string): Promise<{ apt: string; hexLen: number }> {
  for (let len = MIN_HEX; len <= MAX_HEX; len++) {
    const candidate = deriveAptAt(pubkeyHex, len);
    const existing = await queryAptOwner(candidate);
    if (!existing || existing === pubkeyHex) {
      return { apt: candidate, hexLen: len };
    }
    console.log(`[APT] Collision at ${len} hex (apt ${candidate}), expanding to ${len + 1}`);
  }
  return { apt: deriveAptAt(pubkeyHex, MAX_HEX), hexLen: MAX_HEX };
}

export function verifyApt(pubkeyHex: string, claimedApt: string): { valid: boolean; hexLen: number } {
  for (let len = MIN_HEX; len <= MAX_HEX; len++) {
    if (deriveAptAt(pubkeyHex, len) === claimedApt) {
      return { valid: true, hexLen: len };
    }
  }
  return { valid: false, hexLen: 0 };
}

export function formatApt(pubkeyHex: string): string {
  return `APT-${deriveApt(pubkeyHex)}`;
}

// ── Arweave helpers ──────────────────────────────────────────────────────

const ARWEAVE_GQL = 'https://arweave.net/graphql';

async function queryAptOwner(apt: string): Promise<string | null> {
  try {
    const query = `{
      transactions(
        tags: [
          { name: "App-Name", values: ["KasVillage"] },
          { name: "KV-Apt", values: ["${apt}"] }
        ],
        sort: HEIGHT_DESC,
        first: 1
      ) {
        edges { node { tags { name value } } }
      }
    }`;
    const res = await fetch(ARWEAVE_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const tags = data?.data?.transactions?.edges?.[0]?.node?.tags;
    if (!tags) return null;
    return tags.find((t: { name: string }) => t.name === 'KV-Pubkey')?.value || null;
  } catch {
    return null;
  }
}

export async function resolveAptToPubkey(apt: string): Promise<string | null> {
  const pubkey = await queryAptOwner(apt);
  if (!pubkey) return null;
  const { valid } = verifyApt(pubkey, apt);
  if (!valid) {
    console.error('[APT] Verification failed for apt', apt);
    return null;
  }
  return pubkey;
}