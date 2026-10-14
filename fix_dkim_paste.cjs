// fix_dkim_paste.cjs — make verifyDKIM paste-tolerant.
// "Failed to build signing input" = extractHeader found NONE of the signed
// headers. extractHeader anchors each header name to line start; pasted text
// that traveled through notes/email apps arrives with mangled line endings,
// NBSPs, zero-width chars, or leading indentation on header lines - so every
// lookup misses. Fixes:
//  1. KV_PASTE_NORMALIZE at the top of verifyDKIM: CRLF/CR -> LF, strip
//     NBSP + zero-width chars, and un-indent lines that look like header
//     starts ("Token:" after leading whitespace - real RFC folding
//     continuations don't look like that). Body edits are harmless here:
//     this verifier signs over headers only (bh= rides inside the signed
//     DKIM-Signature header).
//  2. The failure message now says WHICH signed headers were found, so the
//     next failure diagnoses itself from the phone screen.
const fs = require('fs');
const F = 'dkim_verify.ts';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_PASTE_NORMALIZE')) { console.log('already patched'); process.exit(0); }

// --- 1. normalize pasted source before anything parses it ---
const A1 = "export async function verifyDKIM(rawEmail: string): Promise<DKIMResult> {\n  const steps: string[] = [];";
const c1 = s.split(A1).length - 1;
if (c1 !== 1) { console.error('ANCHOR 1 count =', c1, '- expected 1. Aborting.'); process.exit(1); }
const B1 = "export async function verifyDKIM(rawEmail: string): Promise<DKIMResult> {\n  const steps: string[] = [];\n\n  // KV_PASTE_NORMALIZE: pasted sources arrive mangled by mail/notes apps.\n  // Line endings -> LF, NBSP -> space, zero-width chars stripped, and lines\n  // that start with whitespace followed by a header name ('Token:') are\n  // un-indented - genuine folded continuations never look like a header start.\n  rawEmail = String(rawEmail || '')\n    .replace(/\\u00A0/g, ' ')\n    .replace(/[\\u200B-\\u200D\\uFEFF]/g, '')\n    .replace(/\\r\\n?/g, '\\n')\n    .replace(/\\n[ \\t]+(?=[A-Za-z][A-Za-z0-9-]*:[ \\t])/g, '\\n');\n  steps.push('Normalized pasted source (' + rawEmail.length + ' chars)');";

// --- 2. self-diagnosing failure message ---
const A2 = "  const signingInput = buildSigningInput(rawEmail, dkim, canonMethod);\n  if (!signingInput) {\n    return { verified: false, domain: dkim.domain, error: 'Failed to build signing input', steps };\n  }";
const c2 = s.split(A2).length - 1;
if (c2 !== 1) { console.error('ANCHOR 2 count =', c2, '- expected 1. Aborting.'); process.exit(1); }
const B2 = "  const signingInput = buildSigningInput(rawEmail, dkim, canonMethod);\n  if (!signingInput) {\n    const _found = dkim.signedHeaders.filter(h => extractHeader(rawEmail, h) !== null);\n    return { verified: false, domain: dkim.domain, error: 'Failed to build signing input - found ' + _found.length + '/' + dkim.signedHeaders.length + ' signed headers' + (_found.length ? ' (' + _found.join(', ') + ')' : '') + '. The paste may be missing the header block.', steps };\n  }";

s = s.replace(A1, B1).replace(A2, B2);
if (CRLF) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync(F, s);
console.log('patched: verifyDKIM normalizes pasted source; failure names the missing headers');
