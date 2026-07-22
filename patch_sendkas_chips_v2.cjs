// patch_sendkas_chips_v2.cjs — SendKAS: delete PO Box checkbox, add Vault/Hot send-to chips
const fs = require('fs');
const FILE = 'SendKAS.tsx';
let s = fs.readFileSync(FILE, 'utf8');
const orig = s;

const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\n/g, '\\r?\\n');
function patch(name, oldStr, newStr) {
  const re = new RegExp(esc(oldStr), 'g');
  const m = s.match(re);
  if (!m || m.length !== 1) throw new Error(`[${name}] expected 1 match, got ${m ? m.length : 0}`);
  s = s.replace(re, () => newStr);
  console.log(`[${name}] OK`);
}
function patchRe(name, re, newStr) {
  const m = s.match(re);
  if (!m || m.length !== 1) throw new Error(`[${name}] expected 1 match, got ${m ? m.length : 0}`);
  s = s.replace(re, () => newStr);
  console.log(`[${name}] OK`);
}
const b64 = t => Buffer.from(t, 'base64').toString('utf8');
const skip = (name, test) => { if (test) { console.log(`[${name}] already applied, skip`); return true; } return false; };

// --- A: SecureStore import ---
if (!skip('import', /expo-secure-store/.test(s)))
patch('import',
`import * as Clipboard from 'expo-clipboard';`,
`import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';`);

// --- B: chip address state ---
if (!skip('state', /vaultAddr/.test(s)))
patch('state',
`  const [recipientInput, setRecipientInput] = useState(initialAddress || '');`,
`  const [recipientInput, setRecipientInput] = useState(initialAddress || '');
  const [vaultAddr, setVaultAddr] = useState<string | null>(null);
  const [hotAddr, setHotAddr] = useState<string | null>(null);`);

// --- C: load addresses from SecureStore ---
if (!skip('loadAddrs', /kv_vault_address/.test(s)))
patch('loadAddrs',
`  const handlePaste = async () => {`,
b64('ICB1c2VFZmZlY3QoKCkgPT4gewogICAgKGFzeW5jICgpID0+IHsKICAgICAgdHJ5IHsKICAgICAgICBjb25zdCBbdiwgaF0gPSBhd2FpdCBQcm9taXNlLmFsbChbCiAgICAgICAgICBTZWN1cmVTdG9yZS5nZXRJdGVtQXN5bmMoJ2t2X3ZhdWx0X2FkZHJlc3MnKSwKICAgICAgICAgIFNlY3VyZVN0b3JlLmdldEl0ZW1Bc3luYygna3Zfa2FzcGFfYWRkcmVzcycpLAogICAgICAgIF0pOwogICAgICAgIHNldFZhdWx0QWRkcih2KTsKICAgICAgICBzZXRIb3RBZGRyKGgpOwogICAgICB9IGNhdGNoIHt9CiAgICB9KSgpOwogIH0sIFt2aXNpYmxlXSk7CgogIGNvbnN0IGhhbmRsZVBhc3RlID0gYXN5bmMgKCkgPT4gew=='));

// --- D: delete PO Box checkbox block (tolerant, bounded) ---
if (!skip('deletePOBox', !/Use PO Box Address/.test(s)))
patchRe('deletePOBox',
  /\{\/\* PO Box Option \*\/\}[\s\S]*?<\/TouchableOpacity>\s*\)\}\s*(?=\{inputIsStealth)/g,
  '');

// --- E: chips row under "Send To" label ---
if (!skip('chipsRow', /sendToChips\}/.test(s)))
patch('chipsRow',
`                <Text style={styles.inputLabel}>Send To</Text>`,
b64('ICAgICAgICAgICAgICAgIDxUZXh0IHN0eWxlPXtzdHlsZXMuaW5wdXRMYWJlbH0+U2VuZCBUbzwvVGV4dD4KICAgICAgICAgICAgICAgIDxWaWV3IHN0eWxlPXtzdHlsZXMuc2VuZFRvQ2hpcHN9PgogICAgICAgICAgICAgICAgICB7WwogICAgICAgICAgICAgICAgICAgIHsgbGFiZWw6ICdWYXVsdCcsIGFkZHI6IHZhdWx0QWRkciB9LAogICAgICAgICAgICAgICAgICAgIHsgbGFiZWw6ICdIb3QvU2hvcHBpbmcnLCBhZGRyOiBob3RBZGRyIH0sCiAgICAgICAgICAgICAgICAgIF0ubWFwKCh7IGxhYmVsLCBhZGRyIH0pID0+IHsKICAgICAgICAgICAgICAgICAgICBpZiAoIWFkZHIpIHJldHVybiBudWxsOwogICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzU2VsZiA9IGFkZHIgPT09IG15QWRkcmVzczsKICAgICAgICAgICAgICAgICAgICByZXR1cm4gKAogICAgICAgICAgICAgICAgICAgICAgPFRvdWNoYWJsZU9wYWNpdHkKICAgICAgICAgICAgICAgICAgICAgICAga2V5PXtsYWJlbH0KICAgICAgICAgICAgICAgICAgICAgICAgc3R5bGU9e1tzdHlsZXMuc2VuZFRvQ2hpcCwgaXNTZWxmICYmIHN0eWxlcy5zZW5kVG9DaGlwRGlzYWJsZWRdfQogICAgICAgICAgICAgICAgICAgICAgICBkaXNhYmxlZD17aXNTZWxmfQogICAgICAgICAgICAgICAgICAgICAgICBvblByZXNzPXsoKSA9PiBzZXRSZWNpcGllbnRJbnB1dChhZGRyKX0KICAgICAgICAgICAgICAgICAgICAgID4KICAgICAgICAgICAgICAgICAgICAgICAgPFRleHQgc3R5bGU9e1tzdHlsZXMuc2VuZFRvQ2hpcFRleHQsIGlzU2VsZiAmJiBzdHlsZXMuc2VuZFRvQ2hpcFRleHREaXNhYmxlZF19PgogICAgICAgICAgICAgICAgICAgICAgICAgIHtsYWJlbH17aXNTZWxmID8gJyAodGhpcyB3YWxsZXQpJyA6ICcnfQogICAgICAgICAgICAgICAgICAgICAgICA8L1RleHQ+CiAgICAgICAgICAgICAgICAgICAgICA8L1RvdWNoYWJsZU9wYWNpdHk+CiAgICAgICAgICAgICAgICAgICAgKTsKICAgICAgICAgICAgICAgICAgfSl9CiAgICAgICAgICAgICAgICA8L1ZpZXc+'));

// --- F: chip styles ---
if (!skip('styles', /sendToChip:/.test(s)))
patch('styles',
`  quickAmountText: { fontSize: rs.font(11), fontWeight: 'bold', color: COLORS.stone600 },`,
`  quickAmountText: { fontSize: rs.font(11), fontWeight: 'bold', color: COLORS.stone600 },
  sendToChips: { flexDirection: 'row', gap: rs.s(8), marginBottom: rs.s(8) },
  sendToChip: { backgroundColor: COLORS.amber100, borderRadius: rs.s(8), paddingHorizontal: rs.s(12), paddingVertical: rs.s(6), borderWidth: 1, borderColor: COLORS.amber500 },
  sendToChipDisabled: { backgroundColor: COLORS.stone100, borderColor: COLORS.stone300 },
  sendToChipText: { fontSize: rs.font(12), fontWeight: 'bold', color: COLORS.amber700 },
  sendToChipTextDisabled: { color: COLORS.stone400 },`);

// --- post-conditions ---
if (/Use PO Box Address/.test(s)) throw new Error('POST: PO Box checkbox still present');
if ((s.match(/sendToChips/g) || []).length !== 2) throw new Error('POST: sendToChips count != 2');
if (!/expo-secure-store/.test(s)) throw new Error('POST: SecureStore import missing');
if (!/\{inputIsStealth && \(/.test(s)) throw new Error('POST: stealth auto-banner damaged');
if (s === orig) { console.log('No changes needed (all applied).'); process.exit(0); }

fs.writeFileSync(FILE, s, 'utf8');
console.log('ALL PATCHES APPLIED — run: npx tsc --noEmit');
