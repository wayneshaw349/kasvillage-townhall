const SHA512_K = [
  0x428a2f98n, 0xd728ae22n, 0x71374491n, 0x23ef65cdn, 0xb5c0fbcfn, 0xec4d3b2fn, 0xe9b5dba5n, 0x8189dbbcn,
  0x3956c25bn, 0xf348b538n, 0x59f111f1n, 0xb605d019n, 0x923f82a4n, 0xaf194f9bn, 0xab1c5ed5n, 0xda6d8118n,
  0xd807aa98n, 0xa3030242n, 0x12835b01n, 0x45706fben, 0x243185ben, 0x4ee4b28cn, 0x550c7dc3n, 0xd5ffb4e2n,
  0x72be5d74n, 0xf27b896fn, 0x80deb1fen, 0x3b1696b1n, 0x9bdc06a7n, 0x25c71235n, 0xc19bf174n, 0xcf692694n,
  0xe49b69c1n, 0x9ef14ad2n, 0xefbe4786n, 0x384f25e3n, 0x0fc19dc6n, 0x8b8cd5b5n, 0x240ca1ccn, 0x77ac9c65n,
  0x2de92c6fn, 0x592b0275n, 0x4a7484aan, 0x6ea6e483n, 0x5cb0a9dcn, 0xbd41fbd4n, 0x76f988dan, 0x831153b5n,
  0x983e5152n, 0xee66dfabn, 0xa831c66dn, 0x2db43210n, 0xb00327c8n, 0x98fb213fn, 0xbf597fc7n, 0xbeef0ee4n,
  0xc6e00bf3n, 0x3da88fc2n, 0xd5a79147n, 0x930aa725n, 0x06ca6351n, 0xe003826fn, 0x14292967n, 0x0a0e6e70n,
  0x27b70a85n, 0x46d22ffcn, 0x2e1b2138n, 0x5c26c926n, 0x4d2c6dfcn, 0x5ac42aedn, 0x53380d13n, 0x9d95b3dfn,
  0x650a7354n, 0x8baf63den, 0x766a0abbn, 0x3c77b2a8n, 0x81c2c92en, 0x47edaee6n, 0x92722c85n, 0x1482353bn,
  0xa2bfe8a1n, 0x4cf10364n, 0xa81a664bn, 0xbc423001n, 0xc24b8b70n, 0xd0f89791n, 0xc76c51a3n, 0x0654be30n,
  0xd192e819n, 0xd6ef5218n, 0xd6990624n, 0x5565a910n, 0xf40e3585n, 0x5771202an, 0x106aa070n, 0x32bbd1b8n,
  0x19a4c116n, 0xb8d2d0c8n, 0x1e376c08n, 0x5141ab53n, 0x2748774cn, 0xdf8eeb99n, 0x34b0bcb5n, 0xe19b48a8n,
  0x391c0cb3n, 0xc5c95a63n, 0x4ed8aa4an, 0xe3418acbn, 0x5b9cca4fn, 0x7763e373n, 0x682e6ff3n, 0xd6b2b8a3n,
  0x748f82een, 0x5defb2fcn, 0x78a5636fn, 0x43172f60n, 0x84c87814n, 0xa1f0ab72n, 0x8cc70208n, 0x1a6439ecn,
  0x90befffan, 0x23631e28n, 0xa4506cebn, 0xde82bde9n, 0xbef9a3f7n, 0xb2c67915n, 0xc67178f2n, 0xe372532bn,
  0xca273ecen, 0xea26619cn, 0xd186b8c7n, 0x21c0c207n, 0xeada7dd6n, 0xcde0eb1en, 0xf57d4f7fn, 0xee6ed178n,
  0x06f067aan, 0x72176fban, 0x0a637dc5n, 0xa2c898a6n, 0x113f9804n, 0xbef90daen, 0x1b710b35n, 0x131c471bn,
  0x28db77f5n, 0x23047d84n, 0x32caab7bn, 0x40c72493n, 0x3c9ebe0an, 0x15c9bebcn, 0x431d67c4n, 0x9c100d4cn,
  0x4cc5d4ben, 0xcb3e42b6n, 0x597f299cn, 0xfc657e2an, 0x5fcb6fabn, 0x3ad6faecn, 0x6c44198cn, 0x4a475817n,
];

function rotr64(x: bigint, n: bigint): bigint {
  return ((x >> n) | (x << (64n - n))) & 0xFFFFFFFFFFFFFFFFn;
}

function sha512Block(h: bigint[], w: bigint[]): bigint[] {
  let [a, b, c, d, e, f, g, hh] = h;
  const M = 0xFFFFFFFFFFFFFFFFn;

  for (let t = 0; t < 80; t++) {
    if (t >= 16) {
      const s0 = rotr64(w[t-15], 1n) ^ rotr64(w[t-15], 8n) ^ (w[t-15] >> 7n);
      const s1 = rotr64(w[t-2], 19n) ^ rotr64(w[t-2], 61n) ^ (w[t-2] >> 6n);
      w[t] = (w[t-16] + s0 + w[t-7] + s1) & M;
    }
    const S1 = rotr64(e, 14n) ^ rotr64(e, 18n) ^ rotr64(e, 41n);
    const ch = (e & f) ^ (~e & M & g);
    const temp1 = (hh + S1 + ch + SHA512_K[t] + w[t]) & M;
    const S0 = rotr64(a, 28n) ^ rotr64(a, 34n) ^ rotr64(a, 39n);
    const maj = (a & b) ^ (a & c) ^ (b & c);
    const temp2 = (S0 + maj) & M;
    hh = g; g = f; f = e; e = (d + temp1) & M;
    d = c; c = b; b = a; a = (temp1 + temp2) & M;
  }

  return [
    (h[0] + a) & M, (h[1] + b) & M, (h[2] + c) & M, (h[3] + d) & M,
    (h[4] + e) & M, (h[5] + f) & M, (h[6] + g) & M, (h[7] + hh) & M,
  ];
}

function sha512(data: Uint8Array): Uint8Array {
  const M = 0xFFFFFFFFFFFFFFFFn;
  const bitLen = BigInt(data.length * 8);

  // Padding
  const padded: number[] = [...data, 0x80];
  while (padded.length % 128 !== 112) padded.push(0);
  for (let i = 7; i >= 0; i--) padded.push(0); // 64-bit length high (always 0)
  for (let i = 7; i >= 0; i--) padded.push(Number((bitLen >> BigInt(i * 8)) & 0xFFn));

  let h: bigint[] = [
    0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn, 0x3c6ef372fe94f82bn, 0xa54ff53a5f1d36f1n,
    0x510e527fade682d1n, 0x9b05688c2b3e6c1fn, 0x1f83d9abfb41bd6bn, 0x5be0cd19137e2179n,
  ];

  for (let i = 0; i < padded.length; i += 128) {
    const w: bigint[] = [];
    for (let j = 0; j < 16; j++) {
      let val = 0n;
      for (let k = 0; k < 8; k++) {
        val = (val << 8n) | BigInt(padded[i + j * 8 + k]);
      }
      w.push(val);
    }
    for (let j = 16; j < 80; j++) w.push(0n);
    h = sha512Block(h, w);
  }

  const out = new Uint8Array(64);
  for (let i = 0; i < 8; i++) {
    for (let j = 7; j >= 0; j--) {
      out[i * 8 + (7 - j)] = Number((h[i] >> BigInt(j * 8)) & 0xFFn);
    }
  }
  return out;
}

function hmacSha512(key: Uint8Array, data: Uint8Array): Uint8Array {
  const BLOCK = 128;
  let k = key.length > BLOCK ? sha512(key) : new Uint8Array(key);
  if (k.length < BLOCK) {
    const tmp = new Uint8Array(BLOCK);
    tmp.set(k);
    k = tmp;
  }
  const ipad = new Uint8Array(BLOCK + data.length);
  const opad = new Uint8Array(BLOCK + 64);
  for (let i = 0; i < BLOCK; i++) { ipad[i] = k[i] ^ 0x36; opad[i] = k[i] ^ 0x5c; }
  ipad.set(data, BLOCK);
  const inner = sha512(ipad);
  opad.set(inner, BLOCK);
  return sha512(opad);
}

async function pbkdf2HmacSha512(
  password: Uint8Array,
  salt: Uint8Array,
  iterations: number,
  dkLen: number
): Promise<Uint8Array> {
  const hLen = 64;
  const blocks = Math.ceil(dkLen / hLen);
  const dk = new Uint8Array(dkLen);

  for (let i = 1; i <= blocks; i++) {
    const u1salt = new Uint8Array(salt.length + 4);
    u1salt.set(salt);
    u1salt[salt.length]     = (i >> 24) & 0xff;
    u1salt[salt.length + 1] = (i >> 16) & 0xff;
    u1salt[salt.length + 2] = (i >> 8)  & 0xff;
    u1salt[salt.length + 3] =  i        & 0xff;

    let u = hmacSha512(password, u1salt);
    let f = new Uint8Array(u);

    for (let j = 1; j < iterations; j++) {
      u = hmacSha512(password, u);
      for (let k = 0; k < hLen; k++) f[k] ^= u[k];
    }

    dk.set(f.slice(0, Math.min(hLen, dkLen - (i - 1) * hLen)), (i - 1) * hLen);
  }
  return dk;
}
module.exports = { sha512, hmacSha512, pbkdf2HmacSha512 };
