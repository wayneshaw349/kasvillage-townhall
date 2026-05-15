const { secp256k1 } = require('@noble/curves/secp256k1');
const { sha384 } = require('@noble/hashes/sha512');
const { keccak_256 } = require('@noble/hashes/sha3');
const { concatBytes } = require('@noble/hashes/utils');
const crypto = require('crypto');
const https = require('https');

function avroLong(v) {
  let n = v >= 0 ? v * 2 : (-v) * 2 - 1;
  const bytes = [];
  while (n > 0x7f) { bytes.push((n & 0x7f) | 0x80); n >>>= 7; }
  bytes.push(n & 0x7f);
  return new Uint8Array(bytes);
}

function w64LE(v) {
  const b = new Uint8Array(8);
  b[0] = v & 0xff; b[1] = (v >> 8) & 0xff;
  b[2] = (v >> 16) & 0xff; b[3] = (v >> 24) & 0xff;
  return b;
}

async function deepHash(items) {
  const enc = new TextEncoder();
  let h = sha384(concatBytes(
    sha384(enc.encode('list')),
    sha384(enc.encode(items.length.toString()))
  ));
  for (const item of items) {
    const blobTag = enc.encode('blob' + item.length);
    const itemHash = sha384(concatBytes(sha384(blobTag), sha384(item)));
    h = sha384(concatBytes(h, itemHash));
  }
  return h;
}

async function main() {
  const privHex = crypto.randomBytes(32).toString('hex');
  const priv = Buffer.from(privHex, 'hex');
  const pub = secp256k1.getPublicKey(priv, false); // 65 bytes uncompressed
  const enc = new TextEncoder();

  const tags = [
    { name: 'App-Name', value: 'KasVillage' },
    { name: 'Content-Type', value: 'application/json' },
    { name: 'KV-Type', value: 'test' },
  ];

  // Avro-serialize tags
  const tagParts = [avroLong(tags.length)];
  for (const t of tags) {
    const n = enc.encode(t.name);
    const v = enc.encode(t.value);
    tagParts.push(avroLong(n.length), n, avroLong(v.length), v);
  }
  tagParts.push(avroLong(0));
  let serializedTags = new Uint8Array(0);
  for (const p of tagParts) serializedTags = concatBytes(serializedTags, p);

  const data = enc.encode(JSON.stringify({
    test: 'KasVillage PowerShell Arweave test',
    timestamp: Date.now(),
  }));

  const SIG_TYPE = new Uint8Array([3, 0]);

  // Deep hash
  const toSign = await deepHash([
    enc.encode('dataitem'),
    enc.encode('1'),
    enc.encode('3'),
    pub,
    new Uint8Array(0),
    new Uint8Array(0),
    serializedTags,
    data,
  ]);

  // EIP-191 Ethereum message signing
  // \x19 = byte 0x19 = char code 25
  const prefix = Buffer.concat([
    Buffer.from([0x19]),
    Buffer.from('Ethereum Signed Message:\n' + toSign.length),
  ]);
  const ethHash = keccak_256(concatBytes(new Uint8Array(prefix), toSign));

  const sig = secp256k1.sign(ethHash, priv);
  const sigBytes = new Uint8Array(65);
  sigBytes.set(sig.toCompactRawBytes(), 0);
  sigBytes[64] = sig.recovery + 27;

  // Build data item
  const item = concatBytes(
    SIG_TYPE, sigBytes, pub,
    new Uint8Array([0]), new Uint8Array([0]),
    w64LE(tags.length), w64LE(serializedTags.length),
    serializedTags, data,
  );

  console.log('Item size:', item.length, 'bytes');
  console.log('Sig type:', SIG_TYPE[0]);
  console.log('Pubkey len:', pub.length);
  console.log('Tags:', tags.length, 'serialized:', serializedTags.length, 'bytes');

  // Upload to Turbo
  const buf = Buffer.from(item);
  const req = https.request({
    hostname: 'turbo.ardrive.io',
    path: '/v1/tx',
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': buf.length,
    },
  }, (res) => {
    let body = '';
    res.on('data', (d) => body += d);
    res.on('end', () => {
      console.log('\nStatus:', res.statusCode);
      if (res.statusCode === 200) {
        const j = JSON.parse(body);
        console.log('TX ID:', j.id);
        console.log('URL: https://arweave.net/' + j.id);
        console.log('SUCCESS - Arweave write confirmed!');
      } else {
        console.log('Error:', body.slice(0, 300));
      }
    });
  });
  req.on('error', (e) => console.log('Network error:', e.message));
  req.write(buf);
  req.end();
}

main().catch(console.error);
