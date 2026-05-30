const fs = require('fs');
let f = fs.readFileSync('NeighborAgreement.tsx', 'utf8');
const old = "console.log('[Neighbor] Restoring session at step', session.step);";
const idx = f.indexOf(old);
if (idx < 0) { console.log('Already patched or not found'); process.exit(0); }
const newLine = "console.log('[Neighbor] SKIP auto-restore — use inbox'); return;";
f = f.replace(old, newLine);
fs.writeFileSync('NeighborAgreement.tsx', f);
console.log('Auto-restore disabled — inbox is entry point');
console.log('Emojis:', (f.match(/[\u{1F000}-\u{1FFFF}]/gu) || []).length);
