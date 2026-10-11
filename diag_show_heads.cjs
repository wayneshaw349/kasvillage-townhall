// diag_show_heads.cjs — extend the [GamesLane] done log to name every head in
// byHead and every head that survived the filter, so the mystery second
// listing identifies itself.
const fs = require('fs');
const F = 'VillageMailbox.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('shownHeads')) { console.log('already patched'); process.exit(0); }

const A = "          try { console.log('[GamesLane] done: shown=' + items.length + ' delists=' + delistByHead.size + ' heads=' + Array.from(delistByHead.keys()).map((h: string) => h.slice(0, 8)).join(',')); } catch {}";
const c = s.split(A).length - 1;
if (c !== 1) { console.error('ANCHOR count =', c, '- expected 1. Aborting.'); process.exit(1); }

const B = "          try { console.log('[GamesLane] done: shown=' + items.length + ' delists=' + delistByHead.size + ' delistHeads=' + Array.from(delistByHead.keys()).map((h: string) => h.slice(0, 8)).join(',') + ' | allHeads=' + Array.from(byHead.keys()).map((h: string) => h.slice(0, 8)).join(',') + ' | shownHeads=' + items.map((i: any) => String(i.quad.head).slice(0, 8) + '(t=' + i.t + ',o=' + String(i.o).slice(0, 8) + ')').join(',')); } catch {}";

s = s.replace(A, B);
if (CRLF) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync(F, s);
console.log('patched: done log now names all heads + survivors');
