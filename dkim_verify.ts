// ============================================================================
// dkim_verify.ts — On-Device DKIM Verification
// ============================================================================
// Zero PII leaves the device. Only network call = DNS-over-HTTPS for public key.
// RSA verification done entirely in JS via BigInt math.
// ============================================================================

import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

// ============================================================================
// TYPES
// ============================================================================

export interface DKIMFields {
  version: string;       // v=1
  algorithm: string;     // a=rsa-sha256
  domain: string;        // d=university.edu
  selector: string;      // s=google (or s=20230601)
  canonicalization: string; // c=relaxed/relaxed
  signedHeaders: string[];  // h=from:to:subject:date
  bodyHash: string;      // bh=base64
  signature: string;     // b=base64
  timestamp?: number;    // t=unix
}

export interface DKIMResult {
  verified: boolean;
  domain: string;
  error?: string;
  steps: string[];  // audit trail of what happened
}

// ============================================================================
// 1. PARSE DKIM-Signature HEADER
// ============================================================================

export function parseDKIMSignature(rawHeaders: string): DKIMFields | null {
  // Find DKIM-Signature header (may span multiple lines with folding)
  const dkimMatch = rawHeaders.match(
    /DKIM-Signature:\s*([\s\S]*?)(?=\n[^\s\t]|$)/i
  );
  if (!dkimMatch) return null;

  // Unfold (remove line breaks + leading whitespace)
  const raw = dkimMatch[1].replace(/\r?\n[ \t]+/g, ' ').trim();

  const getField = (key: string): string => {
    const re = new RegExp(key + '\\s*=\\s*([^;]+)', 'i');
    const m = raw.match(re);
    return m ? m[1].trim() : '';
  };

  const domain = getField('d');
  const selector = getField('s');
  const signature = getField('b').replace(/\s+/g, '');
  const bodyHash = getField('bh').replace(/\s+/g, '');

  if (!domain || !selector || !signature) return null;

  return {
    version: getField('v') || '1',
    algorithm: getField('a') || 'rsa-sha256',
    domain,
    selector,
    canonicalization: getField('c') || 'relaxed/relaxed',
    signedHeaders: (getField('h') || '').split(':').map(h => h.trim().toLowerCase()).filter(Boolean),
    bodyHash,
    signature,
    timestamp: parseInt(getField('t')) || undefined,
  };
}

// ============================================================================
// 2. DNS-OVER-HTTPS LOOKUP
// ============================================================================

export async function lookupDKIMPublicKey(
  selector: string,
  domain: string
): Promise<{ publicKeyB64: string; keyType: string } | null> {
  const name = `${selector}._domainkey.${domain}`;

  // Try Google DoH first, Cloudflare as fallback
  const endpoints = [
    `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=TXT`,
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`,
  ];

  for (const url of endpoints) {
    try {
      const resp = await fetch(url, {
        headers: { Accept: 'application/dns-json' },
      });
      if (!resp.ok) continue;
      const data = await resp.json();

      if (!data.Answer || data.Answer.length === 0) continue;

      // TXT records may be split across multiple strings
      for (const answer of data.Answer) {
        const txt = (answer.data || '')
          .replace(/^"|"$/g, '')
          .replace(/"\s*"/g, ''); // join split TXT records

        if (txt.includes('p=')) {
          const pMatch = txt.match(/p=([A-Za-z0-9+/=\s]+)/);
          const kMatch = txt.match(/k=([a-zA-Z0-9]+)/);
          if (pMatch) {
            return {
              publicKeyB64: pMatch[1].replace(/\s+/g, ''),
              keyType: kMatch ? kMatch[1] : 'rsa',
            };
          }
        }
      }
    } catch (e) {
      console.warn('[DKIM] DoH lookup failed for', url, e);
      continue;
    }
  }

  return null;
}

// ============================================================================
// 3. BASE64 + ASN.1 PARSING
// ============================================================================

function b64ToBytes(b64: string): Uint8Array {
  // Handle both standard and URL-safe base64
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, '');
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i += 4) {
    const a = chars.indexOf(clean[i]);
    const b = chars.indexOf(clean[i + 1]);
    const c = chars.indexOf(clean[i + 2]);
    const d = chars.indexOf(clean[i + 3]);

    bytes.push((a << 2) | (b >> 4));
    if (clean[i + 2] !== '=') bytes.push(((b & 15) << 4) | (c >> 2));
    if (clean[i + 3] !== '=') bytes.push(((c & 3) << 6) | d);
  }

  return new Uint8Array(bytes);
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex.length > 0 ? BigInt('0x' + hex) : 0n;
}

interface RSAPublicKey {
  n: bigint; // modulus
  e: bigint; // exponent
}

// Parse PKCS#8 or PKCS#1 DER-encoded RSA public key
function parseRSAPublicKey(derBytes: Uint8Array): RSAPublicKey | null {
  try {
    let offset = 0;

    const readTag = () => derBytes[offset++];
    const readLength = (): number => {
      let len = derBytes[offset++];
      if (len & 0x80) {
        const numBytes = len & 0x7f;
        len = 0;
        for (let i = 0; i < numBytes; i++) {
          len = (len << 8) | derBytes[offset++];
        }
      }
      return len;
    };

    const readInteger = (): bigint => {
      const tag = readTag();
      if (tag !== 0x02) throw new Error('Expected INTEGER tag 0x02, got 0x' + tag.toString(16));
      const len = readLength();
      const bytes = derBytes.slice(offset, offset + len);
      offset += len;
      return bytesToBigInt(bytes);
    };

    const skipSequence = () => {
      const tag = readTag();
      if (tag !== 0x30) throw new Error('Expected SEQUENCE tag 0x30');
      readLength();
    };

    // PKCS#8: SEQUENCE { SEQUENCE { OID, NULL }, BIT STRING { SEQUENCE { INTEGER, INTEGER } } }
    // PKCS#1: SEQUENCE { INTEGER, INTEGER }
    const firstTag = derBytes[0];
    if (firstTag !== 0x30) return null;

    offset = 0;
    skipSequence(); // outer SEQUENCE

    // Check if next is SEQUENCE (PKCS#8) or INTEGER (PKCS#1)
    if (derBytes[offset] === 0x30) {
      // PKCS#8 — skip algorithm identifier
      skipSequence();
      const innerLen = readLength(); // skip OID etc
      offset += innerLen - 2; // approximate skip (OID + NULL)

      // Actually, let's be more precise: re-parse
      offset = 0;
      skipSequence(); // outer

      // Read algorithm identifier sequence
      const algTag = readTag();
      if (algTag === 0x30) {
        const algLen = readLength();
        offset += algLen; // skip entire algorithm sequence
      }

      // BIT STRING
      const bsTag = readTag();
      if (bsTag === 0x03) {
        const bsLen = readLength();
        offset++; // skip the "unused bits" byte (0x00)
      }

      // Inner SEQUENCE with n, e
      skipSequence();
      const n = readInteger();
      const e = readInteger();
      return { n, e };
    } else if (derBytes[offset] === 0x02) {
      // PKCS#1 — direct INTEGER, INTEGER
      const n = readInteger();
      const e = readInteger();
      return { n, e };
    }

    return null;
  } catch (e) {
    console.warn('[DKIM] RSA key parse failed:', e);
    return null;
  }
}

// ============================================================================
// 4. RSA PKCS#1 v1.5 VERIFICATION (BigInt math)
// ============================================================================

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  base = base % mod;
  while (exp > 0n) {
    if (exp % 2n === 1n) {
      result = (result * base) % mod;
    }
    exp = exp / 2n;
    base = (base * base) % mod;
  }
  return result;
}

// SHA-256 DigestInfo prefix (DER encoded)
const SHA256_DIGEST_INFO = new Uint8Array([
  0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86,
  0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01, 0x05,
  0x00, 0x04, 0x20,
]);

function rsaVerifyPKCS1(
  signature: Uint8Array,
  messageHash: Uint8Array,
  key: RSAPublicKey
): boolean {
  try {
    // signature^e mod n
    const sigInt = bytesToBigInt(signature);
    const decrypted = modPow(sigInt, key.e, key.n);

    // Convert back to bytes
    const nByteLen = Math.ceil(key.n.toString(16).length / 2);
    let decHex = decrypted.toString(16);
    while (decHex.length < nByteLen * 2) decHex = '0' + decHex;

    const decBytes = new Uint8Array(decHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));

    // PKCS#1 v1.5: 0x00 0x01 [0xFF padding] 0x00 [DigestInfo] [Hash]
    if (decBytes[0] !== 0x00 || decBytes[1] !== 0x01) return false;

    // Find the 0x00 separator after FF padding
    let sepIdx = 2;
    while (sepIdx < decBytes.length && decBytes[sepIdx] === 0xff) sepIdx++;
    if (sepIdx >= decBytes.length || decBytes[sepIdx] !== 0x00) return false;
    sepIdx++; // skip the 0x00

    // Check DigestInfo
    const remaining = decBytes.slice(sepIdx);
    if (remaining.length < SHA256_DIGEST_INFO.length + 32) return false;

    for (let i = 0; i < SHA256_DIGEST_INFO.length; i++) {
      if (remaining[i] !== SHA256_DIGEST_INFO[i]) return false;
    }

    // Compare hash
    const extractedHash = remaining.slice(SHA256_DIGEST_INFO.length, SHA256_DIGEST_INFO.length + 32);
    for (let i = 0; i < 32; i++) {
      if (extractedHash[i] !== messageHash[i]) return false;
    }

    return true;
  } catch (e) {
    console.warn('[DKIM] RSA verify failed:', e);
    return false;
  }
}

// ============================================================================
// 5. DKIM HEADER CANONICALIZATION
// ============================================================================

function canonicalizeHeaderRelaxed(name: string, value: string): string {
  // relaxed: lowercase header name, unfold, compress whitespace
  const n = name.toLowerCase().trim();
  const v = value
    .replace(/\r?\n[ \t]+/g, ' ')  // unfold
    .replace(/[ \t]+/g, ' ')        // compress whitespace
    .replace(/[ \t]+$/gm, '')       // trim trailing
    .trim();
  return n + ':' + v;
}

function extractHeader(rawHeaders: string, name: string): string | null {
  // Find header by name (case-insensitive), handle multi-line folding
  const re = new RegExp(
    '^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':\\s*(.*(?:\\n[ \\t]+.*)*)',
    'im'
  );
  const m = rawHeaders.match(re);
  return m ? m[1].trim() : null;
}

function buildSigningInput(
  rawHeaders: string,
  dkim: DKIMFields,
  method: string
): string {
  const lines: string[] = [];

  // Add each signed header in order
  for (const headerName of dkim.signedHeaders) {
    const value = extractHeader(rawHeaders, headerName);
    if (value !== null) {
      if (method === 'relaxed') {
        lines.push(canonicalizeHeaderRelaxed(headerName, value));
      } else {
        lines.push(headerName + ': ' + value);
      }
    }
  }

  // Add the DKIM-Signature header itself, with b= value emptied
  const dkimHeader = extractHeader(rawHeaders, 'DKIM-Signature');
  if (dkimHeader) {
    const stripped = dkimHeader.replace(/b=[^;]*(;|$)/, 'b=$1');
    if (method === 'relaxed') {
      lines.push(canonicalizeHeaderRelaxed('dkim-signature', stripped));
    } else {
      lines.push('DKIM-Signature: ' + stripped);
    }
  }

  return lines.join('\r\n');
}

// ============================================================================
// 6. MAIN VERIFY FUNCTION
// ============================================================================

export async function verifyDKIM(rawEmail: string): Promise<DKIMResult> {
  const steps: string[] = [];

  // Step 1: Parse DKIM-Signature
  steps.push('Parsing DKIM-Signature header...');
  const dkim = parseDKIMSignature(rawEmail);
  if (!dkim) {
    return { verified: false, domain: '', error: 'No DKIM-Signature header found', steps };
  }
  steps.push(`Found: domain=${dkim.domain}, selector=${dkim.selector}, algo=${dkim.algorithm}`);

  // Only support rsa-sha256
  if (!dkim.algorithm.includes('sha256')) {
    return { verified: false, domain: dkim.domain, error: 'Only rsa-sha256 supported, got: ' + dkim.algorithm, steps };
  }

  // Must be .edu
  if (!dkim.domain.endsWith('.edu')) {
    return { verified: false, domain: dkim.domain, error: 'Domain ' + dkim.domain + ' is not a .edu address', steps };
  }

  // Step 2: DNS lookup for public key
  steps.push(`DNS lookup: ${dkim.selector}._domainkey.${dkim.domain}`);
  const keyData = await lookupDKIMPublicKey(dkim.selector, dkim.domain);
  if (!keyData) {
    return { verified: false, domain: dkim.domain, error: 'DKIM public key not found in DNS. The school may not publish DKIM keys, or the selector may be wrong.', steps };
  }
  steps.push(`Public key found (${keyData.keyType}, ${keyData.publicKeyB64.length} chars)`);

  // Step 3: Parse RSA public key
  steps.push('Parsing RSA public key...');
  const keyBytes = b64ToBytes(keyData.publicKeyB64);
  const rsaKey = parseRSAPublicKey(keyBytes);
  if (!rsaKey) {
    return { verified: false, domain: dkim.domain, error: 'Failed to parse RSA public key from DNS', steps };
  }
  steps.push(`RSA key parsed: ${rsaKey.n.toString(16).length * 4}-bit modulus`);

  // Step 4: Build signing input
  steps.push('Canonicalizing headers...');
  const canonMethod = dkim.canonicalization.split('/')[0] || 'relaxed';
  const signingInput = buildSigningInput(rawEmail, dkim, canonMethod);
  if (!signingInput) {
    return { verified: false, domain: dkim.domain, error: 'Failed to build signing input', steps };
  }

  // Step 5: Hash and verify
  steps.push('Computing SHA-256 hash...');
  const inputBytes = new TextEncoder().encode(signingInput);
  const messageHash = sha256(inputBytes);

  steps.push('Verifying RSA signature...');
  const sigBytes = b64ToBytes(dkim.signature);
  const verified = rsaVerifyPKCS1(sigBytes, messageHash, rsaKey);

  if (verified) {
    steps.push('✓ DKIM signature VALID for ' + dkim.domain);
  } else {
    steps.push('✗ DKIM signature verification failed');
    // Common reason: header canonicalization mismatch
    // Try the other method as fallback
    const altMethod = canonMethod === 'relaxed' ? 'simple' : 'relaxed';
    steps.push('Trying ' + altMethod + ' canonicalization...');
    const altInput = buildSigningInput(rawEmail, dkim, altMethod);
    const altHash = sha256(new TextEncoder().encode(altInput));
    const altVerified = rsaVerifyPKCS1(sigBytes, altHash, rsaKey);
    if (altVerified) {
      steps.push('✓ DKIM signature VALID with ' + altMethod + ' canonicalization');
      return { verified: true, domain: dkim.domain, steps };
    }
  }

  return {
    verified,
    domain: dkim.domain,
    error: verified ? undefined : 'RSA signature did not match. The email headers may be modified or incomplete.',
    steps,
  };
}

// ============================================================================
// 7. CONVENIENCE: Quick domain check (no full verify, just parse)
// ============================================================================

export function quickDomainCheck(rawHeaders: string): string | null {
  const dkim = parseDKIMSignature(rawHeaders);
  if (!dkim || !dkim.domain.endsWith('.edu')) return null;
  return dkim.domain;
}
