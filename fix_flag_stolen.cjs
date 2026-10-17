// fix_flag_stolen.cjs — add "Stolen / copied" flag reason (republished someone else's work).
// The original's signature + earlier on-chain timestamp is the proof flaggers check.
const fs = require('fs');
const F = 'VillageMailbox.tsx';
let s = fs.readFileSync(F, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
if (s.includes("send('stolen')")) { console.log('already patched'); process.exit(0); }
const A = "        { text: 'Spam / fake', onPress: () => send('spam') },\n";
const c = s.split(A).length - 1;
if (c !== 1) { console.error('ANCHOR count =', c, '- expected 1 (run wire_flags.cjs first)'); process.exit(1); }
s = s.split(A).join(A + "        { text: 'Stolen / copied', onPress: () => send('stolen') },\n");
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: "Stolen / copied" flag reason');
