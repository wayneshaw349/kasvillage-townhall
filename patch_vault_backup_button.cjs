#!/usr/bin/env node
// Surfaces the Vault Backup button in ProfileScreen + wires the prop in AppNaviagator.
// 3 edits across 2 files. Count-guarded, CRLF-tolerant, idempotent, no writes on abort.
// Usage:  node patch_vault_backup_button.cjs
//   (expects ProfileScreen.tsx and AppNaviagator.tsx in the current dir)
const fs = require('fs');
const EDITS = JSON.parse(Buffer.from('W3sibiI6MSwiZmlsZSI6IlVISnZabWxzWlZOamNtVmxiaTUwYzNnPSIsImYiOiJiMjVPWVhacFoyRjBaVlJ2ZDI1SVlXeHNQem9nS0NrZ1BUNGdkbTlwWkRzZ2IyNU9ZWFpwWjJGMFpVSnZiMnR6YUdWc1pqODZJQ2dwSUQwK0lIWnZhV1FnZlQ0Z1BTQW9leUJ1WVhacFoyRjBhVzl1TENCdmJrNWhkbWxuWVhSbFJXNTBaWEowWVdsdWJXVnVkQ3dnYjI1T1lYWnBaMkYwWlZSdmQyNUlZV3hzTENCdmJrNWhkbWxuWVhSbFFtOXZhM05vWld4bUlIMHBJRDArSUhzSyIsInIiOiJiMjVPWVhacFoyRjBaVlJ2ZDI1SVlXeHNQem9nS0NrZ1BUNGdkbTlwWkRzZ2IyNU9ZWFpwWjJGMFpVSnZiMnR6YUdWc1pqODZJQ2dwSUQwK0lIWnZhV1E3SUc5dVRtRjJhV2RoZEdWV1lYVnNkRUpoWTJ0MWNEODZJQ2dwSUQwK0lIWnZhV1FnZlQ0Z1BTQW9leUJ1WVhacFoyRjBhVzl1TENCdmJrNWhkbWxuWVhSbFJXNTBaWEowWVdsdWJXVnVkQ3dnYjI1T1lYWnBaMkYwWlZSdmQyNUlZV3hzTENCdmJrNWhkbWxuWVhSbFFtOXZhM05vWld4bUxDQnZiazVoZG1sbllYUmxWbUYxYkhSQ1lXTnJkWEFnZlNrZ1BUNGdld289IiwiZCI6ImIyNU9ZWFpwWjJGMFpWWmhkV3gwUW1GamEzVndQem9nS0NrZ1BUNGdkbTlwWkNCOVBnPT0ifSx7Im4iOjIsImZpbGUiOiJVSEp2Wm1sc1pWTmpjbVZsYmk1MGMzZz0iLCJmIjoiSUNBZ0lDQWdJQ0FnSUR4VWIzVmphR0ZpYkdWUGNHRmphWFI1Q2lBZ0lDQWdJQ0FnSUNBZ0lITjBlV3hsUFh0emRIbHNaWE11YzJWbFpFVjRjRzl5ZEVKMWRIUnZibjBLSUNBZ0lDQWdJQ0FnSUNBZ2IyNVFjbVZ6Y3oxN2FHRnVaR3hsUlhod2IzSjBVMlZsWkgwSyIsInIiOiJJQ0FnSUNBZ0lDQWdJRHhVYjNWamFHRmliR1ZQY0dGamFYUjVDaUFnSUNBZ0lDQWdJQ0FnSUhOMGVXeGxQWHR6ZEhsc1pYTXVjMlZsWkVWNGNHOXlkRUoxZEhSdmJuMEtJQ0FnSUNBZ0lDQWdJQ0FnYjI1UWNtVnpjejE3S0NrZ1BUNGdiMjVPWVhacFoyRjBaVlpoZFd4MFFtRmphM1Z3UHk0b0tYMEtJQ0FnSUNBZ0lDQWdJRDRLSUNBZ0lDQWdJQ0FnSUNBZ1BGWnBaWGNnYzNSNWJHVTllM3NnWm14bGVEb2dNU0I5ZlQ0S0lDQWdJQ0FnSUNBZ0lDQWdJQ0E4VkdWNGRDQnpkSGxzWlQxN2MzUjViR1Z6TG5ObFpXUkZlSEJ2Y25SVVpYaDBmVDd3bjVTUUlGWmhkV3gwSUVKaFkydDFjQ0FvVVZJZ1kyRnlaSE1wUEM5VVpYaDBQZ29nSUNBZ0lDQWdJQ0FnSUNBZ0lEeFVaWGgwSUhOMGVXeGxQWHR6ZEhsc1pYTXVjMlZsWkVWNGNHOXlkRk4xWW4wK1UzQnNhWFFnZVc5MWNpQnpaV1ZrSUdsdWRHOGdNaTF2WmkwMElISmxZMjkyWlhKNUlHTmhjbVJ6UEM5VVpYaDBQZ29nSUNBZ0lDQWdJQ0FnSUNBOEwxWnBaWGMrQ2lBZ0lDQWdJQ0FnSUNBOEwxUnZkV05vWVdKc1pVOXdZV05wZEhrK0NpQWdJQ0FnSUNBZ0lDQThWRzkxWTJoaFlteGxUM0JoWTJsMGVRb2dJQ0FnSUNBZ0lDQWdJQ0J6ZEhsc1pUMTdjM1I1YkdWekxuTmxaV1JGZUhCdmNuUkNkWFIwYjI1OUNpQWdJQ0FnSUNBZ0lDQWdJRzl1VUhKbGMzTTllMmhoYm1Sc1pVVjRjRzl5ZEZObFpXUjlDZz09IiwiZCI6IlZtRjFiSFFnUW1GamEzVndJQ2hSVWlCallYSmtjeWs9In0seyJuIjozLCJmaWxlIjoiUVhCd1RtRjJhV0ZuWVhSdmNpNTBjM2c9IiwiZiI6IklDQWdJQ0FnSUNCdmJrNWhkbWxuWVhSbFFtOXZhM05vWld4bVBYc29LU0E5UGlCelpYUlRZM0psWlc0b0oyVnVkR1Z5ZEdGcGJtMWxiblFuS1gwS0lDQWdJQ0FnTHo0N0NnPT0iLCJyIjoiSUNBZ0lDQWdJQ0J2Yms1aGRtbG5ZWFJsUW05dmEzTm9aV3htUFhzb0tTQTlQaUJ6WlhSVFkzSmxaVzRvSjJWdWRHVnlkR0ZwYm0xbGJuUW5LWDBLSUNBZ0lDQWdJQ0J2Yms1aGRtbG5ZWFJsVm1GMWJIUkNZV05yZFhBOWUyOXdaVzVXWVhWc2RFSmhZMnQxY0gwS0lDQWdJQ0FnTHo0N0NnPT0iLCJkIjoiYjI1T1lYWnBaMkYwWlZaaGRXeDBRbUZqYTNWd1BYdHZjR1Z1Vm1GMWJIUkNZV05yZFhCOSJ9XQ==', 'base64').toString('utf8'));
const b64 = (x) => Buffer.from(x, 'base64').toString('utf8');
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\r?\n/g, '\r?\n');

// group edits by file; validate ALL before writing ANY
const byFile = {};
for (const e of EDITS) { const f = b64(e.file); (byFile[f] = byFile[f] || []).push(e); }

const planned = {};
for (const [file, edits] of Object.entries(byFile)) {
  let s;
  try { s = fs.readFileSync(file, 'utf8'); }
  catch { console.error('[ABORT] cannot read ' + file); process.exit(1); }
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  for (const e of edits) {
    const find = b64(e.f), repl = b64(e.r), done = b64(e.d);
    if (s.includes(done)) { console.log('[skip] ' + file + ' edit ' + e.n + ' already applied.'); continue; }
    const re = new RegExp(esc(find), 'g');
    const count = (s.match(re) || []).length;
    if (count !== 1) { console.error('[ABORT] ' + file + ' edit ' + e.n + ': anchor found ' + count + ' times (expected 1). No writes.'); process.exit(1); }
    s = s.replace(new RegExp(esc(find)), repl.replace(/\r?\n/g, eol));
    console.log('[ok]   ' + file + ' edit ' + e.n + ' staged.');
  }
  planned[file] = s;
}

for (const [file, content] of Object.entries(planned)) fs.writeFileSync(file, content);

// post-conditions
const ps = fs.readFileSync('ProfileScreen.tsx', 'utf8');
const an = fs.readFileSync('AppNaviagator.tsx', 'utf8');
const okAll =
  ps.includes('onNavigateVaultBackup?: () => void }>') &&
  /onNavigateVaultBackup \}\) =>/.test(ps.replace(/\s+/g,' ')) === false ? true : true; // (loose)
const checks = [
  ['ProfileScreen prop type', ps.includes('onNavigateVaultBackup?: () => void }>')],
  ['ProfileScreen destructure', ps.includes(', onNavigateVaultBackup }) =>')],
  ['ProfileScreen button', ps.includes('Vault Backup (QR cards)')],
  ['AppNaviagator prop pass', an.includes('onNavigateVaultBackup={openVaultBackup}')],
];
const bad = checks.filter(c => !c[1]).map(c => c[0]);
if (bad.length) { console.error('[WARN] post-condition unmet: ' + JSON.stringify(bad)); process.exit(1); }
console.log('[done] Vault Backup button wired. Re-run: npx tsc --noEmit');
