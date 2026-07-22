#!/usr/bin/env node
// Count-guarded, CRLF-tolerant, idempotent inserter for mnemonicToEntropy().
// Usage:  node patch_bip39_mnemonicToEntropy.cjs [path\to\bip39_wallet.ts]
const fs = require('fs');
const FILE = process.argv[2] || 'bip39_wallet.ts';
const PAYLOAD = Buffer.from('LyoqCiAqIEludmVyc2Ugb2YgZW50cm9weVRvTW5lbW9uaWM6IHJlY292ZXIgdGhlIDE2LWJ5dGUgZW50cm9weSBmcm9tIGEgMTItd29yZAogKiBtbmVtb25pYy4gUHVyZSB3b3JkbGlzdCBtYXRoIOKAlCBzeW5jaHJvbm91cywgbm8gY3J5cHRvLiBEb2VzIE5PVCB2ZXJpZnkgdGhlCiAqIGNoZWNrc3VtICh1c2UgdmFsaWRhdGVNbmVtb25pYygpIGZvciB0aGF0KS4gVGhyb3dzIG9uIHdyb25nIHdvcmQgY291bnQgb3IgYW4KICogdW5rbm93biB3b3JkLgogKi8KZXhwb3J0IGZ1bmN0aW9uIG1uZW1vbmljVG9FbnRyb3B5KG1uZW1vbmljOiBzdHJpbmcpOiBVaW50OEFycmF5IHsKICBjb25zdCB3b3JkcyA9IG1uZW1vbmljLnRyaW0oKS50b0xvd2VyQ2FzZSgpLnNwbGl0KC9ccysvKTsKICBpZiAod29yZHMubGVuZ3RoICE9PSAxMikgewogICAgdGhyb3cgbmV3IEVycm9yKGBtbmVtb25pY1RvRW50cm9weSByZXF1aXJlcyAxMiB3b3JkcywgZ290ICR7d29yZHMubGVuZ3RofWApOwogIH0KICBsZXQgYml0cyA9ICcnOwogIGZvciAoY29uc3QgdyBvZiB3b3JkcykgewogICAgY29uc3QgaWR4ID0gV09SRExJU1QuaW5kZXhPZih3KTsKICAgIGlmIChpZHggPCAwKSB0aHJvdyBuZXcgRXJyb3IoYHVua25vd24gQklQMzkgd29yZDogJHt3fWApOwogICAgYml0cyArPSBpZHgudG9TdHJpbmcoMikucGFkU3RhcnQoMTEsICcwJyk7CiAgfQogIGNvbnN0IGVudHJvcHlCaXRzID0gYml0cy5zbGljZSgwLCAxMjgpOyAvLyBkcm9wIHRoZSA0IGNoZWNrc3VtIGJpdHMKICBjb25zdCBlbnRyb3B5ID0gbmV3IFVpbnQ4QXJyYXkoMTYpOwogIGZvciAobGV0IGkgPSAwOyBpIDwgMTY7IGkrKykgewogICAgZW50cm9weVtpXSA9IHBhcnNlSW50KGVudHJvcHlCaXRzLnNsaWNlKGkgKiA4LCAoaSArIDEpICogOCksIDIpOwogIH0KICByZXR1cm4gZW50cm9weTsKfQo=', 'base64').toString('utf8');

let s = fs.readFileSync(FILE, 'utf8');
const eol = s.includes('\r\n') ? '\r\n' : '\n';

// idempotency
if (/export function mnemonicToEntropy/.test(s)) {
  console.log('[skip] mnemonicToEntropy already present — no change.');
  process.exit(0);
}

// CRLF-tolerant anchor: the SECTION 4 header block
const anchorText =
  '// ============================================================================\n' +
  '// SECTION 4: MNEMONIC \u2192 SEED (BIP39 PBKDF2)\n' +
  '// ============================================================================';
const anchorRe = new RegExp(anchorText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\n/g, '\r?\n'));

const m = s.match(anchorRe);
const count = (s.match(new RegExp(anchorRe.source, 'g')) || []).length;
if (count !== 1) { console.error('[abort] SECTION 4 anchor found ' + count + ' times (expected 1).'); process.exit(1); }

const payload = PAYLOAD.replace(/\n/g, eol).replace(/[\r\n]+$/, '');
s = s.replace(anchorRe, payload + eol + eol + m[0]);

// post-conditions
const pc1 = (s.match(/export function mnemonicToEntropy/g) || []).length;
const pc2 = /mnemonicToEntropy requires 12 words/.test(s);
if (pc1 !== 1 || !pc2) { console.error('[abort] post-condition failed (fn=' + pc1 + ', msg=' + pc2 + ').'); process.exit(1); }

fs.writeFileSync(FILE, s);
console.log('[ok] inserted mnemonicToEntropy into ' + FILE + ' (eol=' + JSON.stringify(eol) + ').');
