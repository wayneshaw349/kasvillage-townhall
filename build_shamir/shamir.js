"use strict";
// ============================================================================
// KASVILLAGE — SHAMIR SECRET SHARING over GF(256)
// ============================================================================
// Splits the 32-byte wallet seed into N shares, any K of which reconstruct it.
// Any K-1 shares yield ZERO information (information-theoretic security).
//
// Field: GF(256) with reduction polynomial 0x11b (same as AES / SLIP-39).
// Each byte of the secret is split independently along a random polynomial
// of degree K-1; shares are evaluations at distinct nonzero x-coordinates.
//
// NO external dependencies. Pure arithmetic — auditable in isolation.
// A share is: { index: x, gen: generation, data: Uint8Array(secretLen) }
// wire format handled by the QR layer, not here.
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.split = split;
exports.combine = combine;
exports.sameGeneration = sameGeneration;
// ---- GF(256) arithmetic via log/exp tables (generator = 0x03) --------------
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function buildTables() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
        EXP[i] = x;
        LOG[x] = i;
        // multiply by generator 3: x = x ^ (x<<1), reduce by 0x11b if overflow
        let hi = x & 0x80;
        x = (x << 1) & 0xff;
        if (hi)
            x ^= 0x1b;
        x ^= EXP[i]; // x = x*2 XOR x = x*3
    }
    // duplicate for overflow-free indexing
    for (let i = 255; i < 512; i++)
        EXP[i] = EXP[i - 255];
})();
function gmul(a, b) {
    if (a === 0 || b === 0)
        return 0;
    return EXP[LOG[a] + LOG[b]];
}
function gdiv(a, b) {
    if (b === 0)
        throw new Error('GF divide by zero');
    if (a === 0)
        return 0;
    return EXP[LOG[a] + 255 - LOG[b]];
}
// ---- split -----------------------------------------------------------------
/**
 * Split `secret` into `total` shares, any `threshold` of which reconstruct it.
 * `randomBytes` MUST be a cryptographically secure RNG returning n random bytes.
 * `gen` tags the share generation (bump on every re-split).
 */
function split(secret, threshold, total, gen, randomBytes) {
    if (threshold < 2)
        throw new Error('threshold must be >= 2');
    if (total < threshold)
        throw new Error('total must be >= threshold');
    if (total > 255)
        throw new Error('total must be <= 255');
    if (secret.length === 0)
        throw new Error('empty secret');
    const shares = [];
    for (let i = 1; i <= total; i++) {
        shares.push({
            index: i,
            gen,
            threshold,
            total,
            data: new Uint8Array(secret.length),
        });
    }
    // For each secret byte, build a random degree-(threshold-1) polynomial
    // with constant term = the secret byte, then evaluate at each x.
    for (let b = 0; b < secret.length; b++) {
        const coeffs = new Uint8Array(threshold);
        coeffs[0] = secret[b];
        const rnd = randomBytes(threshold - 1);
        for (let c = 1; c < threshold; c++)
            coeffs[c] = rnd[c - 1];
        for (const share of shares) {
            const x = share.index;
            // Horner's method over GF(256)
            let y = coeffs[threshold - 1];
            for (let c = threshold - 2; c >= 0; c--) {
                y = gmul(y, x) ^ coeffs[c];
            }
            share.data[b] = y;
        }
    }
    return shares;
}
// ---- combine ---------------------------------------------------------------
/**
 * Reconstruct the secret from `shares` (must be >= threshold of the SAME gen).
 * Uses Lagrange interpolation at x=0.
 */
function combine(shares) {
    if (shares.length < 2)
        throw new Error('need at least 2 shares');
    const gen = shares[0].gen;
    const threshold = shares[0].threshold;
    const len = shares[0].data.length;
    for (const s of shares) {
        if (s.gen !== gen)
            throw new Error(`generation mismatch: share gen ${s.gen} != ${gen} (stale share)`);
        if (s.data.length !== len)
            throw new Error('share length mismatch');
    }
    if (shares.length < threshold) {
        throw new Error(`need ${threshold} shares, have ${shares.length}`);
    }
    // Deduplicate by index and take exactly `threshold` shares
    const seen = new Set();
    const use = [];
    for (const s of shares) {
        if (s.index < 1 || s.index > 255)
            throw new Error('invalid share index');
        if (!seen.has(s.index)) {
            seen.add(s.index);
            use.push(s);
            if (use.length === threshold)
                break;
        }
    }
    if (use.length < threshold)
        throw new Error('not enough distinct shares');
    const secret = new Uint8Array(len);
    for (let b = 0; b < len; b++) {
        let acc = 0;
        for (let i = 0; i < use.length; i++) {
            const xi = use[i].index;
            const yi = use[i].data[b];
            // Lagrange basis L_i(0) = prod_{j!=i} (0 - xj)/(xi - xj) = prod xj/(xi^xj)
            let num = 1;
            let den = 1;
            for (let j = 0; j < use.length; j++) {
                if (j === i)
                    continue;
                const xj = use[j].index;
                num = gmul(num, xj); // (0 - xj) == xj in GF(2^n)
                den = gmul(den, xi ^ xj); // (xi - xj) == xi ^ xj
            }
            const basis = gdiv(num, den);
            acc ^= gmul(yi, basis);
        }
        secret[b] = acc;
    }
    return secret;
}
// ---- generation / staleness helpers ---------------------------------------
/** True if all shares share one generation. */
function sameGeneration(shares) {
    if (shares.length === 0)
        return false;
    const g = shares[0].gen;
    return shares.every(s => s.gen === g);
}
