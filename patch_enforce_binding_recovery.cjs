#!/usr/bin/env node
// Enforce identity-bound recovery: VaultRecoveryScreen -> recoverAndVerify, and
// make openVaultBackup produce identity-bound cards too (one format everywhere).
// 4 edits / 2 files. Count-guarded, CRLF-tolerant, idempotent, per-file all-or-nothing.
// Usage:  node patch_enforce_binding_recovery.cjs
//   (expects VaultRecoveryScreen.tsx + AppNaviagator.tsx in cwd)
const fs=require('fs');
const EDITS=JSON.parse(Buffer.from('W3sibiI6MSwiZmlsZSI6IlZtRjFiSFJTWldOdmRtVnllVk5qY21WbGJpNTBjM2c9IiwiZiI6ImFXMXdiM0owSUhzZ2NtVmpiM1psY2sxdVpXMXZibWxqUm5KdmJWTm9ZWEpsY3lCOUlHWnliMjBnSnk0dmQyRnNiR1YwWDNOb1lXMXBjbDlpWVdOcmRYQW5Pd289IiwiciI6ImFXMXdiM0owSUhzZ2NtVmpiM1psY2tGdVpGWmxjbWxtZVNCOUlHWnliMjBnSnk0dmRtRjFiSFJmWjJWdVpYSmhkRzl5SnpzSyIsImQiOiJhVzF3YjNKMElIc2djbVZqYjNabGNrRnVaRlpsY21sbWVTQjlJR1p5YjIwZ0p5NHZkbUYxYkhSZloyVnVaWEpoZEc5eUp6cz0ifSx7Im4iOjIsImZpbGUiOiJWbUYxYkhSU1pXTnZkbVZ5ZVZOamNtVmxiaTUwYzNnPSIsImYiOiJJQ0FnSUNBZ0lDQWdJR052Ym5OMElHMXVaVzF2Ym1saklEMGdZWGRoYVhRZ2NtVmpiM1psY2sxdVpXMXZibWxqUm5KdmJWTm9ZWEpsY3lodVpYaDBMbTFoY0NoaklEMCtJR011ZDJseVpTa3BPd289IiwiciI6IklDQWdJQ0FnSUNBZ0lHTnZibk4wSUhKbGMzUnZjbVZrSUQwZ1lYZGhhWFFnY21WamIzWmxja0Z1WkZabGNtbG1lU2h1WlhoMExtMWhjQ2hqSUQwK0lHTXVkMmx5WlNrcE93b2dJQ0FnSUNBZ0lDQWdZMjl1YzNRZ2JXNWxiVzl1YVdNZ1BTQnlaWE4wYjNKbFpDNXRibVZ0YjI1cFl6c0siLCJkIjoiWTI5dWMzUWdjbVZ6ZEc5eVpXUWdQU0JoZDJGcGRDQnlaV052ZG1WeVFXNWtWbVZ5YVdaNSJ9LHsibiI6MywiZmlsZSI6IlFYQndUbUYyYVdGbllYUnZjaTUwYzNnPSIsImYiOiJhVzF3YjNKMElIc2dZM0psWVhSbFRXNWxiVzl1YVdOQ1lXTnJkWEFnZlNCbWNtOXRJQ2N1TDNkaGJHeGxkRjl6YUdGdGFYSmZZbUZqYTNWd0p6c0siLCJyIjoiYVcxd2IzSjBJSHNnWTNKbFlYUmxTV1JsYm5ScGRIbENiM1Z1WkVKaFkydDFjQ0I5SUdaeWIyMGdKeTR2ZG1GMWJIUmZaMlZ1WlhKaGRHOXlKenNLIiwiZCI6ImFXMXdiM0owSUhzZ1kzSmxZWFJsU1dSbGJuUnBkSGxDYjNWdVpFSmhZMnQxY0NCOUlHWnliMjBnSnk0dmRtRjFiSFJmWjJWdVpYSmhkRzl5SnpzPSJ9LHsibiI6NCwiZmlsZSI6IlFYQndUbUYyYVdGbllYUnZjaTUwYzNnPSIsImYiOiJJQ0FnSUNBZ1kyOXVjM1FnWW1GamEzVndJRDBnWVhkaGFYUWdZM0psWVhSbFRXNWxiVzl1YVdOQ1lXTnJkWEFvYlc1bGJXOXVhV01zSURRcE95QXZMeUF5TFc5bUxUUUtJQ0FnSUNBZ2MyVjBWbUYxYkhSWGFYSmxjeWhpWVdOcmRYQXVkMmx5WlhNcE93bz0iLCJyIjoiSUNBZ0lDQWdZMjl1YzNRZ2NIVmlTR1Y0SUQwZ0tHRjNZV2wwSUZObFkzVnlaVk4wYjNKbExtZGxkRWwwWlcxQmMzbHVZeWduYTNaZmNIVmliR2xqWDJ0bGVTY3BLU0I4ZkNBbkp6c0tJQ0FnSUNBZ1kyOXVjM1FnWW1GamEzVndJRDBnWTNKbFlYUmxTV1JsYm5ScGRIbENiM1Z1WkVKaFkydDFjQ2h0Ym1WdGIyNXBZeXdnY0hWaVNHVjRMQ0EwS1RzZ0x5OGdNaTF2WmkwMExDQnBaR1Z1ZEdsMGVTMWliM1Z1WkFvZ0lDQWdJQ0J6WlhSV1lYVnNkRmRwY21WektHSmhZMnQxY0M1M2FYSmxjeWs3Q2c9PSIsImQiOiJZM0psWVhSbFNXUmxiblJwZEhsQ2IzVnVaRUpoWTJ0MWNDaHRibVZ0YjI1cFl5d2djSFZpU0dWNExDQTBLUT09In1d','base64').toString('utf8'));
const b64=x=>Buffer.from(x,'base64').toString('utf8');
const esc=t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\r?\n/g,'\r?\n');
const byFile={};
for(const e of EDITS){const f=b64(e.file);(byFile[f]=byFile[f]||[]).push(e);}
const planned={};
for(const [file,edits] of Object.entries(byFile)){
  let s; try{s=fs.readFileSync(file,'utf8');}catch{console.error('[ABORT] cannot read '+file);process.exit(1);}
  const eol=s.includes('\r\n')?'\r\n':'\n';
  for(const e of edits){
    const find=b64(e.f),repl=b64(e.r),done=b64(e.d);
    if(s.includes(done)){console.log('[skip] '+file+' edit '+e.n+' already applied.');continue;}
    const re=new RegExp(esc(find),'g'); const c=(s.match(re)||[]).length;
    if(c!==1){console.error('[ABORT] '+file+' edit '+e.n+': anchor found '+c+' times (expected 1). No writes.');process.exit(1);}
    s=s.replace(new RegExp(esc(find)),repl.replace(/\r?\n/g,eol));
    console.log('[ok]   '+file+' edit '+e.n+' staged.');
  }
  planned[file]=s;
}
for(const [file,content] of Object.entries(planned)) fs.writeFileSync(file,content);
console.log('[done] identity-bound recovery enforced. Re-run: npx tsc --noEmit');
