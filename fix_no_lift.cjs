// fix_no_lift.cjs — no cold-key lift: mod delists are final for that store address.
// A removed owner simply opens a new store that follows the rules.
// Removes the LIFT MOD DELIST button + function from Workspace. (The reader still ignores
// any 'undelist' that isn't signed by the cold key; nothing posts one anymore.)
const fs = require('fs');
const F = 'Workspace.tsx';
let s = fs.readFileSync(F, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
if (!s.includes('KV_MOD_LIFT_UI')) { console.log('lift UI not present - nothing to do'); process.exit(0); }
const FN_RE = /  \/\/ KV_MOD_LIFT_UI: lift a moderator delist \(cold key\)\n  const liftModDelist = \(\) => \{\n[\s\S]*?\n  \};\n(?=  \/\/ KV_SALES_EXPORT)/;
const BTN_RE = /<TouchableOpacity onPress=\{liftModDelist\}[^\n]*\n[ \t]*/;
const nf = (s.match(FN_RE) || []).length, nb = (s.match(BTN_RE) || []).length;
if (nf !== 1 || nb !== 1) { console.error('ANCHOR count fn=' + nf + ' btn=' + nb + ' expected 1/1 - nothing written'); process.exit(1); }
s = s.replace(FN_RE, '').replace(BTN_RE, '');
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: LIFT MOD DELIST removed - mod delists are final per store address');
