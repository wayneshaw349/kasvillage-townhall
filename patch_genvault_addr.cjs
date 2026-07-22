// patch_genvault_addr.cjs — GenerateVaultScreen: persist kv_vault_address on Generate & Activate
const fs = require('fs');
const FILE = 'GenerateVaultScreen.tsx';
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

// --- A: SecureStore import ---
if (!skip('import', /expo-secure-store/.test(s)))
patch('import',
`import { VaultBackupScreen } from './VaultBackupScreen';`,
`import * as SecureStore from 'expo-secure-store';
import { VaultBackupScreen } from './VaultBackupScreen';`);

// --- B: persist kv_vault_address after activation succeeds ---
if (!skip('saveAddr', /kv_vault_address/.test(s)))
patch('saveAddr',
`      setAddress(res.kaspaAddress || w.kaspaAddress);`,
`      const vaultAddr = res.kaspaAddress || w.kaspaAddress;
      try { await SecureStore.setItemAsync('kv_vault_address', vaultAddr); } catch {}
      setAddress(vaultAddr);`);

// --- post-conditions ---
if (!/kv_vault_address/.test(s)) throw new Error('POST: kv_vault_address missing');
if (!/expo-secure-store/.test(s)) throw new Error('POST: SecureStore import missing');
if ((s.match(/setAddress\(vaultAddr\)/g) || []).length !== 1) throw new Error('POST: setAddress rewrite bad');
if (s === orig) { console.log('No changes needed (all applied).'); process.exit(0); }

fs.writeFileSync(FILE, s, 'utf8');
console.log('ALL PATCHES APPLIED — run: npx tsc --noEmit');
