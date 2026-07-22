// patch_sendkas_frostchip.cjs — SendKAS: add third "FROST Vault" send-to chip
// Reads kv_frost_vault_address (written by VaultSetupScreen). Anchors target the
// exact code produced by patch_sendkas_chips_v2.cjs.
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
const skip = (name, test) => { if (test) { console.log(`[${name}] already applied, skip`); return true; } return false; };

// --- A: frostAddr state ---
if (!skip('state', /frostAddr/.test(s)))
patch('state',
`  const [hotAddr, setHotAddr] = useState<string | null>(null);`,
`  const [hotAddr, setHotAddr] = useState<string | null>(null);
  const [frostAddr, setFrostAddr] = useState<string | null>(null);`);

// --- B: load kv_frost_vault_address in the existing effect ---
if (!skip('load', /kv_frost_vault_address/.test(s)))
patch('load',
`        const [v, h] = await Promise.all([
          SecureStore.getItemAsync('kv_vault_address'),
          SecureStore.getItemAsync('kv_kaspa_address'),
        ]);
        setVaultAddr(v);
        setHotAddr(h);`,
`        const [v, h, fr] = await Promise.all([
          SecureStore.getItemAsync('kv_vault_address'),
          SecureStore.getItemAsync('kv_kaspa_address'),
          SecureStore.getItemAsync('kv_frost_vault_address'),
        ]);
        setVaultAddr(v);
        setHotAddr(h);
        setFrostAddr(fr);`);

// --- C: third chip entry ---
if (!skip('chip', /FROST Vault/.test(s)))
patch('chip',
`                    { label: 'Hot/Shopping', addr: hotAddr },`,
`                    { label: 'Hot/Shopping', addr: hotAddr },
                    { label: 'FROST Vault', addr: frostAddr },`);

// --- post-conditions ---
if ((s.match(/kv_frost_vault_address/g) || []).length !== 1) throw new Error('POST: frost key count != 1');
if (!/FROST Vault/.test(s)) throw new Error('POST: FROST chip missing');
if (!/setFrostAddr\(fr\)/.test(s)) throw new Error('POST: setFrostAddr missing');
if (s === orig) { console.log('No changes needed (all applied).'); process.exit(0); }

fs.writeFileSync(FILE, s, 'utf8');
console.log('ALL PATCHES APPLIED — run: npx tsc --noEmit');
