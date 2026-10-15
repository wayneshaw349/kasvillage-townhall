// fix_anchor_ui.cjs — Fetch Anchors reports its result on the button itself:
// "Anchored n (checkmark)" when it stamped something, "All anchored (checkmark)" when
// everything already has its header. No Metro needed.
const fs = require('fs');
const F = 'PhoneProofScreen.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_PHONE_LOCAL3')) { console.log('already patched'); process.exit(0); }

const edits = [
  [
`  const [chainCopied, setChainCopied] = useState(false);`,
`  const [chainCopied, setChainCopied] = useState(false);
  const [anchorMsg, setAnchorMsg] = useState(''); // KV_PHONE_LOCAL3`,
  ],
  [
`      console.log('[PhoneProof] anchors backfilled:', _n, 'headers refetched:', _f);`,
`      console.log('[PhoneProof] anchors backfilled:', _n, 'headers refetched:', _f);
      setAnchorMsg((_n + _f) > 0 ? 'Anchored ' + (_n + _f) + ' \\u2713' : 'All anchored \\u2713');
      setTimeout(() => setAnchorMsg(''), 4000);`,
  ],
  [
`<Text style={{ color: C.muted, fontSize: rs.font(11), fontWeight: 'bold' }}>Fetch Anchors</Text>`,
`<Text style={{ color: anchorMsg ? C.primary : C.muted, fontSize: rs.font(11), fontWeight: 'bold' }}>{anchorMsg || 'Fetch Anchors'}</Text>`,
  ],
];

let ok = true;
for (let i = 0; i < edits.length; i++) {
  const c = s.split(edits[i][0]).length - 1;
  if (c !== 1) { console.error('ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1.'); ok = false; }
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const [a, b] of edits) s = s.split(a).join(b);
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: Fetch Anchors shows its result on the button');
