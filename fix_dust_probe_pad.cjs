// fix_dust_probe_pad.cjs — the probe padded its payload with 'xxxx...', which
// the relay's content filter correctly rejects ("prohibited term"). Pad with
// neutral digits so the node's real accept/reject verdict comes through.
const fs = require('fs');
const F = 'Workspace.tsx';
let s = fs.readFileSync(F, 'utf8');
const A = "d: { pad: 'x'.repeat(320) }";
const B = "d: { pad: '0123456789'.repeat(32) }";
const c = s.split(A).length - 1;
if (c !== 1) { console.error('ANCHOR count =', c, '- expected 1 (already fixed?).'); process.exit(1); }
fs.writeFileSync(F, s.split(A).join(B));
console.log('patched: probe pads with digits');
