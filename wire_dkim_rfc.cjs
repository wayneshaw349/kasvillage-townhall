// wire_dkim_rfc.cjs — align verifyDKIM with RFC 6376 + add a transfer fingerprint.
// PC test proved proof.txt VALID, so the app side differs. Three fixes:
//  1. Header search restricted to the HEADER BLOCK (text above the first blank
//     line) - the body's quoted "From:/Subject:" lines can never be picked up.
//  2. extractHeader returns the LAST instance (RFC 6376 selects bottom-up);
//     receiving servers prepend their own copies of some signed headers
//     (e.g. x-ms-exchange-senderadcheck), and first-match grabs the wrong one.
//  3. A "Source fingerprint" step: SHA-256 of the normalized paste, shown in
//     the steps list - compare with the PC's fingerprint of proof.txt to
//     prove whether the phone transfer corrupted the text.
// All anchors verified before writing.
const fs = require('fs');
const F = 'dkim_verify.ts';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_DKIM_RFC')) { console.log('already patched'); process.exit(0); }

const edits = [];

// --- 1+3. after the normalize step: header block + fingerprint ---
edits.push([
  "  steps.push('Normalized pasted source (' + rawEmail.length + ' chars)');",
  "  steps.push('Normalized pasted source (' + rawEmail.length + ' chars)');\n  // KV_DKIM_RFC: signed headers live above the first blank line; never search the body.\n  const _hdrEnd = rawEmail.indexOf('\\n\\n');\n  const rawHeaders = _hdrEnd === -1 ? rawEmail : rawEmail.slice(0, _hdrEnd);\n  steps.push('Header block: ' + rawHeaders.length + ' chars');\n  try { const _fp = sha256(new TextEncoder().encode(rawEmail)); steps.push('Source fingerprint: ' + Array.from(_fp.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('')); } catch {}"
]);

// --- 2a. main signing input built from the header block; diagnostic too ---
edits.push([
  "  const signingInput = buildSigningInput(rawEmail, dkim, canonMethod);\n  if (!signingInput) {\n    const _found = dkim.signedHeaders.filter(h => extractHeader(rawEmail, h) !== null);",
  "  const signingInput = buildSigningInput(rawHeaders, dkim, canonMethod);\n  if (!signingInput) {\n    const _found = dkim.signedHeaders.filter(h => extractHeader(rawHeaders, h) !== null);"
]);

// --- 2b. fallback canonicalization: same ---
edits.push([
  "    const altInput = buildSigningInput(rawEmail, dkim, altMethod);",
  "    const altInput = buildSigningInput(rawHeaders, dkim, altMethod);"
]);

// --- 2c. extractHeader: LAST instance wins (RFC 6376 bottom-up selection) ---
edits.push([
  "function extractHeader(rawHeaders: string, name: string): string | null {\n  // Find header by name (case-insensitive), handle multi-line folding\n  const re = new RegExp(\n    '^' + name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + ':\\\\s*(.*(?:\\\\n[ \\\\t]+.*)*)',\n    'im'\n  );\n  const m = rawHeaders.match(re);\n  return m ? m[1].trim() : null;\n}",
  "function extractHeader(rawHeaders: string, name: string): string | null {\n  // KV_DKIM_RFC: RFC 6376 5.4.2 selects header instances bottom-up, so the\n  // LAST occurrence is the signed one - receiving servers prepend their own\n  // copies of some headers above it. (Duplicate names in h= are rare and\n  // still take the last instance here.)\n  const re = new RegExp(\n    '^' + name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + ':\\\\s*(.*(?:\\\\n[ \\\\t]+.*)*)',\n    'img'\n  );\n  let last: RegExpExecArray | null = null, m: RegExpExecArray | null;\n  while ((m = re.exec(rawHeaders)) !== null) last = m;\n  return last ? last[1].trim() : null;\n}"
]);

let ok = true;
for (let i = 0; i < edits.length; i++) {
  const c = s.split(edits[i][0]).length - 1;
  if (c !== 1) { console.error('ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1.'); ok = false; }
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const [a, b] of edits) s = s.replace(a, b);
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: header-block-only search, last-instance selection, source fingerprint');
