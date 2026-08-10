const { sha256 } = require('@noble/hashes/sha256');
const { utf8ToBytes } = require('@noble/hashes/utils');
const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
function kaspaPolymod(values) {
  let c = 1n;
  for (const d of values) {
    const c0 = c >> 35n;
    c = ((c & 0x07fffffffffn) << 5n) ^ BigInt(d);
    if (c0 & 0x01n) c ^= 0x98f2bc8e61n;
    if (c0 & 0x02n) c ^= 0x79b76d99e2n;
    if (c0 & 0x04n) c ^= 0xf33e5fb3c4n;
    if (c0 & 0x08n) c ^= 0xae2eabe2a8n;
    if (c0 & 0x10n) c ^= 0x1e4f43e470n;
  }
  return c ^ 1n;
}
function kaspaConv8to5(payload) {
  const result = []; let buff = 0, bits = 0;
  for (const c of payload) {
    buff = (buff << 8) | c; bits += 8;
    while (bits >= 5) { bits -= 5; result.push((buff >> bits) & 31); buff &= (1 << bits) - 1; }
  }
  if (bits > 0) result.push((buff << (5 - bits)) & 31);
  return result;
}
function xOnlyToKaspaAddress(xOnly, hrp) {
  const fullPayload = [0, ...Array.from(xOnly)];
  const fivebitPayload = kaspaConv8to5(fullPayload);
  const fivebitPrefix = Array.from(hrp).map(c => c.charCodeAt(0) & 0x1f);
  const checksumInput = [...fivebitPrefix, 0, ...fivebitPayload, 0,0,0,0,0,0,0,0];
  const cs = kaspaPolymod(checksumInput);
  const csBytes = [];
  for (let i = 4; i >= 0; i--) csBytes.push(Number((cs >> BigInt(i * 8)) & 0xFFn));
  const cs5bit = kaspaConv8to5(csBytes);
  let addr = hrp + ':';
  for (const d of [...fivebitPayload, ...cs5bit]) addr += BECH32_CHARSET[d];
  return addr;
}
function reg(cat) {
  return xOnlyToKaspaAddress(sha256(utf8ToBytes(`KV-REGISTRY-V1-${cat.toLowerCase()}`)), 'kaspatest');
}
console.log('store:', reg('store'));
console.log('node :', reg('node'));
