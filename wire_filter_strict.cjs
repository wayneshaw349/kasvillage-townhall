// wire_filter_strict.cjs — stricter reader-side content filter.
// content_filter.ts gains scanObjectStrict(obj): runs your original scanObject first, then
// (a) leetspeak-normalized re-scan with your own scanText, (b) adult / weapons / scam / gambling
// rules with word boundaries. Both call sites (directory entries in kaspa_payload, store configs in
// VillageMailbox) switch to scanObjectStrict. Your original rules are untouched.
const fs = require('fs');
const EXTRA = `

// KV_FILTER_STRICT: extra reader-side rules on top of scanObject (word-boundary, leet-normalized)
const KV_LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };
function kvNormalize(t: string): string {
  return String(t || '').toLowerCase().replace(/[013457@$!]/g, (c) => KV_LEET[c] || c).replace(/[^a-z0-9\\s]+/g, ' ').replace(/\\s+/g, ' ').trim();
}
const KV_STRICT_RULES: Array<[string, RegExp]> = [
  ['adult', /\\b(porn|porno|xxx|nsfw|escort service|escorts|hookup|nude pics|sex cam|cam girl|onlyfans leak)\\b/],
  ['weapons', /\\b(ghost gun|auto sear|glock switch|unregistered (firearm|gun)s?|untraceable (firearm|gun)s?|explosives for sale|buy explosives|pipe bomb|grenades?|full auto conversion)\\b/],
  ['scam', /\\b(send \\d+(\\.\\d+)? ?kas get \\d+|double your (kas|crypto|money)|guaranteed (returns?|profit)|seed phrase|recovery phrase|private key|airdrop claim|giveaway send)\\b/],
  ['illegal_trade', /\\b(cocaine|coke|heroin|meth|crystal meth|fentanyl|mdma|ecstasy|molly|xanax|oxy|oxycodone|percocet|percs|ketamine|lsd|shrooms)\\b[^.!?]{0,25}\\b(deals?|plug|menu|connect|wholesale|by the (gram|oz|ounce|pound)|grams?|zips?)\\b/],
  ['gambling', /\\b(casino|sportsbook|roulette|sports betting|bet now|online betting|slot machines?|lottery tickets?)\\b/],
];
function kvSquash(n: string): string {
  // join runs of single-character tokens: 's e e d p h r a s e' -> 'seedphrase'
  const t = n.split(' '); const o: string[] = []; let run = '';
  for (const w of t) { if (w.length === 1) run += w; else { if (run) { o.push(run); run = ''; } o.push(w); } }
  if (run) o.push(run);
  return o.join(' ');
}
function kvWalkStrings(o: any, path: string, out: Array<[string, string]>, depth: number = 0) {
  if (depth > 8 || o == null) return;
  if (typeof o === 'string') { out.push([path, o]); return; }
  if (Array.isArray(o)) { o.forEach((v, i) => kvWalkStrings(v, path + '[' + i + ']', out, depth + 1)); return; }
  if (typeof o === 'object') for (const k of Object.keys(o)) kvWalkStrings(o[k], path + '.' + k, out, depth + 1);
}
export function scanObjectStrict(obj: any): any {
  const base: any = scanObject(obj);
  if (!base || base.ok === false) return base;
  const strs: Array<[string, string]> = [];
  kvWalkStrings(obj, '', strs);
  for (const [p, s] of strs) {
    const n = kvNormalize(s);
    if (n !== String(s).toLowerCase()) {
      try { const r2: any = (scanText as any)(n); if (r2 && r2.ok === false) return { ...r2, path: p, leet: true }; } catch {}
    }
    const raw = String(s).toLowerCase().replace(/\\s+/g, ' '); // keeps digits (leet map would turn 100 into ioo)
    const nL = kvNormalize(String(s).replace(/1/g, 'l')); // '1' can stand for l as well as i
    const sq = kvSquash(n); // s e e d / f.e.n.t.a.n.y.l -> joined
    if (sq !== n) { try { const r3: any = (scanText as any)(sq); if (r3 && r3.ok === false) return { ...r3, path: p, spaced: true }; } catch {} }
    for (const [reason, re] of KV_STRICT_RULES) if (re.test(n) || re.test(nL) || re.test(raw) || re.test(sq)) return { ok: false, reason, path: p };
  }
  return base;
}
`;
const jobs = [
  { f: 'content_filter.ts', marker: 'KV_FILTER_STRICT', append: EXTRA, edits: [
    ['  /\\b(12|24)\\s*words?\\b/i,\n', '  /\\b(12|24)[\\s-]*words?\\b[^.!?]{0,30}\\b(phrase|seed|recovery|backup|wallet)\\b/i, // KV_PHISH_FP: was any 12/24 words\n  /\\b(enter|type|paste|submit|share|send)\\s+(your\\s+|the\\s+)?(12|24)[\\s-]*words?\\b/i,\n'],
    ['  /\\bmnemonic\\b/i,\n', '  /\\bmnemonic\\s+(phrase|words?|seed|code|backup)\\b/i, // KV_PHISH_FP: was any mnemonic\n  /\\b(enter|type|paste|submit|share|send)\\s+(your\\s+|the\\s+)?mnemonic\\b/i,\n'],
  ], check: (s) => /export function scanObject\b/.test(s) && /export function scanText\b/.test(s) },
  { f: 'kaspa_payload.ts', marker: 'scanObjectStrict', swap: true },
  { f: 'VillageMailbox.tsx', marker: 'scanObjectStrict', swap: true },
];
const A = "const { scanObject } = require('./content_filter');";
const B = "const _cfm = require('./content_filter'); const scanObject = _cfm.scanObjectStrict || _cfm.scanObject;";
let ok = true; const staged = [];
for (const j of jobs) {
  let s = fs.readFileSync(j.f, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes(j.marker)) { console.log(j.f + ': already patched - skipping'); continue; }
  if (j.check && !j.check(s)) { console.error(j.f + ': scanObject/scanText not declared as "export function" - paste their declaration lines'); ok = false; }
  if (j.swap) { j.n = s.split(A).length - 1; if (j.n < 1) { console.error(j.f + ': scan call site not found'); ok = false; } }
  for (const [a] of (j.edits || [])) { const c = s.split(a).length - 1; if (c !== 1) { console.error(j.f + ' rule ANCHOR count ' + c + ' expected 1: ' + a.trim()); ok = false; } }
  staged.push({ ...j, s, CRLF });
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const j of staged) {
  let s = j.s;
  for (const [a, b] of (j.edits || [])) s = s.split(a).join(b);
  if (j.append) s = s.replace(/\s*$/, '') + j.append;
  if (j.swap) s = s.split(A).join(B);
  fs.writeFileSync(j.f, j.CRLF ? s.replace(/\n/g, '\r\n') : s);
  console.log(j.f + ': patched' + (j.swap ? ' (' + j.n + ' call site(s) -> strict)' : ''));
}
console.log('DONE - strict reader-side filter live. Re-run: node test_content_filter.cjs');
