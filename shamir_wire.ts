// ============================================================================
// KASVILLAGE — SHAMIR WIRE FORMAT + SELF-VERIFY GUARD + INTEGRATION
// ============================================================================
// Sits on top of the verified shamir.ts core. Adds:
//   1. Compact, checksummed string encoding for each share (fits in one QR)
//   2. splitWithVerify() — splits, immediately reconstructs, asserts equality,
//      and confirms every K-subset recovers BEFORE any share is returned.
//      A silently-bad split can never reach the user.
//   3. base32 (Crockford) encode/decode — QR-friendly, no ambiguous chars.
//   4. CRC-16 per share — a misread QR is rejected, not silently combined.
//
// Wire string format (one per QR):
//   KVS1-<gen>-<k>-<n>-<index>-<base32(data)>-<crc16base32>
//   e.g. KVS1-2-2-4-3-9F8H2K...-A7BC
//
// Pure TS. No deps beyond the core + a supplied secure RNG.
// ============================================================================

import { split, combine, ShamirShare } from './shamir';

// ---- Crockford base32 (no I, L, O, U — unambiguous when read/typed) --------

const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const B32_INV: Record<string, number> = {};
for (let i = 0; i < B32.length; i++) B32_INV[B32[i]] = i;

function base32Encode(bytes: Uint8Array): string {
  let out = '';
  let buf = 0, bits = 0;
  for (const byte of bytes) {
    buf = (buf << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += B32[(buf >> bits) & 31];
    }
  }
  if (bits > 0) out += B32[(buf << (5 - bits)) & 31];
  return out;
}

function base32Decode(str: string): Uint8Array {
  const out: number[] = [];
  let buf = 0, bits = 0;
  for (const ch of str) {
    const v = B32_INV[ch];
    if (v === undefined) throw new Error(`invalid base32 char: ${ch}`);
    buf = (buf << 5) | v;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

// ---- CRC-16/CCITT (catches QR misreads) ------------------------------------

function crc16(bytes: Uint8Array): number {
  let crc = 0xffff;
  for (const b of bytes) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc & 0xffff;
}

// ---- wire encode / decode --------------------------------------------------

const WIRE_PREFIX = 'KVS1';

/** Encode one share into a compact checksummed QR string. */
export function encodeShare(share: ShamirShare): string {
  const dataB32 = base32Encode(share.data);
  const crc = crc16(share.data);
  const crcB32 = base32Encode(new Uint8Array([(crc >> 8) & 0xff, crc & 0xff]));
  return `${WIRE_PREFIX}-${share.gen}-${share.threshold}-${share.total}-${share.index}-${dataB32}-${crcB32}`;
}

/** Decode a scanned QR string back into a share. Throws on bad format/checksum. */
export function decodeShare(wire: string): ShamirShare {
  const parts = wire.trim().split('-');
  if (parts.length !== 7) throw new Error('bad share format: expected 7 fields');
  const [prefix, genS, kS, nS, idxS, dataB32, crcB32] = parts;
  if (prefix !== WIRE_PREFIX) throw new Error(`bad prefix: ${prefix}`);

  const gen = parseInt(genS, 10);
  const threshold = parseInt(kS, 10);
  const total = parseInt(nS, 10);
  const index = parseInt(idxS, 10);
  if ([gen, threshold, total, index].some(n => !Number.isInteger(n) || n < 0)) {
    throw new Error('bad numeric field in share');
  }
  if (index < 1 || index > 255) throw new Error('share index out of range');
  if (threshold < 2 || total < threshold) throw new Error('bad threshold/total');

  const data = base32Decode(dataB32);
  const gotCrc = crc16(data);
  const crcBytes = base32Decode(crcB32);
  const wantCrc = ((crcBytes[0] << 8) | crcBytes[1]) & 0xffff;
  if (gotCrc !== wantCrc) throw new Error('checksum mismatch — QR misread or corrupted share');

  return { index, gen, threshold, total, data };
}

// ---- split WITH mandatory self-verification --------------------------------

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function kSubsets<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > arr.length) return [];
  const [h, ...rest] = arr;
  return [...kSubsets(rest, k - 1).map(c => [h, ...c]), ...kSubsets(rest, k)];
}

/**
 * Split `secret` and PROVE the shares are good before returning them.
 * Verifies:
 *   - every K-subset reconstructs the exact secret
 *   - every share round-trips through encode→decode
 * Throws if ANY check fails — a bad split never reaches the caller.
 *
 * For N<=6 (your 2-of-4 case) exhaustive subset check is cheap.
 * For larger N a random sample of subsets is checked instead.
 */
export function splitWithVerify(
  secret: Uint8Array,
  threshold: number,
  total: number,
  gen: number,
  randomBytes: (n: number) => Uint8Array,
): { shares: ShamirShare[]; wires: string[] } {
  const shares = split(secret, threshold, total, gen, randomBytes);

  // 1. exhaustive (small N) or sampled (large N) subset reconstruction check
  const subsets = total <= 8
    ? kSubsets(shares, threshold)
    : sampleSubsets(shares, threshold, 64, randomBytes);

  for (const subset of subsets) {
    const rec = combine(subset);
    if (!bytesEqual(rec, secret)) {
      throw new Error('SELF-VERIFY FAILED: a share subset did not reconstruct the secret — split aborted');
    }
  }

  // 2. wire round-trip check for every share
  const wires: string[] = [];
  for (const share of shares) {
    const wire = encodeShare(share);
    const back = decodeShare(wire);
    if (back.index !== share.index || back.gen !== share.gen ||
        !bytesEqual(back.data, share.data)) {
      throw new Error('SELF-VERIFY FAILED: share did not survive wire encode/decode — split aborted');
    }
    wires.push(wire);
  }

  // 3. final: reconstruct from the DECODED wires (end-to-end proof)
  const decoded = wires.slice(0, threshold).map(decodeShare);
  if (!bytesEqual(combine(decoded), secret)) {
    throw new Error('SELF-VERIFY FAILED: end-to-end wire reconstruction mismatch — split aborted');
  }

  return { shares, wires };
}

function sampleSubsets<T>(arr: T[], k: number, count: number, rng: (n: number) => Uint8Array): T[][] {
  const out: T[][] = [];
  for (let s = 0; s < count; s++) {
    const pool = [...arr];
    const pick: T[] = [];
    for (let i = 0; i < k; i++) {
      const r = rng(1)[0] % pool.length;
      pick.push(pool.splice(r, 1)[0]);
    }
    out.push(pick);
  }
  return out;
}

// ---- recovery from scanned wires -------------------------------------------

/**
 * Reconstruct the secret from scanned QR wire strings.
 * Validates format, checksums, generation-consistency before combining.
 */
export function recoverFromWires(wires: string[]): Uint8Array {
  if (wires.length < 2) throw new Error('need at least 2 shares to recover');
  const shares = wires.map(decodeShare);

  const gen = shares[0].gen;
  const threshold = shares[0].threshold;
  for (const s of shares) {
    if (s.gen !== gen) throw new Error(`stale share: generation ${s.gen} != ${gen}. Re-scan same-generation shares.`);
  }
  if (shares.length < threshold) {
    throw new Error(`need ${threshold} shares to recover, scanned ${shares.length}`);
  }
  return combine(shares);
}
