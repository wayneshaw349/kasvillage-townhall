const fs = require('fs');
const p = 'frost_complete.ts';
let src = fs.readFileSync(p, 'utf8');
const EOL = src.includes('\r\n') ? '\r\n' : '\n';
let lines = src.split(/\r?\n/);
function die(m){ console.error('[B2] ABORT - ' + m + ' (nothing written)'); process.exit(1); }

// 1) default export: strip 2 entries (string-guarded)
let c = src.split('  createPartialSigLocal, aggregatePartialSigs,').length - 1;
if (c !== 1) die('default-export line 1297: expected 1, found ' + c);
c = src.split('completeFrost2Round, cleanup,').length - 1;
if (c !== 1) die('default-export line 1302: expected 1, found ' + c);
src = src.replace('  createPartialSigLocal, aggregatePartialSigs,', '  aggregatePartialSigs,');
src = src.replace('completeFrost2Round, cleanup,', 'cleanup,');
lines = src.split(/\r?\n/);

// 2) locate each fn by signature, absorb preceding jsdoc, cut to first bare }
const sigs = [
  'export function generateFrostNonce(params: {',
  'export function computeFrostPartialS(params: {',
  'export function aggregateFrostSig(params: {',
  'export function createPartialSigLocal(params: {',
  'export async function createFrostPartialSig(params: {',
  'export async function completeFrostAndBroadcast(params: {',
  'export async function completeFrost2Round(params: {',
];
const ranges = [];
for (const sig of sigs) {
  const idxs = lines.map((l,i)=>[l,i]).filter(x=>x[0].startsWith(sig)).map(x=>x[1]);
  if (idxs.length !== 1) die('sig "' + sig.slice(0,50) + '" found ' + idxs.length + 'x');
  let s = idxs[0];
  // absorb jsdoc directly above (/** ... */) and blank lines
  let a = s - 1;
  while (a >= 0 && lines[a].trim() === '') a--;
  if (a >= 0 && lines[a].trim() === '*/') {
    let j = a;
    while (j >= 0 && !lines[j].trim().startsWith('/**')) j--;
    if (j >= 0 && s - j < 12) s = j;
  }
  // scan forward for first bare }
  let e = -1;
  for (let i = idxs[0]; i < lines.length; i++) {
    if (lines[i].replace(/\s+$/,'') === '}') { e = i; break; }
  }
  if (e < 0) die('no bare } after ' + sig.slice(0,40));
  if (e - idxs[0] > 300) die('suspicious span ' + (e - idxs[0]) + ' for ' + sig.slice(0,40));
  ranges.push([s, e]);
}
// no overlaps
ranges.sort((x,y)=>x[0]-y[0]);
for (let i=1;i<ranges.length;i++) if (ranges[i][0] <= ranges[i-1][1]) die('overlapping ranges');
// splice descending
ranges.sort((x,y)=>y[0]-x[0]);
for (const [s,e] of ranges) lines.splice(s, e - s + 1);
src = lines.join(EOL);

// 3) top protocol comment + FrostNonce interface (string-anchored)
const topRe = /\/\/ =+\r?\n\/\/ FROST 2-of-2 BIP340[\s\S]*?export interface FrostNonce \{[\s\S]*?\r?\n\}\r?\n/;
if (!topRe.test(src)) die('top comment + FrostNonce interface block not found');
src = src.replace(topRe, '');

// 4) orphaned 2-ROUND header
src = src.replace(/\/\/ =+\r?\n\/\/ 2-ROUND FROST COMPLETION[^\r\n]*\r?\n\/\/ =+\r?\n/, '');

// post-conditions
for (const n of ['generateFrostNonce','aggregateFrostSig','createPartialSigLocal','computeFrostPartialS','createFrostPartialSig','completeFrostAndBroadcast','completeFrost2Round','FrostNonce']) {
  if (src.indexOf(n) !== -1) die('"' + n + '" still present after deletion');
}
for (const k of ['export function aggregatePartialSigs','deriveAggregatePubkey','aggregateToAddress','export function cleanup','validateEscrowDestination','deriveFrostAddressLocal','generateVerificationCode','inscribeFrostEvent']) {
  if (src.indexOf(k) === -1) die('keeper "' + k + '" was LOST');
}
fs.writeFileSync(p, src, 'utf8');
console.log('[B2] OK - 7 dead functions + FrostNonce interface + headers deleted.');