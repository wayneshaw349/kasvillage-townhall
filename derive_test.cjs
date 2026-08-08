// derive_test.cjs — prove that frostAddr is recomputable from (pubkeys, counter, agrId).
//
// If this reproduces kaspatest:qp0asvly... then a record carrying frostCounter can be
// checked by any stranger: the address is no longer a claim, it is a derivation. That
// kills the borrowed-anchor forgery (pointing a fabricated record at some unrelated
// address that happens to have been spent).
//
// Tries every plausible L variant because the ceremony calls deriveAggregateKey with
// counter only, while proposal-time derivation may have included agreementId.

const EXPECT   = 'kaspatest:qp0asvly78j2t2j4xnrplmumfuvjnlq568x6qxghlll43zysf8ne736rtz73r';
const PUB_A    = '02e9c450fc541f388eb3c0292401560115c56029137ad8207c4875f7d0f296424f';
const PUB_B    = '037d42aac927f9fad639cd0b479b3e921951d90361fd2e1e05d184f8122bf17133';
const COUNTER  = 2141252532;
const AGR_ID   = 'AGR_0e0075a7680d';
const NETWORK  = 'testnet-10';

const N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
const hexToBytes = (h) => { const a = new Uint8Array(h.length / 2); for (let i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; };
const bytesToHex = (b) => Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
const mod = (a, m) => ((a % m) + m) % m;

(async () => {
  const { secp256k1 } = await import('@noble/curves/secp256k1');
  const { sha256 } = await import('@noble/hashes/sha256');

  function computeL(pk1, pk2, counter, agreementId) {
    const counterBytes = counter && counter > 0 ? new TextEncoder().encode(String(counter)) : new Uint8Array(0);
    const agrBytes = agreementId ? new TextEncoder().encode(agreementId) : new Uint8Array(0);
    return sha256(new Uint8Array([...hexToBytes(pk1), ...hexToBytes(pk2), ...agrBytes, ...counterBytes]));
  }

  const bindingCoefficient = (L, pk) =>
    mod(BigInt('0x' + bytesToHex(sha256(new Uint8Array([...L, ...hexToBytes(pk)])))), N);

  function deriveAggregateKey(pubkeyA, pubkeyB, counter, agreementId) {
    const [pk1, pk2] = [pubkeyA, pubkeyB].sort();
    const L = computeL(pk1, pk2, counter, agreementId);
    const P1 = secp256k1.ProjectivePoint.fromHex(pk1);
    const P2 = secp256k1.ProjectivePoint.fromHex(pk2);
    const Pagg = P1.multiply(bindingCoefficient(L, pk1)).add(P2.multiply(bindingCoefficient(L, pk2)));
    return bytesToHex(Pagg.toRawBytes(true)).slice(2);
  }

  function deriveAddress(aggXOnly, network) {
    const prefix = network === 'mainnet' ? 'kaspa' : 'kaspatest';
    const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    function polymod(values) {
      let c = 1n;
      for (const d of values) {
        const c0 = c >> 35n;
        c = ((c & 0x07fffffffffn) << 5n) ^ BigInt(d);
        if (c0 & 1n) c ^= 0x98f2bc8e61n;
        if (c0 & 2n) c ^= 0x79b76d99e2n;
        if (c0 & 4n) c ^= 0xf33e5fb3c4n;
        if (c0 & 8n) c ^= 0xae2eabe2a8n;
        if (c0 & 0x10n) c ^= 0x1e4f43e470n;
      }
      return c ^ 1n;
    }
    function conv8to5(payload) {
      const result = []; let buffer = 0, bits = 0;
      for (const byte of payload) {
        buffer = (buffer << 8) | byte; bits += 8;
        while (bits >= 5) { bits -= 5; result.push((buffer >> bits) & 31); buffer &= (1 << bits) - 1; }
      }
      if (bits > 0) result.push((buffer << (5 - bits)) & 31);
      return result;
    }
    const xOnly = hexToBytes(aggXOnly);
    const fp5 = conv8to5([0, ...Array.from(xOnly)]);
    const pfx5 = Array.from(prefix).map(c => c.charCodeAt(0) & 0x1f);
    const cs = polymod([...pfx5, 0, ...fp5, 0, 0, 0, 0, 0, 0, 0, 0]);
    const csB = []; for (let i = 4; i >= 0; i--) csB.push(Number((cs >> BigInt(i * 8)) & 0xffn));
    let addr = prefix + ':';
    for (const d of [...fp5, ...conv8to5(csB)]) addr += CHARSET[d];
    return addr;
  }

  const variants = [
    ['counter only',            COUNTER,   undefined],
    ['counter + agrId',         COUNTER,   AGR_ID],
    ['agrId only',              0,         AGR_ID],
    ['neither',                 0,         undefined],
  ];

  console.log('expect:', EXPECT, '\n');
  let hit = null;
  for (const [label, ctr, agr] of variants) {
    const got = deriveAddress(deriveAggregateKey(PUB_A, PUB_B, ctr, agr), NETWORK);
    const ok = got === EXPECT;
    console.log((ok ? 'MATCH  ' : '       ') + label.padEnd(18) + got);
    if (ok) hit = label;
  }

  console.log('\n' + (hit
    ? 'RESULT: frostAddr is reproducible via "' + hit + '". Record needs: pubkeys + ' +
      (hit.includes('counter') ? 'frostCounter' : '') + (hit.includes('agrId') ? (hit.includes('counter') ? ' + agrId' : ' agrId') : '') + '.'
    : 'RESULT: no variant matched - the ceremony used different inputs. Do NOT ship the check until this reproduces.'));
})();
