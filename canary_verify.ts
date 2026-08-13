// canary_verify.ts - Phone-side verification of TownHall canary attestations.
// Recomputes sha256 over canonical verdict JSON (must byte-match serde_json
// field order from canary_scanner.rs) and schnorr-verifies against the pinned
// TownHall attest pubkey.
//
// Usage:
//   const res = await scanUrl('https://example.com');
//   res.verified === true  -> safe to render badge / inscribe
//
// PIN THE PUBKEY after Flux deploy: GET /api/canary/pubkey once, paste below.

import { schnorr } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
declare const __DEV__: boolean;
const TOWNHALL_URL = __DEV__
  ? 'http://localhost:8080'
  : 'https://kasvillage.app.runonflux.io';

// ---- pin after Flux deploy (GET /api/canary/pubkey). Empty = TOFU with warn.
export const PINNED_ATTEST_PUBKEY: string = '';

export interface CanaryFinding {
  code: string;
  severity: string;
  detail: string;
}

export interface CanaryVerdict {
  v: number;
  url: string;
  host: string;
  ts: number;
  verdict: 'clean' | 'suspicious' | 'dangerous';
  score: number;
  findings: CanaryFinding[];
}

export interface CanaryScanResult {
  verdict: CanaryVerdict | null;
  digest: string | null;
  sig: string | null;
  attestPubkey: string | null;
  verified: boolean;      // sig valid AND digest matches locally recomputed
  pinMatch: boolean;      // attestPubkey === PINNED_ATTEST_PUBKEY (or TOFU)
  error?: string;
}

// Must reproduce serde_json::to_string(&CanaryVerdict) byte-for-byte:
// struct field order, no whitespace.
export function canonicalVerdictJson(v: CanaryVerdict): string {
  const findings = v.findings.map((f) => ({
    code: f.code,
    severity: f.severity,
    detail: f.detail,
  }));
  return JSON.stringify({
    v: v.v,
    url: v.url,
    host: v.host,
    ts: v.ts,
    verdict: v.verdict,
    score: v.score,
    findings,
  });
}

export function verifyCanaryAttestation(
  verdict: CanaryVerdict,
  digestHex: string,
  sigHex: string,
  attestPubkeyHex: string,
): { verified: boolean; pinMatch: boolean; error?: string } {
  try {
    const canonical = canonicalVerdictJson(verdict);
    const localDigest = bytesToHex(sha256(new TextEncoder().encode(canonical)));
    if (localDigest !== digestHex.toLowerCase()) {
      return { verified: false, pinMatch: false, error: 'digest mismatch (canonicalization drift)' };
    }
    const sigOk = schnorr.verify(
      hexToBytes(sigHex),
      hexToBytes(digestHex),
      hexToBytes(attestPubkeyHex),
    );
    if (!sigOk) {
      return { verified: false, pinMatch: false, error: 'schnorr signature invalid' };
    }
    if (PINNED_ATTEST_PUBKEY) {
      const pinMatch = attestPubkeyHex.toLowerCase() === PINNED_ATTEST_PUBKEY.toLowerCase();
      return {
        verified: pinMatch,
        pinMatch,
        error: pinMatch ? undefined : 'attest pubkey does not match pinned key',
      };
    }
    console.warn('[Canary] no pinned pubkey - TOFU mode, sig valid but key unpinned');
    return { verified: true, pinMatch: false };
  } catch (e: any) {
    return { verified: false, pinMatch: false, error: String(e?.message || e) };
  }
}

export async function scanUrl(url: string): Promise<CanaryScanResult> {
  try {
    const resp = await fetch(`${TOWNHALL_URL}/api/canary/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await resp.json();
    if (data.error && !data.verdict) {
      return { verdict: null, digest: null, sig: null, attestPubkey: null, verified: false, pinMatch: false, error: data.error };
    }
    const verdict: CanaryVerdict = data.verdict;
    const digest: string | null = data.digest ?? null;
    const sig: string | null = data.sig ?? null;
    const attestPubkey: string | null = data.attest_pubkey ?? null;

    if (!sig || !attestPubkey || !digest) {
      return { verdict, digest, sig, attestPubkey, verified: false, pinMatch: false, error: data.warn || 'unsigned verdict' };
    }
    const v = verifyCanaryAttestation(verdict, digest, sig, attestPubkey);
    return { verdict, digest, sig, attestPubkey, verified: v.verified, pinMatch: v.pinMatch, error: v.error };
  } catch (e: any) {
    return { verdict: null, digest: null, sig: null, attestPubkey: null, verified: false, pinMatch: false, error: String(e?.message || e) };
  }
}
