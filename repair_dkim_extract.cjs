// repair_dkim_extract.cjs — fixes the corruption wire_dkim_rfc.cjs caused in
// extractHeader: the replacement text contained the sequence $& which
// String.replace expands to the matched text, splicing the OLD function into
// the middle of the new one (-> "Unterminated string constant" at 338).
// This repair cuts everything between the first 'function extractHeader('
// and 'function buildSigningInput(' and writes the clean function by slice
// concatenation - no String.replace, so no $-pattern expansion is possible.
const fs = require('fs');
const F = 'dkim_verify.ts';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

const start = s.indexOf('function extractHeader(');
const end = s.indexOf('function buildSigningInput(');
const cBuild = s.split('function buildSigningInput(').length - 1;
if (start === -1 || end === -1 || start >= end || cBuild !== 1) {
  console.error('boundaries wrong (start=' + start + ' end=' + end + ' buildCount=' + cBuild + '). Aborting.');
  process.exit(1);
}

const clean = [
  'function extractHeader(rawHeaders: string, name: string): string | null {',
  '  // KV_DKIM_RFC: RFC 6376 5.4.2 selects header instances bottom-up, so the',
  '  // LAST occurrence is the signed one - receiving servers prepend their own',
  '  // copies of some headers above it.',
  '  const re = new RegExp(',
  "    '^' + name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + ':\\\\s*(.*(?:\\\\n[ \\\\t]+.*)*)',",
  "    'img'",
  '  );',
  '  let last: RegExpExecArray | null = null;',
  '  let m: RegExpExecArray | null;',
  '  while ((m = re.exec(rawHeaders)) !== null) last = m;',
  '  return last ? last[1].trim() : null;',
  '}',
  '',
  '',
].join('\n');

s = s.slice(0, start) + clean + s.slice(end);
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('repaired: extractHeader rebuilt clean (last-instance, img).');
console.log('sanity: extractHeader count =', s.split('function extractHeader(').length - 1, '(expect 1)');
